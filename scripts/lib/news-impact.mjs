// Listings counted and price at 1, 7, and 30 days after a news item.
// A missing day stays empty. A number is copied from the series, never filled in.

export const IMPACT_DAYS = [1, 7, 30];

export function addDays(day, n) {
  const dt = new Date(`${day}T00:00:00.000Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function seriesValue(series, day, field) {
  if (!Array.isArray(series)) return null;
  const row = series.find((item) => item && item.date === day);
  if (!row || row[field] == null || row[field] === "") return null;
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : null;
}

export function impactFor(item, { prices = [], listings = [], asOf = "" } = {}) {
  const start = item?.date || "";
  const windows = IMPACT_DAYS.map((days) => {
    const date = start ? addDays(start, days) : "";
    const due = Boolean(date && asOf && date <= asOf);
    return {
      days,
      date,
      due,
      price: due ? seriesValue(prices, date, "price") : null,
      listingsCounted: due ? seriesValue(listings, date, "listingsCounted") : null,
    };
  });
  return {
    title: item?.title || "",
    url: item?.url || "",
    product: item?.product || "",
    date: start,
    windows,
  };
}

export function buildImpacts(items, books = {}, asOf = "") {
  return (items || []).filter((item) => item?.url).map((item) => {
    const key = item.product || item.url;
    const book = books[key] || books[item.url] || {};
    return impactFor(item, { prices: book.prices || [], listings: book.listings || [], asOf });
  });
}
