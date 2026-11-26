// pr-tests must run again after a workflow-bot data commit. GitHub does not
// start a new workflow from a push that used GITHUB_TOKEN, so main can stay
// red after the data is already fixed. The decision lives in
// scripts/lib/pr-tests-rerun.mjs and is wired through a workflow_run trigger.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DATA_COMMIT_WORKFLOWS,
  checkoutRefForEvent,
  shouldRerunPrTests,
} from "../lib/pr-tests-rerun.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function workflowRunNames(yml) {
  const lines = String(yml).split("\n");
  const names = [];
  let inBlock = false;
  for (const line of lines) {
    if (/^\s+workflows:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      const hit = line.match(/^\s+-\s+"([^"]+)"\s*$/) || line.match(/^\s+-\s+'([^']+)'\s*$/);
      if (hit) {
        names.push(hit[1]);
        continue;
      }
      if (/^\s+-/.test(line) || /^\s+#/.test(line) || /^\s*$/.test(line)) continue;
      inBlock = false;
    }
  }
  return names;
}

export async function run() {
  let fail = 0;
  const t = (name, cond, detail) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`); }
  };

  t("the data-commit list is not empty", DATA_COMMIT_WORKFLOWS.length >= 4);
  t("the price run is on the list", DATA_COMMIT_WORKFLOWS.includes("Update sealed prices"));
  t("listing counts are on the list", DATA_COMMIT_WORKFLOWS.includes("Listing counts"));
  t("BUILD1 hooks are on the list", DATA_COMMIT_WORKFLOWS.includes("BUILD1 hooks"));

  const priceFail = shouldRerunPrTests({
    triggeringWorkflow: "Update sealed prices",
    conclusion: "failure",
    headBranch: "main",
  });
  t("a red price run on main still reruns pr-tests (data may already be committed)", priceFail.rerun === true && priceFail.checkoutRef === "main");

  const priceOk = shouldRerunPrTests({
    triggeringWorkflow: "Update sealed prices",
    conclusion: "success",
    headBranch: "main",
  });
  t("a green price run on main reruns pr-tests", priceOk.rerun === true && priceOk.checkoutRef === "main");

  const listings = shouldRerunPrTests({
    triggeringWorkflow: "Listing counts",
    conclusion: "success",
    headBranch: "main",
  });
  t("a listing-counts commit reruns pr-tests", listings.rerun === true);

  const timedOut = shouldRerunPrTests({
    triggeringWorkflow: "Update sealed prices",
    conclusion: "timed_out",
    headBranch: "main",
  });
  t("a timed-out price run still reruns (a mid-run commit may be on main)", timedOut.rerun === true);

  const cancelled = shouldRerunPrTests({
    triggeringWorkflow: "Update sealed prices",
    conclusion: "cancelled",
    headBranch: "main",
  });
  t("a cancelled run does not rerun", cancelled.rerun === false && cancelled.reason === "cancelled");

  const skipped = shouldRerunPrTests({
    triggeringWorkflow: "Listing counts",
    conclusion: "skipped",
    headBranch: "main",
  });
  t("a skipped run does not rerun", skipped.rerun === false && skipped.reason === "skipped");

  const other = shouldRerunPrTests({
    triggeringWorkflow: "Watchdog",
    conclusion: "success",
    headBranch: "main",
  });
  t("a non-data workflow does not rerun pr-tests", other.rerun === false && other.reason === "not-a-data-workflow");

  const branch = shouldRerunPrTests({
    triggeringWorkflow: "Update sealed prices",
    conclusion: "success",
    headBranch: "ops/some-branch",
  });
  t("a data workflow on a side branch does not rerun main pr-tests", branch.rerun === false && branch.reason === "not-main");

  t("a pull_request checkout stays the default", checkoutRefForEvent("pull_request") === null);
  t("a push checkout stays the default", checkoutRefForEvent("push") === null);
  t("a workflow_run checkout is main, not the triggering SHA", checkoutRefForEvent("workflow_run") === "main");

  const yml = await readFile(join(ROOT, ".github/workflows/pr-tests.yml"), "utf8");
  const listed = workflowRunNames(yml);
  const expected = [...DATA_COMMIT_WORKFLOWS].sort();
  const actual = [...listed].sort();
  t(
    "pr-tests.yml workflow_run list matches the data-commit list",
    JSON.stringify(actual) === JSON.stringify(expected),
    `yml=${JSON.stringify(listed)} lib=${JSON.stringify(DATA_COMMIT_WORKFLOWS)}`,
  );
  t("pr-tests.yml still runs on pull_request", /^\s+pull_request:\s*$/m.test(yml) || /^\s+pull_request:\s*\{\s*\}\s*$/m.test(yml) || /pull_request:/.test(yml));
  t("pr-tests.yml still runs on push to main", /branches:\s*\[main\]/.test(yml));
  t("pr-tests.yml does not include itself in workflow_run", !listed.includes("pr-tests"));
  t("the workflow_run checkout step pins ref main", /if:\s+github\.event_name == 'workflow_run'[\s\S]*?ref:\s*main/.test(yml));
  t("the pull_request and push checkout is unchanged in event filter", /if:\s+github\.event_name != 'workflow_run'/.test(yml));

  return fail;
}

export { workflowRunNames };
