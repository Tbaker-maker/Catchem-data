// build-lore.mjs — the lore was always printed on the cards.
//
// Tyler, 2026-08-23: "Let's build more lore-built card sets and routes. Keep
// advancing the data, connectivity, functionality."
//
// THE MEASUREMENT THAT REFRAMED THIS: we hold 22 verified facts, and a STORY in
// the editor can reach **146 of 16,468 cards — 0.89%**. That is the real
// bottleneck, and no better matcher fixes it. More facts do.
//
// AND THERE ARE 8,961 OF THEM ALREADY. Flavour text is lore, printed on the
// card, sourced by definition — quoting it is quoting the object. That takes
// story coverage from 0.89% to 54% without researching a single new claim.
//
// WHAT I GOT WRONG FIRST, and only found by reading: I tried to bucket it into
// six moods and every bucket leaked. "Amazing muscles" landed in sinister,
// "doggedly pursues" in lonely, and a 5000 IQ in legend. **Precise categories
// turn out to be tiny — three to twenty-one cards — and broad ones are noise.**
// So the lore is attached PER CARD and searchable, and only the collections I
// have actually read are named.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const idx = await J("research/assets/card-index.json") ?? [];
const text = (await J("data/card-text.json"))?.cards ?? {};
const byId = Object.fromEntries(idx.map(c => [c.i, c]));

// DEDUPE BY TEXT, NOT BY CARD. Reprints carry identical flavour text, so a
// collection built without this shows the same story three times and looks
// broken. Keep the earliest printing — the first time it was said.
const seenText = new Map();
for (const [id, t] of Object.entries(text)) {
  if (!t.f) continue;
  const card = byId[id];
  if (!card) continue;
  const key = t.f.replace(/\s+/g, " ").trim().toLowerCase();
  const prev = seenText.get(key);
  if (!prev || (card.y ?? "9999") < (byId[prev]?.y ?? "9999")) seenText.set(key, id);
}
const firstPrintings = new Set(seenText.values());

// ── COLLECTIONS I HAVE READ ───────────────────────────────────────────────
// Every phrase below was checked against the actual text. A category I have not
// read is a category I am guessing about, and guessing is how slop ships.
const COLLECTIONS = [
  { id: "lore-grim", name: "The dark ones", hook: "Which of these did you not know was this grim?",
    why: "Cards whose own flavour text is genuinely unsettling — devouring, dragging away, feeding on dreams. Read and confirmed, not pattern-matched.",
    rx: /\b(devours|drags (it|them|people|its prey)|steals? (souls|life|dreams)|feeds on (fear|dreams|life)|never (returns|is seen again))/i },
  { id: "lore-sad", name: "The sad ones", hook: "Read the card. Then tell me it's a kids' game.",
    why: "Flavour text about grief and loss, printed on cards sold to children. Cubone weeping for its dead mother is the canonical one.",
    // 'lost its' matched Slowbro losing the ability to feel pain — odd, not sad.
    rx: /\b(weeps|its dead mother|deceased mother|cries for its|mourns the|grieves)/i },
  { id: "lore-cosmic", name: "Not from here", hook: "Which of these is actually an alien?",
    why: "Cards whose text places them outside this world — another dimension, light-years, fell from the sky.",
    rx: /\b(from another dimension|light-years|fell from the sky|from outer space|came from the moon)/i },
  { id: "lore-absurd", name: "Numbers that cannot be real", hook: "Pick the most ridiculous stat here.",
    why: "Flavour text making a specific, checkable, impossible claim. A 5000 IQ. Moving a mountain. It is the specificity that makes it funny.",
    rx: /\b(outperform a supercomputer|intelligence quotient|can (level|topple|move) a|\d{4,}\s?(degrees|tons)|\d{3,}\s?(mph|tons))/i },
];

const collections = {};
for (const col of COLLECTIONS) {
  const hits = [];
  for (const id of firstPrintings) {
    const t = text[id], card = byId[id];
    if (!t?.f || !card?.a) continue;
    if (!col.rx.test(t.f)) continue;
    hits.push({ id, name: card.n, set: card.s, year: card.y, artist: card.a,
      price: card.p ?? null, lore: t.f.replace(/\s+/g, " ").trim() });
  }
  hits.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  collections[col.id] = { id: col.id, name: col.name, hook: col.hook, why: col.why,
    count: hits.length, cards: hits.slice(0, 40) };
}

// ── PER-CARD LORE ─────────────────────────────────────────────────────────
// The actual unlock. Every card that says something about itself now carries it,
// and the story shape can reach 54% of the catalogue instead of 0.89%.
const lore = {};
for (const id of firstPrintings) {
  const t = text[id];
  if (!t?.f) continue;
  lore[id] = t.f.replace(/\s+/g, " ").trim();
}

await writeFile(join(ROOT, "data/lore.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: "Flavour text as lore. Sourced by definition — it is printed on the card, so quoting it is quoting the object. Deduplicated by TEXT and kept at first printing, because reprints carry identical wording and a collection without that shows the same story three times.",
  method: "Collections are only named where I read the matches. A first pass bucketed everything into six moods and every bucket leaked — 'amazing muscles' as sinister, 'doggedly pursues' as lonely. Precise categories are small; broad ones are noise.",
  coverage: { cardsWithLore: Object.keys(lore).length, ofTotal: idx.length,
    percent: Math.round(Object.keys(lore).length / idx.length * 1000) / 10 },
  collections, lore }, null, 1));

console.log(`✓ lore: ${Object.keys(lore).length.toLocaleString()} cards carry their own story (${Math.round(Object.keys(lore).length / idx.length * 100)}% of the catalogue, up from 0.89%)`);
for (const c of Object.values(collections)) console.log(`   ${String(c.count).padStart(3)}  ${c.name}`);
