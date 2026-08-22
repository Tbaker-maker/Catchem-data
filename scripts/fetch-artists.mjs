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

// RETRY, because without one this reads as missing data when it is not.
// The keyless tier returns sporadic 500s under sustained request rates — the
// first run resolved 51 of 137 and called 86 cards unresolved, yet every
// sampled failure returned full card data on a plain retry seconds later.
// Coverage completeness gates what the angles are allowed to claim, so a
// harvesting gap that looks like absent data is not a cosmetic problem: it
// silently holds every count in the weaker phrasing forever.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getCard(id) {
  let lastStatus = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(400 * 2 ** (attempt - 1));   // 400ms, 800ms, 1.6s
    try {
      const r = await fetch(`${API}/${encodeURIComponent(id)}`, {
        headers: process.env.POKEMONTCG_API_KEY ? { "X-Api-Key": process.env.POKEMONTCG_API_KEY } : {} });
      if (r.ok) {
        // A 200 with an EMPTY body is this API's other flaky mode, and it is
        // the nastier one: r.ok is true, so a naive read yields undefined and
        // the card gets filed as "no artist field" — missing data that is not
        // missing at all. Same card returns in full on a retry.
        const body = await r.text();
        if (body.trim()) {
          try { return { data: JSON.parse(body).data }; }
          catch { lastStatus = "unparseable body"; continue; }
        }
        lastStatus = "200 with empty body";
        continue;
      }
      lastStatus = r.status;
      if (r.status === 404) break;      // genuinely absent; retrying cannot help
    } catch (e) { lastStatus = e.message; }
  }
  return { error: lastStatus };
}

for (const id of ids) {
  if (store.byCard[id]?.artist) { resolved++; continue; }
  const { data: d, error } = await getCard(id);
  if (error != null) { failed.push({ id, status: error }); }
  else if (!d?.artist) { failed.push({ id, status: "no artist field" }); }
  else {
    store.byCard[id] = { artist: d.artist, name: d.name, setId: d.set?.id, setName: d.set?.name,
      number: d.number, rarity: d.rarity, releaseDate: d.set?.releaseDate };
    resolved++;
  }
  await sleep(120);   // be a good guest on a free API
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
  // WHY each card is missing, not just how many. The three causes need very
  // different responses: a transient API failure should be retried, a 404 means
  // the id is wrong on our side, and "no artist field" is a real gap in the
  // upstream source that no amount of retrying will close. Without this split,
  // 19 unresolved cards look like one problem and get one wrong fix.
  unresolved: failed.map(f => ({ id: f.id, reason: String(f.status) })),
  scopeWarning: "This covers only the cards we track. Never phrase a count as 'ever' from this data." };

await writeFile(join(ROOT, "data/artists.json"), JSON.stringify(store, null, 1));
console.log(`✓ artists: ${resolved}/${ids.length} cards resolved · ${Object.keys(store.byArtist).length} illustrators · ${failed.length} failed`);
if (failed.length) console.log(`  first failures: ${failed.slice(0, 3).map(f => `${f.id} (${f.status})`).join(", ")}`);
console.log(`  coverage complete: ${store.coverage.complete} — angles may only say "in the sets we track" unless this is true`);
