// Per-product deep-dive payloads for a read to open.
// Sources only: heat-history (date/price/listingCount), sealed-prices (latest
// row), buyout-tape (Browse totals when present). Volume/solds are never
// invented — Insights scope is required for sold counts.
// listingCount is filtered active asks, not solds. Browse total is not solds.

const HIST_CUT = "2026-08-18";

export const VOLUME_NOTE =
  "Sold counts need eBay Marketplace Insights scope. listingCount is active Browse asks, not solds. Browse total is not solds.";

export const OUTLIER_HOOK =
  "Optional file data/price-outliers.json (map id → {flag, note, asOf}). Absent today — leave outlier null.";

function pickLatest(product) {
  if (!product || typeof product !== "object") return null;
  const out = {
    id: product.id,
    name: product.name,
    set: product.set ?? null,
    setId: product.setId ?? null,
    subtype: product.subtype ?? null,
    dataStatus: product.dataStatus ?? null,
    source: "ebay-browse-api",
    marketplace: "EBAY_US",
  };
  if (product.priceMedian != null) out.priceMedian = product.priceMedian;
  if (product.priceFloorClean != null) out.priceFloorClean = product.priceFloorClean;
  if (product.priceHigh != null) out.priceHigh = product.priceHigh;
  if (product.listingCount != null) out.listingCount = product.listingCount;
  if (product.lastSeen) out.lastSeen = product.lastSeen;
  if (product.priceBasis) out.priceBasis = product.priceBasis;
  if (product.ebayAskMedian != null) out.ebayAskMedian = product.ebayAskMedian;
  return out;
}

function pickBuyout(row) {
  if (!row || typeof row !== "object") return null;
  const out = {
    id: row.id,
    name: row.name ?? null,
    latestDate: row.latestDate ?? null,
    level: row.level ?? null,
    ebayCalled: row.ebayCalled === true,
  };
  // Only real Browse totals. Never fill from filtered listingCount.
  if (row.browseTotalNow != null) out.browseTotalNow = row.browseTotalNow;
  if (row.browseTotalBefore != null) out.browseTotalBefore = row.browseTotalBefore;
  if (row.previousDate) out.previousDate = row.previousDate;
  if (row.countSource) out.countSource = row.countSource;
  if (row.price != null) out.price = row.price;
  return out;
}

function pickOutlier(map, id) {
  if (!map || typeof map !== "object") return null;
  const row = map[id] ?? map.products?.[id] ?? null;
  if (!row || typeof row !== "object") return null;
  return {
    flag: row.flag ?? row.kind ?? true,
    note: row.note ?? row.why ?? null,
    asOf: row.asOf ?? null,
    source: "data/price-outliers.json",
  };
}

/**
 * Build one dive payload. Pure. Does not invent solds or Browse totals.
 */
export function buildDivePayload({
  id,
  name,
  seriesRows = [],
  latestProduct = null,
  buyoutRow = null,
  outlierMap = null,
  asOf = null,
  tcgcsvId = null,
} = {}) {
  const series = [];
  for (const r of seriesRows) {
    if (!r || r.id !== id) continue;
    if (!r.date || r.date < HIST_CUT) continue;
    if (r.price == null) continue;
    series.push({
      date: r.date,
      price: r.price,
      listingCount: r.listingCount ?? null,
      source: "ebay-browse-ask",
    });
  }
  series.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const latest = pickLatest(latestProduct);
  const buyout = pickBuyout(buyoutRow);
  const outlier = pickOutlier(outlierMap, id);

  return {
    id,
    name: name || latest?.name || id,
    asOf: asOf || latest?.lastSeen?.slice?.(0, 10) || (series.at(-1)?.date ?? null),
    href: `/dive/${id}`,
    tcgcsvId: tcgcsvId || null,
    sources: {
      series: "data/heat-history.json (eBay Browse ask median + listingCount)",
      latest: "data/sealed-prices.json",
      buyoutBrowseTotals: "data/buyout-tape.json Browse total field only",
      volume: "absent — Insights scope required",
      outlier: outlier ? "data/price-outliers.json" : OUTLIER_HOOK,
    },
    series,
    latest,
    buyout,
    volume: null,
    volumeNote: VOLUME_NOTE,
    outlier,
    outlierHook: outlier ? null : OUTLIER_HOOK,
  };
}

/**
 * Build all dive payloads from on-disk docs.
 */
export function buildAllDives({
  heatHistory = [],
  sealedPrices = null,
  buyoutTape = null,
  outlierMap = null,
  redirects = null,
} = {}) {
  const products = sealedPrices?.products || [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const buyoutBy = new Map((buyoutTape?.rows || []).map((r) => [r.id, r]));
  const histBy = new Map();
  for (const r of heatHistory || []) {
    if (!r?.id) continue;
    (histBy.get(r.id) || histBy.set(r.id, []).get(r.id)).push(r);
  }

  // redirects.products: sealedId -> /p/tcgcsv-N
  const tcgBySealed = {};
  for (const [sid, href] of Object.entries(redirects?.products || {})) {
    const m = String(href).match(/tcgcsv-(\d+)/);
    if (m) tcgBySealed[sid] = `tcgcsv-${m[1]}`;
  }

  const asOf =
    (sealedPrices?.updatedAt && String(sealedPrices.updatedAt).slice(0, 10)) ||
    null;

  const ids = new Set([...byId.keys(), ...histBy.keys()]);
  const dives = [];
  for (const id of [...ids].sort()) {
    const product = byId.get(id) || null;
    const rows = histBy.get(id) || [];
    // Only ship a payload when there is at least one real series point or a latest row.
    const hasSeries = rows.some((r) => r.date >= HIST_CUT && r.price != null);
    if (!hasSeries && !product) continue;
    dives.push(
      buildDivePayload({
        id,
        name: product?.name,
        seriesRows: rows,
        latestProduct: product,
        buyoutRow: buyoutBy.get(id) || null,
        outlierMap,
        asOf,
        tcgcsvId: tcgBySealed[id] || null,
      }),
    );
  }
  return {
    asOf,
    generatedAt: new Date().toISOString(),
    count: dives.length,
    note: "Per-product deep-dive for a read to open. Charts-only hub is deferred. volume is null until Insights solds exist.",
    volumeNote: VOLUME_NOTE,
    outlierHook: OUTLIER_HOOK,
    ids: dives.map((d) => d.id),
    byTcgcsv: Object.fromEntries(
      dives.filter((d) => d.tcgcsvId).map((d) => [d.tcgcsvId, d.id]),
    ),
    dives,
  };
}
