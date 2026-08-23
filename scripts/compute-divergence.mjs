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

import { flag } from "./flags.mjs";
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

// THE SPREAD IS HELD FROM PUBLICATION (2026-08-23). Two independent reasons,
// either sufficient on its own:
// (1) LICENSING — the TCGplayer side is PPT-derived, and PPT restricts
//     commercial use to a tier we do not hold. We do not publish data we are
//     not licensed to publish.
// (2) MEASUREMENT — our eBay figures include shipping where stated; TCG
//     figures never do; and no shipping-inclusive TCG price is obtainable at
//     any price (PPT has no shipping field on any tier, TCGplayer is not
//     granting new API access). Every row is biased in a known direction by
//     an unknowable amount, worst on cheap items.
// A number needing a caveat every time it appears does more explaining than
// working. Still computed for internal reads; returns publicly only when both
// gates clear.
const SPREAD_PUBLISHABLE = flag("ppt.publicDisplay") && flag("tcgDelivered");

const q = await loadBlocked();
// NO-GUESS LAW (Tyler, 8739773 — supersedes the abb4123 estimate): never
// invent a shipping cost. Where a source states no shipping, postage is
// treated as baked into the stated price, so that price already IS the
// delivered total. That applies to the TCGplayer side exactly as it does to
// an eBay listing with no stated postage: PPT reports market price with no
// shipping component, so we take it as delivered rather than adding $4.99.
// Removed 2026-08-22 (CC): the estimate was still running here after the law
// landed, so 32 of 135 rows published a spread computed off a guessed number
// while the methodology said we never guess. See the audit report.
// The removed constants were also factually wrong for our catalogue, verified
// against TCGplayer's own help centre the same day: their free-shipping tiers
// are $50 on TCGplayer Direct ($3.99 under) and seller-set elsewhere (commonly
// $5) — not $40 — and free shipping "only applies to small items (normal-sized
// singles)", which EXCLUDES sealed product entirely. So the old model zeroed
// out postage on the 103 rows above $40 where it is in fact never zero.
// STANDING BIAS, stated not modelled: every row here compares an eBay price
// that includes postage against a TCG price that excludes it, and no source
// exposes the missing figure (TCGplayer's API stopped granting new access;
// PPT has no shipping field on any tier — investigated 2026-08-22). So the
// spread OVERSTATES eBay's premium by an unmeasurable amount on every row,
// worst where prices are smallest. Do not read a small positive gap as a
// signal, and see the report's fork recommendation before promoting this
// instrument back to a headline.
const rows = [], skipped = [];
for (const p of ebay.products || []) {
  const t = tcgById.get(p.id);
  if (!t || t.dataStatus !== "live" || p.dataStatus !== "live" || !p.priceMedian || !t.tcgMarket) {
    skipped.push({ id: p.id, reason: !t ? "no tcg row" : `status ebay:${p.dataStatus}/tcg:${t?.dataStatus}` });
    continue;
  }
  // Both sides are taken as stated, neither is adjusted. eBay rows are already
  // delivered (item + postage where a listing states it; where none is stated
  // the cost is baked in, per the ruling). The TCG side states no postage, so
  // it is taken as delivered too. Tax excluded both sides, always.
  const ebayDelivered = p.priceMedian;
  const spreadBasis = "as-stated both sides, no shipping estimated (shipping in where stated, tax out)";
  const spread = (ebayDelivered - t.tcgMarket) / t.tcgMarket;
rows.push({ id: p.id, spreadBasis, publishBlocked: (p.publishBlock || q.blocked(p.id)) || undefined, name: p.name, ebayAskMedian: p.priceMedian, tcgMarket: t.tcgMarket,
    ebayListings: p.listingCount ?? null, tcgListings: t.tcgListings ?? null,
    spreadPct: Math.round(spread * 1000) / 10,
    signal: SPREAD_PUBLISHABLE && !OFF_TCG(p.id) && !p.publishBlock && !q.blocked(p.id) && Math.abs(spread) >= SIGNAL_PCT,
    offTcgEra: OFF_TCG(p.id) || undefined,
    venueNote: OFF_TCG(p.id) ? "vintage-class — this market trades on eBay, at shows, and in collector groups, so we read eBay-native stats only and skip the TCGplayer comparison (RT-4a)" : undefined,
    read: spread >= SIGNAL_PCT ? "eBay asks running hot vs TCG-side — sellers reaching or eBay supply tightening"
        : spread <= -SIGNAL_PCT ? "eBay asks under TCG-side — motivated eBay sellers, or the TCG sales average trailing a falling market"
        : "markets agree",
    provenance: { ebay: `Catchem-data eBay active asks, ${ebay.updatedAt?.split("T")[0]}`,
                  tcg: `${tcg.source}, ${t.providerUpdatedAt || tcg.updatedAt?.split("T")[0]}` } });
}
rows.sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct));
// ZERO-RESULT SAFETY, the same law sealed prices already live under.
// On 2026-08-23 the PPT daily credit pool was exhausted, so the crosscheck
// returned 0 live of 137 SKUs, so this compared NOTHING and wrote an empty
// report over a healthy one — and the schema guard two steps later killed the
// whole run naming DIVERGENCE, which was the victim rather than the cause.
//
// A provider outage must DEGRADE, not kill: keep yesterday's rows, mark them
// stale, and say so. An empty report published over a good one is the supply
// wipe-out shape the sealed bot was taught to refuse in August.
let prior = null;
try { prior = JSON.parse(await readFile(join(DATA, "divergence-report.json"), "utf-8")); } catch {}
const priorRows = prior?.rows?.length ?? 0;
if (!rows.length && priorRows > 0) {
  await writeFile(join(DATA, "divergence-report.json"), JSON.stringify({
    ...prior,
    dataStatus: "stale-upstream",
    staleSince: prior.generatedAt,
    staleReason: "the TCG crosscheck returned no live rows this run, so there was nothing to compare. Yesterday's comparison is kept rather than overwritten with an empty one.",
    checkedAt: new Date().toISOString(),
  }, null, 2) + String.fromCharCode(10));
  console.log(`· The Spread: 0 comparable rows this run — kept ${priorRows} prior rows and marked them stale-upstream`);
  process.exit(0);
}
await writeFile(join(DATA, "divergence-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "Cross-market divergence, both sides taken AS STATED — no shipping cost is ever estimated (no-guess law). eBay ask medians are delivered totals where a listing states postage, and where none is stated the cost is baked in. TCGplayer Market Price states no postage, so it is taken as delivered too. Tax excluded both sides, always. The TCG figure is TCGplayer's average of recent COMPLETED SALES on the US marketplace, USD (source-verified 2026-08-22; no region/filter parameters exist on the provider endpoint to get wrong, and no shipping-inclusive field is retrievable at any tier). Two structural asymmetries remain and are NOT signals: ASK vs SOLD, and any real postage the TCG side charges that we cannot see. |spread| >= 15% flags. A flat TCG line can mean no recent sales, not a frozen ask. TCG-side listing counts: provider exposes none for sealed - field carried as null, lights up if they ship it.",
  counts: { compared: rows.length, signals: rows.filter(r => r.signal).length, skipped: skipped.length },
  rows, skipped }, null, 2) + "\n");
console.log(`✓ The Spread: ${rows.length} compared, ${rows.filter(r=>r.signal).length} signals`);
for (const r of rows.slice(0, 5)) console.log(`  ${r.signal?"⚡":"  "} ${String(r.spreadPct).padStart(6)}%  ${r.name.slice(0,40)}`);
