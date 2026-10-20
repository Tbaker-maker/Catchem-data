// Writes research/assets/public/premium-ratio.json from TCGplayer daily files.
// Flags only. Bands stay in the private model spec. A missing spec writes nothing.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flagFromSeries, foldSet } from "./lib/premium-ratio.mjs";
import { openPrivate } from "./lib/private-store.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public/premium-ratio.json");
const SPEC_REL = "model-spec/spec.json";

const readJson = async (p) => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };

async function loadSpec() {
  const local = await readJson(join(ROOT, "data/private", SPEC_REL));
  if (local?.premiumRatio) return local.premiumRatio;
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const store = await openPrivate({ root: ROOT, token });
    try {
      const spec = await readJson(join(store.dir, SPEC_REL));
      return spec?.premiumRatio || null;
    } finally { await store.close([], "premium ratio spec read only"); }
  } catch { return null; }
}

function skipBox(name) {
  return /1st edition|unlimited|half booster|enhanced|shadowless|revised/i.test(String(name || ""));
}

const spec = await loadSpec();
if (!spec) {
  console.log("premium ratio: no private spec, left the public file as it is");
  process.exit(0);
}

const products = await readJson(join(ROOT, "data/sealed-products.json"));
if (!Array.isArray(products)) {
  console.log("premium ratio: no sealed list, nothing written");
  process.exit(0);
}

const boxes = products.filter((row) => row?.subtype === "booster-box" && row.tcgPlayerId);
const sealed = products.filter((row) => row?.tcgPlayerId);
const want = new Set(sealed.map((row) => String(row.tcgPlayerId)));
const dir = join(ROOT, "data/history/tcgcsv-daily");
const files = (await readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
const series = new Map();
let asOf = "";
for (const name of files) {
  const day = await readJson(join(dir, name));
  const date = String(day?.date || name.slice(0, 10));
  if (date > asOf) asOf = date;
  for (const row of day?.prices || []) {
    const id = String(row?.id || "");
    if (!want.has(id) || !(Number(row.market) > 0)) continue;
    if (!series.has(id)) series.set(id, []);
    series.get(id).push([date, Number(row.market)]);
  }
}

const byProduct = {};
const sealedIds = [];
for (const row of sealed) {
  const pid = String(row.tcgPlayerId);
  const ids = [`tcgcsv-${pid}`, String(row.id || "")].filter(Boolean);
  for (const id of ids) sealedIds.push(id);
  const flag = flagFromSeries(series.get(pid) || [], spec);
  if (!flag) continue;
  for (const id of ids) byProduct[id] = flag;
}

const byGroup = new Map();
for (const row of boxes) {
  const key = String(row.set || "");
  if (!byGroup.has(key)) byGroup.set(key, []);
  byGroup.get(key).push(row);
}
const bySet = {};
for (const [setName, group] of byGroup) {
  const plain = group.filter((row) => !skipBox(row.name));
  const pool = plain.length ? plain : group;
  pool.sort((a, b) => (series.get(String(b.tcgPlayerId))?.length || 0) - (series.get(String(a.tcgPlayerId))?.length || 0) || String(a.name).length - String(b.name).length);
  const box = pool[0];
  const flag = flagFromSeries(series.get(String(box.tcgPlayerId)) || [], spec);
  if (!flag) continue;
  bySet[foldSet(setName)] = { flag, boxId: `tcgcsv-${box.tcgPlayerId}` };
}

const doc = {
  asOf,
  source: "TCGplayer market",
  note: "Flags only. below means the latest market price is under that product's usual level. above means over. A product left out is neutral or has too little history. Singles use the set booster box. A set with no booster box is left out. An ETB is not the fallback.",
  byProduct,
  bySet,
  sealed: [...new Set(sealedIds)].sort(),
};
await writeFile(OUT, JSON.stringify(doc) + "\n");
const sets = Object.keys(bySet).length;
const flagged = new Set(Object.values(byProduct)).size;
console.log(`premium ratio: as of ${asOf}, ${Object.keys(byProduct).length} product ids flagged, ${sets} sets with a booster box flag`);
void flagged;
