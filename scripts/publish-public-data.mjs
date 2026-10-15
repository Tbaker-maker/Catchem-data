// Publish research/assets/public as one orphan commit on branch public-data.
// The branch is overwritten every night. It has no parents and no other history.
// Only refs/heads/public-data may be force-pushed. Main is not touched.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PUBLIC_PREFIX = "research/assets/public";
export const PUBLIC_BRANCH = "public-data";
const PUBLIC_REF = `refs/heads/${PUBLIC_BRANCH}`;

const AUTHOR = {
  GIT_AUTHOR_NAME: "catchem-bot",
  GIT_AUTHOR_EMAIL: "bot@catchem.app",
  GIT_COMMITTER_NAME: "catchem-bot",
  GIT_COMMITTER_EMAIL: "bot@catchem.app",
};

function git(cwd, args, input) {
  return execFileSync("git", args, {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, ...AUTHOR },
  }).trim();
}

function mktree(cwd, body) {
  return git(cwd, ["mktree"], body.endsWith("\n") ? body : `${body}\n`);
}

export function mainPublicFiles(cwd, rev = "HEAD") {
  const out = git(cwd, ["ls-tree", "-r", "--name-only", `${rev}:${PUBLIC_PREFIX}`]);
  return out ? out.split("\n").filter(Boolean).sort() : [];
}

export function branchPublicFiles(cwd, rev) {
  const out = git(cwd, ["ls-tree", "-r", "--name-only", rev]);
  return out ? out.split("\n").filter(Boolean).sort() : [];
}

// Wrap the existing public tree so paths stay research/assets/public/...
// Blobs are not copied. The commit has no parent.
export function buildPublicCommit(cwd, rev = "HEAD") {
  const pub = git(cwd, ["rev-parse", `${rev}:${PUBLIC_PREFIX}`]);
  const assets = mktree(cwd, `040000 tree ${pub}\tpublic`);
  const research = mktree(cwd, `040000 tree ${assets}\tassets`);
  const root = mktree(cwd, `040000 tree ${research}\tresearch`);
  const day = new Date().toISOString().slice(0, 10);
  return git(cwd, ["commit-tree", root, "-m", `public-data ${day}`]);
}

export function assertPublicData(cwd, sha, mainRev = "HEAD") {
  const meta = git(cwd, ["cat-file", "-p", sha]);
  if (meta.split("\n").some((line) => line.startsWith("parent "))) {
    throw new Error("public-data commit has a parent");
  }
  const count = Number(git(cwd, ["rev-list", "--count", sha]));
  if (count !== 1) throw new Error(`public-data has ${count} commits, expected 1`);
  const onMain = mainPublicFiles(cwd, mainRev).map((name) => `${PUBLIC_PREFIX}/${name}`);
  const onBranch = branchPublicFiles(cwd, sha);
  if (onMain.join("\n") !== onBranch.join("\n")) {
    throw new Error("public-data file list does not match main research/assets/public");
  }
  return true;
}

// Force-push this commit and nothing else. The ref is fixed.
export function pushPublicData(cwd, remote = "origin", rev = "HEAD") {
  const sha = buildPublicCommit(cwd, rev);
  assertPublicData(cwd, sha, rev);
  if (PUBLIC_REF !== "refs/heads/public-data") throw new Error("refused: wrong ref");
  git(cwd, ["push", "--force", remote, `${sha}:${PUBLIC_REF}`]);
  return sha;
}

function isMain() {
  const arg = process.argv[1] || "";
  return arg.endsWith("publish-public-data.mjs") || fileURLToPath(import.meta.url) === arg;
}

if (isMain()) {
  const cwd = process.cwd();
  if (!process.argv.includes("--push")) {
    const sha = buildPublicCommit(cwd);
    assertPublicData(cwd, sha);
    console.log(`public-data commit ${sha} (not pushed)`);
  } else {
    const sha = pushPublicData(cwd);
    console.log(`public-data ${sha}`);
  }
}
