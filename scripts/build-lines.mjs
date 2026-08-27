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
  // THE COUNT IS THE CLAIM. "23 years between these two" over nine cards is the
  // Koga failure in a sentence. Two is a pair. Anything else is a number.
  //
  // MERGE TRAP 2026-08-26: two const these survived a rebase (THESE_N map then
  // the nword form). lineOptions threw on first call, so NOTICE, evo-smoke,
  // ask-smoke and notice-eye all died with the same SyntaxError.
  // One name. One declaration.
  const N = cards.length;
  const nCards = N;
  const NWORD = ["zero","one","two","three","four","five","six","seven","eight","nine"];
  const nword = (k) => NWORD[k] || String(k);
  const these = N === 1 ? "this one"
    : N === 2 ? "these two"
    : N === 3 ? "these three"
    : "these " + nword(N);
  const both = N === 2 ? "both of these" : "all " + nword(N) + " of these";
  // For a line that names a SUBSET, this says so out loud rather than implying
  // the subset is everything.
  const ofN = (k) => N > k ? " (" + nword(k) + " of " + nword(N) + ")" : "";

  function isPocketCard(c){
    return c && (c.g === "k" || String(c.i || "").indexOf("tcgp-") === 0);
  }
  const pocketN = cards.filter(isPocketCard).length;
  const paperN = nCards - pocketN;
  const mixedGames = paperN > 0 && pocketN > 0;
  function yearsUsable(){
    if (typeof yearOk === "function") {
      for (var yu = 0; yu < cards.length; yu++) if (!yearOk(cards[yu])) return false;
      return years.length >= 2;
    }
    return years.length >= 2;
  }

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

  // ── THE GLANCE TEST ──────────────────────────────────────────────────────
  // "Both of these are Fire type" over two Magmars is true, derived, and
  // worthless — the reader already has two orange lizards. Same failure as
  // leading with the attack Psychic: a mould they can see the seam of.
  //
  // A notice has to be something you would NOT get from looking at the
  // pictures. Years, credits, a type that is not the usual one, a weakness
  // that is not the usual one, flavour text, one picture across two cards.
  // Shared type, shared weakness, shared region, restating an evolution
  // line that is already on the tray: furniture. Do not write them.
  const speciesOf = function(c){
    if (typeof monName === "function") return monName(c.n);
    return String(c.n || "").replace(/-(EX|GX|ex|V|VMAX|VSTAR)$/i, "").split(" ")[0];
  };
  const species = cards.map(speciesOf);
  const sameSpecies = nCards > 1 && species.every(function(s){ return s && s === species[0]; });
  const evoLinked = nCards > 1 && cards.some(function(c){
    if (!c.E) return false;
    const parent = String(c.E);
    return cards.some(function(o){ return o !== c && speciesOf(o) === parent; });
  });
  function majority(mon, pick){
    if (typeof INDEX === "undefined" || !mon) return null;
    const counts = {};
    var total = 0;
    for (var i = 0; i < INDEX.length; i++) {
      if (speciesOf(INDEX[i]) !== mon) continue;
      const v = pick(INDEX[i]);
      if (!v) continue;
      counts[v] = (counts[v] || 0) + 1;
      total++;
    }
    var best = null, nBest = 0;
    for (const k in counts) if (counts[k] > nBest) { nBest = counts[k]; best = k; }
    if (!best || nBest < 3 || nBest / total < 0.5) return null;
    return best;
  }

  const types = cards.map(function(c){ return c.T && c.T[0] ? c.T[0] : ""; }).filter(Boolean);
  const typeSet = [...new Set(types)];
  const hps = cards.filter(function(c){ return c.H; });
  const stages = cards.map(function(c){ return c.S && c.S[0] ? c.S[0] : ""; }).filter(Boolean);
  const stageSet = [...new Set(stages)];
  const weaks = cards.map(function(c){ return c.W ? String(c.W) : ""; }).filter(Boolean);
  const weakSet = [...new Set(weaks)];
  const eras = cards.map(function(c){ return c.era || ""; }).filter(Boolean);
  const eraSet = [...new Set(eras)];
  const regions = cards.map(function(c){ return c.regn || ""; }).filter(Boolean);
  const regionSet = [...new Set(regions)];

  // NOTICE — THE EYE. Attack names were three of forty facts we hold. Every
  // line below is read off THESE cards. If the cards changed, the sentence
  // would have to. A superlative still does not belong here. A fact the
  // picture already told you does not belong here either.
  if (notable.length) {
    const n = notable[0];
    add("observation", n.c.n + " has an attack called " + Q1 + n.atk + Q2 + ".");
    if (notable.length > 1) {
      add("observation", notable[0].c.n + " has " + Q1 + notable[0].atk + Q2 + ", " +
        notable[1].c.n + " has " + Q1 + notable[1].atk + Q2 + ".");
    }
  }
  if (artists.length === 1 && cards.length > 1 && span >= 8 && yearsUsable() && !mixedGames) {
    add("observation", artists[0] + " drew " + (N === 2 ? "both of these" : "all " + nword(N)) +
      ", " + span + " years apart.");
  }
  if (artists.length === 1 && cards.length === 1) {
    add("observation", artists[0] + " drew this one in " + first.y + ".");
  }
  if (sets.length === 1 && nCards > 1 && !sameSpecies) {
    add("observation", both.charAt(0).toUpperCase() + both.slice(1) + " are from " + sets[0] + ".");
  }
  if (sets.length >= 2) {
    add("observation", sets[0] + " next to " + sets[sets.length - 1] + ".");
  }

  // TYPE: contrast, or a printing that is not the usual type for that Pokémon.
  // Never "both Fire" — that is the glance.
  if (typeSet.length >= 2) {
    add("observation", typeSet[0] + " next to " + typeSet[1] + ".");
  }
  for (var ti = 0; ti < cards.length; ti++) {
    const t = cards[ti].T && cards[ti].T[0];
    if (!t) continue;
    const usual = majority(speciesOf(cards[ti]), function(x){ return x.T && x.T[0]; });
    if (usual && t !== usual) {
      add("observation", label(cards[ti]) + " is " + t + " type. " + speciesOf(cards[ti]) + " is usually " + usual + ".");
    }
  }

  // HP: a gap you would not guess from the art. 70 next to 80 is furniture.
  if (hps.length >= 2) {
    const lo = Math.min.apply(null, hps.map(function(c){ return c.H; }));
    const hi = Math.max.apply(null, hps.map(function(c){ return c.H; }));
    if (hi >= lo * 1.5 || hi - lo >= 50) {
      const loC = hps.filter(function(c){ return c.H === lo; })[0];
      const hiC = hps.filter(function(c){ return c.H === hi; })[0];
      add("observation", label(loC) + " is printed at " + lo + " HP, " + label(hiC) + " at " + hi + ".");
    }
  }

  // STAGE: only when these cards are not already an evolution line.
  if (stageSet.length >= 2 && !evoLinked && !sameSpecies) {
    add("observation", "A " + stageSet[0] + " beside a " + stageSet[1] + ".");
  }

  // WEAKNESS: only when it is not the usual one for that Pokémon.
  for (var wi = 0; wi < cards.length; wi++) {
    const w = cards[wi].W ? String(cards[wi].W) : "";
    if (!w) continue;
    const usualW = majority(speciesOf(cards[wi]), function(x){ return x.W ? String(x.W) : ""; });
    if (usualW && w !== usualW) {
      add("observation", label(cards[wi]) + " is weak to " + w + ". " + speciesOf(cards[wi]) + " is usually weak to " + usualW + ".");
    }
  }

  function firstSentence(s){
    const t = String(s).trim();
    const cut = t.split(". ")[0];
    if (cut.length <= 80) return cut.replace(/\.$/, "");
    const slice = cut.slice(0, 80);
    const sp = slice.lastIndexOf(" ");
    return (sp > 40 ? slice.slice(0, sp) : slice) + "…";
  }
  for (var li = 0; li < cards.length && li < 2; li++) {
    if (cards[li].L && String(cards[li].L).length > 24) {
      add("observation", label(cards[li]) + " says " + Q1 + firstSentence(cards[li].L) + Q2 + ".");
    }
  }

  // Era contrast is a notice when we did not already say the year span —
  // otherwise it restates "25 years apart" in different clothes.
  if (eraSet.length >= 2 && span < 8) {
    add("observation", eraSet[0] + " next to " + eraSet[1] + ".");
  }
  if (regionSet.length >= 2) {
    add("observation", regionSet[0] + " next to " + regionSet[1] + ".");
  }

  for (var mi = 0; mi < cards.length; mi++) {
    const mech = cards[mi].mech ? String(cards[mi].mech) : "";
    if (!mech) continue;
    if (String(cards[mi].n).toLowerCase().indexOf(mech.toLowerCase()) >= 0) continue;
    add("observation", label(cards[mi]) + " is a " + mech + ".");
    break;
  }

  var connectingHit = false;
  if (typeof CONNECTING !== "undefined") {
    for (var gi = 0; gi < CONNECTING.length; gi++) {
      const g = CONNECTING[gi];
      const ids = cards.map(function(c){ return c.i; });
      const hit = (g.c || []).filter(function(id){ return ids.indexOf(id) >= 0; });
      if (hit.length === (g.c || []).length && hit.length === nCards && nCards >= 2) {
        connectingHit = true;
        add("observation", (g.a ? g.a + " drew " : "") +
          names.join(nCards === 2 ? " and " : ", ") +
          " as one picture" +
          (g.arr === "down" ? ", top to bottom" : g.arr === "across" ? ", left to right" : "") + ".");
        if (nCards === 2) {
          add("divide", label(cards[0]) + " or " + label(cards[1]) + "?" + NL + NL + "Keep one.");
          add("observation", label(cards[0]) +
            (g.arr === "down" ? " sits on " : " left, ") +
            label(cards[1]) +
            (g.arr === "down" ? "." : " right."));
          if (g.a && yearLo) add("observation", g.a + ", " + yearLo + "." + NL + NL +
            label(cards[0]) + " and " + label(cards[1]) + ".");
        } else if (nCards === 3) {
          add("divide", label(cards[0]) + ", " + label(cards[1]) + " or " + label(cards[2]) + "?" + NL + NL +
            "Keep one.");
          if (g.a) add("observation", g.a + " painted " + names.join(", ") + " as one picture.");
        } else if (g.a) {
          add("observation", g.a + " hid this across " +
            (sets.length > 1 ? nword(sets.length) + " sets" : (sets[0] || "one set")) + ".");
        }
        if (sets.length > 1 && nCards >= 3) {
          add("observation", nword(nCards) + " cards." + NL +
            nword(sets.length) + " different packs." + NL +
            "one " + (g.scene || "painting") + "." + NL + NL +
            "you already pulled a piece of this and didn't know.");
        }
        if (g.arr === "down" && nCards === 2) {
          add("divide", label(cards[0]) + " sits on " + label(cards[1]) + "." + NL + NL +
            "Would you post it this way up?" + NL + NL + "Not a trick.");
        }
        break;
      }
    }
  }

  if (mixedGames) {
    const uniq = [];
    for (var us = 0; us < species.length; us++) {
      if (species[us] && uniq.indexOf(species[us]) < 0) uniq.push(species[us]);
    }
    const who = uniq.length && uniq.length <= 3 ? uniq.join(", ") : (uniq.length ? nword(uniq.length) + " Pokémon" : "Pokémon");
    add("observation", "Paper on top. Pocket under. Same " + who + ".");
    if (yearsUsable() && span >= 1 && yearLo && yearHi) {
      add("divide", yearLo + " paper and " + yearHi + " Pocket" + DASH + span + " years." + NL + NL +
        "Which era got it right?" + NL + NL + "Not my opinion, genuinely asking.");
    }
    add("question", "Paper or Pocket" + DASH + who + ".");
    add("invite", "Which row would you actually post" + DASH + "the paper or the Pocket?");
  }

  const birdIds = cards.map(function(c){ return c.i; });
  if (!mixedGames && nCards === 3 &&
      birdIds.indexOf("basep-21") >= 0 && birdIds.indexOf("basep-22") >= 0 && birdIds.indexOf("basep-23") >= 0) {
    add("observation", "The card says Aoki. The painting is Kimura. Collectors call the first print the Aoki error.");
    if (yearsUsable() && yearLo) add("observation", "English giveaway: The Power of One, " + yearLo + ". Not 1999.");
  }

  if (typeof INDEX !== "undefined" && artists.length === 1) {
    var acount = 0;
    for (var ai = 0; ai < INDEX.length; ai++) if (INDEX[ai].a === artists[0]) acount++;
    if (acount >= 40) add("observation", artists[0] + " has " + acount + " cards in this catalogue.");
    if (acount === 1) add("observation", "This is the only " + speciesOf(first) + " we hold by " + artists[0] + ".");
  }

  const pricedN = cards.filter(function(c){ return c.p != null && c.p > 0; }).sort(function(a,b){ return b.p - a.p; });
  if (typeof PRICES_AS_OF !== "undefined" && pricedN.length >= 2 && pricedN[0].p >= pricedN[pricedN.length-1].p * 3 && pricedN[0].p >= 5) {
    add("observation", "The " + pricedN[0].s + " " + pricedN[0].n + " is listed around $" +
      Math.round(pricedN[0].p) + ", the " + pricedN[pricedN.length-1].s + " " + pricedN[pricedN.length-1].n +
      " around $" + Math.round(pricedN[pricedN.length-1].p) + " as of " + String(PRICES_AS_OF).slice(0, 10) + ".");
  } else if (typeof PRICES_AS_OF !== "undefined" && nCards === 1 && first.p && first.p >= 1) {
    add("observation", "The " + first.s + " " + first.n + " is listed around $" +
      Math.round(first.p) + " as of " + String(PRICES_AS_OF).slice(0, 10) + ".");
  }

  if (typeof INDEX !== "undefined" && hps.length) {
    const mon = speciesOf(hps[0]);
    var maxH = 0, minH = 9999;
    for (var hi = 0; hi < INDEX.length; hi++) {
      if (speciesOf(INDEX[hi]) !== mon || !INDEX[hi].H) continue;
      if (INDEX[hi].H > maxH) maxH = INDEX[hi].H;
      if (INDEX[hi].H < minH) minH = INDEX[hi].H;
    }
    if (maxH && hps[0].H && maxH >= hps[0].H * 1.5 && maxH - hps[0].H >= 40) {
      add("observation", "This " + mon + " is printed at " + hps[0].H + " HP. Other printings go up to " + maxH + ".");
    }
  }

  // ASK - assembled from the loaded names. Already right, kept as it was.
  // SAME NAME, DIFFERENT PRINTS needs the year or the question is nonsense.
  // The Kimura pairing produced "Magmar or Magmar?", which is derived, true,
  // and unanswerable.
  if (cards.length === 2) {
    add("question", first.n === last.n
      ? "The " + first.y + " " + first.n + " or the " + last.y + "?"
      : label(first) + " or " + label(last) + "?");
    add("question", "Which of " + these + " would you actually keep?");
    if (hps.length === 2) {
      const loQ = Math.min(hps[0].H, hps[1].H), hiQ = Math.max(hps[0].H, hps[1].H);
      if (hiQ >= loQ * 1.5 || hiQ - loQ >= 50) {
        add("question", loQ + " HP or " + hiQ + " — which do you actually play?");
      }
    }
  }
  if (cards.length >= 3 && !mixedGames) {
    add("question", "Which of " + these + " is the one you would keep?");
  }
  if (cards.length === 1) {
    add("question", "Anyone else own the " + first.s + " " + first.n + "?");
    add("question", "Would you still buy the " + first.s + " " + first.n + " today?");
  }
  // NAMING A SUBSET SAYS SO. With nine loaded this read "Blaine's Arcanine,
  // Light Arcanine, Arcanine - pick one", which offers three of nine as if they
  // were the tray. Three or four can be named in full; beyond that the line
  // either declares the subset or talks about the group.
  //
  // COMPARE BOTH is not a subset. Six cards, three paper names, "pick one"
  // is how the 2026-08-27 birds post captioned a paper×Pocket grid as if
  // the Pocket row was furniture.
  if (!mixedGames) {
    if (N === 3 || N === 4) add("question", names.join(", ") + DASH + "pick one.");
    else if (N > 4) add("question", names.slice(0, 3).join(", ") + DASH +
      "pick one" + ofN(3) + ".");
  }
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
  if (span >= 10 && cards.length > 1 && yearsUsable() && !mixedGames) {
    // CALENDAR ORDER. first/last are TRAY order, so a newest-first tray printed
    // "2024 and 2000" - the span correct and the sentence backwards.
    add("divide", yearLo + " and " + yearHi + DASH + span + " years apart." + NL + NL +
      "Which era got it right?" + NL + NL + "Not my opinion, genuinely asking.");
  }
  if (artists.length > 1 && cards.length > 1) {
    add("divide", artists[0] + " drew one, " + artists[1] + " the other." + NL + NL +
      "Whose is doing more for you?" + NL + NL + "No wrong answer, they are different jobs.");
  }
  if (stageSet.length >= 2 && !evoLinked && !sameSpecies) {
    add("divide", "A " + stageSet[0] + " against a " + stageSet[1] + "." + NL + NL +
      "Which job is the card actually doing?" + NL + NL + "Not asking which is rarer.");
  }
  if (typeSet.length === 2) {
    add("divide", typeSet[0] + " against " + typeSet[1] + "." + NL + NL +
      "Which type is doing more for you?" + NL + NL + "No wrong answer.");
  }
  if (sets.length > 1 && cards.length > 1 && span < 10) {
    add("divide", first.s + " against " + last.s + "." + NL + NL +
      "Which set treated it better?" + NL + NL + "Both are fine answers.");
  }
  if (cards.length === 2) {
    add("divide", label(first) + " or " + label(last) + "." + NL + NL +
      "Which one is the post?" + NL + NL + "Not asking which is rarer.");
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
  if (span >= 10 && yearsUsable()) {
    // THE SPECIFIC FACT GOES FIRST. Led with the generic question, the opening
    // line was identical across two different pairings even though the second
    // sentence differed - and the opening line is what a reader sees.
    add("permission", span + " years across " + these + ", " + yearLo + " to " + yearHi + "." + NL + NL +
      "What is the biggest gap you own of one card?" + NL + NL + "Any card, any condition.");
  }

  // CONFESS - a private reaction to THESE cards. Never a generic feeling about
  // the hobby; if the cards changed, the sentence would have to.
  if (nCards === 1 && first.L && String(first.L).length > 24) {
    add("confession", "I still think about " + Q1 + firstSentence(first.L) + Q2 + " on the " + first.n + ".");
  } else if (nCards === 1) {
    add("confession", "I have stared at the " + first.s + " " + first.n + " longer than I will admit.");
  }
  if (weakSet.length === 1 && nCards > 1 && !sameSpecies && !evoLinked) {
    add("invite", "What else is weak to " + weakSet[0] + "?");
  }
  for (var wii = 0; wii < cards.length; wii++) {
    const wU = cards[wii].W ? String(cards[wii].W) : "";
    if (!wU) continue;
    const usualW2 = majority(speciesOf(cards[wii]), function(x){ return x.W ? String(x.W) : ""; });
    if (usualW2 && wU !== usualW2) {
      add("invite", "Anything else " + speciesOf(cards[wii]) + " that is weak to " + wU + "?");
      break;
    }
  }
  if (eraSet.length >= 2) {
    add("permission", eraSet[0] + " sitting next to " + eraSet[1] + "." + NL + NL +
      "Anyone else keep both in the same binder?" + NL + NL + "Any era, any condition.");
  }
  if (nCards > 1 && span >= 8) {
    add("confession", "I keep coming back to the " + label(first) + ".");
  }
  if (nCards > 1) {
    add("confession", "I did not expect " + label(first) + " to sit this well with " + label(last) + ".");
  }
  if (connectingHit && nCards > 1) {
    add("confession", "I did not see they were one picture until they sat together.");
  }
  if (artists.length === 1 && nCards > 1 && span >= 8) {
    add("confession", "I did not have " + artists[0] + " down as someone who would hold my attention for " + span + " years.");
  }

  // INVITE - names a loaded card so it cannot be reused over another pair.
  // NAMES A CARD, so it cannot be the same sentence over another pair. This
  // read "Tell me which of these two you would swap out" and was the last line
  // in the panel that repeated verbatim across three different pairings.
  if (N === 2) add("invite", "Swap one of these out for me" + DASH + label(first) + " or " + label(last) + "?");
  else if (N > 2) add("invite", "Swap one of " + these + " out for me" + DASH +
    "start with " + label(first) + ", or tell me which one does not belong.");
  if (cards.length === 1) add("invite", "What would you pair the " + first.s + " " + first.n + " with?");
  if (cards.length > 1) add("invite", "What would you sit next to " + label(first) + "?");
  if (typeof CONNECTING !== "undefined" && connectingHit) {
    add("invite", "What other two cards make one picture?");
  }

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
  // KEEP THREE PER REGISTER so Another has somewhere to go. A hard cap of
  // eight across every register left three categories with a single line, and
  // the button that promised Another had nothing to show. The ranking still
  // decides order; it no longer deletes the rest of a category.
  const CAP = { observation: 6, question: 3, divide: 3, permission: 3, confession: 3, invite: 3 };
  const kept = [], seen = {};
  for (const o of out) {
    seen[o.reg] = (seen[o.reg] || 0) + 1;
    if (seen[o.reg] <= (CAP[o.reg] || 3)) kept.push(o);
  }
  return kept;
}
`;

await writeFile(join(ROOT, "scripts/line-engine.js"), src);
console.log(`✓ lines: ${Object.keys(REGISTERS).length} registers`);
for (const [k, v] of Object.entries(REGISTERS)) console.log(`   ${v.label.padEnd(9)} ${v.note}`);
console.log(`\n  Card text available for ${Object.keys(text).length.toLocaleString()} cards — the attack-name lines depend on it.`);
