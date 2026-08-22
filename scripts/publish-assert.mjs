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

// STALE EDITION BREAKER: individual stale products get held by the gate.
// If the whole catalogue is stale, the fetch itself failed and the entire
// edition is an old market wearing today's date — worse than publishing
// nothing. Calibrated against the freshest row in the file rather than the
// calendar, so a run between daily fetches is not a false alarm: one full
// missed cycle (2+ days) blocks, a single day warns.
{
  const live = (sp.products || []).filter(p => p.dataStatus === "live" && p.priceMedian && p.lastSeen);
  if (live.length >= 20) {
    const stamps = live.map(p => String(p.lastSeen).slice(0, 10)).sort();
    const newest = stamps[stamps.length - 1];
    const ageDays = Math.round((Date.now() - Date.parse(newest)) / 86400000);
    const atNewest = stamps.filter(d => d === newest).length;
    const pct = Math.round(atNewest / live.length * 100);
    if (ageDays >= 2) {
      console.error(`\n✗ STALE EDITION — the freshest price in the catalogue is from ${newest}, ${ageDays} days ago.`);
      console.error("   At least one full fetch cycle was missed. This edition would wear");
      console.error("   today's date over an old market. Nothing ships. Re-run the fetch.\n");
      process.exit(1);
    }
    if (pct < 80) {
      console.error(`\n✗ PARTIAL FETCH — only ${pct}% of products carry the newest timestamp (${newest}).`);
      console.error("   A fetch ran but most products did not update. Nothing ships.\n");
      process.exit(1);
    }
    console.log(`  freshness: ${pct}% of ${live.length} products at ${newest}${ageDays >= 1 ? ` (${ageDays}d old — next run refreshes)` : " (today)"}`);
  }
}
// CONTENT SANITY: the fetch has a wipe guard, but a downstream compute
// step can also produce an empty-but-valid file — and an empty feed
// publishes as a blank edition with no error anywhere. A run that loses
// its content is a broken run, not a quiet market. (Class identified
// 2026-08-22 after a ReferenceError zeroed every SKU while exiting 0.)
{
  const feed = await J("research/pulse/pulse-feed.json");
  const der = await J("data/derived-insights.json");
  const liveCount = (sp.products || []).filter(p => p.dataStatus === "live" && p.priceMedian).length;
  const problems = [];
  if (!feed) problems.push("pulse-feed.json missing or unreadable");
  else {
    const fp = (feed.products || []).length;
    if (fp === 0) problems.push("feed carries zero products");
    else if (liveCount >= 20 && fp < liveCount * 0.5) problems.push(`feed has ${fp} products against ${liveCount} live prices — content loss`);
    for (const k of ["sealedIndex", "dailyThree", "disclosure"]) if (!feed[k]) problems.push(`feed missing required key: ${k}`);
  }
  if (!der) problems.push("derived-insights.json missing or unreadable");
  else {
    if (!der.sealedIndex?.level) problems.push("derived has no index level");
    if (!der.dailyThree?.sealed?.name) problems.push("derived has no sealed pick — the edition would have no headline");
  }
  if (problems.length) {
    console.error("\n✗ CONTENT SANITY FAILED — the edition is empty or incomplete:");
    for (const p of problems) console.error(`   ${p}`);
    console.error("   A run that loses its content is a broken run. Nothing ships.\n");
    process.exit(1);
  }
}
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
// EDITORIAL KEYS INSIDE THE FEED (2026-08-23). The feed was moved out of the
// strict surface list because its `products` array is the Board, where a held
// item may appear labelled. But the same file also carries dailyThree, movers
// and the other EDITORIAL blocks — and those must be as strict as any page.
// A negative test caught this: a quarantined product was forced into the
// headline, reached the feed, and publish-assert reported all clear.
{
  const feed = await J("research/pulse/pulse-feed.json");
  const EDITORIAL_KEYS = ["dailyThree", "supplyShifts", "eraIndexes", "ripOrHold", "watchOutcomes", "didYouKnow"];
  const editorialText = JSON.stringify(EDITORIAL_KEYS.reduce((o, k) => (feed?.[k] !== undefined && (o[k] = feed[k]), o), {}));
  for (const b of banned) {
    if (b.name && editorialText.includes(b.name)) violations.push({ surface: `pulse-feed.json → editorial block`, product: b.name, why: b.why });
    else if (editorialText.includes(`"${b.id}"`)) violations.push({ surface: `pulse-feed.json → editorial block`, product: b.id, why: b.why });
  }
}

// DATA surface check: blocked products may appear in the feed's Board
// array, but ONLY carrying their held label.
const feed = await J("research/pulse/pulse-feed.json");
for (const b of banned) {
  const row = (feed?.products || []).find(p => p.id === b.id);
  if (row && !row.held) { console.error(`✗ ${b.name} sits unlabeled in the Board feed`); process.exit(1); }
}
console.log(`✓ publication assert: ${banned.length} blocked product(s), none present in ${SURFACES.length} published surfaces`);
