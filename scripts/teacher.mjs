// teacher.mjs — keeps the workforce sharp, and teaches from our own failures.
//
// The supervisor manages. The contract audits. Neither asks whether an agent is
// still LEARNING. An agent that returns the same six findings every morning is
// not healthy — it is looking in the same place with the same eyes, and the
// history file shows exactly that: identical counts, run after run, across the
// whole fleet.
//
// FOUR THINGS IT DOES, all from evidence rather than encouragement:
//
//  1. CURRENCY   — is an agent's declared knowledge past its recheck date?
//                  A field moves; knowledge with an expiry nobody honours is
//                  a museum with a schedule.
//  2. RUTS       — same findings, run after run, means the agent has stopped
//                  searching and started reciting. It gets a new question.
//  3. POST-MORTEM — for every logged incident, WHICH AGENT SHOULD HAVE CAUGHT
//                  IT? This is the sharpest teaching we have, because it is
//                  taught by something that actually went wrong to us.
//  4. CROSS-POLLINATION — one agent's finding is often another's blind spot.
//                  A checker reading its own source was found five times in
//                  one day by five different agents who never told each other.
//
// IT TEACHES, IT DOES NOT ORDER. Every output is a question or a lesson for a
// human to accept or reject. An agent that rewrites other agents is a fleet
// with no supervision at all.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };

const comp = await J("data/agent-competence.json") ?? { domains: {} };
const hist = await J("data/agent-history.json") ?? { runs: {} };
const ledger = await R("research/RESEARCH-GATE.md");
const sup = await R("scripts/agent-supervisor.mjs");
const today = new Date().toISOString().slice(0, 10);

const lessons = [];
const L = (agent, kind, observation, question, why) => lessons.push({ agent, kind, observation, question, why, confidence: kind === "post-mortem" ? "MEASURED" : "OBSERVED", chip: "READ" });

// ── 1 · CURRENCY ───────────────────────────────────────────────────────────
for (const [agent, d] of Object.entries(comp.domains ?? {})) {
  if (d.recheckAfter && d.recheckAfter < today)
    L(agent, "stale knowledge", `competence expired ${d.recheckAfter}`,
      `What has changed in ${agent}'s field since then, and does any principle still hold?`,
      "Knowledge with an expiry nobody honours is a museum with a schedule.");
  const thin = (d.principles ?? []).length < 4;
  if (thin)
    L(agent, "thin expertise", `${(d.principles ?? []).length} declared principles`,
      `What are the three things somebody genuinely expert in ${agent}'s field knows that we have not written down?`,
      "A short principle list usually means we captured what we already believed rather than what the field knows.");
}

// ── 2 · RUTS ───────────────────────────────────────────────────────────────
// The signature: identical counts, run after run. Not proof of failure, but
// proof of sameness — and sameness in a search is how you stop finding things.
for (const [agent, runs] of Object.entries(hist.runs ?? {})) {
  const recent = (runs ?? []).slice(-5);
  if (recent.length < 4) continue;
  const counts = recent.map(r => r.count);
  const identical = counts.every(c => c === counts[0]);
  if (!identical) continue;

  // ZERO IS NOT ONE THING, and it applies to the teacher too. An agent whose
  // empty result IS the desired outcome - the falsifier finding no failed
  // thesis, compliance finding no tripped wire - is not stuck, it is
  // succeeding. Telling somebody who is winning that they are in a rut is how
  // a teacher loses the room, and it is the same crying-wolf failure we have
  // now made five times in different costumes.
  const zeroMeans = (sup.match(new RegExp(`id: "${agent}", zeroMeans: "(\\w+)"`)) ?? [])[1];
  if (counts[0] === 0 && (zeroMeans === "good" || zeroMeans === "unknown")) continue;

  // A rut is about SEARCHING the same way, not about a stable count. An agent
  // with a standing list that persists until acted on is meant to repeat.
  if (/standing: true/.test((sup.split(`id: "${agent}"`)[1] ?? "").slice(0, 200))) continue;

  // A new angle, specific to what that agent watches — a generic "look harder"
  // is not teaching, it is nagging.
  const ANGLES = {
    breaker: "You test what we built. What have we DELETED recently, and did anything depend on it?",
    improver: "You measure against our own doctrine. What would somebody who has never read our doctrine find embarrassing here?",
    experience: "You count structure. What would a reader who came for ONE number and found none of it do next?",
    creator: "You ask whether a creator could record. Ask instead why one who tried it once did not come back.",
    platform: "You judge our material against each platform. Ask what we would post if we had no data at all — that is what most accounts do, and it is who we compete with.",
    anomaly: "You compare today to our own history. Ask what a normal day should look like, and whether we would recognise abnormal if it were quiet rather than loud.",
    "correction-hunter": "You re-check figures that moved. Ask about the ones that never move — a price frozen for a month is a claim too.",
    steward: "You check whether work is saved. Ask what we have saved that nobody will ever read again.",
    security: "You scan for what a leak looks like. Ask what an attacker would want here that is not a credential.",
    compliance: "You watch trip-wires we set. Ask what obligation we have never written down because nobody thought of it.",
    "api-strategist": "You find unused fields. Ask what we would want that no provider offers, because that is the gap worth building around.",
    "universe-advisor": "You rank what to price. Ask what we would stop tracking if the budget halved — the answer says what we actually value.",
  };
  L(agent, "in a rut", `${counts[0]} findings, identical across ${recent.length} runs`,
    ANGLES[agent] ?? `What question has ${agent} never asked about its own subject?`,
    "Identical output run after run means the agent has stopped searching and started reciting. The count being stable is not the problem; the SAMENESS is.");
}

// ── 3 · POST-MORTEM: who should have caught it? ────────────────────────────
// Our error ledger is the sharpest teaching material we own, because every row
// is something that actually went wrong to us rather than to somebody in a book.
{
  const rows = ledger.split("\n").filter(l => /^\| \d+ \|/.test(l));
  const OWNER = [
    [/filter|reject|exclude|listing/i, "domain-plausibility", "a filter eating a market is a plausibility question before it is a code question"],
    [/stale|old|refresh|cadence/i, "steward", "staleness is work not being done, which is the steward's subject"],
    [/comment|fixture|itself|self-read/i, "breaker", "a checker reading itself is an untested assumption, which is exactly what the breaker hunts"],
    [/price|index|movement|basis/i, "anomaly", "a number behaving impossibly is what the anomaly watcher exists for"],
    [/copy|text|word|explanation/i, "experience", "meaningless published text is a reader-experience failure first"],
  ];
  for (const row of rows.slice(-6)) {
    const hit = OWNER.find(([rx]) => rx.test(row));
    if (!hit) continue;
    const [, agent, why] = hit;
    const summary = (row.split("|")[2] ?? "").trim().slice(0, 90);
    L(agent, "post-mortem", `an incident in your domain: "${summary}"`,
      `Would you catch this today? If yes, what specifically would fire. If no, what would you need?`,
      why);
  }
}

// ── 4 · CROSS-POLLINATION ──────────────────────────────────────────────────
// Five different checkers read their own source in one day, each discovered
// separately, none of them told the others. A lesson learned by one agent is
// free for the rest and almost never travels on its own.
{
  const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
  const readsOwnSource = [];
  for (const f of files) {
    const src = await R(`scripts/${f}`);
    if (/readdir|readFile[^\n]*scripts\//.test(src) && !new RegExp(`f !== "${f}"|!== "${f}"`).test(src))
      readsOwnSource.push(f);
  }
  if (readsOwnSource.length >= 2)
    L("ALL", "shared lesson", `${readsOwnSource.length} scripts scan the scripts directory without excluding themselves`,
      "Each of you found this alone. Which other lesson has one of you learned that the rest are still about to learn?",
      "A checker whose search space includes itself reports clean and means nothing. Five agents discovered this separately in one day and none told the others.");
}

const out = { generatedAt: new Date().toISOString(),
  role: "Keeps agents current, breaks them out of ruts, and teaches from incidents that actually happened to us. It asks questions; it never rewrites another agent.",
  counts: { stale: lessons.filter(l => l.kind === "stale knowledge").length,
    ruts: lessons.filter(l => l.kind === "in a rut").length,
    postMortem: lessons.filter(l => l.kind === "post-mortem").length,
    shared: lessons.filter(l => l.kind === "shared lesson").length },
  lessons };
await writeFile(join(ROOT, "research/pulse/teacher.json"), JSON.stringify(out, null, 1));
console.log(`✓ teacher: ${out.counts.ruts} in a rut · ${out.counts.postMortem} post-mortem · ${out.counts.stale} stale · ${out.counts.shared} shared`);
for (const l of lessons.slice(0, 6)) console.log(`  [${l.agent}] ${l.kind}: ${l.question.slice(0, 88)}`);
