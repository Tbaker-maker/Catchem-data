// post-queue.mjs — the machine presses send. It does not write.
//
// Tyler, 2026-08-24: "Agents that post on my X account… mainly for posting while
// I'm working. I can't do both at the same time. I'll continue with the replies."
//
// THE COST IS A NON-ISSUE: X moved to pay-per-use in Feb 2026 at $0.015 per
// post, so two a day is about **ninety cents a month**. Links cost $0.20 —
// thirteen times more — which is the same answer we already reached for reach
// reasons: **the link goes in a reply, not the post.**
//
// THE DESIGN RISK IS THE WHOLE THING. Our own outcome log says every post that
// worked was written by Tyler, from his mood, in the moment — and that ZERO of
// them used any of the 84 formulas we generate. **An agent that writes is
// automating the only part that works. An agent that presses send is automating
// the part that doesn't.**
//
// He named the bottleneck himself: being at the keyboard at 9pm, not thinking of
// something to say. That is a QUEUE, not an author.
//
// WHAT THIS REFUSES TO DO, on purpose:
//   - generate post text
//   - post to anybody else's account
//   - post anything Tyler has not read
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolvePostedAt } from "./lib/timestamp.mjs";
import { evaluateConfirmation } from "./lib/send-gate.mjs";
import { verdictFor } from "./originality-guard.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const QUEUE = join(ROOT, "data/post-queue.json");

const load = async () => { try { return JSON.parse(await readFile(QUEUE, "utf-8")); }
  catch { return { note: "Posts Tyler wrote, waiting for their hour. The machine presses send and nothing else — it does not write, and it does not post to any account but his own.", posts: [] }; } };
const save = async (q) => writeFile(QUEUE, JSON.stringify(q, null, 1));

// THE CAP IS THE HARD PART, NOT THE PRICE. 100 users at two link-free posts a
// day costs us $90/month, which is fine. One account posting thirty link-posts
// a day costs $180 on its own — thirty-six subscriptions at $5. A metered
// feature with no ceiling is a feature one person can turn into a bill, and it
// takes no malice, just a heavy campaign.
const COST = { post: 0.015, linkPost: 0.20 };
const CAPS = { postsPerDay: 8, spendPerMonth: 3.00 };
function costOf(p){ return /https?:\/\//.test(p.text) ? COST.linkPost : COST.post; }
function monthSpend(posts){
  const since = Date.now() - 30 * 86400000;
  return posts.filter(p => p.status === "sent" && Date.parse(p.postedAt ?? 0) > since)
    .reduce((s, p) => s + costOf(p), 0);
}
function capCheck(q, incoming){
  const today = new Date().toISOString().slice(0, 10);
  const sentToday = q.posts.filter(p => p.status === "sent" && String(p.postedAt).slice(0, 10) === today).length;
  const spend = monthSpend(q.posts);
  if (sentToday >= CAPS.postsPerDay)
    return `daily cap reached (${CAPS.postsPerDay} posts). This exists so one heavy day cannot become a bill.`;
  if (spend + costOf(incoming) > CAPS.spendPerMonth)
    return `monthly spend cap reached (${CAPS.spendPerMonth.toFixed(2)}). Spent ${spend.toFixed(2)} in the last 30 days.`;
  return null;
}

// The window. It counts, it prints the budget, and it does not draft a single
// word. Posts are assisted; replies are Tyler's, in his own words, every time.
async function replyWindow(minutes) {
  const end = Date.now() + minutes * 60000;
  console.log(`  REPLY WINDOW — ${minutes} minutes, starting now.`);
  console.log(`  The budget: every reply gets an answer, in your words.`);
  console.log(`  Nothing in this repo drafts them and nothing ever will.\n`);
  while (Date.now() < end) {
    const left = Math.ceil((end - Date.now()) / 60000);
    process.stdout.write(`\r  ${String(left).padStart(2)} min left in the reply window    `);
    await new Promise((r) => setTimeout(r, Math.min(60000, Math.max(1000, end - Date.now()))));
  }
  process.stdout.write(`\r  reply window closed.                    \n\n`);
}

// UNVERIFIED AGAINST THE LIVE ENDPOINT. Everything above the send gate has been
// run; this has not, because running it means publishing to Tyler's account and
// that is his keystroke to make, not mine. The signing path underneath it IS
// proven — scripts/lib/x-auth.mjs was validated against X's published signature
// vector and the same signer completed the three-legged authorization that
// minted these tokens. What is untested is this request shape: the endpoint, the
// JSON body, and the media upload. Treat the first live send as a test.
async function postToX(p) {
  const { loadEnv } = await import("./lib/load-env.mjs");
  const { authHeader, creds } = await import("./lib/x-auth.mjs");
  loadEnv();
  const c = creds();
  if (!c.ok) throw new Error(`missing credentials: ${c.missing.join(", ")}`);

  let mediaId = null;
  if (p.image) {
    const mUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const bytes = await readFile(join(ROOT, p.image)).catch(() => readFile(p.image));
    const form = new FormData();
    form.append("media", new Blob([bytes]));
    const mr = await fetch(mUrl, {
      method: "POST",
      headers: { Authorization: authHeader({ method: "POST", url: mUrl, params: {}, ...c }) },
      body: form, signal: AbortSignal.timeout(60000),
    });
    const mt = await mr.text();
    if (!mr.ok) throw new Error(`media upload HTTP ${mr.status}: ${mt.slice(0, 160)}`);
    mediaId = JSON.parse(mt).media_id_string;
  }

  const url = "https://api.x.com/2/tweets";
  const body = { text: p.text };
  if (mediaId) body.media = { media_ids: [mediaId] };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: authHeader({ method: "POST", url, params: {}, ...c }),
      "Content-Type": "application/json" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`);
  const id = JSON.parse(t)?.data?.id;
  if (!id) throw new Error(`no tweet id in a ${r.status} response`);
  return { id };
}

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

if (cmd === "add") {
  const q = await load();
  const text = flag("text");
  if (!text) { console.error("  --text is required. This tool does not write posts."); process.exit(1); }
  // THE HOUR IS RECORDED, NOT RANKED. This comment used to say the identical
  // pairing post did 154 views at a bad hour and 18,800 at 9:18pm, 122x, same
  // cards. That was one post entered twice and read 15 hours apart — withdrawn
  // 2026-08-25, see data/corrections-log.json. We have no evidence that any hour
  // beats any other. 21:15 is a default because a default is needed, not because
  // it won anything.
  const at = flag("at") ?? "21:15";
  q.posts.push({ id: "p" + Date.now().toString(36), text,
    image: flag("image") ?? null,
    reply: flag("reply") ?? null,      // the card list, or the link — never in the post itself
    at, status: "queued", written: new Date().toISOString(), postedAt: null });
  await save(q);
  console.log(`✓ queued for ${at} — ${q.posts.filter(p => p.status === "queued").length} waiting`);
  if (/https?:\/\//.test(text)) console.log(`  NOTE: that post contains a link. $0.20 instead of $0.015, and X suppresses reach on link posts. Put it in --reply instead.`);
}

else if (cmd === "list") {
  const q = await load();
  const waiting = q.posts.filter(p => p.status === "queued");
  if (!waiting.length) { console.log("  nothing queued."); process.exit(0); }
  console.log(`${waiting.length} post(s) waiting:\n`);
  for (const p of waiting) {
    console.log(`  [${p.at}] ${p.text.split("\n")[0].slice(0, 68)}`);
    if (p.image) console.log(`          image: ${p.image}`);
    if (p.reply) console.log(`          reply: ${p.reply.split("\n")[0].slice(0, 58)}`);
  }
  const cost = waiting.length * 0.015;
  console.log(`\n  cost to send all of these: ${cost.toFixed(2)}`);
  const spent = monthSpend(q.posts);
  console.log(`  spent in the last 30 days: ${spent.toFixed(2)} of ${CAPS.spendPerMonth.toFixed(2)} cap`);
}

else if (cmd === "next") {
  // What WOULD go out, without sending it. The dry run is the default because
  // an automated poster that cannot be inspected before it fires is a thing
  // nobody should install.
  const q = await load();
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const due = q.posts.filter(p => p.status === "queued" && p.at <= hhmm);
  if (!due.length) { console.log(`  nothing due at ${hhmm}. Next up: ${q.posts.filter(p => p.status === "queued").map(p => p.at).sort()[0] ?? "—"}`); process.exit(0); }
  const p = due[0];
  console.log(`WOULD POST at ${hhmm}:\n`);
  console.log(p.text.split("\n").map(l => "  " + l).join("\n"));
  if (p.image) console.log(`\n  + image: ${p.image}`);
  if (p.reply) console.log(`\n  then reply:\n` + p.reply.split("\n").map(l => "    " + l).join("\n"));
  console.log(`\n  Nothing was sent. Run with --send to actually post.`);
}

// ── THE SEND GATE ─────────────────────────────────────────────────────────
// This is a COMPLIANCE CONTROL, not a convenience. X's Original Content Rewards
// program states that content created or posted by AUTOMATED MEANS is
// ineligible. A flag that skips this prompt is not a time-saver; it is the thing
// that makes the account ineligible for the programme we are building toward.
// There is deliberately no --force, no --yes, no non-interactive path, and the
// TTY check below is what makes that structural rather than a promise: a cron
// job, a CI runner and a piped stdin all have no terminal, so none of them can
// reach the network call no matter what arguments they pass.
//
// The thirty-minute question is not friction either. It is the feature. A post
// that goes out when nobody is around to answer replies gets a worse result than
// one that does not go out at all, and the only moment anyone will honestly
// answer "do I have half an hour" is before pressing send.
else if (cmd === "send") {
  const q = await load();
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  const id = flag("id");
  const candidates = q.posts.filter(p => p.status === "queued");
  const p = id ? candidates.find(x => x.id === id) : candidates.filter(x => x.at <= hhmm)[0];
  if (!p) { console.error(id ? `  no queued post with id ${id}` : `  nothing due at ${hhmm}.`); process.exit(1); }

  // 1 — REFUSE ANYTHING THAT IS NOT A PERSON AT A KEYBOARD.
  if (!process.stdin.isTTY) {
    console.error(`\n  REFUSED — no terminal attached.\n` +
      `  This send requires a keystroke from a human being. Content posted by\n` +
      `  automated means is ineligible for X's Original Content Rewards program\n` +
      `  (data/compliance-register.json, retrieved 2026-08-25), so an unattended\n` +
      `  send is not a shortcut — it is how the account stops qualifying.\n` +
      `  There is no flag that overrides this. Run it yourself, in a terminal.\n`);
    process.exit(1);
  }

  // 2 — ORIGINALITY FIRST. No claim, no send.
  const orig = await verdictFor(p.id, p);
  if (orig.verdict !== "PASS") {
    console.error(`\n  REFUSED — originality: ${orig.verdict}`);
    for (const f of orig.fails) console.error(`    FAIL   ${f}`);
    for (const v of orig.reviews) console.error(`    REVIEW ${v}`);
    console.error(`\n  Store a claim first:  node scripts/originality-guard.mjs claim --id ${p.id} ...\n`);
    process.exit(1);
  }

  const capped = capCheck(q, p);
  if (capped) { console.error(`\n  REFUSED — ${capped}\n`); process.exit(1); }

  // 3 — THE POST, EXACTLY AS IT WILL APPEAR. Not a summary of it.
  const rule = "─".repeat(64);
  console.log(`\n${rule}`);
  console.log(p.text);
  if (p.image) {
    const abs = join(ROOT, p.image);
    console.log(`\n[image] ${p.image}${existsSync(abs) || existsSync(p.image) ? "" : "   ✗ FILE NOT FOUND"}`);
  }
  if (p.reply) console.log(`\n[first reply, your words]\n${p.reply}`);
  console.log(`${rule}`);
  console.log(`  ${[...p.text].length} characters · costs $${costOf(p).toFixed(3)}\n`);
  if (p.image && !existsSync(join(ROOT, p.image)) && !existsSync(p.image)) {
    console.error(`  REFUSED — the image does not exist at that path. Nothing sent.\n`);
    process.exit(1);
  }

  const ask = (question, ms) => new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const timer = setTimeout(() => { rl.close(); resolve({ timedOut: true, answer: "" }); }, ms);
    rl.question(question, (a) => { clearTimeout(timer); rl.close(); resolve({ timedOut: false, answer: a.trim() }); });
  });

  const FIVE_MIN = 5 * 60 * 1000;
  // 4 — THE QUESTION THAT IS THE POINT.
  const a1 = await ask("  Do you have 30 minutes right now? (yes/no) ", FIVE_MIN);
  const d1 = evaluateConfirmation({ step: "time", timedOut: a1.timedOut, answer: a1.answer });
  if (!d1.proceed) { console.log(`\n  ${d1.reason}\n`); process.exit(1); }

  // 5 — AND THE KEYSTROKE ITSELF.
  const a2 = await ask(`  Type 'send' to post this. Anything else cancels. `, FIVE_MIN);
  const d2 = evaluateConfirmation({ step: "confirm", timedOut: a2.timedOut, answer: a2.answer });
  if (!d2.proceed) { console.log(`\n  ${d2.reason}\n`); process.exit(1); }

  const confirmedAt = new Date().toISOString();   // the keystroke, in true UTC

  // 6 — SEND. Everything above this line can refuse; nothing below it can.
  let posted;
  try { posted = await postToX(p); }
  catch (e) {
    console.error(`\n  ✗ NOT SENT — ${e.message}`);
    console.error(`  The queue is unchanged. Nothing was marked sent.\n`);
    process.exit(1);
  }

  const when = resolvePostedAt({ at: null, tz: "UTC" });
  Object.assign(p, {
    status: "sent",
    tweetId: posted.id,
    postedAt: when.postedAt,
    hourLocal: when.hourLocal,
    tz: when.tz,
    humanConfirmed: true,
    confirmedAt,
    confirmedVia: "keystroke at an attached terminal",
    replyWindowMinutes: 30,
    windowHonored: null,
  });
  await save(q);
  console.log(`\n  ✓ sent · ${posted.id} · ${when.postedAt} (${when.hourLocal}:00 local)\n`);

  // 7 — THE WINDOW. Replies are Tyler's, in his own words, every time — this
  // counts down and prints the budget, and it does not draft anything.
  await replyWindow(30);
  const a3 = await ask("  Did you answer the replies? (yes/no) ", FIVE_MIN);
  p.windowHonored = /^y/i.test(a3.answer);
  p.windowClosedAt = new Date().toISOString();
  await save(q);
  console.log(`\n  windowHonored: ${p.windowHonored}. Recorded against the post.\n`);
}

else {
  console.log(`post-queue — you write, the machine presses send.

  add   --text "..." [--at 21:15] [--image path] [--reply "..."]
  list
  next            show what would go out now, without sending
  send  [--id X]  post it, for real — asks two questions first

THE SEND GATE IS A COMPLIANCE CONTROL, NOT A CONVENIENCE. X's Original Content
Rewards programme states that content posted by AUTOMATED MEANS is ineligible.
So send refuses if there is no terminal attached, asks whether you have thirty
minutes, and makes you type the word 'send'. There is no --force and no --yes,
and verify-work fails the build if anybody adds one. See "Why the send is
manual" in SYSTEM-README.md before you decide this is friction.

WHAT THIS WILL NOT DO, deliberately:
  · write a post. Every one of yours that worked came from your mood in the
    moment, and none used any of the 84 formulas we generate.
  · post to anybody else's account.
  · send anything you have not read.
  · draft a reply. Posts are assisted; replies are yours, in your own words,
    every time. That is a hard line, not a preference.

COST at your volume: about $0.90/month for two image posts a day. A post with a
LINK costs $0.20 instead of $0.015 — put links in --reply, which is also what
X's reach penalty already told us to do.`);
}
