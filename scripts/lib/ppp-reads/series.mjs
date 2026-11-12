// Dated series helpers for the PkmnPrices pathways. Every value stays on its own date.
// No filling, no interpolation. A missing value means the read is not written.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s) => typeof s === "string" && DAY.test(s);
export const dayNum = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
export const daysBetween = (a, b) => dayNum(b) - dayNum(a);
export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
export const dayOf = (ts) => (typeof ts === "string" ? ts.slice(0, 10) : "");
export const cents = (n) => Math.round(Number(n) * 100);
export const round1 = (n) => Math.round(Number(n) * 10) / 10;
export const round2 = (n) => Math.round(Number(n) * 100) / 100;

export function pct(from, to) {
  if (!(from > 0) || !(to > 0)) return null;
  return ((to - from) / from) * 100;
}

export function median(values) {
  const xs = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

// Half-price filter, same rule as the eBay Insights client (PR #64): a comp is
// left out when it is half or less of any other comp in the same window.
export function atLeastHalfBelow(price, other) {
  if (!Number.isFinite(price) || !Number.isFinite(other) || other <= 0 || price <= 0) return false;
  return cents(price) * 2 <= cents(other);
}
export function dropHalfPrice(rows) {
  const prices = rows.map((r) => r.price);
  const kept = [];
  const dropped = [];
  rows.forEach((r, i) => {
    if (prices.some((other, j) => j !== i && atLeastHalfBelow(r.price, other))) dropped.push(r);
    else kept.push(r);
  });
  return { kept, dropped };
}

// Rows with { date } on or before asOf, and after asOf - days.
export function inWindow(rows, asOf, days, field = "date") {
  const from = addDays(asOf, -days);
  return (rows || []).filter((r) => isDay(r?.[field]) && r[field] > from && r[field] <= asOf);
}

export function upTo(rows, asOf, field = "date") {
  return (rows || []).filter((r) => isDay(r?.[field]) && r[field] <= asOf);
}

// Nearest point to `day` within `slack` days, never after asOf.
export function pointNear(points, day, slack, asOf = day) {
  let best = null;
  for (const p of points || []) {
    if (!p || !isDay(p.date) || !(p.price > 0) || p.date > asOf) continue;
    const gap = Math.abs(daysBetween(p.date, day));
    if (gap > slack) continue;
    if (!best || gap < best.gap || (gap === best.gap && p.date > best.p.date)) best = { p, gap };
  }
  return best ? best.p : null;
}

// Latest point on or before `day`, no older than `slack` days.
export function pointAtOrBefore(points, day, slack) {
  let best = null;
  for (const p of points || []) {
    if (!p || !isDay(p.date) || !(p.price > 0) || p.date > day) continue;
    if (daysBetween(p.date, day) > slack) continue;
    if (!best || p.date > best.date) best = p;
  }
  return best;
}
