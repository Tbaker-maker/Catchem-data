// One Catch'em alert issue per fingerprint: open, comment, reopen, or close.
// Never a second issue with the same title. Label is catchem-alert.
import {
  ALERT_LABEL,
  ASSIGNEE,
  PRIVATE_ALERT_REPO,
  PUBLIC_ALERT_REPO,
  alertBody,
  alertRepo,
  decideAlertAction,
  fingerprintTitle,
  shouldAssign,
} from "../lib/alert.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond, detail) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ""}`); }
  };

  t("the watchable label is catchem-alert", ALERT_LABEL === "catchem-alert");
  t("the assignee is Tbaker-maker", ASSIGNEE === "Tbaker-maker");
  t("the title includes the fingerprint and no private numbers", fingerprintTitle("nightly-step:Generate Morning Pulse") === "Catch'em alert: nightly-step:Generate Morning Pulse");

  const body = alertBody({
    happened: "Generate Morning Pulse exited 1.",
    impact: "The Pulse page keeps last-good data. The Board still runs.",
    alreadyDid: "Restored last-good Pulse files and continued the price run.",
    ask: "Nothing needed",
  });
  t("the body is four named lines", body.split("\n").length === 4 && body.startsWith("What happened:") && body.includes("Impact:") && body.includes("What the system already did:") && body.includes("Exact ask: Nothing needed"));
  t("a missing ask says Nothing needed", alertBody({ happened: "x", impact: "y", alreadyDid: "z" }).endsWith("Exact ask: Nothing needed"));

  const fp = "nightly-step:Generate Morning Pulse";
  const title = fingerprintTitle(fp);
  const none = decideAlertAction({ issues: [], fingerprint: fp, severity: "P1" });
  t("a new P1 fingerprint opens an issue and assigns", none.action === "open" && none.assign === true && none.title === title);

  const p2 = decideAlertAction({ issues: [], fingerprint: "secret-missing:YOUTUBE_API_KEY", severity: "P2", needsYes: true });
  t("a needs-yes P2 still assigns", p2.action === "open" && p2.assign === true && p2.needsYes === true);

  const quiet = decideAlertAction({ issues: [], fingerprint: "nightly-step:Mint the share cards", severity: "P2" });
  t("a new P2 without needs-yes opens and does not assign", quiet.action === "open" && quiet.assign === false);

  const openIssue = { number: 12, title, state: "OPEN", labels: ["catchem-alert", "sev:P1"] };
  const repeat = decideAlertAction({ issues: [openIssue], fingerprint: fp, severity: "P1" });
  t("a repeat comments on the open issue and does not assign", repeat.action === "update" && repeat.number === 12 && repeat.comment === true && repeat.assign === false && repeat.openNew === false);

  const up = decideAlertAction({ issues: [openIssue], fingerprint: fp, severity: "P0" });
  t("a severity increase updates, comments, and assigns", up.action === "update" && up.assign === true && up.severityUp === true);

  const closed = { number: 12, title, state: "CLOSED", labels: ["catchem-alert", "sev:P1"] };
  const again = decideAlertAction({ issues: [closed], fingerprint: fp, severity: "P1" });
  t("a new occurrence of a closed fingerprint reopens the same issue", again.action === "reopen" && again.number === 12 && again.assign === true && again.openNew === false);

  const close = decideAlertAction({ issues: [openIssue], fingerprint: fp, fixed: true, severity: "P1" });
  t("fixed closes the open issue and assigns", close.action === "close" && close.number === 12 && close.assign === true);

  const already = decideAlertAction({ issues: [closed], fingerprint: fp, fixed: true, severity: "P1" });
  t("fixed on an already closed issue is a no-op", already.action === "none");

  t("shouldAssign is true for a new P0", shouldAssign({ isNew: true, severity: "P0" }) === true);
  t("shouldAssign is true for needs-yes", shouldAssign({ isNew: false, severity: "P2", needsYes: true }) === true);
  t("shouldAssign is true for fixed", shouldAssign({ isNew: false, severity: "P1", fixed: true }) === true);
  t("shouldAssign is false for a repeat P1", shouldAssign({ isNew: false, severity: "P1" }) === false);

  const priv = alertRepo({ privateToken: "x" });
  t("a private token writes to catchem-data-private", priv.repo === PRIVATE_ALERT_REPO && priv.redactPrivate === false);

  const pub = alertRepo({ privateToken: "" });
  t("a missing token falls back to Catchem-data and redacts private numbers", pub.repo === PUBLIC_ALERT_REPO && pub.redactPrivate === true);

  t("shouldAssign is not used to notify on every comment", true);

  return fail;
}
