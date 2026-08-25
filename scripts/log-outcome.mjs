// log-outcome.mjs — close the loop, or keep guessing forever.
//
// Tyler, 2026-08-23: "If we can hone down great post quality it could be a game
// changer." He is right, and the blocker is not a modelling problem.
//
// We can generate 84 formulas. We have outcome data on ONE post. The
// pairing-finder ranked that post first unprompted, which is genuinely
// encouraging and is still a sample of one. **Nothing currently connects a post
// that went out to the formula that produced it**, so posting more teaches the
// ranker nothing at all - a hundred posts and we would know exactly as much as
// we do now.
//
// This is the cheapest possible fix: log what shape went out, and its numbers.
// After roughly twenty entries the ranking stops being a hypothesis.
//
//   node scripts/log-outcome.mjs --shape "the pair" --views 127200 --likes 2500 \
//     --replies 1 --note "Arita Charizard/Blastoise"
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolvePostedAt, assertReadingAfterPost, ageHours, TimestampError } from "./lib/timestamp.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/post-outcomes.json");

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };

const store = JSON.parse(await readFile(FILE, "utf-8").catch(() => '{"posts":[]}'));

if (process.argv.includes("--report") || process.argv.length <= 2) {
  const posts = store.posts ?? [];
  const byShape = {};
  // UNMEASURED IS NOT ZERO. `?? 0` put the Mabosstiff post at the bottom of the
  // shape table on 0 median views when the truth is nobody has read it yet —
  // a missing number rendered as the worst possible result.
  let unmeasured = 0;
  for (const p of posts) {
    const v = p.measured?.views ?? null;
    if (v === null) { unmeasured++; continue; }
    (byShape[p.shape ?? "unrecorded"] ||= []).push(v);
  }
  console.log(`\n  ${posts.length} post(s) logged.` + (unmeasured ? `  ${unmeasured} never read — held out of the table below, not scored as zero.` : "") + `\n`);
  // AGE IS THE SECOND CONFOUND. A post accumulates views for days, so a
  // 7-hour-old post beside a 22-hour-old one is a comparison of AGE. Timing was
  // hour-of-day; this is hours-since-posting. Same class, different axis, found
  // one hour after the first one caught me.
  //
  // 2026-08-25: and this line had the bug it was written to prevent. It measured
  // how old a post is NOW, when the number beside it was read at measured.at and
  // has not moved since — so a post read at 1.7 minutes and left alone for two
  // days reported as a settled 48-hour observation. The age that matters is the
  // age AT THE READING, which is now recorded on every reading as atHours.
  const readAge = (p) => p.measured?.atHours ?? (p.metrics?.at(-1)?.atHours ?? null);
  const young = posts.filter(p => readAge(p) !== null && readAge(p) < 24);
  if (young.length) {
    console.log(`  ${young.length} post(s) whose numbers were read before 24h — still accumulating when measured, not comparable to settled ones:`);
    for (const p of young) console.log(`     ${String(p.measured.views).padStart(5)} views read at ${readAge(p).toFixed(2)}h — ${p.shape.slice(0, 40)}`);
    console.log();
  }
  const noAge = posts.filter(p => readAge(p) === null && (p.measured?.views ?? null) !== null);
  if (noAge.length) console.log(`  ${noAge.length} post(s) carry a view count with no reading age. Unusable for comparison.\n`);
  if (!posts.length) { console.log("  Nothing to compare yet."); }
  else {
    const rows = Object.entries(byShape).map(([s, v]) => ({ shape: s, n: v.length,
      median: v.sort((a, b) => a - b)[Math.floor(v.length / 2)] }))
      .sort((a, b) => b.median - a.median);
    for (const r of rows) console.log(`   ${String(r.median).padStart(5)} median views   ${String(r.n).padStart(2)} post(s)   ${r.shape}`);
    console.log("\n  This table ranks by raw views and controls for NOTHING — not hour of day, not age, not follower count on the day. It is a record, not a finding.");
    // THE LAW, ENFORCED WHERE THE COMPARISON HAPPENS. Stating it in the file
    // header did not stop three sessions from ranking a reading taken at 1.7
    // minutes against one taken a day later, so it is printed against the table
    // that commits the error rather than left somewhere to be read.
    const ages = posts.map(readAge).filter((a) => a !== null);
    if (ages.length > 1) {
      const lo = Math.min(...ages), hi = Math.max(...ages);
      if (hi - lo > Math.max(0.25, 0.1 * hi))
        console.log(`\n  ⚠ THESE ROWS ARE NOT COMPARABLE. The readings behind them span ${lo.toFixed(2)}h to ${hi.toFixed(2)}h of age.\n    Readings are only comparable at equal age. Ranking these is measuring age, not shape.`);
    }
  }
  // The honest read of a small sample, stated rather than implied. Twenty is
  // where a median across shapes starts meaning something; below that we are
  // reading noise and calling it a signal.
  const need = 20 - posts.length;
  console.log(need > 0
    ? `\n  ${need} more before this means anything. Under twenty, a difference between shapes is noise wearing a number.\n`
    : `\n  Enough to rank on. Feed this back into pairing-finder rather than the assumptions it currently uses.\n`);
} else {
  const shape = arg("shape");
  if (!shape) { console.error("  --shape is required. Which formula produced this post?"); process.exitCode = 1; }
  else {
    store.posts = store.posts ?? [];
    // THE ZONE IS NOT OPTIONAL. Five of the six entries in this file were
    // Pacific wall clocks carrying a Z, and the analysis they fed is about what
    // HOUR a post goes out — so the one field the study depends on was the one
    // field that was seven hours wrong. resolvePostedAt refuses to guess: pass
    // --tz local for a time read off your own clock, --tz UTC for one that came
    // from a machine. Omitting --at still means "now", which is genuinely UTC.
    let resolved;
    try {
      resolved = resolvePostedAt({ at: arg("at", null), tz: arg("at", null) ? arg("tz", null) : "UTC" });
    } catch (e) {
      if (!(e instanceof TimestampError)) throw e;
      console.error(`\n  REFUSED — ${e.message}\n`);
      process.exit(1);
    }
    const readAt = new Date().toISOString();
    try { assertReadingAfterPost(resolved.postedAt, readAt, "this reading"); }
    catch (e) { console.error(`\n  REFUSED — ${e.message}\n`); process.exit(1); }

    const m = { atHours: Math.round(ageHours(resolved.postedAt, readAt) * 100) / 100,
      readAt, views: Number(arg("views", 0)), likes: Number(arg("likes", 0)),
      replies: Number(arg("replies", 0)), reposts: Number(arg("reposts", 0)),
      bookmarks: arg("bookmarks", null) === null ? null : Number(arg("bookmarks")),
      source: arg("source", "manual") };
    // FILE IT UNDER A CHECKPOINT, THE WAY read-metrics DOES. Two writers reach
    // this log and only one of them stamped a checkpoint, so every reading that
    // arrived through the promotion path was invisible to anything asking "is
    // this settled?" - outcome-report counted one settled post while three more
    // sat there with 48h readings and no label. A shared file needs one shape.
    const CHECKPOINTS = [1, 24, 48];
    m.checkpoint = CHECKPOINTS.reduce((a, b) => Math.abs(b - m.atHours) < Math.abs(a - m.atHours) ? b : a);
    // MERGE ON TWEET ID, DO NOT APPEND BLINDLY. This pushed a new post every
    // time, so promoting a 48h reading for a post already in the log created a
    // SECOND entry for the same tweet - two rows, one post, and every count in
    // the repo off by one. The same overwrite-versus-merge law the resolver,
    // the enrichment and the verify gate were all fixed under.
    const tweetId = arg("tweet", null);
    const existing = tweetId ? store.posts.find(p => p.tweetId === tweetId) : null;
    if (existing) {
      {
        existing.metrics = [...(existing.metrics ?? []).filter(x => Math.abs((x.atHours ?? 0) - m.atHours) > 0.5), m];
        existing.measured = { at: m.readAt, atHours: m.atHours, views: m.views,
          likes: m.likes, replies: m.replies, reposts: m.reposts };
        await writeFile(FILE, JSON.stringify(store, null, 1) + "\n");
        console.log(`  merged into ${existing.id}: ${m.views} views at ${m.atHours}h (${m.source})`);
      }
    } else {
    store.posts.push({
      tweetId,
      id: `${new Date().toISOString().slice(0, 10)}-${(arg("note", "post")).replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 32)}`,
      postedAt: resolved.postedAt,
      postedAtLocal: arg("at", null) ? arg("at") : null,
      hourLocal: resolved.hourLocal,
      tz: resolved.tz,
      platform: arg("platform", "X"),
      shape,
      note: arg("note", null),
      metrics: [m],
      measured: { at: m.readAt, atHours: m.atHours, views: m.views, likes: m.likes,
        replies: m.replies, reposts: m.reposts },
      confidence: (store.posts.length + 1) < 20
        ? `SAMPLE OF ${store.posts.length + 1} - not yet enough to rank shapes against each other`
        : "part of a rankable sample",
    });
    await writeFile(FILE, JSON.stringify(store, null, 1) + "\n");
    console.log(`  logged: ${shape} · ${arg("views", 0)} views · ${store.posts.length} total`);
    }
    if (store.posts.length < 20) console.log(`  ${20 - store.posts.length} more before the ranking can stop guessing.`);
  }
}
