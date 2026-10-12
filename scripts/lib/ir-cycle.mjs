// IR cycle: factual position data for Illustration Rares and Special
// Illustration Rares in sets still in Standard. Every number carries its date.
// The order of the watchlist is private (popularity weight plus position).
// Public rows state facts only. This is a factual signal, not advice.
import { popularity } from "./popular-pokemon.mjs";

export const STUDY = {
  asOf: "2026-10-12",
  doc: "Catch'em IR Study v2",
  early: {
    IR: { pct: -14, n: 241, text: "IRs from sets released Mar 2025 to Feb 2026 moved a median 14% down in their first 6 months (241 cards)." },
    SIR: { pct: -19, n: 68, text: "SIRs from sets released Mar 2025 to Feb 2026 moved a median 19% down in their first 6 months (68 cards)." },
  },
  later: {
    IR: { pct: 116, n: 219, text: "IRs from 2023 and 2024 Scarlet & Violet sets rose a median 116% from one year after release to Oct 12, 2026 (219 cards). Plain holos from the same sets rose 91%." },
    SIR: { pct: 18, n: 104, text: "SIRs from 2023 and 2024 Scarlet & Violet sets rose a median 18% from one year after release to Oct 12, 2026 (104 cards). Plain holos from the same sets rose 91%." },
  },
};

const DAY = 86400000;
export const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const epochDay = (n) => new Date(Number(n) * DAY).toISOString().slice(0, 10);

export function kindOf(row) {
  if (row.rarity === "Illustration Rare") return "IR";
  if (row.rarity === "Special Illustration Rare") return "SIR";
  return "";
}

// Merge change-only long history ("days:price,...") with nightly hist.
export function series(row, longStr) {
  const map = new Map();
  for (const part of String(longStr || "").split(",")) {
    const [d, v] = part.split(":");
    if (d && Number(v) > 0) map.set(epochDay(d), Number(v));
  }
  for (const [d, v] of row.hist || []) if (Number(v) > 0) map.set(d, Number(v));
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function priceAt(pts, day, tol = 8) {
  let hit = null;
  for (const p of pts) { if (p[0] <= day) hit = p; else break; }
  return hit && days(hit[0], day) <= tol ? hit : null;
}

export function trend(pts, end, back) {
  const now = priceAt(pts, end, 3);
  const then = priceAt(pts, new Date(Date.parse(end) - back * DAY).toISOString().slice(0, 10));
  if (!now || !then) return null;
  return { pct: Math.round((now[1] / then[1] - 1) * 100), from: { date: then[0], price: then[1] }, to: { date: now[0], price: now[1] } };
}

export function range(pts) {
  if (!pts.length) return null;
  let lo = pts[0], hi = pts[0];
  for (const p of pts) { if (p[1] < lo[1]) lo = p; if (p[1] >= hi[1]) hi = p; }
  return { low: { date: lo[0], price: lo[1] }, high: { date: hi[0], price: hi[1] }, since: pts[0][0] };
}

// 0 = at its lowest on file, 100 = at its highest.
export function rangePos(r, price) {
  if (!r || r.high.price <= r.low.price) return null;
  return Math.round(((price - r.low.price) / (r.high.price - r.low.price)) * 100);
}

export function positionText(pos) {
  if (pos == null) return "";
  if (pos <= 10) return "Near its lowest on file";
  if (pos >= 90) return "Near its highest on file";
  if (pos <= 35) return "In the lower third of its range on file";
  if (pos >= 65) return "In the upper third of its range on file";
  return "In the middle of its range on file";
}

export function curveNote(kind, age) {
  if (age < 183) return { stage: "first 6 months", text: STUDY.early[kind].text };
  if (age < 365) return { stage: "6 to 12 months", text: `${STUDY.early[kind].text} ${STUDY.later[kind].text}` };
  return { stage: "past one year", text: STUDY.later[kind].text };
}

export function rotationChip(rot, slug, today) {
  const row = (rot?.sets || []).find((s) => s.slug === slug);
  if (!row || !row.mark) return null;
  const src = (rot.sources || []).find((s) => s.mark === row.mark);
  if (src) {
    const d = days(today, src.date);
    return d > 0
      ? { mark: row.mark, text: `Rotates in ${d} days (${src.text}, mark ${row.mark})`, date: src.date, official: true }
      : { mark: row.mark, text: `Rotated ${src.text} (mark ${row.mark})`, date: src.date, official: true };
  }
  const exp = (rot.expected || []).find((e) => e.mark === row.mark);
  if (exp) return { mark: row.mark, text: `Mark ${row.mark}: rotation date not announced. Expected window: ${exp.window}`, official: false, basis: exp.basis };
  return null;
}

// Sealed eBay listings counted for a set, from our nightly raw eBay files.
// One product per set, picked by a fixed order: booster box, ETB, bundle, pack.
const SUBTYPE_ORDER = ["booster-box", "etb", "booster-bundle", "booster-pack"];
export function listingsBySet(latest, previous) {
  const prevById = new Map((previous?.products || []).map((p) => [p.id, p]));
  const out = new Map();
  const date = String(latest?.updatedAt || "").slice(0, 10);
  const pdate = String(previous?.updatedAt || "").slice(0, 10);
  for (const p of latest?.products || []) {
    const rank = SUBTYPE_ORDER.indexOf(p.subtype);
    if (rank < 0 || !Number.isInteger(p.listingCount) || !p.set) continue;
    const key = String(p.set).toLowerCase();
    const cur = out.get(key);
    if (cur && cur._rank <= rank) continue;
    const pv = prevById.get(p.id);
    out.set(key, { _rank: rank, id: p.id, name: p.name, n: p.listingCount, date, prev: pv && Number.isInteger(pv.listingCount) ? { n: pv.listingCount, date: pdate } : null });
  }
  return out;
}
export function setListings(bySet, setName) {
  const bare = String(setName || "").replace(/^[A-Z0-9]+:\s*/, "").toLowerCase();
  const hit = bySet?.get?.(bare);
  if (!hit) return null;
  const { _rank, ...pub } = hit;
  return pub;
}

export function buildRows({ rows, longRows, rot, bySet, today }) {
  const out = [];
  for (const r of rows) {
    const kind = kindOf(r);
    if (!kind || r.kind !== "single" || !r.release || !r.setSlug) continue;
    const status = (rot?.sets || []).find((s) => s.slug === r.setSlug)?.status || "";
    if (/^Rotated/.test(status)) continue;
    if (r.release < "2024-03-01" || /promo|miscellaneous/i.test(r.set || "")) continue;
    const pts = series(r, longRows[r.id]);
    const now = priceAt(pts, today, 3);
    if (!now) continue;
    const age = days(r.release, today);
    const rg = range(pts);
    const pos = rangePos(rg, now[1]);
    const pop = popularity(r.name);
    const t30 = trend(pts, today, 30);
    const t90 = trend(pts, today, 90);
    out.push({
      id: r.id, name: r.name, num: r.num, set: r.set, setSlug: r.setSlug, kind,
      release: r.release, daysSinceRelease: age,
      price: { price: now[1], date: now[0], source: "TCGplayer market" },
      low: rg.low, high: rg.high, onFileSince: rg.since,
      position: positionText(pos), positionPct: pos,
      trend30: t30, trend90: t90,
      setListings: setListings(bySet, r.set),
      curve: curveNote(kind, age),
      rotation: rotationChip(rot, r.setSlug, today),
      popularity: pop.tags,
      _score: pop.weight * 2 + (pos == null ? 0 : (100 - pos) / 25) + (age >= 183 ? 1 : 0),
    });
  }
  out.sort((a, b) => b._score - a._score || a.price.price - b.price.price);
  return out.map((row, i) => { const { _score, ...pub } = row; return { rank: i + 1, ...pub }; });
}

const BANNED = /\b(buy|buying|sell|selling|hold|bottom(ed)?|support|resistance|target|invest\w*|load up|best time)\b/i;
export function cleanCopy(text) { return !BANNED.test(String(text || "")) && !/\u2014/.test(String(text || "")); }
