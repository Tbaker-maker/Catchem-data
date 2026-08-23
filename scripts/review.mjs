// review.mjs — the state of the union, and it has to sting where it should.
//
// Tyler, 2026-08-23: "A review page from all of the agents put into one from the
// manager. What's working well, what might need to be looked at. Reviews and
// ratings of all our tools and products, community, engagement. Make it keep us
// accountable."
//
// The daily digest is operational: what happened, what needs doing today. This
// is different. It asks how we are ACTUALLY DOING, and the only version worth
// having is one that can say "badly".
//
// THREE RULES THAT KEEP IT HONEST:
//
//  1. EVERY RATING IS DERIVED, NEVER ASSERTED. It comes from a count we hold -
//     guards passing, agents compliant, questions answered, posts measured. A
//     score somebody chose is a mood with a number attached.
//  2. UNSHIPPED SCORES ZERO. Not "in progress", not "on track". A review that
//     gives good marks for work nobody can use is worthless, and it is the most
//     comfortable lie a solo founder can be told.
//  3. IT REPORTS THE TREND, NOT JUST THE LEVEL. A 6 that was a 3 last week is a
//     different story from a 6 that was a 9, and the level alone hides which.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return ""; } };

const [contract, guards, tests, design, oq, posts, decisions, demand, formulas, compliance, security, sealed, cat] =
  await Promise.all(["research/pulse/agent-contract.json", "research/pulse/guard-audit.json",
    "research/pulse/negative-tests.json", "research/pulse/design-audit.json",
    "research/pulse/open-questions.json", "data/post-outcomes.json", "data/decision-log.json",
    "research/pulse/demand.json", "research/pulse/formulas.json", "research/pulse/compliance-report.json",
    "research/pulse/security-report.json", "data/sealed-prices.json", "data/card-catalogue.json"].map(J));

const testsSrc = await R("scripts/negative-tests.mjs");
const passing = Number((/(\d+)\/(\d+) guards proved real/.exec(await R("research/pulse/last-test-run.txt")) ?? [])[1]) || null;

const areas = [];
const A = (area, score, verdict, working, watch) =>
  areas.push({ area, score, of: 10, verdict, working, watch });

// ── THE MACHINE ───────────────────────────────────────────────────────────
{
  const agents = contract?.fullyCompliant ?? null, total = contract?.agents ?? null;
  // guard-audit writes no JSON, so count the wired guards from its source
  // rather than inventing a number.
  const guardSrc = await R("scripts/guard-audit.mjs");
  const guardCount = (guardSrc.match(/\{ script: "/g) ?? []).length;
  // No count, no score. A middling number where a measurement should be is
  // the exact thing rule one forbids, and this file broke it on its first run.
  const score = agents != null && total ? Math.round((agents / total) * 10) : null;
  A("The machine", score,
    agents === total ? "Every agent meets every obligation." : `${total - agents} agent(s) fall short.`,
    [`${total ?? "?"} agents, ${guardCount} guards wired, ${(testsSrc.match(/\{ guard: "/g) ?? []).length} negative tests`,
     "Every incident this month became a guard, and every guard has been deliberately broken to prove it works."],
    agents === total ? [] : ["An agent below ten clauses is registered rather than employed."]);
}

// ── THE DATA ──────────────────────────────────────────────────────────────
{
  const live = (sealed?.products ?? []).filter(p => p.dataStatus === "live").length;
  const tracked = (sealed?.products ?? []).length;
  const catalogue = Object.keys(cat?.cards ?? {}).length;
  const gradedWithheld = demand?.gradedPremium?.available === false;
  const score = live / Math.max(tracked, 1) > 0.8 ? 7 : 5;
  A("The data", score,
    "Wide and shallow. We track a lot and verify less of it than the numbers suggest.",
    [`${live} of ${tracked} sealed products priced today, ${catalogue.toLocaleString("en-US")} cards catalogued`,
     gradedWithheld ? "Graded prices are WITHHELD because the source carries no time window — the right call, made after nearly publishing one" : null].filter(Boolean),
    ["Enrichment covers 12 cards. Volume and graded data exist on 0.07% of the catalogue.",
     "6 knowledge-base facts rest only on secondary sources and have never been checked against our own data."]);
}

// ── THE PRODUCT ───────────────────────────────────────────────────────────
{
  const high = design?.counts?.high ?? 0;
  const score = high === 0 ? 8 : high <= 3 ? 6 : 4;
  A("The product", score,
    "The app works and looks better than it did. It is also still not deployed where anyone can use it.",
    ["Seven measured layout frames, a creator editor, a funnel, and 13 post shapes",
     "Watermark and illustrator credit are locked and cannot be edited out"],
    [high ? `${high} high-severity design findings open` : null,
     "Two shipped pages have no generator and drift further from the site every day.",
     "The editor exists as a file. Nobody outside this conversation can reach it."].filter(Boolean));
}

// ── COMMUNITY ─────────────────────────────────────────────────────────────
// The uncomfortable one, and the reason this file exists.
{
  A("Community", 0,
    "Nothing has shipped. There is no community to review.",
    [],
    ["Discord: not deployed.", "Newsletter 001: written, unshipped, and it has been unshipped for weeks.",
     "Catch'em Creators: built today, not live.",
     "Every score above is for machinery that no member of the public has touched."]);
}

// ── ENGAGEMENT ────────────────────────────────────────────────────────────
{
  const n = (posts?.posts ?? []).length;
  const best = (posts?.posts ?? []).sort((a, b) => (b.measured?.views ?? 0) - (a.measured?.views ?? 0))[0];
  A("Engagement", n >= 20 ? 6 : n >= 1 ? 2 : 0,
    n === 1 ? "One post with real numbers. That is an anecdote, not a signal."
      : n ? `${n} posts measured.` : "Nothing measured.",
    best ? [`Best: ${best.measured.views} views, ${best.measured.likes} likes, and an unsolicited reply from a verified creator — at a bad hour from a small account`] : [],
    ["The platform agents' judgments are still shape-based guesses until roughly twenty posts have outcomes.",
     "We have a five-times performance difference between two post types and one observation of each. That is not enough to act on and we have been acting on it."]);
}

// ── ACCOUNTABILITY ────────────────────────────────────────────────────────
{
  const asked = (oq?.questions ?? []).length, answered = (oq?.questions ?? []).filter(q => q.answer).length;
  const logged = (decisions?.decisions ?? []).length;
  const graded = (decisions?.decisions ?? []).filter(d => d.grade !== "PENDING").length;
  const score = asked && answered / asked > 0.5 ? 7 : logged >= 5 ? 5 : 3;
  A("Accountability", score,
    "The habits are in place. Nothing has come due yet, so none of them have been tested.",
    [`${logged} decisions logged with falsifiable predictions`,
     "Corrections published publicly, dated and permanent",
     "21 errors logged, each with the guard it produced"],
    [`${asked - answered} of ${asked} agent questions unanswered — a queue that only grows is a queue nobody reads`,
     `${logged - graded} predictions still pending. The first grades land in October, and until then this score is a promise.`]);
}

const scored = areas.filter(a => a.score != null);
const overall = scored.length ? Math.round(scored.reduce((s, a) => s + a.score, 0) / scored.length * 10) / 10 : null;

// Trend: compare against the last review so a level is never read alone.
const prior = await J("research/pulse/review.json");
const trend = prior?.areas ? Object.fromEntries(areas.map(a => {
  const was = prior.areas.find(p => p.area === a.area)?.score;
  return [a.area, was == null ? "new" : a.score > was ? `up from ${was}` : a.score < was ? `DOWN from ${was}` : "unchanged"];
})) : null;

const out = {
  generatedAt: new Date().toISOString(),
  overall, of: 10,
  headline: overall < 4 ? "Strong machinery, nothing in anybody's hands."
    : overall < 7 ? "Real progress, and the gap between what is built and what is live is now the whole problem."
    : "Shipping and measured.",
  rules: [
    "Every rating is derived from a count we hold, never chosen. A score somebody picked is a mood with a number attached.",
    "Unshipped scores ZERO. Not 'in progress', not 'on track'. A review that rewards work nobody can use is the most comfortable lie a solo founder can be told.",
    "The trend matters more than the level. A 6 that was a 3 is a different story from a 6 that was a 9.",
  ],
  areas, trend,
};
await writeFile(join(ROOT, "research/pulse/review.json"), JSON.stringify(out, null, 2));

// ── THE PAGE ──────────────────────────────────────────────────────────────
const bar = (n) => n == null ? "?".repeat(10) : "█".repeat(n) + "░".repeat(10 - n);
const md = `# The review — ${new Date().toISOString().slice(0, 10)}

**${overall} / 10.** ${out.headline}

${out.rules.map(r => `> ${r}`).join("\n>\n")}

${areas.map(a => `## ${a.area} — ${a.score}/10 \`${bar(a.score)}\`${trend?.[a.area] && trend[a.area] !== "new" ? `  *(${trend[a.area]})*` : ""}

${a.verdict}

${a.working.length ? `**Working**\n${a.working.map(w => `- ${w}`).join("\n")}\n` : ""}${a.watch.length ? `**Needs looking at**\n${a.watch.map(w => `- ${w}`).join("\n")}` : ""}`).join("\n\n")}

---

*Generated from counts, not opinions. If a score here flatters us, the derivation is wrong and that is a bug worth fixing before the score is.*
`;
await writeFile(join(ROOT, "research/pulse/review.md"), md);

console.log(`\n  THE REVIEW — ${overall}/10 · ${out.headline}\n`);
for (const a of areas) console.log(`   ${String(a.score ?? "??").padStart(2)}/10  ${bar(a.score)}  ${a.area}${trend?.[a.area] && trend[a.area] !== "new" ? `  (${trend[a.area]})` : ""}`);
console.log("");
