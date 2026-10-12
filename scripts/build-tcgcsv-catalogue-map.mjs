import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mapSingles } from "./lib/tcgcsv-catalogue-map.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (path) => readFile(join(ROOT, path), "utf8").then(JSON.parse);

const groups = await read("data/tcgcsv-groups.json");
const sets = await read("data/catalogue-set-codes.json");
const catalogue = await read("data/card-catalogue.json");
const catalog = await read("data/catalog/tcgcsv-latest.json");
const singles = catalog.items.filter((item) => item.kind === "single");
const built = mapSingles({ groups: groups.groups, sets: sets.sets, cards: catalogue.cards, items: singles });
const prior = await read("data/tcgcsv-to-catalogue.json").catch(() => null);
const withheld = new Map();
for (const row of prior && prior.mapped || []) {
  if (row && row.catalogueImage === false && row.id && row.catalogueId) withheld.set(row.id, row.catalogueId);
}
const withheldSets = new Set();
for (const row of built.mapped) {
  if (withheld.get(row.id) !== row.catalogueId) continue;
  const file = join(ROOT, "research/assets/img", row.setId, `${row.number}.png`);
  if (existsSync(file)) continue;
  row.catalogueImage = false;
  withheldSets.add(row.setId);
}
const doc = {
  sourceDate: "2026-10-12",
  rule: "A tcgcsv single maps to one catalogue id when the group's set code joins exactly one catalogue set and the collector numbers are the same. Name is not a match key. SWSH07 is not rewritten to swsh7. Pattern cards are skipped. Two printings of one number map only when each printing has its own catalogue id. A printing with no catalogue id stays unmapped. Two printings never share an id.",
  sources: {
    groups: groups.source,
    groupsDate: groups.sourceDate,
    sets: sets.source,
    setsDate: sets.sourceDate,
    cards: "data/card-catalogue.json",
    products: catalog.feed || "https://tcgcsv.com/tcgplayer/3",
    productsDate: catalog.asOf,
  },
  singles: singles.length,
  mappedCount: built.mapped.length,
  skippedCount: built.skipped.length,
  skippedByReason: built.skippedByReason,
  mapped: built.mapped,
  skipped: built.skipped,
};
if (withheldSets.size) {
  const withheldRows = built.mapped.filter((row) => row.catalogueImage === false);
  doc.catalogueImage404 = withheldRows.length;
  doc.catalogueImage404Sets = [...withheldSets].sort();
  doc.catalogueImageNote = "The join stays. The picture is not copied because the catalogue file is not in research/assets/img and images.pokemontcg.io returned 404 for these sets. The site uses the TCGplayer photo, then the tile.";
}
await writeFile(join(ROOT, "data/tcgcsv-to-catalogue.json"), JSON.stringify(doc) + "\n");
console.log(`mapped ${doc.mappedCount} skipped ${doc.skippedCount}`);
console.log(doc.skippedByReason);

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // CLI.
}