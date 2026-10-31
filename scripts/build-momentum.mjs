#!/usr/bin/env node
// Private momentum reads for every product on the sealed market pulse.
// Reads files already on disk. Does not fetch, republish, or call an API.
// node scripts/build-momentum.mjs --config path/to/limits.json --out path/to/data/private/momentum
// Cutoffs are not in this file. Output stays out of the public site tree.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ABOUT,
  DEMAND_MISSING,
  assertLimits,
  backtestProduct,
  iconKey,
  readProduct,
  summarize,
} from "./lib/momentum.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function assertPrivateOut(dest) {
  const path = String(dest || "").replace(/\\/g, "/");
  if (!path || path.includes("research/assets/public") || path.endsWith("sealed-market-pulse.json")) {
    const err = new Error("momentum stays private");
    err.code = "PUBLIC_OUT";
    throw err;
  }
  return path;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadListings(heatPath) {
  const rows = existsSync(heatPath) ? readJson(heatPath) : [];
  const byId = new Map();
  for (const row of rows || []) {
    if (!row || !row.id || row.listingCount == null || !Number.isFinite(Number(row.listingCount))) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) continue;
    const list = byId.get(row.id) || [];
    list.push({ date: row.date, n: Number(row.listingCount) });
    byId.set(row.id, list);
  }
  return byId;
}

export function loadMarketPrices(dir) {
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    if (name === "coverage.json" || name === "mapping.json") continue;
    let doc;
    try { doc = readJson(join(dir, name)); } catch { continue; }
    if (!doc || !Array.isArray(doc.points)) continue;
    const source = String(doc.source || "");
    if (!/tcgplayer/i.test(source)) continue;
    const points = [];
    for (const row of doc.points) {
      if (!row || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ""))) continue;
      if (row.market == null || !Number.isFinite(Number(row.market)) || Number(row.market) <= 0) continue;
      points.push({ date: row.date, price: Number(row.market), source: "TCGplayer market" });
    }
    const id = doc.id || name.replace(/\.json$/, "");
    byId.set(id, points);
  }
  return byId;
}

function span(rows, dateKey) {
  const dates = (rows || []).map((row) => row[dateKey]).filter(Boolean).sort();
  if (!dates.length) return { from: null, to: null, n: 0 };
  return { from: dates[0], to: dates[dates.length - 1], n: dates.length };
}

export function buildMomentum({ root = ROOT, limits, asOf = "" } = {}) {
  assertLimits(limits);
  const pulse = readJson(join(root, "research/assets/public/sealed-market-pulse.json"));
  const listings = loadListings(join(root, "data/heat-history.json"));
  const prices = loadMarketPrices(join(root, "data/history/tcgplayer-market"));
  const products = [];
  const scored = [];
  let newest = asOf || "";
  for (const row of pulse.rows || []) {
    if (!row || !row.id) continue;
    const counts = listings.get(row.id) || [];
    const market = prices.get(row.id) || [];
    const usedCounts = asOf ? counts.filter((point) => point.date <= asOf) : counts;
    const usedPrices = asOf ? market.filter((point) => point.date <= asOf) : market;
    const countSpan = span(usedCounts, "date");
    if (!asOf && countSpan.to && countSpan.to > newest) newest = countSpan.to;
    const read = readProduct(usedCounts, limits);
    const test = backtestProduct(row.id, usedCounts, usedPrices, limits);
    scored.push(test);
    products.push({
      id: row.id,
      name: row.name || null,
      set: row.set || null,
      type: row.type || null,
      tcgPlayerId: row.tcgPlayerId ?? null,
      listings: {
        source: "listings counted",
        method: "count of listings kept on the sealed price file that night",
        path: "data/heat-history.json",
        ...countSpan,
      },
      price: {
        source: usedPrices.length ? "TCGplayer market" : null,
        method: usedPrices.length ? "market print on our own days" : null,
        path: `data/history/tcgplayer-market/${row.id}.json`,
        ...span(usedPrices, "date"),
      },
      momentum: read.momentum,
      duration: read.duration,
      pattern: read.pattern,
    });
  }
  if (!newest) {
    const err = new Error("no dated listings counted");
    err.code = "NO_HISTORY";
    throw err;
  }
  const events = scored.flatMap((row) => row.events);
  const universe = scored.flatMap((row) => row.universe);
  const signals = summarize(events, universe, limits);
  const day = asOf || newest;
  const momentumDoc = {
    private: true,
    asOf: day,
    heatmapAsOf: pulse.asOf || null,
    about: ABOUT,
    demand: { series: null, missing: DEMAND_MISSING },
    iconKey: "scripts/lib/momentum-icons.json",
    products,
  };
  const scorecard = {
    private: true,
    asOf: day,
    about: "Hit rate is the share of calls whose later TCGplayer market move matched the call. A flat later price is a miss. Base rate is how often those same calls would match if the call and the later move were unrelated, using every product date that has a later price. Proven is true only when n and the lift both clear the private bar. The bar is a test, not a recommendation.",
    demand: { series: null, missing: DEMAND_MISSING },
    method: {
      listings: "count of listings kept on the sealed price file that night",
      listingsPath: "data/heat-history.json",
      price: "TCGplayer market",
      pricePath: "data/history/tcgplayer-market",
      forwardDays: limits.forwardDays,
      priceFlatAbsPct: limits.priceFlatAbsPct,
      start: "last TCGplayer market on or before the signal date",
      end: "first TCGplayer market on or after the signal date plus the forward window",
    },
    bar: { minN: limits.minN, minLift: limits.minLift },
    calls: limits.calls,
    signals,
    events,
  };
  return { day, momentumDoc, scorecard };
}

function main() {
  const config = arg("--config");
  const out = assertPrivateOut(arg("--out"));
  const root = arg("--root") || ROOT;
  const asOf = arg("--as-of") || "";
  if (!config || !existsSync(config)) {
    console.error("momentum limits not loaded");
    process.exit(1);
  }
  let limits;
  try { limits = assertLimits(JSON.parse(readFileSync(config, "utf8"))); }
  catch {
    console.error("momentum limits not loaded");
    process.exit(1);
  }
  let built;
  try { built = buildMomentum({ root, limits, asOf }); }
  catch (err) {
    console.error(err.message || "momentum build failed");
    process.exit(1);
  }
  mkdirSync(out, { recursive: true });
  const momentumPath = join(out, `momentum-${built.day}.json`);
  const scorePath = join(out, `scorecard-${built.day}.json`);
  writeFileSync(momentumPath, JSON.stringify(built.momentumDoc, null, 2) + "\n");
  writeFileSync(scorePath, JSON.stringify(built.scorecard, null, 2) + "\n");
  const proven = Object.entries(built.scorecard.signals).map(([name, row]) => `${name} n=${row.n} proven=${row.proven}`).join(" ");
  console.log(`wrote ${momentumPath}`);
  console.log(`wrote ${scorePath}`);
  console.log(`products ${built.momentumDoc.products.length} ${proven}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
