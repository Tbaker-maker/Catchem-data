// outcome-report.mjs — what the outcome log can and cannot tell us.
//
// This exists because the log had started producing rankings. A table of five
// posts sorted by views reads as a finding, and this week we had to withdraw a
// law that was built exactly that way: one post, read at two different ages,
// became a 122x claim about posting hours, then a law about hours, then a
// citation in later sessions. The numbers were real. The comparison was not.
//
// SO THE ORDER OF THIS REPORT IS THE POINT. It leads with what is NOT
// comparable and only reaches comparison if the data earns it. A report that
// opens with a ranking implies a confidence this data does not have, and the
// reader takes the ranking away regardless of the caveats underneath it.
//
// IT HONOURS THE EQUAL-AGE RULE RATHER THAN ROUTING AROUND IT. Every
// cross-post comparison goes through assertComparable() from lib/timestamp.mjs
// — the same guard verify-work.mjs enforces. If a comparison would break it,
// this script does not print a softened version of it. It prints nothing.
//
// ADVISORY, NEVER BLOCKING. It reports; it does not stop a build.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertComparable, TimestampError } from "./lib/timestamp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same checkpoints read-metrics.mjs files against. 48h is the settled reading.
const SETTLED_AT = 48;
// The 1h floor. A reading taken in the first hour is measuring how fast the
// page loaded, not how the post did — two of ours were taken at 1.7 minutes
// and at MINUS 3.6 minutes, the second being a reading timestamped before its
// own post existed.
const FLOOR_HOURS = 1;

const posts = JSON.parse(await readFile(join(ROOT, "data/post-outcomes.json"), "utf-8")).posts ?? [];
const now = Date.now();

// ── THE DERIVED METRIC, COMPUTED AND NEVER STORED ──────────────────────────
// Conversation density and reach are different axes. The Charmander crop took
// 14 replies on 791 views; the Arita pairing took 34 on 127,200 — the same
// order of replies against 160x the audience. A log that surfaces only views
// cannot see that, and the two numbers imply opposite content strategies: the
// rewards threshold is counted in qualified impressions, and community trust
// is built in replies.
//
// IT IS COMPUTED AT READ TIME, DELIBERATELY. A stored ratio is a third number
// that can disagree with the two it came from, and this repo has already spent
// a week on a number that drifted from its source.
const rp1k = (m) => (m.views > 0 ? (m.replies ?? 0) / m.views * 1000 : null);
const fmt = (n, d = 0) => n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pad = (s, n) => String(s).padEnd(n);

// Shape family: the part before the em dash. The full shape strings are
// per-post descriptions ("art crop — single card, mood hook"), so comparing on
// them exactly would guarantee every family has n=1 and the script would
// always claim it could not compare — which is the right answer for the wrong
// reason, and would keep being the right answer after the data improved.
const family = (s) => String(s ?? "unlabelled").split("—")[0].trim().toLowerCase();

const usable = (m) => m.atHours != null && m.atHours >= FLOOR_HOURS;
const settledOf = (p) => (p.metrics ?? []).find(m => m.checkpoint === SETTLED_AT && usable(m));

const settled = [], pending = [], unmeasured = [];
for (const p of posts) {
  const ms = p.metrics ?? [];
  const s = settledOf(p);
  if (s) { settled.push({ p, m: s }); continue; }
  const good = ms.filter(usable);
  if (good.length) { pending.push({ p, m: good[good.length - 1] }); continue; }
  unmeasured.push({ p, ms });
}

const L = [];
const say = (s = "") => L.push(s);

// ── THE HEADLINE ───────────────────────────────────────────────────────────
// Stated first and without hedging. If the answer is that we cannot conclude
// anything, that IS the finding, and burying it under a table would be the
// same failure this report was built to stop.
say("");
say("OUTCOME REPORT — " + new Date().toISOString().slice(0, 10));
say("=".repeat(72));
if (settled.length < 2) {
  say("");
  say("  HEADLINE: " + settled.length + " post" + (settled.length === 1 ? " has" : "s have") +
      " a settled 48h reading. That is not enough to conclude");
  say("  anything about what works. No shape, hour, length or format claim in this");
  say("  repo is supported by this log yet.");
  say("");
  say("  " + posts.length + " posts logged · " + settled.length + " settled · " +
      pending.length + " pending · " + unmeasured.length + " unmeasured");
} else {
  say("");
  say("  " + posts.length + " posts logged · " + settled.length + " settled · " +
      pending.length + " pending · " + unmeasured.length + " unmeasured");
}

// ── 1. NOT COMPARABLE, FIRST ───────────────────────────────────────────────
say("");
say("─ WHAT CANNOT BE COMPARED ".padEnd(72, "─"));
say("");
if (!pending.length && !unmeasured.length) {
  say("  Nothing. Every logged post has a settled reading.");
} else {
  say("  PENDING — read, but not at 48h. Not comparable with anything.");
  if (!pending.length) say("    (none)");
  for (const { p, m } of pending) {
    const ageH = (now - Date.parse(p.postedAt)) / 3600000;
    const due = SETTLED_AT - ageH;
    const when = due > 0 ? "due in " + fmt(due, 1) + "h"
                         : "OVERDUE by " + fmt(-due, 1) + "h — the 48h reading was never taken";
    say("    " + pad(p.id, 44) + " last read " + fmt(m.atHours, 2) + "h · " + when);
  }
  say("");
  say("  UNMEASURED — no reading this report will use.");
  if (!unmeasured.length) say("    (none)");
  for (const { p, ms } of unmeasured) {
    let why;
    if (!ms.length) {
      const ageH = (now - Date.parse(p.postedAt)) / 3600000;
      why = "no reading taken at all (posted " + fmt(ageH, 1) + "h ago)";
    } else {
      const worst = ms.map(m => m.atHours).sort((a, b) => a - b)[0];
      why = worst < 0
        ? "its only reading is timestamped " + fmt(-worst, 2) + "h BEFORE the post — a reading cannot precede its post"
        : "read at " + fmt(worst, 2) + "h, below the " + FLOOR_HOURS + "h floor — that measures page load, not performance";
    }
    say("    " + pad(p.id, 44) + " " + why);
  }
}

// ── 2. THE ROWS THAT MAY BE COMPARED ───────────────────────────────────────
say("");
say("─ SETTLED (48h) — the only rows that may be compared ".padEnd(72, "─"));
say("");
if (!settled.length) {
  say("  None. Nothing in this log has settled.");
} else {
  say("  " + pad("post", 40) + pad("age", 8) + pad("views", 10) + pad("likes", 8) +
      pad("repl", 6) + pad("rt", 6) + "repl/1k");
  for (const { p, m } of settled) {
    say("  " + pad(p.id.slice(0, 38), 40) + pad(fmt(m.atHours, 1) + "h", 8) +
        pad(fmt(m.views), 10) + pad(fmt(m.likes), 8) + pad(fmt(m.replies), 6) +
        pad(fmt(m.reposts), 6) + fmt(rp1k(m), 2));
  }
  say("");
  say("  repl/1k = replies per thousand views. Computed here, never stored, so it");
  say("  cannot drift from the numbers it comes from.");
}

// ── 3. REPLY DENSITY vs REACH ──────────────────────────────────────────────
say("");
say("─ DOES THE HIGHEST REACH ALSO CARRY THE HIGHEST REPLY DENSITY? ".padEnd(72, "─"));
say("");
if (settled.length < 2) {
  say("  NOT ENOUGH SETTLED READINGS TO SAY. The question needs at least two");
  say("  settled posts; there " + (settled.length === 1 ? "is 1" : "are 0") + ".");
  say("");
  say("  With one settled post it is trivially both the highest reach and the");
  say("  highest density, which is not an answer — it is the shape of an answer");
  say("  with nothing behind it.");
} else {
  const byReach = [...settled].sort((a, b) => b.m.views - a.m.views);
  const byDens = [...settled].sort((a, b) => (rp1k(b.m) ?? 0) - (rp1k(a.m) ?? 0));
  let comparable = true;
  try { assertComparable(byReach[0].m.atHours, byDens[0].m.atHours); }
  catch (e) { if (e instanceof TimestampError) comparable = false; else throw e; }
  if (!comparable) {
    say("  REFUSED. The two posts are at different measurement ages, so comparing");
    say("  them would measure age. lib/timestamp.mjs said so and this script does");
    say("  not print a softened version of a comparison its own guard rejected.");
  } else {
    const same = byReach[0].p.id === byDens[0].p.id;
    say("  " + (same ? "YES" : "NO") + " — highest reach is " + byReach[0].p.id +
        " (" + fmt(byReach[0].m.views) + " views, " + fmt(rp1k(byReach[0].m), 2) + " repl/1k);");
    say("  highest density is " + byDens[0].p.id + " (" + fmt(rp1k(byDens[0].m), 2) + " repl/1k).");
    if (!same) {
      say("");
      say("  THEY DIVERGE, AND THAT MATTERS. Reach and conversation density are");
      say("  different axes pulling toward different content. The rewards threshold");
      say("  counts qualified impressions; community trust is built in replies. If");
      say("  these keep diverging we are optimising for two things at once.");
    }
  }
}

// ── 4. SHAPE COMPARISON, ONLY IF EARNED ────────────────────────────────────
say("");
say("─ SHAPE COMPARISON ".padEnd(72, "─"));
say("");
const byFamily = {};
for (const s of settled) (byFamily[family(s.p.shape)] ??= []).push(s);
const eligible = Object.entries(byFamily).filter(([, v]) => v.length >= 2);
if (!eligible.length) {
  say("  n too small to compare shapes.");
  say("");
  const counts = Object.entries(byFamily).map(([k, v]) => k + " (" + v.length + ")");
  say("  Settled posts by shape: " + (counts.length ? counts.join(", ") : "none"));
  say("  Two settled posts of the SAME shape are required. Comparing one shape's");
  say("  settled post against another shape's unsettled one is the exact error");
  say("  this log has already had to withdraw a law over.");
} else {
  for (const [fam, group] of eligible) {
    let ok = true;
    for (let i = 1; i < group.length; i++) {
      try { assertComparable(group[0].m.atHours, group[i].m.atHours); }
      catch (e) { if (e instanceof TimestampError) { ok = false; break; } throw e; }
    }
    if (!ok) { say("  " + fam + ": readings are at unequal ages — refused."); continue; }
    const mean = group.reduce((a, b) => a + b.m.views, 0) / group.length;
    const dens = group.reduce((a, b) => a + (rp1k(b.m) ?? 0), 0) / group.length;
    say("  " + pad(fam, 30) + "n=" + group.length + "  mean views " + fmt(mean) +
        "  mean repl/1k " + fmt(dens, 2));
  }
  say("");
  say("  Means over n=2 or n=3 are descriptions of these posts, not estimates of");
  say("  the shape. Treat them as a direction to test, never as a result.");
}

say("");
say("─ WHAT THIS REPORT CANNOT SEE ".padEnd(72, "─"));
say("");
say("  Only posts WE sent and WE measured. Anything posted by hand from a phone");
say("  never enters the queue and never appears here.");
say("  Not qualified impressions — no API reports them, so nothing here speaks to");
say("  the 500,000 rewards threshold.");
say("  Not WHY anything performed as it did. Reach is an outcome, not a reason.");
say("");

console.log(L.join("\n"));
