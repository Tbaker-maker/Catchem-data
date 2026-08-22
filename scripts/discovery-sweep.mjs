// discovery-sweep.mjs — price everything once, then find the floor from data.
//
// THE INSIGHT THAT MAKES THIS AFFORDABLE (Tyler, 2026-08-23): discovery and
// refresh are different budgets. Pricing all 16,468 catalogue cards ONE TIME
// costs 16,468 calls — it fits inside a single day's 20,000 allowance with
// 3,500 to spare. Refreshing them every day forever does not, and does not
// need to: most cards are bulk nobody watches.
//
// So spend one day measuring, then set the floor where the data says it
// belongs. Our current 122 priced singles are all hand-picked chases, so every
// rarity in that sample looks expensive — a floor derived from it would be
// selection bias wearing a decimal point. Guessing a number now would be
// choosing one in order to avoid measuring one.
//
// AFTER THE SWEEP: the analysis below finds where the distribution actually
// breaks, so the daily refresh list is drawn from evidence rather than a
// round number somebody liked.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const DAILY_BUDGET = Number(process.env.PPT_DAILY_BUDGET || 20000);
const RESERVE = 2000;                 // leave room for the normal daily run
const API = "https://api.pokemontcg.io/v2";
const KEY = process.env.POKEMONTCG_API_KEY;

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· discovery: no catalogue — run ingest-catalogue.mjs first"); }
else {
  let store = await J("data/discovery-prices.json") ?? {
    note: "One-time price sweep across the whole catalogue, so the refresh floor can be set from real data instead of a guess. Not a daily feed — this is the measurement that decides what the daily feed contains.",
    sweptAt: null, prices: {}, failed: [] };

  const ids = Object.keys(cat.cards).filter(id => store.prices[id] === undefined);
  const budget = Math.max(0, DAILY_BUDGET - RESERVE);
  const batch = ids.slice(0, budget);
  console.log(`  ${ids.length.toLocaleString("en-US")} unpriced · budget ${budget.toLocaleString("en-US")} · sweeping ${batch.length.toLocaleString("en-US")} this run`);

  let done = 0;
  for (const id of batch) {
    try {
      // Node's fetch never times out on its own. One slow host hangs a 16,000-call
      // sweep until the runner kills it, and a hung job reports nothing at all —
      // which is worse than a red one. Caught by CC's guard the moment I wrote it.
      const r = await fetch(`${API}/cards/${encodeURIComponent(id)}`, {
        headers: KEY ? { "X-Api-Key": KEY } : {}, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { store.failed.push(id); continue; }
      const d = (await r.json()).data;
      // Take the highest variant price — a card's headline value is what its
      // best printing fetches, and a floor built on the cheapest variant would
      // exclude cards that are genuinely worth watching in another finish.
      const tp = d?.tcgplayer?.prices ?? {};
      const best = Math.max(0, ...Object.values(tp).map(v => v?.market ?? v?.mid ?? 0).filter(Number.isFinite));
      store.prices[id] = best > 0 ? Math.round(best * 100) / 100 : 0;
      done++;
    } catch { store.failed.push(id); }
    if (done % 500 === 0 && done) { store.sweptAt = new Date().toISOString(); await writeFile(join(ROOT, "data/discovery-prices.json"), JSON.stringify(store)); }
    await new Promise(r => setTimeout(r, 60));
  }
  store.sweptAt = new Date().toISOString();
  await writeFile(join(ROOT, "data/discovery-prices.json"), JSON.stringify(store));

  // ── WHERE DOES THE DISTRIBUTION BREAK? ──────────────────────────────────
  const vals = Object.values(store.prices).filter(v => v > 0).sort((a, b) => a - b);
  if (vals.length >= 200) {
    const at = (f) => vals[Math.floor(vals.length * f)];
    const above = (x) => vals.filter(v => v >= x).length;
    const total = Object.keys(store.prices).length;
    const bands = [0.25, 0.5, 1, 2, 5, 10, 25, 50].map(floor => ({
      floor, cards: above(floor),
      shareOfCatalogue: Math.round(above(floor) / total * 1000) / 10,
      // The number that decides it: what share of total market value sits
      // above this floor? A floor that keeps 90% of the value while dropping
      // 80% of the cards is the one worth having.
      shareOfValue: Math.round(vals.filter(v => v >= floor).reduce((a, b) => a + b, 0) / vals.reduce((a, b) => a + b, 0) * 1000) / 10,
    }));
    const best = bands.filter(b => b.shareOfValue >= 95).sort((a, b) => a.cards - b.cards)[0];
    const report = { sweptAt: store.sweptAt, priced: vals.length, zeroOrUnknown: total - vals.length,
      median: at(0.5), p90: at(0.9), p99: at(0.99), bands,
      recommendation: best ? {
        floor: best.floor, dailyRefreshCards: best.cards,
        keeps: `${best.shareOfValue}% of total catalogue value`,
        drops: `${Math.round((1 - best.cards / total) * 1000) / 10}% of the cards`,
        why: "The cheapest floor that still holds 95% of the market's value. Below it, cards contribute almost nothing to any index while costing a call a day each, forever." } : null };
    await writeFile(join(ROOT, "research/pulse/discovery-analysis.json"), JSON.stringify(report, null, 1));
    console.log(`\n  ${vals.length.toLocaleString("en-US")} priced · median $${at(0.5)} · p90 $${at(0.9)} · p99 $${at(0.99)}\n`);
    for (const b of bands) console.log(`   $${String(b.floor).padStart(5)}+  ${String(b.cards).padStart(6)} cards (${b.shareOfCatalogue}% of catalogue) holding ${b.shareOfValue}% of the value`);
    if (report.recommendation) console.log(`\n  → floor $${report.recommendation.floor}: ${report.recommendation.dailyRefreshCards.toLocaleString("en-US")} cards a day, ${report.recommendation.keeps}, dropping ${report.recommendation.drops}\n`);
  } else {
    console.log(`  ${vals.length} priced so far — need 200+ before the distribution means anything. Run again tomorrow.`);
  }
}
