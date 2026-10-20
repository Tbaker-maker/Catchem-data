import { readFileSync } from "node:fs";
import { isClean } from "../lib/copy-rules.mjs";
import { depthBars, qualifyChips, readSignals, signalsLookSecret } from "../lib/signal-chips.mjs";
import { isVintageSet } from "../lib/extra-reads.mjs";
import { FEED_PARTS, stampSkipped } from "../stamp-signal-chips.mjs";

// Fixture cutoffs only. The live numbers stay in catchem-data-private.
const RULES = {
  max: 4,
  move: { flatAbs: 10, preferDays: [7, 21], slackDays: 1, minDays: 2 },
  supply: { minAbsPct: 5 },
  gone: { cuts: [3, 10] },
  range: { minDays: 7 },
  momentum: { risingMin: 4, coolingMax: -4, recentDays: 7 },
  confidence: { cuts: [3, 8] },
  era: { vintageBefore: "2011-01-01" },
  boost: [{ kind: "art", badge: "SIR", aheadOf: "range" }],
};

function points() {
  const start = Date.parse("2026-10-01T00:00:00Z");
  const out = [];
  for (let i = 0; i < 17; i++) {
    const iso = new Date(start + i * 86400000).toISOString().slice(0, 10);
    out.push([iso, 100 + i]);
  }
  return out;
}

function rich() {
  return {
    read: {
      id: "fake-all",
      name: "Umbreon ex",
      kind: "single",
      href: "/c/tcgcsv-9001",
      asOf: "2026-10-17",
      price: 116,
      tags: ["Special Illustration Rare"],
    },
    ctx: {
      asOf: "2026-10-17",
      points: points(),
      listings: { n: 82, prev: 100, date: "2026-10-17" },
      release: "2024-01-15",
      rotationMonths: 4,
    },
  };
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const open = RULES.max;
  const wide = { ...RULES, max: 9 };
  const { read, ctx } = rich();
  const all = qualifyChips(read, ctx, wide);
  const kinds = all.map((chip) => chip.kind);
  for (const kind of ["move", "supply", "gone", "range", "momentum", "rotation", "art", "era", "confidence"]) {
    t(`qualifies ${kind}`, kinds.includes(kind));
  }
  const full = readSignals(read, ctx, wide);
  t("a wide cap keeps every chip family", full.signals.length === 9);
  t("public kinds use listings, never the word supply", full.signals.some((chip) => chip.kind === "listings") && !JSON.stringify(full).includes("supply"));
  const capped = readSignals(read, ctx, RULES);
  t("the read keeps at most 4", capped.signals.length === open && capped.signals.length === 4);
  t("SIR is kept when it matters for the card", capped.signals.some((chip) => chip.kind === "art" && chip.badge === "SIR"));
  t("no secret fields on the public chips", !signalsLookSecret(capped) && !signalsLookSecret(full));
  t("the blurb is one clean line", capped.blurb && isClean(capped.blurb) && !/[\u2013\u2014]/.test(capped.blurb) && !/\bsold\b|\bsales\b/i.test(capped.blurb));
  for (const chip of full.signals) t(`label clean ${chip.kind}`, isClean(chip.label) && !/[\u2013\u2014]/.test(chip.label));

  const checked = readSignals({ ...read, id: "fake-check", priceStatus: "checking" }, ctx, wide);
  t("a price being checked is a grey dash and not a percent", checked.signals.some((chip) => chip.kind === "move" && chip.dir === "dash" && chip.text === "") && !checked.signals.some((chip) => chip.kind === "range" || chip.kind === "momentum"));
  t("the checked blurb passes", checked.blurb === "Price being checked." && isClean(checked.blurb));

  const sealed = readSignals({
    id: "fake-sealed",
    name: "Temporal Forces Booster Bundle",
    kind: "sealed",
    href: "/p/sv5-bb",
    asOf: "2026-10-17",
    tags: ["Special Illustration Rare"],
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17" },
    release: "2024-03-22",
  }, wide);
  const sealedText = JSON.stringify(sealed);
  t("a sealed read has no condition chip and no art badge", !sealed.signals.some((chip) => chip.kind === "art") && !/\bNM\b|Near Mint|condition/i.test(sealedText));
  t("a sealed read can show listings counted", sealed.signals.some((chip) => chip.kind === "listings"));
  t("sealed lines stay clean", (!sealed.blurb || isClean(sealed.blurb)) && sealed.signals.every((chip) => isClean(chip.label)));

  const empty = readSignals({ id: "fake-empty", kind: "news", asOf: "2026-10-17" }, {}, RULES);
  t("an empty row has no chips and no blurb", empty.signals.length === 0 && empty.blurb === "");

  const strength = {
    proven: [],
    weights: {},
    fallback: {
      move: [1, 2, 3, 4],
      listings: [1, 2, 3, 4],
      gone: [1, 2, 3, 4],
      range: [0.1, 0.3, 0.6, 0.9],
      momentum: [1, 2, 3, 4],
      rotation: { invert: true, cuts: [12, 6, 3, 2] },
      art: { FA: 2, IR: 3, SIR: 5 },
      era: { Vintage: 1, Modern: 1 },
      confidence: [0, 1, 2, 3],
    },
  };
  const dotted = readSignals(read, ctx, { ...wide, strength });
  t("every chip family has 1 to 5 dots", dotted.signals.length === 9 && dotted.signals.every((chip) => chip.strength >= 1 && chip.strength <= 5 && chip.strength === Math.round(chip.strength)));
  t("no proven signals means no overall score", dotted.strength == null);
  t("dot output keeps the cutoff words private", !signalsLookSecret(dotted) && !JSON.stringify(dotted).includes("proven") && !JSON.stringify(dotted).includes("weight"));
  for (const chip of dotted.signals) t(`dotted label clean ${chip.kind}`, isClean(chip.label) && isClean(dotted.blurb) && !/[\u2013\u2014]/.test(chip.label + dotted.blurb));

  const dash = readSignals({ ...read, id: "fake-dash", priceStatus: "checking" }, ctx, { ...wide, strength });
  t("a grey dash has no dots", dash.signals.some((chip) => chip.kind === "move" && chip.dir === "dash" && chip.strength == null && !String(chip.text || "").includes("%")));

  const sealedDots = readSignals({
    id: "fake-sealed-dots",
    name: "Temporal Forces Booster Bundle",
    kind: "sealed",
    href: "/p/sv5-bb",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17" },
    release: "2024-03-22",
    points: points(),
  }, { ...wide, strength });
  const sealedDotsText = JSON.stringify(sealedDots);
  t("a sealed read with dots never says NM", !/\bNM\b|Near Mint|\bcondition\b/i.test(sealedDotsText) && sealedDots.signals.some((chip) => chip.kind === "listings" && chip.strength >= 1));

  const scored = readSignals(read, ctx, { ...wide, strength: { ...strength, proven: ["move"], weights: { move: 2 } } });
  t("a proven move sets one score from 1 to 5", scored.strength >= 1 && scored.strength <= 5);
  const unmatched = readSignals(read, ctx, { ...wide, strength: { ...strength, proven: ["not-a-kind"] } });
  t("a proven list that matches nothing hides the score", unmatched.strength == null && unmatched.signals.every((chip) => chip.strength >= 1));

  const src = readFileSync(new URL("../lib/signal-chips.mjs", import.meta.url), "utf8");
  t("the public module has no baked cutoff numbers", !/flatAbs\s*:\s*\d/.test(src) && !/cuts\s*:\s*\[/.test(src) && !/fewSellersMax\s*:\s*\d/.test(src) && !/manySellersMin\s*:\s*\d/.test(src));

  const leadRules = {
    ...wide,
    supply: { minAbsPct: 5, windowDays: 7, slackDays: 1, paceMultiple: 1, flatAbs: 3, stageDays: 3, fewSellersMax: 3, fewShareMin: 0.5, manySellersMin: 8 },
  };
  const series = [];
  for (let i = 0; i < 8; i++) {
    const iso = new Date(Date.parse("2026-10-10T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    series.push({ date: iso, n: 100 - i * 3 });
  }
  const lead = readSignals({
    id: "fake-supply",
    name: "Example Box",
    kind: "sealed",
    href: "/p/example-box",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: {
      n: 79,
      prev: 100,
      date: "2026-10-17",
      series,
      sellers: 12,
      topShare: 0.2,
      sellerNames: ["alice-seller", "bob-seller"],
      username: "alice-seller",
    },
    points: points(),
  }, leadRules);
  const leadChip = lead.signals.find((chip) => chip.kind === "listings");
  const leadText = JSON.stringify(lead);
  t("the supply chip leads and names the window", lead.signals[0]?.kind === "listings" && /Listings -\d+% \d+d/.test(leadChip?.text || "") && leadChip.text.includes("Draining") && !/sellers|Building|Slowing|Stalled|Reversing/.test(leadChip.text));
  t("seller names never reach the public chip", !leadText.includes("alice-seller") && !leadText.includes("bob-seller") && !leadText.includes("username") && !leadText.includes("sellerNames"));
  t("the supply blurb stays clean", isClean(lead.blurb) && !/[\u2013\u2014]/.test(lead.blurb) && !/\bsold\b|\bsales\b|\bsupply\b/i.test(lead.blurb));
  const few = readSignals({
    id: "fake-few",
    name: "Example Box",
    kind: "sealed",
    href: "/p/example-box",
    asOf: "2026-10-17",
  }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17", sellers: 2, topShare: 0.8 },
  }, leadRules);
  t("seller words stay off until their measurement is approved", !/sellers/i.test(JSON.stringify(few)));
  const fewOn = readSignals({ id: "fake-few-on", name: "Example Box", kind: "sealed", href: "/p/example-box", asOf: "2026-10-17" }, {
    asOf: "2026-10-17",
    listings: { n: 70, prev: 100, date: "2026-10-17", sellers: 2, topShare: 0.8 },
  }, { ...leadRules, supply: { ...leadRules.supply, publicExtras: true } });
  t("a concentrated count says few sellers when the words are switched on", (fewOn.signals.find((chip) => chip.kind === "listings")?.text || "").includes("Few sellers"));

  // Flip tiles: data and price for every read with prices, listings only with real counts.
  const tileRead = { id: "move-tcgcsv-1-7", sku: "tcgcsv-1", name: "Pikachu #088", kind: "single", asOf: "2026-10-18", price: 20.71, changePct: 7.2, windowDays: 7, source: "TCGplayer market, 2026-10-18" };
  const daily = [["2026-10-11", 19.32], ["2026-10-12", 19.19], ["2026-10-13", 19.39], ["2026-10-14", 19.88], ["2026-10-15", 19.59], ["2026-10-16", 19.53], ["2026-10-17", 20.09], ["2026-10-18", 20.71]];
  const tiled = readSignals(tileRead, { asOf: "2026-10-18", points: daily, daily, counts: { prices: 225, recent: 17, since: "2024-03-14" } }, { ...RULES, move: { ...RULES.move, flatAbs: 5 } });
  const tiles = tiled.tiles || {};
  t("a priced read gets a data tile with counts and dates", tiles.data && tiles.data.prices === 225 && tiles.data.since === "2024-03-14" && tiles.data.through === "2026-10-18" && tiles.data.bars >= 1 && tiles.data.bars <= tiles.data.of);
  t("the price tile uses the read's own window", tiles.price && tiles.price.days === 7 && tiles.price.pct === 7.2 && tiles.price.from === 19.32 && tiles.price.fromDate === "2026-10-11" && tiles.price.dir === "up");
  t("no listings tile without listings counted", !tiles.listings);
  t("tiles carry no cutoffs", !signalsLookSecret(tiles) && !/flatAbs|minAbsPct|paceMultiple|cuts/.test(JSON.stringify(tiles)));
  t("tiles carry no dashes or sold words", !/[\u2013\u2014]| - |\bsold\b|\bsales\b/i.test(JSON.stringify(tiles)));
  const boxTiles = readSignals({ id: "fake-box-tiles", name: "Example Box", kind: "sealed", href: "/p/example-box", asOf: "2026-10-17" }, {
    asOf: "2026-10-17",
    listings: { n: 79, prev: 100, date: "2026-10-17", series, sellers: 12, topShare: 0.2 },
    points: points(),
  }, leadRules).tiles || {};
  t("a product with listings counted gets a listings tile", boxTiles.listings && /^(Draining|Stacking|Steady)$/.test(boxTiles.listings.word) && boxTiles.listings.days > 0 && boxTiles.listings.spark.length >= 2);
  t("the listings tile has no seller or stage words", !/sellers|Building|Slowing|Stalled|Reversing|topShare/.test(JSON.stringify(boxTiles.listings)));

  // Era: Vintage means a WOTC era set, released before 2003-06-01, whatever the private rule says.
  const eraOf = (release) => (qualifyChips({ id: "era-x", name: "Set", kind: "sealed", asOf: "2026-10-19" }, { asOf: "2026-10-19", release }, { era: { vintageBefore: "2020-02-07" } }).find((c) => c.kind === "era") || {}).tag;
  t("Shining Legends (2017) is Modern", eraOf("2017-10-06") === "Modern");
  t("a set from May 2003 is Vintage", eraOf("2003-05-12") === "Vintage");
  t("June 1 2003 is Modern", eraOf("2003-06-01") === "Modern");
  const promoOld = qualifyChips({ id: "promo-old", name: "Lugia", kind: "single", tags: ["Promo"], asOf: "2026-10-19" }, { asOf: "2026-10-19", release: "2019-11-15", promo: true }, { era: {} }).find((c) => c.kind === "era");
  t("a 2019 promo set is not Vintage", promoOld && promoOld.tag === "Modern");
  const promoNoDay = qualifyChips({ id: "promo-wotc", name: "Mew", kind: "single", tags: ["Promo"], asOf: "2026-10-19" }, { asOf: "2026-10-19", release: "1999-07-01", promo: true }, { era: {} }).find((c) => c.kind === "era");
  t("a promo does not take Vintage from the set start", !promoNoDay);
  const promoCard = qualifyChips({ id: "promo-card", name: "Mew", kind: "single", tags: ["Promo"], asOf: "2026-10-19" }, { asOf: "2026-10-19", release: "1999-07-01", cardRelease: "2000-11-10", promo: true }, { era: {} }).find((c) => c.kind === "era");
  t("a promo uses its own release date", promoCard && promoCard.tag === "Vintage");
  const eraOnly = readSignals({ id: "deep-set-shining-legends", name: "Shining Legends", kind: "sealed", asOf: "2026-10-19" }, { asOf: "2026-10-19", release: "2017-10-06" }, { era: {} });
  t("an era tag never becomes the read line", !/Era tag/i.test(JSON.stringify(eraOnly)) && !eraOnly.blurb);
  t("WOTC set names are vintage and later sets are not", isVintageSet("Skyridge") && isVintageSet("Base Set 2") && !isVintageSet("Shining Legends") && !isVintageSet("Hidden Fates") && !isVintageSet("Black & White"));

  // Data bars: five levels from time on file and daily prices, the lower of the two.
  const DEPTH = { spanCuts: [10, 40, 150, 500], priceCuts: [5, 12, 100, 170] };
  t("two years of full history is 5 bars", depthBars({ prices: 225, since: "2024-03-14" }, "2026-10-19", DEPTH)?.bars === 5);
  t("23 days on file is 2 bars", depthBars({ prices: 18, since: "2026-09-26" }, "2026-10-19", DEPTH)?.bars === 2);
  t("a long but sparse history is held down by its price count", depthBars({ prices: 60, since: "2024-03-14" }, "2026-10-19", DEPTH)?.bars === 3);
  t("under the first cut is 1 bar", depthBars({ prices: 3, since: "2026-10-16" }, "2026-10-19", DEPTH)?.bars === 1);
  t("no depth rule, no five level scale", depthBars({ prices: 225, since: "2024-03-14" }, "2026-10-19", null) === null);
  const fiveTile = readSignals({ id: "move-tcgcsv-9-7", sku: "tcgcsv-9", name: "Card", kind: "single", asOf: "2026-10-19", price: 20, changePct: 5, windowDays: 7, source: "TCGplayer market" },
    { asOf: "2026-10-19", points: [["2026-10-12", 19], ["2026-10-19", 20]], daily: [["2026-10-12", 19], ["2026-10-19", 20]], counts: { prices: 225, recent: 17, since: "2024-03-14" } },
    { ...RULES, confidence: { ...RULES.confidence, depth: DEPTH } }).tiles?.data;
  t("the data tile uses the five level scale", fiveTile?.of === 5 && fiveTile.bars === 5 && !/spanCuts|priceCuts/.test(JSON.stringify(fiveTile)));

  // Price tile: a short window only, never an all time change.
  const slumpRead = { id: "slump-tcgcsv-5", sku: "tcgcsv-5", name: "Rayquaza ex", kind: "single", asOf: "2026-10-19", price: 272.9, changePct: 70.1, windowDays: 944, source: "TCGplayer market" };
  const week = [["2026-10-12", 300], ["2026-10-13", 298], ["2026-10-14", 295], ["2026-10-15", 290], ["2026-10-16", 285], ["2026-10-17", 280], ["2026-10-18", 276], ["2026-10-19", 272.9]];
  const slumpTile = readSignals(slumpRead, { asOf: "2026-10-19", points: [["2024-02-18", 160.47], ...week], daily: week, counts: { prices: 200, recent: 18, since: "2024-02-18" } }, RULES).tiles?.price;
  t("a long window read gets a 7 day price tile from daily prices", slumpTile && slumpTile.days === 7 && slumpTile.dir !== "up" && slumpTile.from === 300 && slumpTile.fromDate === "2026-10-12");
  const noWeek = readSignals(slumpRead, { asOf: "2026-10-19", points: [["2024-02-18", 160.47], ["2026-10-19", 272.9]], daily: [["2026-10-19", 272.9]], counts: { prices: 2, recent: 1, since: "2024-02-18" } }, RULES).tiles || {};
  t("with no short window price the tile is left out, not filled with an all time change", !noWeek.price);
  const heldPrice = { id: "move-tcgcsv-42354-7", sku: "tcgcsv-42354", name: "Raichu", kind: "single", href: "/c/tcgcsv-42354", asOf: "2026-10-19", price: 61.97, changePct: -4.8, windowDays: 7, headline: "Raichu is down 4.8% this week, from $65.07 to $61.97." };
  const heldSet = new Set(["tcgcsv-42354"]);
  t("a priced row is stamped even when its sku is held", stampSkipped(heldPrice, heldSet) === false);
  t("a held row with no price is still skipped", stampSkipped({ id: "move-tcgcsv-42354-7", sku: "tcgcsv-42354", headline: "Price being checked." }, heldSet) === true);
  t("cool and heat are stamped with the other feed sections", FEED_PARTS.includes("cool") && FEED_PARTS.includes("heat") && FEED_PARTS.includes("today"));
  const heldTiles = readSignals(heldPrice, { asOf: "2026-10-19", held: false, points: week, daily: week }, { ...RULES, move: { ...RULES.move, flatAbs: 1 } }).tiles || {};
  t("a priced held row still gets a 7 day price tile", heldTiles.price && heldTiles.price.days === 7 && heldTiles.price.pct === 4.8 && heldTiles.price.dir === "down" && !heldTiles.price.dash);
  const shortRead = readSignals({ ...slumpRead, id: "plain-tcgcsv-5", windowDays: 34, changePct: -15 }, { asOf: "2026-10-19", points: week, daily: week, counts: { prices: 8, recent: 8, since: "2026-10-12" } }, RULES).tiles?.price;
  t("a read's own short window still sets the tile", shortRead && shortRead.days === 34 && shortRead.dir === "down");
  return fail;
}
