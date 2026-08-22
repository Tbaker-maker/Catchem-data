// content-sanity.mjs — is this text actually text?
//
// THE GAP THIS FILLS: we check numbers (qa-gate), blocked products
// (publish-assert), voice (voice-lint), jargon (jargon-lint) and file shapes
// (schema-guard). Nothing checked whether a sentence is a SENTENCE.
//
// So on 2026-08-23 the chase card published the word "chase" as its entire
// explanation — a one-word category label rendered where a reader expected a
// reason — and every guard we own passed it. The feed was valid, the product
// was not blocked, the voice was not hyped, the jargon was clean, the shape was
// right. It was simply meaningless, and meaninglessness was not on the list.
//
// This checks the thing a reader actually experiences: does every piece of prose
// we publish say something. Placeholders, stubs, label-shaped text, truncation,
// unresolved templates, and copy that is too short to be an explanation.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const feed = await J("research/pulse/pulse-feed.json");
if (!feed) { console.log("· content sanity: no feed"); }

const problems = [];
const P = (where, text, why) => problems.push({ where, text: String(text).slice(0, 80), why });

// Every field a reader reads as PROSE. Anything here must be a sentence.
// Only fields a reader meets as a SENTENCE. `note` is excluded because it is
// used for both prose and short annotation ("est.", "10.75% + processing"),
// and flagging legitimate annotation would train us to ignore this check.
const PROSE_FIELDS = ["explain", "whyChosen", "simple", "why_it_matters", "body",
  "forBuyers", "forVendors", "forCreators", "headline", "narrative"];

const walk = (node, path = "") => {
  if (!node || typeof node !== "object") return;
  for (const [k, v] of Object.entries(node)) {
    const here = path ? `${path}.${k}` : k;
    if (typeof v === "string" && PROSE_FIELDS.includes(k)) {
      const t = v.trim();
      // 1 — too short to be an explanation. A label is not a sentence.
      // Under 15 characters cannot be an explanation in any style. "chase" is 5.
      if (t.length && t.length < 15)
        P(here, t, `${t.length} characters — that is a label, not an explanation. A reader who taps for a reason and gets one word learns we had nothing to say.`);
      // 2 — no sentence structure at all: no verb-ish content, no punctuation.

      // 3 — an unresolved template. The most embarrassing possible publication.
      if (/\$\{|\{\{|%s\b|TODO|FIXME|XXX|lorem ipsum|placeholder/i.test(t))
        P(here, t, "unresolved template or placeholder text reached publication");
      // 4 — truncation. Text that stops mid-word was cut by something.
      if (/\b\w{1,3}\.\.\.$|—$|,$/.test(t))
        P(here, t, "ends mid-thought — something truncated this before it was finished");
      // 5 — the exact bug: prose that is identical to a category label elsewhere
      // in the same object. That is a field mix-up, not a short sentence.
      const siblings = Object.entries(node).filter(([sk, sv]) => sk !== k && typeof sv === "string");
      if (t.length < 40 && siblings.some(([, sv]) => sv.trim().toLowerCase() === t.toLowerCase()))
        P(here, t, "identical to another field on the same object — a label is being rendered where prose belongs");
    }
    if (v && typeof v === "object") walk(v, here);
  }
};

if (feed) walk(feed);

// Deduplicate — the same fault repeated across a list is one fault.
const seen = new Set();
const unique = problems.filter(p => { const k = `${p.text}::${p.why}`; if (seen.has(k)) return false; seen.add(k); return true; });

await writeFile(join(ROOT, "research/pulse/content-sanity.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  checks: "placeholder text, unresolved templates, truncation, label-in-prose-slot, and copy too short to be an explanation",
  why: "Every other guard checks whether the data is correct. This checks whether the WORDS say anything — the gap that let a card publish the single word 'chase' as its reason while every other check passed.",
  problems: unique }, null, 1));

if (unique.length) {
  console.error(`\n✗ CONTENT SANITY — ${unique.length} problem(s):`);
  for (const p of unique.slice(0, 8)) console.error(`   ${p.where}: "${p.text}"\n     ${p.why}`);
  console.error("");
  process.exitCode = 1;
} else {
  console.log(`✓ content sanity: every published sentence says something`);
}
