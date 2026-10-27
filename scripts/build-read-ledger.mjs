#!/usr/bin/env node
// Every past read, misses kept. Flag READ_LEDGER stays off. This does not publish.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pointsOf, scoredRow, readRow, safeClaim, assertPublicCopy } from "./lib/read-ledger.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function productIdFromReceipt(id) {
  const body = String(id || "").slice("receipt-".length + 11);
  if (body.startsWith("sealed-")) return { kind: "sealed", id: body.slice("sealed-".length) };
  if (body.startsWith("single-")) return { kind: "single", id: body.slice("single-".length) };
  return null;
}

function loadMarket(root, ids) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const by = new Map();
  if (!existsSync(dir) || !ids.size) return by;
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const name of files) {
    const doc = readJson(join(dir, name));
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.prices || []) {
      const id = String(row.id);
      if (!ids.has(id) || !(row.market > 0)) continue;
      const list = by.get(id) || [];
      if (!list.length || list[list.length - 1].date !== date) list.push({ date, price: Number(row.market) });
      by.set(id, list);
    }
  }
  return by;
}

function marketEnds(points, date) {
  if (!date) return { on: null, later: null };
  let on = null;
  let later = null;
  for (const p of points || []) {
    if (p.date === date) on = p;
    else if (p.date > date && !later) later = p;
  }
  return { on, later };
}

export function buildReadLedger(root = ROOT) {
  const readsDoc = readJson(join(root, "research/assets/public/reads.json"));
  const reads = readsDoc.reads || [];
  const skuIds = new Set();
  for (const read of reads) {
    const m = String(read.sku || "").match(/^tcgcsv-(\d+)$/);
    if (m) skuIds.add(m[1]);
  }
  const market = loadMarket(root, skuIds);
  const rows = [];
  for (const read of reads) {
    const m = String(read.sku || "").match(/^tcgcsv-(\d+)$/);
    const ends = m ? marketEnds(market.get(m[1]) || [], read.asOf) : { on: null, later: null };
    rows.push(safeClaim(readRow(read, ends)));
  }

  const sealed = readJson(join(root, "data/sealed-prices.json"));
  const byProduct = new Map((sealed.products || []).map((p) => [p.id, pointsOf(p.priceHistory)]));
  const scoredDoc = existsSync(join(root, "research/assets/public/receipts.json"))
    ? readJson(join(root, "research/assets/public/receipts.json"))
    : { rows: [] };
  for (const row of scoredDoc.rows || []) {
    const parsed = productIdFromReceipt(row.id);
    const points = parsed && parsed.kind === "sealed" ? (byProduct.get(parsed.id) || []) : [];
    rows.push(safeClaim(scoredRow(row, points)));
  }

  const doc = {
    READ_LEDGER: "off",
    enabled: false,
    flag: "READ_LEDGER",
    asOf: readsDoc.asOf || null,
    about: "Every past read is kept. Outcome is hit or miss only when our price file has the written price and a later price. Otherwise the later price and the outcome are null. A missing price is null.",
    counts: {
      reads: reads.length,
      scored: (scoredDoc.rows || []).length,
      hits: rows.filter((r) => r.outcome === "hit").length,
      misses: rows.filter((r) => r.outcome === "miss").length,
      open: rows.filter((r) => r.outcome == null).length,
    },
    rows,
  };
  const blob = JSON.stringify(doc);
  assertPublicCopy(doc, "read ledger");
  const dest = join(root, "research/assets/public/read-ledger.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, blob);
  return { dest, doc };
}

function main() {
  const { dest, doc } = buildReadLedger(ROOT);
  console.log(`wrote ${dest}`);
  console.log(`rows ${doc.rows.length} hits ${doc.counts.hits} misses ${doc.counts.misses} open ${doc.counts.open}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
