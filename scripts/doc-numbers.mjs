// doc-numbers.mjs — the docs must match the data.
//
// I wrote four documents from cached figures and every one was wrong on all four
// counts, because a rebase pulled in work between reading and writing. Same class
// as the perishable-claim error: true when read, false when published. A handover
// that lies is worse than none, since it is the first thing the next chat reads.
import { readFile } from "node:fs/promises";
const g = JSON.parse(await readFile("data/guard-blindspots.json", "utf8"));
const p = JSON.parse(await readFile("data/post-outcomes.json", "utf8"));
const k = JSON.parse(await readFile("data/knowledge.json", "utf8"));
const h = await readFile("research/house-theses.md", "utf8");
const T = { guards: Object.keys(g.guards).length, posts: p.posts.length,
  facts: k.facts.length, laws: (h.match(/^## /gm) || []).length };
const DOCS = ["SYSTEM-README.md", "METHOD-PORTABLE.md", "AGENTS-AND-LOGIC.md", "GROK-HANDOVER-2026-08-26.md"];
const problems = [];
for (const f of DOCS) {
  let s; try { s = await readFile(f, "utf8"); } catch { continue; }
  for (const [label, rx, truth] of [
    ["guards", /(\d+) guards/g, T.guards],
    ["facts", /(\d+) (?:sourced )?facts/g, T.facts],
    ["laws", /(\d+) laws|holds (\d+)(?! posts)/g, T.laws],
    ["posts", /holds (\d+) posts/g, T.posts],
  ]) {
    for (const m of s.matchAll(rx)) {
      const n = Number(m[1]);
      if (n !== truth && n > 5) problems.push(f + ": says " + n + " " + label + ", data says " + truth);
    }
  }
}
if (problems.length) {
  console.error("\n✗ DOCS — " + problems.length + " stale number(s):\n");
  for (const x of [...new Set(problems)]) console.error("   " + x);
  console.error("\n   A handover that lies is worse than none.\n");
  process.exitCode = 1;
} else console.log("✓ docs: every number matches the data · " + T.guards + " guards, " + T.posts + " posts, " + T.facts + " facts, " + T.laws + " laws");
