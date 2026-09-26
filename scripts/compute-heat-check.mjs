// Heat Check v1. Listing history is ours. TCGplayer momentum is used only
// when that file has 30 prices. Trends and YouTube are skipped when they fail.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WRONG_MATCH_IDS, labelFor, listingHeat, momentum, scoreFrom } from "./lib/heat-check.mjs";
import { loadMarketHistory } from "./lib/market-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const today = new Date().toISOString().slice(0, 10);

const products = await J("data/sealed-products.json");
const byId = new Map(products.map((p) => [p.id, p]));
const heat = await J("data/heat-history.json");
const quarantine = new Set((await J("data/quarantine.json")).entries.map((e) => e.id));
const rows = new Map();
for (const r of heat) {
  if (!rows.has(r.id)) rows.set(r.id, []);
  rows.get(r.id).push(r);
}
for (const list of rows.values()) list.sort((a, b) => a.date < b.date ? -1 : 1);

// TCGplayer market history: TCGCSV live days, plus the PokemonPriceTracker
// daily backfill where TCGCSV has no point for that day. Missing days stay missing.
const hist = await loadMarketHistory(ROOT);
const tcg = new Map([...hist.merged].map(([id, pts]) => [id, pts]));

const skipped = {
  trends: "Google Trends was not called. The pytrends package is not installed, so this input is empty.",
  youtube: "Not scored. There is no 90-day trail of new-video counts, so one lookup would not be a z-score. No YouTube API key is set either.",
};

const out = [];
// A product is scored when at least one input has its 30 days: 30 one-day
// listing changes, or 30 TCGplayer market prices (plus 30 momentum readings to
// z-score against). Whatever is short is left empty and the score says partial.
const ids = new Set([...rows.keys(), ...tcg.keys()]);
for (const id of ids) {
  if (quarantine.has(id) || WRONG_MATCH_IDS.has(id)) continue;
  if (!byId.has(id)) continue;
  const list = rows.get(id) || [];
  const listings = listingHeat(list.map((r) => ({ date: r.date, listingCount: r.listingCount })), today);
  const series = tcg.get(id) || [];
  // A TCGplayer series that stopped more than 3 days ago describes an older
  // market, not today's. It is left out rather than scored as current.
  const fresh = series.length && Date.parse(today) - Date.parse(series.at(-1).date) <= 3 * 86400000;
  const mom = fresh ? momentum(series) : { z: null, latest: null, days: series.length, stale: series.length ? series.at(-1).date : null };
  const parts = [
    { key: "listings", weight: 0.40, z: listings.z },
    { key: "tcgplayerMomentum", weight: 0.30, z: mom.z },
    { key: "googleTrends", weight: 0.20, z: null },
    { key: "youtube", weight: 0.10, z: null },
  ];
  const scored = scoreFrom(parts);
  if (!scored) continue;
  const p = byId.get(id);
  out.push({
    id,
    name: p?.name || id,
    score: scored.score,
    label: labelFor(scored.score),
    partial: scored.partial,
    weightsUsed: scored.weightsUsed,
    inputs: {
      listingChange: listings.latest,
      listingChangeZ: listings.z == null ? null : Math.round(listings.z * 1000) / 1000,
      listingDays: listings.days,
      tcgplayerMomentum: mom.latest,
      tcgplayerMomentumZ: mom.z == null ? null : Math.round(mom.z * 1000) / 1000,
      tcgplayerDays: mom.days,
      tcgplayerStaleSince: mom.stale || null,
      tcgplayerFrom: (tcg.get(id) || [])[0]?.date || null,
      tcgplayerSources: [...new Set((tcg.get(id) || []).map((p) => p.source))],
      googleTrends: null,
      youtube: null,
    },
  });
}
out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
const doc = {
  asOf: today,
  method: "Each input is a z-score against that product's own trailing 90 days. Weights: listings 0.40, TCGplayer market momentum 0.30, Google Trends 0.20, new YouTube videos 0.10. A missing input is left out and the score is marked partial. 50 is the middle.",
  eligibility: "Scored when at least one input has 30 days: 30 one-day listing changes, or 30 TCGplayer market prices with 30 momentum readings. Listing changes across a gap in our eBay history are not counted.",
  marketHistory: hist.coverage,
  skipped,
  products: out,
};
await writeFile(join(ROOT, "data/heat-check.json"), JSON.stringify(doc, null, 2));
console.log(`heat check ${out.length} products`);
if (out.length) {
  console.log("hottest");
  for (const r of out.slice(0, 10)) console.log(`  ${r.score} ${r.label} ${r.name} listings ${r.inputs.listingChange} momentum ${r.inputs.tcgplayerMomentum == null ? '-' : (r.inputs.tcgplayerMomentum * 100).toFixed(2) + '%'}`);
  console.log("coldest");
  for (const r of out.slice(-10)) console.log(`  ${r.score} ${r.label} ${r.name} listings ${r.inputs.listingChange} momentum ${r.inputs.tcgplayerMomentum == null ? '-' : (r.inputs.tcgplayerMomentum * 100).toFixed(2) + '%'}`);
}
