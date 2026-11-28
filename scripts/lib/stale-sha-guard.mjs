// Skip public-data publish when another run already landed today's price commit.
import { appendFileSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const STAMP_NAME = "price-run-started-at";

export function priceCommitSubject(today) {
  return `Update sealed prices (${today})`;
}

// commits are { subject, committedAt }. A commit counts only when its subject
// is exactly today's price commit and its time is strictly after this run started.
export function decidePublish({ runStartedAt, today, commits }) {
  const start = Date.parse(String(runStartedAt || ""));
  const subject = priceCommitSubject(today);
  const list = Array.isArray(commits) ? commits : [];
  if (!today || !Number.isFinite(start)) {
    return {
      skip: false,
      reason: "Publishing because the run start or the day could not be read.",
    };
  }
  const newer = list.some((commit) => {
    if (!commit || commit.subject !== subject) return false;
    const at = Date.parse(String(commit.committedAt || ""));
    return Number.isFinite(at) && at > start;
  });
  if (newer) {
    return {
      skip: true,
      reason: `Skipping publish because a newer Update sealed prices (${today}) commit landed after this run started.`,
    };
  }
  return {
    skip: false,
    reason: `Publishing because no newer Update sealed prices (${today}) commit landed after this run started.`,
  };
}

// git log --format='%cI%x1f%s'
export function parseCommitLog(text) {
  const commits = [];
  for (const line of String(text || "").split("\n")) {
    const sep = line.indexOf("\u001f");
    if (sep < 0) continue;
    const committedAt = line.slice(0, sep).trim();
    const subject = line.slice(sep + 1).trim();
    if (!committedAt || !subject) continue;
    commits.push({ subject, committedAt });
  }
  return commits;
}

function readStamp() {
  const fromEnv = String(process.env.PRICE_RUN_STARTED_AT || "").trim();
  if (fromEnv) return fromEnv;
  const root = process.env.RUNNER_TEMP;
  if (!root) return "";
  try {
    return readFileSync(join(root, STAMP_NAME), "utf8").trim();
  } catch {
    return "";
  }
}

function writeSkip(skip) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  try {
    appendFileSync(out, `skip=${skip ? "true" : "false"}\n`);
  } catch {
    // The price job must still publish when the output file cannot be written.
  }
}

async function readStdin() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  try {
    const decision = decidePublish({
      runStartedAt: readStamp(),
      today: new Date().toISOString().slice(0, 10),
      commits: parseCommitLog(await readStdin()),
    });
    writeSkip(decision.skip);
    process.stdout.write(`${decision.reason}\n`);
  } catch {
    writeSkip(false);
    process.stdout.write("Publishing because the stale sha guard could not read main.\n");
  }
}

if (basename(process.argv[1] || "") === "stale-sha-guard.mjs") {
  await main();
}
