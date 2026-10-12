// Bounded Card Rating weight tuner. Reads scored rating rows from the self-check
// ledger and nudges factor weights toward factors whose values line up with
// cards beating their group, and away from ones that do not. Every change is
// logged with its evidence. Nothing here touches verdicts: the verdict comes
// from price vs similar cards; weights only shape the 0-100 score.

export const TUNER = Object.freeze({
  horizon: 30,          // days. Only 30-day results move weights.
  minRows: 150,         // scored rating rows with that factor present
  minAbsCorr: 0.05,     // weaker evidence is ignored
  stepPoints: 1,        // per factor per night
  maxPairsPerNight: 2,  // each pair moves +1 on one factor and -1 on another, so the sum stays 100
  cooldownDays: 7,      // a factor moved once waits a week
  floorShare: 0.5,      // a weight never drops below half its base
  ceilShare: 1.5,       // and never rises above 1.5x its base
  minWeight: 2,
  revertDrop: 0.03,     // a version whose score lines up worse than its parent by this much is reverted
  revertMinRows: 150,
});

const pearson = (xs, ys) => {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
};
const round = (x, d = 3) => (x == null ? null : Math.round(x * 10 ** d) / 10 ** d);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

export function factorEvidence(ledger, horizon = TUNER.horizon) {
  const per = {};
  for (const e of ledger) {
    if (e.t !== "rating") continue;
    const s = e[`h${horizon}`];
    if (!s || s.excess == null) continue;
    for (const [k, v] of Object.entries(e.f || {})) {
      (per[k] ||= { x: [], y: [] });
      per[k].x.push(v); per[k].y.push(s.excess);
    }
  }
  const out = {};
  for (const [k, { x, y }] of Object.entries(per)) out[k] = { n: x.length, corr: round(pearson(x, y)) };
  return out;
}

export function versionEvidence(ledger, horizon = TUNER.horizon) {
  const per = {};
  for (const e of ledger) {
    if (e.t !== "rating" || e.score == null) continue;
    const s = e[`h${horizon}`];
    if (!s || s.excess == null) continue;
    (per[e.wv || "base"] ||= { x: [], y: [] });
    per[e.wv || "base"].x.push(e.score); per[e.wv || "base"].y.push(s.excess);
  }
  const out = {};
  for (const [k, { x, y }] of Object.entries(per)) out[k] = { n: x.length, corr: round(pearson(x, y)) };
  return out;
}

// state: { version, parent, weights, base, frozen, lastMoved: {factor: date}, history: [{version, parent, weights, date}] }
export function tuneNight(state, ledger, today) {
  const log = [];
  const next = structuredClone(state);
  next.lastMoved ||= {};
  next.history ||= [];
  if (next.frozen) return { state: next, log: [{ date: today, action: "skip", reason: "frozen" }] };

  // Revert check first: if the current version has enough 30-day results and its
  // score lines up worse than its parent's, go back to the parent.
  const ver = versionEvidence(ledger);
  const cur = ver[next.version], par = next.parent ? ver[next.parent] : null;
  if (cur && par && cur.n >= TUNER.revertMinRows && par.n >= TUNER.revertMinRows && cur.corr != null && par.corr != null && cur.corr < par.corr - TUNER.revertDrop) {
    const parent = next.history.find((h) => h.version === next.parent);
    if (parent) {
      log.push({ date: today, action: "auto-revert", from: next.version, to: parent.version, evidence: { current: cur, parent: par } });
      next.weights = { ...parent.weights };
      next.version = parent.version;
      next.parent = parent.parent || null;
      next.revertedAt = today;
      return { state: next, log };
    }
  }

  const ev = factorEvidence(ledger);
  const usable = Object.entries(ev).filter(([k, e]) => k in next.weights && e.n >= TUNER.minRows && e.corr != null && Math.abs(e.corr) >= TUNER.minAbsCorr
    && !(next.lastMoved[k] && daysBetween(next.lastMoved[k], today) < TUNER.cooldownDays));
  const ups = usable.filter(([, e]) => e.corr > 0).sort((a, b) => b[1].corr - a[1].corr);
  const downs = usable.filter(([, e]) => e.corr < 0).sort((a, b) => a[1].corr - b[1].corr);
  // With no negative factor, the weakest positive one gives the point.
  const weakest = usable.filter(([, e]) => e.corr > 0).sort((a, b) => a[1].corr - b[1].corr);
  const w = { ...next.weights };
  const lo = (k) => Math.max(TUNER.minWeight, Math.ceil(next.base[k] * TUNER.floorShare));
  const hi = (k) => Math.floor(next.base[k] * TUNER.ceilShare);
  const moved = new Set();
  let pairs = 0;
  for (const [up, eu] of ups) {
    if (pairs >= TUNER.maxPairsPerNight) break;
    if (moved.has(up) || w[up] + TUNER.stepPoints > hi(up)) continue;
    const donors = [...downs, ...weakest.filter(([k]) => k !== up)];
    const pick = donors.find(([k]) => !moved.has(k) && k !== up && w[k] - TUNER.stepPoints >= lo(k));
    if (!pick) continue;
    const [down, ed] = pick;
    w[up] += TUNER.stepPoints; w[down] -= TUNER.stepPoints;
    moved.add(up); moved.add(down); pairs++;
    log.push({ date: today, action: "nudge", up, down, points: TUNER.stepPoints, evidence: { [up]: eu, [down]: ed } });
  }
  if (!pairs) {
    log.push({ date: today, action: "hold", reason: usable.length ? "no move inside the caps" : `not enough ${TUNER.horizon}-day results yet`, evidence: ev });
    return { state: next, log };
  }
  const version = `${today}`;
  next.history.push({ version: next.version, parent: next.parent || null, weights: { ...next.weights }, date: next.since || null });
  next.parent = next.version;
  next.version = version;
  next.since = today;
  next.weights = w;
  for (const k of moved) next.lastMoved[k] = today;
  if (next.history.length > 60) next.history = next.history.slice(-60);
  return { state: next, log };
}

export function initialState(base) {
  return { version: "base", parent: null, base: { ...base }, weights: { ...base }, frozen: false, lastMoved: {}, history: [] };
}

export function revertTo(state, version, today) {
  const next = structuredClone(state);
  if (version === "base") {
    next.history.push({ version: next.version, parent: next.parent, weights: { ...next.weights }, date: next.since || null });
    Object.assign(next, { version: "base", parent: null, weights: { ...next.base }, since: today, revertedAt: today });
    return next;
  }
  const h = next.history.find((x) => x.version === version);
  if (!h) throw new Error(`no weights version ${version}`);
  Object.assign(next, { version: h.version, parent: h.parent, weights: { ...h.weights }, since: today, revertedAt: today });
  return next;
}

// Accepts tuned weights only if they have the same keys as the base, sum to the
// same total, and sit inside the bounds. Anything else is ignored.
export function validWeights(base, weights) {
  if (!weights || typeof weights !== "object") return false;
  const kb = Object.keys(base).sort().join(), kw = Object.keys(weights).sort().join();
  if (kb !== kw) return false;
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  if (sum(base) !== sum(weights)) return false;
  for (const k of Object.keys(base)) {
    const v = weights[k];
    if (!Number.isInteger(v)) return false;
    if (v < Math.max(TUNER.minWeight, Math.ceil(base[k] * TUNER.floorShare)) || v > Math.floor(base[k] * TUNER.ceilShare)) return false;
  }
  return true;
}
