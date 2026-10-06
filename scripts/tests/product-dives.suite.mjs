// Product deep-dive payloads: real series only, never invent solds or Browse totals.
import { buildDivePayload, buildAllDives, VOLUME_NOTE, indexOutlierMap, outlierFlagNote, OUTLIER_SOURCE } from "../lib/product-dives.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ✓ ${name}`);
    else { fail++; console.error(`  ✗ ${name}`); }
  };

  const seriesRows = [
    { date: "2026-08-10", id: "sv3pt5-etb", price: 100, listingCount: 50 }, // pre-cut, drop
    { date: "2026-08-20", id: "sv3pt5-etb", price: 90, listingCount: 40 },
    { date: "2026-08-21", id: "sv3pt5-etb", price: 88, listingCount: 38 },
    { date: "2026-08-21", id: "other", price: 10, listingCount: 1 },
  ];
  const latest = {
    id: "sv3pt5-etb",
    name: "151 Elite Trainer Box",
    set: "151",
    setId: "sv3pt5",
    subtype: "etb",
    dataStatus: "live",
    priceMedian: 87.5,
    priceFloorClean: 70,
    priceHigh: 120,
    listingCount: 35,
    lastSeen: "2026-10-06T12:00:00.000Z",
  };
  const buyout = {
    id: "sv3pt5-etb",
    name: "151 Elite Trainer Box",
    browseTotalNow: 2100,
    browseTotalBefore: 2200,
    level: "unscored",
    ebayCalled: true,
    latestDate: "2026-10-06",
    listedNow: 35, // must NOT become volume or browse fill
  };

  const dive = buildDivePayload({
    id: "sv3pt5-etb",
    name: latest.name,
    seriesRows,
    latestProduct: latest,
    buyoutRow: buyout,
    asOf: "2026-10-06",
    tcgcsvId: "tcgcsv-503313",
  });

  t("drops pre-cut heat rows", dive.series.length === 2 && dive.series[0].date === "2026-08-20");
  t("series carries listingCount labeled as asks", dive.series[0].listingCount === 40 && dive.series[0].source === "ebay-browse-ask");
  t("volume is null with Insights note", dive.volume === null && dive.volumeNote === VOLUME_NOTE);
  t("buyout keeps Browse totals only", dive.buyout.browseTotalNow === 2100 && dive.buyout.listedNow == null);
  t("latest is source-labeled eBay", dive.latest.source === "ebay-browse-api" && dive.latest.priceMedian === 87.5);
  t("outlier absent leaves hook", dive.outlier === null && typeof dive.outlierHook === "string");
  t("href is /dive/<id>", dive.href === "/dive/sv3pt5-etb");

  const withFlag = buildDivePayload({
    id: "sv3pt5-etb",
    seriesRows: [{ date: "2026-08-20", id: "sv3pt5-etb", price: 90, listingCount: 40 }],
    outlierMap: { "sv3pt5-etb": { flag: "spike", note: "median jumped vs own history", asOf: "2026-10-06" } },
  });
  t("outlier file wires when present", withFlag.outlier?.flag === "spike" && withFlag.outlierHook === null);
  t("outlier source path is derived file", withFlag.outlier?.source === OUTLIER_SOURCE);

  const sealedDoc = {
    asOf: "2026-10-06",
    high: [{
      id: "sv5-pc-etb",
      severity: "high",
      direction: "high",
      todayDate: "2026-10-06",
      pctGap: 95.5,
      provisionalLabel: "review — possible bad listing; review — possible real move",
    }],
    soft: [],
  };
  const indexed = indexOutlierMap(sealedDoc);
  t("indexes high[] by id", indexed?.["sv5-pc-etb"]?.pctGap === 95.5);
  t("flag note from pctGap", outlierFlagNote(sealedDoc.high[0]) === "Price flagged: 95.5% above recent median — review");
  const highDive = buildDivePayload({
    id: "sv5-pc-etb",
    seriesRows: [{ date: "2026-08-20", id: "sv5-pc-etb", price: 200, listingCount: 10 }],
    outlierMap: indexed,
  });
  t("HIGH sealed outlier lands on dive", highDive.outlier?.note === "Price flagged: 95.5% above recent median — review" && highDive.outlier?.pctGap === 95.5 && highDive.outlierHook === null);
  t("below uses direction/sign", outlierFlagNote({ pctGap: -50.9, direction: "low" }) === "Price flagged: 50.9% below recent median — review");

  const bundle = buildAllDives({
    heatHistory: seriesRows,
    sealedPrices: { updatedAt: "2026-10-06T14:00:00.000Z", products: [latest] },
    buyoutTape: { rows: [buyout] },
    redirects: { products: { "sv3pt5-etb": "/p/tcgcsv-503313" } },
  });
  t("index maps tcgcsv back to sealed id", bundle.byTcgcsv["tcgcsv-503313"] === "sv3pt5-etb");
  t("bundle ships the product dive", bundle.dives.some((d) => d.id === "sv3pt5-etb" && d.series.length === 2));

  // Never treat listingCount as a sold count in the payload shape
  t("volume field is null", dive.volume === null);
  t("payload has no soldCount field", !Object.prototype.hasOwnProperty.call(dive, "soldCount") && !("soldCount" in (dive.latest || {})));

  return fail;
}
