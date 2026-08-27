#!/usr/bin/env node
// LAUNCH GAUNTLET — the page a stranger gets, on the sizes they actually hold.
// A green tick here is not a claim about iOS Safari or Android Chrome. Those
// are not in this sandbox. This is Chromium + real viewports + touch flags,
// plus the feature battery that has already shipped a broken live page once.
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const URL = process.env.LIVE_PAGE_URL || "http://127.0.0.1:8080/";
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const VIEWPORTS = [
  { name: "iPhone SE", viewport: { width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: "iPhone 12", viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  { name: "iPhone 14 Pro Max", viewport: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
  { name: "Pixel 5", viewport: { width: 393, height: 851, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true } },
  { name: "iPad", viewport: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
  { name: "laptop", viewport: { width: 1280, height: 800, deviceScaleFactor: 1, isMobile: false, hasTouch: false } },
  { name: "desktop", viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false } },
];

function chromePath() {
  for (const c of CANDIDATES) if (existsSync(c)) return c;
  return null;
}

const fail = [];
const ok = [];
function check(name, cond, detail) {
  if (cond) ok.push(name);
  else fail.push(name + (detail ? " — " + detail : ""));
}

const chrome = chromePath();
if (!chrome) {
  console.error("✗ no browser");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

console.log("LAUNCH GAUNTLET\n  url: " + URL + "\n  browser: " + chrome + "\n");

// Duplicate bindings in the shipped page are how the live editor went white.
const htmlProbe = await (await fetch(URL)).text();
check("page is HTML", htmlProbe.includes("<!doctype html") || htmlProbe.includes("<html") || htmlProbe.includes("Catch'em"), "not html");
check("one shareImage", (htmlProbe.match(/async function shareImage/g) || []).length <= 1, String((htmlProbe.match(/async function shareImage/g) || []).length));
check("one copyImage", (htmlProbe.match(/async function copyImage/g) || []).length <= 1, String((htmlProbe.match(/async function copyImage/g) || []).length));
check("How many cards control", htmlProbe.includes('id="cardcount"'));
check("Save to Photos exists", htmlProbe.includes("Save to Photos"));
check("no Magikarp finisher", !/hid Magikarp in the middle/i.test(htmlProbe));
check("pickCaption shipped", htmlProbe.includes("function pickCaption"));

for (const p of VIEWPORTS) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
  await page.setViewport(p.viewport);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 400));
  const info = await page.evaluate(() => {
    const ask = document.getElementById("ask");
    const sel = document.getElementById("cardcount");
    const make = document.getElementById("make");
    const modes = document.getElementById("modes");
    const wrap = document.querySelector(".wrap");
    const r = wrap ? wrap.getBoundingClientRect() : { width: 0 };
    return {
      ask: !!(ask && ask.getBoundingClientRect().height > 0),
      sel: !!(sel && sel.options && sel.options.length >= 7),
      make: !!(make && make.getBoundingClientRect().height >= 40),
      modes: !!(modes && modes.querySelectorAll(".mode").length === 2),
      wrapW: Math.round(r.width),
      bodyOverflow: document.body.scrollWidth > document.documentElement.clientWidth + 2,
    };
  });
  check(p.name + " no pageerror", errors.length === 0, errors.join(" | "));
  check(p.name + " ask field", info.ask);
  check(p.name + " how-many select", info.sel);
  check(p.name + " make is tappable", info.make);
  check(p.name + " Post/Reply tabs", info.modes);
  check(p.name + " no horizontal overflow", !info.bodyOverflow, "scrollWidth wider than viewport");
  await page.close();
}

// Feature battery on iPhone 12 — the device this product has already failed on.
{
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));
  await page.setViewport(VIEWPORTS[1].viewport);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45000 });
  await new Promise((r) => setTimeout(r, 600));

  const feat = await page.evaluate(() => {
    const out = { errors: [] };
    function hit(name, cond, detail) {
      out[name] = !!cond;
      if (!cond) out.errors.push(name + (detail ? ": " + detail : ""));
    }
    try {
      applyCount(1, false);
      hit("count 1", typeof fCount === "number" && fCount === 1, String(fCount));
      runAsk("squirtle evolution");
      hit("evo 3 stages", tray.length >= 3, tray.map((c) => c.n).join(","));
      applyCount(2, false);
      runAsk("connecting art");
      hit("connecting 2+", tray.length >= 2, String(tray.length));
      applyCount(9, true);
      hit("connecting 9", tray.length === 9, String(tray.length));
      hit("Palossand in 9", tray.some((c) => /Palossand/i.test(c.n)), tray.map((c) => c.n).join(","));
      fillLineFromCards(true);
      const lab = (document.getElementById("label") || {}).value || "";
      hit("caption names a card", tray.some((c) => lab.indexOf(c.n) >= 0) || /HYOGONOSUKE/i.test(lab), lab);
      hit("caption is not the count skeleton", !/^(two|three|nine) cards/i.test((lab || "").trim()), lab);
      const pre = document.querySelector("#selfreply pre");
      const reply = (pre && pre.textContent) || "";
      hit("self-reply is a map", /Mime Jr/i.test(reply) && /Horsea/i.test(reply) && /which piece/i.test(reply), reply.slice(0, 180));
      if (typeof anotherSet === "function") {
        const before = tray.map((c) => c.i).join(",");
        anotherSet();
        hit("Another changes 9-card set or stays valid", tray.length >= 2, String(tray.length));
        if (typeof backSet === "function") backSet();
        hit("Back restores", tray.map((c) => c.i).join(",") === before, tray.map((c) => c.n).join(","));
      }
      if (typeof setMode === "function") {
        setMode("reply");
        hit("reply mode", document.body.getAttribute("data-mode") === "reply");
        const cta = document.getElementById("cta");
        hit("cta box", !!(cta && cta.getBoundingClientRect().height > 0));
        applyCount(1, false);
        if (typeof answerCta === "function") {
          answerCta("Show me a better Charizard below (Blaine's Charizard is not allowed)");
          hit("cta one card default", tray.length === 1, tray.length + " " + tray.map((c) => c.n).join(","));
          hit("cta not Blaine", tray.every((c) => !/^Blaine/i.test(c.n)), tray.map((c) => c.n).join(","));
        }
        setMode("post");
      }
      const n = document.getElementById("cardcount");
      hit("select has 1,2,3,4,6,8,9", n && ["1","2","3","4","6","8","9"].every((v) => [...n.options].some((o) => o.value === v)));
    } catch (e) {
      out.errors.push("threw: " + e.message);
    }
    return out;
  });
  check("feature battery no pageerror", errors.length === 0, errors.join(" | "));
  for (const e of feat.errors || []) fail.push("iphone12 " + e);
  for (const k of Object.keys(feat)) {
    if (k === "errors") continue;
    if (feat[k]) ok.push("iphone12 " + k);
  }
  await page.close();
}

await browser.close();

console.log("");
for (const s of ok) console.log("  ✓ " + s);
console.log("");
if (fail.length) {
  console.log("✗ LAUNCH GAUNTLET — " + fail.length + " failure(s):\n");
  for (const f of fail) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("✓ launch gauntlet: " + ok.length + " checks, none failed");
console.log("  not claimed: real iOS Safari, real Android Chrome, Mac Safari. Chromium viewports only.");
