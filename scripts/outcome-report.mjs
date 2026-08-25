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

// Wrap for the fixed-width report. Long explanations are the point of this
// script, and a 300-character line is not read.
function wrap(s, n) {
  const out = []; let cur = "";
  for (const w of String(s).split(/\s+/)) {
    if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; }
    else cur = (cur ? cur + " " : "") + w;
  }
  if (cur) out.push(cur);
  return out;
}


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


// ── 5. THE OPEN HYPOTHESES ─────────────────────────────────────────────────
// Claims written before anything could be measured properly. Each one is
// evaluated against the data EVERY RUN rather than carrying a hardcoded
// verdict, so these upgrade themselves as the log fills instead of needing a
// human to remember they exist.
//
// "STILL OPEN" IS A RESULT, NOT A FAILURE TO PRODUCE ONE. At n=1 settled it is
// the only honest answer available, and the entire reason this report exists is
// that a confident answer was manufactured from less than this and had to be
// withdrawn.
const words = (s) => String(s ?? "").trim() ? String(s).trim().split(/\s+/).length : null;
const famCount = (f) => settled.filter(s => family(s.p.shape) === f).length;
const settledAtHour = (lo, hi) => settled.filter(s => s.p.hourLocal >= lo && s.p.hourLocal <= hi);

const HYPOTHESES = [
  {
    id: "pairings-beat-crops",
    claim: "art pairings outperform single-card crops",
    check() {
      const a = famCount("art pairing"), b = famCount("art crop");
      if (a >= 2 && b >= 2) return null;
      return "settled posts: art pairing " + a + ", art crop " + b +
             ". Two settled of EACH shape are needed; comparing one shape's settled post " +
             "against another's unsettled one is the withdrawn error.";
    },
    settledBy: "Two art pairings and two single-card crops, all read at 48h, posted at the same hour.",
    next: { shape: "single-card crop", hour: "21:15 local", why: "matches the only settled post's hour, so hour is held constant",
            refutedIf: "the crop's 48h views land within 2x of the pairing's 48h views, or above it" },
  },
  {
    id: "density-over-reach",
    claim: "conversation density matters more than raw reach",
    check() {
      if (settled.length < 2) {
        return "NOT FALSIFIABLE AS WORDED, and n=" + settled.length + " settled would not settle it anyway. " +
               "\"Matters more\" names no outcome. Replies per thousand views can be measured; " +
               "whether it MATTERS more requires an outcome it is being measured against " +
               "- followers gained, qualified impressions, or newsletter signups - and none " +
               "of those is joined to a post in this log.";
      }
      return "the outcome variable is still undefined - see above.";
    },
    settledBy: "Define the outcome first (followers gained per post is the cheapest), record it beside each 48h reading, then compare density against reach across four settled posts.",
    next: { shape: "any - this one is blocked on definition, not on data", hour: "n/a",
            refutedIf: "high-density posts show no advantage on the chosen outcome once reach is held constant" },
  },
  {
    id: "evening-beats-midday",
    claim: "evening posting beats midday",
    check() {
      const eve = settledAtHour(17, 23).length, mid = settledAtHour(10, 15).length;
      return "settled posts by hour: evening " + eve + ", midday " + mid +
             ". THIS IS THE CLAIM THAT WAS ALREADY WITHDRAWN ONCE - the 122x finding " +
             "compared one post against itself at two ages. It needs posts at both hours, " +
             "each read at 48h, before it may be stated again.";
    },
    settledBy: "Two posts of the SAME shape at ~12:00 local and two at ~21:15 local, all read at 48h.",
    next: { shape: "art pairing, the same shape as the settled post", hour: "12:00 local",
            refutedIf: "the midday post's 48h views land within 2x of the evening post's, which would make the hour effect too small to act on" },
  },
  {
    id: "gm-ban-correct",
    claim: "the GM ban is correct",
    check() {
      return "THE PREMISE COULD NOT BE FOUND. There is no GM ban anywhere in this repo - " +
             "not in the lints, not in the line engine's refusals, not in house-theses.md. " +
             "The only GM guidance on record says the OPPOSITE: house-theses.md keeps " +
             "\"GM [emoji], blank line, one short line\" as a format worth having. One GM post " +
             "exists (pmt8ossvc, 2026-08-25) and has never been read. A rule cannot be " +
             "evaluated until somebody writes down what it is.";
    },
    settledBy: "First state the ban and where it lives. Then two GM posts and two non-GM posts of the same shape and hour, all read at 48h.",
    next: { shape: "GM + art-driven pun, the pmt8ossvc shape", hour: "07:00 local",
            refutedIf: "the GM post's 48h views and reply density both land inside the range of the non-GM posts, which would mean the ban costs reach for nothing" },
  },
  {
    id: "short-captions-win",
    claim: "short captions beat long ones",
    check() {
      const known = settled.filter(s => words(s.p.copy) != null);
      return "settled posts with their caption text recorded: " + known.length + " of " + settled.length +
             ". Caption length is not stored for most posts, so this cannot be tested even " +
             "when the readings arrive. The supporting anecdote - a 31-word draft rewritten " +
             "to five - is one unmeasured post.";
    },
    settledBy: "Record caption word count on every logged post, then compare two settled short-caption posts against two settled long-caption ones at the same shape and hour.",
    next: { shape: "art pairing with a deliberately long caption, 25+ words", hour: "21:15 local",
            refutedIf: "the long-caption post's 48h views and reply density both land within 2x of the short-caption settled post" },
  },
];

say("");
say("─ THE OPEN HYPOTHESES ".padEnd(72, "─"));
say("");
const openOnes = [];
for (const h of HYPOTHESES) {
  const gap = h.check();
  if (gap == null) {
    say("  SETTLED?   " + h.claim);
    say("             the data conditions are met - run the comparison above.");
  } else {
    openOnes.push(h);
    say("  STILL OPEN  " + h.claim);
    for (const line of wrap(gap, 62)) say("              " + line);
    say("              WOULD SETTLE IT: " + wrap(h.settledBy, 46).join("\n                               "));
  }
  say("");
}
say("  " + openOnes.length + " of " + HYPOTHESES.length + " still open. At " + settled.length +
    " settled reading" + (settled.length === 1 ? "" : "s") + " that is the correct answer,");
say("  not a shortfall in the analysis.");


// ── QUEUE THE NEXT POSTS ───────────────────────────────────────────────────
// NOT research/pulse/post-bank.json. That file is REGENERATED from price data
// by post-bank.mjs on every pulse run, so anything written into it by hand is
// deleted on the next build - the same law that says approved brand tokens
// live in the generator and not in tokens.css. And NOT data/post-queue.json,
// which is the send queue: these are experiments to be written and posted
// deliberately, not drafts waiting for an hour to fire.
//
// So they live in their own file, regenerated deterministically from the
// hypothesis list above. Editing this file by hand will not survive either;
// change the hypothesis and rerun.
const queue = {
  note: "The next post that would settle each open hypothesis. Generated by scripts/outcome-report.mjs - do not hand-edit, change the hypothesis and rerun. This is NOT the send queue (data/post-queue.json) and NOT the generated price post bank (research/pulse/post-bank.json).",
  generatedAt: new Date().toISOString(),
  settledReadings: settled.length,
  posts: openOnes.map(h => ({
    hypothesis: h.id,
    claim: h.claim,
    shape: h.next.shape,
    hour: h.next.hour,
    refutedIf: h.next.refutedIf,
    settledBy: h.settledBy,
    status: "not written - the caption is Tylers, this records only the design",
  })),
};
await (await import("node:fs/promises")).writeFile(
  join(ROOT, "data/hypothesis-queue.json"), JSON.stringify(queue, null, 1) + "\n");
say("");
say("  " + openOnes.length + " next-post designs written to data/hypothesis-queue.json");
say("  (not the send queue, and not the generated price post bank - see the file note)");


// ── IS ANYTHING ACTUALLY BEING MEASURED BY MACHINE? ───────────────────────
// post-outcomes.json held six readings for a week and every one was typed in by
// hand. The fetch command existed, was correct, and had never once had anything
// to read - and nothing anywhere said so, because a log with rows in it looks
// like a log that is working.
say("");
say("─ MEASUREMENT PROVENANCE ".padEnd(72, "─"));
say("");
{
  const all = posts.flatMap(p => p.metrics ?? []);
  const api = all.filter(m => m.source === "api").length;
  const byHand = all.length - api;
  if (!all.length) {
    say("  NO READINGS AT ALL. Nothing in this log has ever been measured.");
  } else if (!api) {
    say("  WARNING: " + all.length + " reading(s), and NOT ONE came from the API.");
    say("  Every number here was typed in by a human. The fetch path may be correct");
    say("  and still have nothing to read - check that sent posts carry a tweet id.");
    say("  Run: node scripts/read-metrics.mjs due");
  } else {
    say("  " + api + " of " + all.length + " reading(s) came from the API, " + byHand + " by hand.");
    const noId = posts.filter(p => !p.tweetId).length;
    if (noId) say("  " + noId + " post(s) carry no tweet id and can never be read automatically.");
  }
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

// A VERDICT LINE, BECAUSE SILENCE READS AS A CRASH. The fleet decides an
// agent's status from its ✓ or ✗ line, so a reporter that printed only a
// report was listed as "CRASHED — produced no verdict, which reads as fine in
// a summary". It was working perfectly and the roster said otherwise.
//
// The numbers here are COMPUTED IN THIS FILE, not read from the log: settled,
// openOnes and apiReadings are all derived above. That is the rule the
// unverified-success-line guard enforces, and this line is subject to it.
const apiReadings = posts.flatMap(p => p.metrics ?? []).filter(m => m.source === "api").length;
const allReadings = posts.flatMap(p => p.metrics ?? []).length;
console.log(`\n  ✓ outcome report: ${settled.length} settled of ${posts.length} · ` +
  `${apiReadings}/${allReadings} readings from the API · ${openOnes.length} hypotheses still open\n`);

