import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, appendChild(){}, getContext:()=>null, scrollIntoView(){}, click(){} };
globalThis.document={getElementById:id=>present.has(id)?mk(id):null,querySelectorAll:()=>[],
  querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},getContext:()=>null,get outerHTML(){return"";}}),
  createTextNode:()=>({}),addEventListener(){}};
globalThis.window=globalThis; globalThis.addEventListener=()=>{};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image=function(){}; globalThis.fetch=async()=>{throw new TypeError("x")};
globalThis.AbortSignal={timeout:()=>null}; globalThis.confirm=()=>true;
const api=new Function(js+";return {HOOKS:()=>LIVE_HOOKS, byIdRow:()=>byIdRow};")();
await new Promise(r=>setTimeout(r,80));

// EVERY HOOK MUST LOAD ITS CARDS. A hook that names two cards and produces an
// empty tray is worse than no hook — it looks like a broken tool at the exact
// moment somebody trusted it.
const HOOKS = api.HOOKS(), rows = api.byIdRow();
let dead = 0, noPrice = 0;
for (const h of HOOKS) {
  const cards = h.shots.map(i => rows[i]).filter(Boolean);
  if (cards.length !== h.shots.length) { dead++; if (dead <= 3) console.log("   ✗ " + h.hook + " → card missing"); }
  // A price claim whose card has no price would read as broken.
  if (/\$/.test(h.hook) && cards.some(c => !c.p)) { noPrice++; if (noPrice <= 3) console.log("   ✗ " + h.hook + " → a card in it has no price"); }
}
console.log(`\n  ${HOOKS.length} hooks · ${dead} with a missing card · ${noPrice} claiming a price the card lacks`);
console.log(`  ${dead || noPrice ? "✗ FAILURES ABOVE" : "✓ every hook loads the exact cards it names"}`);

// EXIT NON-ZERO, or the pipeline cannot gate on it.
if (dead || noPrice) process.exitCode = 1;
