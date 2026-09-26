// Heat Check v1. Listing history is ours. TCGplayer momentum is used only
// when that file has 30 prices. Trends and YouTube are skipped when they fail.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WRONG_MATCH_IDS, labelFor, listingHeat, momentum, scoreFrom } from "./lib/heat-check.mjs";

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

const tcg = new Map();
try {
  const dir = join(ROOT, "data/history/tcgplayer-market");
  for (const name of await readdir(dir)) {
    if (!name.endsWith(".json") || name === "mapping.json" || name === "unmatched.json" || name === "coverage.json") continue;
    const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
    tcg.set(doc.id, doc.points || []);
  }
} catch { /* no backfill on this branch */ }

const skipped = {
  trends: "Google Trends was not called. The pytrends package is not installed, so this input is empty.",
  youtube: "Not scored. There is no 90-day trail of new-video counts, so one lookup would not be a z-score. No YouTube API key is set either.",
};

const out = [];
for (const [id, list] of rows) {
  if (quarantine.has(id) || WRONG_MATCH_IDS.has(id)) continue;
  const listings = listingHeat(list.map((r) => ({ date: r.date, listingCount: r.listingCount })), today);
  if (listings.z == null) continue;
  const mom = momentum(tcg.get(id) || []);
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
      listingChangeZ: Math.round(listings.z * 1000) / 1000,
      listingDays: listings.days,
      tcgplayerMomentum: mom.latest,
      tcgplayerMomentumZ: mom.z == null ? null : Math.round(mom.z * 1000) / 1000,
      tcgplayerDays: mom.days,
      googleTrends: null,
      youtube: null,
    },
  });
}
out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
const doc = {
  asOf: today,
  method: "Each input is a z-score against that product's own trailing 90 days. Weights: listings 0.40, TCGplayer market momentum 0.30, Google Trends 0.20, new YouTube videos 0.10. A missing input is left out and the score is marked partial. 50 is the middle.",
  skipped,
  products: out,
};
await writeFile(join(ROOT, "data/heat-check.json"), JSON.stringify(doc, null, 2));
console.log(`heat check ${out.length} products`);
if (out.length) {
  console.log("hottest");
  for (const r of out.slice(0, 10)) console.log(`  ${r.score} ${r.label} ${r.name} change ${r.inputs.listingChange}`);
  console.log("coldest");
  for (const r of out.slice(-10)) console.log(`  ${r.score} ${r.label} ${r.name} change ${r.inputs.listingChange}`);
}
