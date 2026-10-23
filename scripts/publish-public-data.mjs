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

export function treeFiles(cwd, sha) {
  const out = git(cwd, ["ls-tree", "-r", "-l", sha]);
  const files = new Map();
  for (const line of out.split("\n").filter(Boolean)) {
    const [meta, path] = line.split("\t");
    const parts = meta.trim().split(/\s+/);
    const name = path.startsWith(`${PUBLIC_PREFIX}/`) ? path.slice(PUBLIC_PREFIX.length + 1) : path;
    files.set(name, { size: Number(parts[3]), blob: parts[2] });
  }
  return files;
}

export function readBlob(cwd, blob) {
  return git(cwd, ["cat-file", "-p", blob]);
}

// The tip before this push is kept on a fixed backup ref. Only these two refs move.
export const BACKUP_REF = "refs/heads/public-data-backup";

export function remoteTip(cwd, remote = "origin") {
  const out = git(cwd, ["ls-remote", remote, PUBLIC_REF]);
  return out.split(/\s+/)[0] || "";
}

export function restorePublicData(cwd, sha, remote = "origin") {
  if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("no backup tip to restore");
  git(cwd, ["push", "--force", remote, `${sha}:${PUBLIC_REF}`]);
}

export async function guardedPublish({ cwd, remote = "origin", today, cfg, smoke, live, wait, log = console.log }) {
  const { checkBuild } = await import("./lib/publish-checks.mjs");
  const sha = buildPublicCommit(cwd);
  assertPublicData(cwd, sha);
  const files = treeFiles(cwd, sha);
  for (const name of ["reads.json", "counts.json", "today.json", "movers.json"]) {
    const f = files.get(name);
    if (f && f.size > 0) f.text = readBlob(cwd, f.blob);
  }
  let backup = "";
  try { git(cwd, ["fetch", "-q", remote, `+${PUBLIC_REF}:refs/remotes/${remote}/${PUBLIC_BRANCH}`]); backup = git(cwd, ["rev-parse", `refs/remotes/${remote}/${PUBLIC_BRANCH}`]); } catch { backup = ""; }
  const before = backup ? [...treeFiles(cwd, backup).keys()] : null;
  const problems = checkBuild({ files, before, cfg, today });
  if (smoke) { const s = await smoke(); if (s) problems.push(s); }
  if (problems.length) return { pushed: false, sha, backup, problems };
  if (backup) git(cwd, ["push", "--force", remote, `${backup}:${BACKUP_REF}`]);
  if (PUBLIC_REF !== "refs/heads/public-data") throw new Error("refused: wrong ref");
  git(cwd, ["push", "--force", remote, `${sha}:${PUBLIC_REF}`]);
  log(`public-data ${sha} (backup ${backup || "none"})`);
  if (!live) return { pushed: true, sha, backup, problems: [] };
  if (wait) await wait();
  const asOf = JSON.parse(files.get("reads.json").text).asOf;
  const bad = await live({ sha, asOf });
  if (!bad.length) return { pushed: true, sha, backup, problems: [] };
  if (backup) restorePublicData(cwd, backup, remote);
  return { pushed: true, restored: Boolean(backup), sha, backup, problems: bad };
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
    const { loadChecks, checkLive } = await import("./lib/publish-checks.mjs");
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const cfg = await loadChecks(cwd);
    const smoke = async () => {
      try { execFileSync("node", ["scripts/smoke-test.mjs"], { cwd, stdio: "inherit" }); return ""; } catch { return "smoke test failed"; }
    };
    const out = await guardedPublish({
      cwd,
      today: new Date().toISOString().slice(0, 10),
      cfg,
      smoke,
      live: process.argv.includes("--no-live") ? null : (args) => checkLive(args),
      wait: cfg ? () => new Promise((r) => setTimeout(r, cfg.liveWaitSec * 1000)) : null,
    });
    mkdirSync("data/derived", { recursive: true });
    writeFileSync("data/derived/publish-report.json", `${JSON.stringify({ at: new Date().toISOString(), ...out }, null, 1)}\n`);
    if (out.problems.length) {
      const what = !out.pushed ? "public-data NOT pushed" : out.restored ? `public-data restored to ${out.backup}` : "public-data live check failed, no backup to restore";
      console.error(`${what}:\n- ${out.problems.join("\n- ")}`);
      process.exit(1);
    }
  }
}
