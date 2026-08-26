// ── VISUAL CLAIM GUARD — BLOCKING ──────────────────────────────────────────
// I looked at a screenshot of nine leaked Eeveelution cards, saw a small
// Pikachu on each one, and proposed a caption about "a Pikachu hidden in every
// card". It is the 30th anniversary stamp. It is on the entire promo run. It
// was not an artistic choice and it was not about the Eeveelutions at all.
//
// CAN WE DETECT STAMPS? NO, AND THIS GUARD DOES NOT PRETEND TO. The catalogue
// holds name, artist, set, number, rarity, release date, supertype and price;
// card-attrs holds types, subtypes, HP, evolution, dex, weakness and regulation
// mark; card-text holds attacks and flavour text. Nothing anywhere describes
// what is DRAWN — no stamp field, no holo pattern, no border treatment, no foil
// finish. "Promo" as a rarity and "Black Star Promos" as a set name are the
// closest we come, and neither tells you what is printed on the card face.
//
// So the check is not "is this stamp claim true". It is: THIS CLAIM IS ABOUT
// SOMETHING WE CANNOT SEE, AND IT IS PHRASED AS IF WE COULD.
//
// That is the honest boundary, and it is the same one recorded in
// house-theses.md as "I READ THE CARD, TYLER SEES IT" — every fact this repo
// holds is downstream of TEXT, and every claim about artwork is downstream of
// somebody's eyes. A universal claim about artwork ("on every card", "in all of
// them") cannot be supported by any query we can run, which makes it a
// hypothesis wearing the clothes of a fact.
//
// Set-wide markers are the specific trap: anniversary stamps, holo patterns,
// regulation marks, era borders, set symbols and foil treatments are all
// decisions made ONCE and applied to hundreds of cards. To anyone holding nine
// of them they look like per-card craft.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A claim about what is VISIBLE — not what is printed as text.
const VISUAL = /\b(hidden|tucked|drawn|artwork|art style|背景|background|border|stamp|holo|foil|shiny|silhouette|in the corner|appears in|you can see|look closely|spot the|easter egg)\b/i;

// A claim that it holds for ALL of them. This is the part that turns an
// observation into an assertion about a population we did not query.
const UNIVERSAL = /\b(every card|every single|all of them|each card|on all|in all|throughout the set|across the set|the whole set|no exceptions)\b/i;

const SURFACES = [
  { file: "data/reveal-watch.json", pick: (d) => (d.reveals ?? []).flatMap(r => [r.angle?.line, r.caption].filter(Boolean)) },
  { file: "data/post-queue.json", pick: (d) => (d.posts ?? d.queue ?? []).flatMap(p => [p.text, p.caption, p.plain].filter(Boolean)) },
  { file: "research/pulse/social-queue.json", pick: (d) => (d.posts ?? d.queue ?? []).flatMap(p => [p.text, p.caption].filter(Boolean)) },
];

const problems = [];
let scanned = 0, surfaces = 0;

for (const s of SURFACES) {
  let doc;
  try { doc = JSON.parse(await readFile(join(ROOT, s.file), "utf-8")); }
  catch { continue; }
  surfaces++;
  let lines = [];
  try { lines = s.pick(doc) ?? []; } catch { lines = []; }
  for (const line of lines) {
    scanned++;
    const text = String(line);
    if (!VISUAL.test(text) || !UNIVERSAL.test(text)) continue;
    problems.push({
      file: s.file,
      text: text.slice(0, 150),
      visual: (text.match(VISUAL) || [])[0],
      universal: (text.match(UNIVERSAL) || [])[0],
    });
  }
}

console.log("VISUAL CLAIM GUARD — claims about what is drawn, asserted over a whole set\n");
console.log(`  ${surfaces} surface(s) · ${scanned} line(s) scanned\n`);

for (const p of problems) {
  console.log(`  ✗ ${p.file}`);
  console.log(`      "${p.text}"`);
  console.log(`      says "${p.visual}" (something we cannot see) about "${p.universal}" (a population we did not query)`);
  console.log("");
}

if (problems.length) {
  console.log(`VISUAL CLAIM GUARD FAILED — ${problems.length} unsupportable claim(s).`);
  console.log("");
  console.log("We hold no field describing artwork: no stamp, no holo pattern, no border,");
  console.log("no foil. A claim about what appears on every card cannot be checked by any");
  console.log("query we can run, and set-wide markers — anniversary stamps, regulation");
  console.log("marks, era borders — look exactly like per-card choices to anyone holding a");
  console.log("handful of cards from a run of hundreds.");
  console.log("");
  console.log("Ask Tyler, or write it as a QUESTION. 'Is that on all of them?' is a better");
  console.log("post anyway: it invites the people who already know.");
  process.exit(1);
}
console.log("✓ visual claims: nothing asserts a drawn feature across a set we did not query");
