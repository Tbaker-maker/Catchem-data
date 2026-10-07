import { pathToFileURL } from "node:url";
import {
  HIGH_GAP,
  SOFT_GAP,
  evaluateProduct,
  flagSealedPriceOutliers,
  isPack,
  median,
  provisionalLabel,
  referenceWindow,
  seriesFor,
  severityFor,
} from "../flag-sealed-price-outliers.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  t("median of odds picks the middle", median([1, 9, 3]) === 3);
  t("packs are skipped by subtype and id", isPack({ subtype: "booster-pack", id: "x" }) && isPack({ id: "swsh5-pack" }) && !isPack({ subtype: "etb", id: "cel25-etb" }));
  t("severity cutoffs", severityFor(0.5) === "high" && severityFor(-0.5) === "high" && severityFor(0.4) === "soft" && severityFor(0.39) === null);
  t("high gap constant is conservative 50%", HIGH_GAP === 0.5 && SOFT_GAP === 0.4);

  const series = [
    { date: "2026-09-01", price: 100, listingCount: 50 },
    { date: "2026-09-02", price: 100, listingCount: 50 },
    { date: "2026-09-03", price: 100, listingCount: 50 },
    { date: "2026-09-04", price: 100, listingCount: 50 },
    { date: "2026-09-05", price: 160, listingCount: 50 },
  ];
  const win = referenceWindow(series, "2026-09-05");
  t("reference uses prior median not today", win && win.referencePrice === 100 && win.todayPrice === 160 && Math.abs(win.gap - 0.6) < 1e-9);
  t("too few priors → no flag", referenceWindow(series.slice(0, 3), "2026-09-03") == null);

  const heat = [
    { date: "2026-09-01", id: "demo-etb", price: 200, listingCount: 40 },
    { date: "2026-09-02", id: "demo-etb", price: 200, listingCount: 40 },
    { date: "2026-09-03", id: "demo-etb", price: 210, listingCount: 38 },
    { date: "2026-09-04", id: "demo-etb", price: 400, listingCount: 10 },
    { date: "2026-09-01", id: "swsh5-pack", price: 10, listingCount: 5 },
    { date: "2026-09-02", id: "swsh5-pack", price: 10, listingCount: 5 },
    { date: "2026-09-03", id: "swsh5-pack", price: 10, listingCount: 5 },
    { date: "2026-09-04", id: "swsh5-pack", price: 50, listingCount: 5 },
    { date: "2026-09-01", id: "flat-etb", price: 50, listingCount: 20 },
    { date: "2026-09-02", id: "flat-etb", price: 51, listingCount: 20 },
    { date: "2026-09-03", id: "flat-etb", price: 52, listingCount: 21 },
    { date: "2026-09-04", id: "flat-etb", price: 53, listingCount: 21 },
  ];
  const sealed = {
    updatedAt: "2026-09-04T12:00:00.000Z",
    products: [
      {
        id: "demo-etb", name: "Demo ETB", subtype: "etb",
        priceHistory: [
          { date: "2026-09-03", price: 210, total: 100 },
          { date: "2026-09-04", price: 400, total: 40 },
        ],
      },
      { id: "swsh5-pack", name: "Pack", subtype: "booster-pack", priceHistory: [] },
      { id: "flat-etb", name: "Flat ETB", subtype: "etb", priceHistory: [] },
    ],
  };
  const report = flagSealedPriceOutliers({ heatHistory: heat, sealedPrices: sealed, buyoutTape: { rows: [] }, asOf: "2026-09-04" });
  t("flags the extreme etb as high", report.highCount === 1 && report.high[0].id === "demo-etb");
  t("skips packs", report.skippedPacks >= 1 && !report.high.some((r) => r.id === "swsh5-pack"));
  t("flat product is not flagged", !report.high.some((r) => r.id === "flat-etb") && !report.soft.some((r) => r.id === "flat-etb"));
  t("demo gap is about +95%", report.high[0].pctGap >= 90);
  t("listing crash + spike → possible real move", report.high[0].provisionalLabel.includes("possible real move"));

  const badOnly = provisionalLabel({
    gap: 0.9,
    browse: { today: 50, prior: 50 },
    heatListings: { today: 9, prior: 9 },
  });
  t("flat listings + spike → possible bad listing", badOnly.label === "review — possible bad listing" && !badOnly.conflict);

  const conflict = provisionalLabel({
    gap: 0.9,
    browse: { today: 50, prior: 50 },
    heatListings: { today: 6, prior: 10 },
  });
  t("browse flat + filtered crash → both labels", conflict.conflict && conflict.label.includes("bad listing") && conflict.label.includes("real move"));

  const missing = evaluateProduct({
    id: "thin",
    name: "Thin",
    subtype: "etb",
    heatRows: [
      { date: "2026-09-01", id: "thin", price: 10, listingCount: 1 },
      { date: "2026-09-02", id: "thin", price: 30, listingCount: 1 },
    ],
    product: { id: "thin", subtype: "etb" },
    asOf: "2026-09-02",
  });
  t("missing history does not invent a flag", missing == null);

  t("seriesFor keeps only that id", seriesFor("demo-etb", heat).length === 4 && seriesFor("missing", heat).length === 0);

  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await run();
  process.exit(n ? 1 : 0);
}
