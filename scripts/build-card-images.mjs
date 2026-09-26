// Build data/card-images.json: the image URL the SOURCE publishes for each card
// id we render (PokemonTCG/pokemon-tcg-data, the dataset behind pokemontcg.io).
// Why: card-guard fails any script that builds an image URL from a card id.
// Hosts differ per set (me4+ serve from images.scrydex.com), and a constructed
// URL that 404s comes back as a card back that renders fine. Scripts now read
// this map via cardImage() in image-source.mjs; an id with no entry gets no
// image rather than a guessed one.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en";
const J = async (p) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return null; } };

const ids = new Set();
const cat = await J("data/card-catalogue.json");
for (const id of Object.keys(cat?.cards || {})) ids.add(id);
for (const c of (await J("data/singles-prices.json"))?.cards || []) if (c.cardId) ids.add(c.cardId);
const setOf = (id) => id.slice(0, id.lastIndexOf("-"));
const sets = [...new Set([...ids].map(setOf))].sort();

const images = {};
const missingSets = [];
for (const set of sets) {
  let cards = null;
  try {
    const r = await fetch(`${SRC}/${set}.json`, { signal: AbortSignal.timeout(20000) });
    if (r.ok) cards = await r.json();
  } catch {}
  if (!Array.isArray(cards)) { missingSets.push(set); continue; }
  for (const c of cards) {
    if (!ids.has(c.id)) continue;
    const small = c.images?.small || null, large = c.images?.large || null;
    if (small || large) images[c.id] = { small, large };
  }
}
const doc = {
  source: "PokemonTCG/pokemon-tcg-data cards/en/<set>.json images.small / images.large",
  builtAt: new Date().toISOString(),
  cards: Object.keys(images).length,
  requested: ids.size,
  missingSets,
  images,
};
await writeFile(join(ROOT, "data/card-images.json"), JSON.stringify(doc).replace(/\},"/g, '},\n"') + "\n");
console.log(`card images: ${doc.cards}/${ids.size} ids, ${missingSets.length} set file(s) missing`);
