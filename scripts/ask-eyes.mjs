// ask-eyes.mjs — the shared question queue.
//
// Tyler, 2026-08-23: "Make sure this loop works with all of our agents, especially
// the manager and the ones that NEED to see this stuff to review."
//
// Ten of eleven specialists carry a declared blind spot that only somebody else
// can resolve. The designer cannot see a rendered page. The experience agent
// cannot see the app. The creator agent cannot watch a video. The theme scout
// can tell you a pattern is unusual but never that it is interesting. Until now
// each of them wrote that limitation into its own report and there it stayed,
// which is the same as not having said it.
//
// This is one queue for all of them. An agent asks, whoever can see answers, and
// the answer comes back into the same file. Three rules make it work rather than
// becoming another list nobody reads:
//
//   1. EVERY QUESTION CARRIES ITS NUMBER. "The typography feels inconsistent"
//      hands over uncertainty with no evidence. "Seven corner radii: 6, 9, 10,
//      11, 13, 14, 16" leaves exactly one judgment to a human.
//   2. EVERY QUESTION NAMES WHO CAN ANSWER IT. A question addressed to nobody is
//      a note.
//   3. AN ANSWERED QUESTION IS NEVER ASKED AGAIN. An agent that re-raises a
//      settled point trains the reader to skim it.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "research/pulse/open-questions.json");

const load = async () => {
  try { return JSON.parse(await readFile(FILE, "utf-8")); }
  catch { return { note: "Questions agents cannot answer from where they stand. Answered ones are kept so nobody asks twice.", questions: [] }; }
};

// who: "cc" (can see rendered output and run a browser) · "tyler" (taste, and
// anything outside the repo) · "chat" (reads code, knows what generated what)
export async function ask(agent, { question, evidence = null, who = "cc" }) {
  const store = await load();
  const existing = store.questions.find(q => q.question === question);
  if (existing) {
    // Already answered? Then it is settled and must not resurface. Not yet
    // answered? Count how long it has waited - an old unanswered question is
    // either badly phrased or addressed to the wrong person.
    if (!existing.answer) { existing.asked = (existing.asked ?? 1) + 1; existing.lastAsked = new Date().toISOString().slice(0, 10); }
    await writeFile(FILE, JSON.stringify(store, null, 1));
    return existing;
  }
  const entry = { id: `${agent}-${store.questions.length + 1}`, agent, question, evidence, who,
    firstAsked: new Date().toISOString().slice(0, 10), lastAsked: new Date().toISOString().slice(0, 10),
    asked: 1, answeredBy: null, answer: null, answeredOn: null };
  store.questions.push(entry);
  await writeFile(FILE, JSON.stringify(store, null, 1));
  return entry;
}

export async function open(who = null) {
  const store = await load();
  return store.questions.filter(q => !q.answer && (!who || q.who === who));
}

export async function stale(days = 7) {
  const store = await load();
  const cutoff = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  // A question asked five times and never answered is not waiting - it is
  // failing. Either nobody can answer it or nobody understands it.
  return store.questions.filter(q => !q.answer && q.firstAsked < cutoff);
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const store = await load();
  const unanswered = store.questions.filter(q => !q.answer);
  const answered = store.questions.filter(q => q.answer);
  const old = await stale();
  console.log(`  ${unanswered.length} open · ${answered.length} answered · ${old.length} waiting over a week\n`);
  const byWho = {};
  for (const q of unanswered) (byWho[q.who] ||= []).push(q);
  for (const [who, list] of Object.entries(byWho)) {
    console.log(`  FOR ${who.toUpperCase()} — ${list.length}`);
    for (const q of list.slice(0, 4)) console.log(`     [${q.agent}] ${q.question.slice(0, 92)}`);
  }
  if (old.length) {
    console.log(`\n  ⚠ ${old.length} question(s) unanswered for over a week.`);
    console.log(`    A question nobody answers is either badly phrased or addressed to the wrong person.`);
  }
}
