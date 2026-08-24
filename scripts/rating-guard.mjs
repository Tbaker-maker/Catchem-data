// rating-guard.mjs — a rating without a derivation is an opinion with a number on it.
//
// Tyler asked for cuteness, comedy and seriousness ratings. The honest version
// derives each from a PRINTED field, and the dishonest version is me assigning
// scores that feel right — which our own slop law calls out on the first card.
//
// This fails the build if any rating in card-bios.json lacks a `why`, if the
// derivations block does not document every rating in use, or if a refused
// rating quietly reappears.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const f = JSON.parse(await readFile(join(ROOT, "data/card-bios.json"), "utf-8"));
const problems = [];

// 1 · Every rating on every card must carry its reason.
let checked = 0, missing = 0;
for (const [id, b] of Object.entries(f.bios)) {
  for (const k of Object.keys(b.ratings ?? {})) {
    checked++;
    if (!b.why?.[k]) { missing++; if (missing <= 3) problems.push(`${id}: rating "${k}" has no stated derivation`); }
  }
}
if (missing > 3) problems.push(`…and ${missing - 3} more ratings with no derivation`);

// 2 · Every rating in use must be documented at the top of the file, so a
// reader can see the rule without reading every card.
const used = new Set();
for (const b of Object.values(f.bios)) for (const k of Object.keys(b.ratings ?? {})) used.add(k);
for (const k of used) if (!f.derivations?.[k]) problems.push(`rating "${k}" is in use but not documented in the derivations block`);

// 3 · The refused ratings must stay refused. Popularity and likeness have no
// signal behind them, and a number invented for either would be indistinguishable
// from the derived ones once it is on screen.
for (const banned of ["popularity", "likeness", "beauty", "coolness"])
  if (used.has(banned)) problems.push(`"${banned}" has reappeared — it was refused for having no real signal, and an invented number is indistinguishable from a derived one once it is on screen`);

if (problems.length) {
  console.error(`\n✗ RATINGS — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("   " + p);
  console.error(`\n   A rating that cannot name its field is taste wearing a number.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ ratings: ${checked.toLocaleString()} rating(s) across ${Object.keys(f.bios).length.toLocaleString()} cards, every one names the printed field it derives from · ${used.size} kinds documented`);
}
