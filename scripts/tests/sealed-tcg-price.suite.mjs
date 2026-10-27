import { tcgPricedRow, tcgPointFor, SEALED_PRICE_SOURCE } from "../lib/sealed-tcg-price.mjs";
import { spreadRead, gapRead, marketMoveRead } from "../lib/night-reads.mjs";
import { receiptSource } from "../lib/public-receipts.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const market = new Map([[242436, new Map([
    ["2026-10-25", { date: "2026-10-25", market: 2200, low: 2050 }],
    ["2026-10-27", { date: "2026-10-27", market: 2178.94, low: 2050 }],
  ])]]);
  const ebayRow = {
    id: "evolving-skies-box", name: "Evolving Skies Booster Box", tcgPlayerId: "242436", dataStatus: "live", lastSeen: "2026-10-27",
    priceUsd: 2499.99, priceMedian: 2499.99, priceLow: 1999, priceHigh: 3200, priceFloorClean: 1999, priceItemMedian: 2450,
    askMedian: 2499.99, askP10: 2100, askP90: 2900, ebayMedianAsk: 2499.99, cheapestReal: { price: 1999 }, gapPct: 14.7,
    listingCount: 41, representativeImage: "https://i.ebayimg.com/x/s-l1600.jpg",
    priceHistory: [
      { date: "2026-10-24", price: 2400, ebayMedianAsk: 2400, total: 120, filteredTotal: 40 },
      { date: "2026-10-25", price: 2450, ebayMedianAsk: 2450, total: 118 },
      { date: "2026-10-27", price: 2499.99, ebayMedianAsk: 2499.99, total: 117, sellers: 12 },
    ],
  };
  const row = tcgPricedRow(ebayRow, market, "2026-10-27");
  t("price is TCGplayer market", row.priceUsd === 2178.94 && row.priceMedian === 2178.94 && row.priceSource === SEALED_PRICE_SOURCE && row.priceDate === "2026-10-27");
  t("no eBay ask survives as a price", row.priceHigh === null && row.priceFloorClean === null && !("askMedian" in row) && !("ebayMedianAsk" in row) && !("cheapestReal" in row) && !("gapPct" in row));
  t("eBay photo is not a product image", !("representativeImage" in row));
  t("listings counted stay", row.listingCount === 41 && row.priceHistory[0].total === 120 && row.priceHistory[0].filteredTotal === 40 && row.priceHistory[2].sellers === 12);
  t("history price is TCGplayer on that date, else none", !("price" in row.priceHistory[0]) && row.priceHistory[1].price === 2200 && row.priceHistory[2].price === 2178.94 && row.priceHistory.every((p) => !("ebayMedianAsk" in p)));
  const stale = tcgPricedRow(ebayRow, market, "2026-11-05");
  t("a TCGplayer point over 3 days old is not today's price", stale.priceUsd === null && tcgPointFor(market.get(242436), "2026-10-29")?.market === 2178.94);
  const noPid = tcgPricedRow({ ...ebayRow, tcgPlayerId: null }, market, "2026-10-27");
  t("no TCGplayer id means no price, not an eBay ask", noPid.priceUsd === null && noPid.priceMedian === null && noPid.listingCount === 41);
  t("ask range read is off", spreadRead({ ...ebayRow, priceLow: 2000, priceHigh: 3000, priceMedian: 2500, listingCount: 40 }) === null);
  t("ask vs market read is off", gapRead("evolving-skies-box", [], {}, {}) === null);
  const mktDoc = { id: "evolving-skies-box", name: "Evolving Skies Booster Box", tcgplayerProductId: 242436, points: [
    { date: "2026-10-25", market: 2200 }, { date: "2026-10-27", market: 2178.94 },
  ]};
  const mktMap = { id: "evolving-skies-box", tcgplayerProductId: 242436 };
  const moved = marketMoveRead("evolving-skies-box", mktDoc, mktMap);
  t("TCGplayer-only market move ships without an ask", moved && moved.readKind === "mktmove" && moved.receipt.marketFrom === 2200 && moved.receipt.marketTo === 2178.94 && !("ask" in moved.receipt) && /TCGplayer market/.test(moved.path) && !/eBay ask/.test(moved.path));
  t("flat market is not a move", marketMoveRead("evolving-skies-box", { ...mktDoc, points: [{ date: "2026-10-25", market: 2200 }, { date: "2026-10-27", market: 2200 }] }, mktMap) === null);
  t("sealed receipts say TCGplayer market", receiptSource({ kind: "sealed" }) === "TCGplayer market");
  return fail;
}
