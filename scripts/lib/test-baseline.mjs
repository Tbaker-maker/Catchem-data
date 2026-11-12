// Pull request tests against main's own result. A PR is red only for a failing
// test that is not already failing on the base commit. Main's stale committed
// outputs (a missed nightly) then stop turning every PR red, while anything the
// PR breaks still blocks.
//
// Fail closed: no finished base log means no baseline, so every PR failure blocks.
import { parseLog, triage } from "./test-tiers.mjs";

/** One key per failing leaf test: "suite › test", or the suite name alone. */
export function failureKeys(failure) {
  const inner = failure.inner || [];
  return inner.length ? inner.map((name) => `${failure.name} › ${name}`) : [failure.name];
}

/**
 * prText: run-tests.mjs log of the PR. baseText: the same suite on the base commit.
 * Returns the PR's blocking failures split into new (blocks) and known (already red on base).
 */
export function compareToBase(prText, baseText) {
  const pr = triage(prText, "pr");
  const base = parseLog(baseText || "");
  const out = { prFinished: pr.finished, baseFinished: base.finished, fresh: [], known: [] };
  const baseKeys = new Set(base.finished ? base.failures.flatMap(failureKeys) : []);
  for (const failure of pr.blocked) {
    const keys = pr.finished ? failureKeys(failure) : ["the test runner stopped before its summary line"];
    for (const key of keys) (baseKeys.has(key) ? out.known : out.fresh).push(key);
  }
  return out;
}

export function describeBaseline(result) {
  const lines = [];
  if (!result.baseFinished) lines.push("No finished test log for the base commit, so every failure counts.");
  if (result.fresh.length) {
    lines.push(`New failures in this pull request (${result.fresh.length}):`);
    for (const key of result.fresh) lines.push(`- ${key}`);
  } else {
    lines.push("No new failures. Every failing test also fails on the base commit.");
  }
  if (result.known.length) {
    lines.push(`Already failing on the base commit, not this pull request (${result.known.length}):`);
    for (const key of result.known) lines.push(`- ${key}`);
  }
  return lines.join("\n");
}
