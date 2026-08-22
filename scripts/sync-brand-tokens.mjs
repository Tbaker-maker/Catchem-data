// sync-brand-tokens.mjs — THE BRAND SYNCS FROM ONE PLACE.
// SOURCE OF TRUTH: the live marketing site (catchemtcg.com, the
// `catchem-site` Worker). This script fetches the served page, extracts
// the :root design tokens + type facts from its inline CSS, and writes:
//   research/brand/tokens.css   (canonical custom properties)
//   research/brand/tokens.json  (same values for generators/scripts)
// Regenerate any time the site's design changes:
//   node scripts/sync-brand-tokens.mjs
// Consumers: catchem-app imports tokens.css (aliased to its legacy var
// names); Catchem-data generators read tokens.json via scripts/lib/brand.mjs.
//
// DOCUMENTED EXCEPTION (do not "fix"): the app's secondary text runs
// #98a1b5, brighter than the site's --text-sub #8a93a8 — a deliberate
// Lighthouse contrast fix (2026-08-19, a11y 100). tokens.css carries it
// as --text-sub-app.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/brand");

const res = await fetch("https://catchemtcg.com");
if (!res.ok) { console.error(`site fetch failed: ${res.status} — tokens NOT regenerated`); process.exit(1); }
const html = await res.text();
const style = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)?.[1];
const rootBlock = style && /:root\s*{([^}]*)}/.exec(style)?.[1];
if (!rootBlock) { console.error("no :root block in served CSS — site structure changed, inspect manually"); process.exit(1); }

const vars = {};
for (const m of rootBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
const fontsLink = /<link[^>]*fonts\.googleapis[^>]*href="([^"]+)"/.exec(html)?.[1]
  ?? /href="(https:\/\/fonts\.googleapis[^"]+)"/.exec(html)?.[1] ?? null;

// Scales measured from the served CSS (dominant values), stable enough to
// pin as tokens; re-measured on every sync.
const count = (re) => {
  const m = {}; let x; const r = new RegExp(re, "g");
  while ((x = r.exec(style))) m[x[1]] = (m[x[1]] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k);
};
const radii = count(String.raw`border-radius:\s*([\d.]+px|999px)`).slice(0, 5);
const gaps = count(String.raw`gap:\s*([\d.]+px)`).slice(0, 6);
const maxw = count(String.raw`max-width:\s*([\d.]+px)`).slice(0, 4);

const tokens = {
  _meta: {
    source: "https://catchemtcg.com (catchem-site Worker) — SOURCE OF TRUTH",
    syncedAt: new Date().toISOString(),
    regenerate: "node scripts/sync-brand-tokens.mjs",
  },
  color: {
    bg: vars["bg"], bgDeep: vars["bg-deep"], surface: vars["surface"],
    surface2: vars["surface-2"], surface3: vars["surface-3"],
    border: vars["border"], borderStrong: vars["border-strong"],
    text: vars["text"], textSub: vars["text-sub"], textMuted: vars["text-muted"],
    // a11y exception, see header
    textSubApp: "#98a1b5",
    green: vars["green"], purple: vars["purple"], blue: vars["blue"],
    gold: vars["gold"], red: vars["red"],
  },
  font: {
    display: vars["font-display"], body: vars["font-body"], mono: vars["font-mono"],
    googleFontsHref: fontsLink,
    weights: { display: [700, 800], body: [400, 600, 700], mono: [400, 700] },
  },
  scale: {
    radius: { pill: "99px", card: "16px", control: "10px", tight: "8px", observed: radii },
    gap: { observed: gaps },
    maxWidth: { content: "820px", wide: "1040px", observed: maxw },
    button: { primary: "background:green · color:bg-deep · padding:14px 24px · radius:10px · 0.96rem/700" },
  },
};

let cssOut = `/* Catch'em brand tokens — GENERATED, do not hand-edit.
 * Source of truth: the live site (catchemtcg.com).
 * Regenerate: node scripts/sync-brand-tokens.mjs
 * Synced: ${tokens._meta.syncedAt} */\n:root {\n`;
for (const [k, v] of Object.entries(vars)) cssOut += `  --${k}: ${v};\n`;
cssOut += `  /* a11y exception (Lighthouse contrast, 2026-08-19): app secondary text */\n  --text-sub-app: #98a1b5;\n`;
cssOut += `  /* APPROVED ADDITIONS (chat ruling 2026-08-22, brand-tokens.md DESIGN SYSTEM):
   * section-space = page air (component gaps stop at 16); num-xl = numeric
   * register above card heroes (Syne is display-only, cannot carry digits);
   * accent-dim = accent at 40% for BORDERS ONLY — never fills. */\n`;
cssOut += `  --section-space-1: 32px;\n  --section-space-2: 40px;\n  --section-space-3: 56px;\n`;
cssOut += `  --num-xl: 700 40px 'JetBrains Mono', monospace;\n`;
cssOut += `  /* legacy aliases so existing app/generator CSS keeps resolving */\n`;
cssOut += `  --panel: var(--surface);\n  --raised: var(--surface-2);\n  --line: var(--border);\n  --txt: var(--text);\n  --dim: var(--text-sub-app);\n  --sans: var(--font-body);\n  --disp: var(--font-display);\n  --mono: var(--font-mono);\n}\n`;

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "tokens.css"), cssOut);
await writeFile(join(OUT, "tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
console.log(`✓ brand tokens synced from live site: ${Object.keys(vars).length} vars → research/brand/tokens.{css,json}`);
