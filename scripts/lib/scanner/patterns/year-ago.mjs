import { addDays } from "../../tracker.mjs";
import { shownPct } from "../../span-reads.mjs";
import { nearestPoint, pack, round1 } from "../common.mjs";

export const id = "year-ago";
export const privateOnly = false;

// Same date last year, at most 3 days off. Fill may train a private grade.
export function detect(series) {
  const asOf = series?.asOf;
  if (!asOf) return null;
  const target = addDays(asOf, -365);
  const then = nearestPoint(series.points, target, 3);
  const now = nearestPoint(series.points, asOf, 3);
  if (!then || !now || then.date === now.date) return null;
  const ch = shownPct(then.price, now.price);
  if (ch == null || Math.abs(ch) < 5 || Math.abs(ch) > 500) return null;
  const exact = then.date === target && now.date === asOf;
  let stage = exact ? "confirmed" : "forming";
  const week = nearestPoint(series.points, addDays(asOf, -7), 3);
  if (week && week.date !== now.date) {
    const recent = shownPct(week.price, now.price);
    if (recent != null && ch > 0 && recent <= -Math.abs(ch) * 0.5) stage = "ending";
    if (recent != null && ch < 0 && recent >= Math.abs(ch) * 0.5) stage = "ending";
  }
  if (!exact && stage !== "ending") stage = "forming";
  return pack(id, stage, 35 + Math.min(40, Math.abs(ch) / 2), then.date, now.date, {
    pct: round1(ch), exact, startSrc: then.src || "own", endSrc: now.src || "own",
  });
}
