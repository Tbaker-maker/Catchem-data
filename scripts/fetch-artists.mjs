// fetch-artists.mjs — who actually drew these cards.
//
// Illustrator credit is a FACT, so it comes from a source and never from
// memory. pokemontcg.io carries an `artist` field on every card and is the
// standard reference the community already uses.
//
// THE SCOPING PROBLEM, and why it matters more than the fetch:
// A post saying "she has only ever illustrated three Pokémon cards" is a claim
// about EVERY card ever printed. We can only count what we have fetched. So
// this records coverage explicitly, and the angle generator is forbidden from
// making an "only N ever" claim unless coverage is complete for that artist.
// Otherwise it says "three in the sets we track", which is true and still
// interesting — and does not blow up the first time somebody finds a fourth.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const sg = await J("data/singles-prices.json") ?? { cards: [] };
const sets = await J("data/set-release-dates.json") ?? { dates: {} };
const ids = [...new Set((sg.cards || []).map(c => c.cardId).filter(Boolean))];

let store = await J("data/artists.json") ?? {
  note: "Illustrator credits from pokemontcg.io. Coverage is recorded honestly: an 'only N cards ever' claim requires complete coverage, otherwise the angle must say 'in the sets we track'.",
  fetchedAt: null, coverage: { setsQueried: [], cardsResolved: 0, complete: false }, byCard: {}, byArtist: {},
};

const API = "https://api.pokemontcg.io/v2/cards";
let resolved = 0, failed = [];

for (const id of ids) {
  if (store.byCard[id]?.artist) { resolved++; continue; }
  try {
    const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
      headers: process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : {} });
    if (!r.ok) { failed.push({ id, status: r.status }); continue; }
    const d = (await r.json()).data;
    if (!d?.artist) { failed.push({ id, status: "no artist field" }); continue; }
    store.byCard[id] = { artist: d.artist, name: d.name, setId: d.set?.id, setName: d.set?.name,
      number: d.number, rarity: d.rarity, releaseDate: d.set?.releaseDate };
    resolved++;
  } catch (e) { failed.push({ id, status: e.message }); }
  await new Promise(r => setTimeout(r, 120));   // be a good guest on a free API
}

// Rebuild the artist view from whatever we hold.
store.byArtist = {};
for (const [cardId, c] of Object.entries(store.byCard)) {
  (store.byArtist[c.artist] ||= { cards: [], sets: new Set() });
  store.byArtist[c.artist].cards.push({ cardId, name: c.name, setName: c.setName, number: c.number, rarity: c.rarity, releaseDate: c.releaseDate });
}
for (const a of Object.values(store.byArtist)) {
  a.cards.sort((x, y) => (x.releaseDate || "") < (y.releaseDate || "") ? -1 : 1);
  a.sets = [...new Set(a.cards.map(c => c.setName))];
  a.cardCount = a.cards.length;
  a.firstSeen = a.cards[0]?.releaseDate ?? null;
  a.latestSeen = a.cards[a.cards.length - 1]?.releaseDate ?? null;
}

store.fetchedAt = new Date().toISOString();
store.coverage = { cardsQueried: ids.length, cardsResolved: resolved, failed: failed.length,
  // Complete means: we asked about every card we track AND every one answered.
  // It does NOT mean we know every Pokémon card ever printed — no claim of that
  // kind may be built on this file.
  complete: failed.length === 0 && resolved === ids.length,
  scopeWarning: "This covers only the cards we track. Never phrase a count as 'ever' from this data." };

await writeFile(join(ROOT, "data/artists.json"), JSON.stringify(store, null, 1));
console.log(`✓ artists: ${resolved}/${ids.length} cards resolved · ${Object.keys(store.byArtist).length} illustrators · ${failed.length} failed`);
if (failed.length) console.log(`  first failures: ${failed.slice(0, 3).map(f => `${f.id} (${f.status})`).join(", ")}`);
console.log(`  coverage complete: ${store.coverage.complete} — angles may only say "in the sets we track" unless this is true`);
