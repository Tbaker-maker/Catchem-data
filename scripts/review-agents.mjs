// review-agents.mjs — THE NEWCOMER and THE RED TEAM.
//
// Both need judgment rather than arithmetic, so both are built the same way:
// gather exactly what needs reviewing, assemble a precise request, and then
// EITHER call a model (if a key is present) OR write the request out for a
// human or CC to run. Never a silent approximation — that is the whole point.
//
// THE NEWCOMER reads every published sentence as somebody who has never bought
// a card and marks where they would stop understanding. Our jargon linter
// matches patterns; it cannot feel confusion. This can.
//
// THE RED TEAM argues the strongest case AGAINST each interpretive claim we
// are about to publish, from the same data. If the counter is good we publish
// it alongside; if it is weak the claim ships stronger for having survived.
// It is the Referee Doctrine turned inward — we already refuse to take sides
// between buyers and vendors, so we should not take sides with our own first
// instinct either.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { callClaude } from "./lib/claude.mjs";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this until the runner kills the job. A hung job
// reports nothing and burns the whole allowance.
const FETCH_TIMEOUT_MS = 120000;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const der = await J("data/derived-insights.json") ?? {};
const feed = await J("research/pulse/pulse-feed.json") ?? {};
const today = new Date().toISOString().slice(0, 10);

// ── What the Newcomer reads: every sentence we actually publish ─────────
const publishedCopy = [];
const push = (where, text) => { if (text && String(text).trim().length > 15) publishedCopy.push({ where, text: String(text).trim() }); };
for (const [k, v] of Object.entries(der.dailyThree ?? {})) push(`dailyThree.${k}`, v?.whyChosen || v?.explain);
for (const e of der.eraIndexes ?? []) push(`era.${e.era}`, e.read);
for (const s of der.supplyShifts ?? []) push(`supply.${s.id}`, s.read);
push("index.simple", der.sealedIndex?.simple);
push("index.twin", der.sealedIndex?.valueWeighted?.simple);
push("shipping", feed.shippingNote);
push("disclosure", feed.disclosure);
const dyk = feed.didYouKnow; if (dyk) { push("dyk.body", dyk.body); push("dyk.takeaway", dyk.why_it_matters); }

// ── What the Red Team argues against: every READ-chipped claim ──────────
const claims = [];
for (const [k, v] of Object.entries(der.dailyThree ?? {})) if (v?.chip === "READ") claims.push({ id: `dailyThree.${k}`, claim: v.explain || v.whyChosen, evidence: { ...v } });
for (const s of (der.supplyShifts ?? []).slice(0, 4)) claims.push({ id: `supply.${s.id}`, claim: s.read, evidence: { listings: `${s.prev}→${s.listings}`, dPct: s.dPct, priceDPct: s.priceDPct } });
for (const e of (der.eraIndexes ?? []).slice(0, 3)) claims.push({ id: `era.${e.era}`, claim: e.read, evidence: { products: e.products, avgGapPct: e.avgGapPct, boxMedian: e.boxMedian } });

const NEWCOMER_BRIEF = `You have never bought a Pokémon card and know nothing about the hobby or about markets.
Read each line below. For every line, answer only: would you understand it, and if not, WHICH WORD OR PHRASE stopped you?
Do not be generous. If a term is technically explained elsewhere but not in the line itself, you did not understand it.
Report only the lines that lost you, with the exact stopping point. Say nothing about lines that were clear.`;

const REDTEAM_BRIEF = `For each claim below, argue the STRONGEST honest case that it is wrong or misleading, using only the evidence given.
Do not invent data. If the claim is well supported and no serious counter exists, say so plainly — a weak counter offered for the sake of balance is worse than none.
Where a genuine counter exists, state it in one or two sentences, in language a collector would use.`;

const request = { generatedAt: new Date().toISOString(), date: today,
  note: "Two review passes that need judgment, not arithmetic. Run by a model with a key, or by CC, or by Tyler. Output is a DRAFT — nothing here publishes itself.",
  newcomer: { brief: NEWCOMER_BRIEF, lines: publishedCopy },
  redTeam: { brief: REDTEAM_BRIEF, claims } };

// If a key is present, run it. If not, write the request and say so clearly —
// an unrun review is reported as unrun, never as passed.
let ran = false;
if (process.env.ANTHROPIC_API_KEY) {
  try {
    // THE WORST OF THE FOUR. No res.ok, no stop_reason, and 1200 tokens for a
    // full review pass — then `ran = true` regardless of what came back. A 401
    // returns valid JSON with no content array, so the text was "", the file
    // recorded two empty review results, and the run reported a review that
    // never happened. The same shape as the other three failures: success
    // asserted, artifact absent.
    const call = async (brief, payload) => {
      const { text } = await callClaude({
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxTokens: 4000,
        messages: [{ role: "user", content: `${brief}\n\n${JSON.stringify(payload, null, 1)}` }],
        label: "review-agents" });
      return text;
    };
    request.newcomer.result = await call(NEWCOMER_BRIEF, publishedCopy);
    request.redTeam.result = await call(REDTEAM_BRIEF, claims);
    ran = true;
  } catch (e) { request.error = `review call failed: ${e.message}`; }
}

await writeFile(join(ROOT, "research/pulse/review-agents.json"), JSON.stringify(request, null, 1));
console.log(`✓ review agents: ${publishedCopy.length} published lines queued for the Newcomer, ${claims.length} claims queued for the Red Team`);
console.log(ran ? "  both passes ran — results are in research/pulse/review-agents.json"
  : "  NOT RUN — no ANTHROPIC_API_KEY. The request is written out; run it with a key, or hand research/pulse/review-agents.json to CC. An unrun review is not a passed review.");
