// Run after a failed `git pull --rebase`. If the only conflicts are in
// data/derived/listing-counts/, merge both sides (scripts/lib/listing-counts-merge.mjs),
// stage them and continue the rebase. Any other conflict aborts the rebase and exits 1,
// so a push step never carries on from a half-rebased tree.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { mergeState, mergeLatest, mergeHistoryDay, mergeUsage } from "./lib/listing-counts-merge.mjs";

const DIR = "data/derived/listing-counts/";
const git = (args, opts = {}) => execFileSync("git", args, { encoding: opts.raw ? "buffer" : "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GIT_EDITOR: "true" }, maxBuffer: 1 << 30 });
const inRebase = () => existsSync(git(["rev-parse", "--git-path", "rebase-merge"]).trim()) || existsSync(git(["rev-parse", "--git-path", "rebase-apply"]).trim());
const abort = (why) => { console.error(`::error::${why}`); try { git(["rebase", "--abort"]); } catch {} process.exit(1); };

function resolveOnce() {
  const unmerged = git(["diff", "--name-only", "--diff-filter=U"]).split("\n").filter(Boolean);
  if (!unmerged.length) return false;
  const other = unmerged.filter((f) => !f.startsWith(DIR));
  if (other.length) abort(`rebase conflict outside listing counts: ${other.join(", ")}`);
  // During a rebase, stage :2: is main (upstream) and :3: is this run's commit.
  const side = (stage, file, raw = false) => { try { return git(["show", `:${stage}:${file}`], { raw }); } catch { return null; } };
  const json = (s) => (s == null ? {} : JSON.parse(s));
  const sA = json(side(2, `${DIR}state.json`) ?? git(["show", `HEAD:${DIR}state.json`]));
  const sB = json(side(3, `${DIR}state.json`) ?? side(2, `${DIR}state.json`));
  for (const file of unmerged) {
    const name = file.slice(DIR.length);
    let out;
    if (name === "state.json") out = JSON.stringify(mergeState(sA, sB)) + "\n";
    else if (name === "latest.json") out = JSON.stringify(mergeLatest(json(side(2, file)), json(side(3, file)), sA, sB)) + "\n";
    else if (name === "api-usage.json") out = JSON.stringify(mergeUsage(json(side(2, file)), json(side(3, file))), null, 1) + "\n";
    else if (/^history\/.+\.json\.gz$/.test(name)) {
      const gz = (b) => (b ? JSON.parse(gunzipSync(b)) : {});
      out = gzipSync(JSON.stringify(mergeHistoryDay(gz(side(2, file, true)), gz(side(3, file, true)), sA, sB)), { level: 9 });
    } else abort(`no merge rule for ${file}`);
    writeFileSync(file, out);
    git(["add", file]);
    console.log(`merged ${file}`);
  }
  return true;
}

for (let i = 0; i < 20; i++) {
  if (!resolveOnce()) break;
  try { git(["rebase", "--continue"]); console.log("rebase continued after merging listing counts"); break; }
  catch { /* the next commit may conflict too */ }
}
const left = git(["diff", "--name-only", "--diff-filter=U"]).trim();
if (left) abort(`unresolved conflicts remain: ${left}`);
if (inRebase()) abort("rebase still in progress after merging listing counts");
