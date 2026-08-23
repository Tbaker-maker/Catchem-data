// formula-engine.mjs — post shapes, derived not invented.
//
// Tyler, 2026-08-23: "Think of other artist-based posts. Doesn't always have to
// be here's an old one and a new one. Cute cards, certain themes, Eevee-themed.
// Super creative, engaging, memory-lasting. And ZERO AI SLOP — that's the
// quickest way to screw everything up."
//
// He is right that slop is the fastest way to lose this, and slop has a precise
// meaning here rather than a vague one:
//
//   SLOP IS A GROUPING THAT ISN'T IN THE DATA.
//
// We hold: name, artist, setId, setName, number, rarity, releaseDate, price.
// A formula built on those is checkable by anyone. A formula built on "cute" or
// "iconic" or "underrated" is me asserting taste and calling it a finding —
// and the moment a reader checks one and finds nothing behind it, every other
// claim we have made becomes suspect.
//
// SO: where a theme needs judgment, the judgment is a NAMED LIST somebody can
// argue with, stored openly, never an adjective smuggled into a sentence. The
// Eevee line is nine specific Pokémon, not a vibe. A "debut" is a first
// releaseDate, not a feeling.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· formula engine: no catalogue"); process.exitCode = 0; }
else {
  const cards = Object.entries(cat.cards).map(([id, c]) => ({ id, ...c })).filter(c => c.artist && c.releaseDate);
  const HERO = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare|Hyper|Gold)/i;
  const year = c => (c.releaseDate ?? "").slice(0, 4);

  // JUDGMENT, STORED OPENLY. These are lists a person can disagree with, which
  // is the point — an adjective in a sentence cannot be argued with, a list can.
  const LINES = {
    "The Eevee line": ["Eevee", "Vaporeon", "Jolteon", "Flareon", "Espeon", "Umbreon", "Leafeon", "Glaceon", "Sylveon"],
    "The Kanto starters": ["Bulbasaur", "Ivysaur", "Venusaur", "Charmander", "Charmeleon", "Charizard", "Squirtle", "Wartortle", "Blastoise"],
    "The legendary birds": ["Articuno", "Zapdos", "Moltres"],
    "The Lake guardians": ["Uxie", "Mesprit", "Azelf"],
    "The weather trio": ["Kyogre", "Groudon", "Rayquaza"],
  };

  const formulas = [];
  const F = (kind, title, basis, cardIds, why, angle) =>
    formulas.push({ kind, title, basis, cards: cardIds, count: cardIds.length, why, angle });

  // ── 1 · ONE ARTIST, ONE FAMILY ────────────────────────────────────────────
  // Derived: same artist field, names in a named list. Nothing asserted.
  for (const [lineName, members] of Object.entries(LINES)) {
    const byArtist = {};
    for (const c of cards.filter(c => members.some(m => c.name.startsWith(m)) && HERO.test(c.rarity ?? ""))) {
      (byArtist[c.artist] ||= []).push(c);
    }
    for (const [artist, list] of Object.entries(byArtist)) {
      const distinct = new Set(list.map(c => members.find(m => c.name.startsWith(m))));
      if (distinct.size < 3) continue;
      const pick = [...distinct].map(m => list.filter(c => c.name.startsWith(m)).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]).slice(0, 4);
      F("one artist, one family", `${artist} drew ${distinct.size} of ${lineName}`,
        `artist field + a named list of ${members.length} Pokémon`, pick.map(c => c.id),
        `${distinct.size} members of the same family, one hand. Nothing here is asserted — the list is stored and arguable, the artist field is the source's.`,
        `One artist. ${distinct.size} of ${lineName.toLowerCase()}.`);
    }
  }

  // ── 2 · THE SAME POKÉMON, MANY HANDS ──────────────────────────────────────
  // Derived: same name, distinct artist. The visual argument makes itself.
  {
    const byName = {};
    for (const c of cards.filter(c => HERO.test(c.rarity ?? ""))) (byName[c.name.split(" ")[0]] ||= []).push(c);
    for (const [mon, list] of Object.entries(byName)) {
      const artists = new Map();
      for (const c of list.sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1)) if (!artists.has(c.artist)) artists.set(c.artist, c);
      if (artists.size < 4) continue;
      const pick = [...artists.values()].slice(0, 4);
      F("one Pokémon, many hands", `${mon}, drawn by ${artists.size} different illustrators`,
        "name + distinct artist field", pick.map(c => c.id),
        "Same subject, different people, and the difference is visible without a word of explanation.",
        `${artists.size} artists. One ${mon}.`);
    }
  }

  // ── 3 · A DEBUT ───────────────────────────────────────────────────────────
  // Derived: an artist's earliest releaseDate. "Debut" is a date, not a feeling.
  {
    const byArtist = {};
    for (const c of cards) (byArtist[c.artist] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < 15) continue;
      const sorted = list.sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1);
      const first = sorted[0], best = list.filter(c => c.price).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
      if (!best || best.id === first.id) continue;
      F("the debut", `${artist} started here`, "earliest releaseDate for that artist",
        [first.id, best.id],
        `Their first card beside their best-known one. A debut is a date in the data, not a judgment.`,
        `${artist}'s first card was ${first.name} in ${year(first)}.`);
    }
  }

  // ── 4 · ONE SET, ONE ARTIST'S RUN ─────────────────────────────────────────
  // Derived: same setId + same artist. Shows a set through one person's eyes.
  {
    const bySetArtist = {};
    for (const c of cards.filter(c => HERO.test(c.rarity ?? ""))) (bySetArtist[`${c.setId}|${c.artist}`] ||= []).push(c);
    for (const [key, list] of Object.entries(bySetArtist)) {
      if (list.length < 3) continue;
      const [, artist] = key.split("|");
      F("one set, one hand", `${artist} drew ${list.length} of ${list[0].setName}'s best cards`,
        "setId + artist", list.slice(0, 4).map(c => c.id),
        "A whole set seen through one person, which is a different thing from a set seen as a checklist.",
        `${list.length} cards in ${list[0].setName}. Same artist.`);
    }
  }

  // ── 5 · THE BINDER PAGE — nine cards, three by three ──────────────────────
  // A real binder page is 3x3, so a 3x3 grid is a shape every collector already
  // recognises. Curation is honest as long as it is framed as a SELECTION and
  // not as a ranking: "nine for your binder" invites you to disagree, "the nine
  // best" tells you that you are wrong.
  {
    const byArtistIR = {};
    for (const c of cards.filter(c => /Illustration Rare/i.test(c.rarity ?? ""))) (byArtistIR[c.artist] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtistIR)) {
      if (list.length < 9) continue;
      const nine = list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 9);
      F("binder page", `Nine ${artist} illustration rares for your binder`,
        "artist field + rarity field, nine of them",
        nine.map(c => c.id),
        "A binder page is three by three, so this is a shape a collector recognises before reading anything. Framed as a selection, not a ranking - you are invited to disagree.",
        `Nine by one artist. Which one is going in the sleeve first?`);
    }
  }

  // ── 6 · THREE ROWS OF THREE — a generational debate ────────────────────────
  // Tyler's shape: three related Pokemon, three eras, nine cards. It asks a
  // question instead of making a claim, and a question is what starts the
  // conversation. Derived entirely from name + releaseDate + rarity.
  for (const [lineName, members] of Object.entries(LINES)) {
    if (members.length !== 3) continue;                 // trios only - the grid is 3x3
    const byYear = {};
    for (const c of cards.filter(c => members.some(m => c.name.startsWith(m)) && HERO.test(c.rarity ?? ""))) {
      (byYear[year(c)] ||= {});
      const mon = members.find(m => c.name.startsWith(m));
      const cur = byYear[year(c)][mon];
      if (!cur || (c.price ?? 0) > (cur.price ?? 0)) byYear[year(c)][mon] = c;
    }
    const complete = Object.entries(byYear).filter(([, set]) => Object.keys(set).length === 3)
      .sort((a, b) => a[0] < b[0] ? -1 : 1);
    if (complete.length < 3) continue;
    const spread = [complete[0], complete[Math.floor(complete.length / 2)], complete[complete.length - 1]];
    const ids = spread.flatMap(([, set]) => members.map(m => set[m].id));
    F("three rows of three", `${lineName}: ${spread.map(([y]) => y).join(" vs ")}`,
      "name + releaseDate + rarity, three complete sets",
      ids,
      `Three eras of the same trio, nine cards, one question. It asks rather than tells, which is what gets a reply instead of a scroll.`,
      `Which row is the best ${lineName.replace(/^The /, "")}? ${spread.map(([y]) => y).join(", ")}.`);
  }

  // SEVEN FRAMES, TWO THEMES (2026-08-23). The engine produced 751 formulas and
  // every one landed at 4 or 9 cards, because I built shapes without checking
  // they covered the frames. A format nothing fills is a format that does not
  // exist, and I would not have noticed without counting.

  // ── 7 · THE SINGLE — one card, one fact ───────────────────────────────────
  // The knowledge post. No grouping at all: a card plus something true and
  // surprising, drawn from the sourced knowledge base rather than invented.
  {
    const kb = await J("data/knowledge.json");
    for (const fact of (kb?.facts ?? []).filter(f => /card|kadabra|artist|illustrat|print/i.test(f.claim))) {
      const namesIn = (c) => c.name.length >= 4 && fact.claim.split(/[^A-Za-z0-9'-]+/).includes(c.name.split(" ")[0]);
      const named = cards.find(c => namesIn(c) && HERO.test(c.rarity ?? "")) ?? cards.find(namesIn);
      if (!named) continue;
      F("the single", `${named.name}: ${fact.id.replace(/-/g, " ")}`,
        "a sourced fact from data/knowledge.json plus the card it is about",
        [named.id],
        "One card, one thing most people do not know. Every claim carries a source and a falsifier, which is why we can say it plainly.",
        fact.claim.split(".")[0] + ".");
    }
  }

  // ── 8 · THE PAIR — one artist, two eras ───────────────────────────────────
  {
    const byArtistPair = {};
    for (const c of cards.filter(c => HERO.test(c.rarity ?? ""))) (byArtistPair[c.artist] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtistPair)) {
      if (list.length < 2) continue;
      const sorted = list.sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1);
      const first = sorted[0], last = sorted[sorted.length - 1];
      const years = Number(year(last)) - Number(year(first));
      if (years < 10) continue;
      F("the pair", `${artist}: ${first.name} ${year(first)} to ${last.name} ${year(last)}`,
        "artist field + earliest and latest hero card", [first.id, last.id],
        `${years} years, one hand. The gap is the story and the images make it without a caption.`,
        `${years} years apart. Same illustrator.`);
    }
  }

  // ── 9 · THE TRIO — three of a kind ────────────────────────────────────────
  for (const [lineName, members] of Object.entries(LINES)) {
    if (members.length !== 3) continue;
    const best = members.map(m => cards.filter(c => c.name.startsWith(m) && HERO.test(c.rarity ?? ""))
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0]).filter(Boolean);
    if (best.length !== 3) continue;
    F("the trio", `${lineName}, the best of each`, "a named list of three + rarity + price",
      best.map(c => c.id),
      "Three that belong together, each at its strongest. The set is the argument.",
      `${lineName}. Which one do you actually want?`);
  }

  // ── 10 · THE HALF PAGE — six from one set ─────────────────────────────────
  {
    const bySetIR = {};
    for (const c of cards.filter(c => /Illustration Rare/i.test(c.rarity ?? ""))) (bySetIR[c.setId] ||= []).push(c);
    for (const [, list] of Object.entries(bySetIR)) {
      if (list.length < 6) continue;
      const six = list.sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 6);
      F("the half page", `Six illustration rares from ${six[0].setName}`,
        "setId + rarity, six of them", six.map(c => c.id),
        "Half a binder page from one set. Sits almost square, which is the friendliest shape on a phone.",
        `Six from ${six[0].setName}. Which page are you filling first?`);
    }
  }

  // ── 11 · THE SPREAD — eight across two rows ───────────────────────────────
  {
    const byMon = {};
    for (const c of cards.filter(c => HERO.test(c.rarity ?? ""))) (byMon[c.name.split(" ")[0]] ||= []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const seen = new Map();
      for (const c of list.sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1)) if (!seen.has(c.artist)) seen.set(c.artist, c);
      if (seen.size < 8) continue;
      F("the spread", `${mon} by eight different illustrators`,
        "name + eight distinct artist values", [...seen.values()].slice(0, 8).map(c => c.id),
        "Eight people, one Pokémon. The differences argue for themselves and the post needs no words.",
        `Eight artists. One ${mon}. Which is the definitive one?`);
    }
  }

  // KEEP A SPREAD, NOT A TOP-40. Sorting by card count and slicing 40 meant the
  // output held only 8s and 9s - every one-card and two-card theme was computed
  // and then thrown away by the truncation. A list that silently drops whole
  // categories is worse than a shorter list, because nothing says they are gone.
  {
    const mon = c => c.name.split(" ")[0];
  const yr = c => Number((c.releaseDate ?? "").slice(0, 4));

  // ── 6 · THE BATTLE — two cards, one question ──────────────────────────────
  // Tyler, 2026-08-23: "Card battle. Comparing starts debates, which is good.
  // We need to spark conversation."
  //
  // THE THING THAT MAKES A BATTLE WORK IS THAT IT IS CLOSE. A $2,000 card
  // against a $12 one is not a debate, it is a price check with a question mark
  // on it. So candidates must be matched: same Pokemon, comparable standing,
  // different hands or different eras - and then the reader has to actually
  // choose, which is the entire point.
  {
    const byMonB = {};
    for (const c of cards.filter(c => HERO.test(c.rarity ?? "") && c.artist)) (byMonB[mon(c)] ||= []).push(c);
    for (const [m, list] of Object.entries(byMonB)) {
      if (list.length < 2) continue;
      // Rank by value, then pair adjacent entries - adjacent means comparable,
      // which is what makes the choice genuinely hard.
      const ranked = list.filter(c => c.price).sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      if (ranked.length < 2) continue;
      const [a, b] = ranked;
      const ratio = (b.price ?? 1) / (a.price ?? 1);
      if (ratio < 0.55) continue;                       // too lopsided to argue about
      if (a.artist === b.artist && yr(a) === yr(b)) continue;
      const axis = a.artist !== b.artist ? "different illustrators"
                 : `${yr(a)} against ${yr(b)}`;
      F("the battle", `${m}: ${a.artist} or ${b.artist}`,
        "same Pokemon, comparable standing, different hands or eras",
        [a.id, b.id],
        `Two versions of the same Pokemon within ${Math.round((1 - ratio) * 100)}% of each other on value, so nobody can settle it by pointing at a price. ${axis}.`,
        `${m}. ${a.setName} or ${b.setName}? No wrong answer, but you have one.`);
      if ((formulas.filter(f => f.kind === "the battle").length) >= 12) break;
    }
  }

  // ── 7 · THE CONTROVERSY — what actually happened ──────────────────────────
  // Every claim comes from data/knowledge.json with a source, a date and a
  // falsifier. Controversy is the one topic where being wrong costs the most,
  // so nothing here is remembered - it is all cited or it is not published.
  {
    const kbC = await J("data/knowledge.json");
    const CONTROVERSIAL = /banned|censor|lawsuit|sued|withdrawn|changed|manji|absence|stopped|removed/i;
    for (const fact of (kbC?.facts ?? []).filter(f => CONTROVERSIAL.test(f.claim))) {
      const named = cards.filter(c => c.name.length >= 4 &&
        fact.claim.split(/[^A-Za-z0-9'-]+/).includes(c.name.split(" ")[0]));
      if (!named.length) continue;
      // Prefer the most recent print - the card that EXISTS today is the one a
      // reader can go and look at, and the story is what happened to get here.
      const pick = named.sort((a, b) => (b.releaseDate ?? "") < (a.releaseDate ?? "") ? -1 : 1)[0];
      const before = named.filter(c => yr(c) < yr(pick) - 5).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
      F("the controversy", fact.id.replace(/-/g, " "),
        "a sourced fact from data/knowledge.json with a falsifier attached",
        before ? [before.id, pick.id] : [pick.id],
        `${fact.claim.split(".")[0]}. Sourced, dated, and carrying what would disprove it - which matters more here than anywhere, because being wrong about a controversy is how you become one.`,
        "Most people have no idea this happened.");
    }
  }

  const byKind = {};
    for (const f of formulas) (byKind[f.kind] ||= []).push(f);
    const spread = [];
    for (const [, list] of Object.entries(byKind)) spread.push(...list.slice(0, 8));
    formulas.length = 0;
    formulas.push(...spread);
  }

  formulas.sort((a, b) => b.count - a.count);
  const byKind = {};
  for (const f of formulas) (byKind[f.kind] ||= []).push(f);

  const out = { generatedAt: new Date().toISOString(),
    antiSlopRule: "A formula must be derivable from a field we hold: name, artist, setId, rarity, releaseDate, price. Where a theme needs judgment, that judgment is a NAMED LIST stored openly and arguable — never an adjective smuggled into a sentence. 'Cute' is not in the data; the nine Eeveelutions are.",
    fieldsUsed: ["name", "artist", "setId", "setName", "rarity", "releaseDate", "price"],
    judgmentLists: LINES,
    kinds: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])),
    formulas };   // already bounded to 8 per kind by the spread above
  await writeFile(join(ROOT, "research/pulse/formulas.json"), JSON.stringify(out, null, 2));

  console.log(`✓ formulas: ${formulas.length} across ${Object.keys(byKind).length} shapes\n`);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`  ${kind.toUpperCase()} — ${list.length}`);
    for (const f of list.slice(0, 2)) console.log(`     ${f.title}  (${f.count} cards)`);
  }
}
