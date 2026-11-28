// After a public-data publish that pushed, GET the homepage and compare
// x-data-version to the sealed-prices day (data/sealed-prices.json updatedAt).
// Retry a few times across about 10 minutes. One alert if the header lags or
// is missing. No second publish, no git rollback, and the price job stays green.
// The alert uses label catchem-alert and fingerprint live-data-version.
// scripts/lib/alert.mjs is not on this branch; this file talks to gh directly.
import { execFileSync } from "node:child_process";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ATTEMPTS = 4;
export const GAP_MS = (10 * 60 * 1000) / (ATTEMPTS - 1);
export const ALERT_LABEL = "catchem-alert";
export const FINGERPRINT = "live-data-version";
export const HOMEPAGE = "https://catchemtcg.com/";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const USER_AGENT = "catchem-live-data-version/1";
const DEFAULT_REPO = "Tbaker-maker/Catchem-data";

export function sealedPriceDay(doc) {
  const raw = doc && typeof doc.updatedAt === "string" ? doc.updatedAt : "";
  const day = raw.slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function publishWasPushed(report) {
  if (!report || report.pushed !== true) return false;
  if (report.restored === true) return false;
  if (Array.isArray(report.problems) && report.problems.length > 0) return false;
  return true;
}

export function alertTitle() {
  return `Catch'em alert: ${FINGERPRINT}`;
}

export function alertBody({ header = "", publishedDay = "", attempts = ATTEMPTS } = {}) {
  const seen = header ? `x-data-version ${header}` : "no x-data-version header";
  const happened = header && header < publishedDay
    ? `The morning page header is ${seen}, behind the sealed-prices day ${publishedDay}.`
    : `The morning page header is ${seen}, not the sealed-prices day ${publishedDay}.`;
  return [
    `What happened: ${happened}`,
    "Impact: The morning page should show the day that was just published.",
    `What the system already did: Read https://catchemtcg.com/ ${attempts} times across about 10 minutes. The data commit stays. A lag is one alert, not a second publish.`,
    "Exact ask: Nothing needed",
    `Fingerprint: ${FINGERPRINT}`,
  ].join("\n");
}

// One issue for this fingerprint. Update or reopen it. Do not open a second one.
export function planAlert({
  issues = [],
  header = "",
  publishedDay = "",
  attempts = ATTEMPTS,
  repo = DEFAULT_REPO,
} = {}) {
  const title = alertTitle();
  const body = alertBody({ header, publishedDay, attempts });
  const exact = (issues || []).filter((issue) => issue && issue.title === title);
  const open = exact.find((issue) => String(issue.state || "").toUpperCase() === "OPEN");
  const closed = exact.find((issue) => String(issue.state || "").toUpperCase() !== "OPEN");
  if (open) {
    const id = String(open.number);
    return {
      action: "update",
      commands: [
        ["issue", "comment", id, "--repo", repo, "--body", body],
        ["issue", "edit", id, "--repo", repo, "--body", body, "--add-label", ALERT_LABEL],
      ],
    };
  }
  if (closed) {
    const id = String(closed.number);
    return {
      action: "reopen",
      commands: [
        ["issue", "comment", id, "--repo", repo, "--body", body],
        ["issue", "edit", id, "--repo", repo, "--body", body, "--add-label", ALERT_LABEL],
        ["issue", "reopen", id, "--repo", repo],
      ],
    };
  }
  return {
    action: "open",
    commands: [
      ["label", "create", ALERT_LABEL, "--repo", repo, "--description", "Catch'em deduped ops alert. Update, do not open a second one.", "--color", "B35900", "--force"],
      ["issue", "create", "--repo", repo, "--title", title, "--body", body, "--label", ALERT_LABEL],
    ],
  };
}

export async function readHeader(fetchImpl, url = HOMEPAGE) {
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
    signal: AbortSignal.timeout(20000),
  });
  const version = String(res?.headers?.get?.("x-data-version") || "").trim();
  if (res?.body?.cancel) {
    try { await res.body.cancel(); } catch { /* ignore unread body */ }
  }
  return DAY.test(version) ? version : "";
}

export async function runCheck({
  report,
  sealedDoc,
  fetchImpl,
  sleepImpl,
  alertImpl,
  attempts = ATTEMPTS,
  gapMs = GAP_MS,
  homepage = HOMEPAGE,
} = {}) {
  if (!publishWasPushed(report)) {
    return { ok: true, skipped: "not-pushed", matched: false, header: "", publishedDay: "", attempts: 0, alerts: 0 };
  }
  const publishedDay = sealedPriceDay(sealedDoc);
  if (!publishedDay) {
    return { ok: true, skipped: "no-sealed-day", matched: false, header: "", publishedDay: "", attempts: 0, alerts: 0 };
  }
  let header = "";
  let tries = 0;
  for (let i = 0; i < attempts; i += 1) {
    tries += 1;
    try {
      header = await readHeader(fetchImpl, homepage);
    } catch {
      header = "";
    }
    console.log(`live data version attempt ${tries}/${attempts}: header ${header || "missing"}, sealed-prices day ${publishedDay}`);
    if (header === publishedDay) {
      return { ok: true, skipped: "", matched: true, header, publishedDay, attempts: tries, alerts: 0 };
    }
    if (i < attempts - 1 && sleepImpl) await sleepImpl(gapMs);
  }
  if (alertImpl) await alertImpl({ header, publishedDay, attempts: tries });
  return { ok: true, skipped: "", matched: false, header, publishedDay, attempts: tries, alerts: alertImpl ? 1 : 0 };
}

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "" },
  });
}

function safeLine(err) {
  return String(err && err.message ? err.message : err)
    .split("\n")[0]
    .replace(/ghp_[A-Za-z0-9]+/g, "[redacted]")
    .replace(/github_pat_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 300);
}

export function listAlertIssues({ repo, title }) {
  const raw = gh([
    "issue", "list",
    "--repo", repo,
    "--state", "all",
    "--label", ALERT_LABEL,
    "--limit", "50",
    "--search", `in:title "${String(title || "").replace(/"/g, "")}"`,
    "--json", "number,title,state",
  ]);
  const rows = JSON.parse(raw || "[]");
  return rows.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
  }));
}

export async function raiseLiveDataAlert(info, { repo = DEFAULT_REPO, ghImpl = gh, listIssues = listAlertIssues } = {}) {
  let issues = [];
  try {
    issues = await listIssues({ repo, title: alertTitle() });
  } catch {
    issues = [];
  }
  const plan = planAlert({ ...info, issues, repo });
  for (const cmd of plan.commands) {
    try {
      ghImpl(cmd);
    } catch (err) {
      if (cmd[0] === "label") continue;
      throw err;
    }
  }
  return plan;
}

function readPublishReport(root) {
  try {
    return JSON.parse(readFileSync(join(root, "data/derived/publish-report.json"), "utf8"));
  } catch {
    return null;
  }
}

function readSealedUpdatedAt(root) {
  let fd;
  try {
    fd = openSync(join(root, "data/sealed-prices.json"), "r");
    const buf = Buffer.alloc(500);
    const n = readSync(fd, buf, 0, 500, 0);
    const text = buf.toString("utf8", 0, n);
    return text.match(/"updatedAt"\s*:\s*"([^"]*)"/)?.[1] || "";
  } catch {
    return "";
  } finally {
    if (fd != null) {
      try { closeSync(fd); } catch { /* ignore */ }
    }
  }
}

async function main() {
  const root = process.cwd();
  const report = readPublishReport(root);
  const updatedAt = readSealedUpdatedAt(root);
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO;
  const result = await runCheck({
    report,
    sealedDoc: { updatedAt },
    fetchImpl: globalThis.fetch,
    sleepImpl: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    alertImpl: async (info) => {
      if (process.env.GITHUB_ACTIONS !== "true" && process.env.LIVE_DATA_ALERT !== "true") {
        console.log("live data version: alert not sent (not in Actions)");
        return;
      }
      try {
        const plan = await raiseLiveDataAlert(info, { repo });
        console.log(`live data version alert ${plan.action}`);
      } catch (err) {
        console.log(`::warning::live data version alert not written: ${safeLine(err)}`);
      }
    },
  });
  if (result.skipped) {
    console.log(`live data version: check skipped (${result.skipped})`);
    return;
  }
  if (result.matched) {
    console.log(`live data version: header ${result.header} matches the sealed-prices day ${result.publishedDay}`);
    return;
  }
  console.error(`::error::live data version header ${result.header || "missing"} is not the sealed-prices day ${result.publishedDay}`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.log(`::warning::live data version check did not finish: ${safeLine(err)}`);
  }).then(() => {
    process.exit(0);
  });
}
