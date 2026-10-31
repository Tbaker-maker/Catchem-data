// Proof dates and held price windows.
// A headline that names a start date must use that same date in startDate,
// endDate and source. A window with a flat stretch or a one-day jump past
// the private bar is not a read. The bar lives in catchem-data-private.
// This file does not publish a number that is not already on the read.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function dayNum(iso) {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000);
}

function cents(n) {
  return Math.round(Number(n) * 100);
}

function rowsOf(points) {
  const byDay = new Map();
  for (const row of points || []) {
    const iso = String(Array.isArray(row) ? row[0] : (row?.date || "")).slice(0, 10);
    const price = Number(Array.isArray(row) ? row[1] : (row?.price ?? row?.n));
    if (!ISO.test(iso) || !(price > 0)) continue;
    byDay.set(iso, price);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

export function limitsOk(doc) {
  const flatDays = Number(doc?.flatDays);
  const jumpPct = Number(doc?.jumpPct);
  if (!(flatDays > 0) || !(jumpPct > 0)) return null;
  return { flatDays, jumpPct };
}

// Missing private limits holds the read. Empty history is not a signal.
let limitsMissLogged = false;

export function holdWindow(points, from, to, limits) {
  const bar = limitsOk(limits);
  const rows = rowsOf(points);
  const start = String(from || "").slice(0, 10);
  const end = String(to || "").slice(0, 10);
  if (rows.length < 2) {
    return { hold: false, flatDays: 0, jumpPct: 0, reason: "empty history" };
  }
  if (!bar) {
    if (!limitsMissLogged) {
      console.error("read hold: private limits were not loaded, so the read is held");
      limitsMissLogged = true;
    }
    return { hold: true, flatDays: 0, jumpPct: 0, reason: "no private limits" };
  }
  if (!ISO.test(start) || !ISO.test(end) || end < start) {
    return { hold: false, flatDays: 0, jumpPct: 0, reason: "bad window" };
  }
  let flatDays = 0;
  let runStart = 0;
  for (let i = 1; i <= rows.length; i += 1) {
    const broke = i === rows.length || cents(rows[i][1]) !== cents(rows[runStart][1]);
    if (!broke) continue;
    const lo = rows[runStart][0];
    const hi = rows[i - 1][0];
    if (hi >= start && lo <= end) {
      const span = dayNum(hi) - dayNum(lo) + 1;
      if (span > flatDays) flatDays = span;
    }
    runStart = i;
  }
  let jumpPct = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i - 1][0] < start || rows[i][0] > end) continue;
    if (dayNum(rows[i][0]) - dayNum(rows[i - 1][0]) !== 1) continue;
    const pct = Math.abs(rows[i][1] - rows[i - 1][1]) / rows[i - 1][1] * 100;
    if (pct > jumpPct) jumpPct = pct;
  }
  jumpPct = Math.round(jumpPct * 10) / 10;
  const flatHold = flatDays >= bar.flatDays;
  const jumpHold = jumpPct >= bar.jumpPct;
  return {
    hold: flatHold || jumpHold,
    flatDays,
    jumpPct,
    reason: flatHold ? "flat stretch" : jumpHold ? "single-day jump" : "",
  };
}

// "from $76.71 on Oct 30, 2025" is the headline window start.
export function headlineFromDate(headline, asOf) {
  const m = String(headline || "").match(/\bfrom\s+\$[\d,]+(?:\.\d+)?\s+on\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (!m) return "";
  const year = m[3] || String(asOf || "").slice(0, 4);
  const month = MON[m[1].toLowerCase()];
  const day = Number(m[2]);
  if (!/^\d{4}$/.test(year) || !month || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function proofAgrees(read) {
  const head = String(read?.headline || "");
  const from = headlineFromDate(head, read?.asOf);
  if (!from) return true;
  const end = String(read?.endDate || read?.asOf || "");
  if (String(read?.startDate || "") !== from) return false;
  if (!String(read?.source || "").includes(from)) return false;
  if (!ISO.test(end)) return false;
  const lead = head.split(". ")[0];
  const span = dayNum(end) - dayNum(from);
  if (/\bon the year\b|\bin a year\b|\bover a year\b/i.test(lead) && span !== 365) return false;
  if (/\bin a week\b/i.test(lead) && span !== 7) return false;
  return true;
}

// The board test looks for the ISO start date inside source. Spoken dates
// hide it. Put the receipt date back after the public lines are spoken.
export function stampHistReceipt(read) {
  if (!read || read.board !== "hist") return read;
  const start = String(read.startDate || "");
  const end = String(read.endDate || "");
  if (!ISO.test(start) || end !== String(read.asOf || "")) return read;
  if (String(read.source || "").includes(start)) return read;
  return { ...read, source: `TCGplayer market, ${start} and ${end}` };
}

export async function loadHoldLimits(root, token = process.env.PRIVATE_DATA_TOKEN || "") {
  const rel = "read-hold/limits.json";
  const readDoc = async (path) => {
    try { return limitsOk(JSON.parse(await readFile(path, "utf8"))); } catch { return null; }
  };
  const local = await readDoc(join(root, "data/private", rel));
  if (local) return local;
  if (!token) return null;
  try {
    const { openPrivate } = await import("./private-store.mjs");
    const store = await openPrivate({ root, token });
    try {
      return await readDoc(join(store.dir, rel));
    } finally { await store.close([], "read hold limits"); }
  } catch { return null; }
}
