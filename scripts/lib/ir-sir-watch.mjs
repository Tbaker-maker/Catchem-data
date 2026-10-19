// IR and SIR watch. Pure helpers, no network, no file writes.
// Every cutoff and weight comes from the private rules file
// (catchem-data-private data/private/ir-sir/rules.json). With no rules,
// facts are still computed but no signal fires and nothing is scored.
// Public output is words, prices, percents and dates. Never a cutoff, weight or score.
import { priceAt, rotationChip, days, KIND_LABEL } from "./ir-cycle.mjs";
import { runStage } from "./seller-stage.mjs";
import { popularity } from "./popular-pokemon.mjs";
import { isClean } from "./copy-rules.mjs";

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export const shift = (d, n) => iso(Date.parse(`${d}T00:00:00Z`) + n * DAY);
const epochDay = (n) => iso(Number(n) * DAY);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
export const median = (a) => { const b = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); const m = b.length >> 1; return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : null; };

// IR and SIR only: the card's own rarity field.
export function irKind(row) {
  if (!row || row.kind !== "single") return "";
  if (row.rarity === "Illustration Rare") return "IR";
  if (row.rarity === "Special Illustration Rare") return "SIR";
  return "";
}

// Long weekly history + daily fill + nightly hist, one price per day.
export function fullSeries(row, longStr) {
  const map = new Map();
  for (const part of String(longStr || "").split(",")) {
    const [d, v] = part.split(":");
    if (d && Number(v) > 0) map.set(epochDay(d), Number(v));
  }
  for (const list of [row?.fillHist, row?.hist]) for (const [d, v] of list || []) if (Number(v) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d)) map.set(d, Number(v));
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

// Points up to and including asOf only. The backtest calls this so no later price leaks in.
export const upTo = (pts, asOf) => pts.filter((p) => p[0] <= asOf);

export function windowMean(pts, asOf, w, minPts) {
  const from = shift(asOf, -w);
  const vals = pts.filter((p) => p[0] > from && p[0] <= asOf).map((p) => p[1]);
  return vals.length >= minPts ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

export function change(pts, asOf, back, tol = 8) {
  const now = priceAt(pts, asOf, 3);
  const then = priceAt(pts, shift(asOf, -back), tol);
  if (!now || !then || !(then[1] > 0)) return null;
  return { pct: (now[1] / then[1] - 1) * 100, from: { date: then[0], price: then[1] }, to: { date: now[0], price: now[1] } };
}

// Per-card facts on one date. pts must already be cut at asOf by the caller.
export function cardFacts(pts, asOf, stageSpec) {
  const now = priceAt(pts, asOf, 3);
  if (!now) return null;
  const base = {};
  for (const [w, minPts] of [[7, 3], [30, 4], [90, 6]]) {
    const m = windowMean(pts, asOf, w, minPts);
    base[`vs${w}`] = m ? (now[1] / m - 1) * 100 : null;
  }
  const ninety = pts.filter((p) => p[0] > shift(asOf, -90) && p[0] <= asOf);
  let hi = null;
  for (const p of ninety) if (!hi || p[1] >= hi[1]) hi = p;
  return {
    price: now[1], date: now[0],
    ch7: change(pts, asOf, 7, 3), ch30: change(pts, asOf, 30), ch90: change(pts, asOf, 90),
    ...base,
    high90: hi ? { date: hi[0], price: hi[1], offPct: (now[1] / hi[1] - 1) * 100 } : null,
    stage: stageSpec ? runStage(pts, asOf, stageSpec) : null,
  };
}

// Peers: same set and same kind (IR with IRs, SIR with SIRs).
export function peerStats(cards) {
  const groups = new Map();
  for (const c of cards) {
    const k = `${c.setSlug}|${c.kind}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const out = new Map();
  for (const [k, list] of groups) {
    const prices = list.map((c) => c.facts.price).sort((a, b) => a - b);
    out.set(k, { n: list.length, ch30: median(list.map((c) => c.facts.ch30?.pct)), ch90: median(list.map((c) => c.facts.ch90?.pct)), price: median(prices), prices });
  }
  return out;
}
export const priceRank = (prices, p) => (prices.length > 1 ? prices.filter((x) => x < p).length / (prices.length - 1) : null);

// Listings counted nights for one id: [{ date, n, sellers, share }] oldest first.
export function listingNights(historyDays, id) {
  const out = [];
  for (const d of historyDays || []) {
    const r = (d.rows || []).find((x) => x.id === id);
    if (r && Number.isFinite(r.listingsCounted)) out.push({ date: d.date, n: r.listingsCounted, sellers: r.sellers, share: r.top2Share });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}
export function listingDirection(nights, asOf, back = 7) {
  if (!nights?.length) return null;
  const end = nights.filter((r) => r.date <= asOf).pop();
  const start = nights.filter((r) => r.date <= shift(asOf, -back)).pop() || nights[0];
  if (!end || !start || start === end || !(start.n > 0)) return end ? { n: end.n, date: end.date, nights: nights.length } : null;
  return { n: end.n, date: end.date, from: { n: start.n, date: start.date }, pct: ((end.n - start.n) / start.n) * 100, nights: nights.length };
}

// Days until an official rotation date for this card's mark. Null when unannounced or past.
export function rotationDays(rot, slug, asOf, cardMark) {
  const setRow = (rot?.sets || []).find((s) => s.slug === slug);
  const mark = cardMark || setRow?.mark;
  const src = (rot?.sources || []).find((s) => s.mark === mark);
  return src ? days(asOf, src.date) : null;
}

// Signal flags. r is the private rules object. A missing cutoff means the flag is off.
export const SIGNALS = ["laggard30", "below90", "cheapNonChase", "pastOneYear", "preRotation", "reversingUp", "buildingUp", "slowingUp", "reversingDown", "listingsDrain", "fewSellers"];
export function signalFlags(c, peer, r = {}) {
  const f = c.facts;
  const s = r.signals || {};
  const on = (k) => s[k] && typeof s[k] === "object";
  const out = {};
  if (on("laggard30") && f.ch30 && peer?.ch30 != null && peer.n >= (s.laggard30.minPeers ?? 99)) out.laggard30 = f.ch30.pct - peer.ch30 <= -num(s.laggard30.gapPct);
  if (on("below90") && f.vs90 != null) out.below90 = f.vs90 <= -num(s.below90.pct);
  if (on("cheapNonChase") && peer?.prices?.length >= (s.cheapNonChase.minPeers ?? 99)) {
    const rk = priceRank(peer.prices, f.price);
    out.cheapNonChase = rk != null && rk <= num(s.cheapNonChase.rankMax) && Number.isFinite(popularity(c.name).weight) && popularity(c.name).weight <= num(s.cheapNonChase.popMax);
  }
  if (on("pastOneYear")) out.pastOneYear = c.age >= num(s.pastOneYear.days) && !(c.rotDays != null && c.rotDays <= 0);
  if (on("preRotation")) out.preRotation = c.rotDays != null && c.rotDays > 0 && c.rotDays <= num(s.preRotation.days);
  const st = f.stage;
  out.reversingUp = !!(on("reversingUp") && st && st.word === "Reversing" && st.dir === "up");
  out.buildingUp = !!(on("buildingUp") && st && st.word === "Building" && st.dir === "up");
  out.slowingUp = !!(on("slowingUp") && st && st.word === "Slowing" && st.dir === "up");
  out.reversingDown = !!(on("reversingDown") && st && st.word === "Reversing" && st.dir === "down");
  if (on("listingsDrain") && c.listings?.pct != null && c.listings.nights >= num(s.listingsDrain.minNights)) out.listingsDrain = c.listings.pct <= -num(s.listingsDrain.pct);
  if (on("fewSellers")) out.fewSellers = c.seller?.word === "Few sellers hold most";
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

// Only signals marked proven by the backtest add to the score.
export function score(flags, r = {}) {
  const proven = r.proven || {};
  let s = 0;
  const used = [];
  for (const k of Object.keys(flags)) if (proven[k] && Number.isFinite(proven[k].weight)) { s += proven[k].weight; used.push(k); }
  return { score: Math.round(s * 100) / 100, used };
}

const money = (n) => `$${Number(n).toFixed(2)}`;
const mdy = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const mdyy = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pct = (n) => `${Math.abs(Math.round(n))}%`;
const way = (n, up = "up", down = "down") => (Math.round(n) > 0 ? up : Math.round(n) < 0 ? down : "flat");
const STAGE_TEXT = {
  Building: (d) => (d === "up" ? "price rising faster than the 7 days before" : "price falling faster than the 7 days before"),
  Slowing: (d) => (d === "up" ? "still rising, slower than the 7 days before" : "still falling, slower than the 7 days before"),
  Stalled: (d) => (d === "up" ? "flat after rising the 7 days before" : "flat after falling the 7 days before"),
  Reversing: (d) => (d === "up" ? "price turned up after falling the 7 days before" : "price turned down after rising the 7 days before"),
};
export const shortName = (name) => String(name || "").replace(/\s*-\s*[A-Za-z0-9/]+$/, "").replace(/\s*#\S+$/, "").trim();
export const shortSet = (set) => String(set || "").replace(/^[A-Z0-9.]+:\s*/, "");

// One read, facts only. Each line carries its date.
export function readLines(c, peer) {
  const f = c.facts;
  const lines = [];
  const head = `${shortName(c.name)} (${shortSet(c.set)}) ${c.num}, ${KIND_LABEL[c.kind]}: ${money(f.price)} on ${mdy(f.date)}`;
  lines.push(f.ch7 && Math.round(f.ch7.pct) !== 0 ? `${head}, ${way(f.ch7.pct)} ${pct(f.ch7.pct)} from ${money(f.ch7.from.price)} on ${mdy(f.ch7.from.date)}.` : `${head}.`);
  if (f.stage) lines.push(`Run stage ${f.stage.word} ${f.stage.dir === "up" ? "▲" : "▼"}: ${STAGE_TEXT[f.stage.word](f.stage.dir)}.`);
  const avg = [];
  if (f.vs30 != null && Math.round(f.vs30) !== 0) avg.push(`${pct(f.vs30)} ${f.vs30 < 0 ? "under" : "over"} its 30 day average`);
  if (f.vs90 != null && Math.round(f.vs90) !== 0) avg.push(`${pct(f.vs90)} ${f.vs90 < 0 ? "under" : "over"} its 90 day average`);
  if (avg.length) lines.push(`${avg.join(", ")[0].toUpperCase()}${avg.join(", ").slice(1)}.`);
  if (f.ch30 && peer?.ch30 != null && peer.n >= 3) lines.push(`30 days: this card ${way(f.ch30.pct)} ${pct(f.ch30.pct)}, the median ${c.kind} in ${shortSet(c.set)} ${way(peer.ch30)} ${pct(peer.ch30)} (${peer.n} cards).`);
  if (c.listings?.from) lines.push(`Listings counted: ${c.listings.n} on ${mdy(c.listings.date)}, from ${c.listings.from.n} on ${mdy(c.listings.from.date)}${c.listings.n < c.listings.from.n ? ` (${c.listings.from.n - c.listings.n} listings gone)` : ""}.`);
  else if (c.listings) lines.push(`Listings counted: ${c.listings.n} on ${mdy(c.listings.date)}.`);
  if (c.seller?.word) lines.push(`Sellers: ${c.seller.word} (top 2 sellers hold ${c.seller.share}% of listings counted, usual ${c.seller.usual}%).`);
  if (c.rotation?.text) lines.push(`${c.rotation.text}.`);
  lines.push(`Released ${mdyy(c.release)}, ${c.age} days ago.`);
  return lines;
}

export function clean(text) {
  return !/[\u2013\u2014]/.test(text) && !/\b(sold|sales?)\b/i.test(text) && isClean(text);
}
