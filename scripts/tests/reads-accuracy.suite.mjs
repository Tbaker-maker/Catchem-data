// Three live accuracy cases. Fixture limits only. Live cutoffs stay private.
import { readFileSync } from "node:fs";
import { priceRange, readSignals } from "../lib/signal-chips.mjs";
import { pricePointsForChip } from "../stamp-signal-chips.mjs";
import { findings, validSynth } from "../lib/read-synthesis.mjs";
import { jumpyQuote } from "../lib/jumpy-price.mjs";
import { sameLabelAcrossSets, everyPrinting } from "../lib/deep-reads-2.mjs";
import { likeForLikeMove, likeForLikePoints } from "../lib/real-listing.mjs";
import { whatWeSee } from "../lib/what-we-see.mjs";
import { hasBannedWord } from "../lib/copy-rules.mjs";

const CFG = validSynth(JSON.parse(readFileSync(new URL("./fixtures/read-synthesis-limits.json", import.meta.url), "utf8")));
// Obvious fixture. Not a market cutoff.
const JUMPY = { windowDays: 30, swingPct: 80, minSwings: 2 };
const AS_OF = "2026-10-25";
const CHIP_RULES = {
  max: 4,
  move: { flatAbs: 50, preferDays: [7], slackDays: 1, minDays: 2 },
  range: { minDays: 7 },
  supply: { minAbsPct: 99 },
  gone: { cuts: [3, 10] },
  momentum: { risingMin: 99, coolingMax: -99, recentDays: 7 },
  confidence: { cuts: [99, 99] },
};

const clean = (s) => !!s && !hasBannedWord(s) && !/[\u2013\u2014]/.test(s) && !/\b(sold|sales)\b/i.test(s);

function day(iso, price) { return [iso, price]; }

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  // 1. Headline high and the range chip share one series, one high, one window.
  // The long file ends in September. Calling that point "today" is the bug.
  const older = [
    day("2026-07-20", 40), day("2026-08-01", 55), day("2026-08-20", 61),
    day("2026-09-01", 58), day("2026-09-14", 50),
  ];
  const night = [
    day("2026-09-26", 62), day("2026-10-10", 70), day("2026-10-23", 80), day(AS_OF, 80),
  ];
  const joined = pricePointsForChip(older, night, AS_OF);
  const shared = priceRange(joined, AS_OF, { minDays: 1, slackDays: 1 });
  const stale = priceRange(older, AS_OF, { minDays: 1, slackDays: 1 });
  t("a September series is not called today", stale == null && older.at(-1)[0] !== AS_OF);
  t("joined series reaches today and its high is today's price", joined.at(-1)[0] === AS_OF && shared && shared.high === 80 && shared.place === "upper part" && shared.highOn === AS_OF);
  const chip = readSignals(
    { id: "fake-high", name: "Alakazam", kind: "single", href: "/c/tcgcsv-1", asOf: AS_OF, price: 80 },
    { asOf: AS_OF, points: joined },
    CHIP_RULES,
  ).signals.find((row) => row.kind === "range");
  t("chip names the same high and the same day count", chip && chip.high === shared.high && chip.days === shared.days && chip.label.includes(`${shared.days} day range`) && chip.label.includes("$80.00") && clean(chip.label));

  const start = "2026-01-01";
  const climb = [];
  for (let d = 0; d <= 297; d += 7) {
    const iso = new Date(Date.parse(`${start}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
    if (iso > AS_OF) break;
    climb.push([iso, iso === AS_OF ? 80 : 20 + d / 10]);
  }
  if (climb.at(-1)?.[0] !== AS_OF) climb.push([AS_OF, 80]);
  const item = { pts: climb, title: "Alakazam (Mysterious Treasures) 1/123", asOf: AS_OF, set: "Mysterious Treasures", setSlug: "mysterious-treasures", release: "2007-08-22", sealed: false, kind: "high" };
  const found = findings(item, { peers: new Map(), listings: new Map(), asks: new Map(), rotation: new Map(), setValue: new Map() }, CFG);
  const high = found.find((row) => row.type === "high");
  const again = priceRange(climb, AS_OF, { minDays: 1, slackDays: 0 });
  t("the high sentence uses the chip window and the same price", high && again && high.text.includes(`${again.days} day range`) && high.text.includes("$80.00") && high.nums.window.days === again.days && high.nums.window.high === again.high && clean(high.text));
  const see = whatWeSee({ range: { from: "2024-02-08", now: { date: AS_OF }, high: { price: 80, date: AS_OF }, low: { price: 18, date: "2024-11-14" }, daysSinceHigh: 0, fromHighPct: 0, window: { days: shared.days, high: shared.high, highOn: shared.highOn, place: shared.place } } });
  t("the history line names the same day count as the chip", see.includes(`${shared.days} day range`) && see.includes("Feb 8, 2024") && clean(see));

  // A level claim is held when the shared window does not call today the high.
  const dip = climb.slice(0, -1).concat([[AS_OF, 20]]);
  const dipped = findings({ ...item, pts: dip }, { peers: new Map(), listings: new Map(), asks: new Map(), rotation: new Map(), setValue: new Map() }, CFG);
  const dippedRange = priceRange(dip, AS_OF, { minDays: 1, slackDays: 0 });
  t("a price off the window high is not called level or highest", dippedRange && dippedRange.place !== "upper part" && !dipped.some((row) => row.type === "high" || (row.type === "nearHigh" && /Level with/.test(row.text))));

  // 2. A jumpy lead cannot open a read. Fixture swing only.
  const twoSwings = [day("2026-09-26", 100), day("2026-10-05", 200), day("2026-10-12", 90), day(AS_OF, 200)];
  const oneJump = [day("2026-09-26", 100), day("2026-10-12", 100), day("2026-10-14", 300), day(AS_OF, 300)];
  const quiet = [day("2026-09-26", 100), day("2026-10-12", 105), day(AS_OF, 110)];
  const back = jumpyQuote(twoSwings, AS_OF, JUMPY);
  const far = jumpyQuote(oneJump, AS_OF, JUMPY);
  const still = jumpyQuote(quiet, AS_OF, JUMPY);
  const openQuote = jumpyQuote(oneJump, AS_OF, null);
  t("two swings fall back to the last steady print", back.jumpy === true && back.price === 100 && back.date === "2026-09-26");
  t("one swing far from the steady print falls back to that print", far.jumpy === true && far.price === 100 && far.date === "2026-10-12" && far.price !== 300);
  t("a small move is unchanged", still.jumpy === false && still.price === 110);
  t("no limit changes nothing", openQuote.jumpy === false && openQuote.price === 300);
  const heldPts = [day("2026-09-26", 100), day("2026-10-05", 250), day("2026-10-12", 100), day("2026-10-18", 250), day(AS_OF, 100)];
  t("a jumpy price with no different steady print is held", jumpyQuote(heldPts, AS_OF, JUMPY).held === true);

  const tags = () => ["Ultra Rare"];
  const card = (id, set, pts) => ({ id, name: "Mewtwo", number: "99/109", set, rarity: "Ultra Rare", release: "2004-11-08", pts });
  const lead = sameLabelAcrossSets([
    card("a", "EX Team Rocket Returns", oneJump),
    card("b", "EX Ruby and Sapphire", [day("2026-09-26", 40), day(AS_OF, 40)]),
    card("c", "EX Deoxys", [day("2026-09-26", 20), day(AS_OF, 20)]),
  ], tags, { asOf: AS_OF, jumpy: JUMPY });
  t("same label does not lead with the jumpy price", lead.length === 1 && lead[0].headline.includes("$100.00 on Oct 12") && !lead[0].headline.includes("300") && !JSON.stringify(lead[0]).includes("1499") && clean(lead[0].headline) && lead[0].lines.every(clean));
  const rawLead = sameLabelAcrossSets([
    card("a", "EX Team Rocket Returns", oneJump),
    card("b", "EX Ruby and Sapphire", [day("2026-09-26", 40), day(AS_OF, 40)]),
    card("c", "EX Deoxys", [day("2026-09-26", 20), day(AS_OF, 20)]),
  ], tags, { asOf: AS_OF, jumpy: null });
  t("without a limit the raw price still leads", rawLead.length === 1 && rawLead[0].headline.includes("$300.00") && !rawLead[0].headline.includes("on Oct"));

  const printingCards = [card("jump", "EX Team Rocket Returns", oneJump)];
  for (let i = 0; i < 5; i += 1) printingCards.push(card(`p${i}`, `Set ${i}`, [day("2026-09-26", 10 + i), day(AS_OF, 10 + i)]));
  const printed = everyPrinting(printingCards, tags, { asOf: AS_OF, jumpy: JUMPY });
  t("every card we price does not lead with the jumpy price", printed.length === 1 && !printed[0].headline.includes("300") && !printed[0].headline.includes("tonight") && printed[0].headline.includes("$100.00") && clean(printed[0].headline));

  const heldGroup = sameLabelAcrossSets([
    card("a", "EX Delta Species", heldPts),
    card("b", "EX Ruby and Sapphire", [day("2026-09-26", 40), day(AS_OF, 40)]),
    card("c", "EX Deoxys", [day("2026-09-26", 20), day(AS_OF, 20)]),
  ], tags, { asOf: AS_OF, jumpy: JUMPY });
  t("a held lead drops the group under 3 sets", heldGroup.length === 0);

  // 3. A median needs 5 listings, and it is not mixed with a different measure.
  const pack = [
    { date: "2026-10-19", price: 15.5 },
    { date: "2026-10-23", price: 12.99, ebayMedianAsk: 10, ebayMedianCount: 1 },
    { date: "2026-10-24", price: 10, ebayMedianAsk: 10, ebayMedianCount: 1 },
    { date: "2026-10-25", price: 12.89, ebayMedianAsk: 12.89, ebayMedianCount: 45 },
  ];
  const kept = likeForLikePoints(pack);
  t("a one-listing median is not compared with a fuller median", likeForLikeMove(pack) == null && kept.length === 1 && kept[0].price === 12.89 && kept[0].count === 45);
  const both = likeForLikeMove([
    { date: "2026-10-19", price: 15.5, ebayMedianAsk: 15.5, ebayMedianCount: 40 },
    { date: "2026-10-25", price: 12.99, ebayMedianAsk: 12.99, ebayMedianCount: 45 },
  ]);
  t("two medians of 5 or more compare", both && both.from.price === 15.5 && both.to.price === 12.99 && both.measure === "ebay-median");
  const plain = likeForLikeMove([
    { date: "2026-10-19", price: 14.99 },
    { date: "2026-10-25", price: 13.36 },
  ]);
  t("plain prices with no median still compare", plain && plain.from.price === 14.99 && plain.to.price === 13.36 && plain.measure === "price");

  const heat = readFileSync(new URL("../compute-heat-states.mjs", import.meta.url), "utf8");
  t("sealed week-over-week compares the price field through like-for-like, not an eBay median",
    /likeForLikePoints\(\(history \|\| \[\]\)\.map\(\(h\) => \(\{ date: h\.date, price: h\.price \}\)\)\)/.test(heat) && !/ebayMedian/.test(heat));
  return fail;
}
