import { readFileSync } from "node:fs";
import { beforeBoard } from "../lib/reads-guard.mjs";
import {
  addDays,
  attachLetterPoints,
  breadthFromFact,
  buildMoodGap,
  copyOk,
  gapOf,
  indexWindow,
  lastOnOrBefore,
  listingCoverageMove,
  productBreadth,
  rowsFromDaily,
  scoreBacktest,
  setSlices,
  slicesFromMeter,
  talkScore,
} from "../lib/mood-gap.mjs";

const cfg = JSON.parse(readFileSync(new URL("./fixtures/mood-gap-limits.json", import.meta.url), "utf8"));

function rows(up, down, flat, start, kind = "single") {
  const out = [];
  let n = 0;
  const push = (count, market) => {
    for (let i = 0; i < count; i += 1) out.push({ id: `${kind}-${n++}`, market, kind });
  };
  push(up, start ? 10 : 12);
  push(down, start ? 10 : 8);
  push(flat, 10);
  return out;
}

function pair(up, down, flat, kind) {
  return { start: rows(up, down, flat, true, kind), end: rows(up, down, flat, false, kind) };
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => {
    if (ok) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const board = "2026-11-25";
  const all = pair(100, 50, 10);
  const counted = productBreadth(all.start, all.end);
  t("100 up, 50 down, 10 flat", counted.all.up === 100 && counted.all.down === 50 && counted.all.flat === 10 && counted.all.n === 160 && counted.all.upShare === 0.625);

  const sealed = pair(2, 1, 0, "sealed");
  const mixed = productBreadth([...all.start, ...sealed.start], [...all.end, ...sealed.end]);
  t("sealed stays in its own split", mixed.sealed.n === 3 && mixed.single.n === 160 && mixed.all.n === 163);

  const asked = addDays(board, -7);
  const prior = "2026-11-17";
  t("a missing start day uses the prior real day", lastOnOrBefore([prior, board], asked) === prior && asked === "2026-11-18");

  const days = {
    [prior]: all.start,
    [board]: all.end,
  };
  const thin = setSlices([{ name: "Tiny", up: 1, n: 12 }, { name: "Modern", up: 4, n: 52 }], cfg.minSliceN);
  t("a slice under the fake minimum is omitted", thin.length === 1 && thin[0].name === "Modern" && thin[0].n === 52);

  const moved = listingCoverageMove(
    [{ id: "a", listingsCounted: 10 }, { id: "b", listingsCounted: 10 }, { id: "c", listingsCounted: 10 }, { id: "d", listingsCounted: 10 }],
    [{ id: "a", listingsCounted: 1 }, { id: "b", listingsCounted: 1 }],
  );
  t("fewer fetched ids do not score as supply down", moved.scored === false && moved.direction === null && moved.reason === "fewer ids fetched" && moved.prevTotal === 40 && moved.nextTotal === 2);

  const bans = ["buy now", "load up", "can't lose", "to the moon", "sold", "Extreme fear", "Greed", "see @someone"];
  t("copy lint rejects the banned lines", bans.every((line) => !copyOk(line)) && copyOk("7 day product breadth: 100 up, 50 down, 10 flat."));

  const staleRead = { readKind: "moodgap", kind: "moodgap", endDate: "2026-11-20", asOf: "2026-11-20" };
  t("a read dated before the board day is not current", beforeBoard(staleRead, board) === true);

  const daily = rowsFromDaily({
    date: board,
    prices: [{ id: 5, market: 3 }, { id: 9, market: 4 }, { id: 8, market: 0 }],
  }, ["9"]);
  t("daily rows tag sealed ids and skip a zero price", daily.rows.length === 2 && daily.rows.find((row) => row.id === "9").kind === "sealed" && daily.rows.find((row) => row.id === "5").kind === "single");

  const meter = slicesFromMeter({
    modern: { inputs: [{ id: "breadth", fact: "8% of sets up over 7 days (4 of 52)" }] },
    sets: { base: { name: "Base", inputs: [{ id: "breadth", fact: "47% of priced cards up over 7 days (27 of 57)" }] } },
  });
  t("meter facts become up of n slices", breadthFromFact("8% of sets up over 7 days (4 of 52)").n === 52 && meter.some((row) => row.name === "modern" && row.up === 4));

  const indexes = {
    singles: [{ d: prior, v: 100, n: 10 }, { d: board, v: 110, n: 10 }],
    sealed: [{ d: prior, v: 200, n: 4 }, { d: board, v: 190, n: 4 }],
  };
  const window = indexWindow(indexes.singles, board, 7);
  t("an index window names the real start day", window.start === prior && window.startGap === true && window.pct === 10 && window.end === board);

  const eras = [
    { date: prior, era: "Mega Evolution", listings: 2000, level: 80 },
    { date: board, era: "Mega Evolution", listings: 2257, level: 78.08 },
  ];
  const cohorts = [
    { date: prior, class: "mainline", totalSupply: 7000 },
    { date: board, class: "mainline", totalSupply: 7854 },
  ];
  const base = {
    boardDay: board,
    cfg,
    days,
    indexes,
    eras,
    cohorts,
    slices: [{ name: "Modern", up: 4, n: 52 }, { name: "Tiny", up: 1, n: 12 }],
    prior: { up: 90, n: 150, end: "2026-11-18", held: false },
  };
  const heldTalk = buildMoodGap({ ...base, flag: true, talk: { asOf: "2026-11-15", source: "youtube", texts: ["fearful crash"] } });
  t("stale talk yields T null and no public gap number", heldTalk.T === null && heldTalk.G === null && heldTalk.publicRead && !heldTalk.publicRead.line.includes("Mood gap"));
  t("held talk still outputs 3 to 5 dated facts", heldTalk.facts.length >= 3 && heldTalk.facts.length <= 5 && heldTalk.facts.every((row) => row.source && (row.date === board || row.date === prior)) && heldTalk.plain.includes("Talk is held"));
  t("each fact has a source and a date", heldTalk.facts.every((row) => row.source && row.date));

  const upDays = { [prior]: rows(80, 10, 10, true), [board]: rows(80, 10, 10, false) };
  const fearful = buildMoodGap({
    ...base,
    flag: false,
    days: upDays,
    talk: { asOf: board, source: "youtube", texts: ["fear crash panic"], weight: 2 },
  });
  t("flag off writes no public read", fearful.publicRead === null);
  t("fearful talk plus flat to up breadth has a positive gap", fearful.T != null && fearful.D != null && fearful.G > 0 && gapOf(fearful.T, fearful.D) === fearful.G);

  const short = [];
  for (let i = 0; i < 12; i += 1) short.push({ date: addDays("2026-01-01", i * 7), call: true, hit7: i % 2 === 0, hit30: i % 3 === 0 });
  const gate = scoreBacktest(short, cfg.minBacktestN);
  t("n 12 fails closed", gate.passed === false && gate.reason === "not passed yet");

  const missing = buildMoodGap({ boardDay: board, cfg: null, days, flag: true });
  t("missing thresholds leave D null and no public read", missing.D === null && missing.publicRead === null);

  const oldEnd = buildMoodGap({ ...base, flag: true, boardDay: "2026-11-26", talk: { asOf: "2026-11-26", texts: ["fear"] } });
  t("a board day with no end row emits nothing current", oldEnd.publicRead === null);

  const sections = attachLetterPoints({ points: ["news", "breadth", "nope"] }, heldTalk);
  t("a picked breadth point returns one section in letter order", sections.length === 1 && sections[0].id === "breadth" && sections[0].order === 5 && sections[0].facts.length >= 3);
  const none = attachLetterPoints({ points: [] }, heldTalk);
  t("no pick adds no section", none.length === 0);
  const missed = attachLetterPoints({ points: ["breadth"] }, { asOf: board, sections: [] });
  t("nothing matched says so", missed[0].facts.length === 0 && missed[0].plain.includes("No market breadth"));

  console.log("  sample " + JSON.stringify({
    facts: heldTalk.facts.length,
    since: heldTalk.sinceLastWeek,
    G: fearful.G,
    backtest: gate.reason,
  }));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("mood-gap.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
