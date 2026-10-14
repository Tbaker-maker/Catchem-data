// Shared chart math for the scanner. Every price and listing count stays on its own date.
// Public copy never uses a fill point. Fill points may train private grades only.

import { addDays } from "../tracker.mjs";

export { addDays };
export const DAY_MS = 86400000;
export const HALF_LIFE_DAYS = 180;
export const EXPLORE_SHARE = 0.3;
export const TOP_SEALED = 40;
export const TOP_SINGLES = 40;
export const SCORE_SINGLE_CAP = 14000;
export const SCORE_SEALED_CAP = 2000;
export const DAILY_REPLAY_CAP = 400;
export const MIN_PUBLIC_PRICE = 5;
export const SCANNER_VERSION = 2;
export const GROUP_GAP_POINTS = 5;
export const GROUP_MIN_N = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function dayNum(iso) {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function daysBetween(a, b) {
  return dayNum(b) - dayNum(a);
}

export function pct(from, to) {
  if (!(from > 0) || !(to > 0)) return null;
  return ((to - from) / from) * 100;
}

export function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

export function hash32(text) {
  let h = 2166136261;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function bucketOf(id) {
  return hash32(id) % 7;
}

export function seedFromDate(iso) {
  return hash32(`scanner|${iso}`);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointsTo(points, asOf) {
  const out = [];
  for (const p of points || []) {
    if (!p || !DAY.test(p.date) || !(p.price > 0) || p.date > asOf) continue;
    out.push(p);
  }
  return out;
}

export function sliceWindow(points, asOf, days) {
  const from = addDays(asOf, -days);
  return pointsTo(points, asOf).filter((p) => p.date >= from);
}

export function maxStepPct(pts) {
  let max = 0;
  for (let i = 1; i < pts.length; i += 1) {
    const step = Math.abs(pct(pts[i - 1].price, pts[i].price) || 0);
    if (step > max) max = step;
  }
  return max;
}

export function pack(pattern, stage, strength, start, end, metrics) {
  return {
    pattern,
    stage,
    strength: Math.max(0, Math.min(100, Math.round(strength))),
    dates: { start, end },
    metrics: metrics || {},
  };
}

// dir +1 climb, -1 slide. Confirmed is 8% to 40% over 21 to 60 days.
// Forming is 4% to 8%. Ending means that shape was in place 7 days ago and the latest week no longer extends it.
export function detectTrend(series, params, dir, pattern) {
  const asOf = series?.asOf || series?.points?.at?.(-1)?.date;
  if (!asOf) return null;
  const spanDays = params?.windowDays || 45;
  const pts = sliceWindow(series.points, asOf, spanDays);
  const priorCut = addDays(asOf, -7);
  const prior = sliceWindow(series.points, priorCut, spanDays);
  const ended = trendStage(prior, dir);
  if (ended === "confirmed") {
    const recent = pct(prior.at(-1).price, pts.at(-1)?.price ?? prior.at(-1).price);
    const directedRecent = recent == null ? null : recent * dir;
    if (directedRecent != null && directedRecent <= 1) {
      return pack(pattern, "ending", 40 + Math.min(30, endedStrength(prior, dir)), prior[0].date, pts.at(-1).date, {
        pct: round1(pct(prior[0].price, pts.at(-1).price)),
        priorPct: round1(pct(prior[0].price, prior.at(-1).price)),
      });
    }
  }
  if (pts.length < 4) return null;
  const span = daysBetween(pts[0].date, pts.at(-1).date);
  if (span < 21 || span > 60) return null;
  const net = pct(pts[0].price, pts.at(-1).price);
  if (net == null) return null;
  const directed = net * dir;
  const step = maxStepPct(pts);
  const stepOk = directed > 0 && step <= directed * 0.65;
  const extreme = dir > 0 ? Math.max(...pts.map((p) => p.price)) : Math.min(...pts.map((p) => p.price));
  const atEdge = dir > 0 ? pts.at(-1).price >= extreme * 0.98 : pts.at(-1).price <= extreme * 1.02;
  if (directed >= 8 && directed <= 40 && stepOk && atEdge) {
    return pack(pattern, "confirmed", 50 + directed, pts[0].date, pts.at(-1).date, { pct: round1(net) });
  }
  if (directed >= 4 && directed < 8 && stepOk) {
    return pack(pattern, "forming", 30 + directed, pts[0].date, pts.at(-1).date, { pct: round1(net) });
  }
  return null;
}

function trendStage(pts, dir) {
  if (!pts || pts.length < 4) return "";
  const span = daysBetween(pts[0].date, pts.at(-1).date);
  if (span < 21 || span > 60) return "";
  const net = pct(pts[0].price, pts.at(-1).price);
  if (net == null) return "";
  const directed = net * dir;
  const stepOk = directed > 0 && maxStepPct(pts) <= directed * 0.65;
  if (directed >= 8 && directed <= 40 && stepOk) return "confirmed";
  return "";
}

function endedStrength(pts, dir) {
  return Math.abs(pct(pts[0].price, pts.at(-1).price) || 0);
}

// Flat range, then a move out of it. Range is (high-low)/low.
export function detectBreakout(series, params, pattern = "breakout") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const days = params?.windowDays || 50;
  const pts = sliceWindow(series.points, asOf, days);
  if (pts.length < 5) return null;
  const last = pts.at(-1);
  const body = pts.filter((p) => p.date <= addDays(asOf, -5));
  if (body.length < 4 || daysBetween(body[0].date, body.at(-1).date) < 20) return null;
  const lo = Math.min(...body.map((p) => p.price));
  const hi = Math.max(...body.map((p) => p.price));
  if (!(lo > 0)) return null;
  const rangePct = ((hi - lo) / lo) * 100;
  if (rangePct > 8) return null;
  const over = ((last.price - hi) / hi) * 100;
  if (last.price >= hi * 1.05) {
    return pack(pattern, "confirmed", 60 + Math.min(30, over), body[0].date, last.date, { pct: round1(over), rangePct: round1(rangePct) });
  }
  if (last.price >= hi * 1.02) {
    return pack(pattern, "forming", 35 + over, body[0].date, last.date, { pct: round1(over), rangePct: round1(rangePct) });
  }
  const peak = pts.slice(0, -1).filter((p) => p.price >= hi * 1.05);
  if (peak.length && last.price <= hi) {
    return pack(pattern, "ending", 45, peak[0].date, last.date, { pct: round1(pct(peak[0].price, last.price)), rangePct: round1(rangePct) });
  }
  return null;
}

export function detectSpike(series, params, pattern = "sharp-spike") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const pts = sliceWindow(series.points, asOf, params?.windowDays || 14);
  if (pts.length < 3) return null;
  let best = null;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const span = daysBetween(pts[i].date, pts[j].date);
      if (span < 1 || span > 5) continue;
      const ch = pct(pts[i].price, pts[j].price);
      if (ch == null) continue;
      if (!best || ch > best.ch) best = { i, j, ch, span };
    }
  }
  if (!best) return null;
  const last = pts.at(-1);
  const peak = pts[best.j];
  const gave = pct(peak.price, last.price);
  const halfBack = gave != null && peak.price > pts[best.i].price && (peak.price - last.price) >= 0.5 * (peak.price - pts[best.i].price);
  if (best.ch >= 15 && halfBack && last.date !== peak.date) {
    return pack(pattern, "ending", 55, pts[best.i].date, last.date, { pct: round1(pct(pts[best.i].price, last.price)), spikePct: round1(best.ch) });
  }
  if (best.ch >= 15 && last.date === peak.date) {
    return pack(pattern, "confirmed", 50 + Math.min(40, best.ch), pts[best.i].date, peak.date, { pct: round1(best.ch) });
  }
  if (best.ch >= 8 && best.ch < 15) {
    return pack(pattern, "forming", 25 + best.ch, pts[best.i].date, pts[best.j].date, { pct: round1(best.ch) });
  }
  return null;
}

export function detectRevert(series, params, pattern = "spike-revert") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const pts = sliceWindow(series.points, asOf, params?.windowDays || 21);
  if (pts.length < 4) return null;
  let spike = null;
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const span = daysBetween(pts[i].date, pts[j].date);
      if (span < 1 || span > 5) continue;
      const ch = pct(pts[i].price, pts[j].price);
      if (ch != null && ch >= 15 && (!spike || ch > spike.ch)) spike = { i, j, ch };
    }
  }
  if (!spike) return null;
  const start = pts[spike.i];
  const peak = pts[spike.j];
  const gain = peak.price - start.price;
  if (!(gain > 0)) return null;
  let revert = null;
  for (let k = spike.j + 1; k < pts.length; k += 1) {
    if (daysBetween(peak.date, pts[k].date) > 7) break;
    if ((peak.price - pts[k].price) >= 0.5 * gain) { revert = pts[k]; break; }
  }
  if (!revert) {
    return pack(pattern, "forming", 30 + Math.min(20, spike.ch), start.date, peak.date, {
      spikePct: round1(spike.ch), pct: round1(spike.ch), peak: peak.price, peakDate: peak.date,
    });
  }
  const last = pts.at(-1);
  const after = pct(revert.price, last.price);
  if (last.date !== revert.date && after != null && Math.abs(after) < 3) {
    return pack(pattern, "ending", 50, start.date, last.date, {
      spikePct: round1(spike.ch), pct: round1(pct(start.price, last.price)), peak: peak.price, peakDate: peak.date,
    });
  }
  return pack(pattern, "confirmed", 60, start.date, revert.date, {
    spikePct: round1(spike.ch), pct: round1(pct(start.price, revert.price)), peak: peak.price, peakDate: peak.date,
  });
}

export function detectRecovery(series, params, pattern = "recovery") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const pts = sliceWindow(series.points, asOf, params?.windowDays || 60);
  if (pts.length < 5) return null;
  let lowI = 0;
  for (let i = 1; i < pts.length; i += 1) if (pts[i].price < pts[lowI].price) lowI = i;
  if (lowI < 2 || lowI > pts.length - 2) return null;
  const before = pts.slice(0, lowI + 1);
  const highBefore = before.reduce((m, p) => (p.price > m.price ? p : m), before[0]);
  const drop = pct(highBefore.price, pts[lowI].price);
  const rise = pct(pts[lowI].price, pts.at(-1).price);
  if (drop == null || rise == null || drop > -10) return null;
  if (pts.at(-1).price >= highBefore.price * 0.98) {
    return pack(pattern, "ending", 55, highBefore.date, pts.at(-1).date, { pct: round1(pct(highBefore.price, pts.at(-1).price)), dropPct: round1(drop) });
  }
  if (rise >= 8) {
    return pack(pattern, "confirmed", 50 + Math.min(30, rise), pts[lowI].date, pts.at(-1).date, { pct: round1(rise), dropPct: round1(drop) });
  }
  if (rise >= 3) {
    return pack(pattern, "forming", 30 + rise, pts[lowI].date, pts.at(-1).date, { pct: round1(rise), dropPct: round1(drop) });
  }
  return null;
}

export function detectFlat(series, params, pattern = "flat-range") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const pts = sliceWindow(series.points, asOf, params?.windowDays || 40);
  if (pts.length < 4) return null;
  const span = daysBetween(pts[0].date, pts.at(-1).date);
  if (span < 21) return null;
  const lo = Math.min(...pts.map((p) => p.price));
  const hi = Math.max(...pts.map((p) => p.price));
  const rangePct = ((hi - lo) / lo) * 100;
  const prior = pts.slice(0, -1);
  if (prior.length >= 4) {
    const plo = Math.min(...prior.map((p) => p.price));
    const phi = Math.max(...prior.map((p) => p.price));
    const pr = ((phi - plo) / plo) * 100;
    const outside = pts.at(-1).price > phi * 1.03 || pts.at(-1).price < plo * 0.97;
    if (pr <= 8 && outside) {
      return pack(pattern, "ending", 50, prior[0].date, pts.at(-1).date, { rangePct: round1(pr), pct: round1(pct(prior.at(-1).price, pts.at(-1).price)) });
    }
  }
  if (rangePct <= 8) {
    return pack(pattern, "confirmed", 40 + (8 - rangePct), pts[0].date, pts.at(-1).date, { rangePct: round1(rangePct), pct: round1(pct(pts[0].price, pts.at(-1).price)) });
  }
  if (rangePct <= 12) {
    const mid = Math.floor(pts.length / 2);
    const a = pts.slice(0, mid);
    const b = pts.slice(mid);
    const ar = a.length ? (Math.max(...a.map((p) => p.price)) - Math.min(...a.map((p) => p.price))) / Math.min(...a.map((p) => p.price)) : 1;
    const br = b.length ? (Math.max(...b.map((p) => p.price)) - Math.min(...b.map((p) => p.price))) / Math.min(...b.map((p) => p.price)) : 1;
    if (br < ar) return pack(pattern, "forming", 25, pts[0].date, pts.at(-1).date, { rangePct: round1(rangePct) });
  }
  return null;
}

export function listingChange(series) {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const rows = (series.listings || []).filter((p) => DAY.test(p.date) && p.n >= 0 && p.date <= asOf);
  if (rows.length < 2) return null;
  const a = rows[0];
  const b = rows[rows.length - 1];
  if (a.date === b.date || daysBetween(a.date, b.date) < 7) return null;
  const lPct = pct(a.n, b.n);
  const prices = pointsTo(series.points, asOf);
  const ps = nearest(prices, a.date, 3);
  const pe = nearest(prices, b.date, 3);
  if (!ps || !pe || ps.date === pe.date) return null;
  const pPct = pct(ps.price, pe.price);
  if (lPct == null || pPct == null) return null;
  return { a, b, lPct, pPct, ps, pe };
}

function nearest(points, day, slack) {
  let best = null;
  for (const p of points) {
    const dist = Math.abs(daysBetween(day, p.date));
    if (dist > slack) continue;
    if (!best || dist < best.dist || (dist === best.dist && p.date < best.p.date)) best = { dist, p };
  }
  return best ? best.p : null;
}

// mode: down-flat, up-flat, both-up, both-down
export function detectListings(series, params, mode, pattern) {
  const row = listingChange(series);
  if (!row) return null;
  const priceFlat = Math.abs(row.pPct) <= 3;
  let stage = "";
  if (mode === "down-flat" && priceFlat && row.lPct <= -10) stage = "confirmed";
  else if (mode === "down-flat" && priceFlat && row.lPct <= -5) stage = "forming";
  else if (mode === "up-flat" && priceFlat && row.lPct >= 10) stage = "confirmed";
  else if (mode === "up-flat" && priceFlat && row.lPct >= 5) stage = "forming";
  else if (mode === "both-up" && row.lPct >= 5 && row.pPct >= 5) stage = "confirmed";
  else if (mode === "both-up" && row.lPct >= 3 && row.pPct >= 3) stage = "forming";
  else if (mode === "both-down" && row.lPct <= -5 && row.pPct <= -5) stage = "confirmed";
  else if (mode === "both-down" && row.lPct <= -3 && row.pPct <= -3) stage = "forming";
  if (!stage) {
    const shorter = { ...series, listings: (series.listings || []).slice(0, -1), asOf: series.listings?.at?.(-2)?.date || series.asOf };
    const prev = shorter.listings?.length >= 2 ? listingChange(shorter) : null;
    if (prev && ((mode === "down-flat" && prev.lPct <= -10 && Math.abs(prev.pPct) <= 3) || (mode === "both-up" && prev.lPct >= 5 && prev.pPct >= 5))) {
      if (Math.abs(row.lPct) < Math.abs(prev.lPct) - 2) {
        return pack(pattern, "ending", 40, prev.a.date, row.b.date, { listingsPct: round1(row.lPct), pct: round1(row.pPct), listingsFrom: row.a.n, listingsTo: row.b.n });
      }
    }
    return null;
  }
  return pack(pattern, stage, stage === "confirmed" ? 60 : 35, row.ps.date, row.pe.date, {
    listingsPct: round1(row.lPct),
    pct: round1(row.pPct),
    listingsFrom: row.a.n,
    listingsTo: row.b.n,
    listingsStart: row.a.date,
    listingsEnd: row.b.date,
    priceStart: row.ps.price,
    priceEnd: row.pe.price,
  });
}

export function detectThinJump(series, pattern = "thin-jump") {
  const row = listingChange(series);
  if (!row) return null;
  if (row.b.n > 20) return null;
  if (!(row.lPct <= -30) || !(row.pPct >= 10)) return null;
  if (daysBetween(row.a.date, row.b.date) > 21) return null;
  return pack(pattern, "confirmed", 70 + Math.min(20, row.pPct), row.ps.date, row.pe.date, {
    listingsPct: round1(row.lPct),
    pct: round1(row.pPct),
    listingsFrom: row.a.n,
    listingsTo: row.b.n,
    listingsStart: row.a.date,
    listingsEnd: row.b.date,
    priceStart: row.ps.price,
    priceEnd: row.pe.price,
  });
}

export function nearestPoint(points, day, slack) {
  return nearest(points, day, slack);
}

// Staircase (Tyler market model): flat base, pump, dump that holds a higher low,
// flat again at a higher base, repeating.
// forming = second flat base above the prior one
// confirmed = a new pump from that higher base
// ending = a dump that holds above the prior base
export function detectStaircase(series, params, pattern = "staircase") {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const pts = sliceWindow(series.points, asOf, params?.windowDays || 90);
  if (pts.length < 8) return null;

  const coarse = [];
  let lastKept = null;
  for (const p of pts) {
    if (!lastKept || daysBetween(lastKept.date, p.date) >= 5) {
      coarse.push(p);
      lastKept = p;
    }
  }
  if (coarse.at(-1)?.date !== pts.at(-1).date) coarse.push(pts.at(-1));
  if (coarse.length < 6) return null;

  const bases = [];
  for (let i = 0; i < coarse.length; i += 1) {
    for (let j = i + 2; j < coarse.length; j += 1) {
      const span = daysBetween(coarse[i].date, coarse[j].date);
      if (span < 10) continue;
      if (span > 28) break;
      const slice = coarse.slice(i, j + 1);
      const lo = Math.min(...slice.map((p) => p.price));
      const hi = Math.max(...slice.map((p) => p.price));
      if (!(lo > 0)) continue;
      const rangePct = ((hi - lo) / lo) * 100;
      if (rangePct > 6) continue;
      bases.push({
        i, j, lo, hi,
        mean: (lo + hi) / 2,
        start: coarse[i].date,
        end: coarse[j].date,
        rangePct,
      });
    }
  }
  bases.sort((a, b) => a.i - b.i || (b.j - b.i) - (a.j - a.i));
  const picked = [];
  for (const b of bases) {
    if (picked.length && b.i <= picked[picked.length - 1].j) continue;
    picked.push(b);
  }
  if (picked.length < 1) return null;

  let stair = null;
  for (let k = 0; k < picked.length - 1; k += 1) {
    const a = picked[k];
    const b = picked[k + 1];
    if (!(b.lo > a.lo * 1.02)) continue;
    const mid = coarse.slice(a.j, b.i + 1);
    if (mid.length < 2) continue;
    const peak = Math.max(...mid.map((p) => p.price));
    const pumpPct = ((peak - a.mean) / a.mean) * 100;
    if (pumpPct < 8) continue;
    stair = { a, b, peak, pumpPct };
  }

  // One completed base, then a pump and a higher-low dump that has not flattened yet.
  if (!stair && picked.length >= 1) {
    const a = picked[0];
    const after = coarse.slice(a.j);
    if (after.length >= 3) {
      let peakI = 0;
      for (let i = 1; i < after.length; i += 1) if (after[i].price > after[peakI].price) peakI = i;
      const peak = after[peakI];
      const pumpPct = ((peak.price - a.mean) / a.mean) * 100;
      const last = after[after.length - 1];
      if (pumpPct >= 8 && peakI >= 1 && peakI < after.length - 1) {
        const dumpPct = pct(peak.price, last.price);
        if (dumpPct != null && dumpPct <= -5 && last.price > a.lo * 1.02) {
          return pack(pattern, "ending", 45 + Math.min(25, pumpPct), a.start, last.date, {
            pct: round1(pct(a.mean, last.price)),
            pumpPct: round1(pumpPct),
            baseLo: round1(a.lo),
            higherLo: round1(last.price),
          });
        }
      }
      if (pumpPct >= 8 && peakI === after.length - 1 && picked.length >= 1 && a.lo > 0) {
        // Need a prior higher-base context: only confirm pump when a second base already exists.
      }
    }
  }

  if (!stair) return null;

  const last = coarse[coarse.length - 1];
  const { a: prior, b: higher, peak, pumpPct } = stair;
  const after = coarse.filter((p) => p.date > higher.end);
  const metrics = {
    pct: round1(pct(prior.mean, last.price)),
    pumpPct: round1(pumpPct),
    baseLo: round1(prior.lo),
    higherLo: round1(higher.lo),
    bases: 2,
  };

  if (after.length >= 2) {
    let peakAfter = higher.hi;
    for (const p of after) if (p.price > peakAfter) peakAfter = p.price;
    const rise = pct(higher.mean, last.price);
    const fromPeak = pct(peakAfter, last.price);
    if (rise != null && rise >= 5 && last.price >= peakAfter * 0.97) {
      return pack(pattern, "confirmed", 55 + Math.min(30, rise), prior.start, last.date, {
        ...metrics, pct: round1(rise), fromBase: round1(higher.mean),
      });
    }
    if (fromPeak != null && fromPeak <= -5 && last.price > prior.lo * 1.02) {
      return pack(pattern, "ending", 50 + Math.min(20, Math.abs(fromPeak)), prior.start, last.date, {
        ...metrics, pct: round1(pct(higher.mean, last.price)),
      });
    }
  }

  // Second flat base above the prior one.
  const inHigher = last.price <= higher.hi * 1.03 && last.price >= higher.lo * 0.97;
  if (inHigher || after.length <= 1) {
    return pack(pattern, "forming", 40 + Math.min(20, ((higher.lo - prior.lo) / prior.lo) * 100), prior.start, higher.end, metrics);
  }
  return null;
}
