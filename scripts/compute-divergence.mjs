// scripts/compute-divergence.mjs — "The Spread"
// Joins eBay ask medians (data/sealed-prices.json) with TCG sales-based
// market (data/sealed-crosscheck.json) → data/divergence-report.json.
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
const rows = [], skipped = [];
for (const p of ebay.products || []) {
  const t = tcgById.get(p.id);
  if (!t || t.dataStatus !== "live" || p.dataStatus !== "live" || !p.priceMedian || !t.tcgMarket) {
    skipped.push({ id: p.id, reason: !t ? "no tcg row" : `status ebay:${p.dataStatus}/tcg:${t?.dataStatus}` });
    continue;
  }
  const spread = (p.priceMedian - t.tcgMarket) / t.tcgMarket;
  rows.push({ id: p.id, name: p.name, ebayAskMedian: p.priceMedian, tcgMarket: t.tcgMarket,
    spreadPct: Math.round(spread * 1000) / 10,
    signal: Math.abs(spread) >= SIGNAL_PCT,
    read: spread >= SIGNAL_PCT ? "asks running hot vs sales — sellers reaching or supply tightening"
        : spread <= -SIGNAL_PCT ? "asks under sales-market — motivated sellers or stale TCG side"
        : "markets agree",
    provenance: { ebay: `Catchem-data eBay active asks, ${ebay.updatedAt?.split("T")[0]}`,
                  tcg: `${tcg.source}, ${t.providerUpdatedAt || tcg.updatedAt?.split("T")[0]}` } });
}
rows.sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct));
await writeFile(join(DATA, "divergence-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "eBay ask median vs TCG sales-based market. Different instruments; divergence is signal, not error. |spread| >= 15% flags.",
  counts: { compared: rows.length, signals: rows.filter(r => r.signal).length, skipped: skipped.length },
  rows, skipped }, null, 2) + "\n");
console.log(`✓ The Spread: ${rows.length} compared, ${rows.filter(r=>r.signal).length} signals`);
for (const r of rows.slice(0, 5)) console.log(`  ${r.signal?"⚡":"  "} ${String(r.spreadPct).padStart(6)}%  ${r.name.slice(0,40)}`);
