// Publish gate and the Oct 19 reads check bugs. Made up numbers only.
import { checkRead, gateReads, checkMeter } from "../lib/publish-gate.mjs";
import { staleOneStep } from "../lib/read-quality.mjs";
import { backToRead } from "../lib/history-reads.mjs";
import { sealedGapDeep, cardStories } from "../lib/deep-reads.mjs";
import { patternLine } from "../lib/read-facts.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const rule = (r, ctx = {}) => checkRead(r, ctx).flags.map((f) => f.rule);
  const base = { id: "x", name: "Box", headline: "Box: $10 (Oct 19).", asOf: "2026-10-19" };

  const d = checkRead({ ...base, receipt: { name: "30th Celebration \u2014 Decks" } });
  t("dash stripped and read kept", d.read && !/[\u2014\u2013]/.test(JSON.stringify(d.read)) && d.flags[0].rule === "dash");
  t("category name is a bad title", rule({ ...base, name: "Rating: Illustration Rares" }).includes("title"));
  t("doubled card number is a bad title", rule({ ...base, name: "Chansey ex 96/109 #96/109" }).includes("title"));
  const chips = { x: { tiles: { price: { dir: "up", days: 7, stage: { word: "Building", dir: "down" } } } } };
  t("headline down vs tile up drops", rule({ ...base, headline: "Box: Down 17%.", windowDays: 7 }, { chips }).includes("direction"));
  t("950 day tile on a 7 day read drops", rule({ ...base, windowDays: 7 }, { chips: { x: { tiles: { price: { dir: "up", days: 950 } } } } }).includes("window"));
  const facts = () => ({ range: { high: { price: 300, date: "2026-08-13" } } });
  t("same high, two dates drops", rule({ ...base, receipt: { between: { price: 300, date: "2026-07-16" } } }, { facts }).includes("fact-date"));
  const lc = { ...base, readKind: "listings", sku: "sm35-etb", asOf: "2026-10-18", receipt: { n: 11 } };
  t("listings read behind the nightly drops", rule(lc, { listings: { "sm35-etb": { date: "2026-10-19", n: 13 } } }).includes("stale"));
  t("zero listings counted drops", rule({ ...lc, receipt: { n: 0 } }).includes("listings-zero"));
  t("NM on sealed drops", rule({ ...base, kind: "sealed", headline: "Box NM $10." }).includes("condition"));
  t("bad image removed", checkRead({ ...base, image: "javascript:x" }).read.image === undefined);
  t("Vintage on a 2004 set drops", rule({ ...base, set: "POP Series 1", tags: ["Vintage"] }, { sets: { "POP Series 1": "2004-09-01" } }).includes("era"));
  t("same read as yesterday drops", rule({ ...base, endDate: "2026-10-19" }, { asOf: "2026-10-19", prev: { x: { ...base, asOf: "2026-10-18", endDate: "2026-10-19" } } }).includes("repeat"));
  t("advice wording drops", rule({ ...base, headline: "You should buy this box now." }).includes("advice"));
  t("raw card codes are a bad title", rule({ ...base, headline: "Set: top cards on TCGplayer market are #R/RGB at $6,000.27." }).includes("title"));
  t("priced card with no tiles drops", rule({ ...base, kind: "single", price: 61.97, href: "/c/tcgcsv-1" }, { chips: {} }).includes("tiles"));
  t("priced sealed read with no tiles drops", rule({ ...base, kind: "sealed", price: 107, href: "/p/example-box" }, { chips: {} }).includes("tiles"));
  t("a price tile keeps the read", !rule({ ...base, kind: "single", price: 46.89, href: "/c/tcgcsv-90105" }, { chips: { x: { tiles: { price: { dir: "up", days: 7, pct: 15.4 } } } } }).includes("tiles"));
  t("a data tile keeps the read", !rule({ ...base, kind: "single", price: 10, href: "/c/tcgcsv-2" }, { chips: { x: { tiles: { data: { bars: 3, of: 5 } } } } }).includes("tiles"));
  t("price being checked is not required to have tiles", !rule({ ...base, kind: "single", price: 10, href: "/c/tcgcsv-3", headline: "Price being checked." }, { chips: {} }).includes("tiles"));
  t("an unpriced deep read is not required to have tiles", !rule({ ...base, kind: "deep" }, { chips: {} }).includes("tiles"));
  t("bare pattern rate under 50 drops", rule({ ...base, readKind: "pattern-forming", headline: "Items matching this pattern were right 29.1% of the time 7 days later, vs 20.8% normally." }).includes("pattern-rate"));
  t("lift lead keeps a later rate", !rule({ ...base, readKind: "pattern-forming", headline: "1.4x more likely than usual to rise and finish above the usual move within 7 days. 29.1% of 2,962 past cases vs 20.8% for all items." }).includes("pattern-rate"));
  t("down 17 price headline is not a pattern rate", !rule({ ...base, headline: "Box: Down 17%." }).includes("pattern-rate"));
  t("bare 55 is not under 50", !rule({ ...base, readKind: "pattern-forming", headline: "This pattern was right 55% of the time." }).includes("pattern-rate"));
  t("clean read passes", rule(base).length === 0);

  const gapLines = ["Pack: $9.07 (Sep 26) to $8.34 (Oct 19).", "Card: $212.29 to $170.33, same days."];
  t("a rounded inverse multiple drops", rule({ ...base, headline: "Pack vs its top chase card: Card costs 25x the sealed price tonight, from 20x on Sep 26.", lines: gapLines }).includes("ratio"));
  t("the honest one decimal stays", !rule({ ...base, headline: "Pack vs its top chase card: Card costs 20.4x the sealed price tonight, from 23.4x on Sep 26.", lines: gapLines }).includes("ratio"));
  t("a listing count from another day drops", rule({ ...base, readKind: "listings", asOf: "2026-10-17", receipt: { n: 137, date: "2026-10-17" } }, { asOf: "2026-10-20" }).includes("own-date"));
  t("a listing count on the read date stays", !rule({ ...base, readKind: "listings", asOf: "2026-10-20", receipt: { n: 40, date: "2026-10-20" } }, { asOf: "2026-10-20" }).includes("own-date"));
  t("an older fact that names its date stays", !rule({ ...base, receipt: { date: "2026-09-26" }, headline: "Box: $9.07 on Sep 26." }).includes("own-date"));
  t("an older fact with no date in the copy drops", rule({ ...base, receipt: { date: "2026-09-26" }, headline: "Box: $9.07." }).includes("own-date"));
  t("Vintage chip on a 2019 promo drops", rule({ ...base, id: "p", set: "SWSH Promos", tags: ["Promo"] }, { chips: { p: { signals: [{ kind: "era", tag: "Vintage" }] } }, sets: { "SWSH Promos": "2019-11-15" } }).includes("era"));
  t("Vintage on a 1999 set stays", !rule({ ...base, set: "Base Set", tags: ["Vintage"] }, { sets: { "Base Set": "1999-01-09" } }).includes("era"));
  t("a promo keeps Vintage only from its own early date", !rule({ ...base, id: "m", sku: "tcgcsv-1", set: "Wizards Promos", tags: ["Promo", "Vintage"] }, { sets: { "Wizards Promos": "1999-07-01" }, cardReleases: { "tcgcsv-1": "2000-11-10" } }).includes("era"));
  t("Reverse Holo on a holofoil price drops", rule({ ...base, tags: ["Reverse Holo"], why: "finish (Holofoil)" }).includes("printing"));
  t("Reverse Holo on a reverse price stays", !rule({ ...base, tags: ["Reverse Holo"], why: "finish (Reverse Holofoil)" }).includes("printing"));
  const freshLine = patternLine({ rate: 25, base: 20.8, n: 3503, horizon: 7 });
  t("pattern line is built fresh and leads with the lift", freshLine.startsWith("1.2x more likely") && !freshLine.toLowerCase().includes("right"));
  t("a cached right 25 line drops", rule({ ...base, pattern: { line: "right 25% of the time" } }).includes("pattern-rate"));
  t("the fresh pattern line stays", !rule({ ...base, pattern: { line: freshLine } }).includes("pattern-rate"));
  const thin = { ...base, lines: ["On file since Feb 2024: 40 TCGplayer market points for this card (Holofoil).", "Peak $50.00 on May 30. Low $10.00 on May 12."] };
  const bar = { minPoints: 100, maxRatio: 3 }; // fixture only; the live bar stays in catchem-data-private
  t("a thin jumpy story drops when the private bar is set", rule(thin, { stability: bar }).includes("stability"));
  t("no private bar, the story stays", !rule(thin).includes("stability"));
  t("back-to without a recent return drops", rule({ ...base, readKind: "backto", receipt: { startDate: "2026-01-22" } }).includes("back-to"));
  t("back-to returned today stays", !rule({ ...base, readKind: "backto", receipt: { returned: "2026-10-19" } }).includes("back-to"));
  t("back-to returned in May drops", rule({ ...base, readKind: "backto", receipt: { returned: "2026-05-20" } }).includes("back-to"));
  t("a blank name drops", rule({ ...base, name: " " }).includes("name"));
  t("a raw code name drops", rule({ ...base, name: "tcgcsv-642618" }).includes("name"));
  t("a category name is not a display name", rule({ ...base, name: "Rating: Special Illustration Rares" }).includes("name"));
  t("a real card name stays", !rule({ ...base, name: "Zekrom ex (Black Bolt) 166/086" }).includes("name"));
  t("sold wording drops", rule({ ...base, headline: "12 Near Mint copies sold over Oct 10 to Oct 16." }).includes("sold"));
  t("the word sales drops", rule({ ...base, why: "Asks are not sales." }).includes("sold"));
  t("listings counted stays", !rule({ ...base, headline: "12 listings counted over Oct 10 to Oct 16." }).includes("sold"));
  t("an empty read drops", rule({ id: "empty", name: "Card", headline: "", path: "", asOf: "2026-10-19" }).includes("empty"));
  t("a headline keeps an otherwise empty path", !rule(base).includes("empty"));
  const cent = { ...base, id: "cent", readKind: "solddown", kind: "solddown", price: 0.9, receipt: { fromPrice: 0.91, toPrice: 0.9 } };
  t("a cheap tiny move drops when the fixture floor is set", rule(cent, { floor: { maxCheapPrice: 10, maxCheapMove: 1 } }).includes("low-value"));
  t("the same move stays when no floor is loaded", !rule(cent).includes("low-value"));
  t("a larger dollar move stays under the fixture floor", !rule({ ...cent, id: "mid", price: 12, receipt: { from: 8, to: 12 } }, { floor: { maxCheapPrice: 10, maxCheapMove: 1 } }).includes("low-value"));

  const many = Array.from({ length: 40 }, (_, i) => ({ ...base, id: `r${i}`, name: "Rating: X" }));
  t("systemic breakage is flagged", gateReads(many).systemic === true);
  const meter = { published: true, asOf: "2026-10-19", minComponents: 2, market: { mood: 60, heat: 40, moodUsed: 2, heatUsed: 2, reasons: ["53% of sets up over 7 days (145 of 276)"] } };
  t("meter gate keeps a full fresh row", checkMeter(meter, { minComponents: 2, freshAsOf: "2026-10-19" }).ok === true);
  t("meter gate drops under the private minimum", checkMeter({ ...meter, market: { ...meter.market, moodUsed: 1 } }, { minComponents: 2, freshAsOf: "2026-10-19" }).action === "drop");
  t("meter gate drops stale inputs", checkMeter({ ...meter, asOf: "2026-10-10" }, { minComponents: 2, freshAsOf: "2026-10-19" }).reasons.includes("stale"));

  const days = new Map([["2026-10-12", 2265.93], ["2026-10-13", 2265.93], ["2026-10-14", 2265.93], ["2026-10-15", 2265.93], ["2026-10-16", 1886.95], ["2026-10-17", 1886.95], ["2026-10-18", 1886.95], ["2026-10-19", 1886.95]]);
  t("one old step, flat since: no repeat sealed read", staleOneStep(days, "2026-10-12", "2026-10-19") === true);
  days.set("2026-10-19", 1800);
  t("a fresh move still reads", staleOneStep(days, "2026-10-12", "2026-10-19") === false);

  const pts = [["2025-03-27", 175.27], ["2026-07-16", 300], ["2026-08-13", 300], ["2026-10-19", 176.65]];
  const r = backToRead({ pts, name: "Charizard", set: "EX Power Keepers", number: "6/108", id: 84188 }, "2026-10-19");
  t("back-to read uses the latest day at the high", !r || r.receipt?.between?.date === "2026-08-13");

  const days7 = ["2026-09-26", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-19"];
  const chase = { id: "tcgcsv-1", name: "Cynthia's Garchomp ex", set: "SV10: Destined Rivals", number: "232/182", rarity: "Special Illustration Rare", printing: "Holofoil", pts: days7.map((d, i) => [d, i === days7.length - 1 ? 170.33 : 212.29]) };
  const gap = sealedGapDeep(
    [{ id: "sv10-pack", name: "Destined Rivals Booster Pack", set: "SV10: Destined Rivals", tcgPlayerId: 1 }],
    new Map([["sv10-pack", days7.map((d, i) => ({ date: d, market: i === days7.length - 1 ? 8.34 : 9.07 }))]]),
    [chase],
    new Map([[1, { group: "SV10: Destined Rivals" }]]),
    { asOf: "2026-10-19" },
  );
  t("sealed multiple is one decimal from the dated dollars", gap.length === 1 && gap[0].headline.includes("20.4x") && gap[0].headline.includes("23.4x") && !gap[0].headline.includes("25x"));

  const storyCard = { id: "tcgcsv-9", name: "Jolteon Star", set: "EX Power Keepers", rarity: "Rare Holo", printing: "Holofoil", pts: [["2024-02-01", 40], ["2025-05-12", 10], ["2026-05-30", 50], ["2026-10-19", 80]] };
  t("a story with no private bar is kept", cardStories([storyCard], { asOf: "2026-10-19" }).length === 1);
  t("a thin jumpy story is skipped when the private bar is set", cardStories([storyCard], { asOf: "2026-10-19", stability: { minPoints: 100, maxRatio: 3 } }).length === 0);
  return fail;
}
