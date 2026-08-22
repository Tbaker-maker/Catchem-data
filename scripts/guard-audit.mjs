// guard-audit.mjs — THE GUARD THAT WATCHES THE GUARDS.
//
// On 2026-08-21 a quarantine flag was set correctly, written correctly,
// and read by nothing. The pick code never referenced it. Every existing
// check passed, because every existing check verified DATA — none of them
// verified WIRING. A guard that isn't connected is worse than no guard:
// it produces confidence without protection.
//
// This audit declares, explicitly, which guards must be referenced in
// which files, and fails the run when a wire is missing. It also verifies
// every guard script is actually imported by the pipeline. Add a guard →
// add its manifest entry, or the audit will not know to protect it.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async p => { try { return await readFile(join(ROOT, p), "utf-8"); } catch { return null; } };

// ── THE MANIFEST ────────────────────────────────────────────────────────
// guard: what it protects against
// definedIn: where it lives
// mustBeReferencedIn: [{ file, pattern, min }] — the CONSUMING code paths.
//   A guard defined but not consumed is the exact 2026-08-21 failure.
const MANIFEST = [
  { guard: "Publication block (QA gate + manual quarantine)",
    definedIn: "scripts/qa-gate.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-derived.mjs", pattern: /blockedIds/g, min: 2,
        note: "must be COMPUTED and then USED in every editorial pick pool" },
      { file: "scripts/compute-derived.mjs", pattern: /const eligible\s*=\s*\(div\.rows\|\|\[\]\)\.filter\(r\s*=>\s*r\.signal\s*&&\s*!blockedIds\.has\(r\.id\)\)/g, min: 1,
        note: "THE WIRE that was missing on 2026-08-21: the headline pool must filter blocked ids inline. Re-pointed 2026-08-22 when the freshness rotation renamed the pool to `eligible` — the audit caught the rename, which is the point." },
      { file: "scripts/compute-derived.mjs", pattern: /notBlocked\(yRow\.sealed\)/g, min: 1,
        note: "watch outcomes must skip blocked products" },
      { file: "scripts/compute-divergence.mjs", pattern: /publishBlock/g, min: 1,
        note: "blocked products must not qualify as Spread signals" },
    ] },
  { guard: "Multi-item listing filter (lots/cases/x2)",
    definedIn: "scripts/fetch-sealed-prices.mjs",
    mustBeReferencedIn: [
      { file: "scripts/fetch-sealed-prices.mjs", pattern: /const isMultiItem\s*=/g, min: 1,
        note: "guard must be defined" },
      { file: "scripts/fetch-sealed-prices.mjs", pattern: /if \(isMultiItem\(/g, min: 1,
        note: "guard must be CALLED inside the keep filter — definition alone is not protection" },
    ] },
  { guard: "Venue boundary (RT-4a — vintage never cross-venue signals)",
    definedIn: "scripts/compute-divergence.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-divergence.mjs", pattern: /OFF_TCG\(/g, min: 2 },
    ] },
  { guard: "Seasoning rule (new sets sit out 90 days)",
    definedIn: "scripts/compute-derived.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-derived.mjs", pattern: /seasoned\(p\)/g, min: 2,
        note: "must gate BOTH the sealed composite and the subtype composites" },
    ] },
  { guard: "Image override safety (chat cannot pick between unseen images)",
    definedIn: "scripts/image-override-guard.mjs",
    mustBeReferencedIn: [
      { file: "scripts/image-override-guard.mjs", pattern: /humanVerified/g, min: 2 },
      { file: "scripts/generate-pulse.mjs", pattern: /image-override-guard\.mjs/g, min: 1,
        note: "must run in the pipeline, not just exist" },
      { file: "scripts/generate-pulse.mjs", pattern: /image-source\.mjs/g, min: 1,
        note: "overrides must actually FEED the imagery — for a day the guard validated a file nothing consumed (caught by the 2026-08-22 eye audit)" },
    ] },
  { guard: "Referee Doctrine (no adversarial framing)",
    definedIn: "scripts/voice-lint.mjs",
    mustBeReferencedIn: [
      { file: "scripts/voice-lint.mjs", pattern: /const ADVERSARIAL\s*=/g, min: 1 },
      { file: "scripts/voice-lint.mjs", pattern: /ADVERSARIAL\.filter\(/g, min: 1,
        note: "defined AND applied — a pattern list nothing checks is decoration" },
    ] },
  { guard: "Daily Three freshness rotation",
    definedIn: "scripts/compute-derived.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-derived.mjs", pattern: /FRESHNESS ROTATION/g, min: 1 },
      { file: "scripts/compute-derived.mjs", pattern: /isRepeat\(/g, min: 3,
        note: "cooldown must gate BOTH the sealed pool and the raw pool" },
      { file: "scripts/compute-derived.mjs", pattern: /noveltyScore/g, min: 2,
        note: "deep-cut preference must actually rank the pool" },
    ] },
  { guard: "Content sanity / silent-empty-run breaker",
    definedIn: "scripts/publish-assert.mjs",
    mustBeReferencedIn: [
      { file: "scripts/publish-assert.mjs", pattern: /CONTENT SANITY/g, min: 1,
        note: "an empty-but-valid file must never publish as a blank edition" },
      { file: "scripts/fetch-sealed-prices.mjs", pattern: /WIPE GUARD/g, min: 1,
        note: "fetch-level: a run that loses nearly every live price must refuse to overwrite" },
    ] },
  { guard: "Staleness / stale-edition breaker",
    definedIn: "scripts/publish-assert.mjs",
    mustBeReferencedIn: [
      { file: "scripts/qa-gate.mjs", pattern: /STALENESS/g, min: 1,
        note: "per-product: a price older than 2 days must not headline" },
      { file: "scripts/publish-assert.mjs", pattern: /STALE EDITION/g, min: 1,
        note: "whole-edition: a failed fetch must block publication entirely" },
      { file: "scripts/publish-assert.mjs", pattern: /PARTIAL FETCH/g, min: 1,
        note: "partial fetch must also block" },
    ] },
  { guard: "Currency guard (USD-native law)",
    definedIn: "scripts/fetch-sealed-prices.mjs",
    mustBeReferencedIn: [
      { file: "scripts/fetch-sealed-prices.mjs", pattern: /currency\s*!==\s*"USD"/g, min: 1 },
    ] },
  { guard: "Thin-sample premium gate",
    definedIn: "scripts/compute-derived.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-derived.mjs", pattern: /premiumThin/g, min: 2 },
    ] },
  { guard: "Deal Zone model contract (§19 — Show Mode recomputes zones ONLY from the feed's numeric fields)",
    definedIn: "scripts/compute-derived.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-derived.mjs", pattern: /feeTiers:\s*\[/g, min: 1,
        note: "numeric fee tiers must ship in dealZone.model — the app's settings sheet renders from them and hardcodes NO rate; losing the field silently reverts every custom zone and empties the sheet" },
      { file: "scripts/compute-derived.mjs", pattern: /taxPctDefault:/g, min: 1,
        note: "the default tax rate is a model field, not an app constant" },
    ] },
  { guard: "Mode Honesty Law (§20 — modes reorder and tint, NEVER hide or change a number)",
    definedIn: "scripts/mode-diff-test.mjs",
    mustBeReferencedIn: [
      { file: "scripts/mode-diff-test.mjs", pattern: /MODE HONESTY VIOLATED/g, min: 1,
        note: "the rendered figure-multiset comparison must fail loudly — an echo-chamber mode is worse than no modes" },
      { file: ".github/workflows/update-sealed-prices.yml", pattern: /mode-diff-test\.mjs/g, min: 1,
        note: "must run in CI against the live app — a diff test nobody runs is decoration" },
    ] },
  { guard: "Deploy smoke test (blank-page class — rendered DOM is proof, status codes are not)",
    definedIn: "scripts/smoke-test.mjs",
    mustBeReferencedIn: [
      { file: "scripts/smoke-test.mjs", pattern: /pageerror/g, min: 1,
        note: "a page error in the mounted app must fail the test — the 2026-08-22 blank app raised exactly one and shipped anyway" },
      { file: "scripts/smoke-test.mjs", pattern: /SMOKE TEST FAILED/g, min: 1 },
      { file: ".github/workflows/update-sealed-prices.yml", pattern: /smoke-test\.mjs/g, min: 1,
        note: "must actually run in CI — a smoke test nobody runs is decoration" },
    ] },
  { guard: "Durable quarantine at compute time (fetch rebuilds wipe publishBlock; qa-gate runs later)",
    definedIn: "scripts/lib/publish-guard.mjs",
    mustBeReferencedIn: [
      { file: "scripts/compute-divergence.mjs", pattern: /publish-guard/g, min: 1,
        note: "signal gate must read the durable quarantine — flags are empty at its runtime (2026-08-22 PGO leak)" },
      { file: "scripts/compute-derived.mjs", pattern: /publish-guard/g, min: 1,
        note: "blockedIds must union the durable file, not just publishBlock flags" },
      { file: "scripts/generate-pulse.mjs", pattern: /publish-guard/g, min: 1,
        note: "editorial pools (spread signals, deepest markets, story kits) must filter blocked ids" },
      { file: "scripts/post-bank.mjs", pattern: /publish-guard/g, min: 1,
        note: "assembled ideas must drop blocked-product mentions before writing post-bank.json" },
      { file: "scripts/social-posts.mjs", pattern: /publish-guard/g, min: 1,
        note: "queue slots must drop blocked-product mentions" },
      { file: "scripts/mint-social-card.mjs", pattern: /publish-guard/g, min: 1,
        note: "a blocked subject mints no card" },
    ] },
];

// Guard SCRIPTS that must run inside the daily pipeline, in order.
const PIPELINE_FILE = "scripts/generate-pulse.mjs";
const MUST_RUN = [
  { script: "flag-guard.mjs", why: "one condition, one gate — stops two authors stacking gates invisibly" },
  { script: "qa-gate.mjs", why: "blocks corrupted numbers before anything publishes" },
  { script: "build-corrections.mjs", why: "keeps the public corrections page current" },
  { script: "voice-lint.mjs", why: "blocks prediction language" },
  { script: "rasterize-cards.mjs", why: "PNG-only law" },
  { script: "jargon-lint.mjs", why: "blocks unexplained jargon and undefined named constructs" },
  { script: "publish-assert.mjs", why: "final artifact proof — must be LAST" },
];

const failures = [], notes = [];
// ── DUPLICATE GATE CHECK (2026-08-23) ──────────────────────────────────
// Chat and CC each added a PPT licensing gate to the same function; the
// second silently overrode the first. Gates are now DECLARED in flags.mjs
// and read through it, so a duplicate would require two declarations in one
// file — visible the moment anyone opens it. This enforces the rule.
{
  const { readdir } = await import("node:fs/promises");
  const files = (await readdir(join(ROOT, "scripts"))).filter(f => f.endsWith(".mjs") && f !== "flags.mjs");
  for (const f of files) {
    const src = await read(`scripts/${f}`);
    if (!src) continue;
    const strays = [...src.matchAll(/process\.env\.(CATCHEM_[A-Z_]+)/g)].map(m => m[1]);
    for (const s of new Set(strays))
      failures.push(`DUPLICATE-GATE RISK — scripts/${f} reads ${s} directly. Behaviour gates are declared in scripts/flags.mjs and read via flag(); reading the environment here is how two gates for one decision get created without either author knowing.`);
  }
}

for (const g of MANIFEST) {
  const def = await read(g.definedIn);
  if (!def) { failures.push(`${g.guard}: defining file missing (${g.definedIn})`); continue; }
  for (const req of g.mustBeReferencedIn) {
    const src = await read(req.file);
    if (!src) { failures.push(`${g.guard}: consumer file missing (${req.file})`); continue; }
    const hits = (src.match(req.pattern) || []).length;
    if (hits < req.min) failures.push(`${g.guard}: NOT WIRED — ${req.file} references ${req.pattern.source} ${hits}× (need ${req.min})${req.note ? ` — ${req.note}` : ""}`);
    else notes.push(`  ✓ ${g.guard} → ${req.file} (${hits}×)`);
  }
}
const pipe = await read(PIPELINE_FILE);
if (!pipe) failures.push(`pipeline file missing (${PIPELINE_FILE})`);
else {
  for (const m of MUST_RUN) {
    if (!pipe.includes(m.script)) failures.push(`PIPELINE GAP — ${m.script} is never imported by ${PIPELINE_FILE} (${m.why})`);
    else notes.push(`  ✓ pipeline runs ${m.script}`);
  }
  const assertIdx = pipe.lastIndexOf("publish-assert.mjs");
  const lastOther = Math.max(...MUST_RUN.filter(m => m.script !== "publish-assert.mjs").map(m => pipe.lastIndexOf(m.script)));
  if (assertIdx !== -1 && assertIdx < lastOther) failures.push("ORDER — publish-assert.mjs must run LAST; another guard is imported after it");
}

if (failures.length) {
  console.error(`\n✗ GUARD AUDIT FAILED — ${failures.length} guard(s) exist but are not connected:\n`);
  for (const f of failures) console.error(`   ${f}`);
  console.error("\n   A guard that isn't wired produces confidence without protection. Fix before running.\n");
  process.exit(1);
}
console.log(`✓ guard audit: ${MANIFEST.length} guards wired, ${MUST_RUN.length} pipeline steps present, publish-assert last`);
if (process.env.VERBOSE) notes.forEach(n => console.log(n));
