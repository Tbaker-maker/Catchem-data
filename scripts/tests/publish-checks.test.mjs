// Guarded public-data publish. Fixture limits only. The live limits stay in the private repo.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkBuild, checkLive, judgeTip, validChecks } from "../lib/publish-checks.mjs";
import { BACKUP_REF, guardedPublish } from "../publish-public-data.mjs";

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
t("one vanished file is allowed", checkBuild({ files: files(3), before: ["a", "reads.json"], cfg: CFG, today: DAY }).length === 0);

const CFG1 = validChecks({ maxDroppedFiles: 1, minReads: 2, maxReads: 9, maxAgeDays: 3, liveWaitSec: 0 });
t("with a 3-day limit, data from 3 days ago is accepted today", checkBuild({ files: files(3, "2026-10-20"), before: null, cfg: CFG1, today: "2026-10-23" }).length === 0);
t("with a 3-day limit, 4-day-old data is refused", checkBuild({ files: files(3, "2026-10-19"), before: null, cfg: CFG1, today: "2026-10-23" }).some((p) => /too old/.test(p)));
t("a run that slips one UTC day still accepts data that was in range at start", checkBuild({ files: files(3, "2026-10-19"), before: null, cfg: CFG1, today: "2026-10-23", runDay: "2026-10-22" }).length === 0);
t("a slipped run still refuses data older than the limit from the run start", checkBuild({ files: files(3, "2026-10-18"), before: null, cfg: CFG1, today: "2026-10-23", runDay: "2026-10-22" }).some((p) => /too old/.test(p)));
t("a run two UTC days late does not extend the window", checkBuild({ files: files(3, "2026-10-19"), before: null, cfg: CFG1, today: "2026-10-23", runDay: "2026-10-21" }).some((p) => /too old/.test(p)));
{
  const prev = process.env.CATCHEM_PUBLISH_DAY;
  process.env.CATCHEM_PUBLISH_DAY = "2026-10-22";
  try {
    t("CATCHEM_PUBLISH_DAY is used when runDay is omitted", checkBuild({ files: files(3, "2026-10-19"), before: null, cfg: CFG1, today: "2026-10-23" }).length === 0);
  } finally {
    if (prev == null) delete process.env.CATCHEM_PUBLISH_DAY;
    else process.env.CATCHEM_PUBLISH_DAY = prev;
  }
}


const fake = (tipSha, asOf, status = 200) => async (url) => {
  if (url.includes("api.github.com")) return { ok: true, json: async () => ({ commit: { sha: tipSha } }) };
  if (url.includes("raw.githubusercontent")) return { ok: true, json: async () => ({ asOf }) };
  return { status, text: async () => "x".repeat(3000) };
};
t("live check passes on a good site", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("a", DAY) })).length === 0);
t("live check fails on a wrong tip", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("b", DAY) })).length > 0);
t("live check fails on a down site", (await checkLive({ sha: "a", asOf: DAY, fetchImpl: fake("a", DAY, 500) })).length > 0);

// Run 43710618279: the branch API disagreed, then the restore push still
// named the pushed sha as the remote tip. git is that read. A bad API
// response must not be reported as a different tip when git matches.
const PUSHED = "3b5a34c85744e1eb1880c1788a6428a13a1d1169";
const STALE = "d6f9f32e8f2535726f2aa5f3918313eaae6c1272";
const apiDown = (tipSha, asOf, apiStatus) => async (url) => {
  if (url.includes("api.github.com")) return { ok: apiStatus === 200, status: apiStatus, json: async () => ({ commit: { sha: tipSha } }) };
  if (url.includes("raw.githubusercontent")) return { ok: true, json: async () => ({ asOf }) };
  return { status: 200, text: async () => "x".repeat(3000) };
};
t("judgeTip trusts git when the branch API is not ok", judgeTip({ pushed: PUSHED, httpOk: false, httpSha: "", gitSha: PUSHED }) === "");
t("judgeTip trusts git when the branch API is stale", judgeTip({ pushed: PUSHED, httpOk: true, httpSha: STALE, gitSha: PUSHED }) === "");
t("judgeTip fails when git and the API both show a different tip", judgeTip({ pushed: PUSHED, httpOk: true, httpSha: STALE, gitSha: STALE }) === "public-data tip is not the commit just pushed");
t("judgeTip does not pass an empty read", judgeTip({ pushed: PUSHED, httpOk: false, httpSha: "", gitSha: "" }) === "public-data tip could not be read");
t("live check does not call a stale API a wrong tip when git sees the push", (await checkLive({ sha: PUSHED, asOf: DAY, fetchImpl: apiDown(STALE, DAY, 200), remoteTip: async () => PUSHED })).every((p) => p !== "public-data tip is not the commit just pushed"));
t("live check still fails when git also sees a different tip", (await checkLive({ sha: PUSHED, asOf: DAY, fetchImpl: apiDown(STALE, DAY, 200), remoteTip: async () => STALE })).includes("public-data tip is not the commit just pushed"));

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

if (fail) { console.error(`publish checks: ${fail} failed`); process.exit(1); }
console.log("publish checks: all passed");
