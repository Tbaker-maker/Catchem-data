import { addDays } from "../../tracker.mjs";
import { releaseEnds, shownPct } from "../../span-reads.mjs";
import { daysBetween, nearestPoint, pack, round1 } from "../common.mjs";

export const id = "release-window";
export const privateOnly = false;

// Last year's 30 days after the release anniversary, reused from the span reader.
// Forming in the first 14 days of this year's stretch, confirmed after that, ending in the two weeks after the stretch.
export function detect(series) {
  const asOf = series?.asOf;
  if (!asOf || !series.release) return null;
  const mode = releaseEnds(series.release, asOf) || justAfter(series.release, asOf);
  if (!mode) return null;
  const start = nearestPoint(series.points, mode.start, 3);
  const end = nearestPoint(series.points, mode.end, 3);
  if (!start || !end || start.date === end.date) return null;
  if (daysBetween(start.date, end.date) < 24) return null;
  const ch = shownPct(start.price, end.price);
  if (ch == null || Math.abs(ch) < 5 || Math.abs(ch) > 500) return null;
  const ann = addDays(mode.start, 365);
  const age = daysBetween(ann, asOf);
  let stage = "forming";
  if (age > 14 && age <= 30) stage = "confirmed";
  if (age > 30) stage = "ending";
  return pack(id, stage, 40 + Math.min(30, Math.abs(ch)), start.date, end.date, {
    pct: round1(ch), mode: "release", startSrc: start.src || "own", endSrc: end.src || "own",
  });
}

function justAfter(release, asOf) {
  const later = addDays(asOf, -20);
  return releaseEnds(release, later);
}