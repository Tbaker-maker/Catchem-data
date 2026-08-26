// search-gauntlet.mjs — the find-a-card layer, tested against the real index.
//
// Tyler built this tool and could not find the card he wanted. Two separate
// faults produced that one symptom and neither was visible from the source:
// the shipped index held 6,725 of 16,468 cards, and the query tokeniser was
// emitted through a template literal that ate its own backslash, so it split
// on the letter "s". "arita squirtle" worked and "magmar kimura" returned zero,
// which looked like two unrelated bugs and was one.
//
// SO THIS TESTS THE ARTIFACT, NOT THE SOURCE. The matcher is pulled out of
// research/assets/build.html and run against the rows that actually shipped.
// Checking build-editor.mjs would have passed both faults: the source was
// correct in both cases and the emitted file was not.
//
// THE ASSERTION THAT MATTERS MOST: a relation must never claim a connection
// that is not true in the data. Every relation returned is re-derived from the
// cards it names, and the numbers written into its reason line are regenerated
// and compared. A wrong "same artist" credit in a public post is the failure
// this whole tool exists to avoid, and we have already shipped a card back once.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCards, relationsFor, artistRevisits, RELATION_TYPES, words } from "./card-relations.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0, fail = 0;
const fails = [];
function check(group, name, ok, detail = "") {
  if (ok) { pass++; return; }
  fail++; fails.push({ group, name, detail });
}
const head = (s) => console.log("\n  " + s);

// ── LOAD THE SHIPPED ARTIFACT ──────────────────────────────────────────────
let art = null;
try { art = JSON.parse(await readFile(join(ROOT, "data/connecting-art.json"), "utf-8")); } catch { art = null; }
const html = await readFile(join(ROOT, "research/assets/build.html"), "utf-8");
const rowsMatch = html.match(/const CARD_ROWS = (\[\[[\s\S]*?\]\]);/);
if (!rowsMatch) { console.error("\n  ✗ GAUNTLET: CARD_ROWS not found in build.html — the editor has not been built.\n"); process.exit(1); }
const ROWS = JSON.parse(rowsMatch[1]);

// Rehydrate exactly as the page does, from the page's own decoder.
const INDEX = ROWS.map(function (r) {
  var o = { i: r[0], n: r[1], s: r[2], y: r[3] };
  if (r[4]) o.a = r[4]; if (r[5]) o.r = r[5]; if (r[6]) o.p = r[6];
  if (r[7]) o.T = r[7]; if (r[8]) o.D = r[8]; if (r[9]) o.E = r[9];
  if (r[10]) o.H = r[10]; if (r[11]) o.S = r[11]; if (r[12]) o.R = r[12];
  if (r[13]) o.L = r[13]; if (r[14]) o.A = r[14]; if (r[15]) o.W = r[15];
  if (r[16]) o.hero = 1;
  return o;
});

// Lift the matcher out of the shipped page rather than reimplementing it. A
// reimplementation would test this file's idea of the matcher, which is exactly
// the mistake that let the /s+/ bug through.
function lift(names) {
  const src = names.map((sig) => {
    const i = html.indexOf("function " + sig + "(");
    if (i < 0) throw new Error(`shipped page has no function ${sig}() — the editor build is stale or the function was renamed`);
    const j = html.indexOf("\n}", i);
    return html.slice(i, j + 2);
  }).join("\n");
  // THE FUNCTIONS DEPEND ON MODULE-LEVEL CONSTANTS, so those have to come too.
  // fold() reads COMBINING and RSQUO; the whitespace splitter is WS. Lifting the
  // function bodies alone gave "ReferenceError: fold is not defined" - which is
  // the gauntlet working correctly: it reads the SHIPPED page, so it breaks
  // honestly the moment the shipped page changes shape.
  // monName() strips form prefixes and mechanic suffixes using two module-level
  // regexes, so the suggester cannot be lifted without them. They are declared
  // const rather than var, hence the two spellings.
  const vars = [["var", "COMBINING"], ["var", "RSQUO"], ["var", "WS"],
                ["const", "FORM_PREFIX"], ["const", "MECH_SUFFIX"]].map(([kw, v]) => {
    const i = html.indexOf(kw + " " + v + " = ");
    if (i < 0) return "";
    const j = html.indexOf(";", i);
    return html.slice(i, j + 1);
  }).filter(Boolean).join("\n") + "\nlet SUGGEST_NAMES = null;";
  return new Function("INDEX", vars + "\n" + src + "; return {" + names.map(n => n + ":" + n).join(",") + "};")(INDEX);
}
const { fold, termsOf, hits, suggestNames, monName } = lift(["fold", "hay", "termsOf", "hits", "monName", "editDistance", "suggestNames"]);
const find = (q) => { const t = termsOf(q); return INDEX.filter(c => hits(c, t)); };

const { cards } = await loadCards();

// ── 1. THE INDEX IS THE WHOLE CATALOGUE ────────────────────────────────────
head("1. index completeness");
check("index", "ships every catalogue card", ROWS.length === cards.size,
  `shipped ${ROWS.length}, catalogue has ${cards.size}`);
for (const id of ["neo1-40", "sv9-20"]) {
  check("index", `${id} is findable`, INDEX.some(c => c.i === id),
    "the Magmar pairing that shipped 2026-08-25 must be buildable in the editor");
}

// ── 2. MULTI-TERM QUERIES ──────────────────────────────────────────────────
// Every combination a person might actually type about a card they can see.
head("2. multi-term queries");
const CASES = [
  // [query, id that must appear]
  ["magmar kimura", "neo1-40"],
  ["kimura magmar", "neo1-40"],
  ["magmar 2000", "neo1-40"],
  ["magmar, kimura", "neo1-40"],          // punctuation
  ["  magmar   kimura  ", "neo1-40"],     // sloppy whitespace
  ["MAGMAR KIMURA", "neo1-40"],           // case
  ["kimura magmar 2025", "sv9-20"],
  ["magmar journey together", "sv9-20"],
  ["magmar neo genesis", "neo1-40"],
  ["magmar uncommon", "neo1-40"],
  ["magmar fire", "neo1-40"],
  ["charizard base 1999", "base1-4"],
  ["arita squirtle base", "base1-63"],
];
for (const [q, id] of CASES) {
  const r = find(q);
  check("multi-term", JSON.stringify(q), r.some(c => c.i === id),
    `expected ${id} in ${r.length} results`);
}
// order must not matter
for (const [q, id] of CASES.slice(0, 8)) {
  const rev = q.trim().split(/\s+/).reverse().join(" ");
  check("multi-term", "order-independent: " + JSON.stringify(rev),
    find(rev).some(c => c.i === id), `expected ${id}`);
}
// a term that is true of no card must return nothing
for (const q of ["magmar 1066", "zzzznotacard", "kimura zzzz"]) {
  check("multi-term", "no false positives: " + JSON.stringify(q), find(q).length === 0,
    `got ${find(q).length}`);
}

// ── 3. CARDINALITY EXTREMES ────────────────────────────────────────────────
// The brief asked for a Pokemon with one card and one with 118. No name has
// 118 — the maximum in this catalogue is Pikachu at 80, measured 2026-08-25.
// Using the real extremes rather than the remembered ones.
head("3. cardinality extremes");
const byName = new Map();
for (const c of cards.values()) { if (!byName.has(c.name)) byName.set(c.name, []); byName.get(c.name).push(c); }
const ranked = [...byName.entries()].sort((a, b) => b[1].length - a[1].length);
const [bigName, bigList] = ranked[0];
const singles = ranked.filter(([, v]) => v.length === 1);
check("cardinality", `most-printed name (${bigName}, ${bigList.length}) is fully findable`,
  find(bigName).length >= bigList.length, `search found ${find(bigName).length}, catalogue has ${bigList.length}`);
check("cardinality", "at least one single-card name exists", singles.length > 0);
if (singles.length) {
  const [oneName, oneList] = singles[0];
  check("cardinality", `single-card name (${oneName}) resolves`, find(oneName).length >= 1);
  check("cardinality", `single-card name relations do not crash`,
    (await relationsFor(oneList[0].id)) !== null);
}

// ── 4. CARDS WITH NO ARTIST CREDIT ─────────────────────────────────────────
// 216 of them, nearly all basic Energy. They must remain findable and must not
// be gathered into a cohort that "shares" a missing credit.
head("4. cards with no artist credit");
const noArtist = [...cards.values()].filter(c => !c.artist);
check("no-artist", "the empty-credit cards exist to test", noArtist.length > 0, `${noArtist.length} found`);
if (noArtist.length) {
  const c0 = noArtist[0];
  check("no-artist", "still present in the shipped index", INDEX.some(c => c.i === c0.id));
  check("no-artist", "still findable by name", find(c0.name).some(c => c.i === c0.id));
  let threw = null;
  try { await relationsFor(c0.id); } catch (e) { threw = e; }
  check("no-artist", "relations do not throw", threw === null, threw ? threw.message : "");
  const rs = threw ? [] : await relationsFor(c0.id);
  check("no-artist", "no SAME_ARTIST relation is invented",
    !rs.some(r => r.relation === "SAME_ARTIST"),
    "a missing credit must never become a shared one");
  check("no-artist", "no ARTIST_REVISITS relation is invented",
    !rs.some(r => r.relation === "ARTIST_REVISITS"));
}

// ── 5. EVERY RELATION TYPE PRODUCES A VALID PAIR ───────────────────────────
head("5. relation coverage");
const seen = new Map();
const SAMPLE = [...cards.keys()];
// a deterministic spread across the catalogue, plus the fixtures that matter
const step = Math.max(1, Math.floor(SAMPLE.length / 400));
const probe = ["neo1-40", "sv9-20", "base1-4", "base1-63"];
// FIXTURES FOR EVERY RELATION, not just whatever the spread happens to hit. The
// deterministic sample contained no connecting-art member, so CONNECTING_ART
// produced nothing and the coverage assertion failed - correctly. A relation
// that fires only on cards nobody sampled is untested, not absent.
for (const g of ((art && art.groups) || []).filter(x => x.resolution === "COMPLETE").slice(0, 12)) {
  if (g.cards && g.cards[0]) probe.push(g.cards[0]);
}
for (let i = 0; i < SAMPLE.length; i += step) probe.push(SAMPLE[i]);

// ── 6. AND EVERY RELATION IS TRUE IN THE DATA ──────────────────────────────
// The assertion the brief calls the one that matters most. Each relation is
// re-derived from the cards it names; the reason line's own numbers are
// regenerated and compared. Nothing is taken on the relation's word.
function verify(r, subject) {
  const cs = r.cards.map(i => cards.get(i));
  if (cs.some(x => !x)) return "names a card id that is not in the catalogue";
  const e = r.evidence ?? {};
  switch (r.relation) {
    case "SAME_POKEMON_ACROSS_TIME": {
      if (!cs.every(x => x.name === subject.name)) return "a card in the set has a different name";
      const ys = cs.map(x => x.year);
      if (Math.max(...ys) - Math.min(...ys) !== e.span) return "stated span does not match the years";
      if (e.span > 0 && !r.reason.includes(words(e.span))) return "reason does not state the real span";
      return null;
    }
    case "SAME_ARTIST":
      if (!subject.artist) return "claims a shared artist for a card with no credit";
      if (!cs.every(x => x.artist === subject.artist)) return "a card in the set has a different artist";
      return null;
    case "ARTIST_REVISITS": {
      if (cs.length !== 2) return "a revisit must name exactly two cards";
      const [a, b] = cs;
      if (!a.artist || a.artist !== b.artist) return "the two cards do not share an artist";
      if (a.name !== b.name) return "the two cards are not the same Pokemon";
      if (b.year - a.year !== e.gap) return "stated gap does not match the years";
      if (e.gap <= 0) return "a revisit needs a gap greater than zero";
      if (!r.reason.includes(words(e.gap))) return "reason does not state the real gap";
      if (!r.reason.includes(a.artist)) return "reason does not name the artist it claims";
      return null;
    }
    case "EVOLUTION_LINE": {
      for (let i = 1; i < cs.length; i++) {
        const prev = cs[i - 1], cur = cs[i];
        if (cur.evolvesFrom !== prev.name) return `${cur.name} does not evolve from ${prev.name}`;
      }
      return null;
    }
    case "SAME_SET":
      return cs.every(x => x.set === subject.set) ? null : "a card in the set is from a different set";
    case "SAME_YEAR":
      return cs.every(x => x.year === subject.year) ? null : "a card in the set is from a different year";
    case "SAME_TYPE":
      return cs.every(x => (x.types ?? []).includes(e.type)) ? null : `a card does not have type ${e.type}`;
    case "SAME_WEAKNESS":
      return cs.every(x => x.weakness === e.weakness) ? null : "a card has a different weakness";
    case "SHARED_ATTACK": {
      const a = String(e.attack).toLowerCase();
      return cs.every(x => (x.attacks ?? []).some(n => n.toLowerCase() === a))
        ? null : `a card does not have the attack ${e.attack}`;
    }
    case "DEX_NEIGHBOURS": {
      const others = cs.filter(x => x.id !== subject.id);
      return others.every(x => Math.abs((x.dex ?? -999) - subject.dex) === 1)
        ? null : "a neighbour is not adjacent in the dex";
    }
    // The connecting-art relations are re-derived against the ingested groups:
    // the group must exist, must be COMPLETE, must actually contain the subject,
    // and its card list must match the relation's exactly. A relation that
    // named a group it is not in would put a stranger's card in the picture.
    case "COMBINED_ILLUSTRATION":
    case "NARRATIVE_SEQUENCE":
    case "SHARED_BACKGROUND_PATTERN": {
      const g = ((art && art.groups) || []).find(x => x.id === e.groupId);
      if (!g) return "names a connecting-art group that does not exist";
      if (g.resolution !== "COMPLETE") return "offers a PARTIAL group as a connection";
      if (!(g.cards || []).includes(subject.id)) return "the subject card is not in the group it claims";
      if ((g.cards || []).join() !== r.cards.join()) return "card list does not match the group";
      if (g.relation !== r.relation) return "relation does not match the group's own kind";
      if (r.evidence.artist && !r.reason.includes(r.evidence.artist)) return "reason does not name the artist it claims";
      return null;
    }
    // SET_DEPTH claims counted facts about a whole set, so every number in the
    // evidence is recomputed here from the catalogue rather than trusted. This
    // relation exists to be READ ALOUD in a post - "198 cards, 47 illustrators,
    // dearest $4166.89 against a $1.20 median" - and a wrong count in a caption
    // is the failure this project can least afford.
    case "SET_DEPTH": {
      const inSet = [...cards.values()].filter(x => x.set === e.set);
      if (inSet.length !== e.cards) return `claims ${e.cards} cards in ${e.set}, the catalogue holds ${inSet.length}`;
      const illus = new Set(inSet.map(x => x.artist).filter(Boolean)).size;
      if (illus !== e.illustrators) return `claims ${e.illustrators} illustrators, the catalogue holds ${illus}`;
      const priced = inSet.filter(x => typeof x.price === "number" && x.price > 0)
        .sort((a, b) => b.price - a.price);
      if (!priced.length) return "claims prices for a set with none";
      if (priced[0].id !== e.top.id) return `claims ${e.top.name} is dearest, the catalogue says ${priced[0].name}`;
      const med = priced[Math.floor(priced.length / 2)].price;
      if (Math.abs(med - e.median) > 0.005) return `claims a median of ${e.median}, the catalogue says ${med}`;
      if (inSet.length - priced.length !== e.noMarket)
        return `claims ${e.noMarket} without a market price, the catalogue says ${inSet.length - priced.length}`;
      // The reason line must not judge - that is the whole mechanic. A relation
      // that ANSWERS "is this set any good" removes the reason to reply.
      if (/(good|bad|best|worst|weak|strong|carried|overrated|underrated|just)/i.test(r.reason))
        return "the reason line passes judgement — SET_DEPTH states numbers and leaves the question open";
      return null;
    }
    default:
      return "unknown relation type";
  }
}

let verified = 0;
for (const id of probe) {
  const subject = cards.get(id);
  if (!subject) continue;
  let rs;
  try { rs = await relationsFor(id); }
  catch (e) { check("relations", "relationsFor(" + id + ") threw", false, e.message); continue; }
  for (const r of rs) {
    seen.set(r.relation, (seen.get(r.relation) ?? 0) + 1);
    const why = verify(r, subject);
    verified++;
    check("truth", `${r.relation} on ${id}`, why === null, why ?? "");
  }
}
head("6. relation truth");
console.log(`     ${verified.toLocaleString("en-US")} relations re-derived from the cards they name`);
// CONNECTING_ART is the one function whose output is named after the GROUP it
// found, not after itself: it emits COMBINED_ILLUSTRATION, NARRATIVE_SEQUENCE or
// SHARED_BACKGROUND_PATTERN. Checking for its own name would fail forever while
// the relation worked perfectly, which is a guard reporting on its own naming.
const EMITS = { CONNECTING_ART: ["COMBINED_ILLUSTRATION", "NARRATIVE_SEQUENCE", "SHARED_BACKGROUND_PATTERN"] };
for (const t of RELATION_TYPES) {
  const names = EMITS[t] ?? [t];
  const got = names.reduce((n, x) => n + (seen.get(x) ?? 0), 0);
  check("relations", `${t} produced at least one valid instance`, got > 0,
    `no card in the probe produced ${names.join(" or ")}`);
}

// The widest-gap query is the one that produced tonight's post. Verify the
// headline claim specifically rather than trusting the sample to cover it.
const rev = await artistRevisits({ minGap: 18, limit: 100 });
check("relations", "artistRevisits returns the documented population", rev.length >= 45,
  `${rev.length} at >=18y, audit measured 45`);
const top = rev[0];
check("relations", "widest revisit is the Kimura Magmar",
  top && top.cards[0] === "neo1-40" && top.cards[1] === "sv9-20",
  top ? top.cards.join(" -> ") : "none");
for (const r of rev) {
  const why = verify(r, cards.get(r.cards[0]));
  check("truth", "revisit " + r.cards.join("->"), why === null, why ?? "");
}

// ── 7. PERFORMANCE ─────────────────────────────────────────────────────────
// Worst case is a query whose terms are common enough that no term prunes
// early, over the full index, with a cold haystack cache.
head("7. performance");
const WORST = ["pokemon fire basic common 1999", "a e i o u", "kimura magmar 2025 fire uncommon"];
let worstMs = 0;
for (const q of WORST) {
  for (const c of INDEX) delete c._h;          // cold cache, the real first-keystroke cost
  const t0 = process.hrtime.bigint();
  find(q);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  worstMs = Math.max(worstMs, ms);
  console.log(`     ${JSON.stringify(q).padEnd(38)} ${ms.toFixed(1)}ms cold`);
}
// A mid-range phone runs roughly 4x slower than this desk on single-thread JS.
// That multiplier is an ASSUMPTION, not a measurement — see the blind spot.
const MOBILE_MULTIPLIER = 4;
const budgetMs = 150;
check("performance", `worst-case query under ${budgetMs}ms at ${MOBILE_MULTIPLIER}x`,
  worstMs * MOBILE_MULTIPLIER < budgetMs,
  `${(worstMs * MOBILE_MULTIPLIER).toFixed(0)}ms projected on a ${MOBILE_MULTIPLIER}x-slower device`);
console.log(`     projected on a ${MOBILE_MULTIPLIER}x-slower phone: ${(worstMs * MOBILE_MULTIPLIER).toFixed(0)}ms (budget ${budgetMs}ms)`);
console.log(`     NOT A DEVICE MEASUREMENT. No phone has run this.`);


// ── 8. CONNECTING ART ──────────────────────────────────────────────────────
// Every group must be renderable: each card it names has to exist in the
// catalogue and carry the fields a composite needs. A group that names a card
// we do not hold renders as a gap or a card back, and a card back has already
// reached a post once.
//
// COMPLETE means every card resolved. PARTIAL means some did not, and a PARTIAL
// group must name what is missing - a group that quietly drops a card would
// render as a smaller, wrong picture and still look fine.
head("8. connecting art");
if (!art) {
  check("art", "data/connecting-art.json is readable", false, "missing or unparseable");
} else {
  const RELATIONS = new Set(["COMBINED_ILLUSTRATION", "NARRATIVE_SEQUENCE", "SHARED_BACKGROUND_PATTERN"]);
  let complete = 0, partial = 0, cardsChecked = 0;
  for (const g of art.groups ?? []) {
    check("art", `${g.id} declares a known relation`, RELATIONS.has(g.relation), g.relation);
    // every named card must be a real card
    for (const id of g.cards ?? []) {
      cardsChecked++;
      const c = cards.get(id);
      if (!c) { check("art", `${g.id} names a real card`, false, `${id} is not in the catalogue`); continue; }
      // a composite needs these to draw and to credit
      if (!c.name || !c.set || !c.year) {
        check("art", `${g.id}/${id} has the fields a composite needs`, false, "name, set or year missing");
      }
    }
    if (g.resolution === "COMPLETE") {
      complete++;
      check("art", `${g.id} COMPLETE resolves every card`,
        g.resolvedCount === g.cardCount && (g.cards ?? []).length === g.cardCount,
        `${g.resolvedCount}/${g.cardCount}, cards[] holds ${(g.cards ?? []).length}`);
      check("art", `${g.id} COMPLETE has nothing missing`, (g.missing ?? []).length === 0,
        (g.missing ?? []).join("; "));
      check("art", `${g.id} COMPLETE has more than one card`, (g.cards ?? []).length > 1);
    } else {
      partial++;
      // THE POINT OF PARTIAL. It must say what it could not resolve, by name.
      check("art", `${g.id} PARTIAL names its missing cards`,
        (g.missing ?? []).length > 0 || (g.cards ?? []).length === g.cardCount,
        "a partial group with no missing list has dropped cards silently");
    }
    // order is the whole job, so the grid must account for every card
    const gridCount = (g.grid ?? []).reduce((n, r) => n + r.length, 0);
    check("art", `${g.id} grid accounts for every card`, gridCount === g.cardCount,
      `grid holds ${gridCount}, cardCount is ${g.cardCount}`);
    // provenance is not optional for ingested facts
    check("art", `${g.id} cites a source`, !!g.sourceUrl && !!g.retrievedAt);
  }
  console.log(`     ${(art.groups ?? []).length} groups · ${complete} complete · ${partial} partial · ${cardsChecked} card references checked`);
  check("art", "the Arceus wave pattern is NOT called a combined illustration",
    (art.groups ?? []).some(g => g.relation === "SHARED_BACKGROUND_PATTERN"),
    "only the background continues on those cards; calling it one image is a false claim");
}

// ── 9. SUGGESTION LINES MUST BE ABOUT THE CARDS ON SCREEN ──────────────────
// A panel offered "Does chasing value make you less of a collector?" over every
// pairing in the catalogue. It was true, it was well written, and it was the
// same sentence every time - and a user who sees one line twice over two
// different pairs knows instantly the whole panel is a template. That costs
// more than a missing feature does, because it makes everything else on the
// screen look generated too.
//
// THE STANDARD IS THE CREDIT LIST under the panel: "Lugia - Aquapolis 149 -
// Naoyo Kimura" cannot be generic, because it is read from the data. Every
// suggested line is held to the same bar, and this asserts it across twenty
// pairings rather than the three a human would check.
head("9. suggestion lines");
{
  const engineSrc = await readFile(join(ROOT, "scripts/line-engine.js"), "utf-8").catch(() => "");
  if (!engineSrc) {
    check("lines", "scripts/line-engine.js exists", false, "the line engine has not been generated");
  } else {
    const textAll = JSON.parse(await readFile(join(ROOT, "data/card-text.json"), "utf-8")).cards;
    const slim = {};
    for (const [k, v] of Object.entries(textAll)) if (v.a && v.a.length) slim[k] = { a: v.a.slice(0, 1) };
    let lineOptions = null;
    try {
      lineOptions = new Function(engineSrc.replace("__CARD_TEXT__", JSON.stringify(slim)) + "; return lineOptions;")();
    } catch (e) {
      check("lines", "the shipped line engine evaluates", false, e.message);
    }

    if (lineOptions) {
      // Deterministic sample: a fixed stride through the catalogue, so a failure
      // is reproducible rather than a lottery somebody re-runs until it passes.
      const ids = [...cards.keys()];
      const pairs = [];
      // DISJOINT PAIRS. The first version stepped by one stride per pair, so each
      // card appeared in TWO adjacent pairings - and a line about that card then
      // showed up twice and was reported as a template. It was not: the same card
      // was genuinely on screen both times. A repeat only means something when
      // the two pairings share no cards.
      const stride = Math.max(2, Math.floor(ids.length / 41));
      for (let k = 0; pairs.length < 20 && (2 * k + 1) * stride < ids.length; k++) {
        const a = cards.get(ids[2 * k * stride]), b = cards.get(ids[(2 * k + 1) * stride]);
        if (a && b && a.year && b.year) pairs.push([a, b]);
      }
      const row = (c) => ({ i: c.id, n: c.name, s: c.set, y: String(c.year), a: c.artist || 0, r: c.rarity || 0, p: c.price || 0 });

      const seenLine = new Map();
      let produced = 0;
      for (const [a, b] of pairs) {
        let opts = [];
        try { opts = lineOptions([row(a), row(b)], null, 0); }
        catch (e) { check("lines", `lineOptions did not throw on ${a.id}+${b.id}`, false, e.message); continue; }
        produced += opts.length;
        for (const o of opts) {
          const key = String(o.text);
          if (!seenLine.has(key)) seenLine.set(key, []);
          seenLine.get(key).push(`${a.id}+${b.id}`);
          // Every line must carry something from the cards it was offered for.
          const tokens = [a.name, b.name, a.artist, b.artist, a.set, b.set, String(a.year), String(b.year)]
            .filter(Boolean).map(String);
          const derived = tokens.some(t => key.includes(t));
          check("lines", `line names something on screen (${a.id}+${b.id})`, derived,
            `"${key.split("\n")[0].slice(0, 60)}" contains no name, artist, set or year from either card`);
        }
      }

      const repeated = [...seenLine.entries()].filter(([, v]) => v.length > 1);
      check("lines", "no suggestion line appears for more than one pairing", repeated.length === 0,
        repeated.slice(0, 4).map(([t, v]) => `"${t.split("\n")[0].slice(0, 44)}" on ${v.length}`).join("; "));
      console.log(`     ${pairs.length} pairings · ${produced} lines · ${seenLine.size} distinct`);
    }
  }
}

// ── 10. PREFERENCES MUST ACTUALLY PERSIST ──────────────────────────────────
// store.get called store.get. Infinite recursion, RangeError, swallowed by the
// very try/catch written to survive a blocked localStorage - so it never threw
// and never stored. Owned cards, the streak and the view preference silently
// did nothing on every device, and the tutorial "never show again" flag would
// have failed the same way: a stranger would meet the tutorial again on the
// second screen they ever saw, which reads as broken software.
//
// A REAL RELOAD IS THE ONLY PROOF and this cannot do one; that was verified by
// hand in a browser. What this asserts is the shape that failed: the store must
// reach localStorage and must not call itself.
head("10. preference persistence");
{
  const storeSrc = (html.match(/const store = \{[\s\S]*?\n\};/) ?? [""])[0];
  check("store", "the shipped page defines a store", storeSrc.length > 0);
  if (storeSrc) {
    check("store", "store.get reads localStorage", /getItem\(/.test(storeSrc),
      "it must reach the browser's storage, not a helper of its own");
    check("store", "store.set writes localStorage", /setItem\(/.test(storeSrc));
    check("store", "no method calls itself", !/return store\.get\(|store\.set\(k, v\);\s*\}/.test(storeSrc),
      "store.get returning store.get(k) recursed until RangeError and stored nothing");
    check("store", "the tutorial flag uses that store",
      /store\.set\(TUT_KEY/.test(html) && /store\.get\(TUT_KEY\)/.test(html),
      "if the tutorial used a different path it would reappear on every visit");
  }
}

// ── 11. WHAT A HUMAN ACTUALLY TYPES ────────────────────────────────────────
// Sections 1-10 proved the search WORKS. They never proved it works for the
// input a person produces, and those are different claims: "Farfetch'd" found
// 19 cards while "Farfetchd" found none, and "Pokemon" found nothing at all
// unless you reached for the accent key. Every guard passed for weeks.
//
// The cases that LOOKED tolerant were tolerant by accident. "Mr Mime" worked
// only because it split into two short tokens that each substring-match inside
// "mr. mime"; a single-token name with an accent in the middle had no such luck.
// A test suite written by hand would have contained exactly the examples whose
// spelling somebody already thought about.
//
// So the cases are DERIVED FROM THE CATALOGUE. Every card name carrying a
// character a phone keyboard does not offer becomes a test automatically, which
// means a new set cannot introduce an untested name — the set arrives, the
// names enter the catalogue, and the assertions appear with them.
head("11. what a human actually types");
{
  // What a US keyboard can produce without a long-press: ASCII printable.
  // Anything outside it is a character the user cannot reasonably reach.
  const KEYBOARD = /^[A-Za-z0-9 !-/:-@[-`{-~]*$/;
  const names = new Set();
  for (const c of cards.values()) if (c.name) names.add(c.name);

  // The keyboard form of a name: what somebody types when they are looking at
  // the card and typing on a phone. fold() already strips accents and
  // apostrophes; the symbols and punctuation go too, because nobody types ♂.
  // WRITTEN INDEPENDENTLY OF fold(), DELIBERATELY. The first version of this
  // helper called fold() to build the expected query — the same function the
  // assertions are testing. Crippling fold() then changed BOTH the query and
  // the haystack, they degraded together, and all 702 checks passed against a
  // search that could no longer find "Pokemon". A test that borrows the
  // implementation it is testing proves only that the code agrees with itself.
  //
  // So this states what a THUMB produces, in its own terms: decompose, drop the
  // combining marks, drop everything that is not a letter or a digit. If fold()
  // stops doing the equivalent, these assertions fail — which is the point.
  const COMBINING_MARKS = new RegExp("[" + String.fromCharCode(768) + "-" + String.fromCharCode(879) + "]", "g");
  const keyboardForm = (s) => String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const offKeyboard = [...names].filter(n => !KEYBOARD.test(n));
  const apostrophe  = [...names].filter(n => /['’]/.test(n));
  const period      = [...names].filter(n => /\./.test(n));
  const needsTest   = [...new Set([...offKeyboard, ...apostrophe, ...period])];

  console.log(`     ${names.size} distinct card names · ${needsTest.length} carry something a keyboard does not`);
  console.log(`     ${offKeyboard.length} off-keyboard · ${apostrophe.length} apostrophe · ${period.length} period`);

  // Every affected name must be findable by its keyboard form. This is the
  // assertion that was missing: not "search works" but "search works for what
  // the user can actually type".
  let tested = 0, worst = [];
  for (const n of needsTest) {
    const typed = keyboardForm(n);
    if (!typed) continue;                       // a name that folds to nothing
    tested++;
    const terms = termsOf(typed);
    const found = INDEX.some(c => c.n === n && hits(c, terms));
    if (!found && worst.length < 6) worst.push(`"${typed}" does not find "${n}"`);
    check("keyboard", `"${typed}" finds ${n}`, found,
      `a phone keyboard cannot produce "${n}" — typing "${typed}" must find it`);
  }
  console.log(`     ${tested} keyboard-form queries asserted`);

  // Artists carry the same problem and nobody thinks to test them: two of them
  // hold characters off the keyboard, and an illustrator credit is the single
  // claim this account cannot afford to get wrong.
  const artists = new Set();
  for (const c of cards.values()) if (c.artist) artists.add(c.artist);
  const artOff = [...artists].filter(a => !KEYBOARD.test(a));
  for (const a of artOff) {
    const typed = keyboardForm(a);
    const terms = termsOf(typed);
    check("keyboard", `"${typed}" finds cards by ${a}`,
      INDEX.some(c => c.a === a && hits(c, terms)),
      `typing "${typed}" must reach ${a}`);
  }
  console.log(`     ${artOff.length} illustrator names with an off-keyboard character`);

  // LOWERCASE, ALWAYS. Phone keyboards autocapitalise inconsistently and nobody
  // types "Ho-Oh" with both capitals on purpose.
  const sample = [...names].filter((_, i) => i % 97 === 0).slice(0, 40);
  for (const n of sample) {
    const lower = keyboardForm(n).toLowerCase();
    check("keyboard", `lowercase "${lower}" finds ${n}`,
      INDEX.some(c => c.n === n && hits(c, termsOf(lower))),
      `case must not decide whether a card is findable`);
  }

  // MISSPELLINGS, within the tolerance the suggester already promises:
  // d <= max(2, ceil(len/2)). A dropped letter and a doubled letter are the two
  // a thumb produces most, so they are generated rather than chosen.
  const drop1 = (s) => s.slice(0, Math.floor(s.length / 2)) + s.slice(Math.floor(s.length / 2) + 1);
  const double1 = (s) => { const i = Math.floor(s.length / 2); return s.slice(0, i) + s[i] + s.slice(i); };
  // DERIVED FROM WHAT THE SUGGESTER ACTUALLY OFFERS. My first version took the
  // first token of the card name and asserted "darkri-ex" should suggest
  // "Darkrai-EX". The suggester answered "Darkrai" and was right: its list is
  // built from monName(), which strips form prefixes and mechanic suffixes so
  // it offers the POKEMON, not the card. Six failures, all mine. Deriving the
  // cases from the same normalisation the suggester uses means the test cannot
  // disagree with the feature about what the feature is for.
  const monNames = [...new Set([...cards.values()].map(c => monName(c.name || "")).filter(n => n && n.length >= 6))];
  const misspellSample = monNames.filter((_, i) => i % 31 === 0).slice(0, 30);
  let suggestible = 0;
  for (const n of misspellSample) {
    for (const typo of [drop1(n), double1(n)]) {
      const d = Math.abs(typo.length - n.length) + 1;   // one edit, by construction
      if (d > Math.max(2, Math.ceil(typo.length / 2))) continue;
      // The promise is that the SUGGESTER recovers it, not that search does.
      const names6 = suggestNames(keyboardForm(typo));
      const ok = names6.some(x => keyboardForm(x) === keyboardForm(n));
      if (ok) suggestible++;
      check("keyboard", `"${typo}" suggests ${n}`, ok,
        `one edit from a real name must be recoverable — the suggester promises d <= max(2, len/2)`);
    }
  }
  console.log(`     ${misspellSample.length * 2} one-edit misspellings asserted · ${suggestible} recovered`);
  if (worst.length) for (const w of worst) console.log(`     ✗ ${w}`);
}

// ── 12. A TYPED SENTENCE ABOUT A COMPUTED RULE ─────────────────────────────
// The rating filters each carry a note explaining what the threshold means,
// under a comment promising that a filter you cannot explain is one nobody
// should trust. One of those notes read "the Baby subtype, or an unevolved
// Basic at 60 HP or less". The rule is hp <= 70, and a plain small Basic scores
// 5 against a filter that requires 7 — so no card had ever qualified the way
// the sentence described. It drifted from the rule and nothing failed.
//
// This is the general shape of the Kimura error one level down: a sentence
// written beside a computed fact rather than from it. The check is narrow and
// mechanical — a NUMBER cited in a note must be a number the passing cards
// actually exhibit — because that is the part a machine can settle.
head("12. filter notes match the cards they describe");
{
  const bios = JSON.parse(await readFile(join(ROOT, "data/card-bios.json"), "utf-8")).bios || {};
  const notes = [...html.matchAll(/\{ id: "([a-z-]+)", label: "[^"]*", test: \(r\) => \(r\.([a-z]+) \?\? 0\) >= (\d+), note: "([^"]+)" \}/g)]
    .map(m => ({ id: m[1], field: m[2], min: Number(m[3]), note: m[4] }));

  check("notes", "the rating filters were found in the shipped page", notes.length > 0,
    "the regex found no RATING_FILTERS — this check would pass vacuously, which is worse than failing");

  for (const f of notes) {
    // Every card that PASSES this filter, and the reason the generator recorded.
    const passing = Object.values(bios)
      .filter(b => ((b.ratings || {})[f.field] ?? -1) >= f.min)
      .map(b => (b.why || {})[f.field] || "");

    check("notes", `${f.id}: at least one card passes`, passing.length > 0,
      `nothing in the catalogue passes ${f.field} >= ${f.min}, so its note describes an empty set`);
    if (!passing.length) continue;

    // Any number the note asserts must be a number the passing cards show.
    const cited = [...f.note.matchAll(/\b(\d+)\b/g)].map(m => m[1]);
    for (const n of cited) {
      const seen = passing.some(w => w.includes(n));
      check("notes", `${f.id}: the note cites ${n} and a passing card shows it`, seen,
        `note says "${f.note}" but no card passing ${f.field} >= ${f.min} records ${n} in its reason`);
    }
    console.log(`     ${f.id.padEnd(9)} ${String(passing.length).padStart(5)} cards pass · ${cited.length} number(s) cited in its note`);
  }
}

// ── REPORT ─────────────────────────────────────────────────────────────────
console.log("");
if (fail) {
  console.error(`  ✗ SEARCH GAUNTLET — ${fail} failure(s) of ${pass + fail} checks:\n`);
  for (const f of fails.slice(0, 25)) console.error(`     [${f.group}] ${f.name}\n        ${f.detail}`);
  if (fails.length > 25) console.error(`     … ${fails.length - 25} more`);
  console.error("");
  process.exit(1);
}
console.log(`  ✓ search gauntlet: ${pass} checks passed · ${ROWS.length.toLocaleString("en-US")} cards · ${verified.toLocaleString("en-US")} relations verified true in the data\n`);
