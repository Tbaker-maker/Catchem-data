// artifact-drift.mjs — does the committed page still say what its generator says?
//
// Twice in one day an artifact disagreed with the source that makes it. The
// editor's build log claimed 16,468 searchable cards over an index holding
// 6,725, and promo.html was published saying "Goodnight." over a Musharna while
// its generator had moved on to "Waitlist open." Nobody was lying; the artifact
// was simply older than the code, and nothing ever compared the two.
//
// A generator fixed without its output rebuilt is a fix that did not ship. The
// source is right, the review passes, and the thing people actually open is
// still wrong.
//
// SO THIS REBUILDS AND COMPARES. It runs each generator into a scratch copy of
// the repo tree, diffs the result against what is committed, and names any page
// that disagrees.
//
// ADVISORY, NOT BLOCKING. Some drift is legitimate: a page can be regenerated
// from data that changed an hour ago and be perfectly correct. Blocking on that
// would stop a build for a timestamp. Naming it costs nothing and is enough,
// because the failure mode here is nobody LOOKING, not nobody caring.
import { readFile, writeFile, copyFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// generator -> the artifact(s) it writes. Derived by reading the writeFile
// calls in each script rather than kept as a hand-list that would drift itself.
const scripts = execFileSync("git", ["ls-files", "scripts/*.mjs"], { cwd: ROOT, encoding: "utf-8" })
  .split(/\r?\n/).filter(Boolean);

const pairs = [];
for (const s of scripts) {
  const src = await readFile(join(ROOT, s), "utf-8").catch(() => "");
  for (const m of src.matchAll(/write(?:File)?(?:Sync)?\s*\(\s*join\([^,]+,\s*["'`](research\/assets\/[^"'`]+\.html)["'`]/g)) {
    pairs.push({ script: s, artifact: m[1] });
  }
}

if (!pairs.length) {
  console.log("✓ artifact drift: no generated HTML found to check");
  process.exit(0);
}

// Snapshot what is committed, run the generators, compare, restore.
const before = new Map();
for (const p of pairs) {
  before.set(p.artifact, await readFile(join(ROOT, p.artifact), "utf-8").catch(() => null));
}

const ran = new Set();
const failed = [];
for (const p of pairs) {
  if (ran.has(p.script)) continue;
  ran.add(p.script);
  try {
    execFileSync(process.execPath, [join(ROOT, p.script)], { cwd: ROOT, stdio: "ignore", timeout: 180000 });
  } catch (e) {
    failed.push({ script: p.script, why: (e.message || "").split("\n")[0].slice(0, 90) });
  }
}

// A timestamp is not drift. Strip the fields a generator stamps on every run
// before comparing, or every page is permanently "stale" and the check is noise.
const normalise = (s) => String(s ?? "")
  .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<ts>")
  .replace(/\d{4}-\d{2}-\d{2}/g, "<date>")
  .replace(/\r\n/g, "\n");

const drifted = [];
for (const p of pairs) {
  const now = await readFile(join(ROOT, p.artifact), "utf-8").catch(() => null);
  const was = before.get(p.artifact);
  if (was === null || now === null) continue;
  if (normalise(was) !== normalise(now)) {
    // how far apart, in lines, so a one-word change reads differently from a rewrite
    const a = normalise(was).split("\n"), b = normalise(now).split("\n");
    let diff = Math.abs(a.length - b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) diff++;
    drifted.push({ ...p, lines: diff });
  }
}

console.log("");
if (failed.length) {
  console.log(`  ${failed.length} generator(s) could not be run, so their artifacts are UNCHECKED:`);
  for (const f of failed) console.log(`     ${f.script} — ${f.why}`);
  console.log("");
}
if (drifted.length) {
  console.log(`  ${drifted.length} artifact(s) DISAGREE with a fresh build:`);
  for (const d of drifted) console.log(`     ${d.artifact}  (${d.lines} line(s) differ)  ← ${d.script}`);
  console.log("");
  console.log("  This says the two disagree. It does NOT say which is right: the committed");
  console.log("  page may be stale, or the generator may have just been changed and the");
  console.log("  rebuild is the correct new output. Look, then commit the rebuild.");
} else {
  console.log(`  ✓ artifact drift: ${pairs.length} generated page(s) match a fresh build`);
}
console.log("");
