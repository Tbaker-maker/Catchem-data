// ── LIVE PAGE SMOKE — BLOCKING ─────────────────────────────────────────────
// Every guard we have tests the GENERATOR or the INDEX. None of them opens the
// page a stranger actually gets. On 2026-08-26 three launch blockers passed the
// entire suite and were found by loading the published URL in a fresh window:
//
//   · the tutorial never appeared for anyone who had used the tool before
//   · "connecting art" returned six Pokemon whose names share letters with
//     "art", because the 269 groups were never shipped to the page
//   · the boot banner told every visitor the art host was unreachable,
//     unconditionally, on every successful load
//
// So this loads https://tbaker-maker.github.io/... — the artifact, over the
// network, in a real browser — and asserts the four things a first visit must
// deliver. It is deliberately small: four checks that cannot be satisfied by
// anything except a working page.
//
// IT FAILS LOUDLY WHEN IT CANNOT RUN. A smoke test that skips when no browser
// is present is a green tick over an untested page, which is the exact failure
// this repo has logged six times.
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

// OVERRIDABLE SO IT CAN BE AIMED SOMEWHERE ELSE. negative-tests points this at
// example.com and requires a FAILURE — a smoke test that passes on a page which
// is not ours is not testing our page.
const URL = process.env.LIVE_PAGE_URL ||
  "https://tbaker-maker.github.io/Catchem-data/research/assets/build.html";

// Both paths the brief named, plus the ones this project actually runs on.
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].filter(Boolean);

async function findChrome() {
  for (const c of CANDIDATES) if (existsSync(c)) return c;
  // puppeteer-core's own resolver, which throws when nothing is installed.
  try {
    const p = await puppeteer.executablePath();
    if (p && existsSync(p)) return p;
  } catch { /* nothing installed for it to point at */ }
  return null;
}

const fail = (msg, detail) => {
  console.log(`  ✗ ${msg}`);
  if (detail) console.log(`      ${detail}`);
  return 1;
};

const chrome = await findChrome();
if (!chrome) {
  console.log("LIVE PAGE SMOKE\n");
  console.log("  ✗ no browser found. Tried:");
  for (const c of CANDIDATES) console.log("      " + c);
  console.log("\n  Set CHROME_PATH, or install one. This does NOT pass without a browser:");
  console.log("  a smoke test that skips is a green tick over an untested page.");
  process.exit(1);
}

console.log("LIVE PAGE SMOKE — the artifact a stranger gets\n");
console.log(`  browser: ${chrome}`);
console.log(`  url:     ${URL}\n`);

let failures = 0;
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();

  // A PAGE ERROR IS A FAILURE EVEN IF EVERYTHING ELSE LOOKS RIGHT. The const
  // that shadowed the search predicate threw on every query while the page
  // rendered perfectly on load.
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message).slice(0, 160)));

  // A fresh visitor: no storage, no cache.
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload({ waitUntil: "networkidle2", timeout: 90000 });
  await new Promise((r) => setTimeout(r, 3500));

  // 1 — the tutorial is visible on a fresh session
  const tut = await page.evaluate(() => {
    const el = document.getElementById("tut");
    return { present: !!el, hidden: el ? el.hidden : true,
      line: (document.getElementById("tutline") || {}).textContent || "",
      tray: (typeof tray !== "undefined") ? tray.length : -1 };
  });
  if (!tut.present || tut.hidden) failures += fail("the tutorial is not visible on a fresh session",
    `present=${tut.present} hidden=${tut.hidden}`);
  else console.log(`  ✓ tutorial visible · ${tut.tray} cards preloaded`);

  // 2 — at least two card images resolved to real bytes
  const imgs = await page.evaluate(async () => {
    const all = [...document.querySelectorAll("#res img, #tray img")];
    all.slice(0, 8).forEach((i) => { i.loading = "eager"; });
    await new Promise((r) => setTimeout(r, 3000));
    return { total: all.length, loaded: all.filter((i) => i.naturalWidth > 0).length };
  });
  if (imgs.loaded < 2) failures += fail("fewer than 2 card images loaded",
    `${imgs.loaded} of ${imgs.total} had naturalWidth > 0 — the art host may be unreachable`);
  else console.log(`  ✓ ${imgs.loaded} of ${imgs.total} card images resolved to real bytes`);

  // 3 — a conceptual query reaches a relation rather than name-fuzz
  const concept = await page.evaluate(() => {
    try {
      const r = askResolve("connecting art");
      if (!r) return { ok: false, why: "askResolve returned nothing" };
      const got = askCards(r);
      return { ok: got.cards.length > 1, rel: r.relation, n: got.cards.length };
    } catch (e) { return { ok: false, why: String(e.message).slice(0, 120) }; }
  });
  if (!concept.ok) failures += fail('"connecting art" did not resolve to a relation',
    concept.why || `${concept.rel} returned ${concept.n} cards`);
  else console.log(`  ✓ "connecting art" → ${concept.rel} · ${concept.n} cards`);

  // 4 — the evolution line every user will try first
  const evo = await page.evaluate(() => {
    try {
      runAsk("charmander evolution");
      return { names: tray.map((c) => c.n) };
    } catch (e) { return { names: [], why: String(e.message).slice(0, 120) }; }
  });
  const want = ["Charmander", "Charmeleon", "Charizard"];
  const got = evo.names.map((n) => String(n).replace(/^M\s+/, ""));
  const hasAll = want.every((w) => got.some((g) => g.indexOf(w) === 0));
  if (!hasAll) failures += fail('"charmander evolution" did not load the line',
    evo.why || `got: ${got.join(", ") || "(nothing)"}`);
  else console.log(`  ✓ "charmander evolution" → ${got.join(" → ")}`);

  if (pageErrors.length) {
    failures += fail(`${pageErrors.length} page error(s) while loading`, pageErrors[0]);
    for (const e of pageErrors.slice(1, 4)) console.log(`      ${e}`);
  } else console.log("  ✓ no page errors");
} finally {
  await browser.close();
}

console.log("");
if (failures) {
  console.log(`✗ LIVE PAGE SMOKE — ${failures} failure(s) on the PUBLISHED page.`);
  console.log("This tests the artifact a stranger gets, over the network. Every other");
  console.log("guard here tests the generator or the index; three launch blockers passed");
  console.log("all of them on 2026-08-26 and were caught only by loading this URL.");
  console.log("If the fix is already committed, GitHub Pages may not have deployed it yet.");
  process.exit(1);
}
console.log("✓ live page: tutorial shows, images load, concepts resolve, the line is right");
