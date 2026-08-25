// LINE ENGINE, in the page. Options in four registers, built from the cards
// actually chosen, and never asserting anything — a superlative closes a
// conversation by being agreed with or wrong, and a question opens one.
const REGISTERS = {"question":{"label":"Ask","note":"Answerable in one word. The lowest bar to a reply there is."},"observation":{"label":"Notice","note":"A shared observation with an implicit 'right?'. This is the 127,200 shape."},"confession":{"label":"Confess","note":"Say the thing everyone thinks. Relatability outperforms authority."},"invite":{"label":"Invite","note":"Ask them to add to it rather than judge it."},"permission":{"label":"Permission","note":"A question plus a second sentence that removes the reason not to answer. tall_alan took ~900 replies at 16k followers on 'pick something quirky' — without it people think theirs is boring and scroll past."},"divide":{"label":"Divide","note":"Ask something the community genuinely disagrees on, then say it is not your opinion. Crambo got a 93% reply-to-like ratio doing exactly this — the disclaimer makes replying safe, because nobody is contradicting the host."}};
const CARD_TEXT = __CARD_TEXT__;

function lineOptions(cards, themeName, followerCount){
  const NL = String.fromCharCode(10);
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

  // ── ONE HAND, TWO ERAS. The 127,200 shape, and still the only one with a
  // settled number behind it. It works because the FACT is surprising and the
  // reader supplies the reaction.
  //
  // THE REGISTER IS CHARACTERISED BY THE SENTENCE, NOT THE VIEW COUNT, so the
  // 6.8x correction on 2026-08-25 left the characterisation untouched and the
  // evidence for it stronger, not weaker: 127,200 is a settled 48h reading
  // where 18,800 was a post still climbing. It is still n=1.
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

  // ── PERMISSION. The question is not finished until it has said why
  // answering is safe. This is the mechanic under every high-reply post we have
  // studied, and the second sentence is doing all the work.
  add("permission", "What's your favourite card nobody talks about?" + NL + NL + "Obscure is the point — no Charizards.");
  if (cards.length >= 2) add("permission", "Which of these would you actually put in a binder?" + NL + NL + "No wrong answer, and cheap counts.");
  add("permission", "Show me a card you love that cost under a fiver." + NL + NL + "Price is not the point today.");

  // ── ALWAYS AVAILABLE. Two lines that fit anything and ask for something.
  // A line that does not match what is on screen reads as generated. Singular
  // and plural are not interchangeable here.
  add("question", cards.length === 1 ? "Did you have this one as a kid?" : "Which of these did you have as a kid?");
  add("invite", cards.length === 1 ? "What would you pair this with?" : "Tell me the one you'd swap in.");

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
      else if (t.prefer.indexOf(o.reg) >= 0) o.note = "Suits your reach — unproven, we hold five logged posts.";
    }
  }
  return out.slice(0, 8);
}
