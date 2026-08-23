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

// Node's fetch has NO default timeout — a host that accepts and never
// answers hangs the run until the runner kills the job, which reports
// nothing and burns the whole allowance.
// Pull the attack NAME out of the source's concatenated form. Entries read
// like "[2] Gatling Peck (10x) Flip 5 coins…" — energy cost in brackets, the
// name, damage in parentheses, then effect prose. Written with plain string
// operations rather than a regex: this file is edited through tooling that
// eats backslashes, and a half-escaped pattern fails silently rather than loudly.
function attackNames(attacks) {
  if (!Array.isArray(attacks) || !attacks.length) return undefined;
  const names = [];
  for (const a of attacks) {
    if (a && typeof a === 'object' && a.name) { names.push(a.name); continue; }
    if (typeof a !== 'string') continue;
    let t = a.trim();
    const ob = t.indexOf("[");
    const cb = t.indexOf("]");
    if (ob === 0 && cb > 0) t = t.slice(cb + 1).trim();   // drop the energy cost
    const p = t.indexOf("(");
    if (p > 0) t = t.slice(0, p).trim();                  // drop damage onward
    // A real attack name is short. Anything longer is Trainer rules text that
    // never had a name, and inventing one would be worse than dropping it.
    if (t && t.length <= 40 && t.split(' ').filter(Boolean).length <= 5) names.push(t);
  }
  return names.length ? names : undefined;
}

const FETCH_TIMEOUT_MS = 30000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const API = "https://api.pokemontcg.io/v2";
const KEY = process.env.POKEMONTCG_API_KEY;
const headers = KEY ? { "X-Api-Key": KEY } : {};
const PAGE = 250;
// PACING MUST MATCH THE KEY, verified against docs.pokemontcg.io 2026-08-22:
// 20,000 requests/day WITH a key, but only 1,000/day and a hard 30 PER MINUTE
// without one. The flat 150ms delay below is 400/min — six times over the
// keyless ceiling, so a keyless run walks straight into 429s and reports the
// catalogue as failed sets rather than as a throttle we chose to ignore.
const DELAY_MS = KEY ? 150 : 2100;   // 2.1s ~= 28/min, just under the cap

// Which sets to ingest. Default: every set we track a product or single from,
// plus anything passed on the command line. Metadata is cheap; being selective
// here only creates gaps that break artist counts later.
const args = process.argv.slice(2);
const sp = await J("data/sealed-prices.json") ?? { products: [] };
const sg = await J("data/singles-prices.json") ?? { cards: [] };
// EVERY SET, not just the ones we price. Metadata is free and unlimited;
// prices are what cost money, and they are a separate decision. Ingesting the
// whole catalogue is what turns "three cards in the sets we track" into
// "three cards, total" — a sourced fact instead of a hedged claim.
// ~150 sets, roughly 200-300 calls, one time. Free tier allows far more.
let wanted = args;
if (!wanted.length) {
  try {
    const r = await fetch(`${API}/sets?pageSize=250`, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const d = await r.json();
    wanted = (d.data ?? []).map(s => s.id);
    console.log(`  enumerating the full catalogue: ${wanted.length} sets`);
  } catch (e) {
    console.log(`  ⚠ could not enumerate sets (${e.message}) — falling back to the sets we track`);
    wanted = [...new Set([...(sp.products || []).map(p => p.setId), ...(sg.cards || []).map(c => c.cardId?.split("-")[0])].filter(Boolean))];
  }
}

let store = await J("data/card-catalogue.json") ?? {
  note: "Card metadata from pokemontcg.io. NOT prices — this is what exists, so artist counts can be complete and defensible. Prices live in singles-prices.json for the subset we track.",
  source: "pokemontcg.io", ingestedAt: null, sets: {}, cards: {},
};

let added = 0, setsDone = 0, failures = [];
for (const setId of wanted) {
  if (!setId) continue;
  // Resume-safe: a set already ingested completely is skipped, so hitting a
  // rate limit costs the remainder of a run rather than the whole thing.
  if (store.sets[setId]?.complete && !process.env.FORCE_REINGEST) { setsDone++; continue; }
  try {
    let page = 1, total = null, got = 0;
    for (;;) {
      const url = `${API}/cards?q=set.id:${encodeURIComponent(setId)}&page=${page}&pageSize=${PAGE}`;
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
          priceUpdatedAt: c.tcgplayer?.updatedAt ?? null, priceSource: head ? "tcgplayer via pokemontcg.io" : null,
          // WHAT THE CARD SAYS. Free, in the source we already ingest, and captured
          // by nothing until now. Tyler posted Slakoth at 2am after seventeen hours
          // of coding, and Slakoth's attack is called Take It Easy — neither of us
          // knew. The card wrote the joke; we simply could not search for it.
          //
          // attackNames is kept SEPARATELY from the full text because the source
          // concatenates cost, name, damage and effect into one string and the name
          // is the part carrying the joke. Trainer cards put rules text in the same
          // field, so this is names-where-parsable, not a promise every entry is an
          // attack. Measured on the 861 cards we hold: 75% have attacks, 24% flavour.
          attacks: Array.isArray(c.attacks) && c.attacks.length ? c.attacks : undefined,
          attackNames: attackNames(c.attacks),
          flavorText: c.flavorText ?? undefined };
        got++;
      }
      if (got >= total || !(d.data ?? []).length) break;
      page++;
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
    store.sets[setId] = { cardsIngested: got, expected: total, complete: total != null && got >= total, at: new Date().toISOString() };
    setsDone++;
    if (setsDone % 10 === 0) console.log(`  … ${setsDone}/${wanted.length} sets`);
  } catch (e) { failures.push({ setId, status: e.message }); }
  await new Promise(r => setTimeout(r, DELAY_MS));
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
