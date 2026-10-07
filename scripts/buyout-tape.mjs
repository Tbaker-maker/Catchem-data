// Buyout tape. Does not call eBay. The nightly price job already calls Browse
// and reads the response total. This file only records that total.
// listingCount is the filtered page count. It is not the Browse total.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TAPE = join(ROOT, "data", "buyout-tape.json");

const NOTE = "listingCount is filtered pages, not Browse total, not solds.";

function numericTotal(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
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
      level: "unscored",
    };
    if (old?.name) row.name = old.name;
    else if (item.name) row.name = item.name;
    if (item.date) row.latestDate = item.date;
    if (old?.latestDate && old.latestDate !== item.date) row.previousDate = old.latestDate;
    if (item.price != null) row.price = item.price;
    if (at == null) {
      index.set(item.id, rows.length);
      rows.push(row);
    } else {
      rows[at] = row;
    }
  }

  prev.note = prev.note || NOTE;
  prev.harvestRan = true;
  prev.ebayCalled = true;
  prev.levelPolicy = "unscored";
  prev.levelPolicyNote = "No cutoff. A row with a null Browse total stays unscored. A filtered page count is not the Browse total.";
  const browseRows = rows.filter((row) => numericTotal(row.browseTotalNow) != null).length;
  prev.countSourceSummary = {
    browseTotalRows: browseRows,
    filteredPageRows: rows.length - browseRows,
    onlyFilteredPageCount: browseRows === 0,
  };
  const days = rows.map((row) => row.latestDate).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day || ""));
  if (days.length) prev.latestDateInFile = days.sort().at(-1);
  delete prev.deltaDistribution;
  delete prev.transitions;
  prev.rows = rows;
  prev.rowCount = rows.length;
  await writeFile(TAPE, JSON.stringify(prev, null, 2) + "\n");
  return { harvestRan: true, ebayCalled: true, wrote: returned.length, kept: rows.length - returned.length };
}

async function main() {
  // Running this file on its own does not call eBay. Leave the old rows.
  const result = await recordBuyoutHarvest({ ebayReturned: false, saved: [] });
  console.log(`harvestRan ${result.harvestRan} ebayCalled ${result.ebayCalled} wrote ${result.wrote} kept ${result.kept}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
