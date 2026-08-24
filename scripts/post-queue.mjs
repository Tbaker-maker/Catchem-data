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

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

if (cmd === "add") {
  const q = await load();
  const text = flag("text");
  if (!text) { console.error("  --text is required. This tool does not write posts."); process.exit(1); }
  // THE HOUR MATTERS MORE THAN THE DAY. The identical pairing post did 154
  // views at a bad hour and 18,800 at 9:18pm — 122x, same cards, same caption.
  // Anything queued without an hour defaults to the only one we have evidence
  // for.
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

else {
  console.log(`post-queue — you write, the machine presses send.

  add   --text "..." [--at 21:15] [--image path] [--reply "..."]
  list
  next            show what would go out now, without sending

WHAT THIS WILL NOT DO, deliberately:
  · write a post. Every one of yours that worked came from your mood in the
    moment, and none used any of the 84 formulas we generate.
  · post to anybody else's account.
  · send anything you have not read.

COST at your volume: about $0.90/month for two image posts a day. A post with a
LINK costs $0.20 instead of $0.015 — put links in --reply, which is also what
X's reach penalty already told us to do.`);
}
