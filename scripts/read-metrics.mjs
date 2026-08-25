// read-metrics.mjs — close the loop.
//
// Tyler, 2026-08-24: "Wait this is a flaw no? How will you know what posts do
// well and don't?"
//
// **It is, and it is the load-bearing one.** Every finding in this project rests
// on FIVE posts that Tyler typed in by hand, and every account profile came from
// a search snippet or a write-up he pasted. I have never read a post directly.
//
// The loop was open at both ends. As of 2026-08-25 the reading end is wired:
//   generate a post    yes
//   send it            built, unproven against the live endpoint
//   see how it did     the "fetch" command below
//   learn from that    automatic at 48h, into data/post-outcomes.json
//
// HONEST STATUS OF THAT CLAIM: the signing path is proven — the same signer
// authenticated a live GET as @LongedEth — and every branch of "fetch" is
// covered by an offline harness. What has NOT happened is a run against a
// real post of Tyler's, because the queue has never sent one. The first live
// fetch is still a test.
//
// experiment.mjs and log-outcome.mjs both wait for somebody to type numbers in.
// **That is not a feedback loop, it is homework** — and homework does not get
// done by a man with two jobs and two kids, which means the data stays at five
// posts forever and every rule we have written stays an opinion.
//
// THE FIX IS CHEAPER THAN THE POSTING. X charges $0.001 per OWNED read. We do
// not need to read the platform, only Tyler's own posts: sixty posts a month
// checked three times each is **eighteen cents**. And it is THE SAME
// CREDENTIALS the queue already needs, so one integration closes both ends.
//
// I priced writes when we built the queue and never priced reads — answering
// the question asked instead of the one that mattered.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertReadingAfterPost, ageHours } from "./lib/timestamp.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// THREE CHECKS, NOT ONE. Views climb for days — age was the second confound
// that caught me — so a single reading tells you nothing about a settled post.
// One early check catches a post that died on arrival; the 48h reading is the
// one that counts.
const CHECKPOINTS = [1, 24, 48];
const SETTLED_AT = 48;

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

const load = async () => { try { return JSON.parse(await readFile(join(ROOT, "data/post-queue.json"), "utf-8")); }
  catch { return { posts: [] }; } };

// $0.001 per OWNED read. Named once because it is quoted in three places, and
// a price that drifts between them is how a budget stops meaning anything.
const READ_COST_USD = 0.001;
const cost = (n) => "$" + (n * READ_COST_USD).toFixed(3);

// WHAT IS OWED — a function, not a printout. `due` prints this and `fetch`
// consumes it. The moment the list is worked out in two places it is worked out
// two ways, and the disagreement surfaces as a post read twice or never read.
function dueReadings(q, now = Date.now()) {
  const due = [];
  for (const p of q.posts.filter(x => x.status === "sent" && x.tweetId)) {
    const ageH = (now - Date.parse(p.postedAt)) / 3600000;
    // Filed under the CHECKPOINT, not the measured age — atHours is now the real
    // elapsed time, so matching on it would re-read every post forever.
    const done = (p.metrics ?? []).map(m => m.checkpoint ?? m.atHours);
    for (const cp of CHECKPOINTS) {
      if (ageH >= cp && !done.includes(cp)) { due.push({ id: p.id, tweetId: p.tweetId, checkpoint: cp, ageH: Math.round(ageH) }); break; }
    }
  }
  return due;
}

if (cmd === "due") {
  // What needs reading right now. This is what a cron calls.
  const due = dueReadings(await load());
  if (!due.length) { console.log("  nothing due for a reading."); process.exit(0); }
  console.log(`${due.length} post(s) due a reading:\n`);
  for (const d of due) console.log(`  ${d.tweetId}  ${d.ageH}h old, checkpoint ${d.checkpoint}h`);
  console.log(`\n  cost: ${cost(due.length)}`);
}

else if (cmd === "fetch") {
  // THE PIECE THAT WAS MISSING. `due` works out what is owed and `record` files
  // it; this asks X for the numbers in between. It is the entire difference
  // between a feedback loop and homework.
  //
  // FETCH AND RECORD STAY SEPARATE PROCESSES, deliberately. This shells out to
  // `record` rather than calling it inline, so the writing half keeps its own
  // validation, its own 48h promotion into the outcome log, and its own blast
  // radius: a fetch that dies on the fourth post cannot leave the fourth post
  // half-written, and the first three are already on disk.
  const dryRun = args.includes("--dry-run");
  const due = dueReadings(await load());
  if (!due.length) { console.log("  nothing due for a reading."); process.exit(0); }
  console.log(`${due.length} reading(s) due · ${cost(due.length)}` +
    (dryRun ? "   DRY RUN, nothing will be recorded" : "") + "\n");

  const { signedFetch } = await import("./lib/x-auth.mjs");
  const { execFileSync } = await import("node:child_process");
  const self = fileURLToPath(import.meta.url);
  let attempted = 0, recorded = 0, previewed = 0, skipped = 0;

  for (const d of due) {
    let r;
    try {
      // bookmark_count and impression_count come back ONLY for posts the
      // authenticating account owns. That is the same fact that makes this cheap
      // — $0.001 an owned read — and the reason this must be OAuth 1.0a user
      // context. An app-only bearer token authenticates as the app, owns
      // nothing, and would return a metrics object with exactly the two fields
      // that matter quietly missing.
      r = await signedFetch("GET", `https://api.x.com/2/tweets/${d.tweetId}`,
        { "tweet.fields": "public_metrics,created_at" });
      attempted++;
    } catch (e) {
      console.error(`  ✗ ${d.tweetId}  request failed: ${e.message}`);
      skipped++; continue;
    }

    // STOP THE RUN, do not carry on round the loop. Every remaining request in
    // this window would be refused too, and sixty more failures buries the one
    // fact worth reading: come back after the reset. Nothing is lost — `due`
    // recomputes what is owed on the next run.
    if (r.status === 429) {
      const reset = Number(r.headers.get("x-rate-limit-reset"));
      console.error(`  ✗ ${d.tweetId}  rate limited (429). Nothing further attempted.`);
      if (reset) console.error(`     window resets ${new Date(reset * 1000).toISOString()}`);
      skipped += due.length - due.indexOf(d);
      break;
    }
    if (!r.ok) {
      console.error(`  ✗ ${d.tweetId}  HTTP ${r.status}: ${r.text.slice(0, 160)}`);
      skipped++; continue;
    }

    // A DELETED POST COMES BACK 200. The v2 API reports a missing, suspended or
    // unauthorised tweet as a 200 carrying an `errors` array and no `data`. So
    // trusting r.ok and reading public_metrics off undefined is precisely how a
    // row of zeros gets recorded for a post that no longer exists — a permanent
    // fake data point in a log that holds five real ones.
    const t = r.json?.data;
    if (!t) {
      const e = r.json?.errors?.[0];
      console.error(`  ✗ ${d.tweetId}  not readable: ${e?.detail ?? e?.title ?? "a 200 with no data"}`);
      skipped++; continue;
    }

    // MISSING IS NOT ZERO. If impression_count is absent, these credentials do
    // not own the post or X is not reporting it yet. Either way the honest
    // record is no record: a written 0 enters the outcome log as a post that
    // flopped and is indistinguishable from one that genuinely did.
    const pm = t.public_metrics ?? {};
    if (pm.impression_count === undefined) {
      console.error(`  ✗ ${d.tweetId}  no impression_count returned — refusing to record 0 views.`);
      console.error(`     These credentials may not own this post. Nothing written.`);
      skipped++; continue;
    }

    const m = {
      views: pm.impression_count,
      likes: pm.like_count ?? 0,
      replies: pm.reply_count ?? 0,
      reposts: pm.retweet_count ?? 0,
      bookmarks: pm.bookmark_count ?? 0,
    };

    if (dryRun) {
      console.log(`  · ${d.tweetId}  ${m.views.toLocaleString()} views · ${m.replies} replies / ${m.likes} likes · ${m.reposts} reposts · ${m.bookmarks} bookmarks   (checkpoint ${d.checkpoint}h, not recorded)`);
      previewed++; continue;
    }

    // --source api, and never --qualified. record refuses that combination on
    // purpose: impression_count is raw views, a strict superset of the
    // monetization-qualifying number, and only Creator Studio reports the figure
    // that counts toward the 500,000 threshold.
    try {
      execFileSync(process.execPath, [self, "record",
        "--tweet", d.tweetId,
        "--views", String(m.views), "--likes", String(m.likes),
        "--replies", String(m.replies), "--reposts", String(m.reposts),
        "--bookmarks", String(m.bookmarks),
        "--source", "api"], { stdio: "inherit" });
      recorded++;
    } catch {
      // record exits non-zero through its own guards and has already said why.
      // Deliberately does not claim what was or was not written: record owns
      // that, and a partial success — reading saved, promotion failed — is real.
      console.error(`  ✗ ${d.tweetId}  record exited non-zero, see its output above.`);
      skipped++;
    }
  }

  console.log(`\n  ${dryRun ? previewed + " previewed, nothing recorded" : recorded + " recorded"}, ${skipped} skipped · up to ${cost(attempted)} spent`);
}

else if (cmd === "record") {
  // Called with what the API returned. Kept separate from fetching so this half
  // is testable without credentials, and so a fetch failure cannot corrupt the
  // record.
  // ARGUMENT VALIDITY FIRST, before any lookup. This check does not depend on
  // which post you named, and putting it after the lookup made it unreachable
  // for any tweet id not already in the queue — a guard you cannot trigger is a
  // guard you cannot test.
  const source = flag("source") ?? "manual";
  const qualified = flag("qualified");
  if (qualified !== null && source === "api") {
    console.error(`  REFUSED — --qualified cannot come from the API.\n` +
      `  public_metrics.impression_count is raw views, a strict superset of qualified\n` +
      `  impressions. Only Creator Studio reports the qualifying number.\n` +
      `  Record it with --source creator-studio once a human has read it there.`);
    process.exit(1);
  }
  const q = await load();
  const tweetId = flag("tweet");
  const p = q.posts.find(x => x.tweetId === tweetId);
  if (!p) { console.error(`  no queued post with tweet id ${tweetId}`); process.exit(1); }
  const readAt = new Date().toISOString();
  assertReadingAfterPost(p.postedAt, readAt, "this reading");
  // REAL AGE, not the checkpoint it is filed under. atHours used to be assigned
  // the checkpoint value, so a reading taken at 15.33h was recorded as "24h" and
  // then compared against a genuine 24h reading. The checkpoint is a filing
  // label; the age is a measurement, and they are now separate fields.
  const atHours = Math.round(ageHours(p.postedAt, readAt) * 100) / 100;
  const cp = CHECKPOINTS.reduce((a, b) => Math.abs(b - atHours) < Math.abs(a - atHours) ? b : a);

  // TWO DIFFERENT NUMBERS THAT LOOK LIKE ONE. views is impression_count: every
  // impression from anywhere, including replies, non-subscribers, the same
  // person twice and promoted placement. A QUALIFIED impression is a unique
  // Home Timeline impression from an X Premium subscriber with half the post on
  // screen. Raw views are a strict superset, so they can only overstate progress
  // toward the 500,000 threshold — and no endpoint on the X API reports the
  // qualifying figure. It comes from Creator Studio, typed in by a human, or it
  // does not exist. See data/compliance-register.json (retrieved 2026-08-25).
  // The refusal for --qualified --source api is at the top of this branch.
  const m = { atHours, checkpoint: cp, readAt,
    views: Number(flag("views") ?? 0), likes: Number(flag("likes") ?? 0),
    replies: Number(flag("replies") ?? 0), reposts: Number(flag("reposts") ?? 0),
    bookmarks: Number(flag("bookmarks") ?? 0),
    qualifiedImpressions: qualified === null ? null : Number(qualified),
    qualifiedImpressionsSource: qualified === null ? null : source,
    source };
  p.metrics = [...(p.metrics ?? []).filter(x => (x.checkpoint ?? x.atHours) !== cp), m];
  await writeFile(join(ROOT, "data/post-queue.json"), JSON.stringify(q, null, 1) + "\n");

  // AT 48 HOURS IT GOES INTO THE OUTCOME LOG AUTOMATICALLY. That is the whole
  // point — the log stops being homework and starts filling itself.
  if (cp === SETTLED_AT) {
    const { execSync } = await import("node:child_process");
    const shape = p.shape ?? "unlabelled";
    // --tz UTC IS REQUIRED, AND WAS MISSING. log-outcome.mjs routes --at through
    // resolvePostedAt, which refuses to guess a zone — added after five of six
    // rows in post-outcomes.json turned out to be Pacific wall clocks wearing a
    // Z. Without it this call exited 1 on EVERY 48h reading and threw an
    // unhandled child-process error, so the automatic promotion — the entire
    // point of the 48h checkpoint — had never once run. Found 2026-08-25 by the
    // fetch harness, which reached 48h where no manual test had.
    // UTC is the honest value here, not a convenience: post-queue.mjs writes
    // postedAt from resolvePostedAt({ at: null, tz: "UTC" }) at send time, so it
    // is a machine clock in UTC and saying so is simply true.
    try {
      execSync(`node ${JSON.stringify(join(ROOT, "scripts/log-outcome.mjs"))} --shape ${JSON.stringify(shape)} --views ${m.views} --likes ${m.likes} --replies ${m.replies} --reposts ${m.reposts} --at ${JSON.stringify(p.postedAt)} --tz UTC`, { stdio: "inherit" });
    } catch {
      // The reading itself is already on disk and is correct. Say precisely
      // that, instead of dying with a stack trace that reads as if it was lost.
      console.error(`  ! the 48h reading for ${tweetId} was saved, but promoting it into`);
      console.error(`    data/post-outcomes.json failed (above). The outcome log is short one row.`);
      process.exitCode = 1;
    }
  }
  // REPLY-TO-LIKE IS THE CONVERSATION METRIC. Crambo took 68 replies against 73
  // likes where a normal post runs nearer 10% — views measure an audience
  // watching, this measures a room talking.
  const rtl = m.likes ? Math.round(m.replies / m.likes * 100) : 0;
  console.log(`✓ ${tweetId} read at ${atHours}h (filed as ${cp}h): ${m.views.toLocaleString()} RAW views · ${m.replies} replies / ${m.likes} likes = ${rtl}% reply-to-like`);
  console.log(`  qualified impressions: ${m.qualifiedImpressions === null ? "unknown — the API cannot report this. Creator Studio only." : m.qualifiedImpressions.toLocaleString() + " (" + m.qualifiedImpressionsSource + ")"}`);
}

else {
  console.log(`read-metrics — close the loop.

  due                  what needs a reading now
  fetch [--dry-run]    read every due post from X and file it (cron calls this)
  record --tweet ID --views N --likes N --replies N --reposts N [--bookmarks N]
         [--source api|manual|creator-studio] [--qualified N]

TWO NUMBERS THAT LOOK LIKE ONE, and this one matters for money:

  views                 raw impression_count. Every impression from anywhere:
                        replies, non-subscribers, the same person twice,
                        promoted placement. This is what the API returns.
  qualifiedImpressions  unique Home Timeline impressions from X Premium
                        subscribers with at least 50% of the post visible.
                        This is what the Original Content Rewards program
                        counts toward its 500,000 threshold.

RAW VIEWS ARE A STRICT SUPERSET. They can only ever OVERSTATE how close we are.
No X API endpoint reports the qualifying number — it exists in Creator Studio
and nowhere else, so --qualified is refused with --source api. This script's
declared blind spot in data/guard-blindspots.json says so out loud: it measures
raw views and cannot measure monetization-qualifying impressions.

WHY THIS EXISTS: every finding in this project rests on FIVE posts typed in by
hand. experiment.mjs and log-outcome.mjs both wait for somebody to enter
numbers, which is not a feedback loop — it is homework, and homework does not
get done. The data stays at five posts and every rule stays an opinion.

THREE READINGS PER POST at 1h, 24h and 48h, because views climb for days and a
single reading tells you nothing about a settled post. The 48h one goes into the
outcome log automatically.

COST: $0.001 per owned read. Sixty posts a month, three checks each, is
EIGHTEEN CENTS. Same credentials the posting queue needs.

FETCH AND RECORD ARE SEPARATE PROCESSES. "fetch" asks X and shells out to
"record" for each post, so the writing half stays testable without credentials
and a fetch that fails midway cannot corrupt a record or leave one half-written.
Run "fetch --dry-run" to see the numbers X returns without writing anything.

WHAT FETCH REFUSES TO WRITE, because a wrong row is worse than a missing one:
a post that returns 200 with no data (deleted, suspended, not visible to these
credentials), and any post whose public_metrics arrives without impression_count
— missing is not zero, and a recorded 0 reads as a flop forever.`);
}
