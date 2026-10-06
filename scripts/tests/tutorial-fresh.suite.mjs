// tutorial-fresh.suite.mjs — a fresh visitor to the editor sees the tutorial.
//
// 2026-10-06: the live page check found #tut present but hidden for every
// fresh session, at every width. Two defects were stacked:
//   · tutStart() runs while the page is still parsing, before paper-rows.json
//     arrives. The tutorial's cards were not shipped inline, so tutStart() saw
//     them as "missing" and returned without a word. Nothing retried it.
//   · bootReady(), called on the very next line, set #tut.hidden = true. Any
//     tutorial that did get shown was hidden in the same tick.
// The only check that saw this was live-page-smoke, which runs after the data
// has been published and is allowed to fail. This one runs in the fail-fast
// gate against the committed build.html, served from disk in headless Chrome
// with a clean profile, at desktop (1280) and phone (390) widths:
//   1. a fresh session shows the tutorial before the catalogue fetch lands
//      (the fetch is held back on purpose), and it is still up once it lands;
//   2. dismissing it keeps #tut hidden on reload. A returning visitor gets the
//      cards and the separate #tutback note, never the tutorial again;
//   3. "Show me how again" brings the tutorial back;
//   4. a paper-rows.json older than build.html (missing the tutorial's cards)
//      still gets a tutorial.
// No browser is a FAILURE, not a skip. That is this repo's rule for smoke tests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ASSETS = process.env.TUTORIAL_ASSETS_DIR || join(ROOT, "research/assets");
const CHROMES = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
const TYPES = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };
const CATALOGUE_DELAY_MS = 6000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail++; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };
  const chrome = CHROMES.find((c) => existsSync(c));
  if (!chrome) { t("a browser is installed (set CHROME_PATH)", false, "tried " + CHROMES.join(", ")); return fail; }
  let puppeteer;
  try { puppeteer = (await import("puppeteer-core")).default; }
  catch (e) { t("puppeteer-core is installed", false, e.message); return fail; }

  const html = await readFile(join(ASSETS, "build.html"), "utf8");
  const tutCards = JSON.parse((html.match(/var TUT_CARDS = (\[[^\]]*\]);/) || [])[1] || "[]");
  t("build.html names its tutorial cards", tutCards.length === 2, JSON.stringify(tutCards));

  // The server can hold the catalogue back (the race), or serve a catalogue
  // that is missing the tutorial's cards (stale paper-rows.json).
  const mode = { delayMs: 0, dropIds: [] };
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
    if (path.includes("..")) { res.writeHead(400); return res.end(); }
    try {
      let body = await readFile(join(ASSETS, path || "build.html"));
      if (/^(paper|pocket)-rows\.json$/.test(path)) {
        if (mode.delayMs) await sleep(mode.delayMs);
        if (path === "paper-rows.json" && mode.dropIds.length)
          body = JSON.stringify(JSON.parse(body).filter((r) => !mode.dropIds.includes(r[0])));
      }
      res.writeHead(200, { "content-type": TYPES[path.slice(path.lastIndexOf("."))] || "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const URL0 = `http://127.0.0.1:${server.address().port}/build.html`;

  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const VIEWPORTS = [["1280", { width: 1280, height: 900 }],
    ["390", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]];
  const state = (page) => page.evaluate(() => {
    const vis = (id) => { const e = document.getElementById(id); if (!e || e.hidden) return false;
      const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).display !== "none"; };
    return { tut: vis("tut"), back: vis("tutback"),
      line: (document.getElementById("tutline") || {}).textContent || "",
      tray: typeof tray !== "undefined" && tray ? tray.length : -1,
      rowsLoaded: typeof CARD_ROWS !== "undefined" && CARD_ROWS ? CARD_ROWS.length : 0 };
  });
  try {
    for (const [w, vp] of VIEWPORTS) {
      // A clean profile per width: no localStorage, no cache, no cookies.
      const ctx = await browser.createBrowserContext();
      const page = await ctx.newPage();
      await page.setViewport(vp);
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
      // Only our own server. Fonts and card art are not what this tests, and a
      // third-party host being slow must not decide it.
      await page.setRequestInterception(true);
      page.on("request", (r) => (r.url().startsWith("http://127.0.0.1:") || r.url().startsWith("data:")) ? r.continue() : r.abort());

      mode.delayMs = CATALOGUE_DELAY_MS; mode.dropIds = [];
      await page.goto(URL0, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(1500);
      const early = await state(page);
      t(`${w}: a fresh session shows the tutorial before the catalogue has loaded`,
        early.tut && early.line.trim().length > 0 && early.tray === tutCards.length && !early.back,
        JSON.stringify(early));
      await sleep(CATALOGUE_DELAY_MS + 1500);
      const landed = await state(page);
      t(`${w}: the tutorial is still up once the catalogue lands`,
        landed.tut && landed.rowsLoaded > 1000 && landed.tray === tutCards.length, JSON.stringify(landed));

      mode.delayMs = 0;
      await page.evaluate(() => document.getElementById("tutskip")?.click());
      const skipped = await state(page);
      t(`${w}: Skip hides the tutorial and keeps the cards`, !skipped.tut && skipped.tray === tutCards.length, JSON.stringify(skipped));
      await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2500);
      const back = await state(page);
      t(`${w}: after dismissing, a reload keeps the tutorial hidden (cards and the returning note instead)`,
        !back.tut && back.back && back.tray === tutCards.length, JSON.stringify(back));
      await page.evaluate(() => document.getElementById("tutagain")?.click());
      const again = await state(page);
      t(`${w}: "Show me how again" brings the tutorial back`, again.tut && !again.back, JSON.stringify(again));
      await ctx.close();

      // A published paper-rows.json older than build.html, missing the
      // tutorial's cards, must not take the tutorial away.
      const ctx2 = await browser.createBrowserContext();
      const p2 = await ctx2.newPage();
      await p2.setViewport(vp);
      p2.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
      await p2.setRequestInterception(true);
      p2.on("request", (r) => (r.url().startsWith("http://127.0.0.1:") || r.url().startsWith("data:")) ? r.continue() : r.abort());
      mode.dropIds = tutCards.slice();
      await p2.goto(URL0, { waitUntil: "domcontentloaded", timeout: 60000 });
      await sleep(2500);
      const stale = await state(p2);
      t(`${w}: a catalogue file missing the tutorial's cards still gets the tutorial`,
        stale.tut && stale.tray === tutCards.length && stale.rowsLoaded > 1000, JSON.stringify(stale));
      mode.dropIds = [];
      await ctx2.close();
      t(`${w}: no page errors`, errors.length === 0, errors.slice(0, 3).join(" | "));
    }
  } finally {
    await browser.close();
    server.close();
  }
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("tutorial-fresh.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("tutorial fresh ok");
}
