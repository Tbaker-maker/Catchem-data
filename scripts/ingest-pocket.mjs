// ingest-pocket.mjs — every Pokémon TCG Pocket card we can source. Separate file.
//
// Paper stays in card-catalogue.json. Pocket IDs are prefixed tcgp-.
//
// Card LIST: pokemon-tcg-pocket-database (MIT, npm / jsdelivr) — complete
// through the latest English Pocket set they publish.
// Illustrators / attacks / tcgdex images: overlay from TCGdex series `tcgp`
// when that set exists there. TCGdex lags; we do not pretend otherwise.
//
// Images:
//   TCGdex  https://assets.tcgdex.net/en/tcgp/{set}/{num}/high.webp
//   else    Limitless CDN  …/pocket/{set}/{set}_{num}_EN.webp  (hotlink, not rehost)
// No prices.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return null; } };
const FETCH_TIMEOUT_MS = 30000;
const get = async (url) => {
  const r = await fetch(url, {
    headers: { "User-Agent": "CatchEm-pocket-ingest/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(url + " HTTP " + r.status);
  return r.json();
};

const RARITY = {
  C: "One Diamond", U: "Two Diamond", R: "Three Diamond", RR: "Four Diamond",
  AR: "One Star", SR: "Two Star", SAR: "Two Star", IM: "Three Star",
  UR: "Crown", S: "One Shiny", SSR: "Two Shiny",
};
const setCode = s => s === "PROMO-A" ? "P-A" : s === "PROMO-B" ? "P-B" : s;
const pad = n => String(n).padStart(3, "0");
const TCGDEX_SETS = new Set(["P-A","A1","A1a","A2","A2a","A2b","A3","A3a","A3b","A4","A4a","B1","B1a","B2","B2a"]);
const imgOf = (set, num) => TCGDEX_SETS.has(set)
  ? "https://assets.tcgdex.net/en/tcgp/" + set + "/" + pad(num) + "/high.webp"
  : "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/pocket/" + set + "/" + set + "_" + pad(num) + "_EN.webp";

console.log("fetching flibustier MIT pocket db…");
const [list, extra, setPack] = await Promise.all([
  get("https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database/dist/cards.json"),
  get("https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database/dist/cards.extra.json"),
  get("https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database/dist/sets.json"),
]);
const extraBy = {};
for (const c of extra) extraBy[setCode(c.set) + "-" + c.number] = c;

const setMeta = {};
for (const series of Object.values(setPack)) {
  for (const s of series) {
    const id = setCode(s.code);
    setMeta[id] = {
      name: (s.name && s.name.en) || s.name || id,
      releaseDate: s.releaseDate || null,
      count: s.count || null,
    };
  }
}

const prev = (await J("data/pocket-catalogue.json")) || { cards: {}, sets: {} };

const store = {
  note: "Pokémon TCG Pocket. List from pokemon-tcg-pocket-database (MIT). Illustrators from TCGdex where that set exists. NOT paper. NOT prices. IDs prefixed tcgp-.",
  game: "tcgp",
  source: "https://cdn.jsdelivr.net/npm/pokemon-tcg-pocket-database/dist/cards.json",
  overlay: "https://api.tcgdex.net/v2/en/series/tcgp",
  ingestedAt: new Date().toISOString(),
  sets: {},
  cards: {},
};

for (const c of list) {
  const set = setCode(c.set);
  const num = c.number;
  const id = "tcgp-" + set + "-" + pad(num);
  const old = (prev.cards && prev.cards[id]) || {};
  const ex = extraBy[set + "-" + num] || {};
  const meta = setMeta[set] || {};
  const sup = (ex.type === "pokemon" || !ex.type) ? "Pokémon" : (ex.type === "trainer" ? "Trainer" : "Energy");
  store.cards[id] = {
    name: c.name,
    artist: old.artist || null,
    setId: set,
    setName: meta.name || old.setName || set,
    number: pad(num),
    rarity: old.rarity || RARITY[c.rarity] || c.rarity || null,
    releaseDate: meta.releaseDate || old.releaseDate || null,
    supertype: old.supertype || sup,
    hp: old.hp ?? ex.health ?? null,
    types: old.types || (ex.element ? [ex.element] : undefined),
    stage: old.stage || ex.stage || undefined,
    attackNames: old.attackNames || undefined,
    image: imgOf(set, num),
    game: "tcgp",
  };
  if (!store.sets[set]) store.sets[set] = { name: meta.name || set, releaseDate: meta.releaseDate || null, ingested: 0 };
  store.sets[set].ingested++;
}

store.coverage = {
  cards: Object.keys(store.cards).length,
  sets: Object.keys(store.sets).length,
  withArtist: Object.values(store.cards).filter(c => c.artist).length,
  fromTcgdex: Object.values(store.cards).filter(c => TCGDEX_SETS.has(c.setId)).length,
  fromFlibustierOnly: Object.values(store.cards).filter(c => !TCGDEX_SETS.has(c.setId)).length,
};
await writeFile(join(ROOT, "data/pocket-catalogue.json"), JSON.stringify(store));
console.log("✓ pocket: " + store.coverage.cards + " cards · " + store.coverage.sets + " sets · " +
  store.coverage.withArtist + " with illustrator (TCGdex overlay) · " +
  store.coverage.fromFlibustierOnly + " newer than TCGdex");
for (const [id, s] of Object.entries(store.sets)) {
  console.log("  " + id.padEnd(6) + String(s.ingested).padStart(4) + "  " + s.name);
}
