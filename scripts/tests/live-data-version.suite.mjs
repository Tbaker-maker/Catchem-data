// After a publish that pushed, the homepage x-data-version header should be
// the sealed-prices day. Tests inject fetch and sleep. No real HTTP.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ATTEMPTS,
  GAP_MS,
  ALERT_LABEL,
  FINGERPRINT,
  planAlert,
  publishWasPushed,
  runCheck,
  sealedPriceDay,
} from "../check-live-data-version.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const DAY = "2026-11-27";
const TITLE = `Catch'em alert: ${FINGERPRINT}`;

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };

  t("the sealed-prices day is updatedAt", sealedPriceDay({ updatedAt: "2026-11-27T10:35:44.569Z" }) === DAY);
  t("a missing updatedAt is not invented", sealedPriceDay({ asOf: DAY }) === "" && sealedPriceDay(null) === "");
  t("retries span about 10 minutes", ATTEMPTS >= 3 && ATTEMPTS <= 6 && (ATTEMPTS - 1) * GAP_MS === 10 * 60 * 1000);

  t("a refused publish is not a pushed day", publishWasPushed({ pushed: false, problems: ["reads.json is missing"] }) === false);
  t("a restored publish is not the day we left up", publishWasPushed({ pushed: true, restored: true, problems: ["live"] }) === false);
  t("a clean push is the day to check", publishWasPushed({ pushed: true, problems: [] }) === true);

  async function probe({ header, report, sealed, throws = false }) {
    const calls = [];
    const slept = [];
    const alerts = [];
    const result = await runCheck({
      report: report === undefined ? { pushed: true, problems: [] } : report,
      sealedDoc: sealed === undefined ? { updatedAt: `${DAY}T10:35:44.569Z` } : sealed,
      fetchImpl: async (url, init) => {
        calls.push({ url, method: init && init.method });
        if (throws) throw new Error("down");
        const value = typeof header === "function" ? header(calls.length) : header;
        return {
          headers: { get: (name) => (name === "x-data-version" ? value : "") },
          body: { cancel: async () => {} },
        };
      },
      sleepImpl: async (ms) => { slept.push(ms); },
      alertImpl: async (info) => { alerts.push(info); },
    });
    return { result, calls, slept, alerts };
  }

  const match = await probe({ header: DAY });
  t("a matching header does not alert", match.alerts.length === 0 && match.result.matched === true && match.result.skipped === "");
  t("a match stops on the first try", match.calls.length === 1 && match.slept.length === 0);
  t("a match only GETs the homepage", match.calls[0].url === "https://catchemtcg.com/" && match.calls[0].method === "GET");

  const lag = await probe({ header: "2026-11-26" });
  t("a lagging header retries across the window", lag.calls.length === ATTEMPTS && lag.slept.length === ATTEMPTS - 1 && lag.slept.every((ms) => ms === GAP_MS));
  t("a lagging header alerts once", lag.alerts.length === 1 && lag.alerts[0].header === "2026-11-26" && lag.alerts[0].publishedDay === DAY && lag.result.alerts === 1);

  const missing = await probe({ header: "" });
  t("a missing header retries the same number of times", missing.calls.length === ATTEMPTS && missing.slept.length === ATTEMPTS - 1);
  t("a missing header alerts once", missing.alerts.length === 1 && missing.alerts[0].header === "" && missing.result.alerts === 1);

  const later = await probe({ header: (n) => (n < 2 ? "2026-11-26" : DAY) });
  t("a header that catches up does not alert", later.calls.length === 2 && later.slept.length === 1 && later.alerts.length === 0);

  const skipped = await probe({ header: DAY, report: { pushed: false, problems: ["not pushed"] } });
  t("a skipped publish does not fetch or alert", skipped.calls.length === 0 && skipped.alerts.length === 0 && skipped.result.skipped === "not-pushed");

  const noDay = await probe({ header: "", sealed: {} });
  t("no sealed-prices day means no alert", noDay.calls.length === 0 && noDay.alerts.length === 0 && noDay.result.skipped === "no-sealed-day");

  const openPlan = planAlert({
    issues: [{ number: 12, title: TITLE, state: "OPEN" }],
    header: "2026-11-26",
    publishedDay: DAY,
    attempts: ATTEMPTS,
    repo: "Tbaker-maker/Catchem-data",
  });
  t("an open alert is updated", openPlan.action === "update" && openPlan.commands.some((c) => c[0] === "issue" && c[1] === "edit" && c[2] === "12") && !openPlan.commands.some((c) => c[1] === "create"));
  t("the update keeps the label and the fingerprint", openPlan.commands.some((c) => c.includes(ALERT_LABEL)) && openPlan.commands.some((c) => c.includes(TITLE) || c.includes(FINGERPRINT) || c.some((part) => String(part).includes(FINGERPRINT))));

  const newPlan = planAlert({
    issues: [],
    header: "",
    publishedDay: DAY,
    attempts: ATTEMPTS,
    repo: "Tbaker-maker/Catchem-data",
  });
  t("the first alert opens one issue", newPlan.action === "open" && newPlan.commands.filter((c) => c[0] === "issue" && c[1] === "create").length === 1);
  t("the new issue uses the label and the fingerprint", newPlan.commands.some((c) => c[0] === "issue" && c.includes("--label") && c.includes(ALERT_LABEL) && c.includes("--title") && c.includes(TITLE)));

  const closedPlan = planAlert({
    issues: [{ number: 4, title: TITLE, state: "CLOSED" }],
    header: "2026-11-26",
    publishedDay: DAY,
    attempts: ATTEMPTS,
    repo: "Tbaker-maker/Catchem-data",
  });
  t("a closed alert is reopened, not duplicated", closedPlan.action === "reopen" && closedPlan.commands.some((c) => c[1] === "reopen" && c[2] === "4") && !closedPlan.commands.some((c) => c[1] === "create"));

  const wf = readFileSync(join(ROOT, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const steps = wf.split(/\n      - name: /);
  const publishAt = steps.findIndex((step) => step.startsWith("Publish the public-data branch"));
  const check = steps[publishAt + 1] || "";
  t("the live check is the step after publish", check.startsWith("Check the live data version"));
  t("the check runs only after a publish that succeeded", /steps\.publish\.outcome == 'success'/.test(check));
  t("the check does not publish again and does not roll back", !/publish-public-data/.test(check) && !/git push|restorePublicData|public-data-backup/.test(check));
  t("the check leaves the nightly green", /node scripts\/check-live-data-version\.mjs/.test(check) && !/continue-on-error/.test(check));

  const script = readFileSync(join(ROOT, "scripts/check-live-data-version.mjs"), "utf8");
  const added = script + readFileSync(fileURLToPath(import.meta.url), "utf8") + check;
  t("new copy has no em or en dash", !/[\u2014\u2013]/.test(added));
  t("the script exits 0 so a lag does not fail the job", /process\.exit\(0\)/.test(script) && !/process\.exit\(1\)/.test(script));
  t("the script does not call publish again", !/publish-public-data/.test(script));

  if (fail) console.error(`live data version ${fail} failed`);
  else console.log("live data version ok");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("live-data-version.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("live data version suite ok");
}
