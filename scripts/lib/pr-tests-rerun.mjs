// When a workflow commits data with GITHUB_TOKEN, GitHub does not fire the
// push event, so pr-tests would not run on the new main tip. These helpers
// decide when a workflow_run completion should run pr-tests against main.

export const DATA_COMMIT_WORKFLOWS = [
  "Update sealed prices",
  "Listing counts",
  "BUILD1 hooks",
  "eBay link check",
  "Vintage listing sample",
  "PkmnPrices enrichment (sold comps, pop, EUR)",
  "daily-research",
  "Founder brief",
];

export function shouldRerunPrTests({ triggeringWorkflow, conclusion, headBranch } = {}) {
  if (!DATA_COMMIT_WORKFLOWS.includes(triggeringWorkflow)) {
    return { rerun: false, reason: "not-a-data-workflow" };
  }
  if (headBranch && headBranch !== "main") {
    return { rerun: false, reason: "not-main" };
  }
  if (conclusion === "cancelled" || conclusion === "skipped") {
    return { rerun: false, reason: conclusion };
  }
  if (conclusion === "success" || conclusion === "failure" || conclusion === "timed_out") {
    return { rerun: true, reason: "data-workflow-completed", checkoutRef: "main" };
  }
  return { rerun: false, reason: "unknown-conclusion" };
}

export function checkoutRefForEvent(eventName) {
  return eventName === "workflow_run" ? "main" : null;
}
