// Nightly read library. Every number comes from the rows and series passed in.
// Listings are never sales. A missing field is left out of the sentence.
// Fill order is the order named for this job: movers, set moves, highs,
// streaks, then plain price. Nothing else is boarded.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { bannedWord, money, pretty } from "./public-bundle.mjs";
import { flag } from "../flags.mjs";
import { takeCode } from "./takes.mjs";
import {
  FOOTER,
  longWindowBlocked,
  moverGate,
  floorOk,
  priceForm,
  publishReads,
  quietNight,
  releaseReads,
  scrub,
  sealedWeekReads,
  shapeReads,
  streakGate,
  turnedReads,
  whyLeak,
  whyPlain,
} from "./read-quality.mjs";

export const MOVER_PCT = 8;
export const BOARD_MAX = 8;
export const PLAIN_CAP = 2;
export const TYPE_CAP = 2;
export const STREAK_MIN = 4;
export const BOARD_ORDER = ["mover", "set", "high", "streak", "plain"];
export const SOURCE_NOTE = "TCGplayer market via TCGCSV, published the day before the date shown.";
export const LIBRARY_FILE = "research/assets/public/feed/read-library.json";
export const READS_FILE = "research/assets/public/reads.json";
export { FOOTER };

const BANNED_COPY = /\b(stored|printed|last print|took a bigger last step)\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WINDOW_DAYS = new Set([7, 30, 90]);

export function shiftDay(iso, days) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

function productId(sku) {
  const hit = String(sku || "").match(/tcgcsv-(\d+)/);
  return hit ? Number(hit[1]) : 0;
}

function priceOn(series, sku, day) {
  const id = productId(sku);
  const days = id && series?.get?.(id);
  if (!days || !day) return null;
  const value = Number(days.get(day));
  return value > 0 ? value : null;
}

// A window is the price on the day exactly N calendar days before the latest
// price day. An earlier day does not count, and a missing day is not filled.
export function exactWindow(series, sku, asOf, days) {
  const n = Number(days);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) || !WINDOW_DAYS.has(n)) return null;
  const start = shiftDay(asOf, -n);
  const from = priceOn(series, sku, start);
  const to = priceOn(series, sku, asOf);
  if (from == null || to == null || !start) return null;
  const pct = Math.round((((to - from) / from) * 100) * 10) / 10;
  if (!Number.isFinite(pct)) return null;
  return { start, end: asOf, from, to, pct, days: n };
}

function namedDate(asOf, mon, day) {
  const month = MONTHS.indexOf(String(mon || "").toLowerCase()) + 1;
  const n = Number(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) || month < 1 || n < 1 || n > 31) return "";
  const iso = `${asOf.slice(0, 4)}-${String(month).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  if (iso > asOf) return `${Number(asOf.slice(0, 4)) - 1}-${iso.slice(5)}`;
  return iso;
}

function windowAgrees(row, proof) {
  if (!proof || cents(row?.price) !== cents(proof.to)) return false;
  const claimed = pctOf(row);
  if (claimed == null || Math.abs(claimed - proof.pct) > 0.05) return false;
  const quoted = String(row?.headline || "").match(/from\s+(\$[\d,]+(?:\.\d+)?)/i);
  if (quoted && quoted[1] !== money(proof.from)) return false;
  const cited = `${row?.headline || ""} ${row?.path || ""}`.match(/from\s+\$[\d,]+(?:\.\d+)?\s+on\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
  if (cited && namedDate(row.asOf || proof.end, cited[1], cited[2]) !== proof.start) return false;
  return true;
}

function extremeAt(series, sku, asOf) {
  const id = productId(sku);
  const days = id && series?.get?.(id);
  if (!days || !asOf) return null;
  const pts = [...days.entries()].filter((row) => row[0] && row[0] <= asOf && Number(row[1]) > 0);
  pts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (pts.length < 2 || pts[pts.length - 1][0] !== asOf) return null;
  let max = pts[0];
  let min = pts[0];
  for (const pt of pts) {
    if (pt[1] > max[1]) max = pt;
    if (pt[1] < min[1]) min = pt;
  }
  const span = daySpan(pts[0][0], asOf);
  return { span, sixMonths: span >= 150, last: pts[pts.length - 1], max, min };
}

function proveMove(row, series, asOf) {
  const proof = exactWindow(series, skuOf(row), asOf, row?.windowDays);
  return windowAgrees({ ...row, asOf }, proof) ? proof : null;
}

function proveExtreme(row, series, asOf, kind, dailyFiles) {
  const proof = proveMove(row, series, asOf);
  const ex = extremeAt(series, skuOf(row), asOf);
  if (!proof || !ex?.sixMonths || cents(ex.max[1]) === cents(ex.min[1])) return null;
  if (kind === "high" && cents(ex.last[1]) !== cents(ex.max[1])) return null;
  if (kind === "low" && cents(ex.last[1]) !== cents(ex.min[1])) return null;
  const pts = pointsOf(series, skuOf(row));
  const have = new Set(pts.map((pt) => pt[0]));
  if (longWindowBlocked({ ...row, _proof: proof, asOf }, dailyFiles, (day) => have.has(day))) return null;
  return proof;
}

function proveSet(row, asOf) {
  const n = Number(row?.windowDays) || 30;
  const lag = row?.readKind === "lag" || row?.kind === "lag";
  const group = row?.readKind === "group" || row?.kind === "group";
  if (lag) {
    const pack = row.pack;
    const box = row.box;
    if (!pack || !box || pack.toDate !== asOf || box.toDate !== asOf) return null;
    if (daySpan(pack.fromDate, pack.toDate) !== n || daySpan(box.fromDate, box.toDate) !== n) return null;
    return { start: pack.fromDate, end: asOf, days: n };
  }
  if (group && row.fromDate && row.toDate === asOf && daySpan(row.fromDate, row.toDate) === n) {
    return { start: row.fromDate, end: asOf, days: n };
  }
  return null;
}

function withProof(row, proof) {
  return { ...row, _proof: proof, startDate: proof.start, endDate: proof.end };
}

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

function clean(text) {
  const s = scrub(text);
  if (!s || bannedWord(s) || BANNED_COPY.test(s)) return "";
  return s;
}

export function explainRead(row, kind) {
  const sku = skuOf(row);
  const asOf = String(row?.asOf || row?._proof?.end || "");
  const price = money(row?.price);
  const days = Number(row?.windowDays);
  const change = pctOf(row);
  const head = String(row?.headline || row?.path || "");
  const proof = row?._proof || null;
  let why = "";
  let wrong = "";
  if (kind === "mover" && proof && sku && price && days === 7 && change != null && moverGate(proof)) {
    why = whyPlain(proof.from, proof.to);
    wrong = "Wrong if either date has a different market price.";
  } else if (kind === "high" && proof && head.includes("6-month high") && sku) {
    why = whyPlain(proof.from, proof.to);
    wrong = "Wrong if the latest price is not the high on the dates checked.";
  } else if (kind === "low" && proof && head.includes("6-month low") && sku) {
    why = whyPlain(proof.from, proof.to);
    wrong = "Wrong if the latest price is not the low on the dates checked.";
  } else if (kind === "streak" && proof && sku && asOf && price && Number(row?.streakN) >= STREAK_MIN && proof.from != null) {
    why = whyPlain(proof.from, proof.to);
    wrong = "Wrong if a day in the run is missing or a step went the other way.";
  } else if (kind === "set" && proof && (row?.readKind === "lag" || row?.kind === "lag" || row?.readKind === "group" || row?.kind === "group")) {
    why = clean(row?.why) || "Both series have a price on the two dates.";
    wrong = "Wrong if the pack or the box has no price on the start date.";
  } else if (kind === "plain" && proof && sku && price && days === 7 && change != null && Math.abs(change) < MOVER_PCT) {
    why = whyPlain(proof.from, proof.to);
    wrong = "Wrong if either date has a different market price.";
  } else if ((!kind || kind === "read") && sku && (head || price)) {
    why = "This is the market price on the date shown.";
    wrong = "Wrong if the sentence names a different price.";
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

function shownHeadline(row, kind) {
  const proof = row?._proof;
  if ((kind === "mover" || kind === "streak") && proof && proof.from != null && proof.to != null) {
    return priceForm({
      name: row.name,
      set: row.set,
      num: row.number,
      to: proof.to,
      from: proof.from,
      end: proof.end,
      start: proof.start,
      pct: proof.pct != null ? proof.pct : row.changePct,
    });
  }
  return scrub(row?.headline || row?.path || "");
}

function publicRow(row, kind, lines) {
  const headline = shownHeadline(row, kind);
  const sku = skuOf(row) || String(row.sku || "");
  const out = {
    id: row.id,
    sku,
    signal: kind,
    readKind: row.readKind || row.kind || kind,
    kind: row.kind || kind,
    name: pretty(row.name || ""),
    set: pretty(row.set || ""),
    headline,
    path: headline,
    price: Number(row.price) > 0 ? Number(row.price) : undefined,
    changePct: pctOf(row),
    windowDays: Number(row.windowDays) || Number(row._proof?.days) || undefined,
    startDate: row.startDate || undefined,
    endDate: row.endDate || undefined,
    asOf: row.asOf || "",
    source: row.source || "TCGplayer market",
    sourceLine: sku,
    href: row.href || "",
    image: row.image || "",
    whyItMatters: lines.whyItMatters,
    why: lines.whyItMatters,
    whatWouldMakeThisWrong: lines.whatWouldMakeThisWrong,
  };
  if (row.streakN) out.streakN = row.streakN;
  if (row.streakDir) out.streakDir = row.streakDir;
  const code = takeCode({
    from: row?._proof?.from,
    to: row?._proof?.to,
    sixMonthHigh: kind === "high",
  });
  if (code) out.take = code;
  return out;
}

function pointsOf(series, sku) {
  const id = Number(String(sku).replace("tcgcsv-", ""));
  const days = series?.get?.(id);
  if (!days) return [];
  return [...days.entries()].filter((row) => row[0] && Number(row[1]) > 0).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function preferHigh(a, b) {
  const aw = Number(a.windowDays) || 999;
  const bw = Number(b.windowDays) || 999;
  if (aw !== bw) return aw - bw;
  return byAbs(a, b);
}

function provedPool(rows, prove, prefer) {
  const passed = [];
  const failedSku = new Set();
  const passedSku = new Set();
  for (const row of rows || []) {
    const sku = skuOf(row);
    const proof = prove(row);
    if (!proof || !sku) {
      if (sku) failedSku.add(sku);
      continue;
    }
    passedSku.add(sku);
    passed.push(withProof(row, proof));
  }
  const unique = onePerSku(passed, prefer);
  unique.sort(prefer);
  return { rows: unique, dropped: [...failedSku].filter((sku) => !passedSku.has(sku)).length };
}

function daysHold(pts, asOf, n) {
  const have = new Map(pts);
  for (let i = 0; i <= n; i += 1) {
    if (!(Number(have.get(shiftDay(asOf, -i))) > 0)) return false;
  }
  return true;
}

function cents(n) {
  return Math.round(Number(n) * 100);
}

export function buildReadLibrary({ catalogue, extra, series, dailyFiles = null, sealed = null, radar = null, library = false, pptPublic = null, volumeReads = null } = {}) {
  const asOf = String(catalogue?.asOf || extra?.asOf || "");
  const cards = cardsOf(catalogue).filter((row) => !asOf || String(row.asOf || "") === asOf);
  const staleMovers = onePerSku(
    cardsOf(catalogue).filter((row) => priceKind(row) === "mover" && asOf && String(row.asOf || "") !== asOf && proveMove(row, series, row.asOf)),
    (a, b) => byAbs(a, b),
  );
  const nameBySku = new Map();
  for (const card of cards) {
    const sku = skuOf(card);
    if (sku && card.name && !nameBySku.has(sku)) nameBySku.set(sku, card);
  }

  const moverPool = provedPool(
    cards.filter((row) => priceKind(row) === "mover"),
    (row) => {
      const proof = proveMove(row, series, asOf);
      return moverGate(proof, dailyFiles) && floorOk(proof.from, proof.to, proof.pct) ? proof : null;
    },
    byAbs,
  );
  const highPool = provedPool(
    cards.filter((row) => String(row.headline || "").includes("6-month high")),
    (row) => proveExtreme(row, series, asOf, "high", dailyFiles),
    preferHigh,
  );
  highPool.rows.sort(byAbs);
  const lowPool = provedPool(
    cards.filter((row) => String(row.headline || "").includes("6-month low")),
    (row) => proveExtreme(row, series, asOf, "low", dailyFiles),
    byAbs,
  );
  const plainPool = provedPool(
    cards.filter((row) => priceKind(row) === "plain"),
    (row) => {
      const proof = proveMove(row, series, asOf);
      if (!proof || !floorOk(proof.from, proof.to, proof.pct)) return null;
      return proof;
    },
    byAbs,
  );
  const moverRows = moverPool.rows;
  const highRows = highPool.rows;
  const lowRows = lowPool.rows;
  const plainRows = plainPool.rows;

  const setRows = [];
  for (const row of [...(extra?.lag?.reads || []), ...(extra?.group?.reads || [])]) {
    const lag = row && (row.readKind === "lag" || row.kind === "lag");
    const group = row && (row.readKind === "group" || row.kind === "group");
    if ((!lag && !group) || !row.headline) continue;
    const proof = proveSet(row, asOf);
    if (!proof) continue;
    setRows.push(withProof(row, proof));
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
      const start = shiftDay(asOf, -streak.n);
      const first = Number(days.get(start));
      if (!daysHold(pts, asOf, streak.n)) continue;
      if (!streakGate({
        asOf,
        n: streak.n,
        first,
        last: seriesPrice,
        dailyFiles,
        hasDay: (day) => Number(days.get(day)) > 0,
      })) continue;
      const price = money(seriesPrice);
      if (!price || !(first > 0)) continue;
      const num = String(named.number || "").trim();
      const pct = Math.round(((seriesPrice - first) / first) * 1000) / 10;
      const proof = { start, end: asOf, days: streak.n, from: first, to: seriesPrice, pct };
      streakRows.push(withProof({
        id: `streak-${sku}`,
        sku,
        readKind: "streak",
        kind: "streak",
        name: named.name,
        set: named.set || "",
        number: num,
        headline: named.name,
        path: named.name,
        price: seriesPrice,
        changePct: pct,
        asOf,
        source: named.source || "TCGplayer market",
        href: named.href || `/c/${sku}`,
        image: named.image || "",
        streakN: streak.n,
        streakDir: streak.dir,
      }, proof));
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
  const boardKey = (row) => skuOf(row) || String(row.sku || row.id || "");
  for (const kind of BOARD_ORDER) {
    if (kind === "plain") continue;
    let took = 0;
    let ups = 0;
    let downs = 0;
    for (const row of pools[kind]) {
      if (board.length >= BOARD_MAX || took >= TYPE_CAP) break;
      if (kind === "mover") {
        const dir = Number(row.changePct) < 0 ? -1 : 1;
        if (dir > 0 && ups >= 1) continue;
        if (dir < 0 && downs >= 1) continue;
      }
      const key = boardKey(row);
      if (!key || used.has(key)) continue;
      const lines = explainRead(row, kind);
      const headline = shownHeadline(row, kind);
      if (!lines || !headline) continue;
      if (bannedWord(headline) || bannedWord(lines.whyItMatters) || whyLeak(lines.whyItMatters)) continue;
      board.push(publicRow(row, kind, lines));
      used.add(key);
      took += 1;
      boarded[kind] += 1;
      if (kind === "mover") {
        if (Number(row.changePct) < 0) downs += 1;
        else ups += 1;
      }
    }
  }

  const pptOn = pptPublic != null ? pptPublic === true : flag("ppt.publicDisplay") === true;
  const volumeOn = volumeReads != null ? volumeReads === true : flag("reads.volume") === true;
  const dropSold = !pptOn && !volumeOn;
  for (const row of shapeReads(extra, { dropSold })) {
    if (board.length >= BOARD_MAX) break;
    const key = boardKey(row);
    if (!key || used.has(key)) continue;
    if (!row.whyItMatters || !row.headline) continue;
    if (bannedWord(row.headline) || bannedWord(row.whyItMatters) || whyLeak(row.whyItMatters)) continue;
    board.push(row);
    used.add(key);
  }
  if (library === true) {
    const extras = [
      ...turnedReads({ series, asOf, names: nameBySku, dailyFiles }),
      ...sealedWeekReads({ products: sealed, series, asOf, dailyFiles }),
      ...releaseReads({ radar, asOf }),
    ];
    for (const row of extras) {
      if (board.length >= BOARD_MAX) break;
      const key = boardKey(row);
      if (!key || used.has(key)) continue;
      board.push(row);
      used.add(key);
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
    mover: { qualified: moverRows.length, boarded: boarded.mover, stale: staleMovers.length, droppedNoExactDay: moverPool.dropped },
    set: {
      qualified: setRows.length,
      boarded: boarded.set,
      omitted: (extra?.lag?.omitted || []).length,
      missingPrice: (extra?.lag?.missingPrice || []).length,
      groupQualified: (extra?.group?.reads || []).length,
    },
    high: { qualified: highRows.length, boarded: boarded.high, droppedNoExactDay: highPool.dropped },
    low: { qualified: lowRows.length, boarded: 0, droppedNoExactDay: lowPool.dropped },
    streak: { qualified: streakRows.length, boarded: boarded.streak, leftOutOnPriceDisagree: disagreements.length },
    plain: { qualified: plainRows.length, boarded: boarded.plain, droppedNoExactDay: plainPool.dropped },
  };

  return {
    asOf,
    source: catalogue?.source || "TCGplayer market",
    sourceNote: SOURCE_NOTE,
    order: BOARD_ORDER,
    boardMax: BOARD_MAX,
    plainCap: PLAIN_CAP,
    counts,
    board,
    signals,
    disagreements,
    footer: FOOTER,
    quietNight: quietNight(asOf, board.length),
  };
}

export async function dailyFileSet(root) {
  const dir = join(root, "data/history/tcgcsv-daily");
  let names = [];
  try { names = await readdir(dir); } catch { return new Set(); }
  return new Set(names.filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map((name) => name.slice(0, 10)));
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}


// Board picture order: Post Office catalogue by id, then the TCGplayer photo by productId
// (only while flags images.tcgplayer is on), then the branded tile. Never empty.
export const SITE_ORIGIN = "https://catchemtcg.com";
export const BRAND_TILE = `${SITE_ORIGIN}/og.png`;
export function boardImage(row, images = {}, tcgOn = true, sealedPid = new Map()) {
  const ids = [row?.sku, row?.id, row?.sourceLine].map((v) => String(v || "").replace(/^(move|mover|streak|plain|high|low|set|spread|askmove|mktmove)-/, "")).filter(Boolean);
  for (const id of [...ids]) { const pid = sealedPid.get(id); if (pid) ids.push(`tcgcsv-${pid}`); }
  for (const id of ids) {
    const raw = typeof images[id] === "string" ? images[id].trim().split(/[?#]/)[0] : "";
    if (!raw || raw.includes("..") || raw.includes("//")) continue;
    const m = raw.match(/^\/(?:img|thumb)\/([A-Za-z0-9]+)\/([A-Za-z0-9._-]+)$/);
    if (m) return `${SITE_ORIGIN}/data/editor/tcg/${m[1]}/${/\.[A-Za-z0-9]+$/.test(m[2]) ? m[2] : m[2] + "_hires.png"}`;
    if (/^\/cards\/[A-Za-z0-9._/-]+$/.test(raw)) return SITE_ORIGIN + raw;
  }
  const existing = String(row?.image || "");
  if (/^https:\/\/catchemtcg\.com\//.test(existing)) return existing;
  if (tcgOn) {
    for (const id of ids) {
      const pid = id.match(/^tcgcsv-(\d+)$/);
      if (pid) return `https://tcgplayer-cdn.tcgplayer.com/product/${pid[1]}_in_400x400.jpg`;
    }
  }
  return BRAND_TILE;
}

export async function loadBoardImageInputs(root) {
  let images = {};
  const tcgOn = flag("images.tcgplayer") !== false;
  try { images = JSON.parse(await readFile(join(root, "research/assets/public/catalogue-images.json"), "utf8")).images || {}; } catch { images = {}; }
  const sealedPid = new Map();
  try {
    const doc = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
    for (const p of Array.isArray(doc) ? doc : doc.products || []) if (p?.id && /^\d+$/.test(String(p.tcgPlayerId || ""))) sealedPid.set(String(p.id), String(p.tcgPlayerId));
  } catch { /* no sealed map */ }
  return { images, tcgOn, sealedPid };
}

export async function writeReadLibrary({ root, catalogue, extra, series, dailyFiles = null, sealed = null, radar = null, library = null, pptPublic = null, volumeReads = null }) {
  const files = dailyFiles || await dailyFileSet(root);
  let open = library === true;
  if (library == null) {
    const { libraryOn } = await import("./second-library.mjs");
    open = libraryOn() === true;
  }
  let products = sealed;
  let radarDoc = radar;
  if (open && products == null) products = await readJson(join(root, "data/sealed-products.json"));
  if (open && radarDoc == null) radarDoc = await readJson(join(root, "data/release-radar.json"));
  const lib = buildReadLibrary({
    catalogue,
    extra,
    series,
    dailyFiles: files,
    sealed: products,
    radar: radarDoc,
    library: open,
    pptPublic,
    volumeReads,
  });
  const path = join(root, LIBRARY_FILE);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(lib));
  const readsPath = join(root, READS_FILE);
  await mkdir(dirname(readsPath), { recursive: true });
  const published = publishReads(lib);
  const { images: boardImages, tcgOn, sealedPid } = await loadBoardImageInputs(root);
  // publishReads returns the same row objects as lib.board. Stamp the picture
  // on copies so the library object stays the one written to read-library.json.
  const stamped = (published.reads || []).map((row) => ({ ...row }));
  for (const row of stamped) row.image = boardImage(row, boardImages, tcgOn, sealedPid);
  await writeFile(readsPath, JSON.stringify({ ...published, reads: stamped }));
  return lib;
}
