// memory-guard.mjs — did we write down what we learned?
//
// Everything we build survives because it is in the repo. But surviving is not
// the same as being FOUND: the knowledge base said "last_updated 2026-08-18"
// while carrying seventy-four laws written after that date, and 20,000
// characters of them sat on a single line. All preserved. All unreadable. A
// law nobody can find is a law that gets broken by the next session, which is
// how hard work quietly evaporates without anyone deleting anything.
//
// This checks that the entry point still works as an entry point.
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const problems = [], notes = [];
const kb = await readFile(join(ROOT, "catchem-knowledge-base.md"), "utf-8").catch(() => "");
if (!kb) { console.log("· memory guard: no knowledge base"); process.exit(0); }

// 1 — Is the stamp honest? A stale date makes a future session trust an old
// picture, which is worse than no date at all.
{
  const m = /\*\*last_updated:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(kb);
  const stamped = m?.[1];
  const { stdout } = await run("git", ["log", "-1", "--format=%ad", "--date=short", "--", "catchem-knowledge-base.md"], { cwd: ROOT }).catch(() => ({ stdout: "" }));
  const lastTouched = stdout.trim();
  if (!stamped) problems.push("the knowledge base has no last_updated stamp — a future session cannot tell how current it is");
  else if (lastTouched && stamped < lastTouched)
    problems.push(`stamp says ${stamped} but the file was last changed ${lastTouched} — a stale stamp makes a future session trust an old picture`);
  else notes.push(`stamp current (${stamped})`);
}

// 2 — Is it still readable? Preservation without findability is not memory.
{
  const longest = kb.split("\n").reduce((a, l) => Math.max(a, l.length), 0);
  if (longest > 4000)
    problems.push(`the longest line is ${longest.toLocaleString()} characters — nobody reads that, and an unread law is a broken law`);
  else notes.push(`longest line ${longest} chars`);
}

// 3 — Do the laws written in the theses appear in the entry point? A law that
// exists only in a long document nobody opens is not part of how we work.
{
  const theses = await readFile(join(ROOT, "research/house-theses.md"), "utf-8").catch(() => "");
  const titles = [...theses.matchAll(/^## ([A-Z][A-Z0-9 ,'’\-\.]{6,60})/gm)].map(m => m[1].trim());
  // HEADING DRIFT: matching on the first long word passes a law whose heading
  // was reworded - "BULK IS EVERY THREE DAYS" was checked against "REFRESH"
  // from an older title and reported present while absent. Match on several
  // distinctive words, not one.
  const missing = titles.filter(t => {
    const keys = t.split(/[ ,\u2014]/).filter(w => w.length > 4).slice(0, 3);
    if (!keys.length) return false;
    // present only if at least half its distinctive words appear
    const hits = keys.filter(k => kb.toLowerCase().includes(k.toLowerCase())).length;
    return hits < Math.ceil(keys.length / 2);
  });
  if (missing.length > 3)
    problems.push(`${missing.length} laws exist in house-theses and are not mentioned in the knowledge base (e.g. ${missing.slice(0, 3).join("; ")}) — the entry point does not know about them`);
  else if (missing.length) notes.push(`${missing.length} law(s) not yet in the entry point: ${missing.join("; ")}`);
  else notes.push(`every law in the theses is reachable from the entry point`);
}

if (problems.length) {
  console.error(`\n✗ MEMORY GUARD — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("\n   Work that cannot be found again was not saved, it was only stored.\n");
  process.exit(1);
}
console.log(`✓ memory: ${notes.join(" · ")}`);
