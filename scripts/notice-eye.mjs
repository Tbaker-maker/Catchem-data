import { readFile } from "node:fs/promises";
// NOTICE IS THE EYE. If the observation register only talks about attack
// names, the tower is three facts against forty. This loads the shipped
// editor, asks it for lines over real tray cards, and counts how many
// DISTINCT printed fields those observations name. A regression to
// attack-only fails the build.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, scrollIntoView(){}, appendChild(){}, getContext:()=>null, setAttribute(){} };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},getContext:()=>null,get outerHTML(){return""}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.AbortSignal = { timeout:()=>null };
globalThis.fetch = async () => { throw new TypeError("x"); };
const api = new Function(js + ";return { runAsk, tray:()=>tray, lineOptions };")();
await new Promise(r => setTimeout(r, 80));

const KINDS = [
  ["attack", /attack called/i],
  ["artist", /drew /i],
  ["hp", /\bHP\b/],
  ["type", / type/i],
  ["weakness", /weak to /i],
  ["lore", / says /i],
  ["connecting", /one picture/i],
  ["stage", /Basic|Stage \d/],
  ["evolves", /evolves from/i],
  ["price", /listed around/i],
  ["era", /vintage|modern|Sun & Moon|next to/i],
  ["region", /Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos|Alola|Galar|Paldea|Hisui/],
  ["set", / next to | are from /i],
  ["years", /years apart/i],
  ["body", /cards in this catalogue/i],
];

const PROMPTS = [
  "the whole charmander line",
  "squirtle evolution",
  "connecting art",
  "what kimura drew twice",
];

console.log("NOTICE — DISTINCT FIELDS NAMED:\n");
let failed = 0;
for (const p of PROMPTS) {
  api.runAsk(p);
  const tray = api.tray();
  const lines = (api.lineOptions(tray) || []).filter(o => o.reg === "observation").map(o => o.text);
  const kinds = KINDS.filter(([, rx]) => lines.some(t => rx.test(t))).map(([k]) => k);
  const ok = kinds.length >= 3;
  if (!ok) failed++;
  console.log("  " + (ok ? "✓" : "✗") + " " + p);
  console.log("     " + kinds.join(", ") + (kinds.length ? "" : "(none)"));
  if (lines[0]) console.log("     e.g. " + lines[0].slice(0, 110));
}

if (failed) {
  console.log("\n✗ NOTICE only sees " + failed + " prompt(s) with fewer than 3 field kinds — the eye is underusing the catalogue.");
  process.exit(1);
}
console.log("\n✓ every sampled tray produces observations from at least 3 printed fields");
