import { gradeRead, summarizeReads } from "../lib/receipts.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  t("same way is a hit", gradeRead({ start: 10, later: 12, direction: "up" }) === "hit");
  t("the other way is a miss", gradeRead({ start: 10, later: 8, direction: "up" }) === "miss");
  t("flat is a miss", gradeRead({ start: 10, later: 10, direction: "down" }) === "miss");
  t("no later point stays open", gradeRead({ start: 10, later: null, direction: "up" }) === "open");
  const summary = summarizeReads([
    { id: "a", name: "A", kind: "sealed", date: "2026-09-01", result: "hit", movePct: 4 },
    { id: "b", name: "B", kind: "single", date: "2026-09-01", result: "miss", movePct: -9 },
  ]);
  t("misses are kept beside hits", summary.biggestMisses.length === 1 && summary.biggestHits.length === 1 && summary.hitRate === 50);
  t("public rows have no dollars", !JSON.stringify(summary).includes("$"));
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("receipts.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
