// eBay listing counts from filteredTotal. Not a sale. Not published here.

import { money } from "../public-bundle.mjs";
import { listingSentence, listingsPastMinimum, monthDay, TAKE_CODES, takeCode } from "../takes.mjs";

// The 17 rows in data/sealed-products.json with combinedArts true, on main at 2a790c1.
export const COMBINED_ART_PARENTS = new Set([
  "xy12-etb", "me2pt5-tin", "sm1-etb", "sm5-etb", "sv8-bb", "swsh5-etb", "swsh6-etb",
  "swsh6-pc-etb", "swsh7-pc-etb", "sv1-pc-etb", "sv4-pc-etb", "sv5-pc-etb",
  "me1-etb", "me1-pc-etb", "sv5-etb", "swsh7-etb", "swsh1-etb",
]);

function spanDays(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(from || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(to || ""))) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function listingTrend(product) {
  if (!product || product.combinedArts === true || COMBINED_ART_PARENTS.has(String(product.id || ""))) return null;
  const start = product.start?.filteredTotal;
  const end = product.end?.filteredTotal;
  const startDate = String(product.start?.date || "");
  const endDate = String(product.end?.date || "");
  if (!Number.isInteger(start) || !Number.isInteger(end) || spanDays(startDate, endDate) !== 7) return null;
  const dir = end > start ? "up" : end < start ? "down" : "";
  const listings = { source: "filteredTotal", start, end, startDate, endDate };
  if (!dir || !listingsPastMinimum(listings, dir)) return null;
  const line = listingSentence(start, end, startDate, endDate);
  if (line !== `eBay listings ${start} to ${end} (${monthDay(startDate)} to ${monthDay(endDate)}).`) return null;
  const priceFrom = Number(product.price?.from);
  const priceTo = Number(product.price?.to);
  const hasPrice = priceFrom > 0 && priceTo > 0;
  const code = takeCode({
    from: hasPrice ? priceFrom : undefined,
    to: hasPrice ? priceTo : undefined,
    start: startDate,
    end: endDate,
    listings,
  });
  if (code && !TAKE_CODES.includes(code)) return null;
  const headline = hasPrice ? `${money(priceTo)} from ${money(priceFrom)}. ${line}` : line;
  return {
    id: `listing-${product.id}`,
    signal: "listing",
    headline,
    take: code,
    why: "The filtered listing count moved at least 15 and at least 20% from a start of at least 40.",
    whatWouldMakeThisWrong: "Wrong if either filtered total is not the kept count for that day.",
    receipt: {
      id: product.id,
      start,
      end,
      startDate,
      endDate,
      source: "filteredTotal",
      priceFrom: hasPrice ? priceFrom : null,
      priceTo: hasPrice ? priceTo : null,
    },
    source: hasPrice ? "TCGplayer market" : "eBay listings",
    sourceLine: `${product.id} ${startDate} ${endDate}`,
  };
}
