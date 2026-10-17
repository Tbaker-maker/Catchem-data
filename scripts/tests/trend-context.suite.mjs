// Trend context: own days only, one factual line, slow_climb stays private.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MIN_MOVE_PCT,
  MIN_SPAN_DAYS,
  applyTrend,
  daysBetween,
  direction7,
  itemIds,
  ownSeries,
  publicTrendOk,
  trendFacts,
  weekStats,
} from "../lib/trend-context.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };

  const mixed = ownSeries([
    { date: "2026-09-01", price: 40, src: "fill" },
    { date: "2026-09-26", price: 100, src: "own" },
    { date: "2026-09-26", price: 999, src: "fill" },
    ["2026-10-13", 110],
  ]);
  t("fill is dropped and own wins the overlap date", mixed.length === 2 && mixed[0].date === "2026-09-26" && mixed[0].price === 100 && mixed[1].price === 110);

  const short = [];
  for (let i = 0; i < 10; i += 1) short.push([`2026-10-${String(i + 1).padStart(2, "0")}`, 100 + i]);
  t("under 14 own days has no line", trendFacts(short, "2026-10-10").line === "" && daysBetween(short[0][0], short.at(-1)[0]) < MIN_SPAN_DAYS);

  const flat = [
    ["2026-09-26", 100],
    ["2026-10-06", 101],
    ["2026-10-13", 102],
  ];
  const flatFact = trendFacts(flat, "2026-10-13");
  t("a move under 3% has no line", flatFact.line === "" && Math.abs(flatFact.changePct) < MIN_MOVE_PCT);

  const weekly = [
    ["2026-09-01", 100],
    ["2026-09-08", 102],
    ["2026-09-15", 101],
    ["2026-09-22", 104],
    ["2026-09-29", 106],
    ["2026-10-06", 108],
    ["2026-10-13", 110],
  ];
  const weeks = weekStats(ownSeries(weekly), "2026-10-13");
  t("up 5 of the last 6 weeks", weeks.steps === 6 && weeks.up === 5 && weeks.down === 1);
  const climbed = trendFacts(weekly, "2026-10-13");
  t("context line names the weeks, the window, and the 7-day direction", climbed.line === "Up 5 of the last 6 weeks. Up 10% from Sep 1 to Oct 13. Up over 7 days.");
  t("7-day direction is up on an exact pair", direction7(ownSeries(weekly), "2026-10-13").dir === "up");
  t("public line does not name the private path", publicTrendOk(climbed.line) && !/slow[ _-]?climb/i.test(climbed.line));

  const downWeek = [
    ["2026-09-01", 100],
    ["2026-09-08", 99],
    ["2026-09-15", 97],
    ["2026-09-22", 98],
    ["2026-09-29", 96],
    ["2026-10-06", 95],
    ["2026-10-13", 90],
  ];
  const downFact = trendFacts(downWeek, "2026-10-13");
  t("down weeks stay factual", downFact.line.startsWith("Down 5 of the last 6 weeks.") && downFact.line.includes("Down 10% from Sep 1 to Oct 13.") && downFact.line.endsWith("Down over 7 days."));

  const flat7 = [
    ["2026-09-20", 80],
    ["2026-10-06", 100],
    ["2026-10-13", 100],
  ];
  t("flat 7-day direction", trendFacts(flat7, "2026-10-13").line.endsWith("Flat over 7 days."));

  const no7 = [
    ["2026-09-20", 100],
    ["2026-10-13", 120],
  ];
  const no7line = trendFacts(no7, "2026-10-13").line;
  t("missing exact 7-day pair omits that clause", no7line.includes("Up 20% from Sep 20 to Oct 13.") && !/7 days/.test(no7line));

  const banned = "Up 5 of the last 6 weeks. Up 10% from Sep 1 to Oct 13.";
  t("clean line passes", publicTrendOk(banned));
  t("banned words and a dash fail", !publicTrendOk("Buy now. Up 10% from Sep 1 to Oct 13.") && !publicTrendOk("listings supply fell") && !publicTrendOk("Up 10% \u2014 from Sep 1."));

  const long = [];
  for (let i = 0; i <= 40; i += 1) {
    const day = new Date(Date.parse("2026-08-01T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    long.push([day, Math.round((100 * (1 + 0.002 * i)) * 100) / 100]);
  }
  const labeledFact = trendFacts(long, long.at(-1)[0]);
  t("slow_climb can be true in private facts", labeledFact.slowClimb === true && labeledFact.path === "slow_climb");
  t("the public line still does not say slow_climb", labeledFact.line && !/slow[ _-]?climb|\bclimb\b/i.test(labeledFact.line));

  const series = new Map([
    [1, weekly],
    [2, flat],
    [3, long],
  ]);
  const longAsOf = long.at(-1)[0];
  const reads = [
    { id: "r1", sku: "tcgcsv-1", asOf: "2026-10-13", headline: "Card", lines: ["Already here."] },
    { id: "r2", sku: "tcgcsv-2", asOf: "2026-10-13", headline: "Quiet" },
    { id: "set", sku: "tcgcsv-1", asOf: "2026-10-13", receipt: { up: [{ id: "tcgcsv-1" }, { id: "tcgcsv-2" }] } },
    { id: "r3", sku: "tcgcsv-3", asOf: longAsOf, headline: "Long" },
  ];
  t("item ids keep the lead first", itemIds(reads[2]).join() === "tcgcsv-1,tcgcsv-2");
  t("a count field named up is not a list of items", itemIds({ sku: "tcgcsv-1", receipt: { up: 6 } }).join() === "tcgcsv-1");
  const once = applyTrend(reads, series, "2026-10-13");
  t("one line on the lead read", once.reads[0].trend === climbed.line && once.reads[0].lines.at(-1) === climbed.line && once.reads[0].lines[0] === "Already here.");
  t("a small move is left off", !once.reads[1].trend);
  const twice = applyTrend(once.reads, series, "2026-10-13");
  t("a second pass does not repeat the line", twice.reads[0].lines.filter((row) => row === climbed.line).length === 1);
  t("slow_climb labels are separate from the public line", once.labeled.some((row) => row.itemId === "tcgcsv-3" && row.path === "slow_climb") && once.reads.every((row) => !/slow[ _-]?climb/i.test(String(row.trend || ""))));

  const src = readFileSync(join(ROOT, "scripts/build-feed.mjs"), "utf8");
  const hook = src.indexOf("stampTrendContext");
  const tags = src.indexOf("tagReadsFile");
  const health = src.indexOf("await writeHealth");
  const skip = src.indexOf("trend context skipped");
  t("build-feed stamps trend after tags and before health", tags !== -1 && hook > tags && health > hook && skip > hook && skip < health);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("trend-context.suite.mjs")) {
  const n = await run();
  console.log(n ? `${n} failed` : "all ok");
  process.exit(n ? 1 : 0);
}
