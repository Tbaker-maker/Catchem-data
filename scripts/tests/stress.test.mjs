import { pathToFileURL } from "node:url";
import { chainIndex } from "../lib/index-baskets.mjs";
import {
  BOOTSTRAP_DRAWS,
  buildStressReport,
  cappedFactor,
  leaveOneOut,
  methodLevels,
  mulberry32,
} from "../lib/stress.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export function runStressTests() {
  fail = 0;
  const rng = mulberry32(20260926);
  const a = [rng(), rng(), rng()];
  const rng2 = mulberry32(20260926);
  const b = [rng2(), rng2(), rng2()];
  t("mulberry32 is stable for a seed", a.every((n, i) => n === b[i]) && a[0] !== a[1]);

  const flat = Array.from({ length: 19 }, () => 1);
  const rels = [...flat, 2];
  const weights = [...Array.from({ length: 19 }, () => 10), 1000];
  const cap = cappedFactor(rels, weights);
  t("5% cap pulls a heavy name down to 1.05", Math.abs(cap.factor - 1.05) < 1e-9, String(cap.factor));
  t("cap was applied", cap.capApplied === true && cap.infeasible === false);
  const few = cappedFactor([1, 2], [10, 1000]);
  t("cap is infeasible below 20 names", few.infeasible === true && Math.abs(few.factor - (10 * 1 + 1000 * 2) / 1010) < 1e-9);

  const dates = ["2026-08-18", "2026-08-19", "2026-08-21"];
  const members = [];
  for (let i = 0; i < 19; i++) {
    members.push({
      id: `flat-${i}`,
      name: `Flat ${i}`,
      type: "etb",
      prices: { "2026-08-18": 10, "2026-08-19": 10, "2026-08-21": 10 },
    });
  }
  members.push({
    id: "spike",
    name: "Spike Box",
    type: "booster-box",
    prices: { "2026-08-18": 1000, "2026-08-19": 2000, "2026-08-21": 2000 },
  });
  const walked = methodLevels(dates, members);
  t("median ignores one double", walked.levels.median === 100, String(walked.levels.median));
  t("equal mean feels the double", walked.levels.equal === 105, String(walked.levels.equal));
  t("capped line matches the 5% cap", walked.levels.capped === 105, String(walked.levels.capped));
  t("the skipped day is a gap", walked.gaps.some((g) => g.from === "2026-08-19" && g.missingDays === 1));
  t("no point on the missing day", walked.points.every((p) => p.date !== "2026-08-20"));

  const prices = new Map(members.map((m) => [m.id, new Map(Object.entries(m.prices))]));
  const elig = new Map(dates.map((d) => [d, new Set(members.map((m) => m.id))]));
  const chained = chainIndex(dates, prices, elig, members.map((m) => m.id));
  const chainLast = chained.points[chained.points.length - 1];
  t("median line matches chainIndex", walked.levels.median === chainLast.equal, `${walked.levels.median} vs ${chainLast.equal}`);

  const late = {
    id: "late",
    name: "Late Pack",
    type: "pack",
    prices: { "2026-08-22": 12 },
  };
  const stale = {
    id: "stale",
    name: "Stale Tin",
    type: "collection",
    prices: { "2026-08-18": 8 },
    outsideHeadline: true,
  };
  const reportDates = [...dates, "2026-08-22"];
  const report = buildStressReport({
    kind: "sealed",
    source: "eBay asking prices",
    sourceFile: "data/heat-history.json",
    asOf: "2026-08-22",
    today: "2026-08-22",
    dates: reportDates,
    members: [...members, late, stale],
  });
  t("report is sufficient", report.sufficient === true);
  t("methods disagree", report.disagree.flag === true && report.disagree.maxGap > 0.5);
  t("bootstrap is 1000", report.trustBand.byDate.every((row) => row.draws === BOOTSTRAP_DRAWS));
  t("band is ordered", report.trustBand.byDate.every((row) => row.p05 <= row.p95));
  const again = buildStressReport({
    kind: "sealed",
    source: "eBay asking prices",
    sourceFile: "data/heat-history.json",
    asOf: "2026-08-22",
    today: "2026-08-22",
    dates: reportDates,
    members: [...members, late, stale],
  });
  t("band is deterministic", JSON.stringify(report.trustBand) === JSON.stringify(again.trustBand));
  t("leave-one-out lists ten", report.leaveOneOutTop10.length === 10);
  t("leave-one-out deltas are numbers", report.leaveOneOutTop10.every((r) => typeof r.delta === "number"));
  const looMembers = [
    { id: "hold-a", name: "Hold A", type: "etb", prices: { "2026-08-18": 100, "2026-08-19": 100 } },
    { id: "hold-b", name: "Hold B", type: "etb", prices: { "2026-08-18": 100, "2026-08-19": 100 } },
    { id: "jump", name: "Jump", type: "etb", prices: { "2026-08-18": 100, "2026-08-19": 150 } },
  ];
  const looFull = methodLevels(["2026-08-18", "2026-08-19"], looMembers).levels.median;
  const loo = leaveOneOut(["2026-08-18", "2026-08-19"], looMembers, looFull);
  const holdMove = Math.abs(loo.find((r) => r.id === "hold-a").delta);
  const jumpMove = Math.abs(loo.find((r) => r.id === "jump").delta);
  t("median leave-one-out is not the spike", holdMove > jumpMove, `hold ${holdMove} jump ${jumpMove}`);
  t("nothing removed", report.removalsApplied === 0);
  const spikeItem = report.items.find((i) => i.id === "spike");
  const lateItem = report.items.find((i) => i.id === "late");
  const staleItem = report.items.find((i) => i.id === "stale");
  t("spike flagged", spikeItem.flags.includes("spiky"));
  t("late flagged", lateItem.flags.includes("late"));
  t("stale flagged", staleItem.flags.includes("stale"));
  t("weed-out is review only", report.weedOut.length > 0 && report.weedOut.every((w) => w.recommendation.includes("not removed")));
  t("type split keeps box and etb apart", report.byType.some((r) => r.type === "booster-box") && report.byType.some((r) => r.type === "etb"));
  const banned = JSON.stringify(report);
  t("no banned public wording", !/crypto|nft|wallet|\bdsk\b|undervalued|guaranteed/i.test(banned));

  const thin = buildStressReport({
    kind: "single",
    source: "TCGplayer market price",
    sourceFile: "data/singles-prices.json",
    asOf: "2026-09-21",
    today: "2026-09-26",
    dates: ["2026-09-21"],
    members: [{ id: "c", name: "Card", type: "Rare", prices: { "2026-09-21": 5 } }],
  });
  t("one day does not invent a band", thin.sufficient === false && thin.trustBand === null);
  t("one day states why", /No band was invented/.test(thin.insufficientReason));

  console.log(fail ? `${fail} failed` : "stress ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = runStressTests();
  if (n) process.exit(1);
}
