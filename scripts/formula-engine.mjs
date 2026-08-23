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

  formulas.sort((a, b) => b.count - a.count);
  const byKind = {};
  for (const f of formulas) (byKind[f.kind] ||= []).push(f);

  const out = { generatedAt: new Date().toISOString(),
    antiSlopRule: "A formula must be derivable from a field we hold: name, artist, setId, rarity, releaseDate, price. Where a theme needs judgment, that judgment is a NAMED LIST stored openly and arguable — never an adjective smuggled into a sentence. 'Cute' is not in the data; the nine Eeveelutions are.",
    fieldsUsed: ["name", "artist", "setId", "setName", "rarity", "releaseDate", "price"],
    judgmentLists: LINES,
    kinds: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])),
    formulas: formulas.slice(0, 40) };
  await writeFile(join(ROOT, "research/pulse/formulas.json"), JSON.stringify(out, null, 2));

  console.log(`✓ formulas: ${formulas.length} across ${Object.keys(byKind).length} shapes\n`);
  for (const [kind, list] of Object.entries(byKind)) {
    console.log(`  ${kind.toUpperCase()} — ${list.length}`);
    for (const f of list.slice(0, 2)) console.log(`     ${f.title}  (${f.count} cards)`);
  }
}
