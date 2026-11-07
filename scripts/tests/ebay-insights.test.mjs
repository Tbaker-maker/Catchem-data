import {
  INSIGHTS_SCOPE,
  SEARCH_URL,
  atLeastHalfBelow,
  classifyInsightsError,
  insightsSearchUrl,
  insightsTokenBody,
  lowOutlierMask,
  summarizeInsightsResponse,
} from "../lib/ebay-marketplace-insights.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export async function runEbayInsightsTests() {
  fail = 0;
  const url = insightsSearchUrl({ query: "Pokemon 151 Elite Trainer Box", categoryId: "2536", limit: 50 });
  t("sold search is marketplace insights", url.startsWith(SEARCH_URL) && url.includes("marketplace_insights"));
  t("sold search is not a browse ask", !url.includes("item_summary") && !url.includes("/buy/browse/"));
  t("token body asks for the insights scope", insightsTokenBody().includes(encodeURIComponent(INSIGHTS_SCOPE)));
  t("scope is not the bare browse scope alone", INSIGHTS_SCOPE.endsWith("/buy.marketplace.insights"));

  t("exactly half is below", atLeastHalfBelow(50, 100) === true);
  t("just over half is kept", atLeastHalfBelow(50.01, 100) === false);
  t("a close comp is kept", atLeastHalfBelow(90, 100) === false);

  const mask = lowOutlierMask([100, 90, 40, 50]);
  t("only the deep discounts are masked", JSON.stringify(mask) === JSON.stringify([false, false, true, true]));
  t("a single copy cannot be an outlier", JSON.stringify(lowOutlierMask([12])) === JSON.stringify([false]));

  const priced = summarizeInsightsResponse({
    total: 4,
    limit: 50,
    offset: 0,
    itemSales: [
      { itemId: "a", title: "151 ETB", lastSoldPrice: { value: "100.00", currency: "USD" }, totalSoldQuantity: 2, lastSoldDate: "2026-09-01T00:00:00Z" },
      { itemId: "b", title: "151 ETB", lastSoldPrice: { value: "90.00", currency: "USD" }, totalSoldQuantity: 1, lastSoldDate: "2026-09-02T00:00:00Z" },
      { itemId: "c", title: "151 ETB damaged lot", lastSoldPrice: { value: "40.00", currency: "USD" }, totalSoldQuantity: 5, lastSoldDate: "2026-09-03T00:00:00Z" },
      { itemId: "d", title: "151 ETB", lastSoldPrice: { value: "50.00", currency: "USD" }, totalSoldQuantity: 1, seller: { username: "should-not-leak" } },
    ],
  }, { productId: "sv3pt5-etb", query: "Pokemon 151 Elite Trainer Box", pulledAt: "2026-10-02T19:00:00.000Z", limit: 50 });
  t("source is marketplace insights", priced.source === "ebay marketplace insights");
  t("window is the insights window", priced.window === "last 90 days");
  t("two item groups dropped", priced.itemGroupsDropped === 2);
  t("dropped units stay out of the sold count", priced.soldCount === 3 && priced.droppedSoldQuantity === 6);
  t("median ignores the cheap comps", priced.medianLastSoldPriceUsd === 95);
  t("seller identity is not stored", !JSON.stringify(priced).includes("should-not-leak"));
  t("filter applied when prices exist", priced.outlierFilter === "applied" && priced.productId === "sv3pt5-etb");

  const summaryOnly = summarizeInsightsResponse({ total: 12 }, {
    productId: "sv3pt5-etb", query: "q", pulledAt: "2026-10-02T19:00:00.000Z",
  });
  t("a summary with no item prices is unchecked", summaryOnly.outlierFilter === "unchecked" && summaryOnly.outlierNote === "summary cannot be checked");
  t("unchecked summary does not invent a sold count", summaryOnly.soldCount === null && summaryOnly.medianLastSoldPriceUsd === null && summaryOnly.itemGroupsDropped === 0);

  const noPrices = summarizeInsightsResponse({
    total: 2,
    itemSales: [{ itemId: "x", title: "151 ETB", totalSoldQuantity: 4 }, { itemId: "y", title: "151 ETB", totalSoldQuantity: 1 }],
  }, { productId: "sv3pt5-etb", query: "q", pulledAt: "2026-10-02T19:00:00.000Z" });
  t("item rows without prices are not filtered", noPrices.outlierFilter === "unchecked" && noPrices.soldCount === null && noPrices.itemGroupsDropped === 0);

  const denied = classifyInsightsError(403, { errors: [{ errorId: 1100, message: "Access denied", longMessage: "Insufficient permissions to fulfill the request." }] });
  t("403 error 1100 stops as not-authorized", denied.stop === true && denied.kind === "not-authorized" && denied.errorId === 1100 && denied.status === 403);
  const scope = classifyInsightsError(400, { error: "invalid_scope", error_description: "The requested scope is invalid, unknown, malformed, or exceeds the scope granted to the client." });
  t("invalid_scope stops as not-authorized", scope.kind === "not-authorized" && scope.stop === true && scope.status === 400);
  const quota = classifyInsightsError(429, { errors: [{ errorId: 2001, message: "Too many requests." }] });
  t("429 stops as quota", quota.kind === "quota" && quota.stop === true);

  return fail;
}
