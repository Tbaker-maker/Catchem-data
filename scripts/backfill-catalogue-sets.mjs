// backfill-catalogue-sets.mjs: add the sets data/card-catalogue.json is missing.
//
// Why: the 2026-08-22 ingest hit api.pokemontcg.io limits and 34 sets came back
// with 0 cards (complete: false). Delta Reign (me6) came out after the last run.
// The api /v2/sets endpoint answered 502 on 2026-11-11, so this reads the same
// dataset from its public GitHub repo (PokemonTCG/pokemon-tcg-data), the source
// build-card-images.mjs already uses.
//
// Rules: only sets with zero catalogue cards are added. No existing row is
// changed or removed. No price is written (the GitHub dataset has none).
// card-images.json gets the image URL the dataset publishes only when the host
// is images.pokemontcg.io. A TCGplayer id is set only when the TCGCSV group for
// the set has exactly one product with the same collector number and the same
// name (TCGplayer writes energy types as one letter: W, G, R, ..., the female
// and male signs as F and M, and adds (Left) or (Right) to two-card stadiums).
//
// Usage: node scripts/backfill-catalogue-sets.mjs [--dry]
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master";
const TCGCSV = "https://tcgcsv.com/tcgplayer/3";
const DRY = process.argv.includes("--dry");
// Set id -> TCGCSV group id, only for sets whose group was checked by hand.
const GROUPS = { me6: 24831 };
// Published by the dataset but 404 at images.pokemontcg.io (large and small) on 2026-11-11.
const IMAGE_404 = new Set(["hsp-HGSS18"]);
const ENERGY = { Grass: "G", Fire: "R", Water: "W", Lightning: "L", Psychic: "P", Fighting: "F", Darkness: "D", Metal: "M" };

const getJson = async (url) => {
  const r = await fetch(url, { headers: { "user-agent": "Catchem-data catalogue backfill" }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url} HTTP ${r.status}`);
  return r.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").replace(/\u2640/g, " F").replace(/\u2642/g, " M").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ext = (p, n) => (p.extendedData || []).find((e) => e.name === n)?.value;

const catPath = join(ROOT, "data/card-catalogue.json");
const imgPath = join(ROOT, "data/card-images.json");
const cat = JSON.parse(await readFile(catPath, "utf8"));
const img = JSON.parse(await readFile(imgPath, "utf8"));
const sets = await getJson(`${SRC}/sets/en.json`);
const present = new Set(Object.values(cat.cards).map((c) => c.setId));
const todo = sets.filter((s) => !present.has(s.id));
const today = new Date().toISOString();
let added = 0, images = 0, linked = 0;
const report = [];
for (const set of todo) {
  const cards = await getJson(`${SRC}/cards/en/${set.id}.json`);
  await sleep(500);
  let byNumber = null;
  if (GROUPS[set.id]) {
    const prods = (await getJson(`${TCGCSV}/${GROUPS[set.id]}/products`)).results || [];
    byNumber = new Map();
    for (const p of prods) {
      const n = ext(p, "Number");
      if (!n) continue;
      const k = n.split("/")[0].replace(/^0+(?=\d)/, "");
      byNumber.set(k, [...(byNumber.get(k) || []), p]);
    }
  }
  let setAdded = 0;
  for (const c of cards) {
    if (cat.cards[c.id]) continue;
    const row = { name: c.name, artist: c.artist ?? null, setId: set.id, setName: set.name, number: c.number,
      rarity: c.rarity ?? null, releaseDate: set.releaseDate ?? null, supertype: c.supertype ?? null };
    if (byNumber) {
      const cand = byNumber.get(String(c.number).replace(/^0+(?=\d)/, "")) || [];
      let want = norm(c.name);
      const e = c.name.match(/^(.*) (Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal) Energy$/);
      const alt = e ? norm(`${e[1]} ${ENERGY[e[2]]} Energy`) : null;
      const hits = cand.filter((p) => { const n = norm(p.name.replace(/ - [^ ]+( \((?:Left|Right)\))?$/, "")); return n === want || (alt && n === alt); });
      if (hits.length === 1) { row.tcgPlayerId = String(hits[0].productId); row.tcgPlayerIdMethod = "tcgcsv-group-number-name"; linked++; }
    }
    cat.cards[c.id] = row;
    added++; setAdded++;
    const large = c.images?.large || null, small = c.images?.small || null;
    const ok = (u) => u && new URL(u).hostname === "images.pokemontcg.io";
    if (!img.images[c.id] && !IMAGE_404.has(c.id) && ok(large) && ok(small)) { img.images[c.id] = { small, large }; images++; }
  }
  cat.sets[set.id] = { cardsIngested: cards.length, expected: set.total, complete: cards.length >= set.total, at: today,
    source: `${SRC}/cards/en/${set.id}.json` };
  report.push(`${set.id} ${set.name}: +${setAdded}`);
}
cat.coverage = { ...cat.coverage, cards: Object.keys(cat.cards).length,
  cardsWithArtist: Object.values(cat.cards).filter((c) => c.artist).length,
  setsComplete: Object.values(cat.sets).filter((s) => s.complete).length };
cat.setBackfill = { at: today, source: "https://github.com/PokemonTCG/pokemon-tcg-data", sets: todo.map((s) => s.id), cards: added,
  note: "Sets that had 0 cards after the api ingest. Metadata only, no prices." };
img.cards = Object.keys(img.images).length;
console.log(report.join("\n"));
console.log(`added ${added} cards in ${todo.length} sets, ${images} pokemontcg.io images, ${linked} TCGplayer ids`);
if (!DRY) {
  await writeFile(catPath, JSON.stringify(cat));
  // Same layout as build-card-images.mjs output: one image per line.
  const { images: map, ...head } = img;
  const lines = Object.entries(map).map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v));
  await writeFile(imgPath, JSON.stringify(head).slice(0, -1) + ',"images":{' + lines.join(",\n") + "}}");
}
