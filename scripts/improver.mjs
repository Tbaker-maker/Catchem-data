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
const I = (area, observation, suggestion, effort) => ideas.push({ area, observation, suggestion, effort });

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

const VOICE = ["Nothing here is broken. This is the list of things that are merely fine.",
  "Went looking for what we could do better rather than what we got wrong.",
  "A short list of things that work and could work better."];
const report = { generatedAt: new Date().toISOString(),
  measure: "Our own doctrine, not generic best practice. Generic advice is free and worthless.",
  counts: { total: ideas.length }, ideas: ideas.slice(0, 12) };
await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/improver-report.json"), JSON.stringify(report, null, 1));
const { rotate } = await import("./rotate.mjs");
console.log(`\n  ${rotate(VOICE)}\n`);
console.log(`✓ improver: ${ideas.length} idea(s)`);
for (const i of ideas.slice(0, 10)) console.log(`  ${String(i.effort).padEnd(8)} ${String(i.area).padEnd(16)} ${i.observation}`);
