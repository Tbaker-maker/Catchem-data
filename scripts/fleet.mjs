// fleet.mjs — one command, the whole team.
//
// Tyler, 2026-08-24: "I want our agent team saved and deployable. I want them
// used more often."
//
// THE REASON THEY WERE UNDERUSED IS STRUCTURAL, not a discipline problem. Eight
// agents in eight scripts means you have to remember they exist, remember which
// one is relevant, and remember to run it. **A tool you have to remember does
// not get used.**
//
// So: one command. It runs everyone, reports what each found, and says plainly
// which findings need a human — because an agent that reports into a void is
// the same as one nobody runs.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// WHO IS ON THE TEAM, and what each one is actually for. The `blocking` flag
// matters: some of these stop a build and some only advise, and conflating the
// two is how advice gets ignored or how a warning halts everything.
const FLEET = [
  { id: "verify-work", script: "verify-work.mjs", blocking: true,
    does: "Checks finished work against 25 known error classes — the ones we have actually made." },
  { id: "designer", script: "designer.mjs", blocking: false,
    does: "Audits every shipped visual surface: contrast, spacing rhythm, accent discipline, thumbnail legibility." },
  { id: "pre-mortem", script: "pre-mortem.mjs", blocking: true,
    does: "Makes every guard declare what it CANNOT catch. Without this you get a list of checks and a false sense the list is complete." },
  { id: "bias-guard", script: "bias-guard.mjs", blocking: false,
    does: "Tracks who catches what. Currently 16 Tyler, 7 machines — and the split tells you what to automate next." },
  { id: "decision-audit", script: "decision-audit.mjs", blocking: false,
    does: "Reads back decisions whose check-date has arrived, with the prediction made at the time." },
  { id: "competence-guard", script: "competence-guard.mjs", blocking: true,
    does: "Every specialist must declare its knowledge AND its blind spots. A specialist with no stated blind spot is overconfident by construction." },
  { id: "originality-guard", script: "originality-guard.mjs", blocking: true,
    does: "Makes every queued post state what is ORIGINAL about it before it can ship. X's Original Content Rewards program excludes reuploads, watermarks and text overlays that merely describe the image — and our best post is third-party card art with an overlay and a watermark. It cannot judge whether the claim is true; it refuses to let there be no claim." },
  { id: "theme-scout", script: "theme-scout.mjs", blocking: false,
    does: "Mines the catalogue for post ideas nobody asked for — one-offs, long silences, specialists, the year a Pokémon owned." },
  { id: "secret-scan", script: "secret-scan.mjs", blocking: true,
    does: "Scans every TRACKED file for the actual values in .env, rather than guessing what a secret looks like. BLOCKING because a published credential cannot be unpublished - there is no correction page for it. security-agent matches credential SHAPES and reported clean for months while a Formspree endpoint with no distinctive shape sat in ten files." },
  { id: "search-gauntlet", script: "search-gauntlet.mjs", blocking: true,
    does: "Runs real queries against the shipped 16,468-card index and re-derives every relation from the cards it names. BLOCKING because a relation that claims a connection the data does not support becomes a factual claim in a public post - a wrong illustrator credit is the one error this account cannot afford." },
  { id: "outcome-report", script: "outcome-report.mjs", blocking: false,
    does: "Reports what the outcome log can and cannot conclude, leading with what is NOT comparable. ADVISORY BY CONSTRUCTION: it describes the state of the evidence and must never stop a build, because 'we cannot conclude anything yet' is a normal and correct state for a log with five posts in it." },
  { id: "ask-eyes", script: "ask-eyes.mjs", arg: "list", blocking: false,
    does: "The shared question queue. Anything an agent cannot see itself goes here, routed to CC or to Tyler." },
];

const args = process.argv.slice(2);
const only = args.find(a => !a.startsWith("--"));
const quiet = args.includes("--quiet");

const run = (script, arg) => {
  try { return { ok: true, out: execSync(`node ${JSON.stringify(join(ROOT, "scripts", script))} ${arg || ""} 2>&1`, { encoding: "utf-8", timeout: 120000 }) }; }
  catch (e) { return { ok: false, out: String(e.stdout || "") + String(e.stderr || "") }; }
};

if (args.includes("--list")) {
  console.log(`THE FLEET — ${FLEET.length} agents\n`);
  for (const a of FLEET) console.log(`  ${a.id.padEnd(18)}${a.blocking ? "blocking" : "advisory"}\n     ${a.does}\n`);
  process.exit(0);
}

const chosen = only ? FLEET.filter(a => a.id === only) : FLEET;
if (!chosen.length) { console.error(`  no agent called "${only}". Run --list.`); process.exit(1); }

const results = [];
for (const a of chosen) {
  const r = run(a.script, a.arg);
    // THE LAST MARK, NOT THE FIRST. designer and theme-scout both call ask-eyes at
  // the end, so reading the first mark showed the eyes verdict on their rows. An
  // agent's own conclusion comes after anything it delegated.
  const marks = r.out.match(/[✓✗][^\n]{0,90}/g) ?? [];
  const own = marks.filter(m => !/eyes:/.test(m));
  const verdict = (own.length ? own[own.length - 1] : marks[marks.length - 1] ?? "").trim();
  // A CRASH IS NOT A PASS. One agent crashed and printed a blank line for days,
  // which reads as fine in a summary — so an empty verdict is reported as a
  // failure of the agent itself.
  // A ✗ IN THE OUTPUT IS A FAILURE even if the exit code is zero — designer
  // reports findings and exits clean, and reading only the exit code marked it
  // ok beside a message saying otherwise.
  const said = /✗/.test(r.out);
  const crashed = !verdict;
  // AN AGENT THAT QUEUED A QUESTION IS NOT AN AGENT THAT FAILED. theme-scout
  // exits non-zero when it has something for the eyes queue, and treating that
  // as a failure trains people to ignore the column.
  const asked = /queued|for the eyes/i.test(r.out) && /✓/.test(verdict);
  results.push({ ...a, ok: (r.ok || asked) && !crashed && !(said && !asked), crashed, verdict, out: r.out });
}

console.log(`\nFLEET — ${results.length} agent(s)\n`);
for (const r of results) {
  const mark = r.crashed ? "!!" : r.ok ? "ok" : "->";
  console.log(`  ${mark}  ${r.id.padEnd(18)}${r.crashed ? "CRASHED — produced no verdict, which reads as fine in a summary" : r.verdict.slice(0, 78)}`);
}

const failed = results.filter(r => !r.ok);
const blocking = failed.filter(r => r.blocking);

if (!quiet && failed.length) {
  console.log(`\n${"─".repeat(64)}\n`);
  for (const r of failed) {
    console.log(`${r.id.toUpperCase()} — ${r.does}\n`);
    console.log(r.out.split("\n").filter(Boolean).slice(0, 12).map(l => "   " + l).join("\n"));
    console.log();
  }
}

console.log(`${"─".repeat(64)}`);
if (blocking.length) {
  console.log(`\n✗ ${blocking.length} BLOCKING agent(s) failed: ${blocking.map(r => r.id).join(", ")}`);
  console.log(`   These stop a build. Fix before shipping.\n`);
  process.exitCode = 1;
} else if (failed.length) {
  console.log(`\n${failed.length} advisory finding(s): ${failed.map(r => r.id).join(", ")}`);
  console.log(`   Nothing is blocked. These are opinions worth reading, not errors.\n`);
} else {
  console.log(`\n✓ every agent reports clean\n`);
}
