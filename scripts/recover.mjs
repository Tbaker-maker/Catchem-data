// recover.mjs — GET BACK TO GOOD.
//
// We have seven layers that notice failure and none that fix it. Detection
// without recovery just means knowing precisely how broken you are at 2am.
//
// This restores the last state that passed every guard. It works because the
// repo IS the backup: every good run is a commit, so "last known good" is a
// real, findable point in history rather than a hopeful backup file.
//
// SAFE BY DESIGN: it never force-pushes, never rewrites history, and never
// touches source code — only regenerable artifacts. If it cannot verify the
// restore afterwards it says so rather than claiming success.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const git = async (...a) => (await run("git", a, { cwd: ROOT })).stdout.trim();
const node = async (s) => { try { const { stdout } = await run("node", [join(ROOT, "scripts", s)], { cwd: ROOT }); return { ok: true, out: stdout }; } catch (e) { return { ok: false, out: (e.stdout || "") + (e.stderr || "") }; } };

// Artifacts are regenerable. Source is not. Recovery only ever touches the first.
const ARTIFACTS = [
  "data/derived-insights.json", "data/sealed-prices.json", "data/divergence-report.json",
  "research/pulse/", "research/assets/",
];

const mode = process.argv[2] || "check";

if (mode === "check") {
  // What does a healthy system look like right now?
  const checks = [
    ["guards wired", await node("guard-audit.mjs")],
    ["flags registered", await node("flag-guard.mjs")],
    // Deliberately NOT part of the pass/fail set: a quiet stage means something
    // did not RUN, and restoring old artifacts cannot make a stopped cron start.
    // Reporting it as recoverable would send someone down the wrong path at 2am.
    ["publication safe", await node("publish-assert.mjs")],
  ];
  const beat = await node("heartbeat.mjs");
  const bad = checks.filter(([, r]) => !r.ok);
  for (const [name, r] of checks) console.log(`  ${r.ok ? "✓" : "✗"} ${name}`);
  if (!bad.length) { console.log("\n  Healthy. Nothing to recover."); process.exit(0); }
  console.log(`\n  ${bad.length} check(s) failing. Run \`node scripts/recover.mjs rollback\` to restore the last commit where everything passed.`);
  process.exit(1);
}

if (mode === "rollback") {
  // Walk back through history until we find a commit whose artifacts pass.
  const log = (await git("log", "--format=%H %ad %s", "--date=short", "-30")).split("\n");
  console.log(`  searching the last ${log.length} commits for one that passes every check...`);
  const dirty = await git("status", "--porcelain");
  if (dirty) {
    console.log("  stashing local changes first (nothing is discarded — `git stash pop` restores them)");
    await git("stash", "push", "-u", "-m", `recover.mjs ${new Date().toISOString()}`);
  }
  let restored = null;
  for (const line of log) {
    const [sha, date, ...msg] = line.split(" ");
    try {
      await git("checkout", sha, "--", ...ARTIFACTS);
    } catch { continue; }
    const assert = await node("publish-assert.mjs");
    const guards = await node("guard-audit.mjs");
    if (assert.ok && guards.ok) { restored = { sha, date, msg: msg.join(" ") }; break; }
  }
  if (!restored) {
    console.error("\n  ✗ No commit in the last 30 passed both checks. This is a source problem, not an artifact problem — recovery cannot fix it and should not pretend to.\n");
    process.exit(1);
  }
  console.log(`\n  ✓ artifacts restored from ${restored.sha.slice(0, 8)} (${restored.date})`);
  console.log(`    "${restored.msg.slice(0, 70)}"`);
  console.log(`\n  Nothing has been committed or pushed. Review with \`git diff\`, then commit if it looks right.`);
  console.log(`  Source code was NOT touched — if the fault is in a script, this will not have fixed it.`);
  process.exit(0);
}

if (mode === "regenerate") {
  // Often the right fix: rebuild every artifact from the current source.
  console.log("  rebuilding every artifact from current source...");
  for (const s of ["compute-divergence.mjs", "compute-derived.mjs", "generate-pulse.mjs"]) {
    const r = await node(s);
    console.log(`  ${r.ok ? "✓" : "✗"} ${s}`);
    if (!r.ok) { console.error(`\n  stopped: ${s} failed. Fix the source before regenerating.\n${r.out.slice(-400)}`); process.exit(1); }
  }
  const assert = await node("publish-assert.mjs");
  console.log(`  ${assert.ok ? "✓" : "✗"} publication assert`);
  process.exit(assert.ok ? 0 : 1);
}

console.log("usage: node scripts/recover.mjs [check|rollback|regenerate]");
