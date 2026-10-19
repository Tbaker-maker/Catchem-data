// Backtest for the IR and SIR watch. Pure: takes loaded cards, returns stats.
// Each anchor date uses only prices on or before that date. The outcome is the
// card's own TCGplayer market change over the horizon, compared with the median
// change of every tracked card of the same kind (IR or SIR) on the same dates.
// A hit is beating that median. Precision = hits / flagged. Base = hits / all.
import { priceAt } from "./ir-cycle.mjs";
import { cardFacts, peerStats, signalFlags, upTo, shift, median, rotationDays, SIGNALS, score } from "./ir-sir-watch.mjs";

export function anchors(from, to, step) {
  const out = [];
  for (let d = from; d <= to; d = shift(d, step)) out.push(d);
  return out;
}

export function evaluate(cards, { rules, rot, marks = {}, from, to, step = 14, horizon = 30, split }) {
  const spec = rules?.stage || null;
  const rows = [];
  for (const a of anchors(from, to, step)) {
    const live = [];
    for (const c of cards) {
      if (!c.release || c.release > a) continue;
      const pts = upTo(c.pts, a);
      const facts = cardFacts(pts, a, spec);
      if (!facts || facts.date < shift(a, -3)) continue;
      const fwd = priceAt(c.pts, shift(a, horizon), 5);
      if (!fwd || fwd[0] <= a) continue;
      live.push({ ...c, facts, age: Math.round((Date.parse(a) - Date.parse(c.release)) / 86400000), rotDays: rotationDays(rot, c.setSlug, a, marks[c.id]?.mark), fwd: (fwd[1] / facts.price - 1) * 100 });
    }
    const peers = peerStats(live);
    const med = { IR: median(live.filter((x) => x.kind === "IR").map((x) => x.fwd)), SIR: median(live.filter((x) => x.kind === "SIR").map((x) => x.fwd)) };
    for (const c of live) {
      const flags = signalFlags(c, peers.get(`${c.setSlug}|${c.kind}`), rules);
      rows.push({ a, id: c.id, kind: c.kind, fwd: c.fwd, beat: c.fwd > med[c.kind], up: c.fwd > 0, flags, part: a < split ? "train" : "test" });
    }
  }
  return rows;
}

const rate = (list, key) => (list.length ? list.filter((r) => r[key]).length / list.length : null);
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

export function summarize(rows, { minN, minLift, extra = [] } = {}) {
  const parts = ["train", "test"];
  const base = Object.fromEntries(parts.map((p) => { const l = rows.filter((r) => r.part === p); return [p, { n: l.length, beat: r3(rate(l, "beat")), up: r3(rate(l, "up")) }]; }));
  const signals = {};
  for (const k of [...SIGNALS, ...extra]) {
    const s = {};
    for (const p of parts) {
      const l = rows.filter((r) => r.part === p && r.flags[k]);
      s[p] = { n: l.length, beat: r3(rate(l, "beat")), up: r3(rate(l, "up")), lift: l.length && base[p].n ? r3(rate(l, "beat") - base[p].beat) : null, medFwd: r3(median(l.map((r) => r.fwd))) };
    }
    s.proven = parts.every((p) => s[p].n >= minN && s[p].lift != null && s[p].lift >= minLift);
    s.reason = s.proven ? "passed train and test" : parts.map((p) => (s[p].n < minN ? `${p} n ${s[p].n} under the minimum` : s[p].lift == null || s[p].lift < minLift ? `${p} lift ${s[p].lift}` : "")).filter(Boolean).join("; ");
    signals[k] = s;
  }
  return { base, signals };
}

// Weights: train lift only (the test half stays a clean check).
export function provenWeights(summary) {
  const out = {};
  for (const [k, s] of Object.entries(summary.signals)) if (s.proven) out[k] = { weight: Math.round(s.train.lift * 1000) / 10, trainLift: s.train.lift, testLift: s.test.lift };
  return out;
}

// Score check on the test half: precision of cards with a positive score vs base.
export function scoreCheck(rows, proven) {
  const test = rows.filter((r) => r.part === "test").map((r) => ({ ...r, s: score(r.flags, { proven }).score }));
  const scored = test.filter((r) => r.s > 0);
  const sorted = [...test].sort((a, b) => b.s - a.s);
  const top = sorted.slice(0, Math.max(1, Math.round(sorted.length * 0.1))).filter((r) => r.s > 0);
  return { testN: test.length, base: r3(rate(test, "beat")), scoredN: scored.length, scoredBeat: r3(rate(scored, "beat")), scoredUp: r3(rate(scored, "up")), topDecileN: top.length, topDecileBeat: r3(rate(top, "beat")), topDecileMedFwd: r3(median(top.map((r) => r.fwd))) };
}
