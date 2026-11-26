import { addDays, pct, pointsTo } from "../common.mjs";
import { weeklySteps } from "./quiet-climb.mjs";

export const id = "quiet-high";

export function detect(series, limits, asOf) {
  if (!limits || !asOf) return null;
  const pts = pointsTo(series, asOf).filter((p) => p.date >= addDays(asOf, -limits.climbWindowDays));
  if (pts.length < 4) return null;
  const last = pts[pts.length - 1];
  if (!(last.price >= limits.priceFloor)) return null;
  const max = Math.max(...pts.map((p) => p.price));
  if (last.price !== max || !(last.price > pts[0].price)) return null;
  const steps = weeklySteps(pts, asOf, limits.climbWindowDays);
  if (steps.length < 3) return null;
  if (steps.some((s) => Math.abs(s.pct) > limits.quietWeekMaxPct)) return null;
  const absSum = steps.reduce((sum, s) => sum + Math.abs(s.pct), 0);
  if (!(absSum > 0)) return null;
  const share = Math.max(...steps.map((s) => Math.abs(s.pct))) / absSum;
  if (share > limits.oneWeekMaxShare) return null;
  const total = pct(pts[0].price, last.price);
  return { id, totalPct: total == null ? null : Math.round(total * 10) / 10, steps: steps.length, asOf, price: last.price };
}
