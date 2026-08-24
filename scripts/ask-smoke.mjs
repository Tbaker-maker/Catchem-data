import { readFile } from "node:fs/promises";
// DOES THE BOX ACTUALLY PRODUCE A POST? It says "What do you want to post?" and
// I never checked that it hands back CARDS rather than a filtered grid.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, onclick:null,
  scrollIntoView(){}, appendChild(){}, getContext:()=>null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  querySelector:(s)=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},getContext:()=>null,get outerHTML(){return""}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.AbortSignal = { timeout:()=>null };
globalThis.fetch = async () => { throw new TypeError("no network"); };
globalThis.confirm = () => true;

const api = new Function(js + "\n;return { runAsk, tray:()=>tray, label:()=>document.getElementById('label')?.value };")();
await new Promise(r => setTimeout(r, 60));

const TESTS = ["cards nobody talks about", "charizard through the years", "cute cards under a fiver",
  "two cards by the same artist", "something dark", "the whole charmander line",
  "psychic types", "wiped out", "arita", "151 set", "four cute cards"];
let noCards = 0;
console.log("DOES EACH PROMPT PRODUCE A POST?\n");
for (const t of TESTS) {
  let err = null;
  try { api.runAsk(t); } catch (e) { err = e.message.slice(0, 40); }
  const n = api.tray().length;
  if (!n) noCards++;
  console.log("  " + (n ? String(n) + " cards" : "NO CARDS").padEnd(9) + t + (err ? "   THREW: " + err : ""));
}
console.log("\n" + (noCards ? "✗ " + noCards + " of " + TESTS.length + " prompts leave the tray EMPTY — the box promises a post and hands back a filtered grid" : "✓ every prompt produces cards"));
