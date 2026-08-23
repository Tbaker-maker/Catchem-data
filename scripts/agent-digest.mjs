// agent-digest.mjs — one page so the agents reach a person.
//
// The Improver's first finding was that every agent writes JSON nothing reads.
// That is the farming law from the inside: eight files a day, produced
// faithfully, consumed by nobody. An agent whose output reaches no human has
// not done work — it has made a file.
//
// This is the fix: ONE artifact a person actually opens, written in the voice
// the agents already use. Not eight dashboards — one page, short enough to
// read with coffee, that says what the machines noticed overnight.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rotate } from "./rotate.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const today = new Date().toISOString().slice(0, 10);

const fal = await J("research/pulse/falsifier-report.json");
const cor = await J("research/pulse/correction-hunt.json");
const brk = await J("research/pulse/breaker-report.json");
const imp = await J("research/pulse/improver-report.json");
const sup = await J("research/pulse/agent-supervision.json");
const cre = await J("research/pulse/creator-report.json");
const ano = await J("research/pulse/anomaly-report.json");
const plat = await J("research/pulse/platform-report.json");
const stw = await J("research/pulse/steward-report.json");
const sec = await J("research/pulse/security-report.json");
const cmp = await J("research/pulse/compliance-report.json");
const api = await J("research/pulse/api-strategy.json");
const tch = await J("research/pulse/teacher.json");
const scout = await J("research/pulse/theme-scout.json");
const des = await J("research/pulse/design-audit.json");
const oq = await J("research/pulse/open-questions.json");
const dec = await J("research/pulse/decision-audit.json");
const bias = await J("research/pulse/bias-guard.json");
const dpl = await J("research/pulse/domain-plausibility.json");
const con = await J("research/pulse/agent-contract.json");
const uni = await J("research/pulse/universe-advisor.json");
const rev = await J("research/pulse/review-agents.json");
const exp = await J("research/pulse/experience-report.json");

const L = [];
const say = (s = "") => L.push(s);

say(`# What the machines noticed — ${today}`);
say();
say(rotate([
  "Nothing here needs you this morning unless something is marked NEEDS A HUMAN.",
  "Read it with coffee. Anything urgent says so in capitals.",
  "The overnight shift's notes. Short on purpose.",
]));
say();

// ── Did any of our own claims fail? ─────────────────────────────────────
if (fal) {
  const tripped = (fal.results ?? []).filter(r => r.verdict === "TRIPPED");
  say(`## Our own claims`);
  say(fal.mood ?? "");
  if (tripped.length) {
    say();
    say(`**NEEDS A HUMAN — ${tripped.length} thesis/theses failed its own kill condition.** We said in advance what would end them, and that happened, so they end. Drafts of the public amendment are in the falsifier report.`);
    for (const t of tripped) say(`- **${t.id} (${t.name})** — ${t.detail}`);
  } else {
    const s = fal.summary ?? {};
    say(`${s.survived ?? 0} survived their own kill conditions, ${s.insufficient ?? 0} could not be judged yet with the tape we hold.`);
  }
  if (fal.coverage?.untested?.length)
    say(`\n**NEEDS A HUMAN:** ${fal.coverage.untested.join(", ")} written into doctrine with no test. Write one or retire the thesis.`);
  say();
}

// ── Did we publish anything we should take back? ────────────────────────
if (cor) {
  say(`## Our own numbers`);
  say(cor.mood ?? "");
  const sus = cor.suspectFigures ?? [], gone = cor.featuredThenUnmeasurable ?? [];
  if (sus.length) { say(); say(`**NEEDS A HUMAN — ${sus.length} figure(s) moved faster than a market can:`); for (const f of sus.slice(0, 4)) say(`- ${f.name}: $${f.was} → $${f.became} in ${f.from}→${f.to} (${f.movePct > 0 ? "+" : ""}${f.movePct}%)`); }
  if (gone.length) { say(); say(`${gone.length} product(s) we featured and can no longer price:`); for (const g of gone.slice(0, 3)) say(`- ${g.name} (featured ${g.featuredOn})`); }
  if (!sus.length && !gone.length) say(`Nothing to take back.`);
  say();
}

// ── What have we not tested, and what could be better? ──────────────────
const highs = (brk?.hypotheses ?? []).filter(h => h.severity === "high");
if (highs.length || (imp?.ideas ?? []).length) {
  say(`## Untested and improvable`);
  if (highs.length) { say(`${highs.length} untested assumption(s) — the highest:`); for (const h of highs.slice(0, 3)) say(`- **${h.target}** — ${h.attack}`); say(); }
  const ideas = imp?.ideas ?? [];
  if (ideas.length) { say(`${ideas.length} thing(s) that work and could work better — the top three:`); for (const i of ideas.slice(0, 3)) say(`- *${i.area}* — ${i.observation} ${i.suggestion}`); }
  say();
}

// ── Are the agents themselves behaving? ─────────────────────────────────
if (sup?.problems?.length) {
  say(`## The agents themselves`);
  say(`**NEEDS A HUMAN — the supervisor flagged the watchers:**`);
  for (const p of sup.problems.slice(0, 4)) say(`- ${p}`);
  say();
}

// ── What would buy the most, if we spent anything ───────────────────────
if (uni?.tranches) {
  const t = uni.tranches["+50"];
  if (t?.artistCohortsUnlocked) {
    say(`## If we expanded`);
    say(`Pricing 50 more cards would unlock ${t.artistCohortsUnlocked} artist cohorts and make ${t.catalogueCardsMadeAnalysable} catalogue cards analysable. That is Tyler's call, not the machine's.`);
    say();
  }
}

// The two review passes need judgment, so they report whether they RAN.
// An unrun review reported as silence would be the quiet failure this whole
// digest exists to prevent.
if (rev) {
  say(`## The reading passes`);
  if (rev.newcomer?.result || rev.redTeam?.result) {
    if (rev.newcomer?.result) say(`**Newcomer:** ${String(rev.newcomer.result).slice(0, 400)}`);
    if (rev.redTeam?.result) say(`**Red team:** ${String(rev.redTeam.result).slice(0, 400)}`);
  } else {
    say(`Did not run — no key present. ${(rev.newcomer?.lines ?? []).length} published lines and ${(rev.redTeam?.claims ?? []).length} claims are queued in review-agents.json. An unrun review is not a passed review.`);
  }
  say();
}

// The supervisor's workforce notes belong in front of a person — an agent
// proposing its own replacement is the most useful thing it can say.
if (sup?.workforce?.length) {
  say(`## The workforce`);
  const hires = sup.workforce.filter(w => w.kind === "HIRE");
  const other = sup.workforce.filter(w => w.kind !== "HIRE" && w.kind !== "AMBITION");
  if (hires.length) { say(`Gaps in what we watch:`); for (const h of hires.slice(0, 4)) say(`- **${h.what}** — ${h.why}`); }
  if (other.length) { say(); for (const o of other.slice(0, 3)) say(`- *${o.kind}* — ${o.what}: ${o.why}`); }
  const amb = sup.workforce.find(w => w.kind === "AMBITION");
  if (amb) { say(); say(`> ${amb.why}`); }
  say();
}

if (exp?.findings?.length) {
  say(`## How it feels to use`);
  say(`${exp.findings.length} measurable finding(s). The looking is not ours to do — ${exp.forHumanEyes.length} questions are queued for whoever has eyes.`);
  for (const f of exp.findings.slice(0, 3)) say(`- *${f.lane}* — ${f.observation} ${f.fix}`);
  say();
}

// The dispatch is the part a person acts on, so it goes near the top of what
// they read, split by who can actually do it. A finding delivered to the wrong
// person is the same as a finding nobody made.
const dsp = sup?.dispatch;
if (dsp && (dsp.tyler?.length || dsp.cc?.length || dsp.chat?.length)) {
  say(`## Who needs to do what`);
  const line = (i) => `- **[${i.band} ${i.score}]** ${i.what} — *${i.do}*`;
  if (dsp.tyler?.length) { say(`**NEEDS A HUMAN — Tyler (${dsp.tyler.length}):**`); for (const i of dsp.tyler.slice(0, 4)) say(line(i)); say(); }
  if (dsp.cc?.length) { say(`**CC (${dsp.cc.length}):**`); for (const i of dsp.cc.slice(0, 4)) say(line(i)); say(); }
  if (dsp.chat?.length) { say(`**Chat (${dsp.chat.length}):** top — ${dsp.chat[0].what} *[${dsp.chat[0].band}]*`); say(); }
  if (sup?.ratings) say(`*Every finding above passed four layers: the agent declared its evidence, the score was computed mechanically, the manager could demote but never promote, and only what survived is here. Today: ${sup.ratings.actNow} ACT NOW, ${sup.ratings.queue} QUEUE, ${sup.ratings.watch} WATCH, ${sup.ratings.noteOnly} filed without surfacing, ${sup.ratings.confirmed} confirmations.*`);
}

if (cre?.findings?.length) {
  say(`## The creator cheat code`);
  say(`*${cre.test}*`);
  for (const f of cre.findings.filter(x => /cheat code|spine|visual/.test(x.need)).slice(0, 3)) say(`- **${f.need}** — ${f.observation} *${f.fix}*`);
  say();
}

// The only section about the world rather than about us. It goes near the top
// once it has enough history to say anything, because "the market did something
// odd" is the most actionable line in the whole digest.
if (ano?.findings?.length) {
  const real = ano.findings.filter(f => f.kind !== "not yet");
  say(`## What the market did`);
  if (real.length) { for (const f of real.slice(0, 4)) say(`- **${f.kind}** — ${f.what} *${f.why}*`); }
  else say(`Nothing unusual, or not enough history to tell — ${ano.historyDays} days of tape so far. Anomaly detection needs a distribution, and saying so is the honest answer.`);
  say();
}

if (plat?.findings?.length) {
  say(`## Where today's story goes`);
  for (const p of ["X", "YouTube", "TikTok"]) {
    const pick = plat.findings.find(f => f.platform === p && /today|angle|clip/.test(f.kind));
    if (pick) say(`- **${p}** — ${pick.what}`);
  }
  const gaps = plat.findings.filter(f => f.kind === "gap");
  if (gaps.length) say(`\n${gaps.length} format gap(s): ${gaps.map(g => `${g.platform} — ${g.what}`).slice(0, 2).join("; ")}`);
  say();
}

if (stw?.speak?.length) {
  say(`## Something is slipping`);
  for (const s of stw.speak.slice(0, 4)) say(`- **${s.kind}** — ${s.what} *${s.why}*`);
  say();
}

if (con && con.openClauses) {
  say(`## The workforce itself`);
  say(`${con.fullyCompliant}/${con.agents} agents meet all ten obligations · ${con.openClauses} open clause(s).`);
  for (const r of (con.report ?? []).filter(r => r.failing.length).slice(0, 3)) say(`- **${r.agent}** ${r.met}/${r.obligations} — ${r.failing.map(f => f.clause).join(", ")}`);
  say();
}

if (sec?.critical?.length) {
  say(`## SECURITY — NEEDS A HUMAN NOW`);
  for (const c of sec.critical) say(`- **${c.what}** — *${c.fix}*`);
  say();
} else if (sec?.warnings?.length) {
  say(`## Security`);
  for (const w of sec.warnings.slice(0, 2)) say(`- ${w.what} — *${w.fix}*`);
  say();
}

if (cmp?.tripped?.length) {
  say(`## A DEFERRAL JUST ENDED — NEEDS A HUMAN`);
  for (const t of cmp.tripped) say(`- **[${t.severity}]** ${t.obligation} — fired by ${t.firedBy.join("; ")}. *${t.note}*`);
  say(`\n*${cmp.disclaimer}*`);
  say();
} else if (cmp?.highestRisk) {
  say(`## Legal standing`);
  say(`Nothing has tripped. Highest live risk: **${cmp.highestRisk.what}** — ${cmp.highestRisk.why}`);
  say(`*Cheapest fix: ${cmp.highestRisk.cheapestMitigation}*`);
  const near = (cmp.legalAnalysis ?? []).filter(a => /THRESHOLD|LIVE|approaching/.test(a.proximity));
  for (const a of near) say(`- ${a.domain}: ${a.proximity}`);
  say(`\n*${cmp.legalDisclaimer}*`);
  say();
} else if (cmp?.stale) {
  say(`## Compliance`);
  say(`The register has not been reviewed in ${cmp.registerAgeDays} days. Nothing has tripped, but a register nobody re-reads is the failure it exists to prevent.`);
  say();
}

if (dpl?.counts?.high) {
  say(`## Numbers that do not make sense for what they are`);
  say(`${dpl.counts.high} value(s) are structurally fine and absurd in context.`);
  for (const s of (dpl.termSuspects ?? []).filter(s => s.suspicious))
    say(`- **"${s.term}"** killed ${s.kills} listings across the board — ${s.note}`);
  for (const f of (dpl.findings ?? []).slice(0, 2)) say(`- ${f.name}: ${f.what} — *${f.likelyCause}*`);
  say();
}

if (api?.counts?.critical) {
  say(`## Paid for and never used`);
  for (const f of (api.findings ?? []).filter(f => f.severity === "critical")) say(`- **${f.what}** — ${f.why}`);
  say();
}

if (tch?.lessons?.length) {
  say(`## What the agents should be asking themselves`);
  const pm = tch.lessons.filter(l => l.kind === "post-mortem").slice(0, 2);
  const rut = tch.lessons.filter(l => l.kind === "in a rut").slice(0, 2);
  for (const l of [...pm, ...rut]) say(`- **${l.agent}** — ${l.question}`);
  say();
}

if (dec?.dueForGrading) {
  say(`## A decision has come due`);
  for (const x of dec.due.slice(0, 3)) say(`- **${x.decision}** — predicted: *${x.predicted}* Did it hold?`);
  say();
}

if (bias?.problems?.length) {
  say(`## Who is catching our mistakes`);
  for (const p of bias.problems.slice(0, 2)) say(`- **${p.what}** — *${p.why}*`);
  say();
}

if (scout?.finds?.length) {
  say(`## Post ideas nobody looked for`);
  for (const f of scout.finds.filter(f => !f.needsHuman).slice(0, 3)) say(`- **${f.headline}** — ${f.hook ?? f.why}`);
  say();
}

if (des?.counts?.high) {
  say(`## Design`);
  say(`${des.counts.high} high, ${des.counts.medium} medium across ${des.audited}.`);
  for (const f of (des.findings ?? []).filter(f => f.severity === "high").slice(0, 3)) say(`- **${f.surface}** — ${f.what}. *${f.fix}*`);
  say();
}

{
  const unanswered = (oq?.questions ?? []).filter(q => !q.answer);
  if (unanswered.length) {
    const forTyler = unanswered.filter(q => q.who === "tyler");
    const forCC = unanswered.filter(q => q.who === "cc");
    say(`## What the agents cannot answer themselves`);
    say(`${unanswered.length} open — ${forCC.length} need eyes on a rendered page, ${forTyler.length} need a decision.`);
    for (const q of forTyler.slice(0, 3)) say(`- **NEEDS A HUMAN** [${q.agent}] ${q.question}`);
    for (const q of forCC.slice(0, 3)) say(`- [${q.agent}] ${q.question}`);
    say();
  }
}

say(`---`);
say(`*Written by the agents, for a person. If a section here never leads to an action, that section should be deleted rather than tolerated.*`);

const md = L.join("\n");
await writeFile(join(ROOT, `research/pulse/agent-digest.md`), md);
await writeFile(join(ROOT, `research/pulse/agent-digest-${today}.md`), md);
const needsHuman = (md.match(/NEEDS A HUMAN/g) || []).length;
console.log(`✓ agent digest: ${md.split("\n").length} lines · ${needsHuman} item(s) marked NEEDS A HUMAN → research/pulse/agent-digest.md`);
