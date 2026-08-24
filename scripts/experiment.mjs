// experiment.mjs — trial and error, with a design.
//
// Tyler, 2026-08-24: "I feel as we can perfect this model with a lot of trial
// and error."
//
// Agreed, and this exists because of what today already proved. I logged the
// Arita pairing at 154 views, compared it to a crop at 791, and concluded the
// crop shape won five to one. **Same post, better hour: 18,800.** I drew a
// conclusion about FORMAT from numbers that were mostly measuring HOUR, with
// n=1 per shape, in the same session where I said the log needed twenty entries
// to mean anything. Then AGE turned out to be a second confound an hour later.
//
// **Trial and error without a design produces confident wrong answers faster.**
// That is not a reason to skip it. It is a reason to fix the design now, while
// nothing is riding on it.
//
// THE RULE THIS ENFORCES: change ONE thing at a time, hold the hour constant,
// let every post settle to the same age before comparing, and state up front
// what result would prove the idea WRONG.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/experiments.json");

const load = async () => { try { return JSON.parse(await readFile(FILE, "utf-8")); }
  catch { return { note: "One variable at a time, hour held constant, same settling age before comparing, and a falsifier written before the first post. Today's lesson: I ranked two formats on numbers that were measuring the hour.", experiments: [] }; } };
const save = async (x) => writeFile(FILE, JSON.stringify(x, null, 1));

// Views keep climbing for days, so anything younger than this is still
// accumulating and cannot be compared to a settled post.
const SETTLE_HOURS = 48;

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (n) => { const i = args.indexOf("--" + n); return i >= 0 ? args[i + 1] : null; };

if (cmd === "start") {
  const x = await load();
  const variable = flag("variable"), a = flag("a"), b = flag("b"), falsifier = flag("falsifier");
  if (!variable || !a || !b) { console.error("  need --variable, --a, --b"); process.exit(1); }
  if (!falsifier) {
    // A test with no stated wrong answer is a test that confirms whatever you
    // hoped. Refusing here is cheaper than discovering it in the results.
    console.error("  --falsifier is required. What result would prove this idea WRONG?\n  A test with no stated wrong answer confirms whatever you already believed.");
    process.exit(1);
  }
  x.experiments.push({ id: "x" + Date.now().toString(36), variable, a, b, falsifier,
    hour: flag("hour") ?? "21:15",
    started: new Date().toISOString(), status: "running", posts: [] });
  await save(x);
  console.log(`✓ experiment started: ${variable}\n  A: ${a}\n  B: ${b}\n  hour held at ${flag("hour") ?? "21:15"} for BOTH — the hour is the confound that already caught us once\n  wrong if: ${falsifier}\n\n  Post at least 3 of each before reading anything.`);
}

else if (cmd === "log") {
  const x = await load();
  const exp = x.experiments.find(e => e.status === "running");
  if (!exp) { console.error("  no experiment running"); process.exit(1); }
  const arm = flag("arm"), views = Number(flag("views")), replies = Number(flag("replies") ?? 0);
  if (!["a", "b"].includes(arm) || !views) { console.error("  need --arm a|b and --views"); process.exit(1); }
  exp.posts.push({ arm, views, replies, likes: Number(flag("likes") ?? 0),
    postedAt: flag("at") ?? new Date().toISOString(), logged: new Date().toISOString() });
  await save(x);
  const n = { a: exp.posts.filter(p => p.arm === "a").length, b: exp.posts.filter(p => p.arm === "b").length };
  console.log(`✓ logged. A: ${n.a}  B: ${n.b}${n.a < 3 || n.b < 3 ? `  — need 3 of each before this means anything` : ""}`);
}

else if (cmd === "read") {
  const x = await load();
  const exp = x.experiments.find(e => e.status === "running");
  if (!exp) { console.log("  no experiment running"); process.exit(0); }
  const age = (p) => (Date.now() - Date.parse(p.postedAt)) / 3600000;
  const settled = exp.posts.filter(p => age(p) >= SETTLE_HOURS);
  const young = exp.posts.filter(p => age(p) < SETTLE_HOURS);

  console.log(`EXPERIMENT: ${exp.variable}\n  A: ${exp.a}\n  B: ${exp.b}\n  wrong if: ${exp.falsifier}\n`);
  if (young.length) console.log(`  ${young.length} post(s) under ${SETTLE_HOURS}h — still accumulating, EXCLUDED. Age was the second confound that caught me.\n`);

  const arm = (k) => settled.filter(p => p.arm === k);
  const med = (l, f) => l.length ? l.map(f).sort((a, b) => a - b)[Math.floor(l.length / 2)] : null;
  for (const k of ["a", "b"]) {
    const l = arm(k);
    if (!l.length) { console.log(`  ${k.toUpperCase()}: no settled posts yet`); continue; }
    // REPLY-TO-LIKE IS THE CONVERSATION METRIC. Crambo got 68 replies against
    // 73 likes where a normal post runs nearer 10% — views measure an audience
    // watching, this measures a room talking.
    const rtl = l.reduce((s, p) => s + (p.likes ? p.replies / p.likes : 0), 0) / l.length;
    console.log(`  ${k.toUpperCase()}: ${l.length} post(s) · median ${med(l, p => p.views).toLocaleString()} views · reply-to-like ${Math.round(rtl * 100)}%`);
  }

  const A = arm("a"), B = arm("b");
  console.log();
  if (A.length < 3 || B.length < 3) {
    console.log(`  ${3 - Math.min(A.length, B.length)} more of the thinner arm before reading this. Two data points ranked the HOUR last time, not the format.`);
  } else {
    const mA = med(A, p => p.views), mB = med(B, p => p.views);
    const ratio = mA > mB ? mA / mB : mB / mA;
    // Under a 2x gap with this few posts, the difference is noise wearing a
    // number. Saying so is the whole point of the tool.
    console.log(ratio < 2
      ? `  ${Math.round((ratio - 1) * 100)}% apart on ${A.length + B.length} posts. That is noise wearing a number — no finding.`
      : `  ${(mA > mB ? "A" : "B")} leads by ${ratio.toFixed(1)}x on ${A.length + B.length} settled posts. Worth acting on, still worth another round.`);
  }
}

else {
  console.log(`experiment — trial and error, with a design.

  start --variable "..." --a "..." --b "..." --falsifier "..." [--hour 21:15]
  log   --arm a|b --views N [--replies N] [--likes N] [--at ISO]
  read

FOUR RULES, each from a mistake already made:
  · ONE variable at a time. I ranked two formats on numbers that were
    measuring the hour — 154 views versus 18,800 for the SAME post.
  · The HOUR is held constant across both arms. It is the confound that
    caught me first.
  · Nothing under ${SETTLE_HOURS}h counts. Age was the second confound, found
    an hour after the first.
  · A FALSIFIER is required before the first post. A test with no stated wrong
    answer confirms whatever you already believed.`);
}
