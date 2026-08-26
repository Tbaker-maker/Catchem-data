// ── REPLY LINE GUARD — BLOCKING ────────────────────────────────────────────
// Tyler, 2026-08-26: "The reply advantage stays human. No agent drafts replies,
// suggests replies, or queues reply text. The research agent may surface WHERE
// a conversation is happening; what gets said is his."
//
// A policy written in a document is a policy until somebody edits the document.
// This is the same rule expressed as a build failure, so crossing it takes a
// deliberate act rather than a plausible-looking commit.
//
// WHY THE LINE IS WHERE IT IS. Tyler's reply practice is the strongest asset
// this account has, and it works because a person is actually typing. The moment
// a drafted reply exists in a queue, it gets used on a tired evening — and the
// property that made it work is gone immediately, not gradually. There is no
// version of a suggested reply that is a little bit human.
//
// WHAT IS ALLOWED: naming a conversation. An account, a thread, a question with
// replies worth reading. Surfacing WHERE is the whole of the help.
// WHAT IS NOT: a draft, an opening line, a suggested phrasing, a queued reply
// body — under any field name.
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Field names that would hold reply TEXT. Naming a thread is fine; holding the
// words is not.
const REPLY_TEXT_FIELDS = [
  "replyText", "replyDraft", "draftReply", "suggestedReply", "replySuggestion",
  "replyBody", "replyCopy", "proposedReply", "replies_draft",
];

// Instructions that would make a model produce one.
const DRAFTING_PHRASES = [
  "draft a reply", "draft the reply", "suggest a reply", "write a reply",
  "compose a reply", "propose a reply", "reply text for", "draft replies",
];

const problems = [];
let scanned = 0;

// 1. No script may declare a field that holds reply text.
const files = (await readdir(join(ROOT, "scripts"), { recursive: true }))
  .filter(f => f.endsWith(".mjs") && !f.endsWith("reply-line-guard.mjs"));

for (const rel of files) {
  const src = await readFile(join(ROOT, "scripts", rel), "utf-8");
  scanned++;
  const live = src.split("\n")
    .filter(l => { const t = l.trim(); return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
    .join("\n");
  for (const f of REPLY_TEXT_FIELDS) {
    if (new RegExp(`\\b${f}\\b`).test(live))
      problems.push(`scripts/${rel} declares "${f}" — that field holds reply TEXT, which is Tyler's to write`);
  }
  // POLARITY MATTERS, AND MY FIRST VERSION IGNORED IT. post-queue.mjs carries
  // "draft a reply" inside a list headed "WHAT THIS WILL NOT DO, deliberately"
  // — a PROHIBITION, and the very rule this guard enforces. Flagging it made a
  // correct file look like a violation, which is the fifth time today a guard
  // matched words without reading what they were doing.
  //
  // So a phrase only counts as a crossing when nothing near it refuses it.
  const REFUSES = /\b(will not|won't|never|cannot|can't|does not|doesn't|do not|don't|refuses?|forbidden|prohibited|no agent)\b/i;
  // ORIGINAL LINE NUMBERS, NOT FILTERED ONES. The first version reported a line
  // from the comment-stripped copy, which pointed twelve lines away at unrelated
  // code — a finding nobody can act on is barely a finding.
  const lines = src.split(String.fromCharCode(10));
  for (const p of DRAFTING_PHRASES) {
    lines.forEach((line, i) => {
      if (!line.toLowerCase().includes(p)) return;
      const tl = line.trim();
      if (tl.startsWith("//") || tl.startsWith("*")) return;  // a comment explaining the rule
      // A REFUSAL ONLY COUNTS IF IT GOVERNS THIS LINE. Scanning twelve lines
      // for any negation word was too loose in both directions: it let a stray
      // "refused" in unrelated help text suppress a genuine crossing. So the
      // refusal must be on THIS line, or in a HEADING above it — a line ending
      // in a colon, which is what actually governs a bullet list. That is the
      // real shape in post-queue.mjs: "WHAT THIS WILL NOT DO, deliberately:"
      // followed by four bullets, one of which is "draft a reply".
      if (REFUSES.test(line)) return;
      const governed = lines.slice(Math.max(0, i - 12), i)
        .some(l => l.trim().endsWith(":") && REFUSES.test(l));
      if (governed) return;
      problems.push(`scripts/${rel}:${i + 1} instructs a model to "${p}" — surfacing WHERE a conversation is happening is allowed; supplying the words is not`);
    });
  }
}

// 2. The brief must still carry the line. A guard that survives while the
// instruction it enforces is deleted protects nothing a reader can find.
const brief = await readFile(join(ROOT, "research/RESEARCH_PROMPT.md"), "utf-8").catch(() => "");
if (!brief) problems.push("research/RESEARCH_PROMPT.md is missing — the reply line lives there");
else if (!/No agent drafts, suggests, or queues reply text/i.test(brief))
  problems.push("research/RESEARCH_PROMPT.md no longer states the reply line — it was removed or reworded");

// 3. Nothing may write reply text into the observed archive.
const obs = await readFile(join(ROOT, "data/observed-posts.json"), "utf-8").catch(() => "");
if (obs) {
  try {
    for (const p of (JSON.parse(obs).posts ?? []))
      for (const f of REPLY_TEXT_FIELDS)
        if (p[f]) problems.push(`data/observed-posts.json: an entry carries "${f}"`);
  } catch { problems.push("data/observed-posts.json is not valid JSON"); }
}

console.log("REPLY LINE — no agent drafts, suggests, or queues reply text\n");
console.log(`  ${scanned} script(s) scanned · brief ${brief ? "present" : "MISSING"}\n`);

if (problems.length) {
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log("");
  console.log("✗ REPLY LINE CROSSED. Tyler's reply practice works because a person is");
  console.log("actually typing. A drafted reply gets used on a tired evening and the");
  console.log("property that made it work is gone immediately, not gradually.");
  console.log("");
  console.log("Surface WHERE a conversation is happening. The words are his.");
  process.exit(1);
}
console.log("✓ reply line: nothing drafts, suggests or queues reply text");
