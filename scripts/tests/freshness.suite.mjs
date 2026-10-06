import { freshnessFrom, freshnessFromReport } from "../lib/freshness.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  const fresh = freshnessFrom("2026-09-26T20:20:00.000Z", Date.parse("2026-09-26T22:00:00.000Z"));
  t("a fresh run says Updated and names PT", fresh.delayed === false && fresh.label.startsWith("Updated ") && fresh.label.endsWith("PT"));
  const old = freshnessFromReport({ finishedAt: "2026-09-20T20:20:00.000Z" }, Date.parse("2026-09-26T22:00:00.000Z"));
  t("older than 36h is Data delayed", old.delayed === true && old.label === "Data delayed" && old.at);
  t("a missing clock is Data delayed", freshnessFrom(null).label === "Data delayed");
  t("the clock is the report, not render time", freshnessFromReport({ finishedAt: "2026-09-26T20:20:22.665Z" }, Date.parse("2026-09-26T21:00:00.000Z")).at === "2026-09-26T20:20:22.665Z");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("freshness.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
