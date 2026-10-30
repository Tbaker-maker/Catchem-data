// Thin trading on a chase card. A real change is the next observed price
// differing. A missing day is not a change and does not extend a flat run.
// Thresholds are the stated rule: 3 changes, a jump over 30%, last 30 days.
// Tonight's lowest listing backs the market price only when it is on file
// and within 15% of that price. No listing, or a wider gap, does not back.
// Past lows are not looked up. A missing low stays missing, never 0.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { monthDay } from "./takes.mjs";

export const THIN_WINDOW_DAYS = 30;
export const THIN_MAX_CHANGES = 3;
export const THIN_JUMP_PCT = 30;
export const BACK_BAND_PCT = 15;

export function addDays(iso, n) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + n * 86400000).toISOString().slice(0, 10);
}

function cents(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100);
}

export function priceSteps(points, asOf, windowDays = THIN_WINDOW_DAYS) {
  const start = addDays(asOf, -windowDays);
  const rows = [];
  for (const p of points || []) {
    if (!Array.isArray(p)) continue;
    const day = String(p[0] || "").slice(0, 10);
    const price = Number(p[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < start || day > asOf || !(price > 0)) continue;
    if (rows.length && rows[rows.length - 1][0] === day) rows[rows.length - 1] = [day, price];
    else rows.push([day, price]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let changes = 0;
  let maxJumpPct = 0;
  let since = "";
  let longest = rows.length ? 1 : 0;
  let run = rows.length ? 1 : 0;
  const jumps = [];
  for (let i = 1; i < rows.length; i += 1) {
    const [d0, p0] = rows[i - 1];
    const [d1, p1] = rows[i];
    const same = cents(p0) === cents(p1);
    const adjacent = d1 === addDays(d0, 1);
    if (!same) {
      changes += 1;
      const pct = (Math.abs(p1 - p0) / p0) * 100;
      if (pct > maxJumpPct) maxJumpPct = pct;
      if (!since) since = d0;
      jumps.push({ date: d1, from: p0, to: p1, pct });
      run = 1;
    } else if (adjacent) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }
  return {
    changes,
    longest,
    since,
    maxJumpPct,
    jumps,
    last: rows.length ? rows[rows.length - 1][1] : null,
    points: rows.length,
  };
}

export function listingBacks(market, low, band = BACK_BAND_PCT) {
  const m = Number(market);
  const l = Number(low);
  if (!(m > 0) || !(l > 0)) return false;
  return (Math.abs(l - m) / m) * 100 <= band;
}

export function thinLine(changes, since) {
  const day = monthDay(since);
  const n = Number(changes);
  if (!day || !(n >= 1)) return "";
  return `Few price changes lately: moved in ${n} ${n === 1 ? "step" : "steps"} since ${day}.`;
}

export function assessThin(points, asOf, { market = null, low = null, windowDays = THIN_WINDOW_DAYS } = {}) {
  const stats = priceSteps(points, asOf, windowDays);
  const price = Number(market) > 0 ? Number(market) : stats.last;
  const listed = Number(low) > 0 ? Number(low) : null;
  const thin = stats.changes >= 1 && stats.changes <= THIN_MAX_CHANGES && stats.maxJumpPct > THIN_JUMP_PCT;
  const backed = listingBacks(price, listed);
  return {
    ...stats,
    market: price,
    low: listed,
    thin,
    backed,
    canLead: !thin || backed,
    line: thin && backed ? thinLine(stats.changes, stats.since) : "",
  };
}

// Last 30 nightly market prints, plus tonight's lowest listing.
// The slim daily row's low wins. Otherwise tonight's raw price file,
// matched to that day's printing. Earlier raw days are not opened.
export async function loadWindowSeries(root, asOf, windowDays = THIN_WINDOW_DAYS) {
  const points = new Map();
  const low = new Map();
  const printing = new Map();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return { points, low, printing, days: [] };
  const start = addDays(asOf, -windowDays);
  const dir = join(root, "data/history/tcgcsv-daily");
  let names = [];
  try { names = await readdir(dir); } catch { names = []; }
  const days = names.filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map((n) => n.slice(0, 10)).filter((d) => d >= start && d <= asOf).sort();
  for (const day of days) {
    let doc;
    try { doc = JSON.parse(await readFile(join(dir, `${day}.json`), "utf8")); } catch { continue; }
    for (const row of doc?.prices || []) {
      const id = Number(row?.id);
      const market = Number(row?.market);
      if (!(id > 0) || !(market > 0)) continue;
      if (!points.has(id)) points.set(id, []);
      points.get(id).push([day, market]);
      if (row.printing) printing.set(id, String(row.printing));
      if (day === asOf && Number(row.low) > 0) low.set(id, Math.round(Number(row.low) * 100) / 100);
    }
  }
  if (days.includes(asOf)) await fillRawLows(dir, asOf, printing, low);
  return { points, low, printing, days };
}

async function fillRawLows(dir, asOf, printing, low) {
  let text = "";
  try { text = gunzipSync(await readFile(join(dir, "raw", asOf, "prices.ndjson.gz"))).toString("utf8"); } catch { return; }
  const byId = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const id = Number(row?.productId);
    if (!(id > 0) || low.has(id)) continue;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(row);
  }
  for (const [id, rows] of byId) {
    const want = printing.get(id) || "";
    if (!want) continue;
    const hits = rows.filter((r) => String(r?.subTypeName || "") === want && Number(r?.lowPrice) > 0);
    if (hits.length !== 1) continue;
    low.set(id, Math.round(Number(hits[0].lowPrice) * 100) / 100);
  }
}
