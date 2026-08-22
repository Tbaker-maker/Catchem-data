// competence-guard.mjs — is this agent actually expert, or fluent?
//
// THE DANGER THIS ADDRESSES: an agent reasoning from whatever happened to be in
// its code produces confident, well-written, plausible output that is nobody's
// considered opinion. That is worse than an agent that says "I do not know",
// because fluency is read as competence and nothing in the output signals which
// one you are getting.
//
// So "expert" is made checkable. Four obligations per domain:
//   PRINCIPLES   — what the field actually runs on, with sources.
//   FAILURE MODES — what the field is known to get wrong.
//   BLIND SPOTS  — what it cannot see and must route onward. This one matters
//                  most: a specialist who cannot name the edge of their own
//                  competence is the one who does the damage.
//   RECHECK      — every field moves, and knowledge with no expiry is a museum.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const comp = await J("data/agent-competence.json");
if (!comp) { console.log("· competence: no register"); process.exitCode = 0; }
const sup = await readFile(join(ROOT, "scripts/agent-supervisor.mjs"), "utf-8").catch(() => "");
const roster = [...sup.matchAll(/\{ id: "([a-z\-]+)"/g)].map(m => m[1]);
const today = new Date().toISOString().slice(0, 10);

// Agents whose whole job is auditing OURSELVES need no external field knowledge —
// the repo is their domain and it is fully visible to them. Recorded rather than
// assumed, so the exemption is a decision instead of a gap.
const INTERNAL = {
  breaker: "audits our own untested assumptions; the repo is the entire domain",
  falsifier: "tests our own published theses against conditions we wrote ourselves",
  "correction-hunter": "re-reads figures we published; no external field to know",
  steward: "watches whether our own work is saved and on track",
  improver: "measures our own product against our own doctrine",
  "universe-advisor": "arithmetic over our own catalogue",
  "review-agents": "reads our own copy as a stranger would",
};

const problems = [], expert = [], exempt = [];
for (const id of roster) {
  if (INTERNAL[id]) { exempt.push(`${id} — ${INTERNAL[id]}`); continue; }
  const d = comp.domains?.[id];
  if (!d) { problems.push(`${id}: no declared competence — it reasons from whatever is in its code, which is a hunch with a schedule`); continue; }
  if (!(d.principles ?? []).length) problems.push(`${id}: no principles declared — nothing says what its field actually runs on`);
  if (!(d.failureModes ?? []).length) problems.push(`${id}: no failure modes declared — it does not know what its own field gets wrong`);
  if (!(d.blindSpots ?? []).length) problems.push(`${id}: NO BLIND SPOTS DECLARED — an agent that cannot name the edge of its competence is the one that does the damage`);
  if (!(d.sources ?? []).length) problems.push(`${id}: principles with no sources — that is assertion, not knowledge`);
  if (!d.recheckAfter) problems.push(`${id}: no recheck date — knowledge with no expiry becomes a museum`);
  else if (d.recheckAfter < today) problems.push(`${id}: competence expired ${d.recheckAfter} — the field has had time to move and nobody looked`);
  if (!problems.some(p => p.startsWith(`${id}:`)))
    expert.push(`${id} (${(d.principles ?? []).length} principles, ${(d.blindSpots ?? []).length} blind spots)`);
}

if (problems.length) {
  console.error(`\n✗ COMPETENCE — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`   ${p}`);
  console.error("\n   An agent that is fluent without being expert is more dangerous than one that admits it does not know.\n");
  process.exitCode = 1;
} else {
  console.log(`✓ competence: ${expert.length} specialist(s) with declared knowledge and blind spots · ${exempt.length} internal auditor(s) exempt`);
  for (const e of expert) console.log(`  ${e}`);
}
