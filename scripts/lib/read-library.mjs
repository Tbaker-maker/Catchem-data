// Nightly read library. Every number comes from the rows and series passed in.
// Listings are never sales. A missing field is left out of the sentence.
// Fill order is the order named for this job: movers, set moves, highs,
// streaks, then plain price. Nothing else is boarded.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { BANNED, money } from "./public-bundle.mjs";

export const MOVER_PCT = 8;
export const BOARD_MAX = 8;
export const PLAIN_CAP = 2;
export const TYPE_CAP = 2;
export const STREAK_MIN = 4;
export const BOARD_ORDER = ["mover", "set", "high", "streak", "plain"];
export const LIBRARY_FILE = "research/assets/public/feed/read-library.json";

const BANNED_COPY = /\b(stored|printed|last print|took a bigger last step)\b/i;

export function daySpan(a, b) {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86400000);
}

export function endStreak(pts) {
  let n = 0;
  let dir = 0;
  const rows = Array.isArray(pts) ? pts : [];
  for (let i = rows.length - 1; i > 0; i -= 1) {
    if (daySpan(rows[i - 1][0], rows[i][0]) !== 1) break;
    const step = Math.round(Number(rows[i][1]) * 100) - Math.round(Number(rows[i - 1][1]) * 100);
    if (!Number.isFinite(step) || step === 0) break;
    const d = Math.sign(step);
    if (!dir) dir = d;
    if (d !== dir) break;
    n += 1;
  }
  return { n, dir };
}

export function skuOf(row) {
  const sku = String(row?.sku || "");
  if (/^tcgcsv-\d+$/.test(sku)) return sku;
  const id = String(row?.id || "");
  const hit = id.match(/tcgcsv-(\d+)/);
  return hit ? `tcgcsv-${hit[1]}` : "";
}

function pctOf(row) {
  const n = Number(row?.changePct);
  return Number.isFinite(n) ? n : null;
}

function absText(n) {
  if (Number.isInteger(n)) return String(Math.abs(n));
  return String(Math.abs(n));
}

function way(n) {
  if (n > 0) return "up";
  if (n < 0) return "down";
  return "";
}

function clean(text) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (!s || BANNED.test(s) || BANNED_COPY.test(s)) return "";
  return s;
}

export function explainRead(row, kind) {
  const sku = skuOf(row);
  const asOf = String(row?.asOf || "");
  const price = money(row?.price);
  const days = Number(row?.windowDays);
  const change = pctOf(row);
  const head = String(row?.headline || row?.path || "");
  let why = "";
  let wrong = "";
  if (kind === "mover" && sku && asOf && price && days === 7 && change != null && Math.abs(change) >= MOVER_PCT) {
    why = `A 7-day TCGplayer market move of ${absText(change)}% ${way(change)} on ${sku} is at least 8%. Latest price ${price} on ${asOf}.`;
    wrong = `Wrong if this is not ${sku}, if a day is missing inside those 7 days, or if the move is under 8%. A listing is not a sale.`;
  } else if (kind === "high" && head.includes("6-month high") && sku) {
    why = `The sentence on this card already calls the latest price a 6-month high${price ? ` at ${price}` : ""}${asOf ? ` on ${asOf}` : ""}. Product id ${sku}.`;
    wrong = `Wrong if the latest price on ${sku} is not the highest price in a series that spans at least 150 days, or if the chart spark was treated as that whole series. A listing is not a sale.`;
  } else if (kind === "low" && head.includes("6-month low") && sku) {
    why = `The sentence on this card already calls the latest price a 6-month low${price ? ` at ${price}` : ""}${asOf ? ` on ${asOf}` : ""}. Product id ${sku}.`;
    wrong = `Wrong if the latest price on ${sku} is not the lowest price in a series that spans at least 150 days, or if the chart spark was treated as that whole series. A listing is not a sale.`;
  } else if (kind === "streak" && sku && asOf && price && Number(row?.streakN) >= STREAK_MIN) {
    const n = Number(row.streakN);
    const word = Number(row.streakDir) < 0 ? "Down" : "Up";
    why = `${word} ${n} straight days on ${sku} through ${asOf}. Latest price ${price}. Each step is the next calendar day.`;
    wrong = `Wrong if any calendar day in that run is missing, or if one step did not move the same way. A listing is not a sale.`;
  } else if (kind === "set" && (row?.readKind === "lag" || row?.kind === "lag" || row?.readKind === "group" || row?.kind === "group")) {
    why = clean(row?.why) || "Both series are on the row. A missing pack price or box price keeps the set out.";
    wrong = "Wrong if the pack price or the box price is missing, or if the box price already moved. A listing is not a sale.";
  } else if (kind === "plain" && sku && asOf && price && days === 7 && change != null && Math.abs(change) < MOVER_PCT) {
    why = `Latest price ${price} on ${asOf} for ${sku}. The 7-day move is ${absText(change)}% ${way(change)}, under the 8% mover line.`;
    wrong = `Wrong if this is not ${sku}, or if the 7-day move is 8% or more. A listing is not a sale.`;
  } else if ((!kind || kind === "read") && sku && (head || price)) {
    const bits = [`This read is product id ${sku}`];
    if (asOf) bits.push(`as of ${asOf}`);
    if (price) bits.push(`latest price ${price}`);
    why = `${bits.join(", ")}.`;
    wrong = `Wrong if the sentence names a different product than ${sku}. A listing is not a sale.`;
  }
  why = clean(why);
  wrong = clean(wrong);
  if (!why || !wrong) return null;
  return { whyItMatters: why, whatWouldMakeThisWrong: wrong };
}

function priceKind(row) {
  if (!row || !skuOf(row)) return "";
  const head = String(row.headline || "");
  const days = Number(row.windowDays);
  const change = pctOf(row);
  if (days === 7 && change != null && Math.abs(change) >= MOVER_PCT && Number(row.price) > 0) return "mover";
  if (head.includes("6-month high")) return "high";
  if (head.includes("6-month low")) return "low";
  if (days === 7 && change != null && Number(row.price) > 0 && !head.includes("6-month high") && !head.includes("6-month low")) return "plain";
  return "";
}

function cardsOf(catalogue) {
  const cards = catalogue?.cards;
  if (!cards || typeof cards !== "object") return [];
  return Object.values(cards).filter((row) => row && row.id);
}

function byAbs(a, b) {
  const d = Math.abs(Number(b.changePct) || 0) - Math.abs(Number(a.changePct) || 0);
  if (d) return d;
  return String(a.sku).localeCompare(String(b.sku));
}

function onePerSku(rows, prefer) {
  const best = new Map();
  for (const row of rows) {
    const sku = skuOf(row);
    if (!sku) continue;
    const prev = best.get(sku);
    if (!prev || prefer(row, prev) < 0) best.set(sku, row);
  }
  return [...best.values()];
}

function publicRow(row, kind, lines) {
  const out = {
    id: row.id,
    sku: skuOf(row),
    signal: kind,
    readKind: row.readKind || row.kind || kind,
    kind: row.kind || kind,
    name: row.name || "",
    set: row.set || "",
    headline: row.headline || row.path || "",
    path: row.path || row.headline || "",
    price: Number(row.price) > 0 ? Number(row.price) : undefined,
    changePct: pctOf(row),
    windowDays: Number(row.windowDays) || undefined,
    asOf: row.asOf || "",
    source: row.source || "TCGplayer market",
    href: row.href || "",
    image: row.image || "",
    whyItMatters: lines.whyItMatters,
    whatWouldMakeThisWrong: lines.whatWouldMakeThisWrong,
  };
  if (row.streakN) out.streakN = row.streakN;
  if (row.streakDir) out.streakDir = row.streakDir;
  return out;
}

function pointsOf(series, sku) {
  const id = Number(String(sku).replace("tcgcsv-", ""));
  const days = series?.get?.(id);
  if (!days) return [];
  return [...days.entries()].filter((row) => row[0] && Number(row[1]) > 0).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function cents(n) {
  return Math.round(Number(n) * 100);
}

export function buildReadLibrary({ catalogue, extra, series } = {}) {
  const asOf = String(catalogue?.asOf || extra?.asOf || "");
  const cards = cardsOf(catalogue).filter((row) => !asOf || String(row.asOf || "") === asOf);
  const staleMovers = onePerSku(
    cardsOf(catalogue).filter((row) => priceKind(row) === "mover" && asOf && String(row.asOf || "") !== asOf),
    (a, b) => byAbs(a, b),
  );
  const nameBySku = new Map();
  for (const card of cards) {
    const sku = skuOf(card);
    if (sku && card.name && !nameBySku.has(sku)) nameBySku.set(sku, card);
  }

  const moverRows = onePerSku(cards.filter((row) => priceKind(row) === "mover"), (a, b) => byAbs(a, b));
  moverRows.sort(byAbs);
  const highRows = onePerSku(cards.filter((row) => String(row.headline || "").includes("6-month high")), (a, b) => {
    const aw = Number(a.windowDays) || 999;
    const bw = Number(b.windowDays) || 999;
    if (aw !== bw) return aw - bw;
    return byAbs(a, b);
  });
  highRows.sort(byAbs);
  const lowRows = onePerSku(cards.filter((row) => String(row.headline || "").includes("6-month low")), (a, b) => byAbs(a, b));
  const plainRows = onePerSku(cards.filter((row) => priceKind(row) === "plain"), (a, b) => byAbs(a, b));
  plainRows.sort(byAbs);

  const setRows = [];
  for (const row of extra?.lag?.reads || []) {
    if (row && (row.readKind === "lag" || row.kind === "lag") && row.headline) setRows.push(row);
  }
  for (const row of extra?.group?.reads || []) {
    if (row && (row.readKind === "group" || row.kind === "group") && row.headline) setRows.push(row);
  }

  const streakRows = [];
  const disagreements = [];
  if (series && asOf) {
    for (const [id, days] of series.entries()) {
      const sku = `tcgcsv-${id}`;
      const pts = pointsOf(series, sku);
      if (pts.length < 2 || pts[pts.length - 1][0] !== asOf) continue;
      const streak = endStreak(pts);
      if (streak.n < STREAK_MIN) continue;
      const named = nameBySku.get(sku);
      const seriesPrice = pts[pts.length - 1][1];
      if (named && Number(named.price) > 0 && cents(named.price) !== cents(seriesPrice)) {
        disagreements.push({ sku, cardPrice: named.price, seriesPrice, asOf });
        continue;
      }
      if (!named?.name) continue;
      const word = streak.dir < 0 ? "Down" : "Up";
      const price = money(seriesPrice);
      if (!price) continue;
      streakRows.push({
        id: `streak-${sku}`,
        sku,
        readKind: "streak",
        kind: "streak",
        name: named.name,
        set: named.set || "",
        headline: `${named.name} latest price: ${word} ${streak.n} straight days through ${asOf}, at ${price}.`,
        path: `${named.name} latest price: ${word} ${streak.n} straight days through ${asOf}, at ${price}.`,
        price: seriesPrice,
        asOf,
        source: named.source || "TCGplayer market",
        href: named.href || `/c/${sku}`,
        image: named.image || "",
        streakN: streak.n,
        streakDir: streak.dir,
      });
    }
  }
  streakRows.sort((a, b) => b.streakN - a.streakN || String(a.sku).localeCompare(String(b.sku)));

  const pools = {
    mover: moverRows,
    set: setRows,
    high: highRows,
    streak: streakRows,
    plain: plainRows,
  };
  const board = [];
  const used = new Set();
  const boarded = { mover: 0, set: 0, high: 0, streak: 0, plain: 0, low: 0 };
  for (const kind of BOARD_ORDER) {
    const cap = kind === "plain" ? PLAIN_CAP : TYPE_CAP;
    let took = 0;
    for (const row of pools[kind]) {
      if (board.length >= BOARD_MAX || took >= cap) break;
      const sku = skuOf(row);
      if (!sku || used.has(sku)) continue;
      const lines = explainRead(row, kind);
      if (!lines) continue;
      if (!String(row.headline || row.path || "").trim()) continue;
      board.push(publicRow(row, kind, lines));
      used.add(sku);
      took += 1;
      boarded[kind] += 1;
    }
  }

  const signals = [];
  const seenSignal = new Set();
  for (const kind of ["mover", "set", "high", "streak"]) {
    for (const row of pools[kind]) {
      const sku = skuOf(row);
      const id = String(row.id || "");
      if (!sku || !id || seenSignal.has(id)) continue;
      const lines = explainRead(row, kind);
      if (!lines || !String(row.headline || row.path || "").trim()) continue;
      signals.push(publicRow(row, kind, lines));
      seenSignal.add(id);
    }
  }
  signals.sort((a, b) => {
    const aBoard = board.findIndex((row) => row.id === a.id);
    const bBoard = board.findIndex((row) => row.id === b.id);
    if (aBoard >= 0 || bBoard >= 0) return (aBoard < 0 ? 99 : aBoard) - (bBoard < 0 ? 99 : bBoard);
    return BOARD_ORDER.indexOf(a.signal) - BOARD_ORDER.indexOf(b.signal) || byAbs(a, b);
  });

  const counts = {
    mover: { qualified: moverRows.length, boarded: boarded.mover, stale: staleMovers.length },
    set: {
      qualified: setRows.length,
      boarded: boarded.set,
      omitted: (extra?.lag?.omitted || []).length,
      missingPrice: (extra?.lag?.missingPrice || []).length,
      groupQualified: (extra?.group?.reads || []).length,
    },
    high: { qualified: highRows.length, boarded: boarded.high },
    low: { qualified: lowRows.length, boarded: 0 },
    streak: { qualified: streakRows.length, boarded: boarded.streak, leftOutOnPriceDisagree: disagreements.length },
    plain: { qualified: plainRows.length, boarded: boarded.plain },
  };

  return {
    asOf,
    source: catalogue?.source || "TCGplayer market",
    order: BOARD_ORDER,
    boardMax: BOARD_MAX,
    plainCap: PLAIN_CAP,
    counts,
    board,
    signals,
    disagreements,
  };
}

export async function writeReadLibrary({ root, catalogue, extra, series }) {
  const lib = buildReadLibrary({ catalogue, extra, series });
  const path = join(root, LIBRARY_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(lib));
  return lib;
}
