import {
  addMissingRows,
  coverageReport,
  filteredPoints,
  listingIds,
  nightsFromRows,
  sealedStepIndex,
  sealedStepRowsForDay,
  verifiedProductId,
} from "../lib/sealed-listing-coverage.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const parent = {
    id: "sv5-etb",
    name: "Temporal Forces Elite Trainer Box",
    dataStatus: "live",
    listingCount: 40,
    priceHistory: [
      { date: "2026-11-01", price: 100, total: 900 },
      { date: "2026-11-02", price: 110, total: 880 },
    ],
  };
  t("a shared-art parent with no verified id is not given one", verifiedProductId(parent) === null);
  t("no id means no sealed-step row", sealedStepRowsForDay([parent], "2026-11-02").length === 0);
  t("browse total and the page snapshot are not listings counted", filteredPoints(parent).length === 0);

  const box = {
    id: "sv3-bb",
    name: "Obsidian Flames Booster Box",
    dataStatus: "live",
    tcgPlayerId: "123",
    listingCount: 12,
    priceHistory: [
      { date: "2026-11-10", price: 100, total: 400, filteredTotal: 80 },
      { date: "2026-11-11", price: 103, total: 390, listingCount: 12, filteredTotal: 76 },
    ],
  };
  t("ids are the slug and the catalog id", JSON.stringify(listingIds(box)) === '["sv3-bb","tcgcsv-123"]');
  const rows = sealedStepRowsForDay([box], "2026-11-11");
  t("the copied row uses filteredTotal under the catalog id", rows.length === 1 && rows[0].id === "tcgcsv-123" && rows[0].listingsCounted === 76 && rows[0].slug === "sv3-bb" && rows[0].source === "sealed-price-step");
  t("a copied row is not an eBay call", !("calls" in rows[0]) && rows[0].tier === "sealed-step");

  const kept = addMissingRows(
    [{ id: "tcgcsv-123", date: "2026-11-11", listingsCounted: 50, source: "listing-counts" }],
    rows,
  );
  t("an existing listing-count row is not replaced", kept.length === 1 && kept[0].listingsCounted === 50 && kept[0].source === "listing-counts");
  t("a missing id is added", addMissingRows([], rows).length === 1);

  const nights = nightsFromRows([
    { id: "tcgcsv-999", date: "2026-11-01", listingsCounted: 4 },
    { id: "tcgcsv-999", date: "2026-11-02", listingsCounted: 5 },
  ]);
  const report = coverageReport([
    box,
    { id: "only-nightly", dataStatus: "live", tcgPlayerId: "999", priceHistory: [{ date: "2026-11-01", price: 10 }, { date: "2026-11-02", price: 12 }] },
    parent,
  ], nights);
  t("coverage before is the nightly series only", report.movers === 3 && report.before === 1 && report.live === 3);
  t("coverage after adds the verified filteredTotal series and still skips the product with no id", report.after === 2);

  const index = sealedStepIndex([box, parent]);
  t("the index keeps the series and leaves the parent out", index.series["tcgcsv-123"].points.length === 2 && !index.series["sv5-etb"] && index.note.includes("No extra eBay call"));
  t("the index does not use the word supply", !/\bsupply\b/i.test(index.note));
  return fail;
}
