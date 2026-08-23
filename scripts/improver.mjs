// improver.mjs — WHAT COULD BE BETTER.
//
// Every agent we have asks "what is broken". None asks "what could be better",
// and those are different questions with different answers. Broken things
// announce themselves eventually; mediocre things never do.
//
// The measure is OUR OWN DOCTRINE, not generic best practice. Generic advice
// is free and worthless — "add more tests" is not insight. What is useful is:
// where do we fall short of the standards we already set for ourselves?
//
// It obeys the agent laws it was born under: budgeted, actionable, scoped to
// what the reader can act on, and it says nothing rather than padding a list.
import { readFile, readdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const R = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs"));
const src = {};
for (const f of files) src[f] = await R(`scripts/${f}`) ?? "";
const all = Object.values(src).join("\n");
const pipeline = src["generate-pulse.mjs"] ?? "";
const theses = await R("research/house-theses.md") ?? "";
const der = await J("data/derived-insights.json") ?? {};
const feed = await J("research/pulse/pulse-feed.json") ?? {};

const ideas = [];
// ALREADY BUILT? A tool idea for something that exists is worse than silence -
// it teaches the reader that the list is unchecked, and today it took two of
// the four NEEDS-A-HUMAN slots while the one real finding sat underneath.
const BUILT = new Set(files.map(f => f.replace(".mjs", "")));
const alreadyExists = (text, observation = "") => {
  text = String(text) + " " + String(observation);
  const t = text.toLowerCase();
  if (/rip.{0,4}(or|,).{0,4}(sell|trade)/.test(t) && BUILT.has("rip-sell-trade")) return true;
  if (/print window/.test(t) && /shelf/.test(t)) return true;   // RT-8 reprint pressure crosses them
  return false;
};

const I = (area, observation, suggestion, effort) => alreadyExists(suggestion, observation) ? null : ideas.push({ area, observation, suggestion, effort, confidence: String(area).includes("hypothesis") ? "HYPOTHESIS" : "OBSERVED" });

// 1 — BUILT AND NEVER CONSUMED. The most expensive kind of work is work that
// runs every day and nobody reads.
{
  const outputs = [];
  for (const f of files) for (const m of src[f].matchAll(/research\/pulse\/([a-z0-9\-]+\.json)/g)) outputs.push(m[1]);
  for (const out of [...new Set(outputs)]) {
    const producedBy = files.filter(f => src[f].includes(`research/pulse/${out}`) && /writeFile/.test(src[f]));
    const readBy = files.filter(f => {
      const t = src[f];
      if (!t.includes(`research/pulse/${out}`)) return false;
      if (!producedBy.includes(f)) return true;
      // written AND read by the same script (history accumulation) counts as consumed
      return /readFile[^\n]*${out}|J\("research\/pulse\/${out}/.test(t) || t.includes(`await J("research/pulse/${out}")`);
    });
    const inFeed = JSON.stringify(feed).includes(out.replace(".json", ""));
    // The digest reads the agent reports and puts them in front of a person,
    // which is exactly what "consumed" means. Without this the Improver keeps
    // reporting a solved problem, and a list that includes solved problems
    // gets skimmed — the crying-wolf law applies to improvement agents too.
    const inDigest = (src["agent-digest.mjs"] ?? "").includes(out);
    if (producedBy.length && !readBy.length && !inFeed && !inDigest)
      I("unused output", `${out} is written every run and read by nothing — not another script, not the feed.`,
        `Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.`, "small");
  }
}

// 2 — DOCTRINE WITHOUT ENFORCEMENT. A law nothing checks is a wish.
{
  const LAWS = [
    ["USD LAW", /USD/, "every published figure is USD"],
    ["Sandbox Rule", /🍭|ELI5|simple:/, "every instrument ships a plain-words version"],
    ["Digest Law", /digest|glance/i, "the app stays glanceable"],
    ["Cliff Rule", /jargon-lint/, "no unexplained terms"],
    ["Referee Doctrine", /ADVERSARIAL/, "no buyer-vs-vendor framing"],
    ["No-Guessing Law", /never guess|no-guess/i, "unverified is never presented as verified"],
    ["Artist Claim Law", /sets we track|scopingRule/, "artist counts are scoped"],
    ["Pricing Basis Law", /shippingNote|delivered total/i, "shipping in, tax out, both stated"],
  ];
  for (const [name, rx, what] of LAWS) {
    const inDoctrine = theses.includes(name) || theses.toLowerCase().includes(name.toLowerCase());
    const enforced = rx.test(all);
    if (inDoctrine && !enforced)
      I("unenforced law", `"${name}" is written into doctrine (${what}) but nothing in the code checks it.`,
        `Add a check, or move it to a style note. A law nothing enforces drifts silently and then surprises somebody.`, "medium");
  }
}

// 3 — INCONSISTENT IMPLEMENTATION. The same idea done two ways is a bug waiting
// for someone to fix only one of them.
{
  const dupes = [
    [/toISOString\(\)\.slice\(0, ?10\)/g, "date-to-day-key", "scripts/rotate.mjs already centralises day maths"],
    [/Math\.round\([^)]*\* ?100\) ?\/ ?100/g, "money rounding", "one helper would make cents behave identically everywhere"],
    [/\.sort\(\(a, ?b\) ?=> ?a ?- ?b\)\[Math\.floor/g, "median", "median is computed inline in several places"],
  ];
  for (const [rx, what, note] of dupes) {
    const n = (all.match(rx) || []).length;
    if (n >= 6) I("repetition", `${what} is implemented inline ${n} times across the pipeline.`,
      `Centralise it — ${note}. Repeated maths is where two places drift and only one gets fixed.`, "small");
  }
}

// 4 — THE PIPELINE'S OWN SHAPE. Order matters more than people remember.
{
  const steps = [...pipeline.matchAll(/import\("\.\/([a-z0-9\-]+\.mjs)"\)/g)].map(m => m[1]);
  const guards = steps.filter(s => /guard|assert|lint/.test(s));
  if (guards.length && steps.indexOf("publish-assert.mjs") !== steps.length - 1)
    I("pipeline order", "publish-assert is not the final step.", "It must run last — it is the only check that reads what was actually published.", "small");
  if (steps.length > 12)
    I("pipeline size", `The daily run imports ${steps.length} steps from one file.`,
      `Consider grouping them (intake → compute → publish → agents) so the order is legible at a glance. A long flat list is where an ordering mistake hides.`, "medium");
}

// 5 — WHERE THE PRODUCT IS THIN AGAINST ITS OWN PROMISES.
{
  const dt = der.dailyThree ?? {};
  const filled = ["sealed", "shelf", "raw", "graded"].filter(k => dt[k]).length;
  if (filled < 3) I("product", `The Daily Three is showing ${filled} item(s).`, "A named instrument that does not deliver its own name is a promise the reader notices breaking.", "medium");
  const idx = der.sealedIndex;
  if (idx && idx.matchedSample === 0)
    I("product", "The index has no matched sample today, so it cannot move.", "Expected on a fresh series — worth a line on the page saying so, rather than a number that looks stuck.", "small");
  const facts = (await J("data/knowledge.json"))?.facts ?? [];
  if (facts.length < 20) I("knowledge", `The knowledge base holds ${facts.length} verified facts.`,
    `This is the asset that compounds — instruments can be rebuilt in a weekend, a decade of sourced facts cannot. A steady few per week beats a burst.`, "ongoing");
}

// 6 — COST. Slow steps are a tax paid every single day.
{
  const heavy = [];
  for (const f of files) {
    const s = await stat(join(ROOT, "scripts", f));
    if (s.size > 40000) heavy.push({ f, kb: Math.round(s.size / 1024) });
  }
  for (const h of heavy.slice(0, 2))
    I("maintainability", `${h.f} is ${h.kb}KB.`, `Large files are where two people edit the same function on the same day. Splitting by concern would make collisions rarer and reviews honest.`, "medium");
}


// ═══ PRODUCT LANE ═══════════════════════════════════════════════════════
// Everything above is hygiene. This asks the harder question: what would make
// this BETTER to use? Retention, clarity, likability, tools that could exist.
// Some of it is measurable and some is a hypothesis — each is labelled, because
// dressing a guess as a finding is the thing we least want to do.

// 7 — DATA WE HOLD AND NEVER SHOW. The cheapest product ideas in existence:
// we already paid for the data, we simply never surfaced it.
{
  const held = {
    "artist credits": (await J("data/card-catalogue.json"))?.cards,
    "per-pack economics": der.packMath,
    "deal zone": der.dealZone?.byId,
    "era indexes": der.eraIndexes,
    "print windows": der.printWatch,
    "supply shifts": der.supplyShifts,
    "verified facts": (await J("data/knowledge.json"))?.facts,
  };
  const shown = JSON.stringify(feed);
  for (const [name, data] of Object.entries(held)) {
    const n = Array.isArray(data) ? data.length : data ? Object.keys(data).length : 0;
    if (!n) continue;
    const key = name.split(" ")[0].toLowerCase();
    if (!shown.toLowerCase().includes(key))
      I("unsurfaced data", `We hold ${n} ${name} and the app never shows them.`,
        `The cheapest feature in existence is data already paid for. Surface it or drop the collection.`, "small");
  }
}

// 8 — RETENTION: is there a reason to come back TOMORROW?
{
  const daily = [];
  if (der.dailyThree) daily.push("Daily Three");
  if (feed.didYouKnow) daily.push("a fact");
  if ((der.supplyShifts ?? []).length) daily.push("shelf moves");
  if (der.watchOutcomes) daily.push("yesterday's calls revisited");
  if (daily.length < 4)
    I("retention", `Only ${daily.length} thing(s) change day to day (${daily.join(", ")}).`,
      `A market page that looks the same twice is a page nobody opens twice. Anything that visibly changes overnight is a reason to return.`, "medium");
  if (!der.watchOutcomes)
    I("retention", "Yesterday's picks are not revisited today.",
      `Scorekeeping is the strongest return-hook we have: people come back to see whether we were right. It also costs us nothing but honesty.`, "small");
  const streak = JSON.stringify(feed).includes("streak") || JSON.stringify(feed).includes("Day ");
  if (!streak) I("retention", "Nothing tells a reader how long they have been following, or how long we have been publishing.",
    `A visible run — "day 6 of publishing this" — turns a page into a habit for both sides.`, "small");
}

// 9 — LIKABILITY: does anything here have a personality?
{
  const warm = ["mood", "simple", "why_it_matters", "didYouKnow"].filter(k => JSON.stringify(feed).includes(k)).length;
  if (warm < 3)
    I("likability", `Only ${warm} warm element(s) in the feed — the rest is measurement.`,
      `Numbers earn trust; voice earns affection. The ELI5 lines and the facts are the parts people quote — there should be more of them, not fewer.`, "medium");
  const eli5 = (der.eraIndexes ?? []).filter(e => e.simple).length;
  const total = (der.eraIndexes ?? []).length;
  if (total && eli5 < total)
    I("sandbox rule", `${total - eli5} of ${total} era indexes ship without a plain-words version.`,
      `Our own Sandbox Rule says every instrument gets an ELI5 one tap away. Partial compliance is the same as none for whoever lands on the one without it.`, "small");
}

// 10 — TOOL IDEAS FROM DATA WE ALREADY HAVE. Hypotheses, clearly labelled.
{
  const has = (x) => x && (Array.isArray(x) ? x.length : Object.keys(x).length);
  if (has(der.dealZone?.byId) && has(der.packMath))
    I("tool idea (hypothesis)", "We hold both deal-zone room and per-pack economics for the same products.",
      `A "rip or trade" tool could answer one question nobody else can: at today's prices, is this box worth more opened, sold sealed online, or traded at a table? Three numbers we already compute, one screen.`, "medium");
  if (has(der.printWatch) && has(der.supplyShifts))
    I("tool idea (hypothesis)", "Print windows and shelf movement are computed separately and never combined.",
      `A late-print set whose shelves are draining is a genuinely different situation from either signal alone. Crossing them is free and nobody publishes it.`, "medium");
  if (has((await J("data/knowledge.json"))?.facts))
    I("tool idea (hypothesis)", "The knowledge base is only used for one fact a day.",
      `The same sourced facts could power a "why is this card like this" explainer on every product page — set context, print quirks, what makes it odd. It compounds with every fact added.`, "medium");
}

// Value order: things that could make the product better outrank things that
// would make the codebase tidier. Repeated areas are collapsed so one class of
// housekeeping cannot fill the page.
const PRIORITY = ["tool idea (hypothesis)", "retention", "likability", "unsurfaced data", "product", "sandbox rule", "unenforced law", "knowledge", "pipeline order", "unused output", "repetition", "pipeline size", "maintainability"];
const rank = (list) => {
  const seen = {};
  return [...list].sort((a, b) => {
    const ia = PRIORITY.indexOf(a.area), ib = PRIORITY.indexOf(b.area);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  }).filter(i => { seen[i.area] = (seen[i.area] || 0) + 1; return seen[i.area] <= 2; });
};

const VOICE = ["Nothing here is broken. This is the list of things that are merely fine.",
  "Went looking for what we could do better rather than what we got wrong.",
  "A short list of things that work and could work better."];
const report = { generatedAt: new Date().toISOString(),
  measure: "Our own doctrine, not generic best practice. Generic advice is free and worthless.",
  counts: { total: ideas.length }, ideas: rank(ideas).slice(0, 12) };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/improver-report.json"), JSON.stringify(report, null, 1));
const { rotate } = await import("./rotate.mjs");
console.log(`\n  ${rotate(VOICE)}\n`);
console.log(`✓ improver: ${ideas.length} idea(s)`);
for (const i of rank(ideas).slice(0, 10)) console.log(`  ${String(i.effort).padEnd(8)} ${String(i.area).padEnd(16)} ${i.observation}`);
