// Second library. One switch: flags.reads.library. Off means no new listing read.
// Numbers come from a file. A missing number is left off. Nothing here is estimated.
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { flag } from "../flags.mjs";
import { BOARD_MAX } from "./read-library.mjs";

export { BOARD_MAX };
export const POST_CAP = 1800;
export const SCORE_MIN = 20;
export const HORIZONS = [14, 28, 56];

export function libraryOn() {
  return flag("reads.library") === true;
}

// Tightening and Building stay behind flags.reads.library. No sentence ships
// without an exact 7-day pair of filteredTotal, and the switch above is off.
export const SHARED_ART_PARENTS = new Set([
  "me1-etb", "sv5-etb", "swsh7-etb", "swsh1-etb", "xy12-etb",
  "me2pt5-tin", "sm1-etb", "swsh6-etb", "sv8-bb", "swsh5-etb",
]);

const BANNED_WORD = /\b(resistance|support|bottom|buys?|sells?|selling|holding|printed)\b/i;

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function dollars(n) {
  const x = Number(n);
  if (!(x > 0)) return "";
  return Number.isInteger(x) ? `$${x}` : `$${x.toFixed(2)}`;
}

export function assertCleanSentence(text) {
  const line = String(text || "");
  if (BANNED_WORD.test(line)) throw new Error("banned word");
  if (/\bsupply\b/i.test(line)) throw new Error("supply alone");
  return line;
}

// The old first-to-last Browse total is not a public sentence.
// A point with no filteredTotal cannot say anything about listings.
export function publicListingSentence(point) {
  if (!Number.isInteger(point?.filteredTotal)) return null;
  return null;
}

export function windowQualifies(row = {}) {
  const id = String(row.id || "");
  if (SHARED_ART_PARENTS.has(id)) return false;
  const startDate = String(row.startDate || "");
  const endDate = String(row.endDate || "");
  if (dayGap(startDate, endDate) !== 7) return false;
  const startCount = row.startCount;
  const endCount = row.endCount;
  if (!Number.isInteger(startCount) || !Number.isInteger(endCount)) return false;
  if (startCount < 40) return false;
  const move = endCount - startCount;
  const abs = Math.abs(move);
  const pct = abs / startCount;
  if (abs < 15 || pct < 0.2 || pct >= 0.4) return false;
  const market0 = Number(row.market0);
  const market1 = Number(row.market1);
  if (!(market0 > 0) || !(market1 > 0)) return false;
  if (Math.abs(market1 - market0) / market0 > 0.05) return false;
  return true;
}

export function shelfSentence(row = {}) {
  if (!windowQualifies(row)) return null;
  const kind = row.endCount < row.startCount ? "Tightening" : "Building";
  const sentence = assertCleanSentence(
    `${row.name}: filtered eBay listings ${row.startCount} to ${row.endCount} (${row.startDate} to ${row.endDate}). TCGplayer market ${dollars(row.market0)} to ${dollars(row.market1)}.`,
  );
  return { kind, sentence };
}

export function shelfRead(input = {}) {
  if (!libraryOn()) return null;
  if (input.daysApart != null && input.daysApart !== 7) return null;
  if (!windowQualifies(input)) return null;
  return shelfSentence(input);
}

export function endOnExactDay(points, startDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate || ""))) return null;
  const endDate = addDays(startDate, 7);
  const hit = (points || []).find((point) => point?.date === endDate && Number.isInteger(point.filteredTotal));
  if (!hit) return null;
  return { endDate, endCount: hit.filteredTotal };
}

export function shelfFromHistory(products) {
  const tightening = [];
  const building = [];
  if (!libraryOn()) return { tightening, building };
  for (const product of products || []) {
    const id = String(product?.id || "");
    if (!id || SHARED_ART_PARENTS.has(id)) continue;
    const points = (product.priceHistory || []).filter((point) => /^\d{4}-\d{2}-\d{2}$/.test(String(point?.date || "")) && Number.isInteger(point.filteredTotal));
    const markets = product.markets || {};
    for (const start of points) {
      const end = endOnExactDay(points, start.date);
      if (!end) continue;
      const row = {
        id,
        name: product.name || id,
        startDate: start.date,
        endDate: end.endDate,
        startCount: start.filteredTotal,
        endCount: end.endCount,
        market0: markets[start.date],
        market1: markets[end.endDate],
      };
      const hit = shelfSentence(row);
      if (!hit) continue;
      (hit.kind === "Tightening" ? tightening : building).push(hit);
    }
  }
  return { tightening: tightening.slice(0, 1), building: building.slice(0, 1) };
}

// Full filtered listing count only when every Browse row was fetched and then
// run through the same title filter. Otherwise the field stays off.
export function filteredTotalForNight({ browseTotal, fetched, kept } = {}) {
  if (typeof browseTotal !== "number" || !Number.isInteger(browseTotal) || browseTotal < 0) return null;
  if (typeof fetched !== "number" || !Number.isInteger(fetched) || fetched !== browseTotal) return null;
  if (typeof kept !== "number" || !Number.isInteger(kept) || kept < 0 || kept > fetched) return null;
  return kept;
}

export function factsLines(row) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ""))) return [];
  const lines = [];
  if (Number(row?.market) > 0) lines.push({ label: "Market", value: Number(row.market) });
  if (Number(row?.low) > 0) lines.push({ label: "Low", value: Number(row.low) });
  lines.push({ label: "Date", value: String(row.date).slice(0, 10) });
  if (typeof row?.source === "string" && row.source.trim()) lines.push({ label: "Source", value: row.source.trim() });
  return lines;
}

export function msrpLine() {
  return "";
}

function segmentsOf(rows) {
  const segments = [];
  let run = [];
  for (const row of rows) {
    if (run.length && dayGap(run[run.length - 1].date, row.date) !== 1) {
      segments.push(run);
      run = [];
    }
    run.push(row);
  }
  if (run.length) segments.push(run);
  return segments;
}

export function productChart(points, { file = "", asOf = "" } = {}) {
  const rows = [];
  for (const point of points || []) {
    const date = String(point?.date || "").slice(0, 10);
    const market = Number(point?.market);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(market > 0)) continue;
    rows.push({ date, market });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const segments = segmentsOf(rows);
  return {
    file: String(file || ""),
    asOf: String(asOf || "").slice(0, 10),
    points: rows,
    segments,
    gapsOpen: true,
    connectsGaps: false,
  };
}

export function wrongTemplate(read) {
  const direction = read?.direction === "up" || read?.direction === "down" ? read.direction : "";
  const ship = Number(read?.shipPrice ?? read?.price);
  const day = String(read?.shipped || read?.asOf || "").slice(0, 10);
  if (!direction || !(ship > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const word = direction === "up" ? "below" : "above";
  const line = `This line would be wrong if the TCGplayer market on ${addDays(day, 14)} is ${word} ${dollars(ship)}. If that date is missing, there is no score.`;
  return assertCleanSentence(line);
}

const COMPARE_FIELDS = [
  ["Market", "market", "number"],
  ["Low", "low", "number"],
  ["Date", "date", "date"],
  ["Source", "source", "text"],
];

function present(value, kind) {
  if (kind === "number") return Number(value) > 0;
  if (kind === "date") return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  return typeof value === "string" && value.trim().length > 0;
}

export function compareRows(left, right) {
  const rows = [];
  for (const [label, key, kind] of COMPARE_FIELDS) {
    if (!present(left?.[key], kind) || !present(right?.[key], kind)) continue;
    rows.push({
      label,
      left: kind === "number" ? Number(left[key]) : String(left[key]).trim(),
      right: kind === "number" ? Number(right[key]) : String(right[key]).trim(),
    });
  }
  return rows;
}

export function capPost(text, cap = POST_CAP) {
  const raw = String(text || "");
  if (raw.length <= cap) return raw;
  const slice = raw.slice(0, cap);
  const cut = slice.lastIndexOf("\n");
  return (cut > 0 ? slice.slice(0, cut) : slice).trimEnd();
}

export function eraSeries(doc) {
  const back = doc?.series?.backfill?.points || [];
  const live = doc?.series?.live?.points || [];
  const take = (points) => points
    .filter((point) => point && /^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "")) && Number(point.equal) > 0)
    .map((point) => ({ date: String(point.date).slice(0, 10), equal: Number(point.equal) }));
  const tcgplayer = take(back);
  const ebay = take(live);
  return {
    id: String(doc?.id || ""),
    name: String(doc?.name || ""),
    asOf: String(doc?.asOf || "").slice(0, 10),
    tcgplayer,
    ebay,
    tcgplayerSegments: segmentsOf(tcgplayer),
    ebaySegments: segmentsOf(ebay),
    connectsGaps: false,
    gaps: {
      tcgplayer: doc?.series?.backfill?.gaps || [],
      ebay: doc?.series?.live?.gaps || [],
    },
  };
}

export async function eraFeed(root) {
  const dir = join(root, "data/indexes");
  let names = [];
  try { names = (await readdir(dir)).filter((name) => /^era-.+\.json$/.test(name)).sort(); } catch { names = []; }
  const eras = [];
  for (const name of names) {
    const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
    eras.push({ ...eraSeries(doc), file: `data/indexes/${name}` });
  }
  return { source: "data/indexes/era-*.json", spliced: false, eras };
}

export async function shipPriceMap(root, reads) {
  const needDays = new Set();
  const sealed = new Set();
  for (const read of reads || []) {
    const day = String(read?.asOf || "").slice(0, 10);
    const sku = String(read?.sku || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) needDays.add(day);
    for (const horizon of HORIZONS) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        needDays.add(new Date(Date.parse(`${day}T00:00:00Z`) + horizon * 86400000).toISOString().slice(0, 10));
      }
    }
    if (sku && !sku.startsWith("tcgcsv-")) sealed.add(sku);
  }
  const byDay = new Map();
  for (const day of needDays) {
    const map = new Map();
    try {
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", `${day}.json`), "utf8"));
      for (const row of doc.prices || []) {
        if (Number(row?.market) > 0) map.set(Number(row.id), { market: Number(row.market), low: Number(row.low) > 0 ? Number(row.low) : null, source: doc.source || "" });
      }
    } catch { /* that day is not a file */ }
    byDay.set(day, map);
  }
  const sealedDocs = new Map();
  for (const id of sealed) {
    try {
      sealedDocs.set(id, JSON.parse(await readFile(join(root, "data/history/tcgplayer-market", `${id}.json`), "utf8")));
    } catch { sealedDocs.set(id, null); }
  }
  function lookup(sku, day) {
    if (!sku || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
    if (sku.startsWith("tcgcsv-")) {
      const id = Number(sku.slice("tcgcsv-".length));
      return byDay.get(day)?.get(id) || null;
    }
    const doc = sealedDocs.get(sku);
    const point = (doc?.points || []).find((row) => row?.date === day && Number(row.market) > 0);
    if (!point) return null;
    return { market: Number(point.market), low: Number(point.low) > 0 ? Number(point.low) : null, source: point.source || doc.source || "" };
  }
  const ship = {};
  const later = {};
  for (const read of reads || []) {
    const sku = String(read?.sku || "");
    const day = String(read?.asOf || "").slice(0, 10);
    if (!sku) continue;
    if (!ship[sku]) ship[sku] = {};
    if (!later[sku]) later[sku] = {};
    const atShip = lookup(sku, day);
    if (atShip) ship[sku][day] = atShip;
    for (const horizon of HORIZONS) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const next = new Date(Date.parse(`${day}T00:00:00Z`) + horizon * 86400000).toISOString().slice(0, 10);
      const price = lookup(sku, next);
      if (price) later[sku][next] = price.market;
    }
  }
  return { ship, later };
}
