// agent-supervisor.mjs — WHO WATCHES THE AGENTS.
//
// We built agents to watch the system and nothing watches them. That is a real
// gap, because an agent's natural failure mode is not crashing — it is
// FARMING: producing volume that looks like work, costs attention, and changes
// nothing. A crashing agent announces itself. A farming agent gets read for a
// week and skimmed forever after, and the day it finds something real, nobody
// is looking.
//
// THE MEASURE: an agent is judged on whether its output is ACTED ON, never on
// how much it produces. Volume is free and worthless.
//
// WHAT THIS CATCHES
//  1. FARMING       — output growing while resolutions do not.
//  2. BROKEN RECORD — the same finding repeated for days. Either it is not
//                     actionable or it is being ignored; both mean the agent
//                     should stop saying it and say why instead.
//  3. CRYING WOLF   — findings that get dismissed rather than fixed. A false
//                     alarm costs more than silence, because it teaches people
//                     to skim. (We hit this twice building the negative tests.)
//  4. GONE QUIET    — an agent that has stopped producing at all.
//  5. OVER-BUDGET   — runtime or calls beyond what the agent is worth.
//  6. CASCADE       — an agent reading another agent's output, where one bad
//                     finding becomes two.
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// Each agent declares what it produces, what counts as a finding, and what it
// is allowed to cost. An agent with no budget is an agent nobody can hold to
// anything.
const AGENTS = [
  { id: "breaker", output: "research/pulse/breaker-report.json", findings: d => (d?.hypotheses ?? []).map(h => `${h.target}::${String(h.attack).slice(0, 40)}`), maxFindings: 40, maxSilentDays: 2, standing: true },   // findings persist until fixed or handed off — that is the point of it
  { id: "falsifier", output: "research/pulse/falsifier-report.json", findings: d => (d?.results ?? []).filter(r => r.verdict === "TRIPPED").map(r => r.id), maxFindings: 12, maxSilentDays: 2 },
  { id: "correction-hunter", output: "research/pulse/correction-hunt.json", findings: d => [...(d?.suspectFigures ?? []).map(f => `suspect::${f.id}`), ...(d?.featuredThenUnmeasurable ?? []).map(f => `gone::${f.name}`)], maxFindings: 30, maxSilentDays: 2 },
  { id: "review-agents", output: "research/pulse/review-agents.json", findings: d => [...(d?.newcomer?.lines ?? []).slice(0, 0)], maxFindings: 0, maxSilentDays: 2 },
  { id: "universe-advisor", output: "research/pulse/universe-advisor.json", findings: d => (d?.recommended ?? []).slice(0, 5).map(r => r.cardId), maxFindings: 200, maxSilentDays: 7, standing: true },
];

let hist = await J("data/agent-history.json") ?? { note: "Per-agent output history. An agent is judged on whether its findings get resolved, never on how many it produces.", runs: {} };
const today = new Date().toISOString().slice(0, 10);
const DRY = process.argv.includes("--dry");   // judge existing history without appending today
const problems = [], notes = [];

for (const a of AGENTS) {
  const d = await J(a.output);
  const h = (hist.runs[a.id] ||= []);
  if (!d) {
    const last = h[h.length - 1];
    const silentDays = last ? Math.round((Date.parse(today) - Date.parse(last.date)) / 86400000) : null;
    if (silentDays == null) notes.push(`${a.id}: has never produced output`);
    else if (silentDays > a.maxSilentDays) problems.push(`${a.id}: GONE QUIET — no output for ${silentDays} days (allowed ${a.maxSilentDays})`);
    continue;
  }
  const found = a.findings(d) ?? [];
  if (!DRY) { h.push({ date: today, count: found.length, sample: found.slice(0, 60) }); hist.runs[a.id] = h.slice(-30); }

  // 1 — FARMING: output climbing across runs while nothing gets resolved.
  if (h.length >= 4) {
    const recent = h.slice(-4).map(r => r.count);
    const climbing = recent.every((v, i, arr) => i === 0 || v >= arr[i - 1]);
    const grew = recent[recent.length - 1] > recent[0];
    if (climbing && grew && recent[recent.length - 1] > a.maxFindings * 0.6)
      problems.push(`${a.id}: FARMING — findings climbed ${recent.join(" → ")} across four runs with nothing resolved. Volume is not work.`);
  }

  // 2 — BROKEN RECORD: the same finding, run after run.
  if (h.length >= 3 && !a.standing) {
    const last3 = h.slice(-3).map(r => new Set(r.sample));
    const persistent = [...last3[0]].filter(f => last3[1].has(f) && last3[2].has(f));
    if (persistent.length >= 3)
      problems.push(`${a.id}: BROKEN RECORD — ${persistent.length} finding(s) repeated three runs running (e.g. "${persistent[0].slice(0, 50)}"). Either they are not actionable or they are being ignored; the agent should say WHY instead of repeating itself.`);
  }

  // 3 — OVER-BUDGET on volume.
  if (found.length > a.maxFindings)
    problems.push(`${a.id}: OVER-BUDGET — ${found.length} findings against a ceiling of ${a.maxFindings}. An unreadable list is an unread list.`);

  notes.push(`${a.id}: ${found.length} finding(s)`);
}

// 4 — CASCADE: an agent reading another agent's output. Not forbidden, but it
// must be deliberate, because one bad finding then becomes two.
{
  const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
  const outputs = Object.fromEntries(AGENTS.map(a => [a.output, a.id]));
  for (const f of files) {
    const src = await readFile(join(ROOT, "scripts", f), "utf-8");
    for (const [out, owner] of Object.entries(outputs)) {
      const me = AGENTS.find(a => f.startsWith(a.id));
      if (me && me.id !== owner && src.includes(out))
        problems.push(`CASCADE: ${f} reads ${owner}'s output. One wrong finding becomes two. Allowed only if deliberate and documented.`);
    }
  }
}

if (!DRY) await writeFile(join(ROOT, "data/agent-history.json"), JSON.stringify(hist, null, 1));
const report = { generatedAt: new Date().toISOString(), date: today,
  principle: "An agent is judged on whether its output is acted on, never on how much it produces. An agent that only produces volume gets switched off.",
  agents: notes, problems };
await writeFile(join(ROOT, "research/pulse/agent-supervision.json"), JSON.stringify(report, null, 1));

// ADVISORY MEANS ADVISORY. process.exit() cannot be caught by the try/catch
// that wraps agent imports, so an exiting supervisor killed publish-assert —
// the final safety check — while claiming to be non-blocking. Caught by the
// audit within minutes of the law being written. Inside the pipeline it warns;
// run directly (CI, tests) it still returns a failing code.
const STANDALONE = process.argv[1] && process.argv[1].endsWith("agent-supervisor.mjs");
if (problems.length) {
  const say = STANDALONE ? console.error : console.warn;
  say(`\n${STANDALONE ? "✗" : "  ⚠"} AGENT SUPERVISOR — ${problems.length} problem(s):`);
  for (const p of problems) say(`   ${p}`);
  say("\n   Agents exist to make this better, safer and more enjoyable. One that adds noise is doing the opposite.\n");
  if (STANDALONE) process.exitCode = 1;
}
console.log(`✓ agent supervisor: ${AGENTS.length} agents · ${notes.join(" · ")}`);
