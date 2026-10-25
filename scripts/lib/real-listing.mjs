// Real sealed listing: a complete, sealed copy of this product.
// Seller minimums are not in this file. Pass them in, or load the private config.
// A median is never called an average.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export const CHEAPEST_LABEL = "Cheapest real listing";
export const EBAY_MEDIAN_LABEL = "Median ask";
export const TCG_LISTED_LABEL = "TCGplayer listed median";
export const TCG_LISTED_NOTE = "Middle price of TCGplayer listings";
export const TCG_MARKET_LABEL = "TCGplayer market";
export const TCG_MARKET_NOTE = "recent TCGplayer sales";

export function ebayMedianNote(n) {
  const count = Number(n);
  if (!Number.isInteger(count) || count < 1) return "";
  return `Middle price of ${count} eBay listings counted`;
}

const MONTH = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;

// Title or condition text that is not a complete sealed copy.
const JUNK = [
  /\bopened\b/i,
  /\bopen box\b/i,
  /\bopen\b/i,
  /\bunsealed\b/i,
  /\bresealed\b/i,
  /\bno shrink\b/i,
  /\bdamaged\b/i,
  /\bdents?\b/i,
  /\bcrushed\b/i,
  /\btorn\b/i,
  /\btear\b/i,
  /\bwater\b/i,
  /\bbox only\b/i,
  /\bempty\b/i,
  /\bno packs\b/i,
  /\bpartial(?:ly)?\b/i,
  /\bmissing\b/i,
  /\bwithout\b/i,
  /\bread description\b/i,
  /\bas is\b/i,
  /\blots?\b/i,
  /\bmixed bundle\b/i,
  /\bproxy\b/i,
  /\bcustom\b/i,
  /\brepack\b/i,
  /\bmystery\b/i,
  /\breplica\b/i,
  /\bfake\b/i,
  /\bdigital\b/i,
  /\bcode cards?\b/i,
];

const PACK_TITLE = /\b(?:single pack|loose packs?|booster pack)\b/i;

export function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

export function landedPrice(item) {
  if (!item || typeof item !== "object") return null;
  if (item.price?.currency && item.price.currency !== "USD") return null;
  const base = Number(item.price?.value ?? item.price ?? item._delivered);
  if (!(base > 0)) return null;
  const costs = (item.shippingOptions || [])
    .map((o) => Number(o?.shippingCost?.value))
    .filter((n) => n >= 0 && Number.isFinite(n));
  if (!costs.length) return base;
  return base + Math.min(...costs);
}

function hasDeliveryEstimate(item) {
  const opts = item?.shippingOptions || [];
  return opts.some((o) => o && (o.minEstimatedDeliveryDate || o.maxEstimatedDeliveryDate));
}

function conditionOtherThanNew(item) {
  const id = String(item?.conditionId ?? "");
  if (id && id !== "1000") return true;
  const name = String(item?.condition || "").trim();
  if (!name) return false;
  return !/^new$/i.test(name);
}

function auctionWithoutBin(item) {
  const opts = item?.buyingOptions;
  if (!Array.isArray(opts) || !opts.length) return false;
  const names = opts.map((o) => String(o || "").toUpperCase());
  const auction = names.includes("AUCTION");
  const bin = names.includes("FIXED_PRICE");
  return auction && !bin;
}

function sellerBelow(item, sellerMin) {
  if (!sellerMin) return false;
  const score = Number(item?.seller?.feedbackScore);
  const pct = Number(item?.seller?.feedbackPercentage);
  if (!(score >= sellerMin.minFeedbackScore)) return true;
  if (!(pct >= sellerMin.minPositivePercent)) return true;
  return false;
}

function outsideMarket(item, market) {
  const country = String(item?.itemLocation?.country || "").trim().toUpperCase();
  if (!country || country === market) return false;
  return !hasDeliveryEstimate(item);
}

function preorderWithoutDate(title) {
  if (!/\bpre-?order\b/i.test(title)) return false;
  if (/\b20\d{2}\b/.test(title)) return false;
  if (MONTH.test(title)) return false;
  return true;
}

export function realTitleBad(title, { isPack = false } = {}) {
  const text = String(title || "");
  if (!text.trim()) return "empty";
  if (JUNK.some((re) => re.test(text))) return "title";
  if (!isPack && PACK_TITLE.test(text)) return "pack";
  if (preorderWithoutDate(text)) return "preorder";
  return "";
}

// Why this listing is not a real sealed copy. Empty string means it stays.
export function rejectRealListing(item, { isPack = false, market = "US", sellerMin = null } = {}) {
  const title = `${item?.title || ""} ${item?.condition || ""}`;
  const titleHit = realTitleBad(title, { isPack });
  if (titleHit) return titleHit;
  if (conditionOtherThanNew(item)) return "condition";
  if (auctionWithoutBin(item)) return "auction";
  if (sellerBelow(item, sellerMin)) return "seller";
  if (outsideMarket(item, String(market || "US").toUpperCase())) return "ship";
  if (!(landedPrice(item) > 0)) return "price";
  return "";
}

export function selectRealListings(items, opts = {}) {
  const first = [];
  for (const item of items || []) {
    if (rejectRealListing(item, opts)) continue;
    const price = landedPrice(item);
    if (!(price > 0)) continue;
    first.push({ item, price });
  }
  const ref = first.map((row) => row.price).sort((a, b) => a - b);
  const refMedian = ref.length ? ref[Math.floor(ref.length / 2)] : null;
  const real = first.filter((row) => !(refMedian > 0) || row.price >= refMedian * 0.5);
  real.sort((a, b) => a.price - b.price || String(a.item?.itemWebUrl || "").localeCompare(String(b.item?.itemWebUrl || "")));
  const median = real.length ? roundMoney(real[Math.floor(real.length / 2)].price) : null;
  const top = real[0];
  const url = top ? String(top.item?.itemWebUrl || top.item?.url || "").trim() : "";
  const floorPrice = top ? roundMoney(top.price) : null;
  const cheapest = top && url ? { price: floorPrice, url, title: String(top.item?.title || "").slice(0, 140) } : null;
  return { count: real.length, median, cheapest, floorPrice, refMedian: refMedian != null ? roundMoney(refMedian) : null };
}


// The labeled eBay median is the middle of the real listings.
// The older robust median is only a fallback when that set is empty.
// Oct 23: sv3pt5-upc showed $185 from 3 "real" asks (wrong 151 products that
// passed the seller gate) against a $950 robust median of 133 asks. A small
// real set whose median sits far from the robust median, or from the TCGplayer
// listed median, is not this product: the robust median is used instead.
// Limits come from the private real-listing config (drift.low, drift.high, drift.maxCount).
export const DEFAULT_DRIFT = { low: 0.5, high: 2, maxCount: 10 };
export function realMedianDrifts(real, agg, opts = {}) {
  const drift = { ...DEFAULT_DRIFT, ...(opts.drift || {}) };
  const m = Number(real?.median);
  if (!(m > 0)) return "";
  if (Number(real?.count) > drift.maxCount) return "";
  const robust = Number(agg?.askMedian) > 0 && Number(agg?.askRobustCount) > Number(real?.count) ? Number(agg.askMedian) : null;
  const tcg = Number(opts.tcgListed) > 0 ? Number(opts.tcgListed) : null;
  for (const [name, ref] of [["robust", robust], ["tcg", tcg]]) {
    if (ref && (m < ref * drift.low || m > ref * drift.high)) return name;
  }
  return "";
}

// Oct 24: after the drift guard, 63 of 210 products still published a "median"
// of 1 to 4 real listings while dozens of robust asks existed (sv3-pack $7 was a
// mini portfolio "without" a pack; sv3pt5-upc $700 was one listing vs $950 of 133).
// A real set under the proven minimum (the same one the floor uses) is not a
// median when a larger robust set exists; the robust median is used instead.
export const DEFAULT_MEDIAN_MIN = 5;
export function realSetTooThin(real, agg, opts = {}) {
  const min = Number(opts.minCount) > 0 ? Number(opts.minCount) : DEFAULT_MEDIAN_MIN;
  if (Number(real?.count) >= min) return false;
  return Number(agg?.askMedian) > 0 && Number(agg?.askRobustCount) > Number(real?.count || 0);
}

export function medianFacts(real, agg, opts = {}) {
  if (real && real.count > 0 && real.median > 0 && !realSetTooThin(real, agg, opts) && !realMedianDrifts(real, agg, opts)) {
    return { ebayMedianAsk: real.median, ebayMedianCount: real.count };
  }
  const ebayMedianAsk = (Number(agg?.askMedian) > 0 ? Number(agg.askMedian) : null)
    || (Number(agg?.priceMedian) > 0 ? Number(agg.priceMedian) : null)
    || null;
  const ebayMedianCount = (Number(agg?.askRobustCount) > 0 ? Number(agg.askRobustCount) : null)
    || (Number(agg?.listingCount) > 0 ? Number(agg.listingCount) : null);
  return { ebayMedianAsk, ebayMedianCount };
}

export function moneyText(n) {
  const v = Number(n);
  if (!(v > 0)) return "";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// The sealed price box, same words on the site, in email, and in the bot.
// Cheapest is omitted when no exact listing URL qualifies.
export function askBoxLines(product, market) {
  const lines = [];
  const median = Number(product?.ebayMedianAsk || product?.askMedian || product?.priceMedian);
  const count = Number(product?.ebayMedianCount ?? product?.askRobustCount);
  const cheap = product?.cheapestReal;
  const cheapPrice = Number(cheap?.price);
  const cheapUrl = String(cheap?.url || "").trim();
  if (cheapPrice > 0 && /^https:\/\/www\.ebay\.com\/itm\//.test(cheapUrl) && !floorBad(cheapPrice, median)) {
    lines.push(`Cheapest real listing ${moneyText(cheapPrice)} ${cheapUrl}`);
  }
  if (median > 0) {
    const note = Number.isInteger(count) && count >= 1 ? ` ${ebayMedianNote(count)}.` : "";
    lines.push(`Median ask ${moneyText(median)}.${note}`);
  }
  const listed = Number(product?.tcgListedMedian);
  if (listed > 0) lines.push(`${TCG_LISTED_LABEL} ${moneyText(listed)}. ${TCG_LISTED_NOTE}.`);
  const mkt = Number(market);
  if (mkt > 0) lines.push(`${TCG_MARKET_LABEL} ${moneyText(mkt)}. ${TCG_MARKET_NOTE}.`);
  return lines;
}

export function gapPct(cheapest, median) {
  const c = Number(cheapest);
  const m = Number(median);
  if (!(c > 0) || !(m > 0)) return null;
  return Math.round(((c - m) / m) * 1000) / 10;
}

export function historyPointBad(price, median) {
  const p = Number(price);
  const m = Number(median);
  return m > 0 && p > 0 && p < m * 0.3;
}

export function floorBad(price, median) {
  const p = Number(price);
  const m = Number(median);
  return m > 0 && p > 0 && p < m * 0.5;
}

export function robustMedianOf(product) {
  const n = Number(product?.askMedian || product?.ebayMedianAsk || product?.priceMedian || product?.priceUsd);
  return n > 0 ? n : null;
}

export function cleanHistory(points, median) {
  const kept = [];
  const dropped = [];
  for (const point of points || []) {
    const price = Number(point?.price);
    if (historyPointBad(price, median)) dropped.push(point);
    else kept.push(point);
  }
  return { kept, dropped };
}

// Drop a junk floor and history points. Does not invent a cheapest listing.
export function gateSealedProduct(product) {
  const median = robustMedianOf(product);
  const log = [];
  let next = product;
  const cheap = Number(product?.cheapestReal?.price ?? product?.priceFloorClean);
  if (floorBad(cheap, median)) {
    log.push({ id: product.id, rule: "cheapest-under-half", price: cheap, median });
    next = { ...next, priceFloorClean: null, cheapestReal: null };
  }
  if (Array.isArray(product?.priceHistory)) {
    const { kept, dropped } = cleanHistory(product.priceHistory, median);
    if (dropped.length) {
      log.push({ id: product.id, rule: "history-under-0.3", dropped: dropped.length, median });
      next = { ...next, priceHistory: kept };
    }
  }
  return { product: next, log };
}

export function gateSealedPrices(products) {
  const log = [];
  const out = [];
  for (const product of products || []) {
    const res = gateSealedProduct(product);
    out.push(res.product);
    log.push(...res.log);
  }
  return { products: out, log };
}

export async function loadSellerMin(root) {
  const paths = [
    process.env.REAL_LISTING_FILE,
    join(root || "", "real-listing.json"),
    join(root || "", "data/private/real-listing.json"),
    join(root || "", "..", "catchem-data-private", "config", "real-listing.json"),
    join(root || "", "..", "catchem-data-private", "data/private/real-listing.json"),
  ].filter(Boolean);
  for (const path of paths) {
    try {
      const cfg = JSON.parse(await readFile(path, "utf8"));
      const minFeedbackScore = Number(cfg.minFeedbackScore);
      const minPositivePercent = Number(cfg.minPositivePercent);
      if (minFeedbackScore >= 0 && minPositivePercent > 0 && minPositivePercent <= 100) {
        const d = cfg.drift || {};
        const drift = {};
        if (Number(d.low) > 0 && Number(d.low) < 1) drift.low = Number(d.low);
        if (Number(d.high) > 1) drift.high = Number(d.high);
        if (Number(d.maxCount) >= 1) drift.maxCount = Number(d.maxCount);
        return { minFeedbackScore, minPositivePercent, drift };
      }
    } catch { /* next location */ }
  }
  return null;
}

// tcgcsv midPrice: the listing mid on the price row, not marketPrice (recent sales).
export async function loadTcgListedMedians(root) {
  const dir = join(root, "data/history/tcgcsv-daily/raw");
  let days = [];
  try { days = (await readdir(dir)).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name)).sort(); } catch { return new Map(); }
  const out = new Map();
  const day = days.at(-1);
  if (!day) return out;
  let text = "";
  try { text = gunzipSync(await readFile(join(dir, day, "prices.ndjson.gz"))).toString("utf8"); } catch { return out; }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    const id = Number(row.productId);
    const mid = Number(row.midPrice);
    if (id > 0 && mid > 0 && String(row.subTypeName || "") === "Normal") out.set(id, roundMoney(mid));
  }
  return out;
}

// True when a floor would sit above the published median. Such a floor is dropped.
export function floorAboveMedianOf(floor, median) {
  const f = Number(floor), m = Number(median);
  return floor != null && Number.isFinite(f) && m > 0 && f > m;
}

// Why a clean floor is dropped, or "" when it stays. A floor needs at least
// minCount real listings and can never sit above the published median.
export function floorDropReason(floor, count, median, minCount) {
  if (floor == null) return "";
  if (!(Number(count) >= minCount)) return `floor from ${Number(count) || 0} listing(s), under the proven minimum of ${minCount}`;
  if (floorAboveMedianOf(floor, median)) return "floor above the published median";
  return "";
}
