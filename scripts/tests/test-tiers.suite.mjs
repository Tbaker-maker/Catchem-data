// The nightly degrades instead of dying: a reads failure withholds reads and
// prices still publish; a price safety failure still stops the run.
import { triage, parseLog, describe } from "../lib/test-tiers.mjs";
import { readFile } from "node:fs/promises";

const log = (...body) => ["── price trust ──", "  ✓ price trust suite", ...body, "", "200 passed · 1 failed"].join("\n");

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };

  const reads = triage(log("── feature suites ──", "  FAIL price reads are at most one third", "  ✗ deep-reads.suite.mjs — 1 failed"));
  t("a reads test failure does not block prices", reads.blocked.length === 0, JSON.stringify(reads.blocked));
  t("a reads test failure withholds the reads files", reads.withheld.length === 1 && reads.withheld[0].key === "reads" && reads.paths.includes("research/assets/public/reads.json"));
  t("the withheld reads never include the price files", !reads.paths.some((p) => /sealed-prices|^data\//.test(p)));
  t("the summary says plainly what was withheld", /Prices fetch, commit and publish/.test(describe(reads)) && /Withheld: reads/.test(describe(reads)));

  const price = triage(log("── price trust ──", "  ✗ price trust suite — 2 failed"));
  t("a price safety failure still blocks", price.blocked.length === 1 && price.withheld.length === 0);
  t("the summary says prices did not publish", /Prices did not publish/.test(describe(price)));

  const copy = triage(log("── feature suites ──", "  FAIL published reads have no em dash and no banned word", "  ✗ rd6.suite.mjs — 1 failed"));
  t("a copy rule failure inside a reads suite still blocks", copy.blocked.length === 1);
  const nm = triage(log("── feature suites ──", "  FAIL sealed never shows a condition label", "  ✗ deep-reads.suite.mjs — 1 failed"));
  t("a sealed condition label failure blocks", nm.blocked.length === 1);

  const unknown = triage(log("── feature suites ──", "  ✗ brand-new-thing.suite.mjs — 1 failed"));
  t("a test in no group blocks (fail closed)", unknown.blocked.length === 1);

  const crashed = triage("── reads subprocess ──\n  ✓ reads subprocess: read-facts.test.mjs\nTypeError: boom\n");
  t("a runner that never printed its summary blocks", crashed.blocked.length === 1 && !crashed.finished);

  const stale = triage(log("── feature suites ──", "  FAIL reader files are within 2 days of the nightly date on counts.json", "  ✗ health-status.suite.mjs — 1 failed"));
  t("main's freshness never blocks the nightly that refreshes it", stale.blocked.length === 0 && stale.monitor.length === 1);
  const stalePr = triage(log("── feature suites ──", "  FAIL reader files are within 2 days of the nightly date on counts.json", "  ✗ health-status.suite.mjs — 1 failed"), "pr");
  t("main's freshness never blocks a pull request", stalePr.blocked.length === 0);
  const mixed = triage(log("── feature suites ──", "  FAIL reader files are within 2 days of the nightly date on counts.json", "  FAIL images.tcgplayer defaults on", "  ✗ health-status.suite.mjs — 2 failed"));
  t("a real failure next to a freshness one still blocks", mixed.blocked.length === 1);
  const readsPr = triage(log("── feature suites ──", "  ✗ deep-reads.suite.mjs — 1 failed"), "pr");
  t("on a pull request a reads failure blocks (PRs must be fully green)", readsPr.blocked.length === 1);

  const sub = parseLog(log("── reads subprocess ──", "    FAIL the same high window", "  ✗ reads subprocess: read-facts.test.mjs — exit 1"));
  t("a reads subprocess failure keeps its inner test name", sub.failures[0]?.inner[0] === "the same high window");
  t("a reads subprocess failure withholds reads", triage(log("── reads subprocess ──", "  ✗ reads subprocess: reads-guard.test.mjs — exit 1")).withheld[0]?.key === "reads");

  const sv = triage(log("── feature suites ──", "  FAIL set value counts match priced singles", "  ✗ feature-data.suite.mjs — 1 failed"));
  t("a set value failure withholds only set value files", sv.blocked.length === 0 && sv.paths.every((p) => /set-value/.test(p)));

  const rb = (line) => ["── rebuild ──", line, "", "9 passed · 1 failed"].join("\n");
  const two = triage([log("── price trust ──", "  ✓ ok"), rb("  ✗ rebuild: build-feed.mjs")]);
  t("a feed builder failure withholds reads, prices still publish", two.blocked.length === 0 && two.withheld[0]?.key === "reads");
  t("a price page builder failure blocks", triage([log(), rb("  ✗ rebuild: build-public-bundle.mjs")]).blocked.length === 1);
  t("a missing rebuild log blocks", triage([log(), ""]).blocked.length === 1);

  // The workflow wiring: tests are triaged, withheld files are put back before
  // the feed commit, and one issue is opened or updated.
  const wf = await readFile(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  const at = (s) => wf.indexOf(s);
  t("the nightly triages its tests", at("scripts/triage-tests.mjs") > 0);
  t("withheld files are put back before the feed commit", at("scripts/withhold-artifacts.mjs") > 0 && at("scripts/withhold-artifacts.mjs") < at("- name: Commit the rebuilt feed"));
  t("withheld files are put back before the publish", at("scripts/withhold-artifacts.mjs") < at("publish-public-data.mjs --push"));
  t("a failed or degraded nightly updates one issue", at("scripts/nightly-issue.mjs") > 0);
  const pr = await readFile(new URL("../../.github/workflows/pr-tests.yml", import.meta.url), "utf8");
  t("PR CI triages in pr mode", /triage-tests\.mjs[^\n]*--mode pr/.test(pr));
  t("main's artifact freshness runs only on main, not on PRs", /Artifact freshness[\s\S]{0,500}github\.event_name != 'pull_request'/.test(pr));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("test-tiers.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
