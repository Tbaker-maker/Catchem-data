// Scores a shipped take only when a later TCGplayer market exists on the exact day.
// Ship price comes from the daily price file, never from a headline.
// Under 14 days is too early. A missing later price is no score. watch is not scored.
// The scored file is private. The public file is a stub with no rows.

import { HORIZONS, SCORE_MIN } from "./second-library.mjs";
import { cleanDoc, VISIBLE_FIELDS } from "./copy-rules.mjs";

const LABEL_BAN = /Looks like a buy|Wait for a dip|Avoid for now|Looks stretched/;

export const TAKE_CODES = ["up", "dip", "watch", "avoid", "stretched"];
const SCORED_CODES = new Set(["up", "dip", "avoid", "stretched"]);

export { HORIZONS, SCORE_MIN };

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function takeOf(read) {
  const code = String(read?.take || "");
  return TAKE_CODES.includes(code) ? code : "";
}

function hitOf(take, from, to) {
  if (take === "up") return to > from;
  if (take === "dip" || take === "avoid" || take === "stretched") return to < from;
  return null;
}

export function percentFor(hit, n) {
  if (!(n >= SCORE_MIN)) return null;
  return Math.round((100 * hit) / n);
}

// Product names are proper names and ids are machine keys, so only words a reader sees are checked.
const TRACK_VISIBLE = new Set([...VISIBLE_FIELDS, "type", "take"].filter((k) => k !== "status"));
function assertClean(doc) {
  const r = cleanDoc(doc, { visible: TRACK_VISIBLE });
  for (const f of r.fixes) console.log(`[copy-rules] track record: read ${f.id || "?"} ${f.field}: "${f.from}" -> "${f.to}"`);
  const label = r.errors.length ? null : JSON.stringify(r.doc, (k, v) => (TRACK_VISIBLE.has(k) || typeof v !== "string" ? v : undefined));
  if (r.errors.length || LABEL_BAN.test(label)) throw new Error(`track record used a banned word: ${r.errors.join("; ") || "a take label"}`);
  return r.doc;
}

export function scoreRead(read, later = {}, today, shipFromFile = null) {
  const shipped = String(read?.asOf || "").slice(0, 10);
  const price = Number(shipFromFile?.market);
  const take = takeOf(read);
  const age = dayGap(shipped, today);
  const base = {
    id: String(read?.id || ""),
    productId: String(read?.sku || ""),
    name: String(read?.name || ""),
    type: take,
    take,
    shipped,
    price: price > 0 ? price : null,
    shipSource: price > 0 ? String(shipFromFile?.source || "") : "",
    age,
  };
  if (!base.id || !base.productId || age == null) {
    return { ...base, status: "no-score", note: "no score" };
  }
  if (take === "watch") return { ...base, status: "no-score", note: "watch is not scored" };
  if (!SCORED_CODES.has(take)) return { ...base, status: "no-score", note: "no score" };
  if (!(price > 0)) return { ...base, status: "no-score", note: "no score" };
  if (age < HORIZONS[0]) return { ...base, status: "too-early", note: "too early" };
  const marks = {};
  for (const horizon of HORIZONS) {
    if (age < horizon) continue;
    const day = addDays(shipped, horizon);
    const next = Number(later[day]);
    if (!(next > 0)) {
      marks[String(horizon)] = { day, price: null, sameDirection: null };
      continue;
    }
    marks[String(horizon)] = { day, price: next, sameDirection: hitOf(take, price, next) };
  }
  const scored = Object.values(marks).some((mark) => mark.price != null);
  return {
    ...base,
    status: scored ? "scored" : "no-later-price",
    note: scored ? "" : "no later price, so no score",
    marks,
  };
}

export function buildTrackRecord(reads, laterByProduct = {}, today, shipByProduct = {}) {
  const rows = (reads || []).map((read) => {
    const sku = String(read?.sku || "");
    const day = String(read?.asOf || "").slice(0, 10);
    return scoreRead(read, laterByProduct[sku] || {}, today, shipByProduct[sku]?.[day] || null);
  });
  rows.sort((a, b) => String(b.shipped).localeCompare(String(a.shipped)) || String(b.id).localeCompare(String(a.id)));
  const byType = {};
  for (const row of rows) {
    const key = row.take || "";
    if (!byType[key]) {
      byType[key] = {
        type: key, reads: 0, tooEarly: 0, noLaterPrice: 0, scored: 0,
        scored14: 0, hit14: 0, scored28: 0, hit28: 0, scored56: 0, hit56: 0,
      };
    }
    const bag = byType[key];
    bag.reads += 1;
    if (row.status === "too-early") bag.tooEarly += 1;
    if (row.status === "no-later-price") bag.noLaterPrice += 1;
    if (row.status === "scored") bag.scored += 1;
    for (const horizon of HORIZONS) {
      const mark = row.marks?.[String(horizon)];
      if (mark?.price == null) continue;
      bag[`scored${horizon}`] += 1;
      if (mark.sameDirection === true) bag[`hit${horizon}`] += 1;
    }
  }
  const types = Object.values(byType).sort((a, b) => a.type.localeCompare(b.type));
  for (const bag of types) {
    bag.line = `${bag.scored} scored so far`;
    for (const horizon of HORIZONS) {
      const n = bag[`scored${horizon}`];
      bag[`line${horizon}`] = `${n} scored so far`;
      const pct = percentFor(bag[`hit${horizon}`], n);
      if (pct != null) bag[`percent${horizon}`] = pct;
    }
  }
  const dates = rows.map((row) => row.shipped).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  return assertClean({
    public: false,
    asOf: today,
    rule: "A take is stored with its ship date. The ship price is the TCGplayer market on that date from the daily price file. It is not taken from a headline. Days 14, 28, and 56 use that exact day's market. A missing day is no score. Under 14 days is too early. watch is not scored. up is scored when the later market is higher. dip, avoid, and stretched are scored when the later market is lower. A percent is stored only after 20 scored reads of that code.",
    oldest: dates[0] || "",
    newest: dates[dates.length - 1] || "",
    count: rows.length,
    tooEarly: rows.filter((row) => row.status === "too-early").length,
    noLaterPrice: rows.filter((row) => row.status === "no-later-price").length,
    scored14: types.reduce((n, row) => n + row.scored14, 0),
    scored28: types.reduce((n, row) => n + row.scored28, 0),
    scored56: types.reduce((n, row) => n + row.scored56, 0),
    scoreMin: SCORE_MIN,
    types,
    rows,
  });
}

export function publicTrackRecord(doc) {
  return assertClean({
    public: false,
    asOf: String(doc?.asOf || "").slice(0, 10),
    count: 0,
    scoreMin: SCORE_MIN,
    types: [],
    rows: [],
  });
}

export function siteTrack(trackRecord) {
  if (trackRecord?.public === false) return { page: false, cardLine: "", score: null };
  return { page: false, cardLine: "", score: null };
}
