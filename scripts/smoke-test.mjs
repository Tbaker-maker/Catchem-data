// smoke-test.mjs — THE BLANK-PAGE GUARD.
//
// On 2026-08-22 the app shipped completely blank (a state variable declared
// in the wrong component threw on mount) and NOTHING noticed — build green,
// deploy green, HTTP 200, empty screen. Status codes are not proof of a
// working product; only a rendered DOM is.
//
// Three layers, all against the LIVE deployments:
//   1. PUBLIC SITE (server-rendered → static assertions are honest):
//      landing, methodology (#deal-zone), a product lander, the board —
//      each must be 200 AND contain its load-bearing content, not a shell.
//   2. FEED CONTRACT: pulse-feed.json parses, carries its required keys,
//      has a plausible product count, and is fresh (<48h).
//   3. APP RENDERED DOM (headless Chrome, because the app is an SPA and
//      its HTML is ALWAYS a shell): the page must mount without a page
//      error, show the nav, show the index number, and show at least one
//      product card. This is the layer that catches the 2026-08-22 class.
//
// Run:  node scripts/smoke-test.mjs           (after any deploy; CI daily)
// Env:  SMOKE_SITE / SMOKE_APP / SMOKE_FEED override targets — used by the
//       negative test (pointing SMOKE_APP at a non-React page must FAIL).
//       CHROME_PATH overrides browser discovery.
import { existsSync } from "node:fs";

const SITE = process.env.SMOKE_SITE || "https://catchemtcg.com";
const APP = process.env.SMOKE_APP || "https://app.catchemtcg.com";
const FEED = process.env.SMOKE_FEED || "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/pulse/pulse-feed.json";

let failures = 0;
const ok = (name) => console.log(`  ✓ ${name}`);
const bad = (name, detail) => { failures++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); };

// TIMEOUT ON EVERY FETCH. Node's fetch has NO default timeout, so a host that
// accepts the connection and then never answers hangs this script forever —
// proven 2026-08-22 against a deliberately slow server: the smoke test sat for
// the full 120s of an outer kill and never reached check two. In CI that is
// worse than a failure, because a hung job is not a red X, it is a job that
// burns its whole allowance and reports nothing. A guard that can hang is a
// guard that can be silently skipped.
const HTTP_TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const fetchWithTimeout = (url, opts = {}) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });

async function page(url, anchors, name) {
  try {
    const r = await fetchWithTimeout(url, { headers: { "cache-control": "no-cache" } });
    if (r.status !== 200) return bad(name, `HTTP ${r.status}`);
    const html = await r.text();
    for (const a of anchors) if (!html.includes(a)) return bad(name, `missing anchor "${a}"`);
    ok(`${name} — 200 + ${anchors.length} anchors`);
  } catch (e) { bad(name, e.message); }
}

console.log("── 1 · public site (static, server-rendered) ──");
await page(SITE + "/", ["Catch'em", "email"], "landing");
await page(SITE + "/methodology", ['id="deal-zone"', 'id="prices"', "Buy Pressure"], "methodology");
await page(SITE + "/p/sv9-booster-box", ["Journey Together Booster Box", "Clean floor", "Deal Zone"], "lander sv9-bb");
await page(SITE + "/board", ["The Board"], "board");

console.log("── 2 · feed contract ──");
try {
  const r = await fetchWithTimeout(FEED, { headers: { "cache-control": "no-cache" } });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  const f = await r.json();
  const need = ["products", "sealedIndex", "history", "dealZone", "generatedAt"];
  const missing = need.filter((k) => f[k] == null);
  if (missing.length) bad("feed keys", "missing " + missing.join(","));
  else ok("feed keys present (" + need.join(", ") + ")");
  if ((f.products || []).length < 150) bad("feed product count", String(f.products?.length));
  else ok(`feed carries ${f.products.length} products`);
  const age = (Date.now() - Date.parse(f.generatedAt)) / 3600000;
  if (!(age < 48)) bad("feed freshness", `${Math.round(age)}h old`);
  else ok(`feed fresh (${age.toFixed(1)}h)`);

  // VALUES, not just SHAPE. Everything above passes on a feed that parses, has
  // every key and a fresh timestamp — which is exactly what a compromised or
  // broken upstream serves. Proven 2026-08-22 against a deliberately poisoned
  // feed: 207 products, correct keys, generatedAt now, and the smoke test said
  // "all healthy" while carrying a Sealed Index of 8,123,456, prices of
  // -$412.55, a floor of $5,000,000 above a high of $0.01, and -7 listings.
  // Shape checks cannot see any of that. These are impossibility checks, not
  // taste: every one asserts something that cannot be true of a real market.
  const INDEX_MIN = 1, INDEX_MAX = 10000;      // chain-linked from 100
  const PRICE_MAX = 100000;                    // above any sealed product we track
  const lvl = f.sealedIndex?.level;
  if (typeof lvl !== "number" || !(lvl > INDEX_MIN && lvl < INDEX_MAX))
    bad("index level is plausible", `level ${lvl} outside ${INDEX_MIN}-${INDEX_MAX}`);
  else ok(`index level plausible (${lvl})`);

  const viol = [];
  for (const p of f.products || []) {
    const { id, median: m, floor: lo, high: hi, listings: n } = p;
    if (m != null && !(m > 0 && m < PRICE_MAX)) viol.push(`${id}: median ${m}`);
    if (n != null && !(Number.isFinite(n) && n >= 0)) viol.push(`${id}: listings ${n}`);
    if (lo != null && hi != null && lo > hi) viol.push(`${id}: floor ${lo} > high ${hi}`);
    if (m != null && lo != null && m < lo) viol.push(`${id}: median ${m} < floor ${lo}`);
    if (m != null && hi != null && m > hi) viol.push(`${id}: median ${m} > high ${hi}`);
    if (viol.length > 4) break;
  }
  if (viol.length) bad("product values are possible", viol.slice(0, 3).join(" · "));
  else ok("product values pass impossibility checks");
} catch (e) { bad("feed fetch/parse", e.message); }

console.log("── 3 · app rendered DOM (headless Chrome) ──");
const chrome = process.env.CHROME_PATH
  || ["/usr/bin/google-chrome", "/usr/bin/chromium-browser",
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => existsSync(p));
if (!chrome) {
  bad("rendered check", "no Chrome/Edge found — the layer that catches blank pages DID NOT RUN (set CHROME_PATH)");
} else {
  try {
    const { default: puppeteer } = await import("puppeteer-core");
    const browser = await puppeteer.launch({ executablePath: chrome, headless: "new", args: ["--no-sandbox", "--disable-gpu"] });
    try {
      const p = await browser.newPage();
      const pageErrors = [];
      p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 120)));
      await p.goto(APP + "/", { waitUntil: "networkidle2", timeout: 45000 });
      // the app is data-driven: give the feed fetch a moment past networkidle
      await p.waitForFunction(() => document.body && document.body.innerText.length > 100, { timeout: 20000 }).catch(() => {});
      const text = await p.evaluate(() => document.body.innerText);
      if (pageErrors.length) bad("app mounts without page errors", pageErrors[0]);
      else ok("app mounts without page errors");
      if (text.trim().length < 100) bad("app is not a blank page", `body text ${text.trim().length} chars`);
      else ok(`app renders content (${text.trim().length} chars)`);
      for (const nav of ["Today", "Tools", "Watch", "Board"]) {
        if (!text.includes(nav)) { bad("nav present", `missing "${nav}"`); break; }
      }
      if (["Today", "Tools", "Watch", "Board"].every((n) => text.includes(n))) ok("nav present (Today/Tools/Watch/Board)");
      if (!/SEALED INDEX/i.test(text) || !/\d{2,3}(\.\d)?/.test(text)) bad("index number visible", "no SEALED INDEX + level in rendered text");
      else ok("index number visible");
      if (!/\$[\d,]+/.test(text)) bad("a product price renders", "no $ amount in rendered text");
      else ok("a product price renders");
    } finally { await browser.close(); }
  } catch (e) { bad("rendered check", e.message.slice(0, 140)); }
}

if (failures) {
  console.error(`\n✗ SMOKE TEST FAILED — ${failures} check(s). A deploy that fails this must be rolled back or fixed NOW: real people see this page.\n`);
  process.exit(1);
}
console.log("\n✓ smoke test: site + feed + rendered app all healthy");
