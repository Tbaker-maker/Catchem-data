// build-mood.mjs — post from how you feel.
//
// Tyler, 2026-08-23: "A function where you make a post based on your mood, and
// it pairs the best Pokemon card with that. That's how we found the cards that
// went with my long coding, and the good morning sunflower. The posts hit hard
// and I was just basing it off how I felt in the moment."
//
// THIS IS THE ONLY FEATURE BUILT DIRECTLY ON EVIDENCE. All three posts that
// worked started from a mood, not a formula — and the 84 formulas we generate
// were used by none of them.
//
// THE THING THAT MAKES IT HONEST: it matches the WORDS PRINTED ON THE CARD, not
// my opinion of how a card feels. Slakoth's attack is literally "Take It Easy".
// Sunflora's flavour text says it always faces the sun. Slowpoke's attack is
// "Rest". I did not decide any of that — the card did, and I would have been
// guessing without 13,917 cards of captured text.
//
// A mood theme built on my assertions would be slop by our own rule. Built on
// what the card says, every match is checkable by looking at the card.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const idx = await J("research/assets/card-index.json") ?? [];
const text = (await J("data/card-text.json"))?.cards ?? {};

// MOODS AS WORD SETS, not as my taste. Each is a list of words that would
// appear on a card, and a card matches when ITS OWN TEXT contains them — so
// every match can be checked by reading the card.
const MOODS = [
  { id: "tired", label: "Wiped out", emoji: "😴",
    words: ["take it easy","rest","sleep","slumber","nap","doze","drowsy","yawn","lazy","slack off","snooze","sluggish","tired"],
    say: "Late night. Long day. Nothing left in the tank." },
  { id: "bright", label: "Good morning", emoji: "🌅",
    words: ["sunlight","sunny","sunrise","morning","dawn","daybreak","bright","shine","glow","solar","light"],
    say: "Fresh start energy." },
  { id: "locked-in", label: "Locked in", emoji: "🎯",
    words: ["focus","concentrate","calculate","strategy","determination","resolve","single-minded","relentless","never give up","steadfast"],
    say: "Deep in it and not looking up." },
  { id: "wired", label: "Wired", emoji: "⚡",
    words: ["thunder","shock","spark","charge","volt","electro","jolt","zap","overdrive","adrenaline","rush"],
    say: "Too much coffee and no plans to stop." },
  { id: "fed-up", label: "Fed up", emoji: "😤",
    words: ["rage","outrage","fury","anger","tantrum","thrash","frustration","payback","revenge","grudge","spite"],
    say: "Not in the mood today." },
  { id: "calm", label: "Calm", emoji: "🌊",
    words: ["calm","gentle","soothe","peaceful","quiet","serene","healing","refresh","tranquil","soft","tender"],
    say: "Everything is fine and I'm going to keep it that way." },
  { id: "hungry", label: "Hungry", emoji: "🍽",
    words: ["gobble","devour","chew","munch","feast","swallow","sweet","berry","harvest","stuff cheeks","appetite","hungry","nibble"],
    say: "Thinking about food and nothing else." },
  { id: "overthinking", label: "Overthinking", emoji: "🌀",
    words: ["overthink","confuse","psych","dream","daze","overthink","worry","anxious","restless mind","illusion","daydream"],
    say: "Brain will not switch off." },
  { id: "unbothered", label: "Unbothered", emoji: "😌",
    words: ["float","drift","wander","stroll","glide","carefree","stretch","lounge","idle","roam"],
    say: "Genuinely could not tell you what day it is." },
  { id: "cold", label: "Freezing", emoji: "🥶",
    words: ["freeze","frost","ice","blizzard","chill","snow","cold","hail","glacier","icicle"],
    say: "It is too cold for this." },
  { id: "showing-off", label: "Feeling myself", emoji: "💅",
    words: ["dazzle","glamour","charm","attract","beauty","elegant","graceful","flair","captivate","dance","pose","sparkle"],
    say: "Having a good day and everybody's going to hear about it." },
  { id: "nostalgic", label: "Nostalgic", emoji: "📼",
    words: ["memory","remember","ancient","past","old","childhood","return","reunion","echo","legacy"],
    say: "Thinking about when this was simpler." },
];

// Score by where the words appear. An ATTACK NAME is stronger evidence than
// flavour text, because it is a printed title rather than a description — and
// "Take It Easy" as an attack name is a punchline in a way the same words
// buried in a sentence are not.
const norm = s => (s ?? "").toLowerCase();
const byId = Object.fromEntries(idx.map(c => [c.i, c]));
const HERO = /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra/i;

const out = {};
for (const m of MOODS) {
  const hits = [];
  for (const [id, t] of Object.entries(text)) {
    const card = byId[id];
    if (!card || !card.a) continue;                 // credited cards only
    const atk = norm(t.a.join(" · ")), flav = norm(t.f);
    let score = 0, matched = null;
    for (const w of m.words) {
      if (atk.includes(w)) { score += 3; matched = matched ?? t.a.find(x => norm(x).includes(w)); }
      else if (flav.includes(w)) { score += 1; matched = matched ?? w; }
    }
    if (!score) continue;
    // Prefer cards somebody would want to look at, without letting rarity
    // override the actual match.
    if (HERO.test(card.r ?? "")) score += 2;
    if ((card.p ?? 0) > 20) score += 1;
    hits.push({ id, score, matched, name: card.n, set: card.s, year: card.y,
      artist: card.a, price: card.p ?? null,
      says: t.a.join(" · "), flavour: t.f ? t.f.slice(0, 120) : null });
  }
  hits.sort((a, b) => b.score - a.score || (b.price ?? 0) - (a.price ?? 0));
  out[m.id] = { ...m, count: hits.length, cards: hits.slice(0, 40) };
}

await writeFile(join(ROOT, "data/moods.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "Moods matched against the WORDS PRINTED ON THE CARD, never against an opinion of how a card feels. An attack name scores higher than flavour text because a printed title is a punchline where the same words in a sentence are a description. Every match is checkable by looking at the card.",
  evidence: "All three posts that worked started from a mood: Slakoth TAKE IT EASY after 17 hours of coding, Sunflora always facing the sun for a good morning, Slowpoke REST at 2am. None used any of the 84 formulas we generate.",
  moods: out }, null, 1));

console.log(`✓ moods: ${MOODS.length} moods`);
for (const m of MOODS) console.log(`   ${String(out[m.id].count).padStart(4)} cards  ${m.emoji} ${m.label.padEnd(16)} top: ${out[m.id].cards[0]?.name ?? "—"} — "${out[m.id].cards[0]?.matched ?? "—"}"`);
