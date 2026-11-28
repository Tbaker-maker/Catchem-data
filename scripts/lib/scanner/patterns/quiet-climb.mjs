import { addDays, daysBetween, pct, pointsTo } from "../common.mjs";

export const id = "quiet-climb";

export function weeklySteps(points, asOf, windowDays) {
  const pts = pointsTo(points, asOf).filter((p) => p.date >= addDays(asOf, -windowDays));
  if (pts.length < 2) return [];
  const steps = [];
  let cursor = pts[0];
  for (const p of pts.slice(1)) {
    if (daysBetween(cursor.date, p.date) < 6) continue;
    const change = pct(cursor.price, p.price);
    if (change == null) continue;
    steps.push({ from: cursor.date, to: p.date, pct: change });
    cursor = p;
  }
  return steps;
}

export function detect(series, limits, asOf) {
  if (!limits || !asOf) return null;
  const pts = pointsTo(series, asOf);
  if (!pts.length) return null;
  const last = pts[pts.length - 1];
  if (!(last.price >= limits.priceFloor)) return null;
  const steps = weeklySteps(pts, asOf, limits.climbWindowDays);
  if (steps.length < 3) return null;
  const first = pts.find((p) => p.date >= addDays(asOf, -limits.climbWindowDays)) || pts[0];
  const total = pct(first.price, last.price);
  if (total == null || total < limits.climbMinPct) return null;
  if (steps.some((s) => s.pct > limits.climbMaxWeekPct)) return null;
  const absSum = steps.reduce((sum, s) => sum + Math.abs(s.pct), 0);
  if (!(absSum > 0)) return null;
  const share = Math.max(...steps.map((s) => Math.abs(s.pct))) / absSum;
  if (share > limits.oneWeekMaxShare) return null;
  return { id, totalPct: Math.round(total * 10) / 10, steps: steps.length, asOf, price: last.price };
}
