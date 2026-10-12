// Writes research/assets/public/ir-cycle.json from the committed buckets,
// hist-long, rotation-status.json and listings-counted.json.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRows, listingsBySet, STUDY, SCORE_WEIGHTS } from "./lib/ir-cycle.mjs";
import { gunzipSync } from "node:zlib";
import { WEIGHTS, WEIGHT_CAP } from "./lib/popular-pokemon.mjs";

try {
const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "research/assets/public");
const J = async (p) => JSON.parse(await readFile(join(PUB, p), "utf-8"));
const rows = [];
for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) rows.push(...(await J("buckets/" + f)));
const longRows = {};
for (const f of (await readdir(join(PUB, "hist-long"))).filter((f) => /^\d+\.json$/.test(f))) Object.assign(longRows, (await J("hist-long/" + f)).rows || {});
const rot = await J("rotation-status.json");
const RAW = join(PUB, "../../../data/raw/ebay-sealed");
const gz = (await readdir(RAW).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).sort();
const readGz = async (f) => (f ? JSON.parse(gunzipSync(await readFile(join(RAW, f))).toString("utf-8")) : null);
const bySet = listingsBySet(await readGz(gz[gz.length - 1]), await readGz(gz[gz.length - 2]));
const today = rows.map((r) => r.asOf).filter(Boolean).sort().pop()?.slice(0, 10);
const list = buildRows({ rows, longRows, rot, bySet, today });
const doc = {
  asOf: today,
  note: "Factual position data, not advice. Includes IRs, SIRs, Trainer Gallery, Galarian Gallery and Sword & Shield alt arts. Prices are TCGplayer market. Listings are eBay sealed listings counted in our nightly pull for one sealed product of the set, not for the card.",
  sources: ["research/assets/public/buckets", "research/assets/public/hist-long", "research/assets/public/rotation-status.json", "data/raw/ebay-sealed (latest two nights)"],
  study: STUDY,
  popularity: { weights: WEIGHTS, cap: WEIGHT_CAP, file: "scripts/lib/popular-pokemon.mjs" },
  scoreWeights: SCORE_WEIGHTS,
  scoreNote: "Weights add to 100. The print window is one factor, not a gate. PSA 10 ratio is 0 until a cleared, dated graded source exists. Per-card scores are not published.",
  count: list.length,
  rows: list,
};
await writeFile(join(PUB, "feed/ir-cycle.json"), JSON.stringify(doc) + "\n");
console.log(`ir-cycle: ${list.length} rows as of ${today}`);
} catch (err) {
  console.error(`ir-cycle: kept the last file, ${err?.message || err}`);
}
