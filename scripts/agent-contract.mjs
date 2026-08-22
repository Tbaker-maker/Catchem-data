// agent-contract.mjs — every agent, audited against the same ten obligations.
//
// THE PATTERN THAT MADE THIS NECESSARY: each of the last four agents hired
// caught a failure in an agent hired before it. The Improver found every agent
// writing files nobody read. The Steward found four agents registered, managed
// and never actually run. The orphan guard then caught the Steward itself
// unsurfaced.
//
// That is a good outcome arrived at badly. We were finding these by LUCK —
// because the next hire happened to look somewhere useful — rather than by
// design. An agent that nobody happens to build would have hidden its broken
// predecessor forever.
//
// So: a contract. Ten obligations every agent owes, checked mechanically, every
// run. Not "does it work" — the negative tests own that — but "is it a real
// employee": scheduled, supervised, wired, surfaced, tested, honest about its
// silence, and unable to take the building down.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const sup = await R("scripts/agent-supervisor.mjs");
const pipe = await R("scripts/generate-pulse.mjs");
const digest = await R("scripts/agent-digest.mjs");
const cadence = await R("scripts/cadence.mjs");
const tests = await R("scripts/negative-tests.mjs");
const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));

// The roster comes from the supervisor — it is the payroll, and an agent not on
// it is either unmanaged or does not exist.
const roster = [...sup.matchAll(/\{ id: "([a-z\-]+)",[^\n]*output: "([^"]+)"/g)].map(m => ({ id: m[1], output: m[2] }));
const scriptFor = (id) => files.find(f => f === `${id}.mjs` || f === `${id}-agent.mjs` || f === `${id}-agents.mjs` || f === `${id}-watcher.mjs` || f === `${id}-hunter.mjs`);

// Agents deliberately exempt from a given clause, with the reason recorded —
// an exemption without a reason is just a hole.
const EXEMPT = {
  "review-agents": { scheduled: "deliberately manual — it costs money and runs only when its input changes" },
};

const report = [];
for (const a of roster) {
  let src = scriptFor(a.id) ? await R(`scripts/${scriptFor(a.id)}`) : "";
  // Strip comments before auditing. Twice now a check has read an explanation
  // of why we DON'T do something as evidence that we do.
  const code = src.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  const ex = EXEMPT[a.id] ?? {};
  const checks = {
    // 1 — does the script exist at all?
    exists:      { ok: Boolean(src), why: "registered on the payroll with no script behind it" },
    // 2 — is it scheduled, or does it run on habit?
    scheduled:   { ok: Boolean(ex.scheduled) || cadence.includes(`"${a.id}"`), why: "no declared cadence — an agent nobody scheduled deliberately runs on habit" },
    // 3 — does it actually run? (the Steward's catch)
    wired:       { ok: Boolean(ex.scheduled) || (scriptFor(a.id) && pipe.includes(scriptFor(a.id))), why: "registered and managed but never imported by the pipeline — employed on paper only" },
    // 4 — does anything a human reads ever see its output? (the Improver's catch)
    surfaced:    { ok: digest.includes(a.output.split("/").pop()), why: "produces a file nobody reads — that is a file, not work" },
    // 5 — can it take the building down? (my own violation, hours after writing the law)
    failsSafe:   { ok: !/^[^/\n]*process\.exit\(/m.test(code) || /STANDALONE/.test(code), why: "calls process.exit(), which try/catch cannot catch — it can halt every guard downstream while calling itself advisory" },
    // 6 — does it say what its silence means? (the falsifier-vs-review-agents confusion)
    zeroDeclared:{ ok: new RegExp(`id: "${a.id}", zeroMeans:`).test(sup), why: "has not declared whether an empty result is good news, unknown, or a warning — so the supervisor cannot tell success from silence" },
    // 7 — is there a test that proves it works by breaking it?
    tested:      { ok: tests.toLowerCase().includes(a.id.split("-")[0]), why: "no negative test — a guard is not real until breaking it fails the build, and the same applies here" },
    // 8 — does it label its confidence, or state everything flatly?
    chipped:     { ok: /chip:|confidence|HYPOTHESIS|READ|severity|verdict|status:/.test(code), why: "states findings without any confidence marker — a guess and a measurement look identical" },
    // 9 — does it explain itself to whoever reads it?
    documented:  { ok: src.split("\n").slice(0, 25).filter(l => l.trim().startsWith("//")).length >= 5, why: "no header explaining why it exists — the next person cannot tell whether it still should" },
    // 10 — is its output routed to somebody who can act?
    routed:      { ok: sup.includes(`${a.id}: { file:`) || sup.includes(`"${a.id}": { file:`) || sup.includes(`${a.id}: {`), why: "findings are not dispatched to an owner — a finding delivered to nobody is a finding nobody made" },
  };
  const failed = Object.entries(checks).filter(([, c]) => !c.ok);
  report.push({ agent: a.id, obligations: Object.keys(checks).length, met: Object.keys(checks).length - failed.length,
    failing: failed.map(([k, c]) => ({ clause: k, why: c.why })) });
}

const broken = report.filter(r => r.failing.length);
const totalFail = broken.reduce((s, r) => s + r.failing.length, 0);
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/agent-contract.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(),
    principle: "Ten obligations every agent owes. Checked mechanically every run, because the alternative is finding these by luck when the next hire happens to look somewhere useful — and an agent nobody happens to build would hide its broken predecessor forever.",
    agents: report.length, fullyCompliant: report.length - broken.length, openClauses: totalFail, report }, null, 1));

console.log(`✓ agent contract: ${report.length - broken.length}/${report.length} agents meet all ten obligations${totalFail ? ` · ${totalFail} open clause(s)` : ""}`);
for (const r of broken) console.log(`  ${r.agent.padEnd(18)} ${r.met}/${r.obligations}  missing: ${r.failing.map(f => f.clause).join(", ")}`);
if (totalFail) { console.log(`\n  ${broken[0].failing[0].why}\n`); process.exitCode = 0; }
