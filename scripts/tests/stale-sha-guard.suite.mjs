// A second price run must not publish over a same-day commit that landed after it started.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { decidePublish, parseCommitLog } from "../lib/stale-sha-guard.mjs";

const DAY = "2026-11-27";
const START = "2026-11-27T09:00:36Z";
const SUBJECT = `Update sealed prices (${DAY})`;

function plain(reason) {
  return typeof reason === "string" && reason.length > 0 && !reason.includes("\n") && !/[\u2014\u2013]/.test(reason);
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const newer = decidePublish({
    runStartedAt: START,
    today: DAY,
    commits: [
      { subject: "data: public feed 2026-11-27", committedAt: "2026-11-27T11:56:44Z" },
      { subject: SUBJECT, committedAt: "2026-11-27T12:34:00+00:00" },
    ],
  });
  t("a newer same-day Update sealed prices commit skips publish", newer.skip === true);
  t("the skip reason is one plain sentence", newer.reason === `Skipping publish because a newer Update sealed prices (${DAY}) commit landed after this run started.` && plain(newer.reason));

  const none = decidePublish({ runStartedAt: START, today: DAY, commits: [] });
  t("no newer commit publishes", none.skip === false && plain(none.reason) && !/^Skipping/.test(none.reason));

  const older = decidePublish({
    runStartedAt: START,
    today: DAY,
    commits: [{ subject: SUBJECT, committedAt: "2026-11-27T08:59:59Z" }],
  });
  t("a same-day commit older than the run start publishes", older.skip === false);

  const sameInstant = decidePublish({
    runStartedAt: START,
    today: DAY,
    commits: [{ subject: SUBJECT, committedAt: START }],
  });
  t("a same-day commit at the run start is not newer", sameInstant.skip === false);

  const otherSubject = decidePublish({
    runStartedAt: START,
    today: DAY,
    commits: [{ subject: "data: sealed prices 2026-11-27", committedAt: "2026-11-27T12:34:00Z" }],
  });
  t("a newer commit with a different subject publishes", otherSubject.skip === false);

  const otherDay = decidePublish({
    runStartedAt: START,
    today: DAY,
    commits: [{ subject: "Update sealed prices (2026-11-26)", committedAt: "2026-11-27T12:34:00Z" }],
  });
  t("a newer commit from another day publishes", otherDay.skip === false);

  const parsed = parseCommitLog("2026-11-27T12:34:00+00:00\u001fUpdate sealed prices (2026-11-27)\n\nnot a row\n");
  t("a git log line becomes subject and committedAt", parsed.length === 1 && parsed[0].subject === SUBJECT && parsed[0].committedAt === "2026-11-27T12:34:00+00:00");

  const wf = readFileSync(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  const head = wf.slice(0, wf.indexOf("\njobs:"));
  t("the workflow concurrency group is update-sealed-prices and does not cancel", /concurrency:\n  group: update-sealed-prices\n  cancel-in-progress: false\n/.test(head));
  t("that group name is not repeated", wf.split("group: update-sealed-prices").length === 2);
  t("the job still queues on ebay without cancelling", /group: ebay\n {6}cancel-in-progress: false/.test(wf));

  const steps = wf.split(/\n {6}- name: /).slice(1);
  const stampAt = steps.findIndex((step) => step.startsWith("Stamp this price run start"));
  const guardAt = steps.findIndex((step) => step.startsWith("Skip publish when a newer same-day price commit already landed"));
  const publishAt = steps.findIndex((step) => step.startsWith("Publish the public-data branch"));
  const commitNames = [
    "Commit today's TCGCSV day",
    "Commit the feed news digest",
    "Commit price data (before anything reports on it)",
    "Commit the rebuilt feed",
    "Commit updated prices",
  ];
  t("the run start is stamped before any price commit", stampAt === 0 && commitNames.every((name) => steps.findIndex((step) => step.startsWith(name)) > stampAt));
  t("the guard step is immediately before publish", guardAt > stampAt && publishAt === guardAt + 1);

  const stamp = steps[stampAt] || "";
  const guard = steps[guardAt] || "";
  const publish = steps[publishAt] || "";
  t("the stamp writes a UTC instant under RUNNER_TEMP", /date -u \+%Y-%m-%dT%H:%M:%SZ/.test(stamp) && /\$RUNNER_TEMP\/price-run-started-at/.test(stamp));
  t("the guard reads that stamp and origin/main before it decides", /price-run-started-at/.test(guard) && /git fetch origin main/.test(guard) && /git log origin\/main --format='%cI%x1f%s'/.test(guard) && /node scripts\/lib\/stale-sha-guard\.mjs/.test(guard));
  t("the guard logs with echo and does not fail the job", /\becho\b/.test(guard) && !/\bexit 1\b/.test(guard));
  t("publish still requires success()", /if:\s*\$\{\{\s*success\(\)\s*&&\s*steps\.staleguard\.outputs\.skip == 'false'\s*\}\}/.test(publish) && !/\balways\(\)/.test(publish));
  t("publish still carries the private data token", /PRIVATE_DATA_TOKEN: \$\{\{ secrets\.PRIVATE_DATA_TOKEN \}\}/.test(publish) && /node scripts\/publish-public-data\.mjs --push/.test(publish));
  t("the guard step id is staleguard", /\n {8}id: staleguard\n/.test(guard));
  const added = `${stamp}\n${guard}\n${readFileSync(new URL("../lib/stale-sha-guard.mjs", import.meta.url), "utf8")}`;
  t("added guard text has no em or en dash", !/[\u2014\u2013]/.test(added));

  return fail;
}

if (basename(process.argv[1] || "") === "stale-sha-guard.suite.mjs") {
  const n = await run();
  if (n) process.exit(1);
  console.log("stale-sha guard ok");
}
