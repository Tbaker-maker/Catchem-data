// jargon-lint.mjs — THE CONFUSION GUARD.
//
// Tyler, 2026-08-21: "It's ok when it keeps you on the edge. That one left
// me falling off the cliff in confusion. If I was a user I'd probably skip
// past it or close the app."
//
// A number that is wrong loses trust. A sentence that is confusing loses
// the reader entirely, and they don't come back to tell you why. This
// scans published copy for two failure modes:
//
//   1. HOBBY/FINANCE TERMS used without a plain-words gloss nearby.
//   2. NAMED CONSTRUCTS — "the drop-shadow test", "the seasoning rule" —
//      phrases shaped like a defined term the piece never defined. This is
//      the exact shape that lost Tyler on 2026-08-21.
//
// A term is CLEARED when, within the same artifact, it is followed by a
// plain explanation, or the artifact links the methodology anchor for it.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

// hard: a newcomer cannot infer it — must be glossed or linked, or it blocks.
// soft: context usually carries it — warns only.
const TERMS = [
  { t: "shadowless", hard: true, gloss: "printed before the shadow was added to the artwork window" },
  { t: "EOL", hard: true, gloss: "end of life — no longer being printed" },
  { t: "rotation", hard: true, gloss: "when older sets stop being legal in tournament play" },
  { t: "standard legal", hard: true, gloss: "still allowed in current tournament play" },
  { t: "pull rate", hard: true, gloss: "how often a card appears per pack" },
  { t: "gem rate", hard: true, gloss: "share of graded copies that come back a perfect 10" },
  { t: "pop report", hard: true, gloss: "how many copies a grader has graded at each grade" },
  { t: "slab", hard: true, gloss: "a card sealed in a graded case" },
  { t: "the spread", hard: true, gloss: "the gap between what the two marketplaces are asking" },
  { t: "clean floor", hard: true, gloss: "the cheapest believable listing, outliers ignored" },
  { t: "breadth", hard: true, gloss: "how many products rose versus fell" },
  { t: "basis", hard: true, gloss: "the price we measure against" },
  { t: "absorption", hard: true, gloss: "listings being bought up faster than they are added" },
  { t: "sealed premium", hard: true, gloss: "how much more a sealed box costs per pack than buying packs loose" },
  { t: "per-pack", hard: false, gloss: "the box price divided by how many packs are inside" },
  { t: "raw", hard: false, gloss: "ungraded — no case, no grade" },
  { t: "chase", hard: false, gloss: "the card collectors most want from a set" },
  { t: "seasoning", hard: false, gloss: "new sets waiting before they count in the index" },
  { t: "net proceeds", hard: false, gloss: "what actually lands in your pocket after fees" },
];

// Phrases shaped like a defined term. If the piece never defines it, the
// reader is told a rule exists and not what it is — the cliff.
const NAMED_CONSTRUCT = /\bthe\s+([a-z][a-z-]{2,}(?:\s+[a-z][a-z-]{2,})?)\s+(test|rule|law|effect|model|gate|tax|premium|boundary|doctrine)\b/gi;

// Signals that an explanation is present near the term.
const nearGloss = (text, idx, window = 320) => {
  const seg = text.slice(Math.max(0, idx - 60), idx + window).toLowerCase();
  return /—[^—]{10,}|\bthat is\b|\bmeaning\b|\bwhich means\b|\bin other words\b|\bi\.e\.\b|\bwhen [a-z]/.test(seg)
    || /methodology|what this means|here'?s how|\(est\.?\)/.test(seg);
};

const SURFACES = [
  "research/pulse/pulse-feed.json",
  "research/pulse/social-queue.json",
  "research/pulse/post-bank.json",
  "data/did-you-know.json",
];
const today = new Date().toISOString().slice(0, 10);
SURFACES.push(`research/pulse/${today}.md`);

const findings = [];
for (const f of SURFACES) {
  const raw = await read(f);
  if (!raw) continue;
  // strip markup/keys so we lint prose, not field names
  const text = raw.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/"[a-zA-Z_]+":/g, " ");
  const linked = /methodology/.test(raw);

  for (const term of TERMS) {
    const rx = new RegExp(`\\b${term.t.replace(/[-\s]/g, "[-\\s]")}\\b`, "gi");
    let m, cleared = false, first = null;
    while ((m = rx.exec(text))) {
      if (first === null) first = m.index;
      if (nearGloss(text, m.index)) { cleared = true; break; }
    }
    if (first !== null && !cleared && !(term.hard === false && linked))
      findings.push({ surface: f, term: term.t, severity: term.hard ? "BLOCK" : "WARN",
        issue: `used without a plain-words explanation nearby`, suggestedGloss: term.gloss });
  }

  let c;
  while ((c = NAMED_CONSTRUCT.exec(text))) {
    const phrase = c[0];
    if (!nearGloss(text, c.index)) findings.push({ surface: f, term: phrase.trim(), severity: "BLOCK",
      issue: "reads like a defined term the piece never defines — the reader is told a rule exists but not what it is",
      suggestedGloss: "say what the reader would DO or SEE, in plain words, in the same sentence" });
  }
}

const blocks = findings.filter(f => f.severity === "BLOCK");
await writeFile(join(ROOT, "research/pulse/jargon-lint.json"), JSON.stringify({
  generatedAt: new Date().toISOString(), surfaces: SURFACES.length,
  blocks: blocks.length, warns: findings.length - blocks.length, findings }, null, 1));
console.log(`✓ jargon lint: ${blocks.length} blocking, ${findings.length - blocks.length} warnings`);
for (const f of findings.slice(0, 8)) console.log(`  ${f.severity === "BLOCK" ? "✗" : "⚠"} "${f.term}" in ${f.surface.split("/").pop()} — ${f.issue}`);
if (blocks.length && process.env.JARGON_STRICT === "1") { console.error("✗ JARGON LINT FAILED — unexplained terms cannot ship."); process.exitCode = 1; }
