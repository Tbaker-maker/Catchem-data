// build-lines.mjs — the words, and why they are these words.
//
// Tyler, 2026-08-23: "I'd like us to help with the text ideas. I'm stumped
// myself and shouldn't be with our tools. Give suggestions based on their
// filter and Pokemon chosen — options, not just one. The option should ALWAYS
// spark conversation."
//
// THE EVIDENCE, from the only three posts with real numbers. THE AGE OF EACH
// READING IS PART OF THE NUMBER, and is printed here because leaving it off is
// exactly what produced a withdrawn law (data/corrections-log.json 2026-08-25):
//  127,200 at 59.8h   "It's wild to think the original Charizard artist is
//                     still making cards to this day"
//                                       — a SHARED OBSERVATION with an implicit
//                                         "right?"
//      791 at 25.02h  "Late night check-in. Who's still awake?"
//                                       — a DIRECT QUESTION answerable in one word
//       93 at 0.03h   "Only Good Vibes. Pass it along & see it grow"
//                                       — a CALL TO PARTICIPATE
//
// THESE ARE NOT RANKABLE AGAINST EACH OTHER. 93 was read 1.7 minutes after
// posting and 127,200 two and a half days after; only the first post has a
// settled 48h reading at all. What they support is that all three LEAVE ROOM
// FOR A REPLY — a claim about the copy, not about the reach.
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


// TIERS. A hypothesis, not a finding — we hold five logged posts. Written down
// so it can be tested and corrected, and labelled as unproven wherever it shows.
// VIEWS, NOT FOLLOWERS. Followers are an accumulated number and views are a live
// signal — bought, bot, dormant and lapsed followers count toward the first and
// none toward the second. Crambo has 17.6k followers and took 37.1k views on one
// post; a 50k account with dormant followers might see 3k. The tiers answer one
// question — is there a crowd big enough to answer a question — and that is a
// views question.
export const REACH_TIERS = [
  { id: "quiet", upTo: 800, label: "under 800 views a post",
    prefer: ["observation", "confession"],
    avoid: ["question", "permission", "divide"],
    why: "A question with three replies looks worse than a post with none, because an unanswered request is visibly unanswered. Lead with something that stands alone and let the reply be optional",
    hypothesis: true },
  { id: "building", upTo: 4000, label: "800 to 4k views a post",
    prefer: ["observation", "confession", "invite"],
    avoid: ["divide"],
    why: "Enough eyes that a low-effort ask lands. INVITE beats ASK here: 'add the one I missed' costs a reader nothing, where 'which is best' asks them to defend a choice",
    hypothesis: true },
  { id: "crowd", upTo: 20000, label: "4k to 20k views a post",
    prefer: ["question", "permission", "invite", "observation"],
    avoid: [],
    why: "The band where the permission mechanic is documented working — tall_alan took roughly 900 replies from an account this size. There is a crowd and a question finds it",
    hypothesis: true },
  { id: "loud", upTo: Infinity, label: "20k+ views a post",
    prefer: ["divide", "permission", "question"],
    avoid: [],
    why: "A divisive question is safe when there are enough answers to make a thread rather than a silence",
    hypothesis: true },
];

// FOLLOWERS ONLY AS A LAST RESORT, and openly derated. A rough rule of thumb is
// that a healthy account sees views in the region of its follower count; a
// neglected one sees a fraction. Using it means guessing at the very thing the
// tier is trying to measure.
export function tierFor(typicalViews, followersFallback){
  let n = Number(typicalViews) || 0;
  if (!n && followersFallback) n = Number(followersFallback) * 0.5;
  if (!n) return null;
  return REACH_TIERS.find(t => n <= t.upTo) || REACH_TIERS[REACH_TIERS.length - 1];
}

// THE BEST INPUT IS THE ONE WE ALREADY HOLD. Once read-metrics fills the
// outcome log, nobody needs to type anything — the median of the last several
// settled posts IS the answer, and it is measured rather than remembered.
export function typicalViewsFrom(posts){
  const settled = (posts || []).filter(p => p.measured && p.measured.views);
  if (settled.length < 3) return null;
  const v = settled.slice(-8).map(p => p.measured.views).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}

// Registers, each doing a different job. A creator picks the one that sounds
// like them — which is the only way fifty people using this do not sound alike.
const REGISTERS = {
  question:    { label: "Ask", note: "Answerable in one word. The lowest bar to a reply there is." },
  observation: { label: "Notice", note: "A shared observation with an implicit 'right?'. This is the 127,200 shape." },
  confession:  { label: "Confess", note: "Say the thing everyone thinks. Relatability outperforms authority." },
  invite:      { label: "Invite", note: "Ask them to add to it rather than judge it." },
  permission:  { label: "Permission", note: "A question plus a second sentence that removes the reason not to answer. tall_alan took ~900 replies at 16k followers on 'pick something quirky' — without it people think theirs is boring and scroll past." },
  divide:      { label: "Divide", note: "Ask something the community genuinely disagrees on, then say it is not your opinion. Crambo got a 93% reply-to-like ratio doing exactly this — the disclaimer makes replying safe, because nobody is contradicting the host." },
};

// WHICH ATTACK NAMES ARE FURNITURE. Counted from the catalogue rather than
// guessed: a name printed on many cards is a mechanic, not a choice somebody
// made, and "Whoever named this attack Psychic knew what they were doing" is a
// sentence about nothing. Anything above the threshold is excluded from the
// NOTICE lines, which is what stops a true detail being a generic one.
const attackCounts = {};
for (const v of Object.values(text)) {
  for (const a of (v.a ?? [])) {
    const k = String(a).toLowerCase();
    attackCounts[k] = (attackCounts[k] ?? 0) + 1;
  }
}
const COMMON_ATTACKS = Object.entries(attackCounts)
  .filter(([, n]) => n >= 12).map(([k]) => k);
console.log(`  ${COMMON_ATTACKS.length} attack name(s) appear on 12+ cards and are treated as furniture`);

const src = `// LINE ENGINE, in the page. Options in four registers, built from the cards
// actually chosen, and never asserting anything — a superlative closes a
// conversation by being agreed with or wrong, and a question opens one.
const REGISTERS = ${JSON.stringify(REGISTERS)};
const COMMON_ATTACKS = ${JSON.stringify(COMMON_ATTACKS)};
const CARD_TEXT = __CARD_TEXT__;

function lineOptions(cards, themeName, followerCount){
  const NL = String.fromCharCode(10);
  const Q1 = String.fromCharCode(8220), Q2 = String.fromCharCode(8221);
  const DASH = String.fromCharCode(32, 8212, 32);
  if (!cards || !cards.length) return [];
  const out = [];
  const add = (reg, text) => { if (text && !out.some(o => o.text === text)) out.push({ reg, label: REGISTERS[reg].label, text, why: REGISTERS[reg].note }); };

  // ── THE RULE, AND IT IS THE WHOLE FILE ──────────────────────────────────
  // Every line must be DERIVABLE FROM THE CARDS ON SCREEN and must change when
  // they change. If a line cannot name something true about THESE cards, it
  // does not appear at all.
  //
  // What was here before failed that. "Does chasing value make you less of a
  // collector?" and "Is a card worth what someone will pay?" were offered over
  // every pairing in the catalogue, and a user who sees the same sentence over
  // two different pairs knows instantly it is a template. That is the cheap
  // feeling, and it costs more than a missing feature does.
  //
  // THE STANDARD IS THE CREDIT LIST BELOW THE PANEL. "Lugia - Aquapolis 149 -
  // Naoyo Kimura" is right because it states facts about what is loaded and
  // nothing else. It cannot be generic, because it is read from the data. Every
  // line here is held to that: it names a card, an artist, a year, a set or a
  // printed attack, or it is not offered.
  const names = cards.map(c => c.n);
  // NAME A CARD THE WAY A PERSON WOULD. Two prints of one Pokemon produced
  // "Magmar or Magmar?" and then, after that was fixed in the Ask line only,
  // "Swap one of these out - Magmar or Magmar?". Fixing it per sentence meant
  // fixing it once per sentence; this fixes it once.
  const sameName = cards.length > 1 && cards.every(c => c.n === cards[0].n);
  const label = (c) => sameName ? (c.y + " " + c.n) : c.n;
  const first = cards[0], last = cards[cards.length - 1];
  const artists = [...new Set(cards.map(c => c.a).filter(Boolean))];
  const sets = [...new Set(cards.map(c => c.s).filter(Boolean))];
  const years = cards.map(c => Number(c.y)).filter(Boolean).sort(function(a,b){ return a - b; });
  const span = years.length > 1 ? years[years.length - 1] - years[0] : 0;

  // ── THE NOUN HAS TO MATCH THE COUNT ─────────────────────────────────────
  // With nine Arcanine loaded the panel said "23 years between these two" and
  // "Blaine's Arcanine, Light Arcanine, Arcanine — pick one", naming three of
  // nine as though they were the whole tray. The derivation was right and the
  // COUNT was never part of it.
  //
  // these() is the only way any line refers to the loaded cards from here on.
  const N = cards.length;
  // SPELLED HERE, NOT IMPORTED. words() lives in card-relations.mjs and is not
  // emitted into line-engine.js, so calling it would have been a ReferenceError
  // in the browser — the same shape as evoLineFor existing only as an object
  // property. A tray holds at most nine cards, so the list is closed.
  const NWORD = ["zero","one","two","three","four","five","six","seven","eight","nine"];
  const nword = (k) => NWORD[k] || String(k);
  const these = N === 1 ? "this one"
    : N === 2 ? "these two"
    : N === 3 ? "these three"
    : "these " + nword(N);
  // For a line that names a SUBSET, this says so out loud rather than implying
  // the subset is everything.
  const ofN = (k) => N > k ? " (" + nword(k) + " of " + nword(N) + ")" : "";

  // YEARS IN CALENDAR ORDER. first/last are TRAY order, so a tray built newest
  // first produced "2024 to 2004" — the span was right and the sentence read
  // backwards.
  const yearLo = years.length ? years[0] : null;
  const yearHi = years.length ? years[years.length - 1] : null;

  // ── WHAT IS WORTH NOTICING ───────────────────────────────────────────────
  // An attack name only earns a line if it is DISTINCTIVE. The old code led
  // with the first attack of the first card whatever it was, which produced
  // "Whoever named this attack Psychic knew what they were doing" over a Lugia
  // whose attack is, indeed, Psychic. True, derived, and still worthless: the
  // sentence is a mould and the reader can see the seam.
  //
  // COMMON_ATTACKS is computed from the catalogue at build time - the names
  // that appear on hundreds of cards. Anything in it is furniture. What is left
  // is a name somebody actually wrote.
  const notable = [];
  for (const c of cards) {
    const t = CARD_TEXT[c.i];
    const a = t && t.a && t.a.length ? t.a[0] : null;
    if (a && COMMON_ATTACKS.indexOf(a.toLowerCase()) < 0 && a.length > 4) notable.push({ c: c, atk: a });
  }

  // NOTICE - a printed detail on a named card, or nothing at all.
  if (notable.length) {
    const n = notable[0];
    add("observation", n.c.n + " has an attack called " + Q1 + n.atk + Q2 + ".");
    if (notable.length > 1) {
      add("observation", notable[0].c.n + " has " + Q1 + notable[0].atk + Q2 + ", " +
        notable[1].c.n + " has " + Q1 + notable[1].atk + Q2 + ".");
    }
  }
  if (artists.length === 1 && cards.length > 1 && span >= 8) {
    add("observation", artists[0] + " drew " + (N === 2 ? "both of these" : "all " + nword(N)) +
      ", " + span + " years apart.");
  }
  if (artists.length === 1 && cards.length === 1) {
    add("observation", artists[0] + " drew this one in " + first.y + ".");
  }

  // ASK - assembled from the loaded names. Already right, kept as it was.
  // SAME NAME, DIFFERENT PRINTS needs the year or the question is nonsense.
  // The Kimura pairing produced "Magmar or Magmar?", which is derived, true,
  // and unanswerable.
  if (cards.length === 2) {
    add("question", first.n === last.n
      ? "The " + first.y + " " + first.n + " or the " + last.y + "?"
      : label(first) + " or " + label(last) + "?");
  }
  // NAMING A SUBSET SAYS SO. With nine loaded this read "Blaine's Arcanine,
  // Light Arcanine, Arcanine - pick one", which offers three of nine as if they
  // were the tray. Three or four can be named in full; beyond that the line
  // either declares the subset or talks about the group.
  if (N === 3 || N === 4) add("question", names.join(", ") + DASH + "pick one.");
  else if (N > 4) add("question", names.slice(0, 3).join(", ") + DASH +
    "pick one" + ofN(3) + ".");
  if (cards.length === 1) add("question", "Anyone else own the " + first.s + " " + first.n + "?");

  // ── DIVIDE - a real contrast between THESE cards, stated, then asked ─────
  // No contrast, no line. The two essay questions that used to live here were
  // about collecting in general and would have read identically over any pair
  // in the catalogue.
  const priced = cards.filter(c => c.p != null && c.p > 0).sort(function(a,b){ return b.p - a.p; });
  if (priced.length >= 2 && priced[0].p >= priced[priced.length-1].p * 3 && priced[0].p >= 5) {
    add("divide", priced[0].n + " sells for about " + Math.round(priced[0].p) + " and " +
      priced[priced.length-1].n + " for about " + Math.round(priced[priced.length-1].p) + "." + NL + NL +
      "Which one would you rather own?" + NL + NL + "Not asking which is worth more.");
  }
  if (span >= 10 && cards.length > 1) {
    // CALENDAR ORDER. first/last are TRAY order, so a newest-first tray printed
    // "2024 and 2000" - the span correct and the sentence backwards.
    add("divide", yearLo + " and " + yearHi + DASH + span + " years apart." + NL + NL +
      "Which era got it right?" + NL + NL + "Not my opinion, genuinely asking.");
  }
  if (artists.length > 1 && cards.length > 1) {
    add("divide", artists[0] + " drew one, " + artists[1] + " the other." + NL + NL +
      "Whose is doing more for you?" + NL + NL + "No wrong answer, they are different jobs.");
  }
  if (sets.length > 1 && cards.length > 1 && span < 10) {
    add("divide", first.s + " against " + last.s + "." + NL + NL +
      "Which set treated it better?" + NL + NL + "Both are fine answers.");
  }

  // ── PERMISSION - about the relation that produced THIS pair ─────────────
  // The second sentence removes the reason not to answer. It may reference what
  // put these cards together; it may not be a question about the hobby.
  if (artists.length === 1 && cards.length > 1) {
    add("permission", "Anything else " + artists[0] + " drew that I should see?" + NL + NL +
      "I only know " + these + ".");
  }
  if (cards.length > 1 && names[0] === names[names.length - 1]) {
    add("permission", "Which " + names[0] + " is your favourite?" + NL + NL +
      "Any print, any year, no wrong pick.");
  }
  if (sets.length === 1 && cards.length > 1) {
    add("permission", "What else should I be looking at from " + sets[0] + "?" + NL + NL +
      "I have barely scratched that set.");
  }
  if (span >= 10) {
    // THE SPECIFIC FACT GOES FIRST. Led with the generic question, the opening
    // line was identical across two different pairings even though the second
    // sentence differed - and the opening line is what a reader sees.
    add("permission", span + " years across " + these + ", " + yearLo + " to " + yearHi + "." + NL + NL +
      "What is the biggest gap you own of one card?" + NL + NL + "Any card, any condition.");
  }

  // INVITE - names a loaded card so it cannot be reused over another pair.
  // NAMES A CARD, so it cannot be the same sentence over another pair. This
  // read "Tell me which of these two you would swap out" and was the last line
  // in the panel that repeated verbatim across three different pairings.
  if (N === 2) add("invite", "Swap one of these out for me" + DASH + label(first) + " or " + label(last) + "?");
  else if (N > 2) add("invite", "Swap one of " + these + " out for me" + DASH +
    "start with " + label(first) + ", or tell me which one does not belong.");
  if (cards.length === 1) add("invite", "What would you pair the " + first.s + " " + first.n + " with?");

  // The theme, when it names a real group.
  if (themeName) add("invite", themeName + ". What am I missing?");

  // ── CONFESS - about THESE cards, never about the hobby ──────────────────
  // The register existed with no generator, so it never appeared. A confession
  // about "collecting" is a sentence anybody could post over any cards; one
  // that names what is loaded can only be posted over this page.
  if (N > 1 && sets.length === 1)
    add("confession", "Everything I own from " + sets[0] + " is in this picture.");
  if (N > 1 && artists.length === 1)
    add("confession", "I did not know " + artists[0] + " drew " + these + " until I looked.");
  if (span >= 15 && yearLo)
    add("confession", "I have been at this long enough to remember the " + yearLo + " one.");
  if (N > 2 && names[0] === names[names.length - 1])
    add("confession", nword(N) + " " + names[0] + " and I still have not stopped.");
  const pricedAll = cards.filter(c => typeof c.p === "number" && c.p > 0);
  if (pricedAll.length === N && N > 1) {
    const cheap = pricedAll.slice().sort((a, b) => a.p - b.p)[0];
    add("confession", "The one I reach for is " + cheap.n + ", and it is the cheapest here.");
  }

  // ORDER BY TIER, DO NOT HIDE. Removing registers would be the tool deciding
  // for somebody, and the account works because Tyler chooses the line. So the
  // ones suited to the reach come first, the rest stay available, and the reason
  // is stated. The ranking is advice, not a gate.
  if (typeof followerCount === "number" && followerCount > 0) {
    const t = tierFor(followerCount);
    const rank = (o) => (t.prefer.indexOf(o.reg) >= 0 ? 0 : t.avoid.indexOf(o.reg) >= 0 ? 2 : 1);
    out.sort((a, b) => rank(a) - rank(b));
    for (const o of out) {
      if (t.avoid.indexOf(o.reg) >= 0) o.note = "Lower for your reach: " + t.why;
      else if (t.prefer.indexOf(o.reg) >= 0) o.note = "Suits your reach " + String.fromCharCode(8212) + " unproven, we hold five logged posts.";
    }
  }
  // ── UP TO THREE PER REGISTER, NOT EIGHT OVERALL ─────────────────────────
  // Slicing the whole pool to 8 meant a register with three good lines could
  // lose two of them to a register that had one, and "Another" then had nowhere
  // to go — which is why only NOTICE and DIVIDE had the button. Cap per
  // register instead, so every register keeps its own depth.
  const perReg = {};
  const kept = [];
  for (const o of out) {
    perReg[o.reg] = (perReg[o.reg] || 0) + 1;
    if (perReg[o.reg] <= 3) kept.push(o);
  }
  return kept;
}
`;

await writeFile(join(ROOT, "scripts/line-engine.js"), src);
console.log(`✓ lines: ${Object.keys(REGISTERS).length} registers`);
for (const [k, v] of Object.entries(REGISTERS)) console.log(`   ${v.label.padEnd(9)} ${v.note}`);
console.log(`\n  Card text available for ${Object.keys(text).length.toLocaleString()} cards — the attack-name lines depend on it.`);
