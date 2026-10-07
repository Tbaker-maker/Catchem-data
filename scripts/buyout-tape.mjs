// Buyout tape. Does not call eBay. The nightly price job already calls Browse
// and reads the response total. This file only records that total and scores
// the night-to-night change. listingCount is the filtered page count. It is
// not the Browse total and it is never copied into one.
// Plain JavaScript module. No TypeScript import.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TAPE = join(ROOT, "data", "buyout-tape.json");
const SEALED = join(ROOT, "data", "sealed-prices.json");

const NOTE = "listingCount is filtered pages, not Browse total, not solds.";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A listing drop has to clear 5% before the outlier desk treats it as a drop
// (flag-sealed-price-outliers listingChange flatOrUp). The same band is flat here.
export const FLAT_BAND = 0.05;

export function numericTotal(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Level from the night-to-night Browse total change.
 * No total, or no earlier total, stays "unscored". listingCount is not an input.
 */
export function browseLevel(now, before) {
  const latest = numericTotal(now);
  const prior = numericTotal(before);
  if (latest == null || prior == null || !(prior > 0)) return "unscored";
  const pct = (latest - prior) / prior;
  if (pct <= -FLAT_BAND) return "down";
  if (pct >= FLAT_BAND) return "up";
  return "flat";
}

export function browseNights(product) {
  const byDate = new Map();
  for (const row of product?.priceHistory || []) {
    const day = String(row?.date || "");
    const total = numericTotal(row?.total);
    if (!DAY.test(day) || total == null) continue;
    byDate.set(day, total);
  }
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export function browseDates(sealedPrices) {
  const days = new Set();
  for (const product of sealedPrices?.products || []) {
    for (const [day] of browseNights(product)) days.add(day);
  }
  return [...days].sort();
}

function clearFilteredCount(row) {
  delete row.listedNow;
  delete row.listedBefore;
  delete row.countSource;
  delete row.countSourceNote;
}

/**
 * Score every tape row from sealed-prices priceHistory[].total.
 * Does not add products that are not already on the tape. Does not read listingCount.
 */
export function applyBrowseLevels(tape, sealedPrices) {
  const doc = tape && typeof tape === "object" ? { ...tape } : { rows: [] };
  const products = new Map((sealedPrices?.products || []).filter((p) => p && p.id).map((p) => [p.id, p]));
  const rows = (Array.isArray(doc.rows) ? doc.rows : []).map((row) => ({ ...row }));
  for (const row of rows) {
    if (!row || !row.id) continue;
    const nights = browseNights(products.get(row.id));
    if (nights.length >= 2) {
      const [previousDate, before] = nights[nights.length - 2];
      const [latestDate, now] = nights[nights.length - 1];
      row.browseTotalBefore = before;
      row.browseTotalNow = now;
      row.previousDate = previousDate;
      row.latestDate = latestDate;
      row.level = browseLevel(now, before);
      row.delta = now - before;
      row.pct = Math.round(((now - before) / before) * 1000) / 10;
      clearFilteredCount(row);
    } else if (nights.length === 1) {
      row.browseTotalNow = nights[0][1];
      row.browseTotalBefore = null;
      row.latestDate = nights[0][0];
      row.level = "unscored";
      delete row.delta;
      delete row.pct;
      clearFilteredCount(row);
    } else {
      row.browseTotalNow = null;
      row.browseTotalBefore = null;
      row.level = "unscored";
      delete row.delta;
      delete row.pct;
      clearFilteredCount(row);
    }
  }
  const dates = browseDates(sealedPrices);
  doc.asOfDates = dates;
  if (dates.length) doc.latestDateInFile = dates[dates.length - 1];
  doc.levelPolicy = "browse-night-change";
  doc.levelPolicyNote = "Level is the night-to-night change in the eBay Browse total. flat when that change is within 5%. up or down past 5%. A row with no Browse total stays unscored. listingCount is not the Browse total.";
  const browseRows = rows.filter((row) => numericTotal(row.browseTotalNow) != null).length;
  doc.countSourceSummary = {
    browseTotalRows: browseRows,
    filteredPageRows: rows.length - browseRows,
    onlyFilteredPageCount: browseRows === 0,
  };
  doc.note = doc.note || NOTE;
  doc.rows = rows;
  doc.rowCount = rows.length;
  delete doc.deltaDistribution;
  delete doc.transitions;
  return doc;
}

async function readTape() {
  try {
    const doc = JSON.parse(await readFile(TAPE, "utf8"));
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { rows: [] };
    if (!Array.isArray(doc.rows)) doc.rows = [];
    return doc;
  } catch {
    return { note: NOTE, rows: [] };
  }
}

async function readSealed() {
  try {
    return JSON.parse(await readFile(SEALED, "utf8"));
  } catch {
    return null;
  }
}

// A row is written only when this same run called eBay and saved a Browse total.
// If the call does not return, the old rows stay and no filtered page count is
// copied into the Browse total. A null Browse total stays unscored.
export async function recordBuyoutHarvest(run) {
  const prev = await readTape();
  const saved = Array.isArray(run?.saved) ? run.saved : [];
  const returned = [];
  for (const item of saved) {
    const total = numericTotal(item?.browseTotal);
    const id = typeof item?.id === "string" ? item.id : "";
    if (!id || total == null) continue;
    returned.push({
      id,
      browseTotal: total,
      price: numericPrice(item?.price),
      name: typeof item?.name === "string" && item.name ? item.name : "",
      date: typeof item?.date === "string" ? item.date : "",
    });
  }

  if (!run?.ebayReturned || returned.length === 0) {
    prev.note = prev.note || NOTE;
    prev.harvestRan = false;
    prev.ebayCalled = false;
    prev.rows = (prev.rows || []).map((row) => ({ ...row }));
    await writeFile(TAPE, JSON.stringify(prev, null, 2) + "\n");
    return { harvestRan: false, ebayCalled: false, wrote: 0, kept: prev.rows.length };
  }

  const rows = (prev.rows || []).map((row) => ({ ...row }));
  const index = new Map();
  rows.forEach((row, i) => { if (row && row.id) index.set(row.id, i); });

  for (const item of returned) {
    const at = index.get(item.id);
    const old = at == null ? null : rows[at];
    const before = numericTotal(old?.browseTotalNow);
    const row = {
      id: item.id,
      ebayCalled: true,
      browseTotalNow: item.browseTotal,
      browseTotalBefore: before,
      level: browseLevel(item.browseTotal, before),
    };
    if (old?.name) row.name = old.name;
    else if (item.name) row.name = item.name;
    if (item.date) row.latestDate = item.date;
    if (old?.latestDate && old.latestDate !== item.date) row.previousDate = old.latestDate;
    if (item.price != null) row.price = item.price;
    if (before != null && before > 0) {
      row.delta = item.browseTotal - before;
      row.pct = Math.round(((item.browseTotal - before) / before) * 1000) / 10;
    }
    if (at == null) {
      index.set(item.id, rows.length);
      rows.push(row);
    } else {
      rows[at] = row;
    }
  }

  prev.rows = rows;
  prev.harvestRan = true;
  prev.ebayCalled = true;
  const sealed = await readSealed();
  const scored = sealed ? applyBrowseLevels(prev, sealed) : prev;
  if (!sealed) {
    scored.levelPolicy = "browse-night-change";
    scored.levelPolicyNote = "Level is the night-to-night change in the eBay Browse total on this run. A row with no Browse total stays unscored. listingCount is not used.";
    const browseRows = rows.filter((row) => numericTotal(row.browseTotalNow) != null).length;
    scored.countSourceSummary = {
      browseTotalRows: browseRows,
      filteredPageRows: rows.length - browseRows,
      onlyFilteredPageCount: browseRows === 0,
    };
    scored.rowCount = rows.length;
  }
  scored.harvestRan = true;
  scored.ebayCalled = true;
  scored.note = scored.note || NOTE;
  await writeFile(TAPE, JSON.stringify(scored, null, 2) + "\n");
  return { harvestRan: true, ebayCalled: true, wrote: returned.length, kept: scored.rows.length - returned.length, levels: levelCounts(scored.rows) };
}

export function levelCounts(rows) {
  const counts = {};
  for (const row of rows || []) {
    const level = row?.level || "unscored";
    counts[level] = (counts[level] || 0) + 1;
  }
  return counts;
}

export async function rescoreBuyoutTape({ sealedPrices, root = ROOT } = {}) {
  const tapePath = join(root, "data", "buyout-tape.json");
  let prev = { note: NOTE, rows: [] };
  try {
    prev = JSON.parse(await readFile(tapePath, "utf8"));
  } catch { /* new tape */ }
  const sealed = sealedPrices || JSON.parse(await readFile(join(root, "data", "sealed-prices.json"), "utf8"));
  const scored = applyBrowseLevels(prev, sealed);
  scored.harvestRan = prev.harvestRan === true;
  scored.ebayCalled = prev.ebayCalled === true;
  await writeFile(tapePath, JSON.stringify(scored, null, 2) + "\n");
  return { rowCount: scored.rows.length, asOfDates: scored.asOfDates, levels: levelCounts(scored.rows) };
}

async function main() {
  // Running this file on its own does not call eBay. It scores the totals already saved.
  const result = await rescoreBuyoutTape();
  const bits = Object.entries(result.levels).map(([k, n]) => `${k} ${n}`).join(", ");
  console.log(`rows ${result.rowCount} asOf ${result.asOfDates.join(", ")}`);
  console.log(`levels ${bits}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
