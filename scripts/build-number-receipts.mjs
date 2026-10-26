#!/usr/bin/env node
// Write research/assets/public/number-receipts.json.
// Flag RECEIPTS stays off. This does not publish.
// Pulse receipts are included only when data/sealed-market-pulse.json is present,
// or when --pulse points at that file. A missing pulse file stays null.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { sealedRow, singleRow, pulseRows } from "./lib/number-receipts.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function latestListings() {
  const dir = join(ROOT, "data/derived/listing-counts/history");
  const out = new Map();
  if (!existsSync(dir)) return { map: out, date: null };
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json(\.gz)?$/.test(n)).sort();
  if (!files.length) return { map: out, date: null };
  const name = files[files.length - 1];
  const raw = readFileSync(join(dir, name));
  const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  const doc = JSON.parse(text);
  for (const row of doc.rows || []) {
    if (!row || row.id == null || row.listingsCounted == null || !Number.isFinite(Number(row.listingsCounted))) continue;
    out.set(String(row.id), { n: Number(row.listingsCounted), date: row.date || doc.date || name.slice(0, 10) });
  }
  return { map: out, date: doc.date || name.slice(0, 10) };
}

function listingsForProduct(product, map) {
  if (product.tcgPlayerId == null) return null;
  return map.get(`tcgcsv-${product.tcgPlayerId}`) || null;
}

function main() {
  const sealedDoc = readJson(join(ROOT, "data/sealed-prices.json"));
  const asOf = String(sealedDoc.updatedAt || "").slice(0, 10) || null;
  const { map } = latestListings();
  const countedDoc = existsSync(join(ROOT, "research/assets/public/listings-counted.json"))
    ? readJson(join(ROOT, "research/assets/public/listings-counted.json"))
    : { products: [] };
  const counted = new Map();
  for (const row of countedDoc.products || []) {
    const n = row.listingsCounted && row.listingsCounted.n;
    if (row.id && n != null && Number.isFinite(Number(n))) {
      counted.set(row.id, { n: Number(n), date: row.listingsCounted.date || countedDoc.asOf || null });
    }
  }

  const sealed = (sealedDoc.products || []).map((p) => {
    const fromFile = counted.get(p.id) || listingsForProduct(p, map);
    return sealedRow(p, fromFile, asOf);
  });

  const singles = [];
  const svDir = join(ROOT, "research/assets/public/set-value");
  if (existsSync(svDir)) {
    for (const name of readdirSync(svDir)) {
      if (!name.endsWith(".json")) continue;
      const file = readJson(join(svDir, name));
      for (const card of file.top || []) {
        if (!card || !card.id) continue;
        const listed = map.get(String(card.id)) || null;
        singles.push(singleRow(card, file, listed));
      }
    }
  }

  const pulsePath = arg("--pulse") || join(ROOT, "data/sealed-market-pulse.json");
  let pulse = null;
  if (existsSync(pulsePath)) {
    const doc = readJson(pulsePath);
    pulse = {
      present: true,
      asOf: doc.built || null,
      about: doc.about || null,
      rows: pulseRows(doc),
    };
  }

  const out = {
    RECEIPTS: "off",
    enabled: false,
    flag: "RECEIPTS",
    asOf,
    about: "Every price carries a receipt: source, date, method, listings counted, and whether the print was filled from archived TCGplayer market prices. A missing number is null.",
    sealed,
    singles,
    pulse,
  };
  const dest = join(ROOT, "research/assets/public/number-receipts.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out));
  const priced = sealed.filter((r) => r.price.n != null).length;
  console.log(`wrote ${dest}`);
  console.log(`sealed ${sealed.length} priced ${priced} singles ${singles.length} pulse ${pulse ? pulse.rows.length : "null"}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
