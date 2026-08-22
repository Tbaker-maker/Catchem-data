// mode-diff-test.mjs — THE MODE HONESTY GUARD (§20's one law, enforced).
//
// "Modes reorder emphasis. They NEVER hide a number, and they never
// change one." The moment a mode filters out an inconvenient figure it
// becomes an echo chamber — the opposite of the provenance chips.
//
// This test renders the app's Home once per mode (real browser, real
// feed, localStorage preset before any script runs) and asserts the
// MULTISET of displayed figures is identical between every pair of
// modes. Order may differ; values and counts may not.
//
// Run:  node scripts/mode-diff-test.mjs
// Env:  MODE_APP overrides the target (default: the live app).
//       MODE_APP_B compares page A in one mode vs page B — used by the
//       negative test: two DIFFERENT pages must FAIL, proving the
//       comparator actually detects figure differences.
//       CHROME_PATH overrides browser discovery.
import { existsSync } from "node:fs";

const APP = process.env.MODE_APP || "https://app.catchemtcg.com";
const MODES = ["balanced", "collector", "flipper", "grader"];

const chrome = process.env.CHROME_PATH
  || ["/usr/bin/google-chrome", "/usr/bin/chromium-browser",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => existsSync(p));
if (!chrome) { console.error("✗ no Chrome/Edge found — set CHROME_PATH"); process.exit(1); }

// Every numeric token a reader can see: money, percentages, bare numbers.
// Sorted multiset — position is exactly what modes ARE allowed to change.
export const figures = (text) =>
  (text.match(/\$[\d,]+(?:\.\d+)?|[+-]?\d+(?:\.\d+)?%|\b\d[\d,]*(?:\.\d+)?\b/g) || []).sort();

// self-check of the comparator itself (pure, no browser)
{
  const a = figures("Index 100.6 up 0.6% · $54.45 and 20 listings");
  const b = figures("20 listings · $54.45 — Index 100.6, 0.6% up");
  const c = figures("Index 100.6 up 0.6% · $54.45 and 19 listings");
  if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("✗ comparator: reorder must be EQUAL"); process.exit(1); }
  if (JSON.stringify(a) === JSON.stringify(c)) { console.error("✗ comparator: changed figure must DIFFER"); process.exit(1); }
  console.log("  ✓ comparator self-check (reorder equal, change caught)");
}

const { default: puppeteer } = await import("puppeteer-core");
const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
const render = async (url, mode) => {
  const p = await browser.newPage();
  await p.evaluateOnNewDocument((m) => { try { localStorage.setItem("mode", m); } catch {} }, mode);
  await p.goto(url + "/", { waitUntil: "networkidle2", timeout: 45000 });
  await p.waitForFunction(() => document.body && document.body.innerText.length > 300, { timeout: 20000 }).catch(() => {});
  const text = await p.evaluate(() => document.body.innerText);
  await p.close();
  return figures(text);
};

let failed = 0;
try {
  const B = process.env.MODE_APP_B; // negative-test hook: different page
  const base = await render(APP, MODES[0]);
  console.log(`  baseline (${MODES[0]}): ${base.length} figures on ${APP}`);
  if (base.length < 20) { console.error(`✗ suspiciously few figures (${base.length}) — page may not have rendered`); failed++; }
  for (const m of MODES.slice(1)) {
    const other = await render(B || APP, m);
    const same = JSON.stringify(base) === JSON.stringify(other);
    if (same) console.log(`  ✓ ${m}: identical figure multiset (${other.length})`);
    else {
      failed++;
      const A = new Set(base), O = new Set(other);
      const onlyA = base.filter((x) => !O.has(x)).slice(0, 5);
      const onlyO = other.filter((x) => !A.has(x)).slice(0, 5);
      console.error(`  ✗ ${m}: figure sets DIFFER (${base.length} vs ${other.length}) — only-in-${MODES[0]}: [${onlyA}] · only-in-${m}: [${onlyO}]`);
    }
  }
} finally { await browser.close(); }

if (failed) {
  console.error("\n✗ MODE HONESTY VIOLATED — a mode is hiding or changing a number. That is an echo chamber; fix before shipping.\n");
  process.exit(1);
}
console.log("\n✓ mode honesty: every mode shows every figure — order and accent only");
