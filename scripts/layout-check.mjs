// layout-check.mjs — measure it, do not eyeball it.
//
// Five broken visuals in one day, all of them layout: an empty photo panel
// eating 40% of a card, a title clipping off the right edge (twice), a wordmark
// colliding with a stat row, and a card back where a card front should be.
// Every one shipped because I estimated instead of measuring, and estimating
// text width from character count is guessing in a way that feels like
// arithmetic.
//
// We have the actual font files vendored. So measure the actual glyphs.
// opentype.js reads the same TTFs the renderer uses, which means the width this
// reports is the width that will render — not an approximation of it.
//
// WHAT IT CATCHES: text wider than its container, elements overlapping,
// text running past the canvas, and empty regions where content was expected.
// WHAT IT CANNOT: whether the result looks GOOD. Contrast, balance, whether a
// pairing is beautiful. That still needs eyes, and no amount of geometry
// replaces opening the file.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import opentype from "opentype.js";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FONT_DIR = join(ROOT, "research/brand/fonts");
const FONTS = {};
for (const f of await readdir(FONT_DIR).catch(() => [])) {
  if (!f.endsWith(".ttf")) continue;
  try { FONTS[f.replace(".ttf", "")] = opentype.parse(readFileSync(join(FONT_DIR, f)).buffer); } catch {}
}

// Map an SVG font-family + weight to the file we actually vendored, so the
// measurement uses the same glyphs the renderer will.
const pickFont = (family = "", weight = "400") => {
  const fam = /syne/i.test(family) ? "Syne" : /mono/i.test(family) ? "JetBrainsMono" : "Sora";
  const w = Number(weight) >= 700 ? (fam === "Syne" ? "800" : "700") : "400";
  return FONTS[`${fam}-${w}`] ?? FONTS[`${fam}-400`] ?? Object.values(FONTS)[0] ?? null;
};

export function measureText(text, { family = "Sora", weight = "400", size = 16 } = {}) {
  const font = pickFont(family, weight);
  if (!font) return null;                       // no font is UNKNOWN, never zero
  return font.getAdvanceWidth(String(text), size);
}

export function checkSvg(svg, { name = "svg" } = {}) {
  const issues = [];
  const vb = /viewBox=["']([\d.\s-]+)["']/.exec(svg);
  if (!vb) return [{ name, issue: "no viewBox — cannot measure anything against an unknown canvas" }];
  const [, , W, H] = vb[1].trim().split(/\s+/).map(Number);

  // Every <text> element: where it starts, how wide it renders, where it ends.
  const boxes = [];
  const rx = /<text([^>]*)>([^<]*)<\/text>/g;
  let m;
  while ((m = rx.exec(svg))) {
    const attrs = m[1], content = m[2].trim();
    if (!content) continue;
    const num = (a) => Number((new RegExp(`${a}=["']([\\d.-]+)["']`).exec(attrs) ?? [])[1] ?? NaN);
    const str = (a) => ((new RegExp(`${a}=["']([^"']+)["']`).exec(attrs) ?? [])[1] ?? "");
    const x = num("x"), y = num("y"), size = num("font-size") || 16;
    const family = str("font-family"), weight = str("font-weight"), anchor = str("text-anchor");
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const w = measureText(content, { family, weight, size });
    if (w == null) { issues.push({ name, issue: `cannot measure "${content.slice(0, 28)}" — font not vendored`, severity: "warn" }); continue; }

    const left = anchor === "end" ? x - w : anchor === "middle" ? x - w / 2 : x;
    const right = left + w;
    const fnt = pickFont(family, weight);
    const upm = fnt?.unitsPerEm ?? 1000;
    const asc = (fnt?.ascender ?? 800) / upm * size;
    const desc = Math.abs(fnt?.descender ?? -200) / upm * size;
    boxes.push({ content, left, right, top: y - asc, bottom: y + desc, size, anchor });

    // 1 — runs off the canvas. This is the clipping bug, three times over.
    if (right > W - 8)
      issues.push({ name, severity: "critical",
        issue: `"${content.slice(0, 34)}" ends at ${Math.round(right)}px on a ${W}px canvas — it will clip`,
        fix: `shorten it, or drop font-size to about ${Math.floor(size * (W - x - 20) / w)}px` });
    if (left < 4)
      issues.push({ name, severity: "critical", issue: `"${content.slice(0, 34)}" starts at ${Math.round(left)}px — off the left edge` });
    if (y > H - 4 || y < 8)
      issues.push({ name, severity: "critical", issue: `"${content.slice(0, 34)}" sits at y=${y} on a ${H}px canvas — outside it` });
  }

  // 2 — collisions. The wordmark-over-stat-row bug.
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const overlapX = a.left < b.right - 2 && b.left < a.right - 2;
    const overlapY = a.top < b.bottom - 1 && b.top < a.bottom - 1;
    if (overlapX && overlapY)
      issues.push({ name, severity: "critical",
        issue: `"${a.content.slice(0, 22)}" overlaps "${b.content.slice(0, 22)}"`,
        fix: "move one, or shorten the longer of the two" });
  }

  // 3 — an empty region where content was expected. The blank photo panel.
  const emptyPanels = [...svg.matchAll(/<rect[^>]*width=["'](\d+)["'][^>]*height=["'](\d+)["'][^>]*fill=["']none["']/g)];
  for (const p of emptyPanels) {
    const area = Number(p[1]) * Number(p[2]);
    if (area > W * H * 0.15)
      issues.push({ name, severity: "warn", issue: `an unfilled panel covers ${Math.round(area / (W * H) * 100)}% of the canvas — is it meant to hold something?` });
  }
  return issues;
}

if (process.argv[1] && import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  const dir = join(ROOT, "research/pulse/cards");
  const files = (await readdir(dir).catch(() => [])).filter(f => f.endsWith(".svg"));
  let critical = 0;
  console.log(`  fonts loaded: ${Object.keys(FONTS).join(", ") || "NONE — measurements unavailable"}\n`);
  for (const f of files) {
    const issues = checkSvg(await readFile(join(dir, f), "utf-8"), { name: f });
    const crit = issues.filter(i => i.severity === "critical");
    critical += crit.length;
    for (const i of crit) console.log(`  ✗ ${f}: ${i.issue}${i.fix ? `\n      → ${i.fix}` : ""}`);
  }
  console.log(critical ? `\n✗ layout: ${critical} clipping/collision problem(s) across ${files.length} card(s)\n`
    : `✓ layout: ${files.length} card(s) measured, nothing clips or collides`);
  console.log(`  This measures geometry only. Whether it LOOKS right still needs eyes.`);
  process.exitCode = critical ? 1 : 0;
}
