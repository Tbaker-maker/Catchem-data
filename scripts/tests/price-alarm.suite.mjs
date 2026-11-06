import {
  FIX_TITLE, STALE_HOURS, STALE_TITLE, failingLines, fixBody, fixPrAction, priceStamp, pricesAreStale, staleBody, staleIssueAction,
} from "../lib/price-alarm.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const stamp = "2026-10-30T12:01:34.260Z";
  const at = Date.parse(stamp);
  const doc = { updatedAt: stamp, source: "ebay-browse-api" };
  t("asOf wins when both stamps exist", priceStamp({ asOf: "2026-11-06", updatedAt: stamp }) === "2026-11-06");
  t("updatedAt is the stamp when asOf is absent", priceStamp(doc) === stamp);
  t("36 hours is not stale", pricesAreStale(doc, at + STALE_HOURS * 36e5) === false);
  t("older than 36 hours is stale", pricesAreStale(doc, at + STALE_HOURS * 36e5 + 1) === true);
  t("a missing stamp is stale", pricesAreStale({}, at) === true);

  t("the first stale night opens one issue", staleIssueAction([], true).action === "open");
  t("the next stale night updates that issue", staleIssueAction([7], true).action === "update" && staleIssueAction([7, 8], true).number === 7);
  t("a fresh file closes the one issue", staleIssueAction([7], false).action === "close");
  t("a fresh file with no issue does nothing", staleIssueAction([], false).action === "none");

  const log = "  ok  prices match\n  FAIL every set on /sets has a logo file mcdonald-s-promos-2026\n  ✗ image-coverage.suite.mjs — 1 failed\nPrices did not publish tonight. A price safety test failed:\n";
  const lines = failingLines(log);
  t("the issue keeps the exact failing test", lines.includes("FAIL every set on /sets has a logo file mcdonald-s-promos-2026") && lines.includes("Prices did not publish"));
  const body = staleBody({ runUrl: "https://github.com/Tbaker-maker/Catchem-data/actions/runs/1", doc, now: at + 40 * 36e5, tests: log });
  t("the issue title is PRICES STALE and the body names the run", STALE_TITLE === "PRICES STALE" && body.includes("/actions/runs/1") && body.includes(stamp));
  t("the stale header has no em dash", !/—|–/.test(body.split("Failing tests:")[0]));

  t("the first red run opens one fix branch", fixPrAction([]).action === "open");
  t("the next red run updates that pull request", fixPrAction([{ number: 3, branch: "fix/sealed-prices-1" }]).action === "update");
  const fix = fixBody({ runUrl: "https://github.com/Tbaker-maker/Catchem-data/actions/runs/9", tests: log });
  t("the fix body is the failing test and does not change a price", FIX_TITLE === "Fix red Update sealed prices run" && fix.includes("does not change a price") && fix.includes("FAIL every set on /sets has a logo file mcdonald-s-promos-2026"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("price-alarm.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
