// finding-rating.mjs — every finding gets a score, and passes review before it
// reaches a person.
//
// THE PROBLEM THIS SOLVES: thirteen agents produce findings all day and every
// one arrives with equal weight. A guess about TikTok formats and a measured
// pricing error look identical in a list, so a reader either treats everything
// as urgent or treats nothing as urgent, and the second one always wins.
//
// THE HONEST CONSTRAINT, stated first because it governs everything below:
// we have NO outcome history. A "success rate" computed today would be
// invented, and inventing it would break the one law this company actually
// runs on. So the system measures what it can now — evidence, impact,
// actionability — records outcomes going forward, and reports track record as
// UNPROVEN until there is something real to report. The rating gets better by
// being used, which is the only honest way for a rating to get better.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// ── THE FOUR COMPONENTS ────────────────────────────────────────────────────
// Deliberately not weighted equally. A finding that cannot be acted on is
// worthless however certain it is, so actionability can veto everything else.
export const EVIDENCE = {
  MEASURED:   { score: 40, means: "computed from data we hold; anyone could check it" },
  OBSERVED:   { score: 30, means: "seen in our own output or code, not inferred" },
  DERIVED:    { score: 20, means: "follows from things we measured, but is a step removed" },
  REASONED:   { score: 10, means: "an argument from principle — defensible, not verifiable" },
  HYPOTHESIS: { score: 5,  means: "a guess worth testing, labelled as one" },
};
export const IMPACT = {
  CRITICAL: { score: 30, means: "publishes something wrong, or breaks in front of a person" },
  HIGH:     { score: 22, means: "materially changes what a reader sees or believes" },
  MEDIUM:   { score: 14, means: "makes the product or the work meaningfully better" },
  LOW:      { score: 6,  means: "tidier, cheaper, or nicer — real, but survivable" },
};
export const ACTIONABLE = {
  NOW:      { score: 20, means: "somebody named can do it today" },
  SOON:     { score: 14, means: "clear what to do, needs a slot" },
  BLOCKED:  { score: 6,  means: "known dependency, cannot start" },
  UNCLEAR:  { score: 0,  means: "nobody knows what doing this would even mean" },
};

// ── TRACK RECORD ───────────────────────────────────────────────────────────
// The only component that cannot be scored today. It is worth up to 10 points
// and starts at UNPROVEN, worth nothing — an agent earns credibility by being
// right where somebody checked, not by existing.
export async function trackRecord(agentId) {
  const hist = await J("data/finding-outcomes.json") ?? { outcomes: {} };
  const o = hist.outcomes[agentId];
  if (!o || (o.confirmed + o.dismissed) < 5)
    return { score: 0, status: "UNPROVEN", note: `${(o?.confirmed ?? 0) + (o?.dismissed ?? 0)} judged outcome(s) — needs 5 before a track record means anything` };
  const rate = o.confirmed / (o.confirmed + o.dismissed);
  return { score: Math.round(rate * 10), status: rate >= 0.7 ? "RELIABLE" : rate >= 0.4 ? "MIXED" : "NOISY",
    note: `${o.confirmed} of ${o.confirmed + o.dismissed} findings held up when somebody checked` };
}

// ── THE RATING ─────────────────────────────────────────────────────────────
// 0–100. The bands are named for what a person should DO, not for how the
// number feels — "A grade" tells nobody anything.
export const BANDS = [
  { min: 75, band: "ACT NOW",   means: "strong evidence, real consequence, somebody can start today" },
  { min: 55, band: "QUEUE",     means: "worth doing, not worth interrupting anything for" },
  { min: 35, band: "WATCH",     means: "might matter; look again if it recurs or strengthens" },
  { min: 0,  band: "NOTE ONLY", means: "recorded so it is not rediscovered, not surfaced to anyone" },
];

export async function rate({ agentId, evidence, impact, actionable, note }) {
  const e = EVIDENCE[evidence] ?? EVIDENCE.HYPOTHESIS;
  const i = IMPACT[impact] ?? IMPACT.LOW;
  const a = ACTIONABLE[actionable] ?? ACTIONABLE.UNCLEAR;
  const tr = await trackRecord(agentId);
  let score = e.score + i.score + a.score + tr.score;

  // THE VETO: something nobody can act on is a note, whatever else it scores.
  // Without this, a certain, critical, unactionable finding rates ACT NOW and
  // sends somebody to do nothing — which is how a rating system loses its
  // reader in one week.
  const vetoed = actionable === "UNCLEAR";
  if (vetoed) score = Math.min(score, 30);

  const band = BANDS.find(b => score >= b.min);
  return { score, band: band.band, bandMeans: band.means, vetoed,
    components: { evidence: `${evidence} (${e.score}) — ${e.means}`, impact: `${impact} (${i.score}) — ${i.means}`,
      actionable: `${actionable} (${a.score}) — ${a.means}`, trackRecord: `${tr.status} (${tr.score}) — ${tr.note}` },
    note };
}

// ── OUTCOME RECORDING ──────────────────────────────────────────────────────
// The half that makes the rating real. A finding is CONFIRMED when acting on
// it changed something, DISMISSED when somebody looked and it was not a
// problem. Both are useful; only silence is useless.
export async function recordOutcome(agentId, findingId, outcome, why) {
  const path = join(ROOT, "data/finding-outcomes.json");
  const hist = await J("data/finding-outcomes.json") ?? {
    note: "Did the finding hold up when somebody checked? This is what turns a rating from an opinion into a measurement. Recorded by hand or by CC — never inferred, because a finding that quietly disappeared is not the same as one that was right.",
    outcomes: {}, log: [] };
  const o = (hist.outcomes[agentId] ||= { confirmed: 0, dismissed: 0 });
  if (outcome === "confirmed") o.confirmed++;
  else if (outcome === "dismissed") o.dismissed++;
  hist.log.push({ at: new Date().toISOString(), agentId, findingId, outcome, why });
  hist.log = hist.log.slice(-500);
  await writeFile(path, JSON.stringify(hist, null, 1));
  return hist.outcomes[agentId];
}
