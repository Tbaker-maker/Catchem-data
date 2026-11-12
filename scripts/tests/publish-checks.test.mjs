// Guarded public-data publish. Fixture limits only. The live limits stay in the private repo.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBuild, checkLive, validChecks } from "../lib/publish-checks.mjs";
import { BACKUP_REF, guardedPublish, reviewedRemovals } from "../publish-public-data.mjs";

let fail = 0;
const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };
const ENV = { GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...ENV } }).trim();
const CFG = validChecks({ maxDroppedFiles: 1, minReads: 2, maxReads: 9, maxAgeDays: 2, liveWaitSec: 0 });
const DAY = "2026-10-23";

function files(reads, day = DAY, extra = {}) {
  const doc = (o) => { const text = JSON.stringify(o); return { size: text.length, text }; };
  const m = new Map([
    ["reads.json", doc({ asOf: day, reads: Array.from({ length: reads }, (_, i) => ({ id: i })) })],
    ["counts.json", doc({ asOf: day })], ["today.json", doc({ asOf: day })], ["movers.json", doc({ asOf: day })],
    ["signal-chips.json", { size: 5 }], ["releases.json", { size: 5 }],
  ]);
  for (const [k, v] of Object.entries(extra)) m.set(k, v);
  return m;
}

console.log("publish checks");
t("no limits means no push", checkBuild({ files: files(3), before: null, cfg: null, today: DAY }).length === 1);
t("a good build passes", checkBuild({ files: files(3), before: null, cfg: CFG, today: DAY }).length === 0);
t("an old day is refused", checkBuild({ files: files(3, "2026-10-19"), before: null, cfg: CFG, today: DAY }).some((p) => /too old/.test(p)));
t("too few reads is refused", checkBuild({ files: files(1), before: null, cfg: CFG, today: DAY }).some((p) => /reads/.test(p)));
t("an empty file is refused", checkBuild({ files: files(3, DAY, { "feed/x.json": { size: 0 } }), before: null, cfg: CFG, today: DAY }).some((p) => /empty/.test(p)));
const missing = files(3); missing.delete("counts.json");
t("a missing required file is refused", checkBuild({ files: missing, before: null, cfg: CFG, today: DAY }).some((p) => /counts.json is missing/.test(p)));
t("many vanished files are refused", checkBuild({ files: files(3), before: ["a", "b", "reads.json"], cfg: CFG, today: DAY }).some((p) => /disappear/.test(p)));
t("rotating read files may vanish", checkBuild({ files: files(3), before: ["feed/facts/a.json", "feed/facts/b.json", "feed/item-reads/03.json", "reads.json"], cfg: CFG, today: DAY }).length === 0);
t("rotating watch cool heat shards may vanish", checkBuild({ files: files(3), before: ["feed/watch/1.json", "feed/cool/4.json", "feed/heat/1.json", "reads.json"], cfg: CFG, today: DAY }).length === 0);
t("stable files still count when read files rotate", checkBuild({ files: files(3), before: ["feed/facts/a.json", "a", "b", "reads.json"], cfg: CFG, today: DAY }).some((p) => /2 files would disappear/.test(p)));
t("files a reviewed commit removed may vanish", checkBuild({ files: files(3), before: ["a", "b", "c", "reads.json"], cfg: CFG, today: DAY, removed: new Set(["a", "b", "c"]) }).length === 0);
t("other drops still count next to reviewed removals", checkBuild({ files: files(3), before: ["a", "b", "x", "y", "reads.json"], cfg: CFG, today: DAY, removed: new Set(["a", "b"]) }).some((p) => /2 files would disappear/.test(p)));
t("one vanished file is allowed", checkBuild({ files: files(3), before: ["a", "reads.json"], cfg: CFG, today: DAY }).length === 0);

const fake = (tipSha, asOf, status = 200) => async (url) => {
  if (url.includes("api.github.com")) return { ok: true, json: async () => ({ commit: { sha: tipSha } }) };
  if (url.includes("raw.githubusercontent")) return { ok: true, json: async () => ({ asOf }) };
  return { status, text: async () => "x".repeat(3000) };
};
t("live check passes on a good site", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("a", DAY) })).length === 0);
t("live check fails on a wrong tip", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("b", DAY) })).length > 0);
t("live check fails on a down site", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("a", DAY, 500) })).length > 0);

// Real git: a bare remote, an old public-data tip, then a guarded publish.
function repo(reads, day) {
  const bare = mkdtempSync(join(tmpdir(), "pubchk-bare-")); git(bare, ["init", "--bare", "-b", "main"]);
  const dir = mkdtempSync(join(tmpdir(), "pubchk-")); git(dir, ["init", "-b", "main"]); git(dir, ["remote", "add", "origin", bare]);
  const P = join(dir, "research/assets/public"); mkdirSync(P, { recursive: true });
  const w = (n, o) => writeFileSync(join(P, n), JSON.stringify(o));
  w("reads.json", { asOf: day, reads: Array.from({ length: reads }, (_, i) => ({ id: i })) });
  for (const n of ["counts.json", "today.json", "movers.json"]) w(n, { asOf: day });
  w("signal-chips.json", {}); w("releases.json", {});
  git(dir, ["add", "."]); git(dir, ["commit", "-qm", "c"]); git(dir, ["push", "-q", "origin", "main"]);
  const old = git(dir, ["commit-tree", git(dir, ["rev-parse", "HEAD^{tree}"]), "-m", "old public"]);
  git(dir, ["push", "-q", "origin", `${old}:refs/heads/public-data`]);
  return { dir, bare, old };
}

{
  const { dir, bare, old } = repo(3, DAY);
  const out = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => [], log: () => {} });
  t("a good build is pushed", out.pushed && git(bare, ["rev-parse", "public-data"]) === out.sha);
  t("the old tip is kept as the backup", git(bare, ["rev-parse", BACKUP_REF]) === old);
}
{
  const { dir, bare, old } = repo(1, DAY);
  const out = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => [], log: () => {} });
  t("a bad build is not pushed", !out.pushed && git(bare, ["rev-parse", "public-data"]) === old);
}
{
  const { dir, bare, old } = repo(3, DAY);
  const out = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "smoke test failed", live: async () => [], log: () => {} });
  t("a failed smoke test is not pushed", !out.pushed && git(bare, ["rev-parse", "public-data"]) === old);
}
{
  const { dir, bare, old } = repo(3, DAY);
  const out = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => ["catchemtcg.com/feed returned 500"], log: () => {} });
  t("a failed live check puts the backup back", out.restored && git(bare, ["rev-parse", "public-data"]) === old);
}

{
  // The tip is replaced by an orphan commit every night, so the second
  // publish must still find and keep the first one as the backup.
  const { dir, bare, old } = repo(3, DAY);
  const first = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => [], log: () => {} });
  writeFileSync(join(dir, "research/assets/public/extra.json"), "{}");
  git(dir, ["add", "."]); git(dir, ["commit", "-qm", "d"]);
  git(dir, ["update-ref", "refs/remotes/origin/public-data", old]); // a stale local copy of the branch
  const second = await guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => ["down"], log: () => {} });
  t("a second publish backs up the first one", second.backup === first.sha && git(bare, ["rev-parse", BACKUP_REF]) === first.sha);
  t("and a failed live check restores it", second.restored && git(bare, ["rev-parse", "public-data"]) === first.sha);
}

{
  // Reviewed removals: only a change GitHub committed to main for a pull request
  // (noreply@github.com) lets a file leave without counting. Everything else counts.
  const AS = (name, email) => ({ ...process.env, ...ENV, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email });
  const PR = AS("GitHub", "noreply@github.com");
  const BOT = AS("catchem-bot", "bot@catchem.app");
  const ACTIONS = AS("github-actions[bot]", "41898282+github-actions[bot]@users.noreply.github.com");
  const commitAs = (dir, env, msg, extra = []) => execFileSync("git", ["commit", "-qm", msg, ...extra], { cwd: dir, env });
  const PUB = "research/assets/public";
  const setup = (names = ["cut-a.png", "cut-b.png", "cut-c.png"]) => {
    const r = repo(3, DAY);
    const P = join(r.dir, PUB);
    for (const n of names) { mkdirSync(join(P, n, ".."), { recursive: true }); writeFileSync(join(P, n), "x"); }
    git(r.dir, ["add", "."]); git(r.dir, ["commit", "-qm", "cutouts"]);
    const tip = git(r.dir, ["commit-tree", git(r.dir, ["rev-parse", "HEAD^{tree}"]), "-m", "old public"]);
    git(r.dir, ["push", "-q", "-f", "origin", `${tip}:refs/heads/public-data`]);
    return { ...r, tip, rm: (...n) => git(r.dir, ["rm", "-q", ...n.map((x) => `${PUB}/${x}`)]) };
  };
  const sorted = (set) => [...set].sort().join(",");
  const publish = (dir) => guardedPublish({ cwd: dir, today: DAY, cfg: CFG, smoke: async () => "", live: async () => [], log: () => {} });
  {
    const { dir, bare, rm } = setup();
    rm("cut-a.png", "cut-b.png", "cut-c.png"); commitAs(dir, PR, "Remove old cutouts (#473)");
    t("a squash-merged PR delete is a reviewed removal", sorted(reviewedRemovals(dir)) === "cut-a.png,cut-b.png,cut-c.png");
    const out = await publish(dir);
    t("a reviewed removal does not block the publish", out.pushed && git(bare, ["rev-parse", "public-data"]) === out.sha);
  }
  for (const [who, env] of [["catchem-bot", BOT], ["github-actions[bot]", ACTIONS], ["a direct push by a person", ENV]]) {
    const { dir, bare, tip, rm } = setup();
    rm("cut-a.png", "cut-b.png", "cut-c.png"); commitAs(dir, { ...process.env, ...env }, "data: public feed");
    t(`a delete committed by ${who} is not a reviewed removal`, reviewedRemovals(dir).size === 0);
    const out = await publish(dir);
    t(`a delete by ${who} over the limit is still refused`, !out.pushed && out.problems.some((p) => /3 files would disappear/.test(p)) && git(bare, ["rev-parse", "public-data"]) === tip);
  }
  {
    // A bot commit inside a PR branch, merged with a merge commit through GitHub.
    const { dir, rm } = setup();
    git(dir, ["checkout", "-q", "-b", "pr"]);
    rm("cut-a.png"); commitAs(dir, BOT, "bot on the branch");
    git(dir, ["checkout", "-q", "main"]);
    writeFileSync(join(dir, PUB, "other.json"), "{}"); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "main moved"]);
    execFileSync("git", ["merge", "-q", "--no-ff", "-m", "Merge pull request #1", "pr"], { cwd: dir, env: PR });
    t("a bot delete inside a PR merged by GitHub is reviewed by that PR", sorted(reviewedRemovals(dir)) === "cut-a.png");
    git(dir, ["checkout", "-q", "-b", "side", "HEAD~1"]);
    t("a branch commit that never reached main is not seen", reviewedRemovals(dir, "main~1").size === 0);
  }
  {
    const { dir } = setup();
    git(dir, ["mv", `${PUB}/cut-a.png`, `${PUB}/cut-a-new.png`]); commitAs(dir, PR, "Rename (#2)");
    t("a renamed file's old name is a reviewed removal", sorted(reviewedRemovals(dir)) === "cut-a.png");
  }
  {
    const { dir, rm } = setup();
    rm("cut-a.png"); commitAs(dir, PR, "Remove (#3)");
    writeFileSync(join(dir, PUB, "cut-a.png"), "y"); git(dir, ["add", "."]); commitAs(dir, BOT, "bot re-adds");
    rm("cut-a.png"); commitAs(dir, BOT, "bot deletes again");
    t("the newest change decides: a later bot delete still counts", reviewedRemovals(dir).size === 0);
  }
  {
    const { dir, rm } = setup();
    rm("cut-a.png", "cut-b.png"); commitAs(dir, PR, "Remove (#4)");
    writeFileSync(join(dir, PUB, "cut-a.png"), "y"); git(dir, ["add", "."]); commitAs(dir, PR, "Bring one back (#5)");
    t("a file that is back on main is not a removal", sorted(reviewedRemovals(dir)) === "cut-b.png");
  }
  {
    const { dir, rm } = setup(["cutouts/a b.png", "cutouts/é.webp"]);
    rm("cutouts/a b.png", "cutouts/é.webp"); commitAs(dir, PR, "Remove odd names (#6)");
    t("spaces and accents in a name are read as is", sorted(reviewedRemovals(dir)) === ["cutouts/a b.png", "cutouts/é.webp"].sort().join(","));
  }
  {
    const { dir, rm } = setup();
    rm("cut-a.png"); commitAs(dir, PR, "Remove (#7)");
    writeFileSync(join(dir, PUB, "later.json"), "{}"); git(dir, ["add", "."]); git(dir, ["commit", "-qm", "later"]);
    const shallow = mkdtempSync(join(tmpdir(), "pubchk-shallow-"));
    git(shallow, ["clone", "-q", "--depth", "1", `file://${dir}`, "."]);
    t("a shallow clone that misses the delete allows nothing", reviewedRemovals(shallow).size === 0);
  }
  {
    // 3000 files removed by one PR, behind 150 other commits.
    const names = Array.from({ length: 3000 }, (_, i) => `cutouts/p${i}.png`);
    const { dir, rm } = setup(names);
    rm(...names.slice(0, 1500)); rm(...names.slice(1500)); commitAs(dir, PR, "Remove many (#8)");
    for (let i = 0; i < 150; i++) { writeFileSync(join(dir, PUB, "today.json"), JSON.stringify({ asOf: DAY, i })); git(dir, ["commit", "-qam", `n${i}`]); }
    const t0 = Date.now();
    const got = reviewedRemovals(dir);
    const ms = Date.now() - t0;
    t(`3000 removals behind 150 commits are found quickly (${ms} ms)`, got.size === 3000 && ms < 5000);
  }
  t("a git error gives no removals", reviewedRemovals(mkdtempSync(join(tmpdir(), "pubchk-none-"))).size === 0);
}

if (fail) { console.error(`publish checks: ${fail} failed`); process.exit(1); }
console.log("publish checks: all passed");
