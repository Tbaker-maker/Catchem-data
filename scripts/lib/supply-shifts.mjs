// Supply shifts compare listings counted on two nights. A count is only a shelf
// count when that night read the whole eBay Browse result. fetch-sealed-prices
// writes priceHistory[].filteredTotal only then (second-library.mjs
// filteredTotalForNight). A capped night (150 rows read of a larger result)
// keeps whatever relevance ranking put in the first 150 rows, so its kept count
// is a sample and moves with the ranking, not with the shelf.
//
// Nov 12 to 13, 2026: mega-forces-tin kept 7 of 150 rows read (Browse total
// 327, 142 rows failed the set filter), then 86 of 150 (total 45). Both nights
// were capped samples. Compared as a shelf, that printed +1128.6% and the
// Morning Pulse schema guard stopped the run.
//
// The floor each night must clear lives in catchem-data-private
// (supply-shifts/limits.json, minListingsEachNight). No floor, no shifts.

export function wholeCount(point) {
  const n = point?.filteredTotal;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function readFloor(limits) {
  const n = Number(limits?.minListingsEachNight);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// prevPoint and nowPoint are the sealed-prices priceHistory points for the two
// nights. Returns { prev, now } when both are whole counts at or above the
// floor, otherwise { skip } with the reason.
export function comparableCounts({ prevPoint, nowPoint, floor }) {
  if (!(Number.isFinite(floor) && floor > 0)) return { skip: "no-floor" };
  const prev = wholeCount(prevPoint);
  const now = wholeCount(nowPoint);
  if (prev == null || now == null) return { skip: "capped-or-partial" };
  if (prev < floor || now < floor) return { skip: "below-floor" };
  return { prev, now };
}

export function shiftPct(prev, now) {
  return Math.round((now / prev - 1) * 1000) / 10;
}
