// scripts/compute-divergence.mjs — "The Spread"
// Joins eBay ask medians (data/sealed-prices.json) with the TCG-side market
// price (data/sealed-crosscheck.json) → data/divergence-report.json.
// SOURCE VERIFIED 2026-08-22 (region+shipping audit, CC): PPT's unopenedPrice
// exactly matches tcgplayer.com's displayed MARKET PRICE (2460.46/9.23 to
// the cent) — which TCGplayer documents as an outlier-trimmed average of
// recent COMPLETED SALES, item price only (their own CSV taxonomy keeps
// "w/ Shipping" as a separate labeled price point). US marketplace, USD;
// PPT's EUR lane is a separate opt-in Cardmarket beta we never request.
// No region/currency/filter parameters exist on the endpoint to get wrong.
// (Corrects the Aug-18 "ASK-derived" note: base1 flat 35 days meant NO
// RECENT SALES freezing the average, not a stale ask.)
// Shipping is handled by the delivered-vs-delivered model below (Tyler
// ruling: est. shipping ADDED to the item-only TCG figure). The remaining
// structural asymmetry is ASK vs SOLD: our eBay side is what listings ask,
// the TCG side is what recently SOLD — different instruments (Trust
// Standard: separate provenance, never mixed); divergence is the signal,
// and asks resting somewhat above solds is definitional, not a read.
// Runs standalone; consumes whatever provider fills the crosscheck contract.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const SIGNAL_PCT = 0.15;

const ebay = JSON.parse(await readFile(join(DATA, "sealed-prices.json"), "utf-8"));
let tcg;
try { tcg = JSON.parse(await readFile(join(DATA, "sealed-crosscheck.json"), "utf-8")); }
catch { console.log("no sealed-crosscheck.json yet — provider eval pending; exiting clean"); process.exit(0); }

const tcgById = new Map(tcg.products.map(p => [p.id, p]));
// RT-4a venue gate — canonical implementation in lib, unit-tested in CI.
import { offTcgEra as OFF_TCG } from "./lib/instruments.mjs";
// Durable quarantine: publishBlock flags are wiped by each fetch rebuild and
// qa-gate hasn't run yet at this point in the pipeline — read the durable
// file too, or a manually-held product qualifies as a signal (2026-08-22 leak).
import { loadBlocked } from "./lib/publish-guard.mjs";
const q = await loadBlocked();
const TCG_SHIP_EST = 4.99;        // typical small-parcel charge, est.
const TCG_FREE_SHIP_OVER = 40;    // TCGplayer free-shipping threshold, est.
const tcgDelivered = m => m == null ? null
  : Math.round((m + (m >= TCG_FREE_SHIP_OVER ? 0 : TCG_SHIP_EST)) * 100) / 100;
const rows = [], skipped = [];
for (const p of ebay.products || []) {
  const t = tcgById.get(p.id);
  if (!t || t.dataStatus !== "live" || p.dataStatus !== "live" || !p.priceMedian || !t.tcgMarket) {
    skipped.push({ id: p.id, reason: !t ? "no tcg row" : `status ebay:${p.dataStatus}/tcg:${t?.dataStatus}` });
    continue;
  }
  const ebayDelivered = p.priceMedian;                       // already delivered
  const tcgDeliv = tcgDelivered(t.tcgMarket);
  const spreadBasis = "delivered-vs-delivered (shipping in, tax out)";
  const spread = (ebayDelivered - tcgDeliv) / tcgDeliv;
  // DELIVERED vs DELIVERED (Tyler ruling, 2026-08-23): "always add shipping on
// both sides. Never add tax but indicate tax is not included. If a listing has
// no shipping price, assume the cost is baked in already."
// So the comparison is what a buyer actually pays on each side. eBay rows are
// already delivered (item + shipping where stated; where no shipping is stated
// the cost is treated as included, per the ruling). TCGplayer market price is
// item-only, so an estimated shipping cost is ADDED to it. Tax is excluded on
// both sides and said so plainly — it varies by state and by seller nexus.
// The shipping estimate below is labelled est. and needs periodic verification.
rows.push({ id: p.id, spreadBasis, tcgDelivered: tcgDeliv, tcgShipEst: t.tcgMarket >= TCG_FREE_SHIP_OVER ? 0 : TCG_SHIP_EST, publishBlocked: (p.publishBlock || q.blocked(p.id)) || undefined, name: p.name, ebayAskMedian: p.priceMedian, tcgMarket: t.tcgMarket,
    ebayListings: p.listingCount ?? null, tcgListings: t.tcgListings ?? null,
    spreadPct: Math.round(spread * 1000) / 10,
    signal: !OFF_TCG(p.id) && !p.publishBlock && !q.blocked(p.id) && Math.abs(spread) >= SIGNAL_PCT,
    offTcgEra: OFF_TCG(p.id) || undefined,
    venueNote: OFF_TCG(p.id) ? "vintage-class — this market trades on eBay, at shows, and in collector groups, so we read eBay-native stats only and skip the TCGplayer comparison (RT-4a)" : undefined,
    read: spread >= SIGNAL_PCT ? "eBay asks running hot vs TCG-side — sellers reaching or eBay supply tightening"
        : spread <= -SIGNAL_PCT ? "eBay asks under TCG-side — motivated eBay sellers, or the TCG sales average trailing a falling market"
        : "markets agree",
    provenance: { ebay: `Catchem-data eBay active asks, ${ebay.updatedAt?.split("T")[0]}`,
                  tcg: `${tcg.source}, ${t.providerUpdatedAt || tcg.updatedAt?.split("T")[0]}` } });
}
rows.sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct));
await writeFile(join(DATA, "divergence-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "Cross-market divergence, delivered-vs-delivered: eBay delivered-ask median vs TCGplayer Market Price plus an estimated shipping cost (free over $40, est. $4.99 below — the source figure is item-only). TCGplayer Market Price is their average of recent COMPLETED SALES on the US marketplace, USD — source-verified 2026-08-22, no region/filter parameters exist on the provider endpoint to get wrong. Shipping is normalized by the model; the remaining structural asymmetry is ASK vs SOLD, so a resting positive gap is definitional plus the RT-4 photo premium. |spread| >= 15% flags; negative gaps read stronger (an ask sitting UNDER recent sold-plus-shipping is fighting the definition). A flat TCG line can mean no recent sales, not a frozen ask. Tax excluded both sides, always. TCG-side listing counts: provider exposes none for sealed - field carried as null, lights up if they ship it.",
  counts: { compared: rows.length, signals: rows.filter(r => r.signal).length, skipped: skipped.length },
  rows, skipped }, null, 2) + "\n");
console.log(`✓ The Spread: ${rows.length} compared, ${rows.filter(r=>r.signal).length} signals`);
for (const r of rows.slice(0, 5)) console.log(`  ${r.signal?"⚡":"  "} ${String(r.spreadPct).padStart(6)}%  ${r.name.slice(0,40)}`);
