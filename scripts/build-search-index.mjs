// Build data/search/search-index.json from products we already track.
// Prices are copied, never invented. A row with no price has no source.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "search", "search-index.json");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function day(value) {
  if (!value || typeof value !== "string") return null;
  const match = value.match(/\d{4}-\d{2}-\d{2}/) || value.match(/\d{4}\/\d{2}\/\d{2}/);
  if (!match) return null;
  return match[0].replaceAll("/", "-");
}

function num(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function subtypeOf(row) {
  const name = row.name || "";
  const raw = String(row.subtype || "").toLowerCase();
  if (/pokemon center/i.test(name) && /elite trainer|etb/i.test(name)) return "pc-etb";
  if (raw === "pc-etb" || raw.includes("pokemon-center")) return "pc-etb";
  if (raw === "etb" || raw.includes("elite-trainer") || /elite trainer box/i.test(name)) return "etb";
  if (raw === "booster-box" || /booster box/i.test(name)) return "booster-box";
  if (/bundle display/i.test(name)) return "booster-bundle-display";
  if (raw === "booster-bundle" || /booster bundle/i.test(name)) return "booster-bundle";
  if (raw === "booster-pack" || /booster pack/i.test(name)) return "booster-pack";
  return raw || "sealed";
}

function aliasesFor(item, rules) {
  const found = new Set();
  const name = item.name.toLowerCase();
  const set = (item.set || "").toLowerCase();
  const number = String(item.number || "");
  for (const rule of rules.nicknames || []) {
    if (rule.nameIncludes && !name.includes(rule.nameIncludes.toLowerCase())) continue;
    if (rule.nameAlso && !name.includes(rule.nameAlso.toLowerCase())) continue;
    if (rule.number && number !== String(rule.number)) continue;
    if (rule.setIncludes && !set.includes(rule.setIncludes.toLowerCase())) continue;
    found.add(rule.alias);
  }
  for (const rule of rules.setAliases || []) {
    if (rule.setIncludes && set.includes(rule.setIncludes.toLowerCase())) {
      for (const alias of rule.alias || []) found.add(alias);
    }
  }
  for (const rule of rules.kindAliases || []) {
    if (item.subtype && item.subtype === rule.subtype) {
      for (const alias of rule.alias || []) found.add(alias);
    }
  }
  return [...found];
}

const rules = readJson(join(ROOT, "data", "search", "aliases.json")) || {};
const sealed = readJson(join(ROOT, "data", "sealed-prices.json"));
const singles = readJson(join(ROOT, "data", "singles-prices.json"));
const catalogue = readJson(join(ROOT, "data", "card-catalogue.json"));
const items = [];
const seen = new Set();

function push(row) {
  if (!row?.id || !row?.name || seen.has(row.id)) return;
  seen.add(row.id);
  const aliases = aliasesFor(row, rules);
  const item = {
    id: row.id,
    name: row.name,
    set: row.set || null,
    setId: row.setId || null,
    number: row.number || null,
    kind: row.kind,
    rarity: row.rarity || null,
    subtype: row.subtype || null,
    aliases,
    history: row.history,
  };
  if (row.price != null) {
    item.price = row.price;
    item.source = row.source;
    item.asOf = row.asOf;
  }
  items.push(item);
}

const sealedAsOf = day(sealed?.updatedAt);
for (const row of sealed?.products || []) {
  const price = num(row.priceMedian ?? row.priceUsd);
  push({
    id: row.id,
    name: row.name,
    set: row.set,
    setId: row.setId,
    number: null,
    kind: "sealed",
    rarity: null,
    subtype: subtypeOf(row),
    price,
    source: price != null ? "eBay asking prices" : null,
    asOf: price != null ? sealedAsOf : null,
    history: `data/sealed-prices.json#${row.id}`,
  });
}

const singleAsOf = day(singles?.updatedAt);
for (const row of singles?.cards || []) {
  const price = num(row.priceMarket);
  push({
    id: row.cardId || row.id,
    name: row.name,
    set: row.setName || row.set,
    setId: row.setId,
    number: row.number,
    kind: "single",
    rarity: row.rarity,
    subtype: null,
    price,
    source: price != null ? "TCGplayer market price" : null,
    asOf: price != null ? (day(row.provenance) || singleAsOf) : null,
    history: `data/singles-prices.json#${row.cardId || row.id}`,
  });
}

const cards = catalogue?.cards;
if (cards && typeof cards === "object") {
  for (const [id, row] of Object.entries(cards)) {
    if (!row || typeof row !== "object" || !row.name) continue;
    const price = num(row.price);
    push({
      id,
      name: row.name,
      set: row.setName,
      setId: row.setId,
      number: row.number,
      kind: "single",
      rarity: row.rarity || null,
      subtype: null,
      price,
      source: price != null ? "TCGplayer market price" : null,
      asOf: price != null ? day(row.priceUpdatedAt) : null,
      history: `data/card-catalogue.json#${id}`,
    });
  }
}

const catalogExtra = readJson(join(ROOT, "data", "catalog", "tcgcsv-latest.json"));
for (const row of catalogExtra?.items || []) {
  if (row.kind !== "single" && row.kind !== "sealed" && row.kind !== "slab") continue;
  push(row);
}

items.sort((a, b) => a.name.localeCompare(b.name) || String(a.id).localeCompare(String(b.id)));
const priced = items.filter((item) => typeof item.price === "number");
const doc = {
  asOf: sealedAsOf || singleAsOf,
  builtAt: new Date().toISOString().slice(0, 10),
  note: "One row per tracked single or sealed product. A price is copied from our files and keeps its source and as-of date. A row with no price had no price in those files. Slabs are a separate kind and are not mixed into singles.",
  counts: {
    items: items.length,
    priced: priced.length,
    single: items.filter((item) => item.kind === "single").length,
    sealed: items.filter((item) => item.kind === "sealed").length,
    slab: items.filter((item) => item.kind === "slab").length,
  },
  items,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc));
console.log(`search index ${doc.counts.items} rows (${doc.counts.priced} priced, ${doc.counts.sealed} sealed, ${doc.counts.single} singles, ${doc.counts.slab} slabs)`);
