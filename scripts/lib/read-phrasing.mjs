// Phrasing for pathway reads. Two reads should never read as copies.
// Each read carries its facts (numbers already on file) and is rendered from
// several sentence templates per slot (lead, context, notable). The pick is
// deterministic by read id and day, so a rebuild gives the same words. After
// the feed is ordered, revaryPhrasing re-picks so that a read never repeats
// the template or angle of the read right before it, nor of the last read in
// the same group (same pathway, same set, same kind), which is what sits next
// to it when a filter leaves only that group. Every number comes from facts.
// No thresholds live here.
import { money } from "./public-bundle.mjs";
import { tcgAmount } from "./card-face.mjs";
import { monthDay } from "./takes.mjs";
import { speakDates } from "./read-quality.mjs";
import { banGuard } from "./copy-rules.mjs";

const BANNED = banGuard("pathway reads");
const usd = (n) => tcgAmount(n, money);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso) => `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const dateLabel = (iso, asOf) => (iso.slice(0, 4) === String(asOf || "").slice(0, 4) ? monthDay(iso) : `${monthDay(iso)}, ${iso.slice(0, 4)}`);
const pct1 = (x) => {
  const v = Math.abs(x);
  if (v < 0.95) return "under 1%";
  return `${v < 9.95 ? v.toFixed(1).replace(/\.0$/, "") : Math.round(v)}%`;
};
const signed = (x) => (Math.abs(x) < 0.5 ? "flat" : `${x > 0 ? "up" : "down"} ${pct1(x)}`);
const ordinalWeeks = (w) => (w === 1 ? "1 week" : `${w} weeks`);
// "yesterday", "5 days ago", "about 3 weeks ago", from the real day count.
const agoText = (f) => {
  const d = Number(f.daysSinceHigh);
  if (!(d >= 1)) return "";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return `about ${ordinalWeeks(Math.round(d / 7))} ago`;
};

export function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---- Templates. Each needs(f) is true only when every fact it names exists.
const has = (...keys) => (f) => keys.every((k) => f[k] != null && f[k] !== "" && !(typeof f[k] === "number" && !Number.isFinite(f[k])));

export const LEADS = {
  "quiet-high": [
    { key: "qh-lead-a", uses: ["now", "abovePct"], needs: has("who", "now", "prevHigh"), text: (f) => `${f.who} reached ${usd(f.now)} tonight, ${pct1(f.abovePct)} above its earlier 1-year peak, with no big single week.` },
    { key: "qh-lead-b", uses: ["now"], needs: (f) => f.topOfYear === true && has("who", "now")(f), text: (f) => `${f.who} is at ${usd(f.now)} tonight, its highest TCGplayer market on file in a year.` },
    { key: "qh-lead-c", uses: ["now", "prevHigh"], needs: has("who", "now", "prevHigh"), text: (f) => `New 1-year high for ${f.who}: ${usd(f.now)}, past the earlier top of ${usd(f.prevHigh)}.` },
    { key: "qh-lead-d", uses: ["now", "prevHigh", "prevHighDate"], needs: has("who", "now", "prevHigh", "prevHighDate"), text: (f) => `${f.who} moved past its ${dateLabel(f.prevHighDate, f.asOf)} peak of ${usd(f.prevHigh)} and sits at ${usd(f.now)}.` },
    { key: "qh-lead-e", uses: ["now", "upWeeks"], needs: (f) => f.topOfYear === true && has("who", "now", "upWeeks")(f), text: (f) => `${usd(f.now)} tonight is a 1-year high for ${f.who}, reached over ${f.upWeeks} rising weeks out of 12.` },
    { key: "qh-lead-f", uses: ["now", "maxStepPct"], needs: has("who", "now", "prevHigh", "maxStepPct"), text: (f) => `${f.who} edged to a new 1-year high of ${usd(f.now)}. Its biggest weekly gain on the way was ${pct1(f.maxStepPct)}.` },
  ],
  "quiet-climber": [
    { key: "qc-lead-a", uses: ["move13", "peerMedian"], needs: has("who", "move13", "peerMedian", "setName"), text: (f) => `${f.who} is ${signed(f.move13)} over 13 weeks, while the median ${f.rarity || "similar"} card in ${f.setName} is ${signed(f.peerMedian)}.` },
    { key: "qc-lead-b", uses: ["now", "then"], needs: has("who", "then", "now", "thenDate"), text: (f) => `${f.who} went from ${usd(f.then)} on ${dateLabel(f.thenDate, f.asOf)} to ${usd(f.now)} tonight, one small step at a time.` },
    { key: "qc-lead-c", uses: ["relPts"], needs: has("who", "relPts", "setName"), text: (f) => `${f.who} has outrun the median ${f.rarity || "similar"} card in ${f.setName} by ${Math.round(f.relPts)} percentage points over 13 weeks.` },
    { key: "qc-lead-d", uses: ["now", "move13", "upWeeks"], needs: has("who", "now", "move13", "upWeeks"), text: (f) => `${f.who}: ${usd(f.now)} tonight, ${signed(f.move13)} in 13 weeks, higher in ${f.upWeeks} of the last 12.` },
    { key: "qc-lead-e", uses: ["move13", "peerCount"], needs: has("who", "move13", "peerCount", "rarity", "setName"), text: (f) => `Among ${f.peerCount} ${f.rarity} cards in ${f.setName}, ${f.who} is one of the steadier climbers: ${signed(f.move13)} in 13 weeks.` },
    { key: "qc-lead-f", uses: ["now", "then"], needs: has("who", "now", "then"), text: (f) => `${f.who} has climbed from ${usd(f.then)} to ${usd(f.now)} over the last 13 weeks without a jump.` },
  ],
};

// Angles: each is one fact family. Context lines are about how the move
// happened; notable lines are what else this item has on file.
export const ANGLES = {
  quiet: [
    { key: "quiet-a", uses: ["upWeeks", "maxStepPct"], needs: has("upWeeks", "maxStepPct"), text: (f) => `Higher in ${f.upWeeks} of the last 12 weeks, and no single week rose more than ${pct1(f.maxStepPct)}.` },
    { key: "quiet-b", uses: ["maxStepPct"], needs: has("maxStepPct"), text: (f) => `No one week did the work: the biggest weekly rise in the last 12 was ${pct1(f.maxStepPct)}.` },
    { key: "quiet-c", uses: ["upWeeks"], needs: has("upWeeks", "downWeeks"), text: (f) => `${f.upWeeks} weeks up, ${f.downWeeks} down, the rest flat, over the last 12 weekly prices.` },
    { key: "quiet-d", uses: ["upWeeks", "maxStepPct"], needs: has("maxStepPct", "upWeeks"), text: (f) => `A gradual path: ${f.upWeeks} rising weeks out of 12, the largest at ${pct1(f.maxStepPct)}.` },
    { key: "quiet-e", uses: ["upWeeks", "maxStepPct"], needs: has("short", "upWeeks", "maxStepPct"), text: (f) => `${f.short} was higher in ${f.upWeeks} of the last 12 weeks, and its largest weekly rise was ${pct1(f.maxStepPct)}.` },
    { key: "quiet-f", uses: ["downWeeks", "maxStepPct"], needs: has("short", "downWeeks", "maxStepPct"), text: (f) => `For ${f.short}, ${f.downWeeks === 0 ? "no week of the last 12 was lower than the week before" : `${f.downWeeks} of the last 12 weeks ${f.downWeeks === 1 ? "was" : "were"} lower than the week before`}, and the biggest weekly gain was ${pct1(f.maxStepPct)}.` },
  ],
  since: [
    { key: "since-a", uses: ["prevHigh", "prevHighDate"], needs: has("prevHigh", "prevHighDate"), text: (f) => `The earlier top was ${usd(f.prevHigh)} on ${dateLabel(f.prevHighDate, f.asOf)}${agoText(f) ? `, ${agoText(f)}` : ""}.` },
    { key: "since-b", uses: ["prevHigh", "weeksSinceHigh"], needs: (f) => has("prevHigh")(f) && !!agoText(f), text: (f) => `The previous 1-year high, ${usd(f.prevHigh)}, was ${agoText(f)}.` },
    { key: "since-c", uses: ["abovePct", "prevHighDate"], needs: has("prevHighDate", "abovePct"), text: (f) => `Tonight is ${pct1(f.abovePct)} above the high it set on ${dateLabel(f.prevHighDate, f.asOf)}.` },
    { key: "since-d", uses: ["prevHighDate"], needs: has("short", "prevHighDate"), text: (f) => `Before tonight, the top price on file for ${f.short} in the past year came on ${dateLabel(f.prevHighDate, f.asOf)}.` },
  ],
  range: [
    { key: "range-a", uses: ["yearLow"], needs: has("yearLow", "yearHigh"), text: (f) => `Past year range: ${usd(f.yearLow)} to ${usd(f.yearHigh)}.` },
    { key: "range-b", uses: ["yearAgo"], needs: has("yearAgo", "yearAgoDate", "now"), text: (f) => `A year ago (${dateLabel(f.yearAgoDate, f.asOf)}) it was ${usd(f.yearAgo)}, ${signed(((f.now - f.yearAgo) / f.yearAgo) * 100)} since.` },
    { key: "range-c", uses: ["yearLow"], needs: has("yearLow", "yearLowDate"), text: (f) => `Its 1-year low was ${usd(f.yearLow)} on ${dateLabel(f.yearLowDate, f.asOf)}.` },
    { key: "range-d", uses: ["spot"], needs: (f) => has("spot")(f) && f.spot > 0 && f.spot < 100, text: (f) => `Tonight sits ${f.spot}% of the way from its 1-year low to its 1-year high.` },
  ],
  setcompare: [
    { key: "set-a", uses: ["move13", "setMedian13"], needs: has("move13", "setMedian13", "setCount", "setName"), text: (f) => `Over 13 weeks: ${signed(f.move13)}, against a median of ${signed(f.setMedian13)} across ${f.setCount} priced ${f.setName} items.` },
    { key: "set-b", uses: ["setRank"], needs: has("setRank", "setPriced", "setName"), text: (f) => `Number ${f.setRank} of ${f.setPriced} priced ${f.setName} items tonight.` },
    { key: "set-c", uses: ["setBeat"], needs: has("setBeat", "setCount", "setName"), text: (f) => `It moved more than ${f.setBeat} of the other ${f.setCount - 1} priced ${f.setName} items over 13 weeks.` },
  ],
  age: [
    { key: "age-a", uses: ["release"], needs: has("release", "setName", "ageYears"), text: (f) => `${f.setName} came out in ${monthYear(f.release)}, ${f.ageYears < 1 ? "under a year" : `about ${f.ageYears} year${f.ageYears === 1 ? "" : "s"}`} ago.` },
    { key: "age-b", uses: ["release"], needs: has("release", "setName"), text: (f) => `From ${f.setName}, released ${monthYear(f.release)}.` },
  ],
  file: [
    { key: "file-a", uses: ["firstDate"], needs: has("firstDate", "points"), text: (f) => `On file since ${monthYear(f.firstDate)}: ${f.points} TCGplayer market points for this ${f.kind === "sealed" ? "product" : "card"}.` },
    { key: "file-b", uses: ["firstDate"], needs: has("firstDate", "firstPrice"), text: (f) => `The first price on file, ${monthYear(f.firstDate)}, was ${usd(f.firstPrice)}.` },
  ],
};

// Per pathway: which angles can be the context line and which the notable lines.
export const PLAN = {
  "quiet-high": { context: ["quiet", "since"], notable: ["since", "range", "setcompare", "age", "file", "quiet"] },
  "quiet-climber": { context: ["quiet", "setcompare"], notable: ["range", "setcompare", "age", "file", "quiet"] },
};

const clean = (s, asOf) => {
  const t = speakDates(String(s || ""), asOf).replace(/\s+/g, " ").trim();
  return t && !BANNED.test(t) && !/[\u2014\u2013]/.test(t) ? t : "";
};

function options(list, f) { return list.filter((t) => { try { return t.needs(f); } catch { return false; } }); }

function rotate(list, start) { return list.length ? list.map((_, i) => list[(start + i) % list.length]) : []; }

// One render. avoid: { keys:Set, angles:Set, sentences:Set } to steer away from.
export function renderPathway(pathway, facts, seed, avoid = {}) {
  const plan = PLAN[pathway];
  if (!plan || !LEADS[pathway]) return null;
  const f = facts;
  const keys = avoid.keys || new Set();
  const angles = avoid.angles || new Set();
  const used = avoid.sentences || new Set();
  const h = hashOf(`${seed}|${pathway}`);
  // A fact is said once per read: a template that repeats a fact the read
  // already states is skipped.
  const said = new Set();
  const fresh = (t) => !(t.uses || []).some((u) => said.has(u));
  const pick = (list, salt, extraAvoid = new Set(), level = 2) => {
    const opts = rotate(options(list, f), hashOf(`${seed}|${salt}`) % Math.max(1, options(list, f).length)).filter(fresh);
    const tiers = [
      (t) => !keys.has(t.key) && !extraAvoid.has(t.key) && !used.has(clean(t.text(f), f.asOf)),
      (t) => !extraAvoid.has(t.key) && !used.has(clean(t.text(f), f.asOf)),
      (t) => !extraAvoid.has(t.key),
    ];
    for (const ok of tiers.slice(0, level + 1)) for (const t of opts) if (ok(t) && clean(t.text(f), f.asOf)) return t;
    return null;
  };
  const lead = pick(LEADS[pathway], "lead");
  if (!lead) return null;
  for (const u of lead.uses || []) if (u !== "now") said.add(u);
  const chosen = [];
  const takenAngles = new Set();
  const angleOrder = (names, salt) => {
    const r = rotate(names, hashOf(`${seed}|${salt}`) % names.length);
    // Angles the neighbour used go last, not out.
    return [...r.filter((a) => !angles.has(a)), ...r.filter((a) => angles.has(a))];
  };
  const tryAngle = (names, salt, level) => {
    for (const a of angleOrder(names, salt)) {
      if (takenAngles.has(a)) continue;
      const t = pick(ANGLES[a], `${salt}|${a}`, new Set(chosen.map((c) => c.key)), level);
      if (t) { takenAngles.add(a); for (const u of t.uses || []) said.add(u); chosen.push({ ...t, angle: a }); return true; }
    }
    return false;
  };
  // A sentence already used elsewhere on the list is a last resort, after every other angle.
  const slot = (names, salt) => tryAngle(names, salt, 0) || tryAngle(names, salt, 1) || tryAngle(names, salt, 2);
  slot(plan.context, "context");
  slot(plan.notable, "notable1");
  slot(plan.notable, "notable2");
  if (chosen.length < 3) return null;
  // Line order varies too: context first most nights, a notable fact first on others.
  const order = h % 3 === 0 ? [1, 0, 2] : h % 3 === 1 ? [0, 2, 1] : [0, 1, 2];
  const lines = order.map((i) => clean(chosen[i].text(f), f.asOf));
  const headline = clean(lead.text(f), f.asOf);
  if (!headline || lines.some((l) => !l)) return null;
  return { headline, lines, templates: [lead.key, ...order.map((i) => chosen[i].key)], angles: order.map((i) => chosen[i].angle) };
}

export function sentencesOf(row) {
  return [row?.headline, ...(row?.lines || [])].filter((s) => typeof s === "string" && s);
}

// Groups a filter can isolate: one pathway, one set, one kind.
export function phraseGroups(row) {
  const p = row?.phrase;
  if (!p) return [];
  return [`pathway:${p.pathway}`, p.facts?.setName ? `set:${p.facts.setName}` : "", `kind:${p.facts?.kind || ""}`].filter(Boolean);
}

// After ordering: re-pick so neighbours (and the previous read of each group)
// never share a template or an angle when another choice exists, and no
// sentence repeats anywhere in the list. Rows without phrase pass through.
export function revaryPhrasing(rows) {
  const used = new Set();
  for (const r of rows || []) if (!r?.phrase) for (const s of sentencesOf(r)) used.add(s);
  const lastInGroup = new Map();
  let prev = null;
  const out = [];
  for (const r of rows || []) {
    if (!r?.phrase) { out.push(r); prev = null; continue; }
    const keys = new Set();
    const angles = new Set();
    const near = [prev, ...phraseGroups(r).map((g) => lastInGroup.get(g))].filter(Boolean);
    for (const n of near) { for (const k of n.phrase.templates || []) keys.add(k); }
    if (prev) for (const a of prev.phrase.angles || []) angles.add(a);
    const got = renderPathway(r.phrase.pathway, r.phrase.facts, r.phrase.seed, { keys, angles, sentences: used });
    const row = got ? { ...r, headline: got.headline, path: got.headline, lines: got.lines, phrase: { ...r.phrase, templates: got.templates, angles: got.angles } } : r;
    for (const s of sentencesOf(row)) used.add(s);
    for (const g of phraseGroups(row)) lastInGroup.set(g, row);
    prev = row;
    out.push(row);
  }
  return out;
}
