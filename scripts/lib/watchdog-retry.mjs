// Whether the watchdog may dispatch update-sealed-prices.yml.
// An active nightly is queued, waiting, pending, or in progress.
// A recovery attempt is recorded only after a dispatch succeeds.
// The 20 hour retry limit stays in the workflow. This file does not change it.

export const ACTIVE_STATUSES = ["queued", "waiting", "pending", "in_progress"];
export const WORKFLOW_FILE = "update-sealed-prices.yml";

export function activeRuns(runs) {
  const out = [];
  for (const run of runs || []) {
    const status = String(run?.status || "").toLowerCase();
    if (ACTIVE_STATUSES.includes(status)) out.push({ id: run.id ?? null, status });
  }
  return out;
}

// alreadyRetried is the existing 20 hour limit. check.ok false means the
// run list could not be read, so we do not dispatch and we do not record.
export function decideDispatch({ alreadyRetried, check }) {
  if (alreadyRetried === true) return { dispatch: false, record: false, reason: "already-retried" };
  if (!check || check.ok !== true) return { dispatch: false, record: false, reason: "check-failed" };
  if (activeRuns(check.runs).length) return { dispatch: false, record: false, reason: "active-run" };
  return { dispatch: true, record: false, reason: "idle" };
}

// Call this only with the result of the dispatch call. A skip is not a success.
export function recordAfterDispatch(dispatched) {
  if (dispatched === true) return { record: true, reason: "dispatched" };
  return { record: false, reason: "dispatch-failed" };
}

export async function listActiveRuns({ owner, repo, token, fetchImpl = globalThis.fetch, workflow = WORKFLOW_FILE }) {
  if (!owner || !repo || !token) return { ok: false, runs: [], reason: "check-failed" };
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "catchem-watchdog",
  };
  const runs = [];
  for (const status of ACTIVE_STATUSES) {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?status=${status}&per_page=5`;
    let res;
    try {
      res = await fetchImpl(url, { headers });
    } catch {
      return { ok: false, runs: [], reason: "check-failed" };
    }
    if (res.status === 422 && status === "pending") continue;
    if (!res.ok) return { ok: false, runs: [], reason: "check-failed" };
    let doc = {};
    try { doc = await res.json(); } catch { return { ok: false, runs: [], reason: "check-failed" }; }
    const listed = Array.isArray(doc.workflow_runs) ? doc.workflow_runs : [];
    if ((Number(doc.total_count) || 0) > 0 && listed.length === 0) runs.push({ id: null, status });
    for (const run of listed) runs.push({ id: run.id ?? null, status: run.status || status });
  }
  return { ok: true, runs, reason: "" };
}
