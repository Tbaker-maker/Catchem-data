// card-relations.mjs — why two cards belong in the same picture.
//
// Search can only ever filter a flat list, and every post shape that has worked
// for us is about a RELATIONSHIP between cards: the same creature across
// twenty-five years, one illustrator returning to a Pokémon, a whole evolution
// line in one frame. Filtering cannot express any of those, so the tool could
// find a card and never find the pairing, which is the actual product.
//
// THE REASON IS THE POINT, NOT THE CARD LIST. Every relation returns a one-line
// statement of fact — "Naoyo Kimura illustrated both, twenty-five years apart."
// That line is what a human edits into a caption, and it is the same sentence
// that answers originality-guard's "what is original here". A relation that
// cannot say WHY in one true sentence is not a relation, it is a filter.
//
// IT NEVER WRITES THE CAPTION. The reason is a fact; the words are Tyler's.
// Every post of his that worked came from his own sentence, and none of the 84
// formulas we generate were used in any of them.
//
// THE LAW THIS FILE IS UNDER: a relation must never claim a connection that is
// not true in the data. Every relation therefore carries the FIELDS it was
// derived from, so search-gauntlet.mjs can re-derive the claim from the cards
// themselves and fail the build if the stated reason does not hold. A wrong
// "same artist" line in a public post is the failure this tool exists to avoid,
// and we have already shipped a card back once.
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf-8"));

// ── LOADING ────────────────────────────────────────────────────────────────
// The relational fields are NOT in the catalogue, which is a commerce record.
// Types, evolution, dex, HP and weakness live in card-attrs.json; attack names
// live in card-text.json. Audited 2026-08-25, see
// research/reports/2026-08-25-search-audit.md.
let CACHE = null;
export async function loadCards() {
  if (CACHE) return CACHE;
  const [cat, attrs, text] = await Promise.all([
    J("data/card-catalogue.json"), J("data/card-attrs.json"), J("data/card-text.json"),
  ]);
  const cards = new Map();
  for (const [id, c] of Object.entries(cat.cards)) {
    const A = attrs.cards[id] ?? {}, T = text.cards[id] ?? {};
    cards.set(id, {
      id,
      name: c.name,
      // EMPTY IS NOT A VALUE. artist reports 100% coverage in the catalogue and
      // 216 cards carry an empty string, nearly all basic Energy. Treating ""
      // as an artist would invent a 216-card cohort who all "share" no credit,
      // and SAME_ARTIST would then assert a connection that does not exist.
      artist: String(c.artist ?? "").trim() || null,
      set: c.setName,
      setId: c.setId,
      number: c.number,
      rarity: c.rarity || null,
      year: Number(String(c.releaseDate).slice(0, 4)) || null,
      supertype: c.supertype,
      price: c.price ?? 0,
      types: Array.isArray(A.t) && A.t.length ? A.t : null,
      dex: A.dex ?? null,
      hp: A.hp ?? null,
      weakness: A.w || null,
      evolvesFrom: A.ev || null,
      stage: Array.isArray(A.st) && A.st.length ? A.st : null,
      attacks: Array.isArray(T.a) && T.a.length ? T.a : null,
    });
  }
  CACHE = { cards, index: buildIndex(cards) };
  return CACHE;
}

// A SEPARATOR THAT CANNOT OCCUR IN THE THING IT SEPARATES. The composite key
// is artist + name, and every artist here has a multi-word credit, so a space
// would split "Naoyo Kimura Magmar" into artist "Naoyo" and Pokemon "Kimura".
// Unit separator, built by code point so no editor or template can eat it.
const KEYSEP = String.fromCharCode(31);

function push(map, key, id) {
  if (key === null || key === undefined || key === "") return;
  const k = String(key);
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(id);
}

function buildIndex(cards) {
  const byName = new Map(), byArtist = new Map(), byArtistName = new Map();
  const bySet = new Map(), byYear = new Map(), byType = new Map();
  const byWeakness = new Map(), byAttack = new Map(), byDex = new Map();
  const childrenOf = new Map();   // parent NAME -> child card ids
  for (const [id, c] of cards) {
    push(byName, c.name, id);
    push(bySet, c.set, id);
    push(byYear, c.year, id);
    push(byWeakness, c.weakness, id);
    push(byDex, c.dex, id);
    if (c.artist) { push(byArtist, c.artist, id); push(byArtistName, c.artist + KEYSEP + c.name, id); }
    for (const t of c.types ?? []) push(byType, t, id);
    for (const a of c.attacks ?? []) push(byAttack, a.toLowerCase(), id);
    if (c.evolvesFrom) push(childrenOf, c.evolvesFrom, id);
  }
  return { byName, byArtist, byArtistName, bySet, byYear, byType, byWeakness, byAttack, byDex, childrenOf };
}

// ── SAYING NUMBERS ─────────────────────────────────────────────────────────
// "twenty-five years apart" reads like a person wrote it; "25 years apart"
// reads like a report. The reason line is going to be edited into a caption, so
// it should already sound like a sentence.
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function words(n) {
  n = Math.round(Number(n) || 0);
  if (n < 0 || n > 99) return String(n);
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)], o = n % 10;
  return o ? t + "-" + ONES[o] : t;
}
const yearsWord = (n) => words(n) + (n === 1 ? " year" : " years");

// A relation is only worth returning if it can name its own evidence.
const rel = (relation, reason, ids, evidence) => ({ relation, reason, cards: ids, evidence });

// ── THE RELATIONS ──────────────────────────────────────────────────────────
// Each takes the subject card and the loaded index, and returns zero or more
// relations. Returning NOTHING is a valid and common answer — a Trainer card
// has no type, no dex and no evolution line, and inventing one for it is
// exactly the failure this file is guarded against.
const RELATION_FNS = {

  // Same creature, different years. The spine of the archive.
  SAME_POKEMON_ACROSS_TIME(c, ix, cards) {
    const ids = (ix.byName.get(c.name) ?? []).filter(i => i !== c.id);
    if (!ids.length) return [];
    const all = [c.id, ...ids].map(i => cards.get(i)).filter(x => x.year).sort((a, b) => a.year - b.year);
    if (all.length < 2) return [];
    const lo = all[0], hi = all[all.length - 1], span = hi.year - lo.year;
    const reason = span > 0
      ? `${c.name} has ${words(all.length)} cards spanning ${yearsWord(span)}, ${lo.year} to ${hi.year}.`
      : `${c.name} has ${words(all.length)} cards, all from ${lo.year}.`;
    return [rel("SAME_POKEMON_ACROSS_TIME", reason, all.map(x => x.id),
      { name: c.name, first: lo.id, latest: hi.id, firstYear: lo.year, latestYear: hi.year, span, count: all.length })];
  },

  // That illustrator's body of work, with the span they have been working over.
  SAME_ARTIST(c, ix, cards) {
    if (!c.artist) return [];
    const ids = ix.byArtist.get(c.artist) ?? [];
    if (ids.length < 2) return [];
    const ys = ids.map(i => cards.get(i).year).filter(Boolean);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    const yearsPresent = new Set(ys).size;
    const reason = hi > lo
      ? `${c.artist} has ${words(ids.length)} cards from ${lo} to ${hi}, present in ${words(yearsPresent)} of those ${words(hi - lo + 1)} years.`
      : `${c.artist} has ${words(ids.length)} cards, all from ${lo}.`;
    return [rel("SAME_ARTIST", reason, ids,
      { artist: c.artist, count: ids.length, firstYear: lo, latestYear: hi, yearsPresent })];
  },

  // THE STRONGEST SHAPE WE HAVE. Same hand, same creature, years apart. 1,144
  // such pairs exist, 45 of them at eighteen years or more, and the widest in
  // the whole catalogue is Naoyo Kimura's Magmar at twenty-five.
  ARTIST_REVISITS(c, ix, cards) {
    if (!c.artist) return [];
    const ids = ix.byArtistName.get(c.artist + KEYSEP + c.name) ?? [];
    if (ids.length < 2) return [];
    const all = ids.map(i => cards.get(i)).filter(x => x.year).sort((a, b) => a.year - b.year);
    if (all.length < 2) return [];
    const lo = all[0], hi = all[all.length - 1], gap = hi.year - lo.year;
    if (gap <= 0) return [];   // same year is a reprint run, not a revisit
    return [rel("ARTIST_REVISITS",
      `${c.artist} illustrated both, ${yearsWord(gap)} apart.`,
      [lo.id, hi.id],
      { artist: c.artist, name: c.name, gap, firstYear: lo.year, latestYear: hi.year, count: all.length })];
  },

  // Walk evolvesFrom in both directions and assemble the line.
  EVOLUTION_LINE(c, ix, cards) {
    const pickBest = (name) => {
      const ids = ix.byName.get(name) ?? [];
      if (!ids.length) return null;
      return ids.map(i => cards.get(i)).sort((a, b) => (b.price || 0) - (a.price || 0))[0];
    };
    const chain = [];
    // backwards, guarding against a cycle in the data rather than trusting it
    let cur = c, seen = new Set([c.name]);
    while (cur && cur.evolvesFrom && !seen.has(cur.evolvesFrom)) {
      seen.add(cur.evolvesFrom);
      const parent = pickBest(cur.evolvesFrom);
      if (!parent) break;
      chain.unshift(parent);
      cur = parent;
    }
    chain.push(c);
    // forwards
    cur = c;
    const seenF = new Set([c.name]);
    for (;;) {
      const kids = ix.childrenOf.get(cur.name) ?? [];
      const next = kids.map(i => cards.get(i)).filter(x => !seenF.has(x.name))
        .sort((a, b) => (b.price || 0) - (a.price || 0))[0];
      if (!next) break;
      seenF.add(next.name);
      chain.push(next);
      cur = next;
    }
    if (chain.length < 2) return [];
    const names = chain.map(x => x.name);
    return [rel("EVOLUTION_LINE",
      `${names.join(" evolves into ")}.`,
      chain.map(x => x.id),
      { line: names, length: chain.length })];
  },

  SAME_SET(c, ix) {
    const ids = (ix.bySet.get(c.set) ?? []);
    if (ids.length < 2) return [];
    return [rel("SAME_SET", `${words(ids.length)} cards from ${c.set}, ${c.year}.`, ids,
      { set: c.set, year: c.year, count: ids.length })];
  },

  SAME_YEAR(c, ix) {
    if (!c.year) return [];
    const ids = (ix.byYear.get(c.year) ?? []);
    if (ids.length < 2) return [];
    return [rel("SAME_YEAR", `${words(ids.length)} cards printed in ${c.year}.`, ids,
      { year: c.year, count: ids.length })];
  },

  SAME_TYPE(c, ix) {
    if (!c.types) return [];
    const out = [];
    for (const t of c.types) {
      const ids = ix.byType.get(t) ?? [];
      if (ids.length < 2) continue;
      out.push(rel("SAME_TYPE", `${words(ids.length)} ${t}-type cards.`, ids, { type: t, count: ids.length }));
    }
    return out;
  },

  SAME_WEAKNESS(c, ix) {
    if (!c.weakness) return [];
    const ids = ix.byWeakness.get(c.weakness) ?? [];
    if (ids.length < 2) return [];
    return [rel("SAME_WEAKNESS", `${words(ids.length)} cards weak to ${c.weakness}.`, ids,
      { weakness: c.weakness, count: ids.length })];
  },

  // The same attack name turning up in different eras.
  SHARED_ATTACK(c, ix, cards) {
    if (!c.attacks) return [];
    const out = [];
    for (const a of c.attacks) {
      const ids = (ix.byAttack.get(a.toLowerCase()) ?? []).filter(i => i !== c.id);
      if (!ids.length) continue;
      const all = [c.id, ...ids].map(i => cards.get(i)).filter(x => x.year).sort((x, y) => x.year - y.year);
      const span = all[all.length - 1].year - all[0].year;
      out.push(rel("SHARED_ATTACK",
        span > 0
          ? `${words(all.length)} cards share the attack ${a}, ${all[0].year} to ${all[all.length - 1].year}.`
          : `${words(all.length)} cards share the attack ${a}.`,
        all.map(x => x.id), { attack: a, count: all.length, span }));
    }
    return out;
  },

  DEX_NEIGHBOURS(c, ix, cards) {
    if (!c.dex) return [];
    const ids = [];
    for (const d of [c.dex - 1, c.dex + 1]) {
      const best = (ix.byDex.get(String(d)) ?? []).map(i => cards.get(i))
        .sort((a, b) => (b.price || 0) - (a.price || 0))[0];
      if (best) ids.push(best);
    }
    if (!ids.length) return [];
    const names = ids.map(x => x.name);
    return [rel("DEX_NEIGHBOURS",
      `${c.name} is number ${c.dex} in the national dex, next to ${names.join(" and ")}.`,
      [c.id, ...ids.map(x => x.id)], { dex: c.dex, neighbours: names })];
  },
};

export const RELATION_TYPES = Object.keys(RELATION_FNS);

// ── THE ENTRY POINT ────────────────────────────────────────────────────────
export async function relationsFor(cardId, opts = {}) {
  const { cards, index } = await loadCards();
  const c = cards.get(cardId);
  if (!c) throw new Error(`no card ${cardId} in the catalogue`);
  const only = opts.relation ? [opts.relation] : RELATION_TYPES;
  const out = [];
  for (const name of only) {
    const fn = RELATION_FNS[name];
    if (!fn) throw new Error(`no relation ${name}. Known: ${RELATION_TYPES.join(", ")}`);
    for (const r of fn(c, index, cards)) out.push(r);
  }
  return out;
}

// Every artist-revisit in the catalogue, widest gap first. This is the query
// behind "artists who came back", and it is the one that produced the Magmar.
export async function artistRevisits({ minGap = 1, limit = 50 } = {}) {
  const { cards, index } = await loadCards();
  const out = [];
  for (const [key, ids] of index.byArtistName) {
    if (ids.length < 2) continue;
    const all = ids.map(i => cards.get(i)).filter(x => x.year).sort((a, b) => a.year - b.year);
    if (all.length < 2) continue;
    const lo = all[0], hi = all[all.length - 1], gap = hi.year - lo.year;
    if (gap < minGap) continue;
    const [artist, name] = key.split(KEYSEP);
    out.push({
      relation: "ARTIST_REVISITS",
      reason: `${artist} illustrated both, ${yearsWord(gap)} apart.`,
      cards: [lo.id, hi.id],
      evidence: { artist, name, gap, firstYear: lo.year, latestYear: hi.year, count: all.length },
    });
  }
  out.sort((a, b) => b.evidence.gap - a.evidence.gap);
  return out.slice(0, limit);
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };
  const has = (n) => args.includes("--" + n);
  const id = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--relation" && args[args.indexOf(a) - 1] !== "--limit");
  const { cards } = await loadCards();

  if (has("revisits")) {
    const list = await artistRevisits({ minGap: Number(flag("min-gap") ?? 18), limit: Number(flag("limit") ?? 20) });
    console.log(`\n  ${list.length} artist revisit(s), widest gap first:\n`);
    for (const r of list) {
      const [a, b] = r.cards.map(i => cards.get(i));
      console.log(`  ${String(r.evidence.gap).padStart(2)}y  ${r.evidence.artist} — ${r.evidence.name}`);
      console.log(`      ${r.reason}`);
      console.log(`      ${a.id} (${a.set}, ${a.year})  →  ${b.id} (${b.set}, ${b.year})\n`);
    }
    process.exit(0);
  }

  if (!id) {
    console.log(`card-relations — why two cards belong in the same picture.

  node scripts/card-relations.mjs <cardId> [--relation NAME] [--limit N]
  node scripts/card-relations.mjs --revisits [--min-gap 18] [--limit 20]

  Relations: ${RELATION_TYPES.join(", ")}

Every relation states its reason as a FACT. That line is what a human edits into
a caption and what answers originality-guard. This never writes the caption —
the words are Tyler's.`);
    process.exit(0);
  }

  const c = cards.get(id);
  if (!c) { console.error(`  no card ${id} in the catalogue`); process.exit(1); }
  const limit = Number(flag("limit") ?? 6);
  const rs = await relationsFor(id, { relation: flag("relation") ?? undefined });
  console.log(`\n  ${c.name} · ${c.set} · ${c.year} · ${c.artist ?? "no credit recorded"}  [${c.id}]`);
  console.log(`  ${rs.length} relation(s)\n`);
  for (const r of rs) {
    console.log(`  ${r.relation}  (${r.cards.length} cards)`);
    console.log(`     ${r.reason}`);
    const show = r.cards.filter(i => i !== id).slice(0, limit);
    for (const i of show) {
      const x = cards.get(i);
      console.log(`       ${x.id.padEnd(16)} ${x.name} · ${x.set} · ${x.year} · ${x.artist ?? "—"}`);
    }
    if (r.cards.length - 1 > show.length) console.log(`       … ${r.cards.length - 1 - show.length} more`);
    console.log("");
  }
}
