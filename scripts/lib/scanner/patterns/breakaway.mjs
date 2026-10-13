import { pack, round1 } from "../common.mjs";

export const id = "breakaway";
export const privateOnly = false;

// series.breakaway: { change, median, n, start, end, priorAbs }
export function detect(series) {
  const b = series?.breakaway;
  if (!b || !(b.n >= 20) || !b.start || !b.end || b.change == null || b.median == null) return null;
  const gap = b.change - b.median;
  const abs = Math.abs(gap);
  if (abs >= 10) {
    return pack(id, "confirmed", 40 + Math.min(40, abs), b.start, b.end, { pct: round1(b.change), medianPct: round1(b.median), gap: round1(gap), n: b.n });
  }
  if (abs >= 6) {
    return pack(id, "forming", 25 + abs, b.start, b.end, { pct: round1(b.change), medianPct: round1(b.median), gap: round1(gap), n: b.n });
  }
  if ((b.priorAbs || 0) >= 10 && abs < 4) {
    return pack(id, "ending", 30, b.start, b.end, { pct: round1(b.change), medianPct: round1(b.median), gap: round1(gap), n: b.n });
  }
  return null;
}
