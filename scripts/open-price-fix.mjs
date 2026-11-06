// A red Update sealed prices run opens one fix branch and one PR.
// The PR body is the failing test output. A later red run updates that PR.
// No-op outside GitHub Actions. Does not change a price file.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
const branch = `fix/sealed-prices-${process.env.GITHUB_RUN_ID || "run"}`;
try {
  if (action.action === "update") {
    gh("pr", "edit", String(action.number), "--body", body);
    gh("pr", "comment", String(action.number), "--body", body);
    console.log(`updated pull request #${action.number}`);
    process.exit(0);
  }
  git("config", "user.name", "catchem-bot");
  git("config", "user.email", "bot@catchem.app");
  git("checkout", "-B", branch);
  git("reset", "-q");
  await mkdir("data/derived", { recursive: true });
  await writeFile("data/derived/price-run-failure.txt", `${body}\n`);
  git("add", "--", "data/derived/price-run-failure.txt");
  const staged = git("diff", "--cached", "--name-only").trim();
  if (staged) git("commit", "-m", "note: red sealed price run test output");
  git("push", "-u", "origin", branch);
  console.log(gh("pr", "create", "--base", "main", "--head", branch, "--title", FIX_TITLE, "--body", body).trim());
} catch (err) {
  console.log(`::warning::fix branch not opened: ${String(err.message || err).split("\n")[0]}`);
}
