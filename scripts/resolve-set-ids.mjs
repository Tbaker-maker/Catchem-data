// resolve-set-ids.mjs — learn the provider's OWN set ids before spending on them.
//
// WHY THIS EXISTS. The first catalogue-scale enrichment run spent 9,114 credits
// across 31 requests and came back with 861 cards from FIVE sets — none of
// which were the five sets it asked for. It requested ex8, pop3, pop4, pop5,
// mcd19…; it received Plasma Storm, Plasma Freeze, Plasma Blast, Prismatic
// Evolutions and Phantasmal Flames.
//
// The cause is a namespace collision that nothing in the pipeline checked.
// Our catalogue keys sets by the pokemontcg.io SLUG ("base1", "sv8", "ex8").
// The provider does not accept those at all. Sending setId=ex8 does not error —
// it is simply not honoured, and the response is billed anyway.
//
// THERE ARE THREE SET IDENTIFIERS IN PLAY, and confusing them is how this went
// wrong twice. Ours is the slug. The provider's /sets endpoint returns an
// ObjectId hex string ("696e3c9cbb2a772e0d056815") and THAT is what
// /cards?setId= accepts. Card payloads also carry a numeric `setId` (1370,
// 23821) which is a different internal field and is NOT queryable. My first
// reading of this bug called the numeric one "the provider's id"; it is not.
//
// That is the worst possible failure shape: it looks like success. Data
// arrives, the file grows, coverage counters go up, and every card in it is a
// card we did not choose. The enrichment we thought covered 4,027 of the top
// 6,000 by value actually has a MEDIAN CARD PRICE OF $0.49 — because it is
// whatever the provider returned, not what we targeted.
//
// So: resolve the ids from the provider, join them to our catalogue by name,
// and report what does not match rather than guessing. A set we cannot map is
// a set we do not fetch.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv, requireKey } from "./lib/load-env.mjs";

loadEnv();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
const FETCH_TIMEOUT_MS = 30000;

// Join key. The two catalogues disagree in four separate ways, and each one
// was found by looking at the misses rather than guessed in advance:
//   separator  "SWSH08: Fusion Strike" · "SM - Cosmic Eclipse" · "EX Unseen
//              Forces" — colon, dash, and bare space all appear
//   ampersand  "HeartGold SoulSilver" vs our "HeartGold & SoulSilver"
//   the word "set"   "Expedition" vs our "Expedition Base Set"
//   era prefix on OUR side too — "HS—Unleashed", "SM Black Star Promos"
// A colon-only strip matched 78 of our 130 sets. Handling all four matches 97.
//
// The era list is CLOSED on purpose. Stripping any leading token would turn
// "Team Rocket" into "Rocket" and invent matches; stripping only known era
// abbreviations cannot.
const ERA = /^(ex|sm|xy|swsh|sv|hs|hgss|bw|dp|dpp|col|pl|pop|me|mee)\d*(?:pt\d)?\b[\s:\u2013\u2014-]*/i;

const clean = s => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")   // "Pokémon GO" == "Pokemon GO"
  .toLowerCase()
  .replace(/&|\band\b/g, " ")        // "Ruby & Sapphire" == "Ruby and Sapphire"
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\bset\b/g, " ")
  .trim().replace(/\s+/g, " ");

// The promo sets do not follow any rule. We call them "<ERA> Black Star
// Promos"; the provider calls them "SM Promos", "Black and White Promos",
// "WoTC Promo", "SWSH: Sword & Shield Promo Cards" — four conventions across
// five sets. I tried to reach them with a normalisation rule and each attempt
// either missed some or started inventing matches elsewhere, so they are listed
// explicitly instead. 480 of the top 6,000 cards sit in these five.
//
// NEEDS TYLER'S CONFIRMATION: these are my reading of which provider set
// corresponds to which of ours, not a verified fact. The promo sets are exactly
// the kind of thing he has caught models getting wrong before. Every one is
// checkable against the card counts the resolver prints.
const ALIAS = {
  smp:    "SM Promos",
  swshp:  "SWSH: Sword & Shield Promo Cards",
  bwp:    "Black and White Promos",
  basep:  "WoTC Promo",
  dpp:    "Diamond and Pearl Promos",
  sv3pt5: "SV: Scarlet & Violet 151",
  // The provider names these by era where we name them by the sub-title, and
  // they are only reachable once the era-collision above is fixed.
  sm1:    "SM Base Set",
  xy1:    "XY Base Set",
};

// Never return empty: "Base" strips to nothing under the "set"/"base" rules,
// and an empty key would collide with every other name that empties out.
const orEmpty = (a, b) => (a && a.length ? a : b);

export const norm = s => {
  const base = clean(s);
  return orEmpty(clean(String(s || "").replace(ERA, "")), base);
};

// Some names only match once a trailing "base" goes too ("Expedition" vs
// "Expedition Base Set"). That is a weaker signal, so it is a SEPARATE key
// tried after the strict one, never a replacement for it.
export const normLoose = s => orEmpty(norm(s).replace(/\bbase$/, "").trim(), norm(s));

async function getJSON(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) {
    // Carry the BODY, not just the status. The first run of this script died on
    // a bare "HTTP 400" that said nothing about which parameter was wrong, and
    // the answer was sitting in a response we threw away.
    const body = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} on ${url.replace(/\?.*/, "")} — ${body.slice(0, 300) || "(empty body)"}`);
  }
  return r.json();
}

export async function fetchProviderSets() {
  // NO `page` PARAMETER. Adding one returns 400. Every other caller in this
  // repo — fetch-singles-enrichment, verify-watchlist-prices — asks for
  // `/sets?limit=500` flat and gets the whole list, so that is the shape the
  // endpoint actually supports. I invented the pagination by analogy with
  // /cards and it cost a failed run.
  const d = await getJSON(`${BASE}/sets?limit=500`);
  const rows = d.data || d.sets || [];
  // If this ever comes back full, the list is being truncated silently and the
  // map would be missing sets we then never fetch.
  if (rows.length >= 500) console.warn(`⚠ /sets returned ${rows.length} rows — at the limit, so the list may be truncated`);
  return rows;
}

export function joinToCatalogue(providerSets, catalogueSets) {
  // THREE indexes, because the era-stripped key ALONE loses sets. "Base Set",
  // "SM Base Set" and "XY Base Set" all strip to "base", and "SM Promos",
  // "XY Promos" and "HGSS Promos" all strip to "promos" — so a keep-the-first
  // rule silently discarded four real sets, which is precisely why sm1 and xy1
  // looked unmatchable. The era is the distinguishing part of those names, so
  // the full name has to be indexed too.
  const full = new Map(), strict = new Map(), loose = new Map();
  for (const p of providerSets) {
    const id = p.id ?? p.setId ?? p._id;
    const name = p.name ?? p.setName;
    if (id == null || !name) continue;
    const row = { id, name, cardCount: p.cardCount ?? p.total ?? null };
    if (!full.has(clean(name))) full.set(clean(name), row);
    if (!strict.has(norm(name))) strict.set(norm(name), row);
    if (!loose.has(normLoose(name))) loose.set(normLoose(name), row);
  }
  const bySlug = {}, unmatched = [];
  const claimed = new Set();
  for (const [slug, name] of Object.entries(catalogueSets)) {
    // Strict first, always. The loose key drops a trailing "base" and is a
    // weaker claim, so it must never pre-empt an exact one. An alias is a hand
    // assertion and outranks both — but only if the name it names really exists,
    // so a typo in the table shows up as an unmatched set, not a wrong id.
    // Aliases resolve against the FULL name index, never the era-stripped one —
    // "SM Promos" and "XY Promos" share a stripped key, so resolving an alias
    // through it would hand back whichever happened to be indexed first.
    const aliased = ALIAS[slug] ? full.get(clean(ALIAS[slug])) : null;
    const how = aliased ? "alias"
      : full.has(clean(name)) ? "name"
      : strict.has(norm(name)) ? "name"
      : loose.has(normLoose(name)) ? "name-loose" : null;
    const hit = aliased
      ?? full.get(clean(name))
      ?? strict.get(norm(name))
      ?? (how === "name-loose" ? loose.get(normLoose(name)) : null);
    if (hit) {
      bySlug[slug] = { pptSetId: hit.id, pptName: hit.name, ourName: name, cardCount: hit.cardCount, matchedBy: how };
      claimed.add(norm(hit.name));
    } else unmatched.push({ slug, name, normalised: norm(name) });
  }
  // The reverse gap is worth as much as the forward one: a set the provider
  // prices and we do not carry is a hole in OUR catalogue. This is how we found
  // that bw9 (Plasma Freeze) is missing from our 130 sets entirely — the
  // provider returned it, and we had nowhere to put it.
  const providerOnly = [...strict.entries()]
    .filter(([k]) => !claimed.has(k))
    .map(([, v]) => ({ pptSetId: v.id, name: v.name, cardCount: v.cardCount }));
  return { bySlug, unmatched, providerOnly, providerSetCount: strict.size };
}

async function main({ offline = false } = {}) {
  const cat = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf-8"));
  const catalogueSets = {};
  for (const c of Object.values(cat.cards)) if (c.setId) catalogueSets[c.setId] = c.setName || null;

  // --rejoin re-runs the MATCH against the set list we already fetched. Every
  // improvement to the normaliser so far has been driven by looking at the
  // misses, and paying the provider again to re-test a regex would be silly.
  let providerSets;
  if (offline) {
    const prev = JSON.parse(await readFile(join(ROOT, "data/ppt-set-map.json"), "utf-8"));
    providerSets = prev.providerSets
      ?? [...Object.values(prev.bySlug).map(m => ({ id: m.pptSetId, name: m.pptName, cardCount: m.cardCount })),
          ...prev.providerOnly.map(p => ({ id: p.pptSetId, name: p.name, cardCount: p.cardCount }))];
    console.log(`offline rejoin against ${providerSets.length} stored provider sets — no call made`);
  } else {
    if (!KEY) requireKey("POKEMONPRICETRACKER_API_KEY");
    providerSets = await fetchProviderSets();
  }
  const { bySlug, unmatched, providerOnly, providerSetCount } = joinToCatalogue(providerSets, catalogueSets);

  await writeFile(join(ROOT, "data/ppt-set-map.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), providerSetCount,
      matched: Object.keys(bySlug).length, unmatchedCount: unmatched.length,
      providerOnlyCount: providerOnly.length,
      note: "pptSetId is the provider's OWN set id from /sets (an ObjectId hex string) and is what "
          + "/cards?setId= accepts. It is NOT the numeric setId that appears inside card payloads — "
          + "those are a different internal field. Our catalogue's pokemontcg.io slugs are honoured "
          + "by neither: a request using the slug is silently ignored and billed anyway. See the "
          + "2026-08-23 report.",
      // Stored so the join can be re-run offline (--rejoin) after a normaliser
      // change, without paying to fetch a list that has not changed.
      providerSets: providerSets.map(p => ({ id: p.id ?? p.setId ?? p._id, name: p.name ?? p.setName,
        cardCount: p.cardCount ?? p.total ?? null })),
      bySlug, unmatched, providerOnly }, null, 1) + "\n");

  console.log(`provider sets: ${providerSetCount} · our sets: ${Object.keys(catalogueSets).length}`);
  console.log(`✓ matched ${Object.keys(bySlug).length} · ours unmatched ${unmatched.length} · provider-only ${providerOnly.length}`);
  // An alias is a hand assertion about which set is which. Print them every run
  // so they stay visible for challenge rather than settling into the file.
  for (const [slug, m] of Object.entries(bySlug))
    if (m.matchedBy !== "name") console.log(`  ${m.matchedBy.toUpperCase().padEnd(10)} ${slug.padEnd(8)} ${m.ourName}  ->  ${m.pptName} (${m.cardCount} cards)`);
  for (const u of unmatched.slice(0, 15)) console.log(`  ours, no provider match: ${u.slug.padEnd(14)} ${u.name}`);
  if (unmatched.length > 15) console.log(`  …and ${unmatched.length - 15} more`);
  for (const p of providerOnly.slice(0, 10)) console.log(`  provider-only (gap in OUR catalogue): ${p.name}`);
  if (providerOnly.length > 10) console.log(`  …and ${providerOnly.length - 10} more`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main({ offline: process.argv.includes("--rejoin") });
