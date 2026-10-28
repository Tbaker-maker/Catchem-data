// Sealed prices come from TCGplayer market only (Tyler, 2026-10-27).
// eBay stays a listings counted source: counts, totals and seller spread.
// eBay asks never become a price, a price history point, or a modelled value.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

export const SEALED_PRICE_SOURCE = "TCGplayer market";
export const SEALED_PRICE_SOURCE_LOW = "TCGplayer low listing";
export const artsPriceSource = (n) => `TCGplayer market across ${n} arts`;

// A TCGplayer point older than this is not today's price.
export const MAX_PRICE_AGE_DAYS = 3;

// Catalog SKUs left unpriced: edition is not explicit on our name, so we do not guess a TCGplayer id.
// Fake SWSH Booster Bundles, Celebrations Booster Bundle, and Detective Pikachu ETB were removed
// from the catalog (see data/history/tcgplayer-market/removed-not-real.json).
export const NO_TCG_LISTING_IDS = [
  "base2-booster-box",
  "base3-booster-box",
  "neo1-booster-box",
];

export const REMOVED_NOT_REAL_IDS = [
  "det1-etb",
  "cel25-bb",
  "swsh1-bundle",
  "swsh2-bundle",
  "swsh3-bundle",
  "swsh35-bundle",
  "swsh4-bundle",
  "swsh45-bundle",
  "swsh5-bundle",
  "swsh6-bundle",
  "swsh7-bundle",
  "swsh8-bundle",
  "swsh9-bundle",
  "swsh10-bundle",
];

const PRICE_FIELDS = ["priceUsd", "priceMedian", "priceLow", "priceHigh", "priceFloorClean", "priceItemMedian"];
const ASK_FIELDS = ["askMedian", "askP10", "askP90", "askRobustCount", "ebayMedianAsk", "ebayMedianCount", "cheapestReal", "gapPct", "topPricedTitles", "representativeImage"];
const ASK_POINT_FIELDS = ["ebayMedianAsk", "ebayMedianCount", "cheapestReal", "gapPct"];

const round = (n) => Math.round(n * 100) / 100;

function addPoint(map, pid, date, market, low) {
  const id = Number(pid);
  if (!(id > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return;
  const m = Number(market);
  const l = Number(low);
  if (!(m > 0) && !(l > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  const pt = { date };
  if (m > 0) pt.market = round(m);
  if (l > 0) pt.low = round(l);
  map.get(id).set(date, pt);
}

export async function loadSealedTcgMarket(root) {
  const out = new Map();
  const histDir = join(root, "data/history/tcgplayer-market");
  try {
    for (const file of await readdir(histDir)) {
      if (!file.endsWith(".json") || ["mapping.json", "coverage.json", "unmatched.json", "no-tcg-listing.json", "removed-not-real.json"].includes(file)) continue;
      let doc;
      try { doc = JSON.parse(await readFile(join(histDir, file), "utf8")); } catch { continue; }
      for (const pt of doc.points || []) {
        if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
        addPoint(out, doc.tcgplayerProductId, pt.date, pt.market, pt.low);
      }
    }
  } catch { /* no history dir */ }
  const rawDir = join(root, "data/history/tcgcsv-daily/raw");
  let days = [];
  try { days = (await readdir(rawDir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort(); } catch { days = []; }
  for (const day of days) {
    let text = "";
    try { text = gunzipSync(await readFile(join(rawDir, day, "prices.ndjson.gz"))).toString("utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let row;
      try { row = JSON.parse(line); } catch { continue; }
      if (String(row.subTypeName || "Normal") !== "Normal") continue;
      addPoint(out, row.productId, day, row.marketPrice, row.lowPrice);
    }
  }
  return out;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export function tcgPointFor(byDate, day) {
  if (!byDate) return null;
  let best = null;
  for (const pt of byDate.values()) {
    if (pt.date > day) continue;
    if (!best || pt.date > best.date) best = pt;
  }
  if (!best || daysBetween(best.date, day) > MAX_PRICE_AGE_DAYS) return null;
  return best;
}

export function catalogByIdFrom(catalog) {
  const list = Array.isArray(catalog) ? catalog : Object.values(catalog || {});
  return new Map(list.filter((p) => p && p.id).map((p) => [p.id, p]));
}

export function resolveTcgPlayerId(row, catalogById) {
  const out = { ...row };
  let pid = Number(out.tcgPlayerId);
  if (pid > 0) return { row: out, pid };
  const cat = catalogById?.get(out.id);
  if (cat && Number(cat.tcgPlayerId) > 0) {
    pid = Number(cat.tcgPlayerId);
    out.tcgPlayerId = String(pid);
    if (!out.tcgPlayerIdMethod) out.tcgPlayerIdMethod = cat.tcgPlayerIdMethod || "catalog";
    if (cat.tcgplayerName && !out.tcgplayerName) out.tcgplayerName = cat.tcgplayerName;
    if (cat.groupId != null && out.groupId == null) out.groupId = cat.groupId;
    return { row: out, pid };
  }
  const embed = String(out.id || "").match(/^tcgcsv-(\d+)$/);
  if (embed) {
    pid = Number(embed[1]);
    out.tcgPlayerId = String(pid);
    if (!out.tcgPlayerIdMethod) out.tcgPlayerIdMethod = "tcgcsv-product-id";
    return { row: out, pid };
  }
  return { row: out, pid: 0 };
}

export function medianOf(nums) {
  const a = nums.filter((n) => Number(n) > 0).map(Number).sort((x, y) => x - y);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : round((a[mid - 1] + a[mid]) / 2);
}

export function lowListingUsable(row, low) {
  const l = Number(low);
  if (!(l > 0)) return false;
  const floor = Number(row?.priceFloor);
  const ceil = Number(row?.priceCeiling);
  if (ceil > 0 && l > ceil) return false;
  if (floor > 0 && l < floor * 0.25) return false;
  return true;
}

function clearAskAndPrice(out) {
  for (const k of ASK_FIELDS) delete out[k];
  for (const k of PRICE_FIELDS) out[k] = null;
}

function applyHistory(out, byDate, today, nowPrice) {
  out.priceHistory = (out.priceHistory || []).map((p) => {
    const pt = { ...p };
    for (const k of ASK_POINT_FIELDS) delete pt[k];
    delete pt.tcgListedMedian;
    const hit = byDate?.get(p.date);
    if (hit?.market > 0) pt.price = hit.market;
    else delete pt.price;
    return pt;
  });
  if (nowPrice != null && !out.priceHistory.some((p) => p.date === today)) {
    out.priceHistory.push({ date: today, price: nowPrice });
  }
}

function priceFromPoint(out, now, today) {
  if (now?.market > 0) {
    out.priceUsd = now.market;
    out.priceMedian = now.market;
    out.priceItemMedian = now.market;
    if (now.low > 0) out.priceLow = now.low;
    out.priceDate = now.date;
    out.priceSource = SEALED_PRICE_SOURCE;
    return now.market;
  }
  if (now?.low > 0 && lowListingUsable(out, now.low)) {
    out.priceUsd = now.low;
    out.priceMedian = now.low;
    out.priceItemMedian = now.low;
    out.priceLow = now.low;
    out.priceDate = now.date;
    out.priceSource = SEALED_PRICE_SOURCE_LOW;
    return now.low;
  }
  delete out.priceDate;
  return null;
}

function artsFor(row, catalogById) {
  const cat = catalogById?.get(row.id);
  if (cat?.combinedArts && Array.isArray(cat.arts) && cat.arts.length) return cat.arts;
  if (row.combinedArts && Array.isArray(row.arts) && row.arts.length) return row.arts;
  return null;
}

function priceArtChild(artId, catalogById, market, today) {
  const artCat = catalogById?.get(artId) || { id: artId };
  const artPid = Number(artCat.tcgPlayerId || 0);
  const entry = {
    id: artId,
    name: artCat.name || artId,
    art: artCat.art || null,
    tcgPlayerId: artPid > 0 ? String(artPid) : null,
  };
  if (!(artPid > 0)) return entry;
  const pt = tcgPointFor(market.get(artPid), today);
  if (pt?.market > 0) {
    entry.priceUsd = pt.market;
    entry.priceSource = SEALED_PRICE_SOURCE;
    entry.priceDate = pt.date;
    if (pt.low > 0) entry.priceLow = pt.low;
  } else if (pt?.low > 0 && lowListingUsable(artCat, pt.low)) {
    entry.priceUsd = pt.low;
    entry.priceSource = SEALED_PRICE_SOURCE_LOW;
    entry.priceDate = pt.date;
    entry.priceLow = pt.low;
  }
  return entry;
}

export function tcgPricedRow(row, market, today, opts = {}) {
  const catalogById = opts.catalogById || null;
  const resolved = resolveTcgPlayerId(row, catalogById);
  const out = resolved.row;
  clearAskAndPrice(out);
  out.listingsSource = "eBay listings counted";

  const artIds = artsFor(out, catalogById);
  if (artIds?.length) {
    const artsPrices = artIds.map((id) => priceArtChild(id, catalogById, market, today));
    out.artsPrices = artsPrices;
    const marketArts = artsPrices.filter((a) => a.priceSource === SEALED_PRICE_SOURCE && Number(a.priceUsd) > 0);
    const med = medianOf(marketArts.map((a) => a.priceUsd));
    if (med != null) {
      out.priceUsd = med;
      out.priceMedian = med;
      out.priceItemMedian = med;
      out.priceSource = artsPriceSource(marketArts.length);
      out.priceDate = today;
      const lows = marketArts.map((a) => a.priceLow).filter((n) => Number(n) > 0);
      if (lows.length) out.priceLow = Math.min(...lows);
    } else {
      delete out.priceDate;
      out.priceSource = SEALED_PRICE_SOURCE;
    }
    applyHistory(out, null, today, med);
    return out;
  }

  const pid = resolved.pid;
  const byDate = pid > 0 ? market.get(pid) : null;
  const now = tcgPointFor(byDate, today);
  const priced = priceFromPoint(out, now, today);
  if (priced == null) out.priceSource = SEALED_PRICE_SOURCE;
  applyHistory(out, byDate, today, priced != null && out.priceSource === SEALED_PRICE_SOURCE ? priced : null);
  return out;
}

export function buildNoTcgListingReport(products, catalogById) {
  const asOf = new Date().toISOString().slice(0, 10);
  const items = [];
  for (const id of NO_TCG_LISTING_IDS) {
    const row = (products || []).find((p) => p.id === id) || catalogById?.get(id) || { id };
    items.push({
      id,
      name: row.name || id,
      set: row.set || null,
      subtype: row.subtype || null,
      reason: "edition not explicit on our SKU; left unpriced rather than guessing 1st Edition vs Unlimited",
    });
  }
  return {
    asOf,
    note: "These Catch'em sealed SKUs stay in the catalog without a TCGplayer price because the edition is not explicit. Fake products were removed instead (removed-not-real.json). Listings counted may still appear from eBay.",
    count: items.length,
    products: items,
  };
}

export async function writeNoTcgListingReport(root, products, catalogById) {
  const report = buildNoTcgListingReport(products, catalogById);
  const path = join(root, "data/history/tcgplayer-market/no-tcg-listing.json");
  await writeFile(path, JSON.stringify(report, null, 2) + "\n");
  return { path, report };
}
