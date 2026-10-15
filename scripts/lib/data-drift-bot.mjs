// Finds a file that no longer matches its builder and plans a fix PR.
// Opening the PR needs a token. Without one, the plan is returned and nothing is opened.

export function driftOf(path, expected, actual) {
  const left = JSON.stringify(expected);
  const right = JSON.stringify(actual);
  if (left === right) return null;
  return {
    path,
    reason: `${path} does not match the builder`,
    expected,
  };
}

export function planFix(drift) {
  const slug = String(drift.path || "file").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48);
  return {
    branch: `drift-${slug || "file"}`,
    title: `Restore ${drift.path}`,
    body: drift.reason,
    files: [{ path: drift.path, contents: JSON.stringify(drift.expected, null, 2) + "\n" }],
  };
}

export function openFixPr(plan, { token = "", run } = {}) {
  if (!token) return { opened: false, blocked: "no token" };
  if (!plan?.files?.length) return { opened: false, blocked: "nothing to write" };
  if (typeof run !== "function") return { opened: false, blocked: "no runner" };
  const wrote = run("write", plan);
  if (wrote && wrote.ok === false) return { opened: false, blocked: wrote.reason || "write failed" };
  const made = run("pr", plan);
  if (made && made.ok === false) return { opened: false, blocked: made.reason || "pr failed" };
  return { opened: true, url: made?.url || "", branch: plan.branch };
}
