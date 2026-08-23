// bias-guard.mjs — I built the thing that checks my work.
//
// Tyler, 2026-08-23: "How do we make sure you're not biased to yourself?"
//
// The conflict is real and unavoidable: I wrote verify-work.mjs, I chose which
// five failure classes it checks, and I decide how strict each rule is. Every
// one of those choices is made by the person the tool is meant to catch. No
// amount of care fixes that, because the bias would not feel like bias — a
// lenient rule feels like a reasonable rule.
//
// SO IT IS MEASURED, NOT PROMISED. Three mechanisms:
//
//  1. WHO CAUGHT IT. The error ledger records the discoverer of every incident.
//     If Tyler keeps catching things the machines miss, the machines are
//     decorative. Today: he caught 11 of 13. That ratio IS the score.
//  2. NO CHERRY-PICKING. Every class in the ledger must map to a check. I do
//     not get to decide which of my mistakes are worth guarding against.
//  3. A SILENT VERIFIER IS A SUSPECT VERIFIER. A checker that never fires is
//     either perfect or blind, and blind is the safer assumption.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const ledger = await R("research/RESEARCH-GATE.md");
const verifier = await R("scripts/verify-work.mjs");
const rows = ledger.split("\n").filter(l => /^\| \d+ \|/.test(l));
const problems = [], notes = [];

// ── 1 · WHO IS ACTUALLY CATCHING THINGS ────────────────────────────────────
{
  let human = 0, machine = 0;
  for (const row of rows) {
    const cells = row.split("|").map(c => c.trim());
    const finder = (cells[3] ?? "").toLowerCase();
    if (/tyler|by eye|verifying|noticed/.test(finder)) human++;
    else if (/guard|pipeline|breaker|audit|assert|lint|agent|test|falsifier|^cc|\bcc\b|scout|designer|by measuring|by attacking|actions log/.test(finder)) machine++;
  }
  const total = human + machine;
  const machineShare = total ? Math.round(machine / total * 100) : 0;
  notes.push(`${machine} caught by machines, ${human} by Tyler (${machineShare}% machine)`);
  if (total >= 5 && machineShare < 40)
    problems.push({ severity: "high",
      what: `Tyler catches ${human} of ${total} incidents; the machines catch ${machine}`,
      why: "Every guard here was written by the party being checked. If the human keeps finding what the tooling misses, the tooling is calibrated to what I already believed rather than to what actually goes wrong. That is what self-bias looks like from the outside — not a wrong rule, an absent one." });
}

// ── 2 · DID I CHERRY-PICK WHICH MISTAKES TO GUARD? ─────────────────────────
{
  // Every ledger row names a CLASS in its fourth column. Each should be
  // reachable by something in the verifier, or I have quietly decided some of
  // my mistakes do not need watching.
  const classes = rows.map(r => (r.split("|")[4] ?? "").trim().toLowerCase()).filter(Boolean);
  const unguarded = [];
  for (const c of new Set(classes)) {
    const words = c.split(/\W+/).filter(w => w.length > 4);
    const covered = words.some(w => verifier.toLowerCase().includes(w));
    if (!covered && words.length) unguarded.push(c.slice(0, 46));
  }
  if (unguarded.length)
    problems.push({ severity: unguarded.length > classes.length / 2 ? "high" : "medium",
      what: `${unguarded.length} error class(es) in the ledger have no matching check: ${unguarded.slice(0, 4).join("; ")}`,
      why: "I chose which classes the verifier covers, and I am the one it checks. Any class I skipped is a mistake I decided was not worth guarding — which is exactly the decision I should not be making alone." });
}

// ── 3 · HAS THE VERIFIER EVER ACTUALLY FIRED? ──────────────────────────────
{
  const hist = await J("data/agent-history.json") ?? { runs: {} };
  const runs = (hist.runs?.["verify-work"] ?? []);
  const everFired = runs.some(r => r.count > 0);
  if (runs.length >= 5 && !everFired)
    problems.push({ severity: "medium",
      what: `verify-work has run ${runs.length} times and never found anything`,
      why: "A checker that never fires is either perfect or blind. Blind is the safer assumption, and the way to tell is to break something on purpose and confirm it notices." });
  else if (runs.length) notes.push(`verify-work has fired on ${runs.filter(r => r.count > 0).length} of ${runs.length} runs`);
}

// ── 4 · CAN I WEAKEN IT WITHOUT ANYTHING NOTICING? ─────────────────────────
{
  const tests = await R("scripts/negative-tests.mjs");
  const guarded = /verify-work/.test(tests);
  if (!guarded)
    problems.push({ severity: "high",
      what: "no negative test covers verify-work",
      why: "Without one I can soften a rule and nothing fails. A self-check that can be quietly relaxed by the party it checks is not a control." });
}

const out = { generatedAt: new Date().toISOString(),
  conflict: "The work verifier was written by the party it checks, which chose its rules and their strictness. That cannot be fixed by care — a lenient rule feels like a reasonable rule. It can only be measured.",
  theScore: "Who catches our errors. If the human keeps finding what the machines miss, the machines are decorative however many there are.",
  notes, problems };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/bias-guard.json"), JSON.stringify(out, null, 1));

if (problems.some(p => p.severity === "high")) {
  console.error(`\n✗ BIAS — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   [${p.severity}] ${p.what}\n     ${p.why}`);
  console.error("");
  process.exitCode = 1;
} else {
  console.log(`✓ bias guard: ${notes.join(" · ")}`);
  for (const p of problems) console.log(`  [${p.severity}] ${p.what}`);
}
