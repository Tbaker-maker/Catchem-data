// Product deep-dive payloads: real series only, never invent solds or Browse totals.
import { buildDivePayload, buildAllDives, VOLUME_NOTE, indexOutlierMap, outlierFlagNote, OUTLIER_SOURCE, LISTING_CHANGE_LABEL, listingChangeEstimate, listingChangeRead } from "../lib/product-dives.mjs";
import { pickNight } from "../lib/night-reads.mjs";
import { readFile as readSrc } from "node:fs/promises";

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

  // ── listing-change estimate: Browse totals only, labelled, gated from reads ──
  const withTotals = {
    id: "x-etb", name: "X ETB", listingCount: 12,
    priceHistory: [
      { date: "2026-10-03", price: 50 },
      { date: "2026-10-04", price: 50, total: 509 },
      { date: "2026-10-05", price: 51, total: 498 },
      { date: "2026-10-06", price: 52, total: 470 },
    ],
  };
  const est = listingChangeEstimate(withTotals);
  t("estimate label is exact", LISTING_CHANGE_LABEL === "net change in active eBay listings (estimate)" && est.label === LISTING_CHANGE_LABEL);
  t("estimate is last total minus first total, with the day count", est.net === -39 && est.days === 3 && est.from === "2026-10-04" && est.to === "2026-10-06");
  t("estimate stays out of reads under 7 days", est.readEligible === false);
  const week = { priceHistory: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, total: 100 + i })) };
  t("estimate becomes read-eligible at 7 days", listingChangeEstimate(week).readEligible === true && listingChangeEstimate(week).net === 6);
  const weekRead = listingChangeRead({ id: "x-etb", name: "X ETB", priceHistory: week.priceHistory });
  t("listing read uses the exact sentence", weekRead?.path === "Net change in active eBay listings (estimate): +6 over 7 nights.");
  t("listing read never says sold or sell-through", weekRead && !/\bsold\b|sell-through|sell through/i.test(weekRead.path + weekRead.why));
  t("six nights stay out of reads", listingChangeRead({ id: "x-etb", name: "X ETB", priceHistory: week.priceHistory.slice(0, 6) }) == null);
  const cooled = pickNight([weekRead, { ...weekRead, id: "listing-y", sku: "y-etb", name: "Y" }], { shown: [] }, "2026-10-07");
  const next = pickNight([weekRead, { ...weekRead, id: "listing-y", sku: "y-etb", name: "Y" }], cooled.state, "2026-10-08");
  t("a listing read does not repeat the next night", !next.reads.some((row) => cooled.reads.some((prev) => prev.sku === row.sku)));
  t("no estimate from one total or from listingCount", listingChangeEstimate({ listingCount: 40, priceHistory: [{ date: "2026-10-06", total: 5 }] }) === null && listingChangeEstimate({ listingCount: 40 }) === null);
  t("estimate never says sold or sell-through", !/\bsold\b|sell-through|sell through/i.test(JSON.stringify(est)));
  const estDive = buildDivePayload({ id: "x-etb", seriesRows: [{ date: "2026-10-05", id: "x-etb", price: 50, listingCount: 12 }], latestProduct: withTotals });
  t("dive carries the estimate and volume stays null", estDive.listingChange?.net === -39 && estDive.volume === null);

  // ── pulse copy: a filtered count is not "all of eBay" ──
  const pulseSrc = await readSrc(new URL("../generate-pulse.mjs", import.meta.url), "utf8");
  t("pulse never calls the filtered count all of eBay", !/on all of eBay/.test(pulseSrc));
  const strategist = await readSrc(new URL("../api-strategist.mjs", import.meta.url), "utf8");
  t("api-strategist does not rate retired recentSales as worth wiring", !/recentSales:\s*\{\s*v:/.test(strategist) && /RETIRED/.test(strategist));

  return fail;
}
