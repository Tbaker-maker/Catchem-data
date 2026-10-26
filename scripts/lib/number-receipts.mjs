// Receipts for a price. No cutoff numbers live here.
// A missing count is null. It is never written as 0.

export const ARCHIVE_BEFORE = "2026-09-25";

const BANNED = /(\bsold\b|\bsales?\b|\bbuy\b|\bsell\b|\bshould\b|\binvest\w*|\brecommend\w*|\bcollectr\b|\u2013|\u2014)/i;

export function banned(text) {
  return BANNED.test(String(text || ""));
}

export function receipt({ source, date, method, listingsCounted, filled }) {
  let n = null;
  if (listingsCounted != null && listingsCounted !== "" && Number.isFinite(Number(listingsCounted))) {
    n = Number(listingsCounted);
  }
  return {
    source: source || null,
    date: date || null,
    method: method || null,
    listingsCounted: n,
    filled: filled === true,
  };
}

export function round4(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function pctChange(from, to) {
  if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function filledOn(date, source) {
  if (source === "archived-market") return true;
  return typeof date === "string" && date < ARCHIVE_BEFORE;
}

export function publicSource(source) {
  if (!source) return null;
  if (source === "archived-market") return "Archived TCGplayer market prices";
  if (source === "tcgcsv-daily" || source === "tcgplayer-market" || source === "set-value") return "TCGplayer market";
  if (source === "ebay-browse-api" || source === "eBay asks") return "eBay asks";
  return String(source);
}

export function numberField(n, rec) {
  return { n: n == null || !Number.isFinite(Number(n)) ? null : Number(n), receipt: rec };
}

export function priorChange(history) {
  const pts = (history || [])
    .filter((p) => p && p.date && p.price != null && Number.isFinite(Number(p.price)))
    .map((p) => ({ date: p.date, price: Number(p.price) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (pts.length < 2) return { n: null, from: null, to: null, fromDate: null, toDate: null };
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { n: round4(pctChange(a.price, b.price)), from: a.price, to: b.price, fromDate: a.date, toDate: b.date };
}

export function sealedRow(product, listings, asOf) {
  const price = product.priceUsd == null || !Number.isFinite(Number(product.priceUsd)) ? null : Number(product.priceUsd);
  const date = product.lastSeen || asOf || null;
  const listed = listings && listings.n != null && Number.isFinite(Number(listings.n)) ? Number(listings.n) : (
    product.listingCount != null && Number.isFinite(Number(product.listingCount)) ? Number(product.listingCount) : null
  );
  const listDate = listings && listings.date ? listings.date : date;
  const change = priorChange(product.priceHistory);
  return {
    id: product.id,
    name: product.name,
    set: product.set,
    setId: product.setId,
    subtype: product.subtype,
    price: numberField(price, receipt({
      source: price == null ? null : "eBay asks",
      date: price == null ? null : date,
      method: price == null ? null : "median of delivered asks on file",
      listingsCounted: listed,
      filled: false,
    })),
    change: numberField(change.n, receipt({
      source: change.n == null ? null : "eBay asks",
      date: change.toDate,
      method: change.n == null ? null : "percent change from the prior ask median on file",
      listingsCounted: listed,
      filled: false,
    })),
    listingsCounted: numberField(listed, receipt({
      source: listed == null ? null : (listings ? "listings counted" : "eBay asks"),
      date: listed == null ? null : listDate,
      method: listed == null ? null : "count of listings on file",
      listingsCounted: listed,
      filled: false,
    })),
  };
}

export function singleRow(card, file, listings) {
  const price = card.price == null || !Number.isFinite(Number(card.price)) ? null : Number(card.price);
  const date = card.date || file.asOf || null;
  const listed = listings && listings.n != null && Number.isFinite(Number(listings.n)) ? Number(listings.n) : null;
  return {
    id: card.id,
    name: card.name,
    number: card.number || null,
    set: file.name || null,
    setSlug: file.slug || null,
    price: numberField(price, receipt({
      source: price == null ? null : "TCGplayer market",
      date: price == null ? null : date,
      method: price == null ? null : "market print on the set value file",
      listingsCounted: listed,
      filled: filledOn(date, null),
    })),
  };
}

export function pulseRows(doc) {
  const rows = [];
  for (const row of doc.rows || []) {
    const prices = [];
    for (const cell of row.cells || []) {
      if (!cell || cell.price == null || !Number.isFinite(Number(cell.price))) continue;
      const filled = filledOn(cell.priceDate, cell.priceSource);
      const src = publicSource(cell.priceSource);
      prices.push({
        month: cell.month,
        price: numberField(cell.price, receipt({
          source: src,
          date: cell.priceDate || null,
          method: "last dated price in that month",
          listingsCounted: null,
          filled,
        })),
        change: numberField(cell.pct, receipt({
          source: cell.pct == null ? null : src,
          date: cell.pct == null ? null : (cell.priceDate || null),
          method: cell.pct == null ? null : "percent change from the prior month on file",
          listingsCounted: null,
          filled,
        })),
      });
    }
    rows.push({
      id: row.id,
      name: row.name || null,
      set: row.set || null,
      about: row.about || doc.about || null,
      prices,
    });
  }
  return rows;
}

export function fieldOk(field) {
  return !!field && typeof field === "object" && "n" in field && field.receipt && typeof field.receipt === "object"
    && "source" in field.receipt && "date" in field.receipt && "method" in field.receipt
    && "listingsCounted" in field.receipt && "filled" in field.receipt;
}
