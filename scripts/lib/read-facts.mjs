// Per-read facts for /feed/r/* pages. Pure functions: every figure comes from
// a file we already publish, each with its own date. Missing input = no field.
import { setAgeKey } from "./year-patterns.mjs";
import { patternPasses } from "./proven-signal.mjs";
import { stageOf } from "./sealed-rating.mjs";

const DAY = 86400000;
const iso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : "");
export const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const pct = (a, b) => (a > 0 && b > 0 ? r1(((b - a) / a) * 100) : null);

// "19761:13.98,19838:13.98" (days since epoch) -> [["2024-02-07",13.98], ...]
export function unpackLong(text) {
  const out = [];
  for (const part of String(text || "").split(",")) {
    const [d, p] = part.split(":");
    const day = Number(d), price = Number(p);
    if (Number.isFinite(day) && day > 0 && price > 0) out.push([new Date(day * DAY).toISOString().slice(0, 10), price]);
  }
  return out;
}

// Long archive first, nightly days on top. Sorted, one price per day.
export function mergeHistory(longPts, nightly) {
  const map = new Map();
  for (const [d, p] of longPts || []) if (iso(d) && p > 0) map.set(iso(d), Number(p));
  for (const [d, p] of nightly || []) if (iso(d) && p > 0) map.set(iso(d), Number(p));
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Last known price on or before day (change-only archive keeps the last price).
export function priceOn(hist, day, maxGap = 8) {
  let hit = null;
  for (const pt of hist) { if (pt[0] <= day) hit = pt; else break; }
  if (!hit || daysBetween(hit[0], day) > maxGap) return null;
  return hit;
}

export function changeOver(hist, days, asOf) {
  if (!hist.length || !asOf) return null;
  const end = priceOn(hist, asOf, 3);
  const start = priceOn(hist, addDays(asOf, -days));
  if (!end || !start) return null;
  const p = pct(start[1], end[1]);
  return p == null ? null : { pct: p, from: start[0], to: end[0], p0: start[1], p1: end[1] };
}

export function highLow(hist, asOf) {
  if (hist.length < 2) return null;
  let hi = hist[0], lo = hist[0];
  for (const pt of hist) { if (pt[1] >= hi[1]) hi = pt; if (pt[1] < lo[1]) lo = pt; }
  // Most recent day at the high, not the first.
  const now = hist[hist.length - 1];
  return {
    from: hist[0][0],
    high: { price: hi[1], date: hi[0] },
    low: { price: lo[1], date: lo[0] },
    daysSinceHigh: asOf ? Math.max(0, daysBetween(hi[0], asOf)) : null,
    fromHighPct: pct(hi[1], now[1]),
    now: { price: now[1], date: now[0] },
  };
}

export function median(xs) {
  const a = xs.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Band = items sharing a key. Median 30-day change, counts up and down.
export function band(changes, minN = 5) {
  const xs = changes.filter((c) => c && Number.isFinite(c.pct));
  if (xs.length < minN) return null;
  const from = xs.map((c) => c.from).sort()[0];
  const to = xs.map((c) => c.to).sort().at(-1);
  return { n: xs.length, median: r1(median(xs.map((c) => c.pct))), up: xs.filter((c) => c.pct > 0).length, down: xs.filter((c) => c.pct < 0).length, from, to };
}

export function indexChange(series, days = 30) {
  const pts = (series || []).filter((p) => p && Number(p.v) > 0 && iso(p.d)).map((p) => [iso(p.d), Number(p.v)]);
  if (pts.length < 2) return null;
  const asOf = pts.at(-1)[0];
  const end = pts.at(-1);
  let start = null;
  const want = addDays(asOf, -days);
  for (const p of pts) if (p[0] <= want) start = p;
  if (!start) start = pts[0];
  const p = pct(start[1], end[1]);
  return p == null ? null : { pct: p, from: start[0], to: end[0] };
}

// Listings counted now vs the oldest dated count within 7 days.
export function listingsFact(byDay, asOf) {
  const days = Object.keys(byDay || {}).filter((d) => Number.isInteger(byDay[d]) && byDay[d] >= 0).sort();
  if (!days.length) return null;
  const last = days.at(-1);
  const out = { n: byDay[last], date: last };
  const back = days.filter((d) => d < last && daysBetween(d, last) <= 7);
  const prev = back[0];
  if (prev && byDay[prev] > 0) {
    out.prev = byDay[prev];
    out.prevDate = prev;
    out.pct = pct(byDay[prev], byDay[last]);
    out.span = daysBetween(prev, last);
  }
  return out;
}

// Passed year-pattern whose keys all hold for this item tonight. Needs a base rate.
export function matchPattern(patterns, itemKeys) {
  const have = new Set(itemKeys || []);
  const hits = (patterns || []).filter((p) => {
    if (!p || !Array.isArray(p.keys) || !p.keys.length || !p.keys.every((k) => have.has(k))) return false;
    if (!(Number(p.testRate) > 0) || !(Number(p.baseRate) > 0) || !(Number(p.testN) > 0)) return false;
    return patternPasses({ rate: r1(p.testRate * 100), base: r1(p.baseRate * 100), n: p.testN });
  });
  if (!hits.length) return null;
  hits.sort((a, b) => b.keys.length - a.keys.length || (b.testRate - b.baseRate) - (a.testRate - a.baseRate));
  const p = hits[0];
  return { id: p.id, rate: r1(p.testRate * 100), base: r1(p.baseRate * 100), n: p.testN, horizon: p.horizon, keys: p.keys, pass: true };
}

// Same keys run-year-patterns.mjs gives an item (set_age, rotation_stage).
export function itemKeys({ release, rotation, subtype, asOf }) {
  const keys = [];
  const age = setAgeKey(release, asOf);
  if (age) keys.push(`set_age=${age}`);
  const stage = stageOf({ release: release || null, subtype: subtype || null, rot: rotation || null });
  if (stage?.key) keys.push(`rotation_stage=${stage.key}`);
  return keys;
}

export function similar(row, peers, n = 4) {
  const price = Number(row?.price);
  if (!(price > 0)) return [];
  return (peers || [])
    .filter((p) => p && p.id !== row.id && p.kind === row.kind && Number(p.price) > 0 && String(p.scan || "").startsWith("/img/"))
    .map((p) => ({ p, d: Math.abs(Math.log(Number(p.price) / price)) }))
    .sort((a, b) => a.d - b.d || (a.p.id < b.p.id ? -1 : 1))
    .slice(0, n)
    .map(({ p }) => ({ id: p.id, name: p.name, number: p.num || "", price: Number(p.price), image: p.scan, href: p.kind === "sealed" ? `/p/${p.id}` : `/c/${p.id}` }));
}

export function gapFact({ tcg, tcgDate, ebay, ebayDate, listings }) {
  if (!(tcg > 0) || !(ebay > 0) || !iso(tcgDate) || !iso(ebayDate)) return null;
  return { tcg, tcgDate: iso(tcgDate), ebay, ebayDate: iso(ebayDate), diff: r2(ebay - tcg), pct: pct(tcg, ebay), listings: Number.isInteger(listings) ? listings : null };
}

export const _test = { addDays, pct };
