// ── ESCAPE AUDIT — BLOCKING ────────────────────────────────────────────────
// Generated HTML is written from template literals. An escape written inside
// one is consumed by the generator before it reaches the browser, so a regex
// that reads correctly in the source ships as something else entirely:
//
//   written /\s+/   ships /s+/    a split on the LETTER "s"
//   written /\//    ships ///     the rest of the line becomes a comment
//   written /\d+/   ships /d+/    a match on the LETTER "d"
//
// This class of bug has now hit this repo THREE times, and every previous fix
// was "remember to double the backslash" — a fix that lasts exactly as long as
// the memory does. Twice the build exited 0 while shipping a broken artifact,
// because `node --check` on the GENERATOR proves nothing about the STRING the
// generator prints.
//
// What made it expensive is that the failures do not look like failures. The
// /s+/ caption split returned one enormous token instead of throwing, so the
// height reserve said "one line" and the renderer drew three straight through
// the card art. The /s+/ in the ask box rewrote the user's own text: typing
// "swampert" and tapping a suggestion left " Charizard" behind, with every "s"
// silently deleted. Nothing logged. Nothing threw.
//
// So this reads the ARTIFACT, not the generator, and fails the build.
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const B = String.fromCharCode(92);

// Files that are PRINTED BY a template literal rather than written by hand.
const ARTIFACTS = [
  "research/assets/build.html",
  "research/assets/index.html",
  "docs/index.html",
];

// Each rule names the eaten form and what it silently becomes. The patterns are
// built from chr(92) for the same reason WS is: a rule about escapes that is
// itself written with an escape is one editor away from being wrong.
const RULES = [
  { id: "eaten-\\s", rx: /\/\[?[^\/\n]{0,12}(?<![a-zA-Z0-9\\\]])s\+\/(?![a-z])/g,
    test: (m) => /^\/s\+\/$/.test(m),
    says: "/s+/ — this was written /" + B + "s+/ and splits on the letter s" },
  { id: "eaten-\\d", rx: /\/d\+\//g, test: () => true,
    says: "/d+/ — this was written /" + B + "d+/ and matches the letter d" },
  { id: "eaten-\\w", rx: /\/w\+\//g, test: () => true,
    says: "/w+/ — this was written /" + B + "w+/ and matches the letter w" },
  { id: "eaten-\\/", rx: /replace\(\/\/\/[a-z]*,/g, test: () => true,
    says: "/// — this was written /" + B + "// and comments out the rest of the line" },
  { id: "eaten-\\S", rx: /\/S\*\$\//g, test: () => true,
    says: "/S*$/ — this was written /" + B + "S*$/ and matches the letter S" },
  { id: "eaten-\\.", rx: /\.split\(\/\.\/\)/g, test: () => true,
    says: ".split(/./) — this was written .split(/" + B + "./) and splits on every character" },
];

let failures = 0, scanned = 0;
console.log("ESCAPE AUDIT — reading what the generators PRINT, not what they say\n");

for (const rel of ARTIFACTS) {
  let src;
  try { src = await readFile(join(ROOT, rel), "utf-8"); }
  catch { continue; }                       // not every artifact exists in every checkout
  scanned++;
  const lines = src.split("\n");
  let hits = 0;

  for (const rule of RULES) {
    rule.rx.lastIndex = 0;
    let m;
    while ((m = rule.rx.exec(src)) !== null) {
      if (!rule.test(m[0])) continue;
      const ln = src.slice(0, m.index).split("\n").length;
      // AN EATEN ESCAPE INSIDE A COMMENT IS HARMLESS, and this file's own
      // hazard notes quote the broken form deliberately. Skip lines that OPEN
      // with a comment marker - not lines that merely contain one, because a
      // live statement with a trailing comment is still live code.
      const head = (lines[ln - 1] || "").trim();
      if (head.startsWith("//") || head.startsWith("*") || head.startsWith("/*")) continue;
      hits++; failures++;
      console.log(`  ✗ ${rel}:${ln}`);
      console.log(`      ${rule.says}`);
      console.log(`      ${lines[ln - 1].trim().slice(0, 96)}`);
    }
  }
  if (!hits) console.log(`  ✓ ${rel} — no eaten escapes`);
}

// A guard that silently scans nothing is worse than no guard: it reports green
// forever. If the artifacts are missing, say so and fail rather than pass.
if (!scanned) {
  console.log("  ✗ no artifacts found to scan — run the generators first");
  failures++;
}

console.log("");
if (failures) {
  console.log(`ESCAPE AUDIT FAILED — ${failures} eaten escape${failures > 1 ? "s" : ""} reached a published artifact.`);
  console.log("Do not fix this by doubling the backslash. Build the pattern from");
  console.log("String.fromCharCode, or use a form that needs no escape at all —");
  console.log("a negated class like /[^a-z0-9]+/ needs none, and cannot rot.");
  process.exit(1);
}
console.log(`✓ escape audit: ${scanned} artifact${scanned > 1 ? "s" : ""} clean, no eaten escapes`);
