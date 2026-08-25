// surface-parity.mjs — a lesson learned once must apply everywhere.
//
// Tyler, 2026-08-25: "Imagine didn't work for mobile" — on the composite page,
// after I had fixed every one of these in the editor.
//
// THE REAL BUG WAS NOT THE IMAGE SIZE. It was that I fixed the file Tyler
// happened to be holding, three separate times, and never carried one fix
// across. The composite page was still serving `_hires` files with
// `loading="eager"` and no fallback — the exact combination that had broken the
// editor, sitting unfixed in a second file.
//
// Two files, one set of lessons, applied once. **That** is the bug this guard
// exists for.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Every rule below was learned from a real failure on a real device.
const RULES = [
  { id: "small-for-display",
    bad: /<img[^>]*src="[^"]*_hires[^"]*"/,
    why: "serves a 1-2MB full-resolution file to render a card at a few hundred pixels — this is what made the editor fail on a phone" },
  { id: "lazy",
    need: /<img[^>]*loading="lazy"/, needsImg: true,
    why: "off-screen thumbnails should not request at all; without this a page of cards downloads everything at once" },
  { id: "fallback",
    need: /<img[^>]*onerror=/, needsImg: true,
    why: "a failed image with no fallback is a broken icon that explains nothing, and the user cannot tell a slow connection from a dead host" },
  { id: "long-press",
    need: /id="outimg"/, needsCanvas: true,
    why: "a canvas cannot be long-pressed, and press-and-hold is the first thing every phone user tries" },
];

const dir = join(ROOT, "research/assets");
const files = (await readdir(dir)).filter(f => f.endsWith(".html") && !/mock|index-landing/.test(f));
const extra = ["research/pulse/cards/composite.html"];

const problems = [];
for (const rel of files.map(f => "research/assets/" + f).concat(extra)) {
  const src = await readFile(join(ROOT, rel), "utf-8").catch(() => null);
  if (!src) continue;
  const body = src.replace(/<script[\s\S]*?<\/script>/g, "");
  const hasImg = /<img[^>]*src=/.test(body);
  const hasCanvas = /getContext\(["']2d/.test(src);
  for (const r of RULES) {
    if (r.needsImg && !hasImg) continue;
    if (r.needsCanvas && !hasCanvas) continue;
    if (r.bad && r.bad.test(body)) problems.push(`${rel} — ${r.id}: ${r.why}`);
    if (r.need && hasImg && !r.need.test(body)) problems.push(`${rel} — missing ${r.id}: ${r.why}`);
  }
}

if (problems.length) {
  console.error(`\n✗ SURFACE PARITY — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("   " + p);
  console.error(`\n   Every rule here was learned from a real failure on a real device.\n   A lesson learned once must apply to every surface, or it is a lesson\n   applied to whichever file somebody happened to be holding.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ surface parity: every page with images obeys all ${RULES.length} mobile lessons`);
}
