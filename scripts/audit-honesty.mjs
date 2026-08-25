// audit-honesty.mjs — did the audit test what the claim covered?
//
// Tyler, 2026-08-24: "I asked for an audit and you told me it would work. Not
// acceptable to fail this many times. Make a safeguard and an agent to make sure
// mistakes like this don't continue happening."
//
// THE PATTERN, stated plainly. I have now said "audited, all green" three times
// and been wrong three times, and every single one had the same shape:
//
//   1. The editor "worked" — my harness supplied a fetch that always succeeded
//   2. Mobile was "audited" — every test ran a simulated desktop DOM
//   3. The prompt chain was "audited" — five tests, none pressed Make the image,
//      and my harness made every image load
//
// **Every failure was a test that faked the thing that actually breaks.**
//
// So this agent asks one question of every guard: does it FAKE a dependency
// that can fail in the real world, and does it test the failing case as well as
// the working one? A test that only runs the happy path is testing the absence
// of the bug.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The things a guard can fake. Each is a real-world failure we have already hit.
const FAKES = [
  { id: "fetch", rx: /globalThis\.fetch\s*=/, fail: /throw|reject|ok:\s*false/,
    why: "a stubbed fetch that always succeeds hid the file:// failure that made the editor render nothing" },
  { id: "Image", rx: /globalThis\.Image\s*=/, fail: /onerror/,
    why: "an Image that always loads hid the compose throwing on the first card that would not load" },
  { id: "document", rx: /globalThis\.document\s*=/, fail: /present\.has|=> null/,
    why: "a document returning a stub for every id made a missing element look identical to a present one" },
];

const files = (await readdir(join(ROOT, "scripts")))
  .filter(f => /-smoke\.mjs$|^editor-.*\.mjs$/.test(f));

const problems = [];
for (const f of files) {
  const src = await readFile(join(ROOT, "scripts", f), "utf-8");
  // ONLY WHAT IT EXERCISES. A guard that stubs Image and never composes is not
  // hiding anything, and flagging it twelve times would mute the check — the
  // lesson I logged this morning and then ignored writing this.
  const exercises = {
    fetch: /runAsk|search\(\)|renderThemes|INDEX =/.test(src),
    Image: /\.make\(\)|compose\(|onclick\(\)|toBlob|toDataURL/.test(src),
    document: /getElementById/.test(src),
  };
  for (const fake of FAKES) {
    if (!fake.rx.test(src)) continue;
    if (!exercises[fake.id]) continue;
    if (fake.fail.test(src)) continue;
    problems.push(`${f} exercises ${fake.id} and never tests it FAILING — ${fake.why}`);
  }
}

// And the honesty check on the claim itself: a guard must not report success
// without having asserted anything.
for (const f of files) {
  const src = await readFile(join(ROOT, "scripts", f), "utf-8");
  const asserts = (src.match(/problems\.push|fails\.push|process\.exitCode/g) ?? []).length;
  const says = /console\.log\(`?✓/.test(src);
  if (says && asserts < 2) problems.push(`${f} prints a ✓ but makes fewer than two assertions — a guard that reports success without checking is decoration`);
  if (/problems\.push\(\)|fails\.push\(\)/.test(src)) problems.push(`${f} has an EMPTY push — it detects the fault and reports nothing`);
}

if (problems.length) {
  console.error(`\n✗ AUDIT HONESTY — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("   " + p);
  console.error(`\n   Every "audited, all green" that turned out wrong was a test that\n   FAKED the thing that actually breaks. A test that only runs the happy\n   path is testing the absence of the bug.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ audit honesty: ${files.length} guard(s) — every faked dependency is also tested FAILING, and none reports success without asserting`);
}
