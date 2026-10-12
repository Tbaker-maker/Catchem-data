import { streakRun } from "../lib/read-library.mjs";
import { shapeReads } from "../lib/read-quality.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };
  const days = new Map([
    ["2026-10-05", 13.66],
    ["2026-10-06", 14.07],
    ["2026-10-07", 15.13],
    ["2026-10-08", 19.24],
    ["2026-10-09", 23.07],
    ["2026-10-10", 54.16],
    ["2026-10-11", 63.86],
  ]);
  const run = streakRun(days, "2026-10-11", 6);
  t("a streak run keeps every day and its price", run.length === 7 && run[0].date === "2026-10-05" && run[0].price === 13.66 && run[6].date === "2026-10-11" && run[6].price === 63.86);
  t("a missing day is left out of the run", streakRun(new Map([["2026-10-10", 4], ["2026-10-11", 5]]), "2026-10-11", 2).length === 2);

  const spread = shapeReads({
    reads: [{
      id: "spread-1",
      sku: "box-1",
      readKind: "spread",
      kind: "spread",
      headline: "Asks from $10.00 to $20.00.",
      path: "Asks from $10.00 to $20.00.",
      receipt: { low: 10, high: 20, median: 14, count: 8 },
    }],
  });
  t("a spread stores eBay asks as its source", spread.length === 1 && spread[0].source === "eBay asks" && spread[0].sourceLine === "box-1");
  const moved = shapeReads({
    reads: [{
      id: "ask-1",
      sku: "box-2",
      readKind: "askmove",
      kind: "askmove",
      headline: "Ask from $10.00 to $12.00.",
      path: "Ask from $10.00 to $12.00.",
      receipt: { from: "2026-10-10", to: "2026-10-11", askFrom: 10, askTo: 12, market: 9 },
    }],
  });
  t("an ask move stores eBay asks as its source", moved.length === 1 && moved[0].source === "eBay asks");
  if (fail) {
    console.error(fail + " failed");
    return fail;
  }
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith("long-read-fields.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("long-read fields ok");
}
