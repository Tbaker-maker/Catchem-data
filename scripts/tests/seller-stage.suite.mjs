// Seller tag and run stage. Test numbers here are made up; the real cutoffs are private.
import { runStage, sellerTag } from "../lib/seller-stage.mjs";
import { readSignals, signalsLookSecret } from "../lib/signal-chips.mjs";

const TAG = { minNights: 5, baseNights: 10, minListings: 6, minSpread: 0.1, zOwn: 2, cohortHigh: 0.9, cohortLow: 0.1, sellerRise: 1.2, holdNights: 2, minPeers: 4 };
const STAGE = { halfDays: 5, minPointsPerHalf: 4, flatPctPerDay: 0.5, keepPace: 0.5, agree: 0.6, minPrice: 2, minListingNights: 8, listFlatPct: 4 };

function day(i) { return new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10); }
function nights(shares, sellers, n = 20) {
  return shares.map((share, i) => ({ date: day(i), n, sellers: Array.isArray(sellers) ? sellers[i] : sellers, share }));
}
function prices(fn, days = 10) { return Array.from({ length: days }, (_, i) => [day(i), fn(i)]); }

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const peers = [0.2, 0.22, 0.25, 0.28, 0.3, 0.31];
  const usual = [0.3, 0.31, 0.29, 0.3, 0.32, 0.3];

  const few = sellerTag(nights([...usual, 0.7, 0.72], [10, 10, 11, 10, 10, 10, 7, 7]), peers, TAG);
  t("few sellers hold most fires on a held jump above own usual and peers", few?.word === "Few sellers hold most" && few.share === 72 && few.usual === 30 && few.peers === 27);
  t("one night is not enough", sellerTag(nights([...usual, 0.3, 0.72], [10, 10, 11, 10, 10, 10, 10, 7]), peers, TAG) === null);
  const spread = sellerTag(nights([...usual, 0.08, 0.07], [10, 10, 11, 10, 10, 10, 15, 16]), peers, TAG);
  t("spread out fires when the share falls and sellers rise", spread?.word === "Spread out");
  t("a normal night shows nothing", sellerTag(nights([...usual, 0.31, 0.3], 10), peers, TAG) === null);
  t("thin: too few nights shows nothing", sellerTag(nights([0.3, 0.3, 0.7, 0.72], [10, 10, 7, 7]), peers, TAG) === null);
  t("thin: too few listings counted shows nothing", sellerTag(nights([...usual, 0.7, 0.72], [10, 10, 11, 10, 10, 10, 7, 7], 3), peers, TAG) === null);
  t("thin: too few similar products shows nothing", sellerTag(nights([...usual, 0.7, 0.72], [10, 10, 11, 10, 10, 10, 7, 7]), [0.2, 0.3], TAG) === null);
  t("high for this product but normal for peers shows nothing", sellerTag(nights([...usual, 0.7, 0.72], [10, 10, 11, 10, 10, 10, 7, 7]), [0.6, 0.7, 0.8, 0.9, 0.95], TAG) === null);
  t("no rules, no tag", sellerTag(nights([...usual, 0.7, 0.72], [10, 10, 11, 10, 10, 10, 7, 7]), peers, null) === null);

  const asOf = day(9);
  t("building: flat then rising", runStage(prices((i) => (i < 5 ? 20 : 20 * 1.03 ** (i - 4))), asOf, STAGE)?.word === "Building");
  t("building keeps its pace", runStage(prices((i) => 20 * 1.03 ** i), asOf, STAGE)?.word === "Building");
  t("slowing: same way, much slower", runStage(prices((i) => (i < 5 ? 20 * 1.05 ** i : 20 * 1.05 ** 4 * 1.01 ** (i - 4))), asOf, STAGE)?.word === "Slowing");
  const stalled = runStage(prices((i) => (i < 5 ? 20 * 1.04 ** i : 20 * 1.04 ** 4)), asOf, STAGE);
  t("stalled: rising then flat, run direction kept", stalled?.word === "Stalled" && stalled.dir === "up");
  const rev = runStage(prices((i) => (i < 5 ? 20 * 1.04 ** i : 20 * 1.04 ** 4 * 0.96 ** (i - 4))), asOf, STAGE);
  t("reversing: up then down", rev?.word === "Reversing" && rev.dir === "down");
  t("quiet prices show nothing", runStage(prices(() => 20), asOf, STAGE) === null);
  t("thin: too few price days shows nothing", runStage(prices((i) => 20 * 1.03 ** i, 6), day(5), STAGE) === null);
  t("thin: cheap cards show nothing", runStage(prices((i) => 1 * 1.03 ** i), asOf, STAGE) === null);
  t("choppy steps show nothing", runStage(prices((i) => [20, 22, 20.5, 22.5, 21, 23, 21.5, 24, 22, 25][i]), asOf, STAGE) === null);
  const lots = (fn) => Array.from({ length: 10 }, (_, i) => ({ date: day(i), n: fn(i) }));
  const up = prices((i) => 20 * 1.03 ** i);
  t("sealed: building with listings falling", runStage(up, asOf, STAGE, lots((i) => 100 - i * 3))?.word === "Building");
  t("sealed: listings rising against the run makes it slowing", runStage(up, asOf, STAGE, lots((i) => 100 + i * 4))?.word === "Slowing");
  t("thin: sealed with too few listings nights shows nothing", runStage(up, asOf, STAGE, lots((i) => 100).slice(0, 5)) === null);
  t("no rules, no stage", runStage(up, asOf, null) === null);

  // Stamped into tiles without leaking cutoffs.
  const rules = { move: { flatAbs: 1, preferDays: [7], slackDays: 2, minDays: 2 }, confidence: { cuts: [4, 12] }, sellerTag: TAG, stage: STAGE };
  const single = readSignals({ id: "move-x", sku: "tcgcsv-1", name: "Card", kind: "single", asOf, price: 20 * 1.03 ** 9, changePct: 30, windowDays: 9, source: "TCGplayer market" },
    { asOf, points: up, daily: up, counts: { prices: 10, recent: 10, since: day(0) } }, rules);
  t("a single that qualifies carries the stage on its price tile", single.tiles?.price?.stage?.word === "Building");
  const series = lots((i) => 100 - i * 3);
  const box = readSignals({ id: "listcount-x", name: "Box", kind: "sealed", asOf }, {
    asOf,
    listings: { n: 73, prev: 76, date: asOf, series, prices: up, nights: nights([...usual, 0.3, 0.7, 0.72, 0.71], [10, 10, 11, 10, 10, 10, 10, 7, 7, 7]).map((r, i) => ({ ...r, date: day(i) })), peers },
  }, { ...rules, supply: { minAbsPct: 2, windowDays: 5, slackDays: 1 } });
  const lt = box.tiles?.listings || {};
  t("the listings tile carries the tag and stage", lt.tag?.word === "Few sellers hold most" && lt.stage?.word === "Building");
  t("sealed never gets a price tile stage", !box.tiles?.price?.stage);
  const blob = JSON.stringify([single.tiles, box.tiles]);
  t("tiles carry no cutoffs", !signalsLookSecret(box.tiles) && !/minNights|zOwn|cohortHigh|flatPctPerDay|keepPace|minListingNights/.test(blob));
  t("tiles carry no dashes or sold words", !/[\u2013\u2014]| - |\bsold\b|\bsales\b/i.test(blob));
  return fail;
}
