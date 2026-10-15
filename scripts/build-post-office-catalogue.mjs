// Builds data/derived/post-office-catalogue.json from the public set files.
// Exits 1 when a released set is missing or more than 2 percent of cards have no price.
// The nightly job does not call this yet. Wiring that call means editing a workflow file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostOfficeCatalogue, catalogueGuard } from "./lib/post-office-catalogue.mjs";

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
