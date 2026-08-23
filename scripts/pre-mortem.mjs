// pre-mortem.mjs — what would this guard miss?
//
// Tyler, 2026-08-23: "We should be stopping these bugs before they even happen.
// We aren't far from it. Figure out a way."
//
// Every bug today shares one shape. The heartbeat allowed 30 hours and the fault
// was a missed RUN. The sell refusal matched a substring and structure was
// available. The designer checked font-family and the page used the font
// shorthand. The layout table computed the frame and the renderer used its own
// numbers.
//
// **Every one was a check that was right in principle and asked a question whose
// answer could not reveal the fault.** Not a broken guard - a guard aimed
// slightly beside the thing it was guarding.
//
// We already solved this for AGENTS. Every specialist declares its blind spots,
// because a specialist who cannot name the edge of their competence is the one
// who does the damage. **We declare nothing for guards** - so a guard asking the
// wrong question looks exactly like a guard that works, right up until the
// morning it reports green through a failure.
//
// So: every guard declares what it CANNOT catch. Writing that sentence is the
// work. The heartbeat's blind spot was "measures elapsed time, not whether a
// scheduled run happened" - and anybody made to write that down would have seen
// the gap before it cost us a morning.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const declared = await readFile(join(ROOT, "data/guard-blindspots.json"), "utf-8")
  .then(JSON.parse).catch(() => ({ guards: {} }));

// Every guard the audit knows about.
const auditSrc = await readFile(join(ROOT, "scripts/guard-audit.mjs"), "utf-8").catch(() => "");
const guards = [...auditSrc.matchAll(/\{ script: "([a-z-]+\.mjs)"/g)].map(m => m[1]);

const problems = [], notes = [];

// ── 1 · EVERY GUARD DECLARES ITS BLIND SPOT ───────────────────────────────
for (const g of guards) {
  const d = declared.guards?.[g];
  if (!d) { problems.push({ guard: g, what: "no declared blind spot",
    why: "A guard that has never been asked what it would MISS looks identical to one that works. The heartbeat looked identical to one that worked, on the morning it reported green through a failed run." }); continue; }
  if (!d.cannotCatch || d.cannotCatch.length < 20)
    problems.push({ guard: g, what: "blind spot too vague to be useful",
      why: "'Some things' is not a blind spot. The sentence has to be specific enough that reading it reveals the gap - writing it down IS the work." });
  if (!d.reviewed || d.reviewed < "2026-01-01")
    notes.push(`${g}: blind spot never reviewed since it was written`);
}

// ── 2 · THE PATTERNS THAT HAVE ALREADY BITTEN US ──────────────────────────
// Not hypothetical risks - the specific shapes that have shipped, checked
// against every guard, because the same shape recurring is the cheapest bug to
// prevent and we have shipped four of these twice.
const SHAPES = [
  { id: "substring where structure exists", rx: /\.test\(c\.n\)|includes\(c\.name\)|\.test\([a-z]+\.name\)/,
    why: "A name match that looks right is the most reliable way to be catastrophically wrong. /tin/i matched Dratini, Victini, Mantine and Fighting Energy — 174 real singles. 'N' matched inside 'ninja'. Twice in one day.",
    fix: "Match on a field or a set membership, never on a substring of a name." },
  { id: "one syntactic form of two", rx: /font-family:(?![^\n]*font:)/,
    why: "The designer checked font-family: and four healthy pages used the font: shorthand, which sets the family too. Checking one form of a thing that has two forms passes the other silently.",
    fix: "Enumerate the forms, or match on the computed result rather than the source." },
  { id: "platform-dependent path", rx: /await import\((?:P|join)\(/,
    why: "import() needs a URL. A bare path works on Linux and throws on Windows, so it is invisible on the machine that writes it and fatal on the one that runs it — three occurrences.",
    fix: "pathToFileURL(), always." },
  { id: "elapsed time as a proxy for an event", rx: /age\s*>\s*hours|Date\.now\(\)\s*-[^;]*>\s*\d+\s*\*/,
    why: "The heartbeat allowed 30 hours so a LATE run would not cry wolf, and a window built to forgive a late run is exactly the size to hide a SKIPPED one. Green through a failure.",
    fix: "Ask whether the EVENT happened. Compare against the schedule, not against a duration." },
];

for (const g of guards) {
  const src = await readFile(join(ROOT, "scripts", g), "utf-8").catch(() => "");
  if (!src) continue;
  for (const s of SHAPES) {
    if (!s.rx.test(src)) continue;
    const d = declared.guards?.[g];
    // Present AND acknowledged is fine - a known pattern with a stated reason is
    // a decision. Present and unacknowledged is the one that bites.
    const acknowledged = d?.knownPatterns?.includes(s.id);
    if (!acknowledged)
      problems.push({ guard: g, what: `carries the "${s.id}" shape, unacknowledged`,
        why: s.why, fix: s.fix });
  }
}

const out = { generatedAt: new Date().toISOString(),
  principle: "Every bug today was a check that was RIGHT IN PRINCIPLE and asked a question whose answer could not reveal the fault. Not a broken guard — a guard aimed slightly beside the thing it guards. We declare blind spots for every agent and none for guards, so a guard asking the wrong question looks exactly like one that works.",
  guardsChecked: guards.length, declared: Object.keys(declared.guards ?? {}).length,
  shapes: SHAPES.map(s => ({ id: s.id, why: s.why })),
  problems, notes };
await writeFile(join(ROOT, "research/pulse/pre-mortem.json"), JSON.stringify(out, null, 2));

if (problems.length) {
  console.error(`\n✗ PRE-MORTEM — ${problems.length} guard(s) not yet interrogated:\n`);
  for (const p of problems.slice(0, 8)) console.error(`   ${p.guard}: ${p.what}\n     ${p.why}${p.fix ? `\n     → ${p.fix}` : ""}`);
  console.error(`\n   Writing down what a guard CANNOT catch is the work. Anybody made to write\n   "measures elapsed time, not whether a scheduled run happened" would have seen\n   the gap before it cost a morning.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ pre-mortem: ${guards.length} guards, each with a declared blind spot${notes.length ? ` · ${notes.length} unreviewed` : ""}`);
}
