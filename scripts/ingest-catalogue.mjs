// ingest-catalogue.mjs — the full card catalogue, metadata only.
//
// WHY THIS EXISTS: with 137 priced singles, an artist has one or two cards in
// our data and cohort analysis is meaningless. pokemontcg.io gives every card's
// metadata — artist, name, set, number, rarity, release date — for free. Ingest
// all of it and two things become possible that were not:
//
//   1. Artist counts become COMPLETE. "Three cards, total" stops being a claim
//      we cannot defend and becomes a fact we can source. The Artist Claim Law
//      requires complete coverage before an "ever" statement; this is how we
//      earn it.
//   2. Cohorts become real. An illustrator with forty cards can be asked the
//      question that matters — is this ONE card moving, or all of their work?
//
// We price a subset. We KNOW about everything. Those are different jobs and
// conflating them is what made the first version of this thin.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const API = "https://api.pokemontcg.io/v2";
const KEY = process.env.POKEMONTCG_API_KEY;
const headers = KEY ? { "X-Api-Key": KEY } : {};
const PAGE = 250;

// Which sets to ingest. Default: every set we track a product or single from,
// plus anything passed on the command line. Metadata is cheap; being selective
// here only creates gaps that break artist counts later.
const args = process.argv.slice(2);
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const sg = await J("data/singles-prices.json") ?? { cards: [] };
const wanted = args.length ? args : [...new Set([
  ...(sp.products || []).map(p => p.setId),
  ...(sg.cards || []).map(c => c.cardId?.split("-")[0]),
].filter(Boolean))];

let store = await J("data/card-catalogue.json") ?? {
  note: "Card metadata from pokemontcg.io. NOT prices — this is what exists, so artist counts can be complete and defensible. Prices live in singles-prices.json for the subset we track.",
  source: "pokemontcg.io", ingestedAt: null, sets: {}, cards: {},
};

let added = 0, setsDone = 0, failures = [];
for (const setId of wanted) {
  if (!setId) continue;
  try {
    let page = 1, total = null, got = 0;
    for (;;) {
      const url = `${API}/cards?q=set.id:${encodeURIComponent(setId)}&page=${page}&pageSize=${PAGE}`;
      const r = await fetch(url, { headers });
      if (!r.ok) { failures.push({ setId, status: r.status }); break; }
      const d = await r.json();
      total ??= d.totalCount ?? 0;
      for (const c of d.data ?? []) {
        if (!store.cards[c.id]) added++;
        // pokemontcg.io bundles TCGplayer price blocks with the card. Same source
        // PPT resells, free with the metadata, updated daily. Taking it here
        // expands our priced universe from ~137 cards to thousands at no cost —
        // and it is the SAME venue our sealed pack basis already uses, so the
        // numbers are consistent rather than a second opinion.
        const tp = c.tcgplayer?.prices ?? {};
        // A card can have several finishes. Take the one with the highest
        // market value as the headline and keep the rest — never invent a
        // blended figure, which would be a number nobody could look up.
        const variants = Object.entries(tp)
          .map(([finish, v]) => ({ finish, market: v?.market ?? null, low: v?.low ?? null, high: v?.high ?? null }))
          .filter(v => v.market != null);
        const head = variants.slice().sort((a, b) => b.market - a.market)[0] ?? null;
        store.cards[c.id] = { name: c.name, artist: c.artist ?? null, setId: c.set?.id,
          setName: c.set?.name, number: c.number, rarity: c.rarity ?? null,
          releaseDate: c.set?.releaseDate ?? null, supertype: c.supertype ?? null,
          price: head?.market ?? null, priceFinish: head?.finish ?? null,
          variants: variants.length > 1 ? variants : undefined,
          priceUpdatedAt: c.tcgplayer?.updatedAt ?? null, priceSource: head ? "tcgplayer via pokemontcg.io" : null };
        got++;
      }
      if (got >= total || !(d.data ?? []).length) break;
      page++;
      await new Promise(r => setTimeout(r, 150));
    }
    store.sets[setId] = { cardsIngested: got, expected: total, complete: total != null && got >= total, at: new Date().toISOString() };
    setsDone++;
    if (setsDone % 10 === 0) console.log(`  … ${setsDone}/${wanted.length} sets`);
  } catch (e) { failures.push({ setId, status: e.message }); }
  await new Promise(r => setTimeout(r, 150));
}

const withArtist = Object.values(store.cards).filter(c => c.artist).length;
const withPrice = Object.values(store.cards).filter(c => c.price != null).length;
store.ingestedAt = new Date().toISOString();
store.coverage = {
  setsRequested: wanted.length, setsComplete: Object.values(store.sets).filter(s => s.complete).length,
  cards: Object.keys(store.cards).length, cardsWithArtist: withArtist, cardsWithPrice: withPrice, failures: failures.length,
  // "Complete" here means: every set we asked for returned every card it said
  // it had. It does NOT mean every Pokémon set ever exists in this file — an
  // artist count is only defensible as "ever" for artists whose sets are all
  // present, which artist-instruments checks per artist rather than globally.
  note: "Per-set completeness. Artist-level 'ever' claims are validated per artist, not from this flag.",
};
await writeFile(join(ROOT, "data/card-catalogue.json"), JSON.stringify(store));
console.log(`✓ catalogue: ${Object.keys(store.cards).length} cards across ${Object.keys(store.sets).length} sets · ${withArtist} with an artist credit · ${withPrice} with a price · ${added} new this run`);
if (failures.length) console.log(`  ⚠ ${failures.length} set(s) failed: ${failures.slice(0, 4).map(f => `${f.setId}(${f.status})`).join(", ")}`);
