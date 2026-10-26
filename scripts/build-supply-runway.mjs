#!/usr/bin/env node
// Weekly listings counted and a runway in weeks.
// node scripts/build-supply-runway.mjs --config path/to/supply-runway.json
// Cutoffs are not in this file. Flag stays off.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { assertLimits, productRow } from "./lib/supply-runway.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function configArg() {
  const i = process.argv.indexOf("--config");
  return i >= 0 ? process.argv[i + 1] : "";
}

function loadLimits(path) {
  if (!path || !existsSync(path)) {
    console.error("runway limits not loaded");
    process.exit(1);
  }
  try { return assertLimits(JSON.parse(readFileSync(path, "utf8"))); }
  catch {
    console.error("runway limits not loaded");
    process.exit(1);
  }
}

function loadHistory() {
  const dir = join(ROOT, "data/derived/listing-counts/history");
  const byId = new Map();
  if (!existsSync(dir)) return byId;
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json(\.gz)?$/.test(n)).sort();
  for (const name of files) {
    const raw = readFileSync(join(dir, name));
    const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    let doc;
    try { doc = JSON.parse(text); } catch { continue; }
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.rows || []) {
      if (!row || row.kind !== "sealed" || row.id == null) continue;
      if (row.listingsCounted == null || !Number.isFinite(Number(row.listingsCounted))) continue;
      const id = String(row.id);
      const arr = byId.get(id) || [];
      arr.push({ date: row.date || date, listingsCounted: Number(row.listingsCounted) });
      byId.set(id, arr);
    }
  }
  return byId;
}

function main() {
  const limits = loadLimits(configArg());
  const sealed = JSON.parse(readFileSync(join(ROOT, "data/sealed-prices.json"), "utf8"));
  const history = loadHistory();
  let catalog = new Map();
  const catPath = join(ROOT, "data/catalog/tcgcsv-latest.json");
  if (existsSync(catPath)) {
    const cat = JSON.parse(readFileSync(catPath, "utf8"));
    for (const it of cat.items || []) {
      if (it && it.id) catalog.set(String(it.id), it);
    }
  }
  const products = [];
  const used = new Set();
  for (const p of sealed.products || []) {
    const key = p.tcgPlayerId != null ? `tcgcsv-${p.tcgPlayerId}` : "";
    if (key) used.add(key);
    let points = key ? (history.get(key) || []).map((pt) => ({ ...pt, origin: "history" })) : [];
    if (!points.length && p.listingCount != null && Number.isFinite(Number(p.listingCount)) && p.lastSeen) {
      points = [{ date: p.lastSeen, listingsCounted: Number(p.listingCount), origin: "sealed-file" }];
    }
    products.push(productRow(p, points, limits));
  }
  for (const [id, points] of history) {
    if (used.has(id)) continue;
    const it = catalog.get(id);
    if (!it || it.kind !== "sealed") continue;
    products.push(productRow({
      id,
      name: it.name || id,
      set: it.set || null,
      subtype: it.subtype || null,
    }, points.map((pt) => ({ ...pt, origin: "history" })), limits));
  }
  const asOf = String(sealed.updatedAt || "").slice(0, 10) || null;
  const withWeeks = products.filter((p) => p.weeks.length).length;
  const withRunway = products.filter((p) => p.runwayWeeks.n != null).length;
  const out = {
    SUPPLY_RUNWAY: "off",
    enabled: false,
    flag: "SUPPLY_RUNWAY",
    asOf,
    about: "Each week is the last listings counted in that week. The runway is how many weeks that count would last at the recent drop. When there are not enough weeks, or listings counted are not falling, the runway is null.",
    products,
  };
  const dest = join(ROOT, "research/assets/public/supply-runway.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out));
  console.log(`wrote ${dest}`);
  console.log(`products ${products.length} with weeks ${withWeeks} with runway ${withRunway}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
