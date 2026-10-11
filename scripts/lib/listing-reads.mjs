// Listing reads. Writer only. This does not publish.
// Counts come from filteredTotal on an exact 7-day pair. Browse totals are not used.
import { listingSentence, listingsPastMinimum, takeLayout } from "./takes.mjs";

export const SHARED_ART = new Set([
  "me1-etb", "sv5-etb", "swsh7-etb", "swsh1-etb", "xy12-etb",
  "me2pt5-tin", "sm1-etb", "swsh6-etb", "sv8-bb", "swsh5-etb",
]);

function daySpan(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function intOrNull(n) {
  return Number.isInteger(n) ? n : null;
}

export function listingRead(product) {
  if (!product || SHARED_ART.has(String(product.id || ""))) return null;
  const startN = intOrNull(product.start?.filteredTotal);
  const endN = intOrNull(product.end?.filteredTotal);
  const startDate = String(product.start?.date || "");
  const endDate = String(product.end?.date || "");
  if (startN == null || endN == null || daySpan(startDate, endDate) !== 7) return null;
  const listings = {
    source: "filteredTotal",
    start: startN,
    end: endN,
    startDate,
    endDate,
  };
  const dir = endN < startN ? "down" : endN > startN ? "up" : "";
  if (!dir || !listingsPastMinimum(listings, dir)) return null;
  const line = listingSentence(startN, endN, startDate, endDate);
  if (!line || /\b(because|Browse|listingCount|browseTotal)\b/i.test(line)) return null;
  const price = product.price;
  const layout = takeLayout({
    from: price?.from,
    to: price?.to,
    start: price?.start || startDate,
    end: price?.end || endDate,
    listings,
    source: price ? "TCGplayer market" : "eBay listings",
    sourceDate: endDate,
    why: price ? undefined : "The filtered listing count changed on those two dates.",
    wrong: "Wrong if either filtered total is not the kept count for that day.",
  });
  if (!layout) return null;
  const withPrice = Boolean(layout.prices && layout.listings);
  const text = layout.lines.join(" ");
  if (/\bbecause\b/i.test(text) || /\b(Browse|listingCount|browseTotal)\b/.test(text)) return null;
  if (product.browseTotal != null || product.listingCount != null) {
    const leaked = [product.browseTotal, product.listingCount].filter((n) => n != null).map(String);
    if (leaked.some((n) => text.includes(n) && n !== String(startN) && n !== String(endN))) return null;
  }
  return {
    id: `listing-${product.id}`,
    sku: String(product.id),
    readKind: withPrice ? "listings-price" : "listing",
    lane: withPrice ? "listings-price" : "listing",
    signal: withPrice ? "listings-price" : "listing",
    name: String(product.name || product.id || ""),
    headline: withPrice ? `${layout.prices} ${layout.listings}` : line,
    listings: line,
    take: layout.code,
    publish: false,
    lines: layout.lines,
  };
}
