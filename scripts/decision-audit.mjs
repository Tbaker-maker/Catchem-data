// decision-audit.mjs — grading reasoning, since we cannot inspect it.
//
// The work verifier checks OUTPUT and openly cannot check REASONING. You cannot
// audit a chain of thought after the fact either — the reasoner reconstructs a
// tidier version than the one they actually had, and does so honestly.
//
// A prediction made in ADVANCE is different. It is fixed, it is dated, and
// reality grades it without argument. Over a hundred decisions this produces
// something no amount of introspection could: a measured hit rate PER KIND of
// decision, which says where the judgment is reliable and where it is not.
//
// This does three things: surfaces predictions that have come due, enforces
// that every decision carries one, and reports the running record.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const log = await J("data/decision-log.json");
if (!log) { console.log("· decision audit: no log"); process.exitCode = 0; }
else {
  const today = new Date().toISOString().slice(0, 10);
  const problems = [], due = [];

  for (const d of log.decisions ?? []) {
    // A decision with no falsifiable prediction cannot be graded, and an
    // ungradable decision teaches nothing.
    if (!d.predicts) problems.push(`${d.id}: no prediction — cannot ever be graded`);
    if (!d.rejected) problems.push(`${d.id}: no rejected alternative — a decision with only one option was not a decision`);
    if (!d.checkAfter) problems.push(`${d.id}: no check date — a prediction nobody revisits is a hope`);
    else if (d.checkAfter <= today && d.grade === "PENDING") due.push(d);
  }

  const graded = (log.decisions ?? []).filter(d => d.grade === "HELD" || d.grade === "FAILED");
  const held = graded.filter(d => d.grade === "HELD").length;
  const record = graded.length
    ? { graded: graded.length, held, failed: graded.length - held,
        rate: Math.round(held / graded.length * 100),
        // The honest reading of a small sample, stated rather than implied.
        confidence: graded.length >= 20 ? "meaningful" : `too few to mean anything — ${graded.length} of the 20 needed` }
    : { graded: 0, note: "nothing has come due yet. The first grades land from October." };

  await writeFile(join(ROOT, "research/pulse/decision-audit.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    purpose: "Grades reasoning by its predictions, because reasoning cannot be inspected after the fact without being rewritten.",
    total: (log.decisions ?? []).length, dueForGrading: due.length, record, problems,
    due: due.map(d => ({ id: d.id, decision: d.decision, predicted: d.predicts, decidedBy: d.decidedBy })),
  }, null, 1));

  if (problems.length) {
    console.error(`\n✗ DECISION LOG — ${problems.length} entry problem(s):`);
    for (const p of problems) console.error(`   ${p}`);
    console.error("");
    process.exitCode = 1;
  } else {
    console.log(`✓ decisions: ${(log.decisions ?? []).length} logged · ${due.length} due for grading · record: ${record.graded ? `${record.held}/${record.graded} held (${record.confidence})` : record.note}`);
    for (const d of due) console.log(`  DUE  ${d.id}: ${d.predicts.slice(0, 80)}`);
  }
}
