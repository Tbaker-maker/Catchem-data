// heartbeat.mjs — PROOF OF LIFE, and the watchdog that notices its absence.
//
// Every guard we have runs INSIDE the pipeline. That means all of them share
// one blind spot: if the run never happens, not one of them fires. The stale
// edition breaker only catches stale data on a run that HAPPENS. A cron that
// silently stops is invisible to every check we own.
//
// Two halves:
//   BEAT   — each successful stage writes proof it completed, with a timestamp.
//   WATCH  — an independent check compares those timestamps to now, and shouts
//            when a stage has gone quiet. It must be able to run when the main
//            pipeline cannot, which is the entire point of separating them.
//
// Absence is the hardest failure to see and the easiest to build for. It only
// requires deciding, in advance, how long silence is allowed to last.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/heartbeat.json");

// How long each stage may stay silent before it counts as a failure. Generous
// enough to survive one missed run, tight enough to catch a stopped cron.
// The job's own schedule, so the check can ask whether a RUN happened rather
// than only how long it has been.
const SCHEDULED_UTC_HOUR = 4;

const EXPECT_HOURS = {
  fetch: 30,          // daily 04:00 — 30h allows one late run without crying wolf
  derived: 30,
  pulse: 30,
  cards: 30,
  discord: 30,
  botAlive: 2,        // the bot should check in hourly ONCE DEPLOYED
};

// Stages that legitimately have not started yet. Listed explicitly so the
// exemption is a decision somebody made, not a silence nobody noticed.
const PENDING = new Set(["botAlive"]);

export async function beat(stage, detail = {}) {
  let hb = {};
  try { hb = JSON.parse(await readFile(FILE, "utf-8")); } catch {}
  hb[stage] = { at: new Date().toISOString(), ...detail };
  await writeFile(FILE, JSON.stringify(hb, null, 1));
}

export async function watch() {
  let hb = {};
  try { hb = JSON.parse(await readFile(FILE, "utf-8")); } catch {
    return { ok: false, healthy: [],
      silent: Object.entries(EXPECT_HOURS).map(([stage, allowed]) => ({ stage, ageHours: null, allowed, note: "has never reported in" })) };
  }
  const now = Date.now();
  const silent = [], healthy = [], pending = [];
  for (const [stage, hours] of Object.entries(EXPECT_HOURS)) {
    const rec = hb[stage];
    // NOT-YET-DEPLOYED is not the same as GONE QUIET. botAlive is stamped by
    // catchem-bot, which is not deployed, so demanding an hourly check-in from
    // it made the watchdog red every single day — and a permanently red alarm
    // gets muted, which costs us the alarm. A stage in PENDING stays silent
    // until it reports ONCE; from then on the normal rule applies, because at
    // that point silence really does mean something stopped.
    if (!rec && PENDING.has(stage)) { pending.push(stage); continue; }
    if (!rec) { silent.push({ stage, ageHours: null, allowed: hours, note: "has never reported in" }); continue; }
    const age = (now - Date.parse(rec.at)) / 3600000;
    if (age > hours) silent.push({ stage, ageHours: Math.round(age), allowed: hours, lastSeen: rec.at });
    // MISSED RUNS, not elapsed hours. A daily 04:00 job whose last check-in
    // predates the most recent 04:00 has missed a scheduled run - true at hour
    // one, not at hour thirty. Elapsed time was the wrong question: it let a
    // skipped run hide inside a window designed to forgive a late one.
    else if (SCHEDULED_UTC_HOUR != null && stage !== "botAlive") {
      const now = new Date();
      const lastFire = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), SCHEDULED_UTC_HOUR, 0, 0));
      if (lastFire > now) lastFire.setUTCDate(lastFire.getUTCDate() - 1);
      // Grace: a run takes time and can start late. Only flag once the fire is
      // comfortably past, or a job still running would report as missed.
      const graceMs = 3 * 3600000;
      if (Date.parse(rec.at) < lastFire.getTime() && now - lastFire > graceMs)
        silent.push({ stage, ageHours: Math.round(age), allowed: hours, lastSeen: rec.at,
          note: `MISSED A SCHEDULED RUN — the ${SCHEDULED_UTC_HOUR}:00 UTC fire on ${lastFire.toISOString().slice(0, 10)} came and went without this stage checking in. Elapsed hours look fine; the run did not happen.` });
    }
    else healthy.push({ stage, ageHours: Math.round(age * 10) / 10 });
  }
  return { ok: silent.length === 0, silent, healthy, pending };
}

// pathToFileURL, not `file://${argv[1]}` — the template form never matches on
// Windows (drive letters, backslashes), so this whole block silently did
// nothing locally and the script exited 0 no matter how stale the stamps were.
// It works in CI, which is worse: the watchdog's sensor could not be tested on
// the machine where anyone would test it.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2];
  if (mode === "beat") { await beat(process.argv[3] || "manual"); console.log(`✓ heartbeat: ${process.argv[3]}`); }
  else {
    const r = await watch();
    // The voice rule applies here too — a watchdog that sounds like a siren
    // gets muted, and a muted watchdog is worse than none.
    if (r.ok) {
      console.log(`✓ heartbeat: everything has checked in — ${r.healthy.map(h => `${h.stage} ${h.ageHours}h ago`).join(", ")}`);
      if (r.pending?.length) console.log(`  (not deployed yet, not counted: ${r.pending.join(", ")})`);
    } else {
      console.error(`\n✗ SOMETHING HAS GONE QUIET — ${r.silent.length} stage(s):`);
      for (const s of r.silent) console.error(`   ${s.stage}: ${s.note ?? `last seen ${s.ageHours}h ago, allowed ${s.allowed}h`}`);
      console.error("\n   Silence is the one failure no in-pipeline guard can catch, because none of them run.\n");
      process.exit(1);
    }
  }
}
