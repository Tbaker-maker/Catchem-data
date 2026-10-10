// Per-product deep-dive payloads for a read to open.
// Sources only: heat-history (date/price/listingCount), sealed-prices (latest
// row), buyout-tape (Browse totals when present). Volume/solds are never
// invented — Insights scope is required for sold counts.
// listingCount is filtered active asks, not solds. Browse total is not solds.

const HIST_CUT = "2026-08-18";

export const VOLUME_NOTE =
  "Sold counts need eBay Marketplace Insights scope. listingCount is active Browse asks, not solds. Browse total is not solds.";

export const OUTLIER_SOURCE = "data/derived/sealed-price-outliers.json";

// Net change in the eBay Browse search total between the first and the last day
// that total was recorded. It is an estimate of listing churn, nothing more:
// listings end, get relisted or pulled for many reasons. It must never be
// called a sale count, and reads may use it only after MIN_DAYS of totals.
export const LISTING_CHANGE_LABEL = "net change in active eBay listings (estimate)";
export const LISTING_CHANGE_MIN_DAYS_FOR_READS = 7;
export const LISTING_CHANGE_SOURCE = "data/sealed-prices.json priceHistory[].total (eBay Browse search total)";

export function listingChangeEstimate(product) {
  const byDate = new Map();
  for (const p of product?.priceHistory || []) {
    const day = String(p?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!Number.isInteger(p.total) || p.total < 0) continue;
    byDate.set(day, p.total);
  }
  const days = [...byDate.keys()].sort();
  if (days.length < 2) return null;
  const from = days[0];
  const to = days[days.length - 1];
  const startTotal = byDate.get(from);
  const endTotal = byDate.get(to);
  return {
    label: LISTING_CHANGE_LABEL,
    net: endTotal - startTotal,
    from,
    to,
    days: days.length,
    startTotal,
    endTotal,
    readEligible: days.length >= LISTING_CHANGE_MIN_DAYS_FOR_READS,
    readGate: `Kept out of reads until ${LISTING_CHANGE_MIN_DAYS_FOR_READS} days of eBay Browse totals exist.`,
    source: LISTING_CHANGE_SOURCE,
  };
}

/** Feed read. Exact sentence. Ships only after 7 nights of Browse totals. */
export function listingChangeRead(product) {
  const est = listingChangeEstimate(product);
  if (!est?.readEligible || !product?.id) return null;
  const name = String(product.name || "").trim();
  if (!name) return null;
  const net = est.net > 0 ? `+${est.net}` : est.net < 0 ? String(est.net) : "+0";
  const sentence = `Net change in active eBay listings (estimate): ${net} over ${est.days} nights.`;
  if (/\bsold\b|sell-through|sell through/i.test(sentence)) return null;
  return {
    id: `listing-${product.id}`,
    sku: String(product.id),
    readKind: "listing",
    kind: "listing",
    name,
    set: product.set || "",
    path: sentence,
    headline: sentence,
    why: `${LISTING_CHANGE_SOURCE}. Browse totals only.`,
    asOf: est.to,
    href: `/dive/${encodeURIComponent(product.id)}`,
    lane: "sealed",
    receipt: {
      net: est.net,
      days: est.days,
      from: est.from,
      to: est.to,
      startTotal: est.startTotal,
      endTotal: est.endTotal,
    },
  };
}

export const OUTLIER_HOOK =
  "Optional file data/derived/sealed-price-outliers.json (HIGH/SOFT rows from flag-sealed-price-outliers). Absent → leave outlier null.";

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

/**
 * Index sealed-price-outliers.json (high[]/soft[]) or a legacy id→row map.
 * Does not invent rows — only indexes what the file already has.
 */
export function indexOutlierMap(doc) {
  if (!doc || typeof doc !== "object") return null;
  const map = Object.create(null);
  let n = 0;
  const take = (row) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id) return;
    map[row.id] = row;
    n += 1;
  };
  if (Array.isArray(doc.high) || Array.isArray(doc.soft)) {
    for (const row of doc.high || []) take(row);
    for (const row of doc.soft || []) take(row);
    return n ? map : null;
  }
  if (doc.products && typeof doc.products === "object" && !Array.isArray(doc.products)) {
    for (const [id, row] of Object.entries(doc.products)) {
      if (row && typeof row === "object") take({ ...row, id: row.id || id });
    }
    return n ? map : null;
  }
  // Legacy / test shape: plain id → {flag, note, asOf}
  for (const [id, row] of Object.entries(doc)) {
    if (!row || typeof row !== "object") continue;
    if (["generatedAt", "asOf", "source", "rule", "skippedPacks", "skippedNoFlag", "highCount", "softCount", "high", "soft", "products"].includes(id)) continue;
    take({ ...row, id: row.id || id });
  }
  return n ? map : null;
}

/** Human flag from real pctGap/direction only — no invented percentages. */
export function outlierFlagNote(row) {
  if (!row || typeof row !== "object") return null;
  if (typeof row.pctGap === "number" && Number.isFinite(row.pctGap)) {
    // Use the file's own pctGap (already one decimal in sealed-price-outliers).
    const abs = Math.abs(row.pctGap);
    const pct = Number.isInteger(abs) ? String(abs) : abs.toFixed(1).replace(/\.0$/, "");
    const dir =
      row.direction === "low" || row.pctGap < 0
        ? "below"
        : row.direction === "high" || row.pctGap > 0
          ? "above"
          : "off";
    return `Price flagged: ${pct}% ${dir} recent median — review`;
  }
  return row.note ?? row.why ?? row.provisionalLabel ?? null;
}

function pickOutlier(map, id) {
  if (!map || typeof map !== "object") return null;
  const row = map[id] ?? map.products?.[id] ?? null;
  if (!row || typeof row !== "object") return null;
  const out = {
    flag: row.severity ?? row.flag ?? row.kind ?? true,
    note: outlierFlagNote(row),
    asOf: row.asOf ?? row.todayDate ?? null,
    source: OUTLIER_SOURCE,
  };
  if (typeof row.pctGap === "number" && Number.isFinite(row.pctGap)) out.pctGap = row.pctGap;
  if (row.direction) out.direction = row.direction;
  if (row.severity) out.severity = row.severity;
  if (row.provisionalLabel) out.provisionalLabel = row.provisionalLabel;
  return out;
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
  const listingChange = listingChangeEstimate(latestProduct);

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
      outlier: outlier ? OUTLIER_SOURCE : OUTLIER_HOOK,
      listingChange: LISTING_CHANGE_SOURCE,
    },
    series,
    latest,
    buyout,
    volume: null,
    volumeNote: VOLUME_NOTE,
    listingChange,
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
  sealedProducts = null,
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
  // The reviewed TCGplayer productId on the sealed product wins (id, not name).
  for (const row of Array.isArray(sealedProducts) ? sealedProducts : []) {
    const pid = String(row?.tcgPlayerId ?? "");
    if (row?.id && /^\d+$/.test(pid)) tcgBySealed[row.id] = `tcgcsv-${pid}`;
  }

  // A combined all-arts row (split per art, Tyler 2026-10-10) holds one eBay
  // search across every art. It is never tied to one art's productId.
  const combined = new Map();
  for (const row of Array.isArray(sealedProducts) ? sealedProducts : []) {
    if (row?.id && row.combinedArts) { combined.set(row.id, row); delete tcgBySealed[row.id]; }
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
    const parent = combined.get(id);
    const payload = buildDivePayload({
        id,
        name: parent && product?.name ? `${product.name} (all arts combined)` : product?.name,
        seriesRows: rows,
        latestProduct: product,
        buyoutRow: buyoutBy.get(id) || null,
        outlierMap,
        asOf,
        tcgcsvId: tcgBySealed[id] || null,
      });
    if (parent) {
      payload.combinedArts = true;
      payload.arts = [...(parent.arts || [])];
      payload.artsNote = "eBay asks and listing counts here are one search across every art. They are not any one art's numbers. Listings are not sales.";
    }
    dives.push(payload);
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
