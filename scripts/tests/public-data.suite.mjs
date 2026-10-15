// public-data is one orphan commit whose file list matches research/assets/public.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPublicData, buildPublicCommit, PUBLIC_BRANCH, pushPublicData } from "../publish-public-data.mjs";

const AUTHOR = {
  GIT_AUTHOR_NAME: "catchem-bot",
  GIT_AUTHOR_EMAIL: "bot@catchem.app",
  GIT_COMMITTER_NAME: "catchem-bot",
  GIT_COMMITTER_EMAIL: "bot@catchem.app",
};

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...AUTHOR } }).trim();
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pubdata-"));
  git(dir, ["init", "-b", "main"]);
  mkdirSync(join(dir, "research/assets/public/feed"), { recursive: true });
  writeFileSync(join(dir, "research/assets/public/reads.json"), "{}\n");
  writeFileSync(join(dir, "research/assets/public/feed/a.json"), "{\"n\":1}\n");
  writeFileSync(join(dir, "secret.txt"), "keep off the public branch\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "init"]);
  writeFileSync(join(dir, "research/assets/public/reads.json"), "{\"n\":2}\n");
  git(dir, ["add", "."]);
  git(dir, ["commit", "-m", "second"]);
  return dir;
}

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };

  const dir = initRepo();
  const sha = buildPublicCommit(dir);
  let matched = false;
  try { matched = assertPublicData(dir, sha); } catch (err) { t("orphan matches the public file list", false, err.message); }
  t("orphan matches the public file list", matched === true);
  const names = git(dir, ["ls-tree", "-r", "--name-only", sha]).split("\n").sort();
  t("same paths, and files outside public stay off", names.join("\n") === "research/assets/public/feed/a.json\nresearch/assets/public/reads.json");
  t("the commit has no parent", !git(dir, ["cat-file", "-p", sha]).split("\n").some((line) => line.startsWith("parent ")));
  t("rev-list count is one", git(dir, ["rev-list", "--count", sha]) === "1");

  const bare = mkdtempSync(join(tmpdir(), "pubbare-"));
  git(bare, ["init", "--bare", "-b", "main"]);
  git(dir, ["remote", "add", "origin", bare]);
  git(dir, ["push", "origin", "main"]);
  const pushed = pushPublicData(dir);
  t("push returns the branch tip", /^[0-9a-f]{40}$/.test(pushed) && git(bare, ["rev-parse", PUBLIC_BRANCH]) === pushed);
  t("the branch has exactly one commit", git(bare, ["rev-list", "--count", PUBLIC_BRANCH]) === "1");
  const remoteNames = git(bare, ["ls-tree", "-r", "--name-only", PUBLIC_BRANCH]).split("\n").sort().join("\n");
  t("the remote file list matches", remoteNames === names.join("\n"));
  t("main history is unchanged", git(bare, ["rev-list", "--count", "main"]) === "2");

  const root = join(fileURLToPath(new URL(".", import.meta.url)), "../..");
  const workflow = readFileSync(join(root, ".github/workflows/update-sealed-prices.yml"), "utf8");
  const stepAt = workflow.indexOf("node scripts/publish-public-data.mjs --push");
  const feedAt = workflow.indexOf('git commit -m "data: public feed');
  const gateAt = workflow.indexOf("node scripts/check-publish-writes.mjs");
  t("the nightly publishes public-data after the feed commit", stepAt > feedAt && stepAt < gateAt);
  const stepHead = workflow.slice(workflow.lastIndexOf("- name:", stepAt), stepAt);
  t("a failed publish fails the job", stepAt > 0 && !/continue-on-error/.test(stepHead));
  t("the script only names the public-data ref", readFileSync(join(root, "scripts/publish-public-data.mjs"), "utf8").includes('refs/heads/${PUBLIC_BRANCH}') && PUBLIC_BRANCH === "public-data");

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("public-data.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("public-data suite ok");
}
