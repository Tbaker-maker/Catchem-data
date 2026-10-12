import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BOARD_MAX, POST_CAP, capPost, compareRows, eraSeries, factsLines, filteredTotalForNight,
  libraryOn, productChart, shelfRead, wrongTemplate, windowQualifies, shelfSentence,
  shelfFromHistory, endOnExactDay, publicListingSentence, assertCleanSentence, msrpLine,
} from "../lib/second-library.mjs";
import { weeklyMarkdown, weeklyRead } from "../lib/weekly-read.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const flags = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8"));
  t("the library switch is off", flags.flags["reads.library"].value === false && libraryOn() === false);
  t("tightening and building stay off without a 7-day pair", shelfRead({ daysApart: 6, earlier: 10, later: 12 }) == null);
  t("tightening and building stay off while the switch is off", shelfRead({ daysApart: 7, earlier: 10, later: 12 }) == null);
  t("filteredTotal is absent when the result was capped", filteredTotalForNight({ browseTotal: 400, fetched: 150, kept: 40 }) == null);
  t("filteredTotal is absent when the total is unknown", filteredTotalForNight({ browseTotal: null, fetched: 12, kept: 4 }) == null);
  t("filteredTotal is the kept count only when every row was fetched", filteredTotalForNight({ browseTotal: 12, fetched: 12, kept: 4 }) === 4);
  t("facts panel keeps market, low, date, and source", JSON.stringify(factsLines({ market: 10, low: 8, date: "2026-10-10", source: "TCGplayer market price", listings: 40, sold: 3 })) === JSON.stringify([
    { label: "Market", value: 10 },
    { label: "Low", value: 8 },
    { label: "Date", value: "2026-10-10" },
    { label: "Source", value: "TCGplayer market price" },
  ]));
  t("a missing low stays off the facts panel", factsLines({ market: 10, date: "2026-10-10", source: "TCGplayer market price" }).every((row) => row.label !== "Low"));
  t("facts hide when the date is missing", factsLines({ market: 10, low: 8, source: "TCGplayer market price" }).length === 0);
  let msrpDoc = null;
  try { msrpDoc = JSON.parse(await readFile(join(ROOT, "data/msrp.json"), "utf8")); } catch { msrpDoc = null; }
  const msrpFacts = factsLines({ market: 10, date: "2026-10-10", source: "TCGplayer market price", msrp: 4 });
  const filled = Array.isArray(msrpDoc?.rows) && msrpDoc.rows.some((row) => Number(row?.msrpCents) > 0);
  t("there is no MSRP line", msrpLine() === "" && msrpFacts.every((row) => row.label !== "MSRP") && filled === false);
  const chart = productChart([
    { date: "2026-10-01", market: 10 },
    { date: "2026-10-03", market: 12 },
    { date: "2026-10-05", market: 11 },
  ], { file: "data/history/tcgplayer-market/example.json", asOf: "2026-10-05" });
  t("the chart leaves the missing day out", chart.points.length === 3 && chart.points[0].date === "2026-10-01" && chart.points[1].date === "2026-10-03" && chart.gapsOpen === true && chart.file.includes("tcgplayer-market") && chart.asOf === "2026-10-05");
  t("the chart does not connect a gap", chart.connectsGaps === false && chart.segments.length === 3 && !chart.points.some((point) => point.date === "2026-10-04"));
  t("the wrong template stays hidden without a direction and a ship price", wrongTemplate({ direction: "up", shipped: "2026-10-01" }) === "" && wrongTemplate({ shipPrice: 10, shipped: "2026-10-01" }) === "");
  t("a price-up read names the day below the ship price", wrongTemplate({ direction: "up", shipPrice: 10, shipped: "2026-10-01" }) === "This line would be wrong if the TCGplayer market on 2026-10-15 is below $10. If that date is missing, there is no score.");
  t("a price-down read names the day above the ship price", wrongTemplate({ direction: "down", shipPrice: 10, shipped: "2026-10-01" }).includes("above $10"));
  const fit = { id: "sv7-pack", name: "Stellar Crown Booster Pack", startDate: "2026-10-01", endDate: "2026-10-08", startCount: 80, endCount: 64, market0: 100, market1: 103 };
  t("80 to 64 with market 100 to 103 qualifies", windowQualifies(fit) && shelfSentence(fit)?.kind === "Tightening" && shelfSentence(fit).sentence === "Stellar Crown Booster Pack: filtered eBay listings 80 to 64 (2026-10-01 to 2026-10-08). TCGplayer market $100 to $103.");
  t("80 to 68 does not qualify", windowQualifies({ ...fit, endCount: 68 }) === false);
  t("229 to 354 is skipped", windowQualifies({ ...fit, startCount: 229, endCount: 354 }) === false);
  t("a parent id never qualifies", windowQualifies({ ...fit, id: "me1-etb" }) === false);
  t("a missing end date is hidden, not filled", endOnExactDay([{ date: "2026-10-01", filteredTotal: 80 }, { date: "2026-10-07", filteredTotal: 70 }, { date: "2026-10-09", filteredTotal: 64 }], "2026-10-01") == null);
  t("a browse total without filteredTotal produces no public listing sentence", publicListingSentence({ total: 400 }) == null && publicListingSentence({ total: 80, listingCount: 80 }) == null);
  t("the kill switch hides Tightening and Building even when a fixture qualifies", libraryOn() === false && shelfRead(fit) == null);
  let sealed = null;
  try { sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8")); } catch { sealed = null; }
  if (sealed?.products) {
    const live = shelfFromHistory(sealed.products);
    t("exact 7-day windows stay unpublished while the switch is off", libraryOn() === false && live.tightening.length === 0 && live.building.length === 0);
  }
  let banned = false;
  try { assertCleanSentence("This is a buy."); } catch { banned = true; }
  t("banned words fail", banned);
  const rows = compareRows(
    { name: "A", market: 10, low: null, date: "2026-10-10", source: "TCGplayer market price" },
    { name: "B", market: 12, low: 9, date: "", source: "TCGplayer market price" },
  );
  t("compare hides a row that is missing on either side", rows.length === 2 && rows.map((row) => row.label).join() === "Market,Source");
  t("compare has no winner, score, or adjective", !/winner|score|better|worse|higher|lower|cheap/i.test(JSON.stringify(rows)));
  const long = "line\n".repeat(500);
  t("posts cap at 1800 characters", capPost(long).length <= POST_CAP && capPost("short") === "short");
  const weekly = weeklyMarkdown(weeklyRead({
    asOf: "2026-10-10",
    heat: Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Box ${i}`, label: "Steady" })),
    sets: [],
  }));
  t("the weekly post stays inside 1800 and the board cap", weekly.length <= POST_CAP && weeklyRead({ asOf: "2026-10-10", heat: Array.from({ length: 12 }, (_, i) => ({ name: `Box ${i}` })) }).heat.length <= BOARD_MAX);
  t("no new digest is part of this library", !/digest/i.test(await readFile(new URL("../lib/second-library.mjs", import.meta.url), "utf8")));
  const era = eraSeries({
    id: "era-xy",
    name: "XY",
    asOf: "2026-10-10",
    series: {
      backfill: { points: [{ date: "2026-10-01", equal: 100 }, { date: "2026-10-03", equal: 101 }], gaps: [{ from: "2026-10-01", to: "2026-10-03" }] },
      live: { points: [{ date: "2026-10-08", equal: 100 }], gaps: [] },
    },
  });
  t("era lines stay apart and the gap stays open", era.tcgplayer.length === 2 && era.ebay.length === 1 && era.tcgplayer[1].date !== "2026-10-02" && era.gaps.tcgplayer.length === 1);
  t("the era chart does not connect a gap", era.connectsGaps === false && era.tcgplayerSegments.length === 2 && era.tcgplayerSegments[0][0].date === "2026-10-01" && era.tcgplayerSegments[1][0].date === "2026-10-03");
  const pulse = await readFile(join(ROOT, "scripts/generate-pulse.mjs"), "utf8");
  t("the pulse chart does not read era-index-history as an index", !pulse.includes('J("data/era-index-history.json")') && pulse.includes("eraFeed"));
  return fail;
}
