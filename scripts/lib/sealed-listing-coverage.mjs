// Join a sealed product to the id the listing counter stores, and copy
// listings counted that the sealed price step already saved.
// filteredTotal is the filtered count from a night when the whole Browse
// result was fetched. Browse total is not listings counted. The page
// listingCount snapshot is not listings counted. No eBay call happens here.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function verifiedProductId(product) {
  const pid = product?.tcgPlayerId ?? product?.tcgplayerProductId;
  if (pid === undefined || pid === null) return null;
  const text = String(pid).trim();
  if (!text || !/^\d+$/.test(text)) return null;
  return text;
}

export function listingIds(product) {
  const ids = [];
  if (product?.id) ids.push(String(product.id));
  const pid = verifiedProductId(product);
  if (pid) ids.push(`tcgcsv-${pid}`);
  return ids;
}

export function filteredPoints(product) {
  const out = [];
  for (const point of product?.priceHistory || []) {
    const date = String(point?.date || "");
    if (!DAY.test(date)) continue;
    if (!Number.isInteger(point.filteredTotal) || point.filteredTotal < 0) continue;
    out.push({ date, listingsCounted: point.filteredTotal });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

export function priceMoved(product, minPct = 1) {
  const prices = [];
  for (const point of product?.priceHistory || []) {
    if (!DAY.test(String(point?.date || ""))) continue;
    if (typeof point.price !== "number" || !(point.price > 0)) continue;
    prices.push(point.price);
  }
  for (let i = 1; i < prices.length; i += 1) {
    const prior = prices[i - 1];
    if (Math.abs(prices[i] - prior) / prior * 100 >= minPct) return true;
  }
  return false;
}

export function sealedStepRowsForDay(products, date) {
  if (!DAY.test(String(date || ""))) return [];
  const rows = [];
  for (const product of products || []) {
    const pid = verifiedProductId(product);
    if (!pid) continue;
    const hit = filteredPoints(product).find((point) => point.date === date);
    if (!hit) continue;
    rows.push({
      id: `tcgcsv-${pid}`,
      slug: product.id ? String(product.id) : null,
      kind: "sealed",
      tier: "sealed-step",
      date,
      listingsCounted: hit.listingsCounted,
      source: "sealed-price-step",
    });
  }
  return rows;
}

// Add sealed-step rows only when that id is not already on the day.
// A listing-counter row already stored for the id is left as it is.
export function addMissingRows(prev = [], extra = []) {
  const seen = new Set((prev || []).filter((row) => row?.id).map((row) => row.id));
  const rows = [...(prev || [])];
  for (const row of extra || []) {
    if (!row?.id || seen.has(row.id)) continue;
    if (!Number.isInteger(row.listingsCounted) || row.listingsCounted < 0) continue;
    rows.push(row);
    seen.add(row.id);
  }
  return rows;
}

export function sealedStepIndex(products) {
  const series = {};
  let latest = null;
  for (const product of products || []) {
    const pid = verifiedProductId(product);
    const points = filteredPoints(product);
    if (!pid || !points.length) continue;
    series[`tcgcsv-${pid}`] = {
      slug: product.id ? String(product.id) : null,
      name: product.name || null,
      points,
    };
    const last = points[points.length - 1].date;
    if (!latest || last > latest) latest = last;
  }
  return {
    asOf: latest,
    note: "Listings counted copied from filteredTotal already stored by the sealed price step. No extra eBay call. Browse total is not listings counted.",
    series,
  };
}

export function nightsFromRows(rows, { skipSource = null } = {}) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row?.id || !DAY.test(String(row.date || ""))) continue;
    if (!Number.isInteger(row.listingsCounted) || row.listingsCounted < 0) continue;
    if (skipSource && row.source === skipSource) continue;
    if (!map.has(row.id)) map.set(row.id, new Set());
    map.get(row.id).add(row.date);
  }
  return map;
}

export function nightsFor(product, nightsById) {
  let n = 0;
  for (const id of listingIds(product)) n = Math.max(n, nightsById.get(id)?.size || 0);
  return n;
}

// Movers are live sealed products with a price step of at least minPct.
// before: 2 or more nights already in the listing-count files.
// after: that, or 2 or more filteredTotal nights on a product that has a verified id.
export function coverageReport(products, nightsById, { minPct = 1, minNights = 2 } = {}) {
  const live = (products || []).filter((product) => product?.dataStatus === "live");
  const movers = live.filter((product) => priceMoved(product, minPct));
  let before = 0;
  let after = 0;
  for (const product of movers) {
    const nightly = nightsFor(product, nightsById) >= minNights;
    const copied = Boolean(verifiedProductId(product)) && filteredPoints(product).length >= minNights;
    if (nightly) before += 1;
    if (nightly || copied) after += 1;
  }
  return { live: live.length, movers: movers.length, before, after, minPct, minNights };
}
