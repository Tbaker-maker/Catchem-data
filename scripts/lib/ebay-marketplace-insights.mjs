// Official eBay Marketplace Insights (sold / completed), not Browse asks.
// One product per call. Item prices are filtered here; a summary with no
// item prices is not given an invented outlier rule.

export const INSIGHTS_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";
export const OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
export const SEARCH_URL = "https://api.ebay.com/buy/marketplace_insights/v1_beta/item_sales/search";
export const SOURCE = "ebay marketplace insights";
export const SALES_WINDOW = "last 90 days";
export const OUTLIER_RULE = "A completed sale whose price is 50% or more below another copy of the same product is excluded from the sold count and the median.";

export function insightsTokenBody() {
  return "grant_type=client_credentials&scope=" + encodeURIComponent(INSIGHTS_SCOPE);
}

export function insightsSearchUrl({ query, categoryId = "2536", limit = 50 }) {
  const params = new URLSearchParams({
    q: query,
    category_ids: String(categoryId),
    limit: String(Math.min(50, Math.max(1, limit))),
    offset: "0",
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

function toCents(n) {
  return Math.round(Number(n) * 100);
}

// price is 50% or more below other when price <= half of other.
export function atLeastHalfBelow(price, other) {
  if (!Number.isFinite(price) || !Number.isFinite(other) || other <= 0 || price <= 0) return false;
  return toCents(price) * 2 <= toCents(other);
}

export function lowOutlierMask(prices) {
  return prices.map((price, i) => {
    if (!Number.isFinite(price)) return false;
    return prices.some((other, j) => j !== i && atLeastHalfBelow(price, other));
  });
}

export function median(values) {
  const xs = values.filter(n => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  if (xs.length % 2) return xs[mid];
  return (xs[mid - 1] + xs[mid]) / 2;
}

export function usdPrice(amount) {
  if (!amount || typeof amount !== "object") return null;
  const currency = amount.currency || null;
  if (currency && currency !== "USD") return null;
  const n = Number(amount.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function projectItem(it) {
  const usd = usdPrice(it?.lastSoldPrice);
  const qty = it?.totalSoldQuantity;
  return {
    itemId: it?.itemId ?? null,
    title: it?.title ?? null,
    lastSoldDate: it?.lastSoldDate ?? null,
    lastSoldPrice: it?.lastSoldPrice
      ? { value: it.lastSoldPrice.value ?? null, currency: it.lastSoldPrice.currency ?? null }
      : null,
    totalSoldQuantity: Number.isFinite(qty) ? qty : null,
    usd,
  };
}

function publicItem(row) {
  return {
    itemId: row.itemId,
    title: row.title,
    lastSoldDate: row.lastSoldDate,
    lastSoldPrice: row.lastSoldPrice,
    totalSoldQuantity: row.totalSoldQuantity,
  };
}

function quantitySum(rows) {
  if (!rows.length) return 0;
  if (!rows.every(r => Number.isFinite(r.totalSoldQuantity))) return null;
  return rows.reduce((sum, r) => sum + r.totalSoldQuantity, 0);
}

export function summarizeInsightsResponse(body, meta) {
  const items = Array.isArray(body?.itemSales) ? body.itemSales : null;
  const base = {
    source: SOURCE,
    pulledAt: meta.pulledAt,
    window: SALES_WINDOW,
    marketplace: "EBAY_US",
    productId: meta.productId,
    query: meta.query,
    categoryId: meta.categoryId || "2536",
    httpStatus: 200,
    calls: 1,
    apiTotal: typeof body?.total === "number" ? body.total : null,
    limit: body?.limit ?? meta.limit ?? null,
    offset: typeof body?.offset === "number" ? body.offset : 0,
    outlierRule: OUTLIER_RULE,
  };

  if (!items || items.length === 0) {
    return {
      ...base,
      outlierFilter: "unchecked",
      outlierNote: "summary cannot be checked",
      soldCount: null,
      medianLastSoldPriceUsd: null,
      itemGroupsReturned: 0,
      itemGroupsDropped: 0,
      itemGroupsUnchecked: 0,
      itemGroupsKept: 0,
      droppedSoldQuantity: null,
      soldCountComplete: false,
      itemsKept: [],
      itemsDropped: [],
    };
  }

  const rows = items.map(projectItem);
  const mask = lowOutlierMask(rows.map(r => r.usd));
  const kept = [];
  const dropped = [];
  const unchecked = [];
  rows.forEach((row, i) => {
    if (!Number.isFinite(row.usd)) unchecked.push(row);
    else if (mask[i]) dropped.push(row);
    else kept.push(row);
  });
  const anyPrice = rows.some(r => Number.isFinite(r.usd));
  const pageCovers = typeof body?.total === "number" ? rows.length >= body.total : null;
  return {
    ...base,
    outlierFilter: anyPrice ? "applied" : "unchecked",
    outlierNote: anyPrice ? null : "summary cannot be checked",
    itemGroupsReturned: rows.length,
    itemGroupsDropped: dropped.length,
    itemGroupsUnchecked: unchecked.length,
    itemGroupsKept: kept.length,
    droppedSoldQuantity: quantitySum(dropped),
    soldCount: anyPrice ? quantitySum(kept) : null,
    soldCountBasis: anyPrice
      ? "sum of totalSoldQuantity on item groups kept after the outlier rule; dropped comps are not included"
      : "summary cannot be checked",
    soldCountComplete: Boolean(anyPrice && pageCovers === true),
    medianLastSoldPriceUsd: anyPrice ? median(kept.map(r => r.usd)) : null,
    medianNote: "median of kept lastSoldPrice values in USD; outliers are excluded and are not averaged in",
    itemsKept: kept.map(publicItem),
    itemsDropped: dropped.map(publicItem),
  };
}

export function classifyInsightsError(status, body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const first = errors[0] || {};
  const oauth = typeof body?.error === "string" ? body.error : "";
  const message = String(first.message || body?.error_description || "");
  const blob = `${oauth} ${message} ${first.longMessage || ""}`.toLowerCase();
  const errorId = Number.isFinite(first.errorId) ? first.errorId : null;
  const notAuthorized = status === 401 || status === 403
    || errorId === 1100
    || ["invalid_scope", "insufficient_scope", "unauthorized_client", "access_denied"].includes(oauth)
    || /insufficient permissions|not authorized|access denied|invalid_scope/.test(blob);
  const quota = status === 429 || /too many requests|rate limit|quota exceeded/.test(blob);
  let kind = "other";
  if (notAuthorized) kind = "not-authorized";
  else if (quota) kind = "quota";
  return {
    status,
    errorId,
    oauthError: oauth || null,
    message: message.slice(0, 300),
    kind,
    stop: true,
  };
}

export function redactSecrets(text, secrets) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    if (secret && String(secret).length >= 4) out = out.split(String(secret)).join("[redacted]");
  }
  return out;
}
