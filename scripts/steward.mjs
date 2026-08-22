// steward.mjs — keeps the work organised, saved, and on track.
//
// Every other agent watches the PRODUCT or the WORKERS. This one watches the
// WORK: is it saved, is it findable, and are the things we said we would do
// actually getting done.
//
// THE DEFINING CONSTRAINT (Tyler, 2026-08-23): "doesn't affect anything unless
// it needs to budge in because someone isn't doing their job." So it is SILENT
// by default. Most days it should say nothing at all, and a day where it says
// nothing is a day it did its job. An assistant who comments on everything is
// one you stop hearing, and then the day something genuinely slips, you have
// already learned to tune them out.
//
// It speaks only when:
//   - work exists that is not saved anywhere durable
//   - a commitment has sat past the point where it was still a plan
//   - the repo has drifted somewhere a future session will not find things
//   - a guard has been failing long enough that somebody has stopped noticing
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = async (...a) => { try { return (await run("git", a, { cwd: ROOT })).stdout.trim(); } catch { return ""; } };
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const speak = [];
const S = (kind, what, why, owner) => speak.push({ kind, what, why, owner });
const quiet = [];
const days = (iso) => Math.round((Date.now() - Date.parse(iso)) / 86400000);

// ── 1 · IS THE WORK SAVED? ─────────────────────────────────────────────────
{
  const dirty = (await git("status", "--porcelain")).split("\n").filter(Boolean);
  const sourceDirty = dirty.filter(l => /\.(mjs|jsx|md)$/.test(l) && !/research\/(pulse|audits)\//.test(l));
  if (sourceDirty.length)
    S("unsaved", `${sourceDirty.length} hand-written file(s) changed and not committed.`,
      "Generated artifacts churn constantly and that is fine. Hand-written work sitting uncommitted is a session's thinking one crash away from gone.", "chat");
  else quiet.push("everything hand-written is committed");

  const ahead = await git("rev-list", "--count", "@{u}..HEAD").catch(() => "0");
  if (Number(ahead) > 0)
    S("unsaved", `${ahead} commit(s) exist locally and are not pushed.`,
      "A commit on one machine is not a backup. The repo is only the record once it is somewhere else.", "chat");
}

// ── 2 · ARE COMMITMENTS BECOMING FICTION? ──────────────────────────────────
// A PENDING file is a promise. Promises have a shelf life, after which they are
// not plans any more — they are clutter that makes the real ones harder to see.
{
  const pend = (await readdir(join(ROOT, "research"))).filter(f => /^PENDING-/.test(f));
  for (const f of pend) {
    const last = await git("log", "-1", "--format=%ad", "--date=short", "--", `research/${f}`);
    if (!last) continue;
    const age = days(last);
    if (age >= 7)
      S("stale commitment", `${f} has sat untouched for ${age} days.`,
        "Either it still matters and somebody should do it, or it stopped mattering and it should be deleted. A pending file nobody closes teaches everyone to ignore pending files.", "tyler");
  }
  if (pend.length && !speak.some(s => s.kind === "stale commitment")) quiet.push(`${pend.length} open commitment(s), all recent`);
}

// ── 3 · IS ANYTHING FAILING QUIETLY FOR TOO LONG? ──────────────────────────
// A guard that fails every day becomes wallpaper. That is more dangerous than
// a guard that never existed, because the failure LOOKS handled.
{
  const sup = await J("research/pulse/agent-supervision.json");
  const persistent = (sup?.problems ?? []).length;
  if (persistent >= 3)
    S("ignored", `${persistent} supervisor problem(s) are open.`,
      "Problems that stay open stop being read. If they are not going to be fixed, they should be closed with a reason instead of carried.", "chat");

  const beat = await J("data/heartbeat.json");
  if (beat) {
    for (const [stage, rec] of Object.entries(beat)) {
      const age = rec?.at ? days(rec.at) : null;
      if (age != null && age >= 3)
        S("silent stage", `${stage} last reported ${age} days ago.`,
          "A stage that stopped running is invisible to every guard, because none of them run either. Silence is the one failure nothing else catches.", "cc");
    }
  }
}

// ── 4 · HAS THE REPO DRIFTED SOMEWHERE UNFINDABLE? ─────────────────────────
{
  const scripts = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
  const orphans = [];
  const all = (await Promise.all(scripts.map(f => readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "")))).join("\n");
  for (const f of scripts) {
    const base = f.replace(".mjs", "");
    const referenced = all.split("\n").some(l => l.includes(f) && !l.includes(`// ${f}`)) ;
    const isEntry = /^(fetch-|compute-|generate-|mint-|ingest-)/.test(base);
    if (!referenced && !isEntry) orphans.push(f);
  }
  if (orphans.length >= 3)
    S("drift", `${orphans.length} script(s) are not referenced anywhere: ${orphans.slice(0, 4).join(", ")}.`,
      "A script nothing calls is either dead or was wired up and quietly unwired. Both are worth knowing, and neither announces itself.", "chat");
  else quiet.push("no orphaned scripts");

  const outputs = (await readdir(join(ROOT, "research/pulse")).catch(() => [])).filter(f => f.endsWith(".json"));
  if (outputs.length > 40)
    S("drift", `${outputs.length} JSON files in research/pulse.`,
      "A directory nobody can scan is a directory where something goes missing without being noticed.", "chat");
}

// ── 5 · IS THE RECORD KEEPING UP WITH THE WORK? ────────────────────────────
{
  const commits = Number(await git("rev-list", "--count", "--since=3 days ago", "HEAD") || 0);
  const reports = (await readdir(join(ROOT, "research/reports")).catch(() => [])).length;
  const audits = (await readdir(join(ROOT, "research/audits")).catch(() => [])).length;
  if (commits > 60 && reports + audits < 8)
    S("thin record", `${commits} commits in three days against ${reports + audits} written records.`,
      "Commit messages are not a record — they say what changed, never why it was decided. A future session reads the reasoning or repeats the mistake.", "chat");
  else quiet.push(`${commits} commits / ${reports + audits} written records in the last few days`);
}

const out = { generatedAt: new Date().toISOString(),
  role: "Keeps the work organised, saved and on track. Silent unless something is genuinely slipping — a day with nothing to say is a day it did its job.",
  speaking: speak.length, speak, quiet };
await writeFile(join(ROOT, "research/pulse/steward-report.json"), JSON.stringify(out, null, 1));

if (!speak.length) {
  console.log(`✓ steward: nothing to raise — ${quiet.join(" · ")}`);
} else {
  console.log(`\n  Stepping in, because something is slipping:\n`);
  for (const s of speak) console.log(`  [${String(s.owner).padEnd(5)}] ${String(s.kind).padEnd(18)} ${s.what}`);
  console.log();
}
