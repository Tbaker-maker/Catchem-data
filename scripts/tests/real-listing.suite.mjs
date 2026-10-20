// sv3pt5-upc: junk floor, opened, and damaged lose. A clean listing wins.
// A $12 history point is under 0.3x the robust median and is dropped.
import { selectRealListings, cleanHistory, gateSealedProduct, askBoxLines, medianFacts, EBAY_MEDIAN_LABEL, TCG_LISTED_NOTE, TCG_MARKET_NOTE, ebayMedianNote } from "../lib/real-listing.mjs";
import { scoreAskFacts, scoreItems } from "../lib/tracker.mjs";

const item = (title, price, extra = {}) => ({
  title,
  price: { value: String(price), currency: "USD" },
  condition: "New",
  conditionId: "1000",
  itemWebUrl: extra.url || "",
  buyingOptions: ["FIXED_PRICE"],
  ...extra,
});

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ✓ ${name}`); else { fail++; console.error(`  ✗ ${name}`); } };
  const junk = item("Pokemon Scarlet Violet 151 Ultra Premium Collection UPC", 100, { url: "https://www.ebay.com/itm/100" });
  const opened = item("Pokemon 151 Ultra Premium Collection UPC opened box", 820, { url: "https://www.ebay.com/itm/820" });
  const damaged = item("Pokemon 151 Ultra Premium Collection UPC damaged box", 790, { url: "https://www.ebay.com/itm/790" });
  const clean = item("Pokemon 151 Ultra Premium Collection UPC sealed", 849.99, { url: "https://www.ebay.com/itm/850" });
  const picked = selectRealListings([junk, opened, damaged, clean], { isPack: false, market: "US" });
  t("opened and damaged lose", picked.count === 1);
  t("the $100 junk loses", picked.floorPrice === 849.99 && picked.cheapest?.price === 849.99);
  t("the clean listing wins and keeps its url", picked.cheapest?.url === "https://www.ebay.com/itm/850");
  const auction = item("Pokemon 151 Ultra Premium Collection UPC sealed", 870, { url: "https://www.ebay.com/itm/870", buyingOptions: ["AUCTION"] });
  const abroad = item("Pokemon 151 Ultra Premium Collection UPC sealed", 880, { url: "https://www.ebay.com/itm/880", itemLocation: { country: "JP" } });
  const weak = item("Pokemon 151 Ultra Premium Collection UPC sealed", 860, { url: "https://www.ebay.com/itm/860", seller: { feedbackScore: 1, feedbackPercentage: 80 } });
  const trusted = item("Pokemon 151 Ultra Premium Collection UPC sealed", 849.99, { url: "https://www.ebay.com/itm/850", seller: { feedbackScore: 40, feedbackPercentage: 100 } });
  const extraPick = selectRealListings([auction, abroad, weak, trusted], { isPack: false, market: "US", sellerMin: { minFeedbackScore: 10, minPositivePercent: 99 } });
  t("auction, no delivery estimate, and a seller under the minimum lose", extraPick.count === 1 && extraPick.cheapest?.url === "https://www.ebay.com/itm/850");
  const labeled = medianFacts({ count: 1, median: 849.99 }, { askMedian: 936.99, askRobustCount: 133 });
  t("the labeled median is the real listing set", labeled.ebayMedianAsk === 849.99 && labeled.ebayMedianCount === 1);
  const gated = gateSealedProduct({
    id: "sv3pt5-upc",
    askMedian: 936.99,
    priceMedian: 934,
    priceFloorClean: 100,
    priceHistory: [
      { date: "2026-06-19", price: 12.99 },
      { date: "2026-08-18", price: 950 },
      { date: "2026-10-19", price: 934 },
    ],
  });
  t("junk floor is cleared", gated.product.priceFloorClean == null && gated.product.cheapestReal == null);
  t("no $12 history point", gated.product.priceHistory.every((point) => point.price >= 900) && gated.product.priceHistory.length === 2);
  t("gate logs both rules", gated.log.some((row) => row.rule === "cheapest-under-half") && gated.log.some((row) => row.rule === "history-under-0.3"));
  const hist = cleanHistory([{ price: 12.5 }, { price: 936.99 }], 936.99);
  t("cleanHistory drops the pack point only", hist.dropped.length === 1 && hist.kept.length === 1);
  const lines = askBoxLines({
    ebayMedianAsk: 936.99,
    ebayMedianCount: 133,
    tcgListedMedian: 1090,
    cheapestReal: { price: 849.99, url: "https://www.ebay.com/itm/850" },
  }, 786.23);
  t("box order and labels", lines[0].startsWith("Cheapest real listing") && lines[1].startsWith(EBAY_MEDIAN_LABEL) && lines[1].includes(ebayMedianNote(133)) && lines[2].includes(TCG_LISTED_NOTE) && lines[3].includes(TCG_MARKET_NOTE));
  t("a median is not called an average", !lines.join(" ").toLowerCase().includes("average") && !lines.join(" ").includes("Most listed"));
  const hidden = askBoxLines({ ebayMedianAsk: 936.99, ebayMedianCount: 133, priceFloorClean: 100 }, 786.23);
  t("no url hides the cheapest line", !hidden.some((line) => line.startsWith("Cheapest")));
  const scored = scoreItems({ listings: new Map(), prices: new Map(), asOf: "2026-10-19" });
  const ask = scoreAskFacts([{ id: "sv3pt5-upc", ebayMedianAsk: 936.99, ebayMedianCount: 133, tcgListedMedian: 1090, gapPct: -9.3 }], { proven: false });
  t("ask facts stay out of the tracker score until proven", scored.length === 0 && ask.feedScore === false && ask.rows[0].ebayMedianAsk === 936.99);
  t("proven flag is the only way into the score", scoreAskFacts(ask.rows, { proven: true }).feedScore === true);
  return fail;
}
