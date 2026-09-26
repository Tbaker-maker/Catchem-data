// Slim Pokémon catalog from a TCGCSV payload we already fetched.
// A missing market price stays missing. Nothing here invents a number.

export const TCGCSV_SOURCE = "TCGplayer market price";

const PRINTING_ORDER = [
  "Normal",
  "Holofoil",
  "Reverse Holofoil",
  "1st Edition Holofoil",
  "Unlimited Holofoil",
  "Unlimited",
  "1st Edition",
];

const FOREIGN = /japanese|korean|chinese|\bjp\b|jp exclusive/;

export function extValue(product, name) {
  const row = (product?.extendedData || []).find((e) => e?.name === name);
  return row?.value ? String(row.value) : null;
}

export function sealedSubtype(name) {
  const n = String(name || "").toLowerCase();
  const center = /pok[eé]mon center/.test(n);
  if (center && /elite trainer/.test(n)) return "pc-etb";
  if (/elite trainer/.test(n)) return "etb";
  if (/booster box/.test(n)) return "booster-box";
  if (/booster bundle/.test(n)) return "booster-bundle";
  if (/booster pack/.test(n)) return "booster-pack";
  if (/mini tin|\btin\b/.test(n)) return "tin";
  if (/collection/.test(n)) return "special-collection";
  return null;
}

export function classify(product, groupName = "") {
  const name = String(product?.name || "");
  const n = name.toLowerCase();
  const g = String(groupName || "").toLowerCase();
  if (FOREIGN.test(n) || FOREIGN.test(g)) return { skip: "not an English product" };
  if (/\bcode card\b/.test(n)) return { skip: "code card" };
  if (/\bcase\b/.test(n)) return { skip: "case, not one product" };
  const number = extValue(product, "Number");
  const rarity = extValue(product, "Rarity");
  if (/\b(psa|bgs|cgc|sgc)\b/.test(n)) return { kind: "slab", number, rarity, subtype: null };
  if (number) return { kind: "single", number, rarity, subtype: null };
  return { kind: "sealed", number: null, rarity: null, subtype: sealedSubtype(name) };
}

// One printing's market price, or null when there is no price or no single obvious printing.
export function pickMarket(rows) {
  const withMarket = (rows || []).filter((r) => typeof r.marketPrice === "number" && r.marketPrice > 0);
  if (!withMarket.length) return null;
  if (withMarket.length === 1) return withMarket[0];
  for (const name of PRINTING_ORDER) {
    const hit = withMarket.filter((r) => r.subTypeName === name);
    if (hit.length === 1) return hit[0];
  }
  return null;
}

const money = (n) => Math.round(n * 100) / 100;

export function buildGroup({ groupId, groupName, products, priceRows, asOf }) {
  const byProduct = new Map();
  for (const row of priceRows || []) {
    if (!byProduct.has(row.productId)) byProduct.set(row.productId, []);
    byProduct.get(row.productId).push(row);
  }
  const items = [];
  const prices = [];
  const skipped = [];
  let ambiguous = 0;
  for (const product of products || []) {
    const c = classify(product, groupName);
    if (c.skip) {
      skipped.push({ id: product.productId, reason: c.skip });
      continue;
    }
    const rows = byProduct.get(product.productId) || [];
    const priced = rows.filter((r) => typeof r.marketPrice === "number" && r.marketPrice > 0);
    const picked = pickMarket(rows);
    if (!picked && priced.length > 1) ambiguous++;
    const item = {
      id: `tcgcsv-${product.productId}`,
      tcgplayerProductId: product.productId,
      groupId: groupId ?? product.groupId,
      name: product.name,
      set: groupName,
      number: c.number,
      kind: c.kind,
      rarity: c.rarity,
      subtype: c.subtype,
      history: `data/history/tcgcsv-daily/${asOf}.json#${product.productId}`,
    };
    if (picked) {
      item.price = money(picked.marketPrice);
      item.source = TCGCSV_SOURCE;
      item.asOf = asOf;
      item.printing = picked.subTypeName || null;
      prices.push({ id: product.productId, market: item.price, printing: item.printing });
    }
    items.push(item);
  }
  return { items, prices, skipped, ambiguous };
}

export function mergeSnapshot(parts, { asOf, failedGroups = [] }) {
  const items = [];
  const prices = [];
  const skipped = { english: 0, code: 0, case: 0, other: 0 };
  let ambiguous = 0;
  for (const part of parts) {
    items.push(...part.items);
    prices.push(...part.prices);
    ambiguous += part.ambiguous || 0;
    for (const row of part.skipped || []) {
      if (row.reason === "not an English product") skipped.english++;
      else if (row.reason === "code card") skipped.code++;
      else if (row.reason === "case, not one product") skipped.case++;
      else skipped.other++;
    }
  }
  items.sort((a, b) => String(a.set).localeCompare(String(b.set)) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  prices.sort((a, b) => a.id - b.id);
  const counts = {
    items: items.length,
    priced: prices.length,
    unpriced: items.length - prices.length,
    ambiguousPrintings: ambiguous,
    single: items.filter((i) => i.kind === "single").length,
    sealed: items.filter((i) => i.kind === "sealed").length,
    slab: items.filter((i) => i.kind === "slab").length,
    skipped,
    failedGroups: failedGroups.length,
  };
  const note = "Live TCGCSV catalog for Pokémon (category 3). One day of TCGplayer market prices. Earlier days are not in this file. A row with no price had no single market price. No price was invented.";
  return {
    latest: {
      asOf,
      source: TCGCSV_SOURCE,
      feed: "https://tcgcsv.com/tcgplayer/3",
      note,
      counts,
      failedGroups,
      items,
    },
    daily: {
      date: asOf,
      source: TCGCSV_SOURCE,
      feed: "https://tcgcsv.com/tcgplayer/3",
      note: "Prices observed on this day only. This file does not fill any earlier day.",
      counts: { priced: prices.length, unpriced: counts.unpriced },
      prices,
    },
    coverage: {
      asOf,
      source: TCGCSV_SOURCE,
      counts,
      failedGroups,
      note,
    },
  };
}
