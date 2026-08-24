// build-lines.mjs — the words, and why they are these words.
//
// Tyler, 2026-08-23: "I'd like us to help with the text ideas. I'm stumped
// myself and shouldn't be with our tools. Give suggestions based on their
// filter and Pokemon chosen — options, not just one. The option should ALWAYS
// spark conversation."
//
// THE EVIDENCE, from the only three posts with real numbers:
//   18,800  "It's wild to think the original Charizard artist is still making
//           cards to this day"          — a SHARED OBSERVATION with an implicit
//                                         "right?"
//     791  "Late night check-in. Who's still awake?"
//                                       — a DIRECT QUESTION answerable in one word
//      93  "Only Good Vibes. Pass it along & see it grow"
//                                       — a CALL TO PARTICIPATE
//
// **Not one of them asserts anything.** Every one leaves room for a reply, and
// that is also our slop law: asserting invites correction, asking invites
// disagreement, and only one of those is a thread.
//
// SO THE RULE HERE IS ABSOLUTE: no line may state that something is best,
// worst, most underrated or most anything. A superlative closes a conversation
// by being either agreed with or wrong; a question opens one.
//
// AND THESE ARE OPTIONS, NEVER A FINISHED POST. Fifty creators posting an
// identical generated sentence is a bot farm. Each line is a starting point in
// a different register so somebody can pick the one that sounds like them.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const text = (await J("data/card-text.json"))?.cards ?? {};

// Registers, each doing a different job. A creator picks the one that sounds
// like them — which is the only way fifty people using this do not sound alike.
const REGISTERS = {
  question:    { label: "Ask", note: "Answerable in one word. The lowest bar to a reply there is." },
  observation: { label: "Notice", note: "A shared observation with an implicit 'right?'. This is the 18,800 shape." },
  confession:  { label: "Confess", note: "Say the thing everyone thinks. Relatability outperforms authority." },
  invite:      { label: "Invite", note: "Ask them to add to it rather than judge it." },
  divide:      { label: "Divide", note: "Ask something the community genuinely disagrees on, then say it is not your opinion. Crambo got a 93% reply-to-like ratio doing exactly this — the disclaimer makes replying safe, because nobody is contradicting the host." },
};

const src = `// LINE ENGINE, in the page. Options in four registers, built from the cards
// actually chosen, and never asserting anything — a superlative closes a
// conversation by being agreed with or wrong, and a question opens one.
const REGISTERS = ${JSON.stringify(REGISTERS)};
const CARD_TEXT = __CARD_TEXT__;

function lineOptions(cards, themeName){
  if (!cards || !cards.length) return [];
  const out = [];
  const add = (reg, text) => { if (text && !out.some(o => o.text === text)) out.push({ reg, label: REGISTERS[reg].label, text }); };
  const names = cards.map(c => c.n);
  const first = cards[0], last = cards[cards.length - 1];
  const artists = [...new Set(cards.map(c => c.a).filter(Boolean))];
  const years = cards.map(c => Number(c.y)).filter(Boolean).sort();
  const span = years.length > 1 ? years[years.length - 1] - years[0] : 0;
  const t0 = CARD_TEXT[first.i];
  const atk = t0 && t0.a && t0.a.length ? t0.a[0] : null;

  // ── ONE HAND, TWO ERAS. The 18,800 shape, and the only one with numbers
  // behind it. It works because the FACT is surprising and the reader supplies
  // the reaction.
  if (artists.length === 1 && span >= 8) {
    add("observation", "Same artist. " + span + " years apart. Still going.");
    add("observation", "It's wild that " + artists[0] + " was drawing these " + span + " years ago and still is.");
    add("question", span + " years between these two. Which era do you actually prefer?");
    add("confession", "I had no idea these were the same artist until today.");
  }

  // ── THE CARD'S OWN WORDS. Three posts that worked were built on printed card
  // text, so when a card says something usable, lead with it.
  if (atk && /take it easy|rest|sleep|nap|overthink|dream/i.test(atk)) {
    add("confession", "Attack is literally called " + String.fromCharCode(8220) + atk + String.fromCharCode(8221) + ". Felt that.");
    add("question", String.fromCharCode(8220) + atk + String.fromCharCode(8221) + ". Anyone else?");
  } else if (atk) {
    add("observation", "Whoever named this attack " + String.fromCharCode(8220) + atk + String.fromCharCode(8221) + " knew what they were doing.");
  }

  // ── A SET TO CHOOSE FROM. A pick is the cheapest reply somebody can give.
  if (cards.length >= 3) {
    add("question", "Pick one. No explanation needed.");
    add("question", "Which one's going in the binder?");
    add("invite", "Add the one I missed.");
    add("invite", "Rank these. I'll go first in the replies.");
  }
  if (cards.length === 2) {
    add("question", first.n + " or " + last.n + "?");
    add("question", "One of these is going in the binder. Which?");
    add("invite", "Settle this for me.");
  }
  if (cards.length === 1) {
    add("question", "Have you pulled one?");
    add("confession", "Still don't own this one.");
    add("question", "Does this one get talked about enough?");
  }

  // ── PRICE, only ever as a question. Stating a card is overpriced is an
  // assertion somebody corrects; asking is an opinion somebody shares.
  const priced = cards.filter(c => c.p != null);
  if (priced.length === 1 && priced[0].p >= 15) {
    add("question", "$" + Math.round(priced[0].p) + " for this. Fair or not?");
  }

  // ── THE THEME ITSELF, when it names a real group.
  if (themeName) {
    add("invite", themeName + ". What am I missing?");
    add("question", themeName + " — which one wins?");
  }

  // ── THE DIVIDE. Only ever paired with the disclaimer, because the question
  // alone reads as a position and the disclaimer is what makes it a question.
  add("divide", "Does chasing value make you less of a collector?" + String.fromCharCode(10) + String.fromCharCode(10) + "(not my opinion — I want to know what people actually think)");
  if (priced.length) add("divide", "Is a card worth what someone will pay, or what it means to you?" + String.fromCharCode(10) + String.fromCharCode(10) + "(genuinely asking)");

  // ── ALWAYS AVAILABLE. Two lines that fit anything and ask for something.
  // A line that does not match what is on screen reads as generated. Singular
  // and plural are not interchangeable here.
  add("question", cards.length === 1 ? "Did you have this one as a kid?" : "Which of these did you have as a kid?");
  add("invite", cards.length === 1 ? "What would you pair this with?" : "Tell me the one you'd swap in.");

  return out.slice(0, 8);
}
`;

await writeFile(join(ROOT, "scripts/line-engine.js"), src);
console.log(`✓ lines: ${Object.keys(REGISTERS).length} registers`);
for (const [k, v] of Object.entries(REGISTERS)) console.log(`   ${v.label.padEnd(9)} ${v.note}`);
console.log(`\n  Card text available for ${Object.keys(text).length.toLocaleString()} cards — the attack-name lines depend on it.`);
