// The watchdog must not queue a second nightly, and must not record a retry
// that was not dispatched.
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTIVE_STATUSES, decideDispatch, listActiveRuns, recordAfterDispatch,
} from "../lib/watchdog-retry.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function runs(status) {
  return { ok: true, runs: [{ id: 1, status }] };
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("active statuses are queued, waiting, pending, and in progress", ACTIVE_STATUSES.join() === "queued,waiting,pending,in_progress");
  for (const status of ACTIVE_STATUSES) {
    const decision = decideDispatch({ alreadyRetried: false, check: runs(status) });
    t(`${status} skips dispatch and does not record`, decision.dispatch === false && decision.record === false && decision.reason === "active-run");
  }
  const idle = decideDispatch({ alreadyRetried: false, check: runs("completed") });
  t("a finished run still allows one dispatch", idle.dispatch === true && idle.record === false && idle.reason === "idle");
  const limited = decideDispatch({ alreadyRetried: true, check: { ok: true, runs: [] } });
  t("the 20 hour retry limit still blocks dispatch and recording", limited.dispatch === false && limited.record === false && limited.reason === "already-retried");
  const blind = decideDispatch({ alreadyRetried: false, check: { ok: false, runs: [] } });
  t("a failed run check does not dispatch or record", blind.dispatch === false && blind.record === false && blind.reason === "check-failed");

  const recorded = recordAfterDispatch(true);
  t("a successful dispatch is the only path that records", recorded.record === true && recorded.reason === "dispatched");
  const missed = recordAfterDispatch(false);
  t("a failed dispatch does not record", missed.record === false && missed.reason === "dispatch-failed");
  const skipped = recordAfterDispatch(undefined);
  t("a skip is not recorded as a dispatch", skipped.record === false && skipped.reason === "dispatch-failed");

  const listed = await listActiveRuns({
    owner: "o", repo: "r", token: "tok",
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      json: async () => ({
        total_count: url.includes("status=queued") ? 1 : 0,
        workflow_runs: url.includes("status=queued") ? [{ id: 9, status: "queued" }] : [],
      }),
    }),
  });
  const fromList = decideDispatch({ alreadyRetried: false, check: listed });
  t("a listed queued run skips dispatch", listed.ok === true && fromList.reason === "active-run" && fromList.record === false);

  const pendingOk = await listActiveRuns({
    owner: "o", repo: "r", token: "tok",
    fetchImpl: async (url) => {
      if (url.includes("status=pending")) return { ok: false, status: 422, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ total_count: 0, workflow_runs: [] }) };
    },
  });
  t("an unsupported pending filter does not hide a clear night", pendingOk.ok === true && decideDispatch({ alreadyRetried: false, check: pendingOk }).dispatch === true);

  const down = await listActiveRuns({
    owner: "o", repo: "r", token: "tok",
    fetchImpl: async () => { throw new Error("network"); },
  });
  t("a network failure does not look idle", down.ok === false && decideDispatch({ alreadyRetried: false, check: down }).dispatch === false);

  const cli = spawnSync(process.execPath, ["scripts/watchdog-retry.mjs", "--record-ok", "false"], { cwd: ROOT, encoding: "utf8" });
  t("the record command refuses a failed dispatch", cli.status === 3 && /record=false/.test(cli.stdout) && /reason=dispatch-failed/.test(cli.stdout));
  const yes = spawnSync(process.execPath, ["scripts/watchdog-retry.mjs", "--record-ok", "true"], { cwd: ROOT, encoding: "utf8" });
  t("the record command accepts only a successful dispatch", yes.status === 0 && /record=true/.test(yes.stdout));
  const noToken = spawnSync(process.execPath, ["scripts/watchdog-retry.mjs", "--check"], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, GH_TOKEN: "", GITHUB_REPOSITORY: "", GITHUB_OUTPUT: "" },
  });
  t("a check with no token does not dispatch", noToken.status === 0 && /dispatch=false/.test(noToken.stdout) && /reason=check-failed/.test(noToken.stdout));

  const dog = await readFile(join(ROOT, ".github/workflows/watchdog.yml"), "utf8");
  t("the watchdog still has one dispatch", dog.split("createWorkflowDispatch").length === 2);
  t("the 20 hour limit is unchanged", /age < 20/.test(dog) && /already-retried=true/.test(dog) && /already-retried=false/.test(dog));
  t("an active nightly is checked before dispatch", dog.indexOf("scripts/watchdog-retry.mjs --check") > 0 && dog.indexOf("scripts/watchdog-retry.mjs --check") < dog.indexOf("createWorkflowDispatch"));
  t("dispatch waits for a clear check", /steps\.active\.outputs\.dispatch == 'true'/.test(dog));
  t("the recovery record requires a successful dispatch output", /steps\.retry\.outputs\.dispatched == 'true'/.test(dog) && /watchdog-retry\.mjs --record-ok/.test(dog));
  t("the dispatch output is set only after the call", /await github\.rest\.actions\.createWorkflowDispatch[\s\S]*core\.setOutput\('dispatched', 'true'\)/.test(dog));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("watchdog-retry.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
