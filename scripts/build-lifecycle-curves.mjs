#!/usr/bin/env node
// Price since release vs retail, and the era median path.
// Flag LIFECYCLE stays off. This does not publish.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSeries, productRow, eraPaths, banned } from "./lib/lifecycle-curves.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadRetail(root) {
  const out = new Map();
  const msrpPath = join(root, "data/msrp.json");
  if (existsSync(msrpPath)) {
    const doc = readJson(msrpPath);
    for (const row of doc.rows || []) {
      if (!row || !row.id || row.msrpCents == null || !Number.isFinite(Number(row.msrpCents)) || !(Number(row.msrpCents) > 0)) continue;
      out.set(row.id, { n: Number(row.msrpCents) / 100, date: row.asOf || doc.sourceDate || null });
    }
  }
  const sealedPath = join(root, "data/sealed-msrp.json");
  if (existsSync(sealedPath)) {
    const doc = readJson(sealedPath);
    for (const row of doc.products || []) {
      if (!row || !row.id || out.has(row.id)) continue;
      if (row.msrpUsd == null || !Number.isFinite(Number(row.msrpUsd)) || !(Number(row.msrpUsd) > 0)) continue;
      out.set(row.id, { n: Number(row.msrpUsd), date: row.date || doc.sourceDate || null });
    }
  }
  return out;
}

export function releaseIndex(sets) {
  const byCode = new Map();
  for (const set of sets || []) {
    const logo = String(set.logo || "");
    const m = logo.match(/\/img\/([^/]+)\//);
    if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(set.release || "")) continue;
    const list = byCode.get(m[1]) || [];
    list.push(set);
    byCode.set(m[1], list);
  }
  return byCode;
}

export function matchSet(product, byCode) {
  const list = byCode.get(product.setId) || [];
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const needle = String(product.set || "").toLowerCase();
  const hit = list.find((set) => {
    const tail = String(set.name || "").split(":").pop().trim().toLowerCase();
    return needle && (String(set.name || "").toLowerCase().includes(needle) || (tail && needle.includes(tail)));
  });
  return hit || list.find((set) => !/promo/i.test(set.slug || "")) || list[0];
}

function loadDaily(root, ids) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const by = new Map();
  if (!existsSync(dir)) return by;
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const name of files) {
    const doc = readJson(join(dir, name));
    const date = doc.date || name.slice(0, 10);
    for (const row of doc.prices || []) {
      const id = String(row.id);
      if (!ids.has(id) || !(row.market > 0)) continue;
      const list = by.get(id) || [];
      const prev = list.length ? list[list.length - 1] : null;
      if (prev && prev.date === date) {
        if (prev.price !== Number(row.market)) prev.conflict = true;
        continue;
      }
      list.push({ date, price: Number(row.market) });
      by.set(id, list);
    }
  }
  for (const [id, list] of by) {
    by.set(id, list.filter((p) => !p.conflict).map(({ date, price }) => ({ date, price })));
  }
  return by;
}

function loadArchive(root, ids) {
  const path = join(root, "data/backfill/pokeviz/raw.json");
  const by = new Map();
  if (!existsSync(path)) return by;
  const doc = readJson(path);
  for (const item of doc.items || []) {
    const id = String(item.pid);
    if (!ids.has(id)) continue;
    by.set(id, item.points || []);
  }
  return by;
}

export function buildLifecycle(root = ROOT) {
  const sealed = readJson(join(root, "data/sealed-prices.json"));
  const setsDoc = existsSync(join(root, "research/assets/public/sets.json"))
    ? readJson(join(root, "research/assets/public/sets.json"))
    : { sets: [] };
  const byCode = releaseIndex(setsDoc.sets || []);
  const retail = loadRetail(root);
  const products = (sealed.products || []).map((p) => {
    const set = matchSet(p, byCode);
    const got = retail.get(p.id);
    return {
      id: p.id,
      name: p.name,
      set: p.set || set?.name || null,
      setId: p.setId || null,
      subtype: p.subtype || null,
      era: set?.era || null,
      release: set?.release || null,
      tcgId: p.tcgPlayerId != null && String(p.tcgPlayerId) !== "" ? String(p.tcgPlayerId) : null,
      retailDate: got?.date || null,
      retail: got?.n ?? null,
    };
  });
  const idSet = new Set(products.map((p) => p.tcgId).filter(Boolean));
  const daily = loadDaily(root, idSet);
  const archive = loadArchive(root, idSet);
  const rows = products.map((p) => {
    const points = p.tcgId ? joinSeries(daily.get(p.tcgId) || [], archive.get(p.tcgId) || []) : [];
    return productRow(p, points, p.retail);
  });
  const eras = eraPaths(rows);
  let newest = null;
  for (const row of rows) {
    const d = row.latest?.receipt?.date;
    if (d && (!newest || d > newest)) newest = d;
  }
  const withPrice = rows.filter((r) => r.latest.n != null).length;
  const withRetail = rows.filter((r) => r.retail.n != null).length;
  const doc = {
    LIFECYCLE: "off",
    enabled: false,
    flag: "LIFECYCLE",
    asOf: newest,
    about: "Price since release for each sealed product, and the median path by era and product type. Retail is null when no page states the amount for that exact id. A point before Sep 25 2026 is filled. A shared day keeps our own market print. A missing price is null.",
    retailNote: withRetail ? null : "Sourced retail is not on file.",
    counts: { products: rows.length, withPrice, withRetail },
    products: rows,
    eras,
  };
  const blob = JSON.stringify(doc);
  if (banned(blob)) {
    const err = new Error("lifecycle text failed the copy check");
    err.code = "BANNED";
    throw err;
  }
  const dest = join(root, "research/assets/public/sealed-era-paths.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, blob);
  return { dest, doc };
}

function main() {
  const { dest, doc } = buildLifecycle(ROOT);
  console.log(`wrote ${dest}`);
  console.log(`products ${doc.counts.products} with price ${doc.counts.withPrice} with retail ${doc.counts.withRetail} eras ${doc.eras.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
