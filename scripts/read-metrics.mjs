// read-metrics.mjs — close the loop.
//
// Tyler, 2026-08-24: "Wait this is a flaw no? How will you know what posts do
// well and don't?"
//
// **It is, and it is the load-bearing one.** Every finding in this project rests
// on FIVE posts that Tyler typed in by hand, and every account profile came from
// a search snippet or a write-up he pasted. I have never read a post directly.
//
// So the loop is open at both ends:
//   generate a post    yes
//   send it            built, needs credentials
//   see how it did     NO
//   learn from that    NO
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

if (cmd === "due") {
  // What needs reading right now. This is what a cron calls.
  const q = await load();
  const now = Date.now();
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
  if (!due.length) { console.log("  nothing due for a reading."); process.exit(0); }
  console.log(`${due.length} post(s) due a reading:\n`);
  for (const d of due) console.log(`  ${d.tweetId}  ${d.ageH}h old, checkpoint ${d.checkpoint}h`);
  console.log(`\n  cost: $${(due.length * 0.001).toFixed(3)}`);
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
    execSync(`node ${JSON.stringify(join(ROOT, "scripts/log-outcome.mjs"))} --shape ${JSON.stringify(shape)} --views ${m.views} --likes ${m.likes} --replies ${m.replies} --reposts ${m.reposts} --at ${JSON.stringify(p.postedAt)}`, { stdio: "inherit" });
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

  due                  what needs a reading now (this is what a cron calls)
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

NOT BUILT HERE: the actual API call. CC holds the keys. This is the half that
can be tested without them, and keeping them separate means a fetch failure
cannot corrupt the record.`);
}
