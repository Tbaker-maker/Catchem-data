// pairing-finder.mjs — more of what worked.
//
// On 2026-08-23 one art post landed after five that did not. It was Base Set
// Charizard beside the 151 Blastoise ex, same illustrator, twenty-four years
// apart, and Tyler's copy was two conversational lines with no numbers in them.
//
// That post is the specification. This finds more like it, scored against what
// made THAT one work rather than against what is easy to compute — because
// picking the easy thing is exactly how the Keldeo version happened.
//
// THE INGREDIENTS, in order of how much they mattered:
//  1. BOTH CARDS MUST BE WANTED. Two hero cards. A hero beside a common is the
//     Keldeo mistake, and it is the one that makes a post underwhelming rather
//     than wrong.
//  2. A GAP LONG ENOUGH TO SURPRISE. Twenty-four years is the story. Two years
//     is a coincidence.
//  3. A SUBJECT PEOPLE ALREADY LOVE. Charizard and Blastoise need no
//     introduction; an obscure Pokémon needs a paragraph, and a paragraph is
//     what an image post exists to avoid.
//  4. ONE HUMAN BEHIND BOTH. The whole hook is that a person did this twice,
//     decades apart, and somebody let them.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· pairing finder: no catalogue"); process.exitCode = 0; }
else {
  // Pokémon a reader recognises without being told. Deliberately short — the
  // test is "needs no introduction", and a long list means the list is wrong.
  const HOUSEHOLD = /^(Charizard|Blastoise|Venusaur|Pikachu|Mewtwo|Mew|Eevee|Umbreon|Espeon|Sylveon|Vaporeon|Jolteon|Flareon|Snorlax|Gengar|Dragonite|Gyarados|Lugia|Ho-Oh|Rayquaza|Lucario|Greninja|Garchomp|Tyranitar|Alakazam|Machamp|Arcanine|Articuno|Zapdos|Moltres)\b/i;
  // Rarities that signal "this is the good one" at a glance.
  const HERO = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare|Hyper|Gold)/i;

  const byArtist = {};
  for (const [id, c] of Object.entries(cat.cards)) {
    if (!c.artist || !c.releaseDate) continue;
    (byArtist[c.artist] ||= []).push({ id, ...c });
  }

  const pairings = [];
  for (const [artist, cards] of Object.entries(byArtist)) {
    const strong = cards.filter(c => HERO.test(c.rarity ?? "") && HOUSEHOLD.test(c.name));
    if (strong.length < 2) continue;
    strong.sort((a, b) => a.releaseDate < b.releaseDate ? -1 : 1);
    const first = strong[0], last = strong[strong.length - 1];
    const years = Number(last.releaseDate.slice(0, 4)) - Number(first.releaseDate.slice(0, 4));
    if (years < 8) continue;                      // a gap under eight years is not a story

    // Score for what made the winner land, not for what is easy to measure.
    let score = 0; const because = [];
    score += Math.min(years * 2, 60); because.push(`${years} years apart`);
    if (HOUSEHOLD.test(first.name) && HOUSEHOLD.test(last.name)) { score += 25; because.push("both are Pokémon nobody needs introduced"); }
    const bothHero = HERO.test(first.rarity ?? "") && HERO.test(last.rarity ?? "");
    if (bothHero) { score += 20; because.push("both are the good version, not a common"); }
    if (first.name === last.name) { score += 30; because.push(`the SAME Pokémon twice — you can watch the style change`); }
    const worth = (first.price ?? 0) + (last.price ?? 0);
    if (worth > 200) { score += 10; because.push("cards people actually chase"); }

    pairings.push({ artist, score, years,
      first: { id: first.id, name: first.name, set: first.setName, year: first.releaseDate.slice(0, 4), rarity: first.rarity },
      last: { id: last.id, name: last.name, set: last.setName, year: last.releaseDate.slice(0, 4), rarity: last.rarity },
      because,
      command: `node scripts/card-composite.mjs ${first.id} ${last.id} --label "..."` });
  }

  pairings.sort((a, b) => b.score - a.score);
  const out = { generatedAt: new Date().toISOString(),
    specification: "Modelled on the one art post that landed: Base Set Charizard beside 151 Blastoise ex, same illustrator, 24 years, both hero cards, both household Pokémon.",
    whatItIsNot: "Not scored by recency, which is what produced a common card and an underwhelming post. Latest is a data choice; this scores the editorial one.",
    found: pairings.length, pairings: pairings.slice(0, 12) };
  await writeFile(join(ROOT, "research/pulse/pairings.json"), JSON.stringify(out, null, 2));

  console.log(`✓ pairings: ${pairings.length} candidate(s) scored against the post that worked\n`);
  for (const p of pairings.slice(0, 6))
    console.log(`  ${String(p.score).padStart(3)}  ${p.artist.padEnd(20)} ${p.first.name} ${p.first.year} → ${p.last.name} ${p.last.year}\n       ${p.because.join(" · ")}`);
}
