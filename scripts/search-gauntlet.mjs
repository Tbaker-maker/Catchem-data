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
  return new Function(src + "; return {" + names.map(n => n + ":" + n).join(",") + "};")();
}
const { termsOf, hits } = lift(["hay", "termsOf", "hits"]);
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
for (const t of RELATION_TYPES) {
  check("relations", `${t} produced at least one valid instance`, (seen.get(t) ?? 0) > 0,
    "no card in the probe produced this relation");
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
