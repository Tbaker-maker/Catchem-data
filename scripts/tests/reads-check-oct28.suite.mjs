// Regression for the Oct 28 reads check: flat momentum, spike baselines,
// consistent change figures, stale mixed reads, and species printing lines.
import { trailingFlat, readSignals } from "../lib/signal-chips.mjs";
import { findings, validSynth } from "../lib/read-synthesis.mjs";
import { checkRead } from "../lib/publish-gate.mjs";
import { stampRead } from "../lib/card-face-stamp.mjs";
import { stampStale } from "../lib/read-stale.mjs";
import { mixedReads, LISTINGS_FRESH_DAYS } from "../lib/rich-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  // 1) Fairy Energy: flat for 3 nights must not score Rising / 5 dots.
  const fairyPts = [];
  for (let day = 3; day <= 28; day += 1) {
    const d = `2026-10-${String(day).padStart(2, "0")}`;
    let px = 1.03;
    if (d === "2026-10-24") px = 1.19;
    else if (d === "2026-10-25") px = 1.42;
    else if (d >= "2026-10-26") px = 2.62;
    fairyPts.push([d, px]);
  }
  t("three flat nights are trailingFlat", trailingFlat(fairyPts, "2026-10-28", 3, 0) === true);
  t("a still-moving stretch is not trailingFlat", trailingFlat(fairyPts, "2026-10-25", 3, 0) === false);
  // Sparks omit quiet days. Two calendar nights at the same cent still settle.
  t("flat calendar nights hold when a spark skips a quiet day", trailingFlat([
    ["2026-10-21", 1.03], ["2026-10-23", 1.42], ["2026-10-27", 2.62], ["2026-10-28", 2.62],
  ], "2026-10-28", 2, 0));
  const rules = {
    max: 4,
    move: { flatAbs: 1.5, preferDays: [7], slackDays: 2, minDays: 2 },
    momentum: { risingMin: 3, coolingMax: -3, recentDays: 7, flatRecentDays: 2 },
    range: { minDays: 7 },
    era: {},
    strength: { fallback: { move: [4, 6, 8, 16], momentum: [4, 6, 8, 16], range: [0.4, 0.7, 0.9, 1.01], era: { Modern: 1 } } },
  };
  const fairy = readSignals(
    { id: "move-tcgcsv-97973-7", sku: "tcgcsv-97973", name: "Fairy Energy", kind: "single", asOf: "2026-10-28", price: 2.62, changePct: 154.4, windowDays: 7 },
    { asOf: "2026-10-28", points: fairyPts, daily: fairyPts, release: "2014-03-12" },
    rules,
  );
  const mom = fairy.signals.find((c) => c.kind === "momentum");
  const move = fairy.signals.find((c) => c.kind === "move");
  t("flat recent nights force Momentum Flat", mom && mom.word === "Flat");
  t("settled move strength is capped at 1", move && move.strength === 1);
  t("settled momentum strength is capped at 1", mom && mom.strength === 1);

  // 2) 30th Celebration: one-day spike is not a 30-day baseline; one read, one figure.
  const CFG = validSynth({
    maxOpeningShare: 0.3, minSignals: 2, ebayMinListings: 5, listingsMinN: 5, listingsMinChangePct: 5,
    spreadMinPct: 5, peerMinN: 5, peerMinGapPts: 5, nearHighPct: 3, drawdownMinPct: 10, streakMinWeeks: 3,
    divergenceMinPct: 5, longMinDays: 14, minTrendUsd: 0.5, peerMinPrice: 5, peerInlineMaxPts: 2,
    spikeRatio: 1.6, baselineSpikeRatio: 1.12, neighborBand: 0.1,
    trendMinPct: { 7: 3, 30: 3, 90: 5, 365: 5 },
    slackDays: { 7: 2, 30: 3, 90: 5, 365: 7 },
    weights: { high: 3, low: 3, nearHigh: 2, drawdown: 2, trend: 2, divergence: 2, streak: 2, peers: 1, listings: 1, spread: 1, kind: 1 },
  });
  const etbPts = [
    ["2026-09-26", 146.84],
    ["2026-09-27", 171.08],
    ["2026-10-03", 148.09],
    ["2026-10-21", 128.59],
    ["2026-10-28", 117.71],
  ];
  const etbItem = { id: "tcgcsv-704143", pts: etbPts, title: "30th Celebration Elite Trainer Box", asOf: "2026-10-28", set: "ME: 30th Celebration", setSlug: "me-30th", sealed: true };
  const fs = findings(etbItem, { peers: new Map(), market: null }, CFG, { flatDays: 100000, jumpPct: 100000 });
  const trend = fs.find((f) => f.tag === "trend" && f.type.startsWith("trend30"));
  t("30-day trend skips the Sep 27 spike baseline", trend && trend.nums.lead.from[0] === "2026-09-26" && Number(trend.nums.lead.from[1]) === 146.84);
  const pct30 = trend ? Math.round(Math.abs(trend.nums.lead.pct)) : null;
  t("30-day change is about 20 not 31", pct30 === 20 || pct30 === 19);

  const conflict = checkRead({
    id: "deep-sealedrating-etb",
    name: "30th Celebration Elite Trainer Box",
    headline: "Down 31% in 31 days: 30th Celebration Elite Trainer Box went from $171.08 on Sep 27 to $117.71 on Oct 28.",
    lines: ["Down 2 of the last 3 weeks. Down 19.8% from Sep 26 to Oct 28. Down over 7 days."],
    asOf: "2026-10-28",
  });
  t("two different change figures on one read are dropped", conflict.flags.some((f) => f.rule === "change-conflict"));

  // 3) Crown Zenith mixed: stale listings half must not publish.
  const mixed = checkRead({
    id: "mixed-sealed-swsh12pt5-etb",
    readKind: "mixed",
    kind: "mixed",
    name: "Crown Zenith Elite Trainer Box",
    headline: "Crown Zenith Elite Trainer Box: market $324.32 on Oct 21 to $299.66 on Oct 28 (-7.6%). Listings counted 100 on Oct 17 to 101 on Oct 18.",
    lines: [
      "Market $324.32 on 2026-10-21 to $299.66 on 2026-10-28 (-7.6%).",
      "Listings counted 100 on 2026-10-17 to 101 on 2026-10-18. A listing is not a sale.",
    ],
    asOf: "2026-10-28",
    stale: true,
    receipt: { pricePct: -7.6, listingsPct: 1, listingsTo: "2026-10-18" },
  }, { asOf: "2026-10-28" });
  t("stale mixed sealed is dropped", mixed.flags.some((f) => f.rule === "mixed-stale"));
  t("listings fresh window is 2 days", LISTINGS_FRESH_DAYS === 2);
  const built = mixedReads({
    cards: [],
    sealedPool: [{ id: "swsh12pt5-etb", name: "Crown Zenith Elite Trainer Box", from: 324.32, to: 299.66, group: "swsh12pt5" }],
    listings: { products: [{ id: "swsh12pt5-etb", listingsCounted: { n: 101, date: "2026-10-18", prev: { n: 100, date: "2026-10-17" } } }] },
    asOf: "2026-10-28",
    start: "2026-10-21",
    end: "2026-10-28",
  });
  t("mixed builder skips stale listings half", built.length === 0);

  // 4) Umbreon: species count line must not gain a foreign collector number.
  const umbreons = [
    { id: "tcgcsv-610516", name: "Umbreon ex", clean: "Umbreon ex", number: "161/131", set: "Prismatic Evolutions", setShort: "Prismatic Evolutions", rarity: "Special Illustration Rare" },
    { id: "tcgcsv-610400", name: "Umbreon", clean: "Umbreon", number: "059/131", set: "Prismatic Evolutions", setShort: "Prismatic Evolutions", rarity: "Rare" },
  ];
  const index = {
    byId: new Map(umbreons.map((c) => [c.id, c])),
    bySet: new Map([["prismatic evolutions", umbreons]]),
    bySpecies: new Map([["umbreon", umbreons]]),
    byArtist: new Map(),
  };
  const stamped = stampRead({
    id: "deep-card-tcgcsv-610516",
    deep: "card",
    readKind: "deep",
    sku: "tcgcsv-610516",
    name: "Umbreon ex - 161/131",
    number: "161/131",
    set: "Prismatic Evolutions",
    headline: "Lower for 9 weeks running: Umbreon ex (Prismatic Evolutions) 161/131.",
    lines: [
      "On file since Jan 2025: 149 TCGplayer market points for this card (Holofoil).",
      "Number 2 of 27 Umbreon cards we price tonight.",
      "Number 1 of 176 priced cards in Prismatic Evolutions.",
    ],
    asOf: "2026-10-28",
  }, index, { images: {}, tcgOn: false, sealedPid: new Map() });
  t("species count line stays without a foreign number", stamped.lines[1] === "Number 2 of 27 Umbreon cards we price tonight.");
  t("species line does not mention 059/131", !stamped.lines.some((l) => String(l).includes("059/131")));
  const wrong = checkRead({
    id: "deep-card-tcgcsv-610516",
    name: "Umbreon ex",
    number: "161/131",
    headline: "Lower for 9 weeks.",
    lines: ["Number 2 of 27 Umbreon 059/131 cards we price tonight."],
    asOf: "2026-10-28",
  });
  t("species line naming another printing is dropped", wrong.flags.some((f) => f.rule === "species-number"));

  // Pipeline: fact reads are not marked stale just for an older asOf.
  const doc = {
    asOf: "2026-10-28",
    reads: [
      { id: "pokemon-gyarados", readKind: "pokemon", kind: "pokemon", asOf: "2026-09-28", headline: "Gyarados." },
      { id: "mixed-x", readKind: "mixed", kind: "mixed", asOf: "2026-10-28", endDate: "2026-10-18", headline: "Mixed." },
      { id: "move-x", readKind: "move", kind: "single", asOf: "2026-10-28", endDate: "2026-10-28", headline: "Move." },
    ],
  };
  const stampedDoc = stampStale(doc, "2026-10-28");
  t("pokemon catalogue reads are not flagged stale", doc.reads[0].stale === false);
  t("mixed with an old endDate is still flagged stale", doc.reads[1].stale === true);
  t("fresh move is not stale", doc.reads[2].stale === false);
  t("stampStale counts only real stale rows", stampedDoc.stale === 1);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("reads-check-oct28.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("reads check oct28 ok");
}
