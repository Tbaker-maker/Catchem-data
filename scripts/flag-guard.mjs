// flag-guard.mjs — one condition, one gate.
//
// 2026-08-23: chat and CC each added a PPT licensing gate to the same function,
// independently, in the same hour. Both edits were correct in isolation. The
// second silently overrode the first, and a ruling Tyler had just given did not
// take effect. Nobody was wrong; the ARCHITECTURE allowed two gates for one
// condition to stack invisibly.
//
// This enforces the fix: gates live as named keys in data/flags.json, code
// reads them through flags.mjs, and a condition may be gated in exactly one
// place. A second author adding the same gate now collides in git — visible —
// instead of stacking — invisible.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let reg;
try { reg = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf-8")); }
catch { console.log("· flag-guard: no registry, nothing to check"); process.exit(0); }

const problems = [];
const flags = reg.flags || {};

// 1 — every registered flag must have an owner, a reason and a trigger.
for (const [name, f] of Object.entries(flags)) {
  if (!f.owner) problems.push(`${name}: no owner file — nobody knows where this gate lives`);
  if (!f.why) problems.push(`${name}: no reason recorded`);
  if (!f.trigger) problems.push(`${name}: no trigger — nothing says when to revisit it`);
}

// 2 — each flag may be READ anywhere, but declared in exactly one place.
const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
for (const [name, f] of Object.entries(flags)) {
  const readers = [];
  for (const file of files) {
    const src = await readFile(join(ROOT, "scripts", file), "utf-8");
    if (src.includes(`flag("${name}")`) || src.includes(`flag('${name}')`)) readers.push(file);
  }
  if (f.owner && readers.length && !readers.includes(f.owner.split("/").pop()))
    problems.push(`${name}: owner is ${f.owner} but it is read in ${readers.join(", ")} — update the owner or move the gate`);
}

// 2b — a flag READ but never REGISTERED. This crashed social-posts.mjs every
// run on 2026-08-23: SITE was migrated to the registry and the key was never
// added, so flag() threw and took the rest of the pipeline with it.
//
// ONLY IN FILES THAT ACTUALLY IMPORT THE REGISTRY HELPER. This check matched
// any function called flag(), and "flag" is the obvious name for a five-line
// CLI argument reader — card-relations, read-metrics, experiment, post-queue
// and originality-guard each declare their own:
//
//     const flag = (n) => { const i = args.indexOf("--" + n); ... };
//
// Those are local helpers over process.argv. They cannot throw on an
// unregistered key because there is no registry behind them, and --limit is
// not a feature gate. The guard reported 36 problems, every one a false
// positive, AND IT TOOK THE DAILY PRICE PIPELINE DOWN WITH IT: generate-pulse
// runs this guard, exited 1, and the "Commit updated prices" step is 29 lines
// further down the workflow and never ran. Six consecutive runs fetched
// prices, computed heat states, built every page — and committed nothing,
// because a guard was wrong about code it should not have been reading.
//
// A guard that fails on correct code is worse than no guard. It does not just
// fail to catch things; it stops real work, and the noise trains people to
// stop reading it.
{
  const READ_RX = /\bflag\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  const IMPORTS_REGISTRY = /from\s+["']\.\/flags\.mjs["']/;
  for (const file of files) {
    if (file === "flags.mjs" || file === "flag-guard.mjs") continue;
    const src = await readFile(join(ROOT, "scripts", file), "utf-8");
    // A local `const flag = ...` shadows the import even where both exist, so
    // a file that declares its own is not reading the registry here.
    if (!IMPORTS_REGISTRY.test(src)) continue;
    if (/\bconst\s+flag\s*=/.test(src)) continue;
    let m;
    while ((m = READ_RX.exec(src)))
      if (!flags[m[1]]) problems.push(`scripts/${file}: reads flag "${m[1]}" which is not in data/flags.json — flag() will throw and stop the run`);
  }
}

// 3 — the shape that caused the incident: a condition gated by a bare env var
// or a hand-rolled constant, outside the registry.
const SUSPECT = /const\s+([A-Z_]{4,})\s*=\s*process\.env\.[A-Z_]+\s*[!=]==/g;
for (const file of files) {
  if (file === "flags.mjs" || file === "flag-guard.mjs") continue;
  const src = await readFile(join(ROOT, "scripts", file), "utf-8");
  let m;
  while ((m = SUSPECT.exec(src)))
    problems.push(`scripts/${file}: "${m[1]}" gates on an env var directly instead of a registered flag — this is exactly how two gates for one condition got stacked. Register it in data/flags.json and read it through flags.mjs.`);
}

if (problems.length) {
  console.error(`\n✗ FLAG GUARD — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("\n   One condition, one gate, one owner. Register it rather than re-implementing it.\n");
  process.exit(1);
}
console.log(`✓ flag guard: ${Object.keys(flags).length} gates, each registered once with an owner and a trigger`);
