// call-patterns.suite.mjs — pattern mining + five crowd angles + holdout gate.
import {
  seasonOf, priceBand, attachConditions, conditionEntries,
  minePatterns, crowdClusters, crowdVsData,
  prototypeCrowdReads, patternsToIdeas, scorePatternCandidates, crowdIdeas,
} from "../lib/call-patterns.mjs";
import { evaluatePatterns, evaluateCrowdAngles, publicLines } from "../mine-call-patterns.mjs";
import { isBanned } from "../lib/youtube.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.error("  FAIL", name); } };

  t("seasonOf winter", seasonOf("2026-01-15") === "winter");
  t("seasonOf summer", seasonOf("2026-07-01") === "summer");
  t("priceBand under_10", priceBand(5) === "under_25");
  t("priceBand 25_100", priceBand(50) === "25_100");
  t("priceBand null", priceBand(null) == null);

  const priceOn = (pid, day) => {
    if (day === "2026-07-15") return 100;
    if (day === "2026-06-15") return 90;
    if (day === "2026-04-16") return 80;
    return 100;
  };
  const metaByPid = new Map([[1, { subtype: "booster_box", setSlug: "sv08", release: "2024-01-01", kind: "sealed", id: "bb1", name: "Test BB" }]]);
  const seriesByPid = new Map([[1, new Map([["2026-01-01", 70], ["2026-07-15", 100], ["2026-06-01", 120]])]]);
  const row = attachConditions({
    id: "c1", pid: 1, date: "2026-07-15", dir: 1, rating: "buy",
    ourVerdict30: "right", target: "sealed", topicHints: ["sealed"],
    price: 100, channel: "nomics",
  }, { priceOn, metaByPid, seriesByPid, pullBySet: new Map([["sv08", { band: 1 }]]), listingsById: new Map([["bb1", 50]]) });
  t("attach hit", row.hit === true);
  t("attach product_type", row.conditions.product_type === "booster_box");
  t("attach direction buy", row.conditions.direction === "up_call");
  t("conditionEntries", conditionEntries(row).some((e) => e.startsWith("product_type=")));

  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push({
      id: `a${i}`, hit: true,
      conditions: { product_type: "booster_box", season: "summer", direction: "up_call", price_level: "25_100" },
    });
  }
  for (let i = 0; i < 200; i++) {
    rows.push({
      id: `b${i}`, hit: i % 5 === 0,
      conditions: { product_type: "etb", season: "winter", direction: "down_call", price_level: "under_10" },
    });
  }
  const mined = minePatterns(rows, { minN: 20 });
  t("minePatterns finds some", mined.patterns.length >= 1);
  const evaled = evaluatePatterns(mined, { minN: 20 });
  t("holdout passes ≥1", evaled.passed.length >= 1);
  t("passed have n≥20", evaled.passed.every((p) => p.testN >= 20));
  t("passed beat base", evaled.passed.every((p) => p.testRate > mined.baseTest));

  const ideas = patternsToIdeas(evaled.passed.slice(0, 3), { asOf: "2026-10-12" });
  t("ideas candidate status", ideas.every((i) => i.status === "candidate" && i.smallSample));
  t("ideas wording not banned", ideas.every((i) => !isBanned(i.rule.wording)));

  const scored = scorePatternCandidates(ideas, [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, hit: true, conditions: { product_type: "booster_box", direction: "up_call", season: "summer", price_level: "25_100" } })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: `y${i}`, hit: false, conditions: { product_type: "etb", direction: "down_call", season: "winter", price_level: "under_25" } })),
  ], { minN: 20 });
  t("scorePatternCandidates refreshes", scored.rows.length >= 1 && scored.rows.some((r) => r.n >= 20 && r.rate != null));

  // Crowd clusters
  const calls = [];
  for (let i = 0; i < 5; i++) {
    calls.push({ id: `c${i}`, pid: 99, date: "2026-08-01", dir: 1, channel: `ch${i}`, ourVerdict30: i < 4 ? "wrong" : "right" });
  }
  const clusters = crowdClusters(calls, { minCreators: 3, minCalls: 3 });
  t("crowdClusters", clusters.length >= 1 && clusters[0].creators >= 3);
  t("crowdWrong flag", clusters[0].crowdWrong === true);

  const rowBy = new Map([["99|2026-08-01", {
    pid: 99, date: "2026-08-01", hit: false,
    conditions: { product_type: "booster_box", near_high: "near" },
  }]]);
  // Pad many wrong clusters for dim mining
  const many = [];
  for (let i = 0; i < 25; i++) {
    many.push({
      pid: 500 + i, dir: 1, start: "2026-08-01", end: "2026-08-05",
      calls: 5, creators: 3, scored: 4, hits: 0, misses: 4,
      crowdWrong: true, crowdRight: false,
    });
  }
  for (let i = 0; i < 10; i++) {
    many.push({
      pid: 600 + i, dir: 1, start: "2026-08-01", end: "2026-08-05",
      calls: 5, creators: 3, scored: 4, hits: 3, misses: 1,
      crowdWrong: false, crowdRight: true,
    });
  }
  // Annotate via rowBy for product_type
  for (const c of many) {
    rowBy.set(`${c.pid}|${c.start}`, {
      conditions: { product_type: c.pid < 600 ? "booster_box" : "etb", near_high: "near" },
    });
  }
  const crowd = crowdVsData(many, rowBy, { minN: 20 });
  t("crowdVsData patterns", crowd.patterns.length >= 1);

  // Five prototype angles
  const attentionByPid = new Map();
  const priceSeries = new Map();
  const protoRows = [];
  for (let i = 1; i <= 25; i++) {
    const pid = 1000 + i;
    attentionByPid.set(pid, 0);
    priceSeries.set(pid, new Map([["2026-09-12", 10], ["2026-10-12", 12]]));
    protoRows.push({
      id: `r${i}`, pid, date: "2026-09-12", channel: `ch${i % 3}`, dir: "up_call",
      hit: true,
      conditions: { product_type: "single", topic: "singles", trend_30d: "up" },
      meta: { setSlug: "sv08", name: `Card ${i}` },
    });
  }
  // flips
  for (let i = 0; i < 22; i++) {
    protoRows.push({ id: `fa${i}`, pid: 4000 + i, date: "2026-06-01", channel: "flipper", dir: "up_call", conditions: {}, hit: null });
    protoRows.push({ id: `fb${i}`, pid: 4000 + i, date: "2026-06-20", channel: "flipper", dir: "down_call", conditions: {}, hit: null });
  }
  const fadeClusters = [];
  for (let i = 0; i < 22; i++) {
    const pid = 3000 + i;
    fadeClusters.push({
      pid, dir: 1, start: "2026-07-01", end: "2026-07-10",
      creators: 4, scored: 4, misses: 3, hits: 1, crowdWrong: true,
    });
    // price series for attention lag (rise after coverage)
    const ser = new Map([["2026-07-01", 50]]);
    for (let d = 1; d <= 20; d++) {
      const day = new Date(Date.parse("2026-07-01T00:00:00Z") + d * 86400000).toISOString().slice(0, 10);
      ser.set(day, 50 * (1 + (d >= 10 ? 0.08 : 0.01)));
    }
    priceSeries.set(pid, ser);
  }
  const protos = prototypeCrowdReads({
    clusters: fadeClusters,
    rows: protoRows,
    attentionByPid,
    priceSeries,
    asOf: "2026-10-12",
  });
  const kinds = new Set(protos.map((p) => p.kind));
  for (const k of ["quiet_climbers", "hype_fade", "attention_lag", "consensus_flips", "crowd_ignored_rarities"]) {
    t(`proto ${k}`, kinds.has(k));
  }
  const evalCrowd = evaluateCrowdAngles(crowd, protos, { minN: 20 });
  t("quiet_climbers passed holdout", evalCrowd.passed.some((p) => p.kind === "quiet_climbers" && p.n >= 20));
  t("hype_fade passed holdout", evalCrowd.passed.some((p) => p.kind === "hype_fade" && p.n >= 20));
  t("consensus_flips passed holdout", evalCrowd.passed.some((p) => p.kind === "consensus_flips" && p.n >= 20));

  const lines = publicLines(evalCrowd.passed, { asOf: "2026-10-12" });
  t("public lines present", lines.length >= 1);
  t("public lines not banned", lines.every((L) => !isBanned(L.line)));
  t("public lines no creator names", lines.every((L) => !/nomics|pokeplumber|alphainvestments|flipper/i.test(L.line)));

  const cIdeas = crowdIdeas(crowd.patterns, protos.filter((p) => (p.n || 0) >= 20), { asOf: "2026-10-12" });
  t("crowd ideas", cIdeas.length >= 1 && cIdeas.every((i) => i.status === "candidate"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("call-patterns.suite.mjs")) {
  const n = await run();
  console.log(n ? `${n} failed` : "all ok");
  process.exit(n ? 1 : 0);
}
