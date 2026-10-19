// IR cycle: factual position data for Illustration Rares and Special
// Illustration Rares in sets still in Standard. Every number carries its date.
// The order of the watchlist is private (popularity weight plus position).
// Public rows state facts only. This is a factual signal, not advice.
import { banGuard } from "./copy-rules.mjs";
import { popularity, popShare } from "./popular-pokemon.mjs";

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
  const num = String(row.num || "");
  if (row.rarity === "Illustration Rare") return "IR";
  if (row.rarity === "Special Illustration Rare") return "SIR";
  if (/^TG\d/i.test(num)) return "TG";
  if (/^GG\d/i.test(num)) return "GG";
  if (/Alternate (Full )?Art|Alternate Art Secret/i.test(String(row.name || ""))) {
    // SM Tag Teams with alternate art are "Tag Team (Alternate Art)", never SWSH alt arts.
    if (/ & /.test(String(row.name || "")) || String(row.release || "") < "2020-02") return "TTALT";
    if (String(row.release || "") < "2023") return "ALT";
  }
  return "";
}
export const KIND_LABEL = { IR: "Illustration Rare", SIR: "Special Illustration Rare", TG: "Trainer Gallery", GG: "Galarian Gallery", ALT: "Alternate Art", TTALT: "Tag Team (Alternate Art)" };
// SWSH mapping from Tyler: TG and GG are the IR of that generation, alt arts the SIR.
// Internal analysis only. Public text always names the card's own rarity or tag.
export const CURVE_KIND = { IR: "IR", TG: "IR", GG: "IR", SIR: "SIR", ALT: "SIR", TTALT: "SIR" };
export const eraOf = (row) => (/^(SV|ME)/.test(String(row.set || "")) || String(row.release || "") >= "2023-03" ? "SV and Mega" : "Sword & Shield");

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

export function curveNote(kind0, age, rotated) {
  const kind = CURVE_KIND[kind0] || kind0;
  if (kind0 === "TG" || kind0 === "GG") return { stage: rotated ? "after rotation" : "past one year", text: "Sword & Shield Trainer Gallery cards rose a median 129% in the 6 months before their sets rotated on Apr 11, 2025, then 10% in the 6 months after (120 cards). Holos from the same sets rose 21%, then 6%." };
  if (kind0 === "TTALT") return { stage: rotated ? "after rotation" : "past one year", text: "Tag Team (Alternate Art) cards were not part of our IR study. The facts above are this card's own." };
  if (kind0 === "ALT") return { stage: rotated ? "after rotation" : "past one year", text: "Sword & Shield alt arts from F-mark sets rose a median 136% from Feb 2024 to Oct 12, 2026 (20 cards). Holos from the same sets rose 70%." };
  if (rotated && age >= 365) return { stage: "after rotation", text: `${STUDY.later[kind].text} For rotated G-mark sets, IRs rose a median 23% in the 6 months after Apr 10, 2026 (125 cards).` };
  if (age < 183) return { stage: "first 6 months", text: STUDY.early[kind].text };
  if (age < 365) return { stage: "6 to 12 months", text: `${STUDY.early[kind].text} ${STUDY.later[kind].text}` };
  return { stage: "past one year", text: STUDY.later[kind].text };
}

export function rotationChip(rot, slug, today, cardMark) {
  const setRow = (rot?.sets || []).find((s) => s.slug === slug);
  const row = cardMark ? { mark: cardMark } : setRow;
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

// Multi-factor watchlist score. The weights are private: catchem-data-private
// data/private/ir-cycle/weights.json. With no weights every score is 0 and rows
// keep a plain order (lowest price first). The print window is one factor, not a gate.
// Sealed listings left out (Tyler, Oct 12): card pages never show sealed data.
export const SCORE_FACTORS = ["stage", "range", "popularity", "peers", "trend", "psa10"];
export function cleanWeights(w) {
  if (!w || typeof w !== "object") return null;
  const out = {};
  for (const k of SCORE_FACTORS) { const v = Number(w[k]); if (Number.isFinite(v) && v >= 0) out[k] = v; }
  return Object.keys(out).length ? out : null;
}

export function stageValue(age, rotated) {
  if (rotated) return { v: 0.5, chip: "Set rotated" };
  if (age >= 365) return { v: 1, chip: "Past one year since release" };
  if (age >= 183) return { v: 0.7, chip: "6 to 12 months since release" };
  return { v: 0.3, chip: "" };
}
export function trendValue(t30, t90) {
  if (t30 && t90 && t30.pct > 0 && t90.pct < 0) return { v: 1, chip: `Up ${t30.pct}% in 30 days after down ${Math.abs(t90.pct)}% in 90` };
  if (t30 && Math.abs(t30.pct) < 5 && t90 && Math.abs(t90.pct) < 5) return { v: 0.6, chip: "Steady over 90 days" };
  if (t30 && t30.pct > 0) return { v: 0.5, chip: `Up ${t30.pct}% in 30 days` };
  return { v: 0.2, chip: "" };
}
export function listingsValue(l) {
  if (!l || !l.prev) return { v: 0.5, chip: "" };
  if (l.n < l.prev.n) return { v: 1, chip: `Sealed listings counted down: ${l.n} from ${l.prev.n}` };
  if (l.n > l.prev.n) return { v: 0.2, chip: "" };
  return { v: 0.5, chip: "" };
}
const median = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };
export function peersValue(own, setMed, eraMed) {
  if (own == null) return { v: 0.5, chip: "" };
  const belowSet = setMed != null && own < setMed;
  const belowEra = eraMed != null && own < eraMed;
  const pc = (n) => (n > 0 ? `up ${Math.round(n)}%` : n < 0 ? `down ${Math.abs(Math.round(n))}%` : "flat");
  const parts = [];
  if (belowSet) parts.push(`set peers ${pc(setMed)}`);
  if (belowEra) parts.push(`era peers ${pc(eraMed)}`);
  const v = (belowSet ? 0.5 : 0) + (belowEra ? 0.5 : 0);
  const txt = pc(own);
  return { v, chip: parts.length ? `90 days ${txt}. Median: ${parts.join(", ")}` : "" };
}

export function buildRows({ rows, longRows, rot, bySet, today, marks = {}, weights = null }) {
  const W = cleanWeights(weights) || {};
  const pre = [];
  for (const r of rows) {
    const kind = kindOf(r);
    if (!kind || r.kind !== "single" || !r.release || !r.setSlug) continue;
    if (/promo|miscellaneous/i.test(r.set || "")) continue;
    const own = marks[r.id]?.mark;
    const status = own ? ((rot?.sources || []).some((x) => x.mark === own) ? "Rotated" : "Standard") : (rot?.sets || []).find((s) => s.slug === r.setSlug)?.status || "";
    const rotated = /^Rotated/.test(status) || kind === "ALT" || kind === "TTALT" || kind === "TG" || kind === "GG";
    const pts = series(r, longRows[r.id]);
    const now = priceAt(pts, today, 3);
    if (!now) continue;
    pre.push({ r, kind, rotated, pts, now, age: days(r.release, today), t30: trend(pts, today, 30), t90: trend(pts, today, 90) });
  }
  const groups = (key) => { const m = new Map(); for (const x of pre) { if (!x.t90) continue; const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x.t90.pct); } return new Map([...m].map(([k, a]) => [k, a.length >= 5 ? median(a) : null])); };
  const setMed = groups((x) => x.r.setSlug + "|" + (CURVE_KIND[x.kind]));
  const eraMed = groups((x) => eraOf(x.r) + "|" + (CURVE_KIND[x.kind]));
  const out = [];
  for (const x of pre) {
    const { r, kind, rotated, pts, now, age, t30, t90 } = x;
    const rg = range(pts);
    const pos = rangePos(rg, now[1]);
    const pop = popularity(r.name);
    const f = {
      stage: stageValue(age, rotated),
      range: { v: pos == null ? 0.5 : (100 - pos) / 100, chip: pos != null && pos <= 35 ? positionText(pos) : "" },
      popularity: { v: popShare(pop.weight) ?? 0, chip: "" },
      peers: peersValue(t90 ? t90.pct : null, setMed.get(r.setSlug + "|" + CURVE_KIND[kind]), eraMed.get(eraOf(r) + "|" + CURVE_KIND[kind])),
      trend: trendValue(t30, t90),
    };
    let score = 0;
    for (const k of Object.keys(f)) score += (W[k] || 0) * f[k].v;
    const lifts = Object.keys(f).filter((k) => f[k].chip && f[k].v >= 0.5).sort((a, b) => (W[b] || 0) * f[b].v - (W[a] || 0) * f[a].v).map((k) => ({ factor: k, text: f[k].chip }));
    const rotChip = rotationChip(rot, r.setSlug, today, marks[r.id]?.mark);
    out.push({
      id: r.id, name: r.name, num: r.num, set: r.set, setSlug: r.setSlug, kind, kindLabel: KIND_LABEL[kind], era: eraOf(r),
      release: r.release, daysSinceRelease: age,
      price: { price: now[1], date: now[0], source: "TCGplayer market" },
      low: rg.low, high: rg.high, onFileSince: rg.since,
      position: positionText(pos), positionPct: pos,
      trend30: t30, trend90: t90,
      curve: curveNote(kind, age, rotated),
      rotation: rotChip,
      popularity: pop.tags,
      lifts,
      _score: score,
    });
  }
  out.sort((a, b) => b._score - a._score || a.price.price - b.price.price);
  return out.map((row, i) => { const { _score, ...pub } = row; return { rank: i + 1, ...pub }; });
}

// Per-card regulation marks for sets with mixed marks. The pokemontcg.io id
// comes from the card's own scan path (/img/<setId>/<number>), so each mark
// is tied to that card id. Cards without a scan path get no mark.
export const MIXED_SETS = ["sv-prismatic-evolutions", "sv09-journey-together", "me-ascended-heroes"];
export function cardMarks(rows, attrCards, slugs = MIXED_SETS) {
  const out = {};
  for (const r of rows) {
    if (r.kind !== "single" || !slugs.includes(r.setSlug)) continue;
    const m = String(r.scan || "").match(/^\/img\/([a-z0-9]+)\/([A-Za-z0-9]+)$/);
    if (!m) continue;
    const ptcg = `${m[1]}-${m[2]}`;
    const rm = attrCards?.[ptcg]?.rm;
    if (rm) out[r.id] = { mark: rm, ptcgId: ptcg };
  }
  return out;
}

const BANNED = banGuard("ir cycle");
export function cleanCopy(text) { return !BANNED.test(String(text || "")) && !/\u2014/.test(String(text || "")); }
