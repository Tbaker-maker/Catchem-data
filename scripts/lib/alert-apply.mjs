// Applies an alert decision through gh. Never throws out to the caller.
import { execFileSync } from "node:child_process";
import {
  ALERT_LABEL, ASSIGNEE, alertBody, alertRepo, decideAlertAction, sevLabel,
} from "./alert.mjs";

function runGh(repo, args, token) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "" },
  });
}

export function listAlertIssues({ repo, title, token }) {
  try {
    const raw = runGh(repo, [
      "issue", "list",
      "--repo", repo,
      "--state", "all",
      "--label", ALERT_LABEL,
      "--limit", "50",
      "--search", `in:title "${title.replace(/"/g, '\\"')}"`,
      "--json", "number,title,state,labels",
    ], token);
    const rows = JSON.parse(raw || "[]");
    return rows.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: (i.labels || []).map((l) => (typeof l === "string" ? l : l.name)),
    }));
  } catch {
    return [];
  }
}

function ensureLabel(repo, token) {
  try {
    runGh(repo, ["label", "create", ALERT_LABEL, "--repo", repo, "--description", "Catch'em deduped ops alert. Update, do not open a second one.", "--color", "B35900", "--force"], token);
  } catch {
    // Label may already exist; create with --force updates it. A failure is ignored.
  }
}

export async function applyAlert({
  fingerprint, severity = "P2", happened, impact, alreadyDid, ask, fixed = false, needsYes = false,
  privateToken, publicToken, gh = null,
} = {}) {
  const dest = alertRepo({ privateToken });
  const token = dest.repo.includes("private") ? (privateToken || publicToken) : (publicToken || privateToken);
  const body = alertBody({ happened, impact, alreadyDid, ask });
  const title = `Catch'em alert: ${fingerprint}`;
  const issues = gh
    ? await Promise.resolve(gh.list({ repo: dest.repo, title }))
    : listAlertIssues({ repo: dest.repo, title, token });
  const decision = decideAlertAction({ issues, fingerprint, severity, needsYes, fixed });
  const labels = `${ALERT_LABEL},${sevLabel(severity)}`;

  const doGh = (args) => {
    if (gh) return gh.run(args);
    return runGh(dest.repo, args, token);
  };

  try {
    if (decision.action === "none") return { ...decision, repo: dest.repo };
    ensureLabel(dest.repo, token);
    if (decision.action === "open") {
      const created = doGh([
        "issue", "create",
        "--repo", dest.repo,
        "--title", decision.title,
        "--body", body,
        "--label", ALERT_LABEL,
        "--label", sevLabel(severity),
      ]);
      if (decision.assign) {
        const num = String(created || "").match(/\/issues\/(\d+)/)?.[1];
        if (num) doGh(["issue", "edit", num, "--repo", dest.repo, "--add-assignee", ASSIGNEE]);
      }
      return { ...decision, repo: dest.repo, created: String(created || "").trim() };
    }
    const id = String(decision.number);
    if (decision.action === "update" || decision.action === "reopen") {
      doGh(["issue", "edit", id, "--repo", dest.repo, "--body", body, "--add-label", labels]);
      if (decision.comment) doGh(["issue", "comment", id, "--repo", dest.repo, "--body", body]);
      if (decision.action === "reopen") doGh(["issue", "reopen", id, "--repo", dest.repo]);
      if (decision.assign) doGh(["issue", "edit", id, "--repo", dest.repo, "--add-assignee", ASSIGNEE]);
      return { ...decision, repo: dest.repo };
    }
    if (decision.action === "close") {
      if (decision.comment) doGh(["issue", "comment", id, "--repo", dest.repo, "--body", body]);
      doGh(["issue", "close", id, "--repo", dest.repo, "--comment", body]);
      if (decision.assign) doGh(["issue", "edit", id, "--repo", dest.repo, "--add-assignee", ASSIGNEE]);
      return { ...decision, repo: dest.repo };
    }
  } catch (err) {
    console.log(`::warning::alert not written: ${String(err.message || err).split("\n")[0]}`);
    return { ...decision, repo: dest.repo, error: String(err.message || err).split("\n")[0] };
  }
  return { ...decision, repo: dest.repo };
}

export async function applyAlertFromEnv(fields) {
  if (process.env.GITHUB_ACTIONS !== "true" && process.env.CATCHEM_ALERT_LIVE !== "true") {
    return { action: "dry", reason: "not-in-actions" };
  }
  const publicToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const privateToken = process.env.PRIVATE_DATA_TOKEN || "";
  try {
    return await applyAlert({ ...fields, publicToken, privateToken });
  } catch (err) {
    console.log(`::warning::alert not written: ${String(err.message || err).split("\n")[0]}`);
    return { action: "error" };
  }
}
