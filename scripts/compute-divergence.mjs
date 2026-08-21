// scripts/compute-divergence.mjs — "The Spread"
// Joins eBay ask medians (data/sealed-prices.json) with the TCG-side market
// price (data/sealed-crosscheck.json — PPT sealed prices are ASK-derived,
// proven Aug 18: base1 flat 35 days = stale ask, not sales) → data/divergence-report.json.
// Ask vs sales-market are DIFFERENT instruments (Trust Standard: separate
// provenance, never mixed) — divergence between them is the signal.
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
const rows = [], skipped = [];
for (const p of ebay.products || []) {
  const t = tcgById.get(p.id);
  if (!t || t.dataStatus !== "live" || p.dataStatus !== "live" || !p.priceMedian || !t.tcgMarket) {
    skipped.push({ id: p.id, reason: !t ? "no tcg row" : `status ebay:${p.dataStatus}/tcg:${t?.dataStatus}` });
    continue;
  }
  const spread = (p.priceMedian - t.tcgMarket) / t.tcgMarket;
  rows.push({ id: p.id, publishBlocked: p.publishBlock || undefined, name: p.name, ebayAskMedian: p.priceMedian, tcgMarket: t.tcgMarket,
    ebayListings: p.listingCount ?? null, tcgListings: t.tcgListings ?? null,
    spreadPct: Math.round(spread * 1000) / 10,
    signal: !OFF_TCG(p.id) && !p.publishBlock && Math.abs(spread) >= SIGNAL_PCT,
    offTcgEra: OFF_TCG(p.id) || undefined,
    venueNote: OFF_TCG(p.id) ? "vintage-class — trades on eBay, shows, and collector groups; TCG comparison gated (RT-4a)" : undefined,
    read: spread >= SIGNAL_PCT ? "eBay asks running hot vs TCG-side — sellers reaching or eBay supply tightening"
        : spread <= -SIGNAL_PCT ? "eBay asks under TCG-side — motivated eBay sellers or stale TCG-side price"
        : "markets agree",
    provenance: { ebay: `Catchem-data eBay active asks, ${ebay.updatedAt?.split("T")[0]}`,
                  tcg: `${tcg.source}, ${t.providerUpdatedAt || tcg.updatedAt?.split("T")[0]}` } });
}
rows.sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct));
await writeFile(join(DATA, "divergence-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "Cross-market ASK divergence: eBay ask median vs TCG-side ask-derived market (PPT). Two markets disagreeing on price is the signal. Baseline +5-15% is STRUCTURAL (RT-4 photo premium: eBay shows the item, TCG sealed rarely does). |spread| >= 15% flags; negative gaps read stronger (fighting the trust premium). Not sold data. TCG-side listing counts: provider exposes none for sealed - field carried as null, lights up if they ship it.",
  counts: { compared: rows.length, signals: rows.filter(r => r.signal).length, skipped: skipped.length },
  rows, skipped }, null, 2) + "\n");
console.log(`✓ The Spread: ${rows.length} compared, ${rows.filter(r=>r.signal).length} signals`);
for (const r of rows.slice(0, 5)) console.log(`  ${r.signal?"⚡":"  "} ${String(r.spreadPct).padStart(6)}%  ${r.name.slice(0,40)}`);
