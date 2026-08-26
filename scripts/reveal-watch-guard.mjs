// ── REVEAL WATCH GUARD — BLOCKING ──────────────────────────────────────────
// The confirm gate exists for compliance reasons, and a fast-moving feed is
// exactly where somebody would be tempted to skip it. "It's just a reveal, it's
// time-sensitive, Tyler would obviously want this one" is a completely
// reasonable sentence and it is how an unreviewed post reaches a public account.
//
// So the rule is structural rather than a matter of remembering: reveal-watch
// may not import, reference, or reach the send path. If it ever does, this
// fails the build — before the post, not after it.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Anything that can actually cause a post to leave the machine.
const SEND_PATH = [
  "send-gate.mjs", "post-queue.mjs", "x-auth.mjs", "signedFetch",
  "api.twitter.com", "statuses/update", "/2/tweets",
];

const WATCHED = ["reveal-watch.mjs"];

let problems = [];

for (const file of WATCHED) {
  let src;
  try { src = await readFile(join(ROOT, "scripts", file), "utf-8"); }
  catch { problems.push(`${file} is missing — the guard cannot pass vacuously`); continue; }

  for (const needle of SEND_PATH) {
    // A mention inside a comment is how the rule gets EXPLAINED, so only count
    // it where it appears in live code.
    const live = src.split("\n")
      .filter(l => { const t = l.trim(); return t && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*"); })
      .join("\n");
    if (live.includes(needle))
      problems.push(`${file} references "${needle}" in live code — reveals must be QUEUED for Tyler, never sent`);
  }

  // Every recorded reveal must arrive queued and unposted. A default of
  // posted:true, or a status that does not say who decides, is the same failure
  // written in data instead of code.
  if (!/status:\s*"QUEUED FOR TYLER"/.test(src))
    problems.push(`${file} no longer stamps status "QUEUED FOR TYLER" on new reveals`);
  if (!/posted:\s*false/.test(src))
    problems.push(`${file} no longer defaults posted:false`);
}

// And the data itself: nothing may be marked posted by this pipeline.
try {
  const data = JSON.parse(await readFile(join(ROOT, "data/reveal-watch.json"), "utf-8"));
  const wrong = (data.reveals ?? []).filter(r => r.posted === true && r.status !== "POSTED BY TYLER");
  for (const r of wrong)
    problems.push(`data/reveal-watch.json: "${r.name}" is marked posted without Tyler's stamp`);
  console.log(`  ${(data.reveals ?? []).length} reveal(s) on file · ${(data.reveals ?? []).filter(r => !r.posted).length} queued`);
} catch { /* no file yet is fine — nothing has been recorded */ }

console.log("");
if (problems.length) {
  console.log("✗ REVEAL WATCH GUARD FAILED:");
  for (const p of problems) console.log(`   ${p}`);
  console.log("\nReveals are queued for a human. That is not a style preference — the confirm");
  console.log("gate is a compliance control, and speed is the argument that gets it skipped.");
  process.exit(1);
}
console.log("✓ reveal watch: queued for Tyler, no route to the send path");
