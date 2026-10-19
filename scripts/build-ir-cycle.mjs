// Writes research/assets/public/ir-cycle.json from the committed buckets,
// hist-long, rotation-status.json and listings-counted.json.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRows, listingsBySet, STUDY, cardMarks, MIXED_SETS, cleanWeights } from "./lib/ir-cycle.mjs";
import { openPrivate } from "./lib/private-store.mjs";
import { gunzipSync } from "node:zlib";

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
const attrs = JSON.parse(await readFile(join(PUB, "../../../data/card-attrs.json"), "utf-8"));
const cards = cardMarks(rows, attrs.cards || {});
// Weights stay in catchem-data-private. Read only; nothing is pushed back.
let weights = null;
try {
  const store = await openPrivate({ root: join(PUB, "../../.."), token: process.env.PRIVATE_DATA_TOKEN || "" });
  try { weights = cleanWeights(JSON.parse(await readFile(join(store.dir, "ir-cycle/weights.json"), "utf-8"))); } catch { weights = null; }
  if (store.remote) await store.close([], "ir cycle read only");
} catch (err) { console.error(`ir-cycle: private weights not read, ${err?.message || err}`); }
if (!weights) console.log("ir-cycle: no private weights, so rows keep a plain order");
const list = buildRows({ rows, longRows, rot, bySet, today, marks: cards, weights });
const doc = {
  asOf: today,
  note: "Factual position data, not advice. Includes Illustration Rares, Special Illustration Rares, Trainer Gallery, Galarian Gallery, Alternate Art (Sword & Shield) and Tag Team (Alternate Art) cards, each named by its own rarity. Prices are TCGplayer market. No sealed data.",
  sources: ["research/assets/public/buckets", "research/assets/public/hist-long", "research/assets/public/rotation-status.json", "data/raw/ebay-sealed (latest two nights)"],
  study: STUDY,
  scoreNote: "Order comes from a private multi-factor score. The print window is one factor, not a gate. Scores and weights are not published.",
  count: list.length,
  rows: list,
};
await writeFile(join(PUB, "feed/ir-cycle.json"), JSON.stringify(doc) + "\n");
await writeFile(join(PUB, "feed/card-marks.json"), JSON.stringify({ asOf: today, source: "data/card-attrs.json (pokemontcg.io regulationMark), matched by the card's scan id", attrsGenerated: String(attrs.generatedAt || "").slice(0, 10), sets: MIXED_SETS, count: Object.keys(cards).length, cards }) + "\n");
console.log(`card-marks: ${Object.keys(cards).length} cards`);
console.log(`ir-cycle: ${list.length} rows as of ${today}`);
} catch (err) {
  console.error(`ir-cycle: kept the last file, ${err?.message || err}`);
}
