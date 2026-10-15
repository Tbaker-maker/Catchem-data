// If main's tests go red after a data commit, restore that commit's data files
// from the parent and open a PR. Does not push to main.
import { spawn } from "node:child_process";
import { healPlan } from "./lib/ops-bots.mjs";

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (b) => { out += b; });
    child.stderr.on("data", (b) => { err += b; });
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

const sha = process.env.HEAL_SHA || process.argv[2] || "HEAD";
if (!process.argv.includes("--live") && !process.env.HEAL_SHA && process.argv.length <= 2) {
  console.log(JSON.stringify({ selfHeal: { action: "skipped", reason: "pass a commit sha or --live" } }));
  process.exit(0);
}
const diff = await run("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", sha]);
const files = diff.out.split("\n").map((s) => s.trim()).filter(Boolean);
// The failed steps' log decides which files are suspects. No log, no restore:
// guessing would undo good data (see #288).
let failLog = "";
if (process.env.HEAL_RUN_ID) failLog = (await run("gh", ["run", "view", process.env.HEAL_RUN_ID, "--log-failed"])).out;
const plan = healPlan(files, failLog);
console.log(JSON.stringify({ selfHeal: plan }));
if (plan.action !== "restore" || !process.argv.includes("--live")) process.exit(0);
// A merged PR (subject ends "(#123)") is a reviewed change, not a bad nightly data
// write. Restoring its files would undo a deliberate fix, so only heal bot commits.
const subject = (await run("git", ["log", "-1", "--format=%s", sha])).out.trim();
if (/\(#\d+\)\s*$/.test(subject)) {
  console.log(JSON.stringify({ selfHeal: { action: "skipped", reason: "red commit is a merged PR, not a data write" } }));
  process.exit(0);
}
// One branch per red commit, so a second run the same day neither collides nor
// opens a duplicate PR.
const fullSha = (await run("git", ["rev-parse", sha])).out.trim();
const branch = `heal-${new Date().toISOString().slice(0, 10)}-${fullSha.slice(0, 7)}`;
const exists = await run("git", ["ls-remote", "--exit-code", "--heads", "origin", branch]);
if (exists.code === 0) {
  console.log(JSON.stringify({ selfHeal: { action: "skipped", reason: `${branch} already open` } }));
  process.exit(0);
}
const co = await run("git", ["checkout", "-B", branch, "main"]);
if (co.code !== 0) { console.error(co.err); process.exit(1); }
const restore = await run("git", ["checkout", `${sha}^`, "--", ...plan.files]);
if (restore.code !== 0) { console.error(restore.err); process.exit(1); }
await run("git", ["add", "--", ...plan.files]);
await run("git", ["-c", "user.name=catchem-bot", "-c", "user.email=bot@catchem.app", "commit", "-m", `Restore data files from the red commit\n\n${plan.reason}`]);
const push = await run("git", ["push", "-u", "origin", branch]);
if (push.code !== 0) { console.error(push.err); process.exit(1); }
const pr = await run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", "Restore data files after a red test run", "--body", plan.files.map((f) => `- ${f}`).join("\n")]);
console.log(pr.out || pr.err);
process.exit(pr.code === 0 ? 0 : 1);
