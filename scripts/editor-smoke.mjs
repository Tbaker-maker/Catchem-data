import { readFile } from "node:fs/promises";
// SIMULATE THE BROWSER. Every failure today shipped because I verified the file
// PARSES and never verified it WORKS. Parsing is necessary and nowhere near
// sufficient - the theme list rendered empty on a page that parsed perfectly.
const html = await readFile("research/assets/build.html", "utf8");
const idx = JSON.parse(await readFile("research/assets/card-index.json", "utf8"));
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Minimal DOM good enough to run the load path.
const nodes = {};
const mk = (id) => nodes[id] ||= { id, innerHTML: "", value: "", textContent: "", hidden: false,
  style: {}, dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  querySelectorAll: () => [], addEventListener(){}, onclick: null, onchange: null,
  scrollIntoView(){}, appendChild(){} };
for (const id of ["q","rar","yr","res","tray","st","label","make","copy","share","dl","cv","plabel",
  "fset","fcount","ftheme","ideas","refuse","tally","streakbar","streakstart","sfilter","sper","fintent","fslab"]) mk(id);

globalThis.document = { getElementById: (id) => nodes[id] ?? null,
  querySelectorAll: () => [], createElement: () => ({ style:{}, getContext: () => null, click(){} }) };
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
globalThis.AbortSignal = { timeout: () => null };
globalThis.Image = function(){};
let fetched = false;
globalThis.fetch = async () => { fetched = true; return { ok: true, json: async () => idx }; };

let err = null;
try { new Function(js)(); } catch (e) { err = e; }
await new Promise(r => setTimeout(r, 60));   // let the fetch .then run

const fails = [];
if (err) fails.push("the emitted script THREW: " + err.message.slice(0, 80));
if (!fetched) fails.push("the card index was never fetched");
if (nodes.res.innerHTML.length < 200) fails.push("the results panel is empty on load — the user sees nothing and cannot tell it from broken");
if (!nodes.ftheme.innerHTML.includes("chip")) fails.push("no theme chips rendered — themes filter against an INDEX that is still empty when they render");
if ((nodes.res.innerHTML.match(/<img/g) || []).length < 5) fails.push("fewer than 5 images on load");

if (fails.length) {
  console.error("\n✗ EDITOR SMOKE — the page parses and does not work:\n");
  for (const f of fails) console.error("   " + f);
  console.error("\n   Parsing is necessary and nowhere near sufficient. Every editor failure\n   this week shipped because it was verified to PARSE and never to WORK.\n");
  process.exitCode = 1;
} else {
  console.log(`✓ editor smoke: loads clean · ${(nodes.res.innerHTML.match(/<img/g)||[]).length} cards, ${(nodes.ftheme.innerHTML.match(/data-t=/g)||[]).length} themes on screen`);
}
