// year-patterns.suite.mjs. Time-split study, own-day gate, forming, unusual.
import { hasBannedWord } from "../lib/copy-rules.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { changeOver, addDays } from "../lib/tracker.mjs";
import {
  alertsDocument, backtestForming, conditionKeys, coveredChange, crowdKey,
  formingLine, gateOwnOnly, gridStarts, isHit, listingsDropPriceJump,
  mineYearPatterns, ownPoints, partialMatch, pathKey, presentMatches,
  provenLine, publicCopyOk, relistsAfterSpike, spikeReverts, splitByDate,
  studyPoints, thinPrints, unusualEvents,
} from "../lib/year-patterns.mjs";
import { buildObservations } from "../run-year-patterns.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

  const own = [["2026-10-01", 10], ["2026-10-02", 11]];
  const fill = { key: "pokeviz", points: [["2026-09-30", 9], ["2026-10-01", 999], ["2026-10-02", 888]] };
  const tagged = studyPoints(own, fill);
  t("fill only before the first own day", tagged[0].date === "2026-09-30" && tagged[0].src === "fill" && tagged[0].price === 9);
  t("own wins on an overlap date", tagged.find((p) => p.date === "2026-10-01").price === 10 && tagged.find((p) => p.date === "2026-10-01").src === "own");
  t("no own points means fill is not used", studyPoints([], fill).length === 0);

  const full = [];
  for (let i = 0; i <= 7; i++) full.push({ date: addDays("2026-01-01", i), price: 100 + i, src: "own" });
  const covered = coveredChange(full, "2026-01-01", "2026-01-08", 7);
  const raw = changeOver(full.map((p) => [p.date, p.price]), "2026-01-01", "2026-01-08");
  t("covered change matches changeOver when the window is full", covered && covered.change === raw && covered.startSrc === "own");
  const short = [{ date: "2026-01-01", price: 100, src: "own" }, { date: "2026-01-02", price: 110, src: "own" }];
  t("covered change is null when the span is too short", coveredChange(short, "2026-01-01", "2026-01-08", 7) == null);
  const lateStart = [
    { date: "2026-01-05", price: 100, src: "fill" },
    { date: "2026-01-12", price: 110, src: "fill" },
  ];
  t("covered change is null when the first point is too late", coveredChange(lateStart, "2026-01-01", "2026-01-12", 7) == null);
  t("isHit needs 3% and strictly above the median", isHit(3, 2.9) === true && isHit(5, 4) === true);
  t("equal to the median is not a hit", isHit(3, 3) === false);
  t("2.9 is not a hit", isHit(2.9, 0) === false && isHit(2.9, 2) === false);
  t("a missing median is not a hit", isHit(10, null) === false);

  const starts = gridStarts("2026-01-01", "2026-02-01", 7);
  t("grid steps by the horizon", starts.length === 4 && addDays(starts[0], 7) === starts[1] && starts[3] === "2026-01-22");

  const dates = [];
  let cursor = "2025-01-06";
  for (let i = 0; i < 10; i++) { dates.push(cursor); cursor = addDays(cursor, 7); }
  const splitRows = dates.map((start) => ({ start, hit: false, keys: [], horizon: 7 }));
  const split = splitByDate(splitRows, 0.3);
  t("later dates sit in the test split", split.cutoff === dates[7] && split.train.every((r) => r.start < split.cutoff) && split.test.every((r) => r.start >= split.cutoff) && split.test.length === 3);

  const rows = [];
  for (const start of dates) {
    const early = start < dates[7];
    for (let pid = 1; pid <= 30; pid++) {
      const dip = pid <= 10;
      const climb = pid > 10 && pid <= 20;
      const key = dip ? "path=dip" : climb ? "path=slow_climb" : "path=flat";
      const hit = dip ? true : climb ? early : false;
      rows.push({ id: `${pid}|${start}`, pid, start, horizon: 7, keys: [key], hit, change: hit ? 8 : 0, usesFill: false });
    }
  }
  const mined = mineYearPatterns(rows, { minN: 20, horizon: 7 });
  const dip = mined.passed.find((p) => p.keys.includes("path=dip"));
  const climb = mined.failed.find((p) => p.keys.includes("path=slow_climb"));
  t("a dip that beats the base on both sides passes", Boolean(dip) && dip.testN >= 20 && dip.trainN >= 20 && dip.testRate > dip.baseTest && dip.passedLater === true);
  t("a pattern that only works on the early side stays failed", Boolean(climb) && climb.trainN >= 20 && climb.passedLater === false && !mined.passed.some((p) => p.keys.includes("path=slow_climb")));
  const oneDay = mineYearPatterns([{ start: "2026-01-01", hit: true, keys: ["path=dip"], horizon: 7 }], { minN: 20, horizon: 7 });
  t("one date does not pass", oneDay.passed.length === 0 && oneDay.failed.length === 0);

  const ownGateRows = [];
  for (let i = 0; i < 25; i++) {
    ownGateRows.push({ keys: ["path=dip"], hit: true, usesFill: false });
    ownGateRows.push({ keys: ["path=flat"], hit: false, usesFill: false });
    ownGateRows.push({ keys: ["path=dip"], hit: true, usesFill: true });
  }
  const ownGate = gateOwnOnly(["path=dip"], ownGateRows, { minN: 20 });
  t("own-day gate ignores fill rows", ownGate.passed === true && ownGate.n === 25 && ownGate.rate === 1);
  const fillOnly = [];
  for (let i = 0; i < 25; i++) {
    fillOnly.push({ keys: ["path=dip"], hit: true, usesFill: true });
    fillOnly.push({ keys: ["path=dip"], hit: false, usesFill: false });
  }
  t("fill-only hits do not open the public gate", gateOwnOnly(["path=dip"], fillOnly, { minN: 20 }).passed === false);

  const ownPairs = [["2026-10-01", 100], ["2026-10-13", 100]];
  const dipFill = { points: [["2026-09-20", 200], ["2026-09-29", 200]] };
  const study = studyPoints(ownPairs, dipFill);
  const meta = { pid: 1, kind: "sealed", itemId: "tcgcsv-1" };
  const asOf = "2026-10-13";
  const studyKeys = conditionKeys({ points: study, listings: [], crowdEvents: [], meta, sources: [], start: asOf });
  const todayKeys = conditionKeys({ points: ownPoints(study), listings: [], crowdEvents: [], meta, sources: [], start: asOf });
  t("study path sees the fill dip", studyKeys.includes("path=dip"));
  t("own-day path does not see a fill-only dip", !todayKeys.includes("path=dip") && pathKey(ownPoints(study), asOf) == null);
  const proven = [{ id: "yp:7d:path=dip", horizon: 7, keys: ["path=dip"] }];
  const today = [{ pid: 1, itemId: "tcgcsv-1", asOf, keys: todayKeys }];
  t("present match uses own-day keys", presentMatches(today, proven).length === 0);
  t("present match hits when the own-day keys are complete", presentMatches([{ ...today[0], keys: ["kind=sealed", "path=dip"] }], proven).length === 1 && presentMatches([{ ...today[0], keys: ["kind=sealed", "path=dip"] }], proven)[0].ownOnly === true);

  const patternKeys = ["path=dip", "kind=sealed", "crowd=up", "set_age=under_1y", "rotation_stage=current"];
  const part = partialMatch(["kind=sealed", "set_age=under_1y", "rotation_stage=current"], patternKeys);
  t("partial match is 3 of 5", part.matched === 3 && part.of === 5 && part.pctComplete === 60);
  t("prefix stage stops at the last ordered hit", part.stage === 3 && part.stageName === "rotation_stage" && part.complete === false);
  const gapped = partialMatch(["kind=sealed", "path=dip", "crowd=up"], patternKeys);
  t("a gap stops the prefix before the raw match count", gapped.matched === 3 && gapped.stage === 1 && gapped.stageName === "kind");

  const pattern = { id: "yp:7d:kind=sealed+path=dip", horizon: 7, keys: ["kind=sealed", "path=dip"] };
  const formRows = [];
  const d0 = "2026-06-01";
  const d1 = addDays(d0, 7);
  const d2 = addDays(d1, 7);
  for (let pid = 1; pid <= 20; pid++) {
    formRows.push({ pid, horizon: 7, start: d0, keys: ["kind=sealed"], hit: true });
    formRows.push({ pid, horizon: 7, start: d1, keys: ["kind=sealed", "path=dip"], hit: false });
    formRows.push({ pid, horizon: 7, start: d2, keys: ["kind=sealed", "path=dip"], hit: false });
  }
  const formed = backtestForming(formRows, pattern, { minN: 20, cutoff: d0 });
  t("forming backtest passes at n>=20 when the later window completes and the move hits", formed.n >= 20 && formed.passed === true && formed.both === 20 && formed.bothRate > formed.base);
  const few = backtestForming(formRows.filter((r) => r.pid <= 19), pattern, { minN: 20, cutoff: d0 });
  t("forming backtest does not pass under n=20", few.n === 19 && few.passed === false);
  const noLater = [];
  for (let pid = 1; pid <= 20; pid++) {
    noLater.push({ pid, horizon: 7, start: d0, keys: ["kind=sealed"], hit: true });
    noLater.push({ pid, horizon: 7, start: d1, keys: ["kind=sealed"], hit: false });
  }
  const stuck = backtestForming(noLater, pattern, { minN: 20, cutoff: d0 });
  t("a partial that never completes does not pass", stuck.n >= 20 && stuck.both === 0 && stuck.passed === false);

  const drop = listingsDropPriceJump(9, [["2026-01-01", 100], ["2026-01-03", 112]], [["2026-01-01", 100], ["2026-01-03", 55]]);
  t("listings counted drop with a price jump is flagged", drop.length === 1 && drop[0].kind === "listings_drop_price_jump");
  t("that line says listings counted and stays factual", drop[0].line.includes("listings counted") && !/manipulation/i.test(drop[0].line) && !/\bsupply\b/i.test(drop[0].line) && publicCopyOk(drop[0].line));
  t("a smaller listings move is not flagged", listingsDropPriceJump(9, [["2026-01-01", 100], ["2026-01-03", 112]], [["2026-01-01", 100], ["2026-01-03", 70]]).length === 0);
  const spike = spikeReverts(9, [["2026-01-01", 100], ["2026-01-03", 120], ["2026-01-08", 105]]);
  t("a spike that gives back at least half is flagged", spike.length === 1 && spike[0].kind === "spike_revert" && publicCopyOk(spike[0].line));
  t("a spike that holds the new price is not flagged", spikeReverts(9, [["2026-01-01", 100], ["2026-01-03", 120], ["2026-01-08", 116]]).length === 0);
  const thinSkip = thinPrints(9, [["2026-01-01", 100], ["2026-01-02", 110]], null);
  t("thin print is skipped when sales are null", thinSkip.events.length === 0 && thinSkip.skipped === "no sales count on file");
  const thin = thinPrints(9, [["2026-01-01", 100], ["2026-01-02", 110]], [["2026-01-02", 1]]);
  t("thin print is flagged when a few sales come with the move", thin.events.length === 1 && thin.events[0].sales === 1 && publicCopyOk(thin.events[0].line));
  t("more sales is not a thin print", thinPrints(9, [["2026-01-01", 100], ["2026-01-02", 110]], [["2026-01-02", 5]]).events.length === 0);
  const relist = relistsAfterSpike(9, [["2026-01-02", 100], ["2026-01-04", 115]], [["2026-01-04", 100], ["2026-01-05", 140]]);
  t("relists after a spike are flagged", relist.length === 1 && relist[0].kind === "relist_after_spike" && relist[0].line.includes("listings counted") && publicCopyOk(relist[0].line));
  const mixed = unusualEvents({ pid: 9, prices: [["2026-01-01", 100], ["2026-01-02", 110]], listings: [], sales: null });
  t("unusual bundle reports the sales skip", mixed.thinSkipped === "no sales count on file");

  const warn = { line: formingLine({ matched: 3, of: 5, stageName: "path", asOf: "2026-10-13" }), patternId: "yp:7d:path=dip", itemId: "tcgcsv-1" };
  t("forming line is factual", publicCopyOk(warn.line) && warn.line.includes("3 of 5"));
  const off = alertsDocument({ asOf: "2026-10-13", enabled: false, warningsPassed: true, items: [warn] });
  t("alerts off means user lines stay empty", off.alertsEnabled === false && off.userLines.length === 0 && off.items.length === 1);
  const blocked = alertsDocument({ asOf: "2026-10-13", enabled: true, warningsPassed: false, items: [warn] });
  t("a warning that has not passed keeps user lines empty", blocked.userLines.length === 0);
  const on = alertsDocument({ asOf: "2026-10-13", enabled: true, warningsPassed: true, items: [warn, { line: "please buy now", patternId: "x" }] });
  t("alerts on after a pass keeps only a clean line", on.userLines.length === 1 && on.userLines[0] === warn.line);
  t("public copy rejects banned words and dashes", !publicCopyOk("you should buy") && publicCopyOk("Buy on eBay") && !publicCopyOk("listings supply fell") && !publicCopyOk("a \u2014 b") && !publicCopyOk("a \u2013 b") && !publicCopyOk("load up") && publicCopyOk("listings counted fell 40% in 2 days"));
  const line = provenLine({ keys: ["kind=sealed", "path=dip"], horizon: 7 }, { rate: 0.4, n: 25 });
  t("proven line is clean", publicCopyOk(line) && line.includes("40%") && line.includes("25") && line.includes("7-day") && !hasBannedWord(line, { house: true }));

  const cfg = JSON.parse(readFileSync(join(ROOT, "config/year-patterns.json"), "utf8"));
  t("config keeps alerts off", cfg.alerts === false && cfg.minFormingPct === 50);
  const feed = readFileSync(join(ROOT, "scripts/build-feed.mjs"), "utf8");
  const hook = feed.indexOf("runYearPatterns");
  const hype = feed.indexOf("runMineHypeCrowd");
  const flag = feed.indexOf("runFlagger");
  const skip = feed.indexOf("year-patterns skipped");
  t("build-feed calls runYearPatterns inside the skip guard", hype !== -1 && hook > hype && skip > hook && flag > skip);

  const obs = buildObservations({
    asOf: "2026-10-13",
    own: new Map([[7, new Map([["2026-10-06", 100], ["2026-10-13", 110]])]]),
    fill: new Map([[7, { key: "pokeviz", points: [["2026-09-01", 80], ["2026-09-08", 80], ["2026-10-06", 1]] }]]),
    listings: new Map(),
    metaByPid: new Map([[7, { pid: 7, itemId: "tcgcsv-7", kind: "sealed", release: "2024-06-01", mark: "G", rotationStage: "current" }]]),
    rotSources: [{ mark: "G", date: "2026-04-10" }],
    crowd: { events: [], found: [] },
  });
  t("observations tag a pre-own window as fill", obs.rows.some((r) => r.usesFill && r.startSrc === "fill"));
  t("observations keep a later own window off fill", obs.rows.some((r) => r.horizon === 7 && r.usesFill === false && r.start >= "2026-10-06"));
  t("crowd key stays empty without events", crowdKey([], 7, "2026-10-13") == null);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("year-patterns.suite.mjs")) {
  const n = await run();
  console.log(n ? `${n} failed` : "all ok");
  process.exit(n ? 1 : 0);
}
