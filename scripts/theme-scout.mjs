// theme-scout.mjs — find the posts nobody thought to look for.
//
// Tyler, 2026-08-23: "Get agents working on this as well, don't do it all
// yourself — they will see stuff you won't."
//
// He is right and it is the obvious thing I was not doing. Every theme in
// data/themes.json came from me eyeballing the catalogue and remembering what a
// Pokémon fan knows. That finds the famous patterns and misses the odd ones,
// because I am searching my memory rather than the data.
//
// This searches the DATA. 16,468 cards, 380 illustrators, 174 sets — and it
// looks for statistical oddities that make a post by themselves:
//   an illustrator who drew a Pokémon exactly once and never again
//   a Pokémon that vanished for a decade and came back
//   an artist whose entire output is one Pokémon
//   a year where one illustrator was everywhere
//
// IT PROPOSES, IT DOES NOT DECIDE. A named list is a judgment and judgments go
// in data/themes.json where a person can argue with them. An agent that adds
// its own taste to that file would be asserting significance, which is the one
// thing the slop law exists to stop.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· theme scout: no catalogue"); process.exitCode = 0; }
else {
  const cards = Object.entries(cat.cards).map(([id, c]) => ({ id, ...c })).filter(c => c.releaseDate && c.supertype === "Pokémon");
  const HERO = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare)/i;
  const yr = c => Number((c.releaseDate ?? "").slice(0, 4));
  const mon = c => c.name.split(" ")[0];

  const finds = [];
  const F = (kind, headline, hook, cardIds, basis, why) =>
    finds.push({ kind, headline, hook, cards: cardIds, count: cardIds.length, basis, why, chip: "READ" });

  // ── 1 · THE ONE-OFF ───────────────────────────────────────────────────────
  // An illustrator with a large body of work who drew a given Pokémon exactly
  // once. Single card, and the fact is the whole post.
  {
    const byArtist = {};
    for (const c of cards.filter(c => c.artist)) (byArtist[c.artist] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < 40) continue;                 // a prolific artist, so "once" means something
      const counts = {};
      for (const c of list) counts[mon(c)] = (counts[mon(c)] ?? 0) + 1;
      const onceOnly = list.filter(c => counts[mon(c)] === 1 && HERO.test(c.rarity ?? "") && (c.price ?? 0) > 30);
      for (const c of onceOnly.slice(0, 2))
        F("the one-off", `${artist} drew ${mon(c)} exactly once`,
          `${artist} has ${list.length} cards. Exactly one is a ${mon(c)}.`,
          [c.id], "artist field + count of that Pokémon in their output",
          "A single card carrying a fact nobody would guess and anybody can check.");
    }
  }

  // ── 2 · THE LONG SILENCE ──────────────────────────────────────────────────
  // A Pokémon absent from print for years and then back. Kadabra's twenty-one
  // years was found by hand; this finds the rest.
  {
    const byMon = {};
    for (const c of cards) (byMon[mon(c)] ||= []).push(c);
    for (const [m, list] of Object.entries(byMon)) {
      if (list.length < 4) continue;
      const years = [...new Set(list.map(yr))].sort((a, b) => a - b);
      let gap = 0, from = 0, to = 0;
      for (let i = 1; i < years.length; i++)
        if (years[i] - years[i - 1] > gap) { gap = years[i] - years[i - 1]; from = years[i - 1]; to = years[i]; }
      if (gap < 7) continue;
      const before = list.filter(c => yr(c) === from).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
      const after = list.filter(c => yr(c) === to).sort((a, b) => (b.price ?? 0) - (a.price ?? 0))[0];
      if (!before || !after) continue;
      F("the long silence", `${m} disappeared for ${gap} years`,
        `${m} was printed in ${from}, then not again until ${to}.`,
        [before.id, after.id], "every print year for that Pokémon in our catalogue",
        "A gap in the data is a question waiting for somebody who knows the answer — which is exactly the kind of post that gets replies.");
    }
  }

  // ── 3 · THE SPECIALIST ────────────────────────────────────────────────────
  // An illustrator whose output is dominated by one Pokémon.
  {
    const byArtist = {};
    for (const c of cards.filter(c => c.artist)) (byArtist[c.artist] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < 12) continue;
      const counts = {};
      for (const c of list) counts[mon(c)] = (counts[mon(c)] ?? 0) + 1;
      const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (n / list.length < 0.3 || n < 5) continue;
      const best = list.filter(c => mon(c) === top).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 4);
      F("the specialist", `${artist} keeps coming back to ${top}`,
        `${n} of ${artist}'s ${list.length} cards are ${top}.`,
        best.map(c => c.id), "artist field + share of their output by Pokémon",
        "Somebody chose to draw the same creature over and over. That is a person, not a statistic.");
    }
  }

  // ── 4 · THE YEAR THEY WERE EVERYWHERE ─────────────────────────────────────
  {
    const byYear = {};
    for (const c of cards.filter(c => c.artist && HERO.test(c.rarity ?? ""))) (byYear[yr(c)] ||= []).push(c);
    for (const [year, list] of Object.entries(byYear)) {
      if (list.length < 30) continue;
      const counts = {};
      for (const c of list) counts[c.artist] = (counts[c.artist] ?? 0) + 1;
      const [artist, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (n / list.length < 0.15) continue;
      const best = list.filter(c => c.artist === artist).sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).slice(0, 4);
      F("the year they owned", `${year} belonged to ${artist}`,
        `${artist} drew ${n} of the ${list.length} best cards printed in ${year}.`,
        best.map(c => c.id), "releaseDate + artist share of hero cards that year",
        "One person's fingerprints across a whole year of a set list.");
    }
  }

  // ── 5 · CANDIDATE THEMES — proposed, never adopted ────────────────────────
  // Name clusters that MIGHT be a theme. It says what it found and leaves the
  // judgment to a person, because deciding that a group of Pokémon belongs
  // together is taste, and taste belongs in a file somebody signs.
  {
    const existing = new Set(((await J("data/themes.json"))?.themes ?? []).flatMap(t => t.members ?? []));
    const SUFFIXES = { "-eon": /eon$/, "ite": /ite$/, "-ish": /ish$/, "-uff": /uff$/ };
    for (const [label, rx] of Object.entries(SUFFIXES)) {
      const hits = [...new Set(cards.filter(c => rx.test(mon(c))).map(mon))].filter(m => !existing.has(m));
      if (hits.length >= 5)
        finds.push({ kind: "candidate theme", headline: `${hits.length} Pokémon share the "${label}" ending`,
          hook: null, cards: [], count: 0, basis: "name pattern across the catalogue",
          why: `Proposed, not adopted: ${hits.slice(0, 10).join(", ")}. Whether that is a THEME or a coincidence of Japanese naming is a judgment, and judgments go in data/themes.json where somebody can argue with them.`,
          needsHuman: true, chip: "READ" });
    }
  }

  const byKind = {};
  for (const f of finds) (byKind[f.kind] ||= []).push(f);
  const spread = Object.values(byKind).flatMap(l => l.slice(0, 6));

  await writeFile(join(ROOT, "research/pulse/theme-scout.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    searched: `${cards.length} cards, ${new Set(cards.map(c => c.artist).filter(Boolean)).size} illustrators, ${new Set(cards.map(c => c.setId)).size} sets`,
    principle: "Searches the DATA rather than my memory of what a Pokémon fan knows. Memory finds the famous patterns and misses the odd ones.",
    proposesOnly: "Candidate themes are proposed and never adopted. Deciding a group belongs together is taste, and taste goes in a file a person signs.",
    kinds: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.length])),
    finds: spread }, null, 2));

  console.log(`✓ theme scout: ${finds.length} find(s) across ${Object.keys(byKind).length} kinds\n`);
  for (const [k, list] of Object.entries(byKind)) {
    console.log(`  ${k.toUpperCase()} — ${list.length}`);
    for (const f of list.slice(0, 2)) console.log(`     ${f.headline}`);
  }
}
