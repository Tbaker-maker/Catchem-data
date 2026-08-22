// knowledge-guard.mjs — keeps the compounding asset honest.
//
// Instruments can be rebuilt in a weekend. A decade of verified, sourced,
// dated knowledge cannot — that file is the thing that is actually worth
// something in five years, and it is only worth anything if every entry can
// be traced. This enforces the entry law and, just as importantly, tells us
// when a fact has gone stale. Facts rot: fee schedules change, SKUs get
// reprinted, populations grow. A knowledge base nobody rechecks is a museum.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let kb;
try { kb = JSON.parse(await readFile(join(ROOT, "data/knowledge.json"), "utf-8")); }
catch { console.log("· knowledge guard: no knowledge.json"); process.exit(0); }

const today = new Date().toISOString().slice(0, 10);
const REQUIRED = ["id", "claim", "sources", "verified", "verifier", "confidence", "falsifier"];
const VALID = Object.keys(kb.confidence || {});
const problems = [], stale = [];

for (const f of kb.facts || []) {
  for (const k of REQUIRED) if (!f[k] || (Array.isArray(f[k]) && !f[k].length))
    problems.push(`${f.id || "(no id)"}: missing ${k} — every fact needs the claim, a named source, when it was verified, by whom, its confidence, and what would prove it wrong`);
  if (f.confidence && !VALID.includes(f.confidence))
    problems.push(`${f.id}: confidence "${f.confidence}" is not one of ${VALID.join(", ")}`);
  if (f.confidence === "VERIFIED" && (f.sources || []).length < 2 && !/pokemon\.com|bulbapedia|official|our own/i.test((f.sources || [])[0] || ""))
    problems.push(`${f.id}: marked VERIFIED on a single non-primary source — that is SINGLE-SOURCE until corroborated`);
  if (f.recheckAfter && f.recheckAfter < today)
    stale.push({ id: f.id, due: f.recheckAfter, claim: String(f.claim).slice(0, 70) });
}
const ids = (kb.facts || []).map(f => f.id);
for (const id of ids) if (ids.filter(x => x === id).length > 1) problems.push(`duplicate id: ${id}`);

if (problems.length) {
  console.error(`\n✗ KNOWLEDGE GUARD — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("");
  process.exit(1);
}
console.log(`✓ knowledge: ${(kb.facts || []).length} facts, all sourced and dated${stale.length ? ` · ${stale.length} due a recheck` : ""}`);
for (const s of stale) console.log(`  ⏰ ${s.id} — due ${s.due}: ${s.claim}`);
