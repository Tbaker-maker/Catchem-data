// publish-assert.mjs — THE LAST LINE.
// Every other guard sets a flag and trusts the next step to honour it.
// On 2026-08-21 one of those flags was set correctly and simply never
// read by the code that picked the headline — a quarantined product
// reached a published newsletter draft twice. Flags are not proof.
//
// This script proves. It runs LAST, after every artifact is written, and
// greps the actual published output for anything quarantined or blocked.
// If it finds one, the run FAILS and the artifacts are not shipped.
// Verify the artifact, never the intention.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const sp = await J("data/sealed-prices.json") ?? { products: [] };
const mq = await J("data/quarantine.json") ?? { entries: [] };

// Everything that must never appear in published output, by NAME (the form
// a reader would actually see) and by id.
const banned = [];
for (const e of mq.entries || []) {
  const p = (sp.products || []).find(x => x.id === e.id);
  banned.push({ id: e.id, name: p?.name ?? null, why: `manually quarantined ${e.since}` });
}
for (const p of sp.products || []) {
  if (p.publishBlock && !banned.some(b => b.id === p.id)) banned.push({ id: p.id, name: p.name, why: (p.qaReasons || [])[0] || "blocked by QA gate" });
}

// The published surfaces — what a human or platform actually receives.
// EDITORIAL surfaces: a blocked product must never be FEATURED here.
// The feed's products array is the Board — policy keeps blocked items
// visible there, labeled `held`, so it is checked separately below.
const SURFACES = [
  "research/assets/the-pulse.html",
  "research/pulse/social-queue.json",
  "research/pulse/post-bank.json",
  "research/pulse/discord-embed-preview.json",
];
const today = new Date().toISOString().slice(0, 10);
SURFACES.push(`research/pulse/${today}.md`, `research/pulse/${today}.html`);

const violations = [];
for (const f of SURFACES) {
  let txt;
  try { txt = await readFile(join(ROOT, f), "utf-8"); } catch { continue; }
  for (const b of banned) {
    if (b.name && txt.includes(b.name)) violations.push({ surface: f, product: b.name, why: b.why });
    else if (txt.includes(`"${b.id}"`)) violations.push({ surface: f, product: b.id, why: b.why });
  }
}

if (violations.length) {
  console.error(`\n✗ PUBLICATION BLOCKED — ${violations.length} quarantined/blocked product(s) found in published output:`);
  for (const v of violations) console.error(`   ${v.product} → ${v.surface}\n     (${v.why})`);
  console.error("\n   Artifacts were written but must NOT be shipped. Fix the leak, re-run.\n");
  process.exit(1);
}
// DATA surface check: blocked products may appear in the feed's Board
// array, but ONLY carrying their held label.
const feed = await J("research/pulse/pulse-feed.json");
for (const b of banned) {
  const row = (feed?.products || []).find(p => p.id === b.id);
  if (row && !row.held) { console.error(`✗ ${b.name} sits unlabeled in the Board feed`); process.exit(1); }
}
console.log(`✓ publication assert: ${banned.length} blocked product(s), none present in ${SURFACES.length} published surfaces`);
