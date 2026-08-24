// build-numbers.mjs — the posts only we can make.
//
// Tyler, 2026-08-24: "Seeing there is 63 Charizard cards, we could ask — is that
// really too many for being over 16,000? We can pull data from cards like this
// where no one else would even think to talk about."
//
// **This is the strongest content idea in the session**, and the reason is
// structural: every other account in the set posts what they OWN or what they
// THINK. Nobody posts what the catalogue KNOWS, because nobody else has counted
// it. Serebii reports news, shotgun reports his collection, Crambo reports
// openings. A number computed across 16,468 cards is a thing none of them can
// produce.
//
// AND IT IS A PERMISSION QUESTION BY CONSTRUCTION. "63 Charizards out of 16,468
// — too many?" states a fact and asks an opinion, so there is nothing to
// correct and everything to argue with. That is the mechanic under every
// high-reply post we studied, arrived at from a different direction.
//
// THE RULE THAT KEEPS IT HONEST: every number here is COUNTED, not estimated,
// and the question is always the opinion half. We supply the fact; the reader
// supplies the verdict. A post that asserts what the number MEANS is the slop
// law all over again.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const idx = await J("research/assets/card-index.json") ?? [];
const attrs = (await J("data/card-attrs.json"))?.cards ?? {};

// THE PREFIX BUG, THIRD APPEARANCE. Splitting on the first word made "Team",
// "Galarian" and "Mega" the most-printed Pokemon in the catalogue — and this
// script would have PUBLISHED that, in a post whose entire point is the numbers
// being right. Form and owner prefixes are not creatures.
const FORM = new RegExp("^(Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Team Rocket's|Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega)\\s+", "i");
const MECH = new RegExp("\\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X|-EX|-GX)$");
// Not creatures. A count that includes these is a count of card TYPES, and the
// post claims to be counting Pokémon.
const NOT_A_MON = /^(Energy|Pokémon|Pokemon|Trainer|Item|Supporter|Stadium|Tool|Professor|Team|Tapu|Iron|Great|Roaring|Slither|Scream|Brute|Flutter|Sandy|Walking|Gouging|Raging)$/i;
const mon = (n) => { let x = String(n); for (let i = 0; i < 2; i++) x = x.replace(FORM, ""); return x.replace(MECH, "").trim().split(" ")[0]; };

// A NAME LIST IS NOT A POKEMON LIST. Counting by name gave 398 "Pokemon with
// one card" including Cool, Gambler, Digger and Goop — all Trainers. The field
// that actually decides is the national dex number: no dex, not a Pokemon. A
// keyword blocklist would have needed extending forever; this one is correct by
// construction.
const counts = {};
for (const c of idx) {
  if (!attrs[c.i]?.dex) continue;
  const m = mon(c.n);
  if (m && !NOT_A_MON.test(m)) counts[m] = (counts[m] ?? 0) + 1;
}
const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
const total = idx.length;
const distinct = ranked.length;
const once = ranked.filter(([, c]) => c === 1).length;
const n = (x) => x.toLocaleString("en-US");

// Each of these states a COUNTED fact and asks for the verdict. None asserts
// what the number means.
const posts = [];
const top = ranked[0], zard = ["Charizard", counts.Charizard ?? 0];

posts.push({ id: "printing-share",
  text: `${zard[0]} has ${zard[1]} cards.\n\n${n(once)} Pokémon have exactly one.\n\nOut of ${n(total)} English cards. Too many, or about right?`,
  why: "Counted across the whole catalogue. The comparison is the post.",
  cards: idx.filter(c => mon(c.n) === zard[0] && /Illustration Rare/i.test(c.r ?? "")).slice(0, 2).map(c => c.i) });

posts.push({ id: "the-average",
  text: `${n(total)} English cards. ${n(distinct)} different Pokémon and forms.\n\nThat's ${(total / distinct).toFixed(1)} cards each on average.\n\n${top[0]} has ${top[1]}. Fair?`,
  why: "An average nobody has computed, and a leader most people would guess wrong.",
  cards: [] });

posts.push({ id: "the-forgotten",
  text: `${n(once)} Pokémon have exactly one card across every English set we track.\n\nName one you think deserves more.`,
  why: "A permission question by construction — obscure is the only possible answer.",
  cards: [] });

// Artists, a beat literally nobody covers.
// INDIVIDUALS ONLY. "5ban Graphics" is a studio with 1,386 credits, and a post
// asking how many ARTISTS you could name is finished the moment somebody points
// that out.
const STUDIO = /graphics|studio|inc\.|creatures|design|imakuni/i;
const byArtist = {};
for (const c of idx) if (c.a && !STUDIO.test(c.a)) byArtist[c.a] = (byArtist[c.a] ?? 0) + 1;
const artists = Object.entries(byArtist).sort((a, b) => b[1] - a[1]);
posts.push({ id: "the-artists",
  text: `${n(artists.length)} different people have drawn a Pokémon card.\n\nThe most prolific has ${artists[0][1]}: ${artists[0][0]}.\n\nHow many could you name?`,
  why: "Counted, and studios excluded — 5ban Graphics has 1,386 credits and is not a person. The honest answer for almost everyone is one or two, which is the reply.",
  cards: [] });

// Types, using the real field rather than a hand-written list.
const byType = {};
for (const c of idx) for (const t of (attrs[c.i]?.t ?? [])) byType[t] = (byType[t] ?? 0) + 1;
const types = Object.entries(byType).sort((a, b) => b[1] - a[1]);
if (types.length >= 2) posts.push({ id: "type-share",
  text: `Most-printed type across every English card: ${types[0][0]}, ${n(types[0][1])} cards.\n\nRarest: ${types[types.length - 1][0]}, ${n(types[types.length - 1][1])}.\n\nSurprised?`,
  why: "From the printed type field, not video-game typing — those differ, and the difference has already caught us once.",
  cards: [] });

await writeFile(join(ROOT, "research/pulse/numbers-posts.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "Posts only we can make, because only we have counted. Every number is COUNTED not estimated, and the question is always the opinion half — we supply the fact, the reader supplies the verdict. A post that asserts what a number MEANS is the slop law again.",
  basis: { total, distinct, onlyOneCard: once, artists: artists.length },
  posts }, null, 1));

console.log(`✓ numbers: ${posts.length} posts, every figure counted across ${n(total)} cards\n`);
for (const p of posts) {
  console.log(p.text.split("\n").filter(Boolean).map(l => "  " + l).join("\n"));
  console.log(`     ${p.why}\n`);
}
