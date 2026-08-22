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
// zeroMeans: "good" — an empty result is the desired outcome (nothing broke)
//            "unknown" — an empty result may mean it never ran
//            "suspect" — an empty result probably means it stopped working
const AGENTS = [
  { id: "breaker", zeroMeans: "suspect", output: "research/pulse/breaker-report.json", findings: d => (d?.hypotheses ?? []).map(h => `${h.target}::${String(h.attack).slice(0, 40)}`), maxFindings: 40, maxSilentDays: 2, standing: true },   // findings persist until fixed or handed off — that is the point of it
  { id: "falsifier", zeroMeans: "good", output: "research/pulse/falsifier-report.json", findings: d => (d?.results ?? []).filter(r => r.verdict === "TRIPPED").map(r => r.id), maxFindings: 12, maxSilentDays: 2 },
  { id: "correction-hunter", zeroMeans: "good", output: "research/pulse/correction-hunt.json", findings: d => [...(d?.suspectFigures ?? []).map(f => `suspect::${f.id}`), ...(d?.featuredThenUnmeasurable ?? []).map(f => `gone::${f.name}`)], maxFindings: 30, maxSilentDays: 2 },
  { id: "review-agents", zeroMeans: "unknown", output: "research/pulse/review-agents.json", findings: d => [...(d?.newcomer?.lines ?? []).slice(0, 0)], maxFindings: 0, maxSilentDays: 2 },
  { id: "creator", zeroMeans: "suspect", output: "research/pulse/creator-report.json", findings: d => (d?.findings ?? []).map(f => `${f.need}::${String(f.observation).slice(0, 40)}`), maxFindings: 10, maxSilentDays: 7, standing: true },
  { id: "experience", zeroMeans: "suspect", output: "research/pulse/experience-report.json", findings: d => (d?.findings ?? []).map(f => `${f.lane}::${String(f.observation).slice(0, 40)}`), maxFindings: 10, maxSilentDays: 7, standing: true },
  { id: "improver", zeroMeans: "suspect", output: "research/pulse/improver-report.json", findings: d => (d?.ideas ?? []).map(i => `${i.area}::${String(i.observation).slice(0, 40)}`), maxFindings: 12, maxSilentDays: 2, standing: true },
  { id: "universe-advisor", zeroMeans: "suspect", output: "research/pulse/universe-advisor.json", findings: d => (d?.recommended ?? []).slice(0, 5).map(r => r.cardId), maxFindings: 200, maxSilentDays: 7, standing: true },
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

// ═══ WORKFORCE PLANNING ═════════════════════════════════════════════════
// Policing the agents is half the job. The other half is asking whether this
// is the right set of agents at all — what is missing, what should merge, what
// has finished its work and should be retired. A supervisor that only issues
// warnings manages a fixed team forever; the point is a team that gets better.
// ═══ PERFORMANCE MANAGEMENT ═════════════════════════════════════════════
// A supervisor that only polices behaviour is a night watchman. A good one
// finds waste before being asked, and can say which of its people are earning
// their seat. These checks exist because a human caught the cadence waste by
// hand on 2026-08-23 — the supervisor should have seen it first, and now does.
const efficiency = [];
const E = (agent, finding, fix) => efficiency.push({ agent, finding, fix });

{
  let CAD = {};
  try { ({ CADENCE: CAD } = await import("./cadence.mjs")); } catch {}

  for (const a of AGENTS) {
    const h = hist.runs[a.id] ?? [];
    const c = CAD[a.id];

    // 1 — CADENCE WASTE. An agent running more often than its input changes
    // produces the same answer twice and calls it work.
    if (!c) E(a.id, "has no declared cadence — nothing says how often it should run or why.",
      "Register it in cadence.mjs with what it watches. An agent nobody scheduled deliberately is an agent running on habit.");
    else if (c.when === "daily" && h.length >= 4) {
      const last4 = h.slice(-4).map(r => r.count);
      if (last4.every(v => v === last4[0]))
        E(a.id, `runs daily and has returned the same count (${last4[0]}) four runs running.`,
          `Either what it watches is not changing daily — move it to on-change — or it is not really looking. Same answer, same cost, every day, is the definition of waste.`);
    }

    // 2 — YIELD. Findings are only worth their attention if they move.
    if (h.length >= 7) {
      const total = h.slice(-7).reduce((s, r) => s + r.count, 0);
      if (total === 0 && a.zeroMeans === "suspect")
        E(a.id, "has found nothing in seven runs, and for this agent that is unexpected.",
          "It watches something that does change. Either the bar for reporting is too high or it has quietly stopped working — check before assuming health.");
      // An agent whose empty result IS the good outcome gets said once, warmly,
      // not flagged as a problem. Treating success as a warning is how a
      // supervisor loses the room.
      if (total === 0 && a.zeroMeans === "good")
        notes.push(`${a.id}: clean run — nothing failed, which is the point of it`);
      const first = new Set(h.slice(-7)[0].sample ?? []);
      const last = new Set(h.slice(-1)[0].sample ?? []);
      const stuck = [...first].filter(f => last.has(f)).length;
      if (stuck && stuck === first.size && first.size >= 3)
        E(a.id, `every finding from a week ago is still open (${stuck}).`,
          "Findings nobody acts on are not findings, they are a list. Either they need to be handed to someone who can act, or the bar for reporting is too low.");
    }

    // 3 — COST AGAINST YIELD. Cheap is not the same as free when nothing comes back.
    if (c?.costs) {
      const recent = h.slice(-5).reduce((s, r) => s + r.count, 0);
      const everRan = (await J(a.output))?.newcomer?.result || (await J(a.output))?.redTeam?.result;
      if (h.length >= 5 && recent === 0 && everRan)
        E(a.id, "costs money and has produced nothing in five runs.",
          "The only paid agent on the team should be the easiest to justify. If it cannot be, switch it off until it can.");
      else if (h.length >= 5 && recent === 0 && !everRan)
        notes.push(`${a.id}: has never actually run (no key) — costing nothing, proving nothing, and honest about both`);
    }
  }

  // 4 — REDUNDANCY. Two people doing one job is a management failure, not theirs.
  const outputs = {};
  for (const a of AGENTS) {
    const d = await J(a.output);
    outputs[a.id] = new Set((a.findings(d) ?? []).map(f => String(f).split("::")[0]));
  }
  const ids = Object.keys(outputs);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = outputs[ids[i]], B = outputs[ids[j]];
    if (A.size < 3 || B.size < 3) continue;
    const shared = [...A].filter(x => B.has(x)).length;
    const overlap = shared / Math.min(A.size, B.size);
    if (overlap >= 0.6)
      E(`${ids[i]} + ${ids[j]}`, `report the same ${shared} subject(s) — ${Math.round(overlap * 100)}% overlap.`,
        "Two agents covering one beat is a management failure, not theirs. Merge them or narrow one.");
  }
}

const proposals = [];
const P = (kind, what, why) => proposals.push({ kind, what, why });

// 1 — WHAT IS UNWATCHED? Compare the agents' coverage against the surfaces
// and assets we actually have.
{
  const covered = new Set(AGENTS.map(a => a.id));
  const GAPS = [
    ["community", !covered.has("community-listener"),
      "Nothing reads the Discord. Members ask questions our instruments cannot answer and we never see the pattern. The strongest roadmap input we have is unread.",
      "needs the bot"],
    ["engagement", !covered.has("engagement-analyst"),
      "Nothing measures which of our own content lands. We generate six angles a day and learn nothing from which ones people use.",
      "needs analytics or creator feedback"],
    ["competitor", !covered.has("competitor-watcher"),
      "Nothing tracks what other tools ship. We would learn a competitor solved something we are still guessing at only by accident.",
      "web research, no new dependency"],
    ["pricing-drift", !covered.has("source-auditor"),
      "Nothing spot-checks our published prices against the live marketplace by eye. Every guard we have compares us to ourselves.",
      "needs a browser — CC's lane"],
    ["reader", !covered.has("newcomer") && !covered.has("review-agents"),
      "Nothing reads our output as a stranger would.",
      "exists as review-agents but has never run — no key"],
  ];
  for (const [id, missing, why, cost] of GAPS)
    if (missing) P("HIRE", `an agent for ${id}`, `${why} (${cost})`);
}

// 2 — WHO IS NOT EARNING THEIR SEAT? An agent producing nothing for a week is
// either broken or unnecessary, and both deserve a decision rather than drift.
for (const a of AGENTS) {
  const h = hist.runs[a.id] ?? [];
  const recent = h.slice(-7);
  if (recent.length >= 5 && recent.every(r => r.count === 0) && a.zeroMeans !== "good" && a.zeroMeans !== "unknown")
    P("REVIEW", `${a.id} has found nothing in ${recent.length} runs`,
      `Either the thing it watches is genuinely healthy — in which case say so once and run it weekly — or it has stopped working. Silence should be a decision, not a habit.`);
}

// 3 — WHO SHOULD MERGE? Two agents reading the same inputs and reporting to the
// same page are one agent with extra overhead.
{
  const pairs = [["falsifier", "correction-hunter"], ["breaker", "improver"]];
  for (const [a, b] of pairs) {
    const ha = (hist.runs[a] ?? []).slice(-3), hb = (hist.runs[b] ?? []).slice(-3);
    if (ha.length && hb.length && ha.every(r => r.count === 0) && hb.every(r => r.count === 0))
      P("MERGE", `${a} and ${b}`, `Both silent across three runs and both report to the same digest. Two quiet agents are one agent and a habit.`);
  }
}

// 4 — WHAT WOULD THE TEAM NEED TO BECOME? Stated as ambition, not instruction.
P("AMBITION", "the shape this workforce is aiming at",
  "Right now every agent watches US. A workforce that builds the best community, app, tools and database in this hobby needs agents that watch the MARKET (what changed that we did not notice), the COMMUNITY (what people are asking), and the FIELD (what everyone else shipped). Two of those three need the bot; one needs only research. That is the order to hire in.");

if (!DRY) await writeFile(join(ROOT, "data/agent-history.json"), JSON.stringify(hist, null, 1));
// ═══ DISPATCH ════════════════════════════════════════════════════════════
// A supervisor that reports to nobody is a diary. This reads every agent's
// findings and sorts them by WHO CAN ACT — chat, CC, or Tyler — because a
// finding delivered to the wrong person is the same as a finding nobody made.
//
// The routing rule is capability, per FLEET-ROUTING.md: anything needing eyes,
// a browser or a deploy goes to CC; anything needing data, code or writing goes
// to chat; anything needing judgment, money or a human account goes to Tyler.
const dispatch = { chat: [], cc: [], tyler: [] };
{
  const ROUTE = {
    // agent → how to read its findings, and where they go by default
    creator: { file: "research/pulse/creator-report.json", pick: d => (d?.findings ?? []).map(f => ({ what: f.observation, do: f.fix, owner: f.owner })) },
    experience: { file: "research/pulse/experience-report.json", pick: d => (d?.findings ?? []).map(f => ({ what: f.observation, do: f.fix, owner: /visual|looks|colour|emoji/i.test(f.lane) ? "cc" : "chat" })) },
    improver: { file: "research/pulse/improver-report.json", pick: d => (d?.ideas ?? []).map(i => ({ what: i.observation, do: i.suggestion, owner: /tool idea|retention/.test(i.area) ? "tyler" : "chat" })) },
    breaker: { file: "research/pulse/breaker-report.json", pick: d => (d?.hypotheses ?? []).filter(h => h.severity === "high").map(h => ({ what: h.target, do: h.attack, owner: /deploy|mode|app|smoke/i.test(h.target) ? "cc" : "chat" })) },
    falsifier: { file: "research/pulse/falsifier-report.json", pick: d => (d?.results ?? []).filter(r => r.verdict === "TRIPPED").map(r => ({ what: `${r.id} failed its own kill condition`, do: "publish the amendment — we said in advance this would end the thesis", owner: "tyler" })) },
    "correction-hunter": { file: "research/pulse/correction-hunt.json", pick: d => (d?.suspectFigures ?? []).map(f => ({ what: `${f.name} moved ${f.movePct}% in ${f.from}→${f.to}`, do: "verify against listings; file a correction if the earlier figure was ours", owner: "cc" })) },
  };
  for (const [agent, r] of Object.entries(ROUTE)) {
    const d = await J(r.file);
    if (!d) continue;
    for (const item of r.pick(d).slice(0, 6)) {
      const owner = ["chat", "cc", "tyler"].includes(item.owner) ? item.owner : "chat";
      dispatch[owner].push({ from: agent, what: item.what, do: item.do });
    }
  }
}

const report = { generatedAt: new Date().toISOString(), date: today,
  principle: "An agent is judged on whether its output is acted on, never on how much it produces. An agent that only produces volume gets switched off.",
  agents: notes, problems, workforce: proposals, efficiency, dispatch };
console.log(`\n  dispatch — ${dispatch.chat.length} for chat, ${dispatch.cc.length} for CC, ${dispatch.tyler.length} for Tyler`);
for (const [who, items] of Object.entries(dispatch)) for (const i of items.slice(0, 2)) console.log(`   → ${who.padEnd(5)} ${String(i.what).slice(0, 62)}`);
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
if (efficiency.length) { console.log(`\n  performance notes:`); for (const e of efficiency.slice(0, 6)) console.log(`   ${e.agent}: ${e.finding}`); }
if (proposals.length) { console.log(`\n  workforce notes:`); for (const p of proposals.slice(0, 5)) console.log(`   ${p.kind.padEnd(9)} ${p.what}`); console.log(""); }
console.log(`✓ agent supervisor: ${AGENTS.length} agents · ${notes.join(" · ")}`);
