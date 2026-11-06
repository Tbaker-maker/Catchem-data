// A red Update sealed prices run opens one fix branch and one PR.
// The PR body is the failing test output. A later red run updates that PR.
// No-op outside GitHub Actions. The branch is origin/main plus one note file.
// It does not commit the job's price files.
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIX_TITLE, fixBody, fixPrAction } from "./lib/price-alarm.mjs";

const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

if (process.env.GITHUB_ACTIONS !== "true") {
  console.log("not on Actions, no fix branch");
  process.exit(0);
}

const run = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY || ""}/actions/runs/${process.env.GITHUB_RUN_ID || ""}`;
const tests = await readFile("/tmp/tests.log", "utf8").catch(() => "");
const body = fixBody({ runUrl: run, tests });

let open = [];
try {
  const listed = JSON.parse(gh("pr", "list", "--state", "open", "--limit", "20", "--search", `in:title "${FIX_TITLE}"`, "--json", "number,title,headRefName"));
  open = listed.filter((pr) => pr.title === FIX_TITLE).map((pr) => ({ number: pr.number, branch: pr.headRefName }));
} catch (err) {
  console.log(`::warning::could not list pull requests: ${String(err.message || err).split("\n")[0]}`);
  process.exit(0);
}

const action = fixPrAction(open);
if (action.action === "update") {
  try {
    gh("pr", "edit", String(action.number), "--body", body);
    gh("pr", "comment", String(action.number), "--body", body);
    console.log(`updated pull request #${action.number}`);
  } catch (err) {
    console.log(`::warning::fix branch not opened: ${String(err.message || err).split("\n")[0]}`);
  }
  process.exit(0);
}

const branch = `fix/sealed-prices-${process.env.GITHUB_RUN_ID || "run"}`;
const dir = await mkdtemp(join(tmpdir(), "price-fix-"));
try {
  git("fetch", "origin", "main");
  git("worktree", "add", "--detach", dir, "origin/main");
  const there = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  there("checkout", "-B", branch);
  there("config", "user.name", "catchem-bot");
  there("config", "user.email", "bot@catchem.app");
  await writeFile(join(dir, "data/derived/price-run-failure.txt"), `${body}\n`);
  there("add", "--", "data/derived/price-run-failure.txt");
  there("commit", "-m", "note: red sealed price run test output");
  there("push", "-u", "origin", branch);
  console.log(gh("pr", "create", "--base", "main", "--head", branch, "--title", FIX_TITLE, "--body", body).trim());
} catch (err) {
  console.log(`::warning::fix branch not opened: ${String(err.message || err).split("\n")[0]}`);
} finally {
  try { git("worktree", "remove", "--force", dir); } catch { /* the note is already pushed, or the worktree was never added */ }
}
