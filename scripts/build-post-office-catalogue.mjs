// Builds data/derived/post-office-catalogue.json from the public set files.
// Exits 1 when a released set is missing or more than 2 percent of cards have no price.
// The nightly job does not call this yet. Wiring that call means editing a workflow file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostOfficeCatalogue, catalogueGuard } from "./lib/post-office-catalogue.mjs";
import { poolFromData, previewLines } from "./lib/custom-reads-pipe.mjs";
import { guardSkip, loadDaily, loadGuard } from "./lib/reads-guard.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/derived/post-office-catalogue.json");

async function readJson(rel) {
  return JSON.parse(await readFile(join(ROOT, rel), "utf8"));
}

const index = await readJson("research/assets/public/sets.json");
const groupsDoc = await readJson("data/tcgcsv-groups.json");
const cardsBySlug = {};
for (const set of index.sets || []) {
  const doc = await readJson(`research/assets/public/sets/${set.slug}.json`);
  cardsBySlug[set.slug] = doc.items || [];
}

const catalogue = buildPostOfficeCatalogue({
  sets: index.sets || [],
  groups: groupsDoc.groups || [],
  cardsBySlug,
  asOf: index.asOf || "",
});
const guard = catalogueGuard(catalogue, { expected: index.sets || [] });
catalogue.guard = guard;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(catalogue));
let sealed = null;
try { sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8")); } catch { sealed = null; }
const guardCfg = await loadGuard(ROOT);
if (!guardCfg) console.warn("set lines: reads guard limits not loaded, no price check on the set lines");
const skip = guardSkip(catalogue, guardCfg, await loadDaily(ROOT));
const preview = previewLines(poolFromData({ catalogue, sealed, skip }));
const previewPath = join(ROOT, "research/assets/public/reads-preview.json");
await writeFile(previewPath, JSON.stringify(preview, null, 2) + "\n");
const priced = catalogue.sets.reduce((sum, set) => sum + set.priced, 0);
console.log(JSON.stringify({
  asOf: catalogue.asOf,
  sets: catalogue.sets.length,
  priced,
  ok: guard.ok,
  share: guard.share,
  problems: guard.problems.length,
}));
if (!guard.ok) {
  console.error(JSON.stringify(guard.problems.slice(0, 12)));
  process.exit(1);
}
