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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/heartbeat.json");

// How long each stage may stay silent before it counts as a failure. Generous
// enough to survive one missed run, tight enough to catch a stopped cron.
const EXPECT_HOURS = {
  fetch: 30,          // daily 04:00 — 30h allows one late run without crying wolf
  derived: 30,
  pulse: 30,
  cards: 30,
  discord: 30,
  botAlive: 2,        // the bot should check in hourly once deployed
};

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
  const silent = [], healthy = [];
  for (const [stage, hours] of Object.entries(EXPECT_HOURS)) {
    const rec = hb[stage];
    if (!rec) { silent.push({ stage, ageHours: null, allowed: hours, note: "has never reported in" }); continue; }
    const age = (now - Date.parse(rec.at)) / 3600000;
    if (age > hours) silent.push({ stage, ageHours: Math.round(age), allowed: hours, lastSeen: rec.at });
    else healthy.push({ stage, ageHours: Math.round(age * 10) / 10 });
  }
  return { ok: silent.length === 0, silent, healthy };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const mode = process.argv[2];
  if (mode === "beat") { await beat(process.argv[3] || "manual"); console.log(`✓ heartbeat: ${process.argv[3]}`); }
  else {
    const r = await watch();
    // The voice rule applies here too — a watchdog that sounds like a siren
    // gets muted, and a muted watchdog is worse than none.
    if (r.ok) {
      console.log(`✓ heartbeat: everything has checked in — ${r.healthy.map(h => `${h.stage} ${h.ageHours}h ago`).join(", ")}`);
    } else {
      console.error(`\n✗ SOMETHING HAS GONE QUIET — ${r.silent.length} stage(s):`);
      for (const s of r.silent) console.error(`   ${s.stage}: ${s.ageHours == null ? s.note : `last seen ${s.ageHours}h ago, allowed ${s.allowed}h`}`);
      console.error("\n   Silence is the one failure no in-pipeline guard can catch, because none of them run.\n");
      process.exit(1);
    }
  }
}
