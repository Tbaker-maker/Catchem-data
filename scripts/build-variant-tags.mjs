// Writes data/card-variants.json: variant tags per card, by TCGplayer id and catalogue id.
// Tags come from scripts/lib/variant-tags.mjs (rarity, product name, number, subtypes, printings).
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { variantTags, subtypeIndex, TAG_ORDER } from "./lib/variant-tags.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));
const catalog = await J("data/catalog/tcgcsv-latest.json");
const map = await J("data/tcgcsv-to-catalogue.json");
const subs = subtypeIndex(map, await J("data/card-attrs.json"));
const catId = new Map((map.mapped || []).map((m) => [m.id, m.catalogueId]));
const cards = {};
const counts = Object.fromEntries(TAG_ORDER.map((t) => [t, 0]));
for (const item of catalog.items || []) {
  const tags = variantTags(item, { subtypes: subs.get(item.id) });
  if (!tags.length) continue;
  cards[item.id] = { tags, ...(catId.get(item.id) ? { catalogueId: catId.get(item.id) } : {}) };
  for (const t of tags) counts[t] += 1;
}
await writeFile(join(ROOT, "data/card-variants.json"), JSON.stringify({
  asOf: catalog.asOf,
  note: "Variant tags describe how a card was made in its set. Separate from rarity. Derived only from TCGplayer rarity and product name, the collector number, pokemontcg.io subtypes, and printings. A card with no clear signal has no tag.",
  counts,
  cards,
}) + "\n");
console.log(JSON.stringify(counts));
