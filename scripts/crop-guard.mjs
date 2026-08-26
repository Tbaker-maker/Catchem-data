// crop-guard.mjs — nothing may sit on the crop line.
//
// Tyler, 2026-08-24: "the top is slightly out of the post. All of our users are
// X based atm."
//
// I had targeted EXACTLY 1.25, which is where X crops. **Designing to a limit
// means failing at the limit** — any rounding, any device pixel ratio, any
// difference in where X actually cuts, and the top clips.
//
// This fails the build if any layout comes within 5% of the crop line, so the
// mistake cannot be made again by someone tuning a frame for a bigger card.
import { LAYOUTS, SAFE_RATIO } from "./layouts.mjs";

const X_CROPS_AT = 1.25;
const MARGIN = 0.05;
const problems = [];

if (SAFE_RATIO > X_CROPS_AT - MARGIN)
  problems.push(`SAFE_RATIO is ${SAFE_RATIO}, within ${MARGIN} of the ${X_CROPS_AT} crop line — that is designing to the limit`);

for (const [n, l] of Object.entries(LAYOUTS)) {
  const r = l.H / l.W;
  if (l.cropExempt) {
    if (Math.abs(r - l.ratio) > 0.02) problems.push(`${n} cards: table says ratio ${l.ratio} but W and H give ${r.toFixed(2)}`);
    continue;
  }
  if (r > X_CROPS_AT) problems.push(`${n} cards: ratio ${r.toFixed(2)} EXCEEDS the crop line — the top will be cut off`);
  else if (r > X_CROPS_AT - MARGIN) problems.push(`${n} cards: ratio ${r.toFixed(2)} sits within ${MARGIN} of the crop line — no tolerance for rounding`);
  // The stated ratio must match the actual one, or the table is lying about
  // itself and every downstream reader inherits the lie.
  if (Math.abs(r - l.ratio) > 0.02) problems.push(`${n} cards: table says ratio ${l.ratio} but W and H give ${r.toFixed(2)}`);
}

if (problems.length) {
  console.error(`\n✗ CROP — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("   " + p);
  console.error(`\n   Every user is on X. A clipped top is not an edge case, it is the only case.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ crop: ${Object.keys(LAYOUTS).length} layouts, none within ${MARGIN} of X's ${X_CROPS_AT} crop line · safe ratio ${SAFE_RATIO}`);
}
