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
{
  const READ_RX = /\bflag\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  for (const file of files) {
    if (file === "flags.mjs" || file === "flag-guard.mjs") continue;
    const src = await readFile(join(ROOT, "scripts", file), "utf-8");
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
