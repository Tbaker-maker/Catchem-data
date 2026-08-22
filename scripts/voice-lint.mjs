// voice-lint.mjs — speculation must SOUND like speculation.
// Chips get cropped out of screenshots; the sentence has to carry its own
// epistemic status. This scans everything about to be published and flags
// READ-chipped content written in VERIFIED language (or worse, in
// prediction language). Runs before publishing, like qa-gate.
//
// LAW (Tyler, Aug 21): "when we speculate it's important to express that
// it is as is." Not via trailing disclaimers (voice v4 forbids those) —
// via verbs. "reads as" not "is". "usually precedes" not "will cause".
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

// Certainty words that must never appear in a READ-chipped statement.
const CERTAINTY = [
  /\bwill\s+(rise|fall|drop|climb|spike|crash|increase|decrease|double|moon)\b/i,
  /\bis\s+going\s+to\b/i, /\bguarantee(d|s)?\b/i, /\bdefinitely\b/i,
  /\bcertain(ly)?\s+to\b/i, /\bmust\s+(rise|fall|go)\b/i, /\bno\s+doubt\b/i,
  /\bcan'?t\s+lose\b/i, /\bsure\s+thing\b/i, /\bwill\s+be\s+worth\b/i,
];
// Hedge markers that make a READ self-evidently a READ.
const HEDGES = [
  /\breads?\s+as\b/i, /\busually\b/i, /\bhistorically\b/i, /\btypically\b/i,
  /\bsuggests?\b/i, /\bconsistent\s+with\b/i, /\bestimat(e|ed|ion)\b/i,
  /\bour\s+(read|take|view)\b/i, /\bappears?\b/i, /\blikely\b/i,
  /\bmay\b/i, /\bcould\b/i, /\bpattern\b/i, /\bcandidate/i, /\bwe\s+think\b/i,
  /\btypical\b/i, /\busual(ly)?\b/i, /\btends?\s+to\b/i, /\bgenerally\b/i,
  /\boften\b/i, /\bwidely\b/i, /\bpoints?\s+to\b/i, /\bworth\s+watching\b/i,
  /\bhistorical(ly)?\b/i, /\bso\s+far\b/i, /\bmodel\b/i, /\bsuspected\b/i,
  /\(est\.?\)/i, /\bnot\s+a\s+call\b/i,
];

// Unsourced NORM claims — asserting how the community/market "usually"
// behaves is a factual claim, not a hedge. It needs evidence or it is
// narrative invention. (Error #14: calling a rotation "quiet" implied a
// norm of loudness that does not exist — rotation is quiet every year.)
const NORM_CLAIM = [
  /\bunusually\s+(quiet|loud|slow|fast|strong|weak)\b/i,
  /\brarely\s+(discussed|noticed|talked)\b/i,
  /\bnobody\s+(talks|noticed|mentions)\b/i,
  /\bwent\s+(largely\s+)?unnoticed\b/i,
  /\bmore\s+than\s+usual\b/i, /\bless\s+than\s+usual\b/i,
  /\bwithout\s+(the\s+)?(usual\s+)?fanfare\b/i,
];

// ADVERSARIAL FRAMING (Referee Doctrine, 2026-08-22): we serve buyers and
// vendors with the same numbers and never frame either as the other's mark.
// Punchy copy drifts here first, so the linter holds the line.
const ADVERSARIAL = [
  /\bout ?smart(ing|ed)?\b/i, /\bbeat the (dealer|vendor|seller|shop)/i,
  /\bdon'?t get (ripped|played|fooled|scammed)/i, /\brip[- ]off\b/i,
  /\bdealer tricks?\b/i, /\bvendor tricks?\b/i, /\bwhat they don'?t want you to know\b/i,
  /\bhow to win against\b/i, /\bstop overpaying\b/i, /\bthey'?re counting on you\b/i,
];
const der = await J("data/derived-insights.json") ?? {};
const findings = [];
const check = (label, text, chip) => {
  if (!text) return;
  const t = String(text);
  const hard = CERTAINTY.filter(rx => rx.test(t)).map(rx => rx.source.slice(0, 24));
  const adv = ADVERSARIAL.filter(rx => rx.test(t)).map(rx => rx.source.slice(0, 26));
  if (adv.length) findings.push({ severity: "BLOCK", label, chip, issue: `adversarial framing — the Referee Doctrine forbids casting either side of a trade as the other's opponent: ${adv.join(", ")}`, text: t.slice(0, 120) });
  if (hard.length) findings.push({ severity: "BLOCK", label, chip, issue: `prediction language in a published statement: ${hard.join(", ")}`, text: t.slice(0, 120) });
  const norms = NORM_CLAIM.filter(rx => rx.test(t)).map(rx => rx.source.slice(0, 22));
  if (norms.length) findings.push({ severity: "WARN", label, chip, issue: `norm claim about community/market behavior — needs evidence or drop the comparison (${norms.join(", ")})`, text: t.slice(0, 120) });
  if (chip === "READ" && !HEDGES.some(rx => rx.test(t)))
    findings.push({ severity: "WARN", label, chip, issue: "READ-chipped but written in flat/declarative voice — add a hedging verb so the speculation is self-evident without the chip", text: t.slice(0, 120) });
};

// Every public-facing interpretive surface
for (const [k, v] of Object.entries(der.dailyThree ?? {})) check(`dailyThree.${k}`, v?.explain || v?.reason, v?.chip);
for (const s of der.supplyShifts ?? []) check(`supplyShift.${s.id}`, s.read, s.chip ?? "READ");
for (const e of der.eraIndexes ?? []) check(`eraIndex.${e.era}`, e.read, e.chip ?? "READ");
for (const p of der.printWatch ?? []) check(`printWatch.${p.setId}`, p.phase, p.chip ?? "READ");
for (const d of der.depthReads ?? []) check(`depth.${d.id}`, d.read ?? d.explain, d.chip ?? "READ");
const bank = await J("research/pulse/post-bank.json");
for (const i of bank?.ideas ?? []) for (const [pf, txt] of Object.entries(i.platforms ?? {})) check(`postBank.${i.id}.${pf}`, txt, i.chip);
const queue = await J("research/pulse/social-queue.json");
for (const p of queue?.posts ?? []) check(`socialQueue.${p.slot}`, p.text, "READ");

const blocks = findings.filter(f => f.severity === "BLOCK");
await writeFile(join(ROOT, "research/pulse/voice-lint.json"), JSON.stringify({
  generatedAt: new Date().toISOString(), checked: "dailyThree, supplyShifts, eraIndexes, printWatch, depth, postBank, socialQueue",
  blocks: blocks.length, warns: findings.length - blocks.length, findings }, null, 1));
console.log(`✓ voice lint: ${blocks.length} blocking, ${findings.length - blocks.length} warnings`);
for (const f of findings.slice(0, 6)) console.log(`  ${f.severity === "BLOCK" ? "✗" : "⚠"} ${f.label}: ${f.issue}`);
if (blocks.length) { console.error("✗ VOICE LINT FAILED — prediction language cannot ship."); process.exitCode = 1; }
