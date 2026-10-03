// listingCount is filtered pages, not Browse total, not solds.
// Buyout tape from files already on disk. Does not call eBay, does not harvest.
//
// Compares each product's latest listing observation to the one before it.
// Uses the saved Browse response field `total` (priceHistory[].total, or a
// heat-history total if one is ever stored) when BOTH dates have it.
// Otherwise the row is the old filtered-page listingCount, and it says so.
// No high/medium cutoff: this file does not define one.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "data");

const NOTE = "listingCount is filtered pages, not Browse total, not solds.";

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function marksPack(id, meta) {
  const name = typeof meta?.name === "string" ? meta.name : "";
  const subtype = typeof meta?.subtype === "string" ? meta.subtype : "";
  if (subtype === "booster-pack") return true;
  if (typeof id === "string" && /(?:^|-)pack(?:-|$)/.test(id)) return true;
  if (/\bbooster pack\b/i.test(name)) return true;
  if (/\bpack\b/i.test(name)) return true;
  return false;
}

function pctChange(now, before) {
  if (before === 0) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

function quantile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function indexById(list) {
  const map = new Map();
  for (const row of list || []) {
    if (row && row.id) map.set(row.id, row);
  }
  return map;
}

async function main() {
  const heat = await loadJson(join(DATA, "heat-history.json"));
  if (!Array.isArray(heat)) throw new Error("heat-history.json is not an array");

  let catalog = [];
  try { catalog = await loadJson(join(DATA, "sealed-products.json")); } catch { catalog = []; }
  let pricesDoc = { products: [] };
  try { pricesDoc = await loadJson(join(DATA, "sealed-prices.json")); } catch { pricesDoc = { products: [] }; }

  const catalogById = indexById(catalog);
  const priceById = indexById(pricesDoc.products);

  const byId = new Map();
  for (const row of heat) {
    if (!row || !row.id || !row.date) continue;
    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id).push(row);
  }

  const rows = [];
  let skippedPacks = 0;
  let singleSnapshot = 0;
  const transitions = {};
  const dates = new Set();

  for (const [id, series] of byId) {
    const meta = catalogById.get(id) || priceById.get(id) || null;
    if (marksPack(id, meta)) { skippedPacks++; continue; }

    series.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
    for (const r of series) dates.add(r.date);
    if (series.length < 2) { singleSnapshot++; continue; }

    const latest = series[series.length - 1];
    const prev = series[series.length - 2];
    const history = priceById.get(id)?.priceHistory || [];
    const totalByDate = new Map();
    for (const h of history) {
      const t = num(h?.total);
      if (h?.date && t != null) totalByDate.set(h.date, t);
    }

    const browseNow = num(latest.total) ?? totalByDate.get(latest.date) ?? null;
    const browseBefore = num(prev.total) ?? totalByDate.get(prev.date) ?? null;
    const filteredNow = num(latest.listingCount);
    const filteredBefore = num(prev.listingCount);

    let listedNow, listedBefore, countSource, countSourceNote;
    if (browseNow != null && browseBefore != null) {
      listedNow = browseNow;
      listedBefore = browseBefore;
      countSource = "browse-total";
      countSourceNote = "Saved eBay Browse response field total on both dates. Not listingCount, not solds.";
    } else {
      if (filteredNow == null || filteredBefore == null) continue;
      listedNow = filteredNow;
      listedBefore = filteredBefore;
      countSource = "filtered-page-listingCount";
      countSourceNote = browseNow == null && browseBefore == null
        ? "No saved Browse total on these dates. listingCount is the filtered page count, not the eBay Browse total, and not solds."
        : "Browse total is missing on one of these dates, so the delta uses listingCount. listingCount is the filtered page count, not the eBay Browse total, and not solds.";
    }

    const delta = listedNow - listedBefore;
    const key = `${prev.date} -> ${latest.date}`;
    transitions[key] = (transitions[key] || 0) + 1;

    const name = typeof meta?.name === "string" && meta.name ? meta.name : null;
    const row = {
      id,
      latestDate: latest.date,
      previousDate: prev.date,
      listedNow,
      listedBefore,
      delta,
      pct: pctChange(listedNow, listedBefore),
      level: "unscored",
      countSource,
      countSourceNote,
      browseTotalNow: browseNow,
      browseTotalBefore: browseBefore,
    };
    if (name) row.name = name;
    rows.push(row);
  }

  rows.sort((a, b) => b.delta - a.delta || a.id.localeCompare(b.id));

  const deltas = rows.map(r => r.delta).slice().sort((a, b) => a - b);
  const usingBrowse = rows.filter(r => r.countSource === "browse-total").length;
  const usingFiltered = rows.filter(r => r.countSource === "filtered-page-listingCount").length;
  const sortedDates = [...dates].sort();

  const marketDir = join(ROOT, "src", "data", "market");
  const outPath = existsSync(marketDir)
    ? join(marketDir, "buyout-tape.json")
    : join(DATA, "buyout-tape.json");
  if (outPath.startsWith(marketDir)) await mkdir(marketDir, { recursive: true });

  const doc = {
    note: NOTE,
    harvestRan: false,
    ebayCalled: false,
    listingCountMeaning: "filtered page count kept after the sealed-price title filters, not the eBay Browse response total, and not units sold",
    outputPath: outPath.slice(ROOT.length + 1),
    asOfDates: sortedDates,
    latestDateInFile: sortedDates.length ? sortedDates[sortedDates.length - 1] : null,
    transitions,
    countSourceSummary: {
      browseTotalRows: usingBrowse,
      filteredPageRows: usingFiltered,
      onlyFilteredPageCount: usingBrowse === 0,
    },
    levelPolicy: "unscored",
    levelPolicyNote: "No high or medium cutoff. The files do not define one, and the observed deltas are not a gap the file itself labels. Raw listedNow, listedBefore, delta, and pct are written instead.",
    deltaDistribution: {
      n: deltas.length,
      min: deltas[0] ?? null,
      p50: quantile(deltas, 0.5),
      p90: quantile(deltas, 0.9),
      p95: quantile(deltas, 0.95),
      max: deltas.length ? deltas[deltas.length - 1] : null,
    },
    skippedPacks,
    singleSnapshot,
    rowCount: rows.length,
    rows,
  };

  await writeFile(outPath, JSON.stringify(doc, null, 2) + "\n");
  console.log(`wrote ${doc.outputPath}`);
  console.log(`rows ${rows.length} browse ${usingBrowse} filtered ${usingFiltered} packs skipped ${skippedPacks}`);
  console.log(`as-of ${doc.latestDateInFile} dates ${sortedDates.join(", ")}`);
  console.log(`levels unscored ${rows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
