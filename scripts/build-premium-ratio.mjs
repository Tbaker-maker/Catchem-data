// Writes research/assets/public/premium-ratio.json from TCGplayer daily files.
// Flags only. Bands stay in the private model spec. A missing spec writes nothing.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { flagFromSeries, setsFromBoxes, boosterBoxFlagGap } from "./lib/premium-ratio.mjs";
import { loadHistoryDays, seriesForPremium } from "./lib/premium-history.mjs";
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

const sealed = products.filter((row) => row?.tcgPlayerId);
const want = new Set(sealed.map((row) => String(row.tcgPlayerId)));
const days = await loadHistoryDays(join(ROOT, "data/history/tcgcsv-daily"));
const { series, asOf } = seriesForPremium(days, want);

const byProduct = {};
const sealedIds = [];
const flagByPid = new Map();
const daysByPid = new Map();
for (const [id, points] of series) daysByPid.set(id, new Set(points.map((p) => p[0])).size);
for (const row of sealed) {
  const pid = String(row.tcgPlayerId);
  const ids = [`tcgcsv-${pid}`, String(row.id || "")].filter(Boolean);
  for (const id of ids) sealedIds.push(id);
  const flag = flagFromSeries(series.get(pid) || [], spec);
  if (!flag) continue;
  flagByPid.set(pid, flag);
  for (const id of ids) byProduct[id] = flag;
}

const { bySet } = setsFromBoxes(products, flagByPid, daysByPid);
const gap = boosterBoxFlagGap({ byProduct, bySet }, products, daysByPid);
if (gap.failed) {
  console.error("premium ratio: a booster box flag is missing from bySet");
  process.exit(1);
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
