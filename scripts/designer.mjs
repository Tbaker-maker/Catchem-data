// designer.mjs — the design lead.
//
// Tyler, 2026-08-23: "Use the designer agent — if we don't have one, hire and
// make top of its class. Audit us and all of the photos, formats, everything."
//
// A linter checks whether CSS is valid. A design lead checks whether a page was
// DESIGNED, and those are different questions. The tells of an undesigned page
// are specific and countable: a type scale with fourteen sizes because each one
// was chosen in the moment; nine greys that are all almost the same grey; an
// accent colour used everywhere, which means it accents nothing; spacing values
// that are whatever looked right at the time.
//
// None of that is invalid CSS. All of it is why a page reads as beta.
//
// DECLARED BLIND SPOT, and it is the big one: this agent cannot SEE. It counts
// and measures. It cannot tell you the page is ugly, only that the choices
// behind it were not made deliberately. Taste still needs eyes.
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const findings = [];
const F = (surface, severity, what, why, fix) => findings.push({ surface, severity, what, why, fix });

// Relative luminance, so contrast is computed rather than eyeballed.
const lum = (hex) => {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map(c => c + c) : h.match(/.{2}/g);
  const [r, g, b] = f.map(x => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const files = (await readdir(join(ROOT, "research/assets")).catch(() => [])).filter(f => f.endsWith(".html"));
// Mockups are explorations, not shipped surfaces - auditing them would be
// auditing sketches, and the noise would bury the real findings.
const SHIPPED = files.filter(f => !/mock|v[0-9]\.html/.test(f));

for (const file of SHIPPED) {
  const src = await readFile(join(ROOT, "research/assets", file), "utf-8").catch(() => "");
  if (!src) continue;

  // ── 1 · TYPE SCALE ──────────────────────────────────────────────────────
  // A designed page has a scale. An undesigned one has a size per element,
  // picked in the moment and never reconciled.
  const sizes = [...new Set((src.match(/font-size:\s*(\d+(?:\.\d+)?)px/g) ?? [])
    .map(m => Number(m.match(/[\d.]+/)[0])))].sort((a, b) => a - b);
  if (sizes.length > 8)
    F(file, "high", `${sizes.length} distinct font sizes: ${sizes.join(", ")}`,
      "A type scale is normally five to seven steps. More than that means sizes were chosen per element rather than from a system, which is the clearest tell of an undesigned page.",
      "Collapse to a scale. Anything within 1px of a neighbour is the same size wearing a different number.");

  // ── 2 · COLOUR COUNT ────────────────────────────────────────────────────
  const hexes = [...new Set((src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map(h => h.toLowerCase()))];
  if (hexes.length > 12)
    F(file, "medium", `${hexes.length} distinct colours`,
      "Beyond a dozen, the palette stops being a palette. Most of the extras are near-duplicate greys nobody chose on purpose.",
      "Reduce to tokens. If two greys differ by less than 6% luminance, they are one grey.");

  // ── 3 · ACCENT DISCIPLINE ───────────────────────────────────────────────
  // An accent used everywhere accents nothing. This is the single most common
  // reason a dark page looks cheap.
  const accentUses = (src.match(/--live\)|#36d399/g) ?? []).length;
  if (accentUses > 14)
    F(file, "high", `the accent colour appears ${accentUses} times`,
      "An accent used everywhere accents nothing, and it is the most common reason a dark page reads as cheap rather than considered.",
      "Spend it in two places: the active state and the one primary action. Everything else greys.");

  // ── 4 · CONTRAST, computed not guessed ──────────────────────────────────
  const bg = (src.match(/--ink:\s*(#[0-9a-fA-F]{6})/) ?? [])[1];
  if (bg) {
    for (const [name, rx] of [["--soft", /--soft:\s*(#[0-9a-fA-F]{6})/], ["--faint", /--faint:\s*(#[0-9a-fA-F]{6})/]]) {
      const c = (src.match(rx) ?? [])[1];
      if (!c) continue;
      const ratio = contrast(c, bg);
      if (ratio < 4.5)
        F(file, ratio < 3 ? "high" : "medium", `${name} on the background is ${ratio.toFixed(1)}:1`,
          `WCAG AA wants 4.5:1 for body text and 3:1 for large text. Below 3 it is unreadable on a phone in daylight, which is where this is actually seen.`,
          `Lighten ${name} until it clears 4.5, or reserve it for text at 18px and above.`);
    }
  }

  // ── 5 · TOUCH TARGETS ───────────────────────────────────────────────────
  const smallPads = (src.match(/padding:\s*([4-9])px\s+\d+px/g) ?? []).length;
  if (smallPads > 2)
    F(file, "medium", `${smallPads} controls with vertical padding under 10px`,
      "A tap target under about 44px total height is missed on a phone, and this is a phone-first tool.",
      "Raise vertical padding or set a min-height on interactive elements.");

  // ── 6 · FONT FALLBACK ───────────────────────────────────────────────────
  // A remote font with no local fallback means a page that renders in Times
  // for the first second, or forever on a bad connection.
  const remoteFont = /fonts\.googleapis\.com/.test(src);
  // Both forms count: font-family: and the font: shorthand, which sets the
  // family as its last value. Missing the shorthand flagged four healthy pages.
  const stacks = [...src.matchAll(/font(?:-family)?:\s*[^;}]{0,90}/g)].map(m => m[0])
    .filter(m => /Syne|Sora|JetBrains/.test(m));
  // Custom properties count. build.html defines --display/--body/--mono with
  // fallbacks baked in, which is better practice than repeating literal stacks -
  // and my first check punished it for exactly that.
  const tokenStacks = [...src.matchAll(/--(?:display|body|mono):\s*[^;}]{0,90}/g)].map(m => m[0]);
  const all = [...stacks, ...tokenStacks];
  const hasFallback = all.length > 0 && all.every(m => /system-ui|sans-serif|monospace|ui-monospace/.test(m));
  if (remoteFont && !hasFallback)
    F(file, "high", "remote fonts with no local fallback",
      "On a slow connection the page renders in the browser default, which is Times. First impressions do not get a second attempt.",
      "Add system-ui and a generic family to every font stack.");

  // ── 7 · SPACING RHYTHM ──────────────────────────────────────────────────
  const spacings = [...new Set((src.match(/(?:margin|padding)[^:]*:\s*(\d+)px/g) ?? [])
    .map(m => Number(m.match(/\d+/)[0])).filter(n => n > 0))];
  const offScale = spacings.filter(n => n % 2 !== 0);
  if (offScale.length > 4)
    F(file, "low", `${offScale.length} odd-numbered spacing values: ${offScale.slice(0, 8).join(", ")}`,
      "Odd values usually mean nudging until it looked right rather than working from a scale. It is invisible individually and reads as sloppy in aggregate.",
      "Snap to a 4px rhythm.");
}

// ── 7b · ORPHANED SURFACES ────────────────────────────────────────────────
// A shipped page that no generator writes will miss every fix applied at the
// source and drift further from the rest of the site daily. A page nothing owns
// is worse than a page with a bug, because the bug at least has somewhere to be
// fixed.
{
  const scriptDir = await readdir(join(ROOT, "scripts")).catch(() => []);
  const allScripts = (await Promise.all(scriptDir.filter(f => f.endsWith(".mjs"))
    .map(f => readFile(join(ROOT, "scripts", f), "utf-8").catch(() => "")))).join("\n");
  for (const file of SHIPPED) {
    const stem = file.replace(".html", "");
    if (!allScripts.includes(file) && !allScripts.includes(stem))
      F(file, "high", "no generator writes this page",
        "It was created once and nothing regenerates it, so every fix applied at the source misses it and it drifts further from the site every day.",
        "Either give it a generator or delete it. A page nothing owns cannot be maintained.");
  }
}

// ── 8 · THE CARDS ─────────────────────────────────────────────────────────
// Every minted SVG, checked for the two things that make a card look homemade.
{
  const cards = (await readdir(join(ROOT, "research/pulse/cards")).catch(() => [])).filter(f => f.endsWith(".svg"));
  let noBrandFont = 0, tiny = 0;
  for (const c of cards) {
    const svg = await readFile(join(ROOT, "research/pulse/cards", c), "utf-8").catch(() => "");
    if (!/font-family="(Syne|Sora|JetBrains)/.test(svg)) noBrandFont++;
    if ((svg.match(/font-size="(\d+)"/g) ?? []).some(m => Number(m.match(/\d+/)[0]) < 14)) tiny++;
  }
  if (noBrandFont) F("cards", "medium", `${noBrandFont} of ${cards.length} cards use no brand typeface`,
    "A card in the system default is a card that could have come from anywhere. The typeface is most of what makes it ours at a glance.",
    "Set Syne, Sora or JetBrains Mono on every text element.");
  if (tiny) F("cards", "medium", `${tiny} card(s) carry text below 14px`,
    "These are viewed at phone width inside a timeline. Below 14px in the source is illegible after the platform resizes it.",
    "Raise the floor to 15px on anything meant to be read.");
}

const bySeverity = { high: 0, medium: 0, low: 0 };
for (const f of findings) bySeverity[f.severity]++;

await (await import("node:fs/promises")).writeFile(join(ROOT, "research/pulse/design-audit.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  audited: `${SHIPPED.length} shipped surfaces, ${(await readdir(join(ROOT, "research/pulse/cards")).catch(() => [])).filter(f => f.endsWith(".svg")).length} minted cards`,
  principle: "A linter asks whether the CSS is valid. A design lead asks whether the page was DESIGNED. The tells of an undesigned page are countable: too many type sizes, too many near-identical greys, an accent used everywhere so it accents nothing.",
  blindSpot: "It cannot SEE. It counts and measures. It cannot tell you a page is ugly, only that the choices behind it were not made deliberately.",
  counts: bySeverity, findings }, null, 2));

if (bySeverity.high) {
  console.error(`\n✗ DESIGN — ${bySeverity.high} high · ${bySeverity.medium} medium · ${bySeverity.low} low\n`);
  for (const f of findings.filter(f => f.severity === "high"))
    console.error(`   ${f.surface}: ${f.what}\n     ${f.why}\n     → ${f.fix}`);
  console.error("");
} else {
  console.log(`✓ design: ${findings.length} note(s) across ${SHIPPED.length} surfaces · ${bySeverity.medium} medium, ${bySeverity.low} low`);
  for (const f of findings.slice(0, 5)) console.log(`  [${f.severity}] ${f.surface}: ${f.what}`);
}
