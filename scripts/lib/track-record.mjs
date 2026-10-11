// Scores a shipped read only when a later TCGplayer market exists on the exact day.
// Ship price comes from the price file, never from a headline.
// Under 14 days is too early. No later price means no score.

import { HORIZONS, SCORE_MIN } from "./second-library.mjs";

const COPY_BAN = /\b(resistance|support|breakout|bottom|cheap|crash|buys?|sells?|selling|holds?|holding|printed)\b/i;

export { HORIZONS, SCORE_MIN };

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function sameWay(direction, from, to) {
  if (direction === "down") return to < from;
  if (direction === "up") return to > from;
  return null;
}

export function scoreRead(read, later = {}, today, shipFromFile = null) {
  const shipped = String(read?.asOf || "").slice(0, 10);
  const price = Number(shipFromFile?.market);
  const direction = read?.direction === "up" || read?.direction === "down" ? read.direction : "";
  const type = String(read?.readKind || read?.type || "read");
  const age = dayGap(shipped, today);
  const base = {
    id: String(read?.id || ""),
    productId: String(read?.sku || ""),
    name: String(read?.name || ""),
    type,
    label: String(read?.label || type),
    sentence: String(read?.headline || read?.path || ""),
    shipped,
    price: price > 0 ? price : null,
    shipSource: price > 0 ? String(shipFromFile?.source || "") : "",
    direction,
    age,
  };
  if (!base.id || !base.productId || age == null) {
    return { ...base, status: "no-score", note: "no score", cells: blankCells("no score") };
  }
  if (!(price > 0)) {
    return { ...base, status: "no-score", note: "no score", cells: blankCells("no score") };
  }
  if (age < HORIZONS[0]) return { ...base, status: "too-early", note: "too early", cells: blankCells("too early") };
  if (!direction) return { ...base, status: "no-score", note: "no score", cells: blankCells("no score") };
  const marks = {};
  const cells = {};
  for (const horizon of HORIZONS) {
    if (age < horizon) {
      cells[String(horizon)] = "too early";
      continue;
    }
    const day = addDays(shipped, horizon);
    const next = Number(later[day]);
    if (!(next > 0)) {
      marks[String(horizon)] = { day, price: null, sameDirection: null };
      cells[String(horizon)] = "no later price, so no score";
      continue;
    }
    const sameDirection = sameWay(direction, price, next);
    marks[String(horizon)] = { day, price: next, sameDirection };
    cells[String(horizon)] = sameDirection == null ? "no score" : String(next);
  }
  const scored = Object.values(marks).some((mark) => mark.price != null);
  return {
    ...base,
    status: scored ? "scored" : "no-later-price",
    note: scored ? "" : "no later price, so no score",
    marks,
    cells,
  };
}

function blankCells(text) {
  return { "14": text, "28": text, "56": text };
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
    if (!byType[row.type]) {
      byType[row.type] = {
        type: row.type, reads: 0, tooEarly: 0, noLaterPrice: 0, scored: 0,
        scored14: 0, hit14: 0, scored28: 0, hit28: 0, scored56: 0, hit56: 0,
      };
    }
    const bag = byType[row.type];
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
      if (n >= SCORE_MIN) bag[`percent${horizon}`] = Math.round(100 * bag[`hit${horizon}`] / n);
    }
  }
  const dates = rows.map((row) => row.shipped).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  const cardLines = {};
  for (const row of rows) {
    if (!row.productId) continue;
    if (!cardLines[row.productId]) cardLines[row.productId] = 0;
    if (row.status === "scored") cardLines[row.productId] += 1;
  }
  const lines = {};
  for (const [id, n] of Object.entries(cardLines)) lines[id] = `Track record: ${n} scored so far.`;
  const authored = JSON.stringify({
    notes: rows.map((row) => row.note),
    cells: rows.map((row) => row.cells),
    lines: types.map((row) => row.line),
    cardLines: lines,
  });
  if (COPY_BAN.test(authored)) throw new Error("track record used a banned word");
  return {
    asOf: today,
    rule: "A read is stored with its ship date. The ship price is the TCGplayer market on that date from the price file. It is not taken from a headline. After 14, 28, and 56 days, the later price is that exact day, or there is no score. Under 14 days is too early to score.",
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
    cardLines: lines,
  };
}
