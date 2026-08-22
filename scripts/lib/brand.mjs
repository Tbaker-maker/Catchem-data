// lib/brand.mjs — generators read the brand from ONE file.
// Values come from research/brand/tokens.json, which syncs from the live
// site (node scripts/sync-brand-tokens.mjs). Inline hex in a generator is
// drift waiting to happen — generate-board shipped #d8dde8 text and
// #ff6b7a red for days before this existed (caught 2026-08-22).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const TOKENS = JSON.parse(readFileSync(join(ROOT, "research/brand/tokens.json"), "utf-8"));
const c = TOKENS.color;

// The :root block generated HTML pages embed. Legacy var names kept so the
// existing page CSS resolves unchanged; --dim uses the a11y-brightened
// secondary (documented exception in tokens.css).
export const rootCss = () =>
  `:root{--bg:${c.bg};--bg-deep:${c.bgDeep};--panel:${c.surface};--raised:${c.surface2};` +
  `--line:${c.border};--txt:${c.text};--dim:${c.textSubApp};--muted:${c.textMuted};` +
  `--green:${c.green};--gold:${c.gold};--red:${c.red};--purple:${c.purple};--blue:${c.blue}}`;

export const GOOGLE_FONTS = TOKENS.font.googleFontsHref
  ?? "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap";
