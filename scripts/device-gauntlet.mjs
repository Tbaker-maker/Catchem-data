// device-gauntlet.mjs — six browsers that hate you.
//
// Tyler, 2026-08-24: "fix that bug on the editor and ensure it works on mobile
// and pc. Get the agents to try and use and break it."
//
// THE GAP THIS FILLS: every smoke so far runs in ONE simulated environment —
// mine, which is friendly. Tyler's phone says "script error" and mine says
// green, which means the difference IS the environment. So this runs the real
// emitted script in six profiles modelled on how actual browsers fail:
//
//   private-ios     localStorage.setItem THROWS (iOS private browsing does this)
//   no-storage      localStorage does not exist at all
//   no-apis         no clipboard, no share, no confirm — old or locked-down
//   dead-network    fetch rejects and images never call back
//   no-observers    no matchMedia, ResizeObserver, IntersectionObserver
//   worst-case      all of the above at once
//
// A profile PASSES if the script parses, boots, and every prompt still produces
// cards. Degrading is fine — a feature politely unavailable is fine — CRASHING
// is the failure, because a crash on boot is a blank page and a one-star rating.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const html = await readFile(join(ROOT, "research/assets/build.html"), "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

function makeDom() {
  const nodes = {};
  const mk = id => nodes[id] = nodes[id] || { id, innerHTML: "", value: "", textContent: "", hidden: false,
    style: {}, dataset: {}, disabled: false,
    classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
    querySelectorAll: () => [], querySelector: () => null, addEventListener(){}, onclick: null,
    scrollIntoView(){}, appendChild(){}, removeChild(){}, getContext: () => null, click(){}, focus(){} };
  return {
    getElementById: id => present.has(id) ? mk(id) : null,
    querySelectorAll: () => [],
    querySelector: () => ({ querySelectorAll: () => [], addEventListener(){}, onclick: null,
      classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } } }),
    createElement: () => ({ style: {}, className: "", textContent: "", hidden: false, disabled: false,
      setAttribute(){}, appendChild(){}, click(){}, addEventListener(){}, onclick: null,
      getContext: () => null, get outerHTML(){ return ""; } }),
    createTextNode: () => ({}), addEventListener(){}, body: mk("__body"),
  };
}

// Each profile builds the globals a real failing browser would give us.
const PROFILES = {
  "private-ios": (g) => {
    // iOS private browsing: getItem works, setItem THROWS QuotaExceededError.
    // This is the classic invisible killer — works on every dev machine, dies
    // on the first real phone.
    g.localStorage = { getItem: () => null, removeItem(){}, 
      setItem(){ const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; } };
  },
  "no-storage": (g) => { delete g.localStorage; },
  "no-apis": (g) => {
    Object.defineProperty(g, "navigator", { value: {}, configurable: true });
    delete g.confirm; delete g.ClipboardItem;
  },
  "dead-network": (g) => {
    g.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    g.Image = function(){ /* callbacks never fire — a hung CDN */ };
  },
  "no-observers": (g) => {
    delete g.matchMedia; delete g.ResizeObserver; delete g.IntersectionObserver; delete g.visualViewport;
  },
  "worst-case": (g) => {
    for (const p of ["private-ios", "no-apis", "dead-network", "no-observers"]) PROFILES[p](g);
  },
};

const PROMPTS = ["cards nobody talks about", "charizard through the years", "four cute cards"];
const results = [];

for (const [name, apply] of Object.entries(PROFILES)) {
  // Fresh globals per profile — leakage between profiles would test nothing.
  const g = globalThis;
  g.document = makeDom();
  g.window = g; g.addEventListener = () => {};
  g.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
  Object.defineProperty(g, "navigator", { value: { clipboard: { write: async () => {} }, canShare: () => false }, configurable: true });
  g.Image = function(){ setTimeout(() => { if (this.onerror) this.onerror(); }, 0); };
  g.fetch = async () => { throw new TypeError("no network"); };
  g.confirm = () => true; g.ClipboardItem = function(){};
  g.AbortSignal = { timeout: () => null };
  g.matchMedia = () => ({ matches: false, addEventListener(){} });
  apply(g);

  let boot = null, prompts = 0, threw = null;
  try {
    const api = new Function(js + "\n;return { runAsk: typeof runAsk !== 'undefined' ? runAsk : null, tray: () => typeof tray !== 'undefined' ? tray : [] };")();
    await new Promise(r => setTimeout(r, 80));
    boot = "parsed and booted";
    if (api.runAsk) for (const p of PROMPTS) {
      try { api.runAsk(p); if (api.tray().length) prompts++; }
      catch (e) { threw = threw ?? (p + " → " + e.message.slice(0, 60)); }
    }
  } catch (e) { threw = "BOOT: " + e.message.slice(0, 70); }

  const ok = boot && !threw && prompts === PROMPTS.length;
  results.push({ profile: name, ok, boot: !!boot, prompts: prompts + "/" + PROMPTS.length, threw });
}

let bad = 0;
console.log("\nDEVICE GAUNTLET — the emitted script in six hostile browsers\n");
for (const r of results) {
  if (!r.ok) bad++;
  console.log(`  ${r.ok ? "ok " : "✗  "} ${r.profile.padEnd(14)} ${r.boot ? "boots" : "DEAD"} · prompts ${r.prompts}${r.threw ? " · " + r.threw : ""}`);
}
await writeFile(join(ROOT, "data/device-gauntlet.json"), JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 1));
console.log(bad
  ? `\n✗ gauntlet: ${bad} profile(s) fail — a crash in any of these is a blank page on a real device\n`
  : `\n✓ gauntlet: all six hostile profiles boot and every prompt produces cards\n`);
if (bad) process.exitCode = 1;
