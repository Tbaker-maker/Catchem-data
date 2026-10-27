// Sealed prices come from TCGplayer market only (Tyler, 2026-10-27).
// eBay stays a listings counted source: counts, totals and seller spread.
// eBay asks never become a price, a price history point, or a modelled value.
import { readdir, readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

export const SEALED_PRICE_SOURCE = "TCGplayer market";
// A TCGplayer point older than this is not today's price.
export const MAX_PRICE_AGE_DAYS = 3;

// Price fields on a sealed row. All of them are TCGplayer or null.
const PRICE_FIELDS = ["priceUsd", "priceMedian", "priceLow", "priceHigh", "priceFloorClean", "priceItemMedian"];
// eBay ask figures. Dropped from rows and points so nothing downstream can price from them.
const ASK_FIELDS = ["askMedian", "askP10", "askP90", "askRobustCount", "ebayMedianAsk", "ebayMedianCount", "cheapestReal", "gapPct", "topPricedTitles", "representativeImage"];
const ASK_POINT_FIELDS = ["ebayMedianAsk", "ebayMedianCount", "cheapestReal", "gapPct"];

const round = (n) => Math.round(n * 100) / 100;

function addPoint(map, pid, date, market, low) {
  const id = Number(pid);
  const m = Number(market);
  if (!(id > 0) || !(m > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return;
  if (!map.has(id)) map.set(id, new Map());
  const pt = { date, market: round(m) };
  if (Number(low) > 0) pt.low = round(Number(low));
  map.get(id).set(date, pt);
}

// pid -> Map(date -> {date, market, low}). Sources: the TCGplayer market history
// files and every raw TCGCSV day on disk (raw days win on the same date).
export async function loadSealedTcgMarket(root) {
  const out = new Map();
  const histDir = join(root, "data/history/tcgplayer-market");
  try {
    for (const file of await readdir(histDir)) {
      if (!file.endsWith(".json") || file === "mapping.json" || file === "coverage.json") continue;
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

// Latest TCGplayer point on or before `day`, at most MAX_PRICE_AGE_DAYS old.
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

// Rewrite one sealed row so every price on it is TCGplayer market.
// History keeps its listing counts; each point's price is TCGplayer on that
// exact date or the point carries no price. Nothing is carried from eBay.
export function tcgPricedRow(row, market, today) {
  const pid = Number(row?.tcgPlayerId);
  const byDate = pid > 0 ? market.get(pid) : null;
  const out = { ...row };
  for (const k of ASK_FIELDS) delete out[k];
  for (const k of PRICE_FIELDS) out[k] = null;
  const now = tcgPointFor(byDate, today);
  if (now) {
    out.priceUsd = now.market;
    out.priceMedian = now.market;
    out.priceItemMedian = now.market;
    if (now.low) out.priceLow = now.low;
    out.priceDate = now.date;
  } else {
    delete out.priceDate;
  }
  out.priceSource = SEALED_PRICE_SOURCE;
  out.listingsSource = "eBay listings counted";
  out.priceHistory = (row?.priceHistory || []).map((p) => {
    const pt = { ...p };
    for (const k of ASK_POINT_FIELDS) delete pt[k];
    delete pt.tcgListedMedian;
    const hit = byDate?.get(p.date);
    if (hit) pt.price = hit.market;
    else delete pt.price;
    return pt;
  });
  // A dated TCGplayer day with no eBay point yet still belongs on the series.
  if (now && now.date === today && !out.priceHistory.some((p) => p.date === today)) {
    out.priceHistory.push({ date: today, price: now.market });
  }
  return out;
}
