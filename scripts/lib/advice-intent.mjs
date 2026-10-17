// advice-intent.mjs: the shared copy checker. Pure, no fs, no network.
// The vocabulary and reasons live in rules/advice-phrases.json. catchem-site keeps a
// byte-for-byte copy of this file and catchem-bot runs a line-for-line Python port.
// rules/advice-cases.json is the labelled test set all three must pass.
//
// How it decides, in order:
//  1. Button and shopping labels (Buy on TCGplayer, Buy on eBay, Sell your cards) and
//     text inside double quotes (product names) are blanked out first.
//  2. Dashes: any em or en dash is flagged, except inside an official set name (HS\u2014Undaunted).
//  3. Questions are never flagged for advice. Each sentence ending in "?" is skipped.
//  4. A directive: a second-person or imperative lead (you should, time to, go, don't)
//     directly followed by a money verb (buy, sell, hold, flip, invest, dump, pick up).
//  5. An imperative: a sentence or clause that starts with a money verb and then names
//     an object (it, this box, Prismatic, 3 boxes) or a time push (now, today, before).
//     Shop and raffle objects (buy an item, grab a ticket) pass, and a directive inside a
//     subordinate clause (what you should sell, if you have to sell) passes.
//  6. A promise: certainty or return words (guaranteed, can't lose, will double,
//     easy money, risk-free, to the moon, will hit $X). Negated promises pass (not guaranteed).
//  7. Framing: crypto words, investment framing (good investment, invest in), a verdict
//     (this is a buy, it's a sell, easy buy) and a bare "load up" (not "the page will load up").
// Past tense never matches: only base-form verbs are in the list (bought, sold, held pass).
// Each flag carries the line, the rule, the matched span and a plain reason. Nothing is rewritten.

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const alt = (list) => [...list].sort((a, b) => b.length - a.length).map(esc).join("|");
const blank = (s) => s.replace(/[^\n]/g, " ");

export function makeChecker(rules) {
  const v = rules.vocab;
  const ALLOWED = Object.freeze([...rules.allowed]);
  const LABEL_RE = new RegExp(`(?:^|\\b)(?:${alt(ALLOWED.filter((a) => /\s/.test(a)))})\\b`, "gi");
  const QUOTE_RE = /"[^"\n]{2,80}"|\u201c[^\u201d\n]{2,80}\u201d/g;
  const DASH_RE = /[\u2014\u2013]/g;
  const DASH_ALLOW_RE = new RegExp(rules.dash.allow, "g");
  const MONEY = alt(v.moneyVerbs);
  // Weak verbs (hold, flip, pick up) are also things you do with your hands ("Hold the card",
  // "Flip the card"). As a bare command they count only with a market word later in the
  // sentence (on eBay, now, before, for profit). After a directive (you should hold) they always count.
  const WEAK = new Set(v.weakVerbs);
  const MARKET_RE = new RegExp(`\\b(?:${v.marketContext.map((w) => w.replace(/ /g, "\\s+")).join("|")})(?![\\w])`, "i");
  const FILL = `(?:(?:${alt(v.fillers)})\\s+){0,2}`;
  // Second-person directives (you should, time to) count anywhere in a sentence.
  const DIRECTIVE_RE = new RegExp(`\\b(?:${alt(v.directives)})\\s+${FILL}(?:${MONEY})\\b`, "gi");
  // Imperative leads (go, don't, never) count only at a clause start, so "we do not sell your data" passes.
  const LEAD_RE = new RegExp(`(?:^\\s*|[,;:(]\\s*|\\b(?:and|so|then|but)\\s+)((?:${alt(v.imperativeLeads)})\\s+${FILL}(?:${MONEY}))\\b`, "gi");
  const LEAD = `(?:(?:${alt(v.clauseLeads)})[\\s,]+){0,2}`;
  const OBJECT = `(?:(${alt([...v.objectWords, ...v.productNouns, ...v.timeWords])})\\b|([0-9$])|([a-z]))`;
  // Run on lowercased text. A clause start: sentence start, after a clause mark, or after a joining word.
  // A bare following word counts as an object only when it is capitalized in the line (a product name).
  const IMPERATIVE_RE = new RegExp(`(?:^\\s*|[,;:(]\\s*|\\b(?:and|so|then|but)\\s+)${LEAD}(${MONEY})\\s+${FILL}${OBJECT}`, "g");
  const PROMISES = rules.promises.map((r) => ({ ...r, re: new RegExp(r.pattern, "gi") }));
  const FRAMING = rules.framing.map((r) => ({ ...r, re: new RegExp(r.pattern, "gi"), not: r.notAfter ? new RegExp(r.notAfter, "i") : null }));
  const NEG_RE = new RegExp(`\\b(?:${alt(v.negations)})\\s+(?:\\w+\\s+){0,2}$`, "i");
  const SUB_RE = new RegExp(`\\b(?:${alt(v.subordinators)})\\s+(?:\\w+\\s+){0,1}$`, "i");
  const ALLOW_OBJ_RE = new RegExp(`^(?:\\s+[\\w'$]+){0,3}?\\s+(?:${alt(v.allowObjects)})\\b`, "i");
  const R = rules.reasons;

  // Sentences with their offsets. A sentence is a question when it ends in "?".
  function sentences(text) {
    const out = [];
    const re = /[^.!?\n]+[.!?]*|[.!?\n]+/g;
    let m;
    while ((m = re.exec(text))) out.push({ start: m.index, text: m[0], question: /\?\s*$/.test(m[0]) });
    return out;
  }

  function flagLine(input, { skipKinds = [] } = {}) {
    const line = String(input ?? "");
    if (!line.trim()) return [];
    let text = line.replace(LABEL_RE, blank).replace(QUOTE_RE, blank);
    const flags = [];
    const push = (rule, kind, start, end, reason) => {
      if (!skipKinds.includes(kind)) flags.push({ line, rule, kind, span: [start, end], phrase: line.slice(start, end), reason });
    };
    // Dashes.
    const dashText = text.replace(DASH_ALLOW_RE, (m) => m.replace(DASH_RE, " "));
    for (const m of dashText.matchAll(DASH_RE)) push("dash", "house", m.index, m.index + 1, R.dash);
    text = text.replace(DASH_RE, ",");
    for (const s of sentences(text)) {
      if (s.question) continue;
      // Strip list markers and markdown at the start so "- Buy it" and "**Buy it**" read as starts.
      const lead = s.text.match(/^[\s>*_\-\u2022#\d.)]*/)[0].length;
      const body = " ".repeat(lead) + s.text.slice(lead);
      const at = (i) => s.start + i;
      const seen = [];
      const add = (rule, kind, a, b, reason) => {
        if (seen.some(([x, y]) => a < y && b > x)) return;
        seen.push([a, b]);
        push(rule, kind, at(a), at(b), reason);
      };
      // A directive inside a subordinate clause (what you should sell, if you have to sell) describes, it does not tell.
      for (const m of body.matchAll(DIRECTIVE_RE)) {
        if (SUB_RE.test(body.slice(0, m.index))) continue;
        add("directive", "advice", m.index, m.index + m[0].length, R.directive);
      }
      for (const m of body.matchAll(LEAD_RE)) {
        const at0 = m.index + m[0].indexOf(m[1]);
        add("directive", "advice", at0, at0 + m[1].length, R.directive);
      }
      const lower = body.toLowerCase();
      for (const m of lower.matchAll(IMPERATIVE_RE)) {
        const end = m.index + m[0].length;
        if (m[4] && !/[A-Z]/.test(body[end - 1])) continue;
        const verbAt = m.index + m[0].indexOf(m[1]);
        // Shop, raffle and shipping objects (buy an item, grab a ticket) are not money advice.
        if (ALLOW_OBJ_RE.test(body.slice(verbAt + m[1].length))) continue;
        if (WEAK.has(m[1].replace(/\s+/g, " ")) && !MARKET_RE.test(body.slice(verbAt + m[1].length))) continue;
        const stop = m[4] ? end - 1 + body.slice(end - 1).search(/[^\w\u00c0-\u024f]|$/) : end;
        add("imperative", "advice", verbAt, stop, R.imperative);
      }
      for (const r of PROMISES) {
        for (const m of body.matchAll(r.re)) {
          if (r.negatable && NEG_RE.test(body.slice(0, m.index))) continue;
          add(r.id, "promise", m.index, m.index + m[0].length, r.reason);
        }
      }
      for (const r of FRAMING) {
        for (const m of body.matchAll(r.re)) {
          // notAfter: words that, right before the match, make it describe something else (the page will load up).
          if (r.not && r.not.test(body.slice(0, m.index))) continue;
          add(r.id, r.kind || "framing", m.index, m.index + m[0].length, r.reason);
        }
      }
    }
    return flags.sort((a, b) => a.span[0] - b.span[0]);
  }

  return { flagLine, ALLOWED };
}
