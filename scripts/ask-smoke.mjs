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

// SAYS ONE THING, SHOWS ANOTHER. Filling the tray is not enough: the cards must
// match what the reply claimed. "Showing Charizard" followed by Chansey is the
// Koga failure on a new surface — a wrong answer that reads as a right one.
const CLAIMS = [
  ["charizard evolution from 151", ["Charmander", "Charmeleon", "Charizard"], "151"],
  ["the charizard line from 151", ["Charmander", "Charmeleon", "Charizard"], "151"],
  ["pikachu cards", ["Pikachu"], null],
  ["cards from 151", null, "151"],
];
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
// Check every claim against the cards actually returned.
let lied = 0;
console.log("\nDOES IT SHOW WHAT IT SAID?\n");
for (const [prompt, mustInclude, mustSet] of CLAIMS) {
  try { api.runAsk(prompt); } catch {}
  const t = api.tray();
  const names = t.map(c => String(c.n));
  let bad = null;
  if (!t.length) bad = "no cards at all";
  else if (mustInclude && !mustInclude.some(m => names.some(n => n.indexOf(m) === 0))) bad = "claimed " + mustInclude.join("/") + ", showed " + names.join(", ");
  else if (mustSet && !t.every(c => c.s === mustSet)) bad = "claimed set " + mustSet + ", showed " + [...new Set(t.map(c => c.s))].join(", ");
  if (bad) lied++;
  console.log("  " + (bad ? "✗ " : "✓ ") + prompt + (bad ? "   " + bad : "   " + names.join(", ")));
}
if (lied) { console.error("\n✗ " + lied + " prompt(s) SAY one thing and SHOW another — a wrong answer that reads as a right one\n"); process.exitCode = 1; }

console.log("\n" + (noCards ? "✗ " + noCards + " of " + TESTS.length + " prompts leave the tray EMPTY — the box promises a post and hands back a filtered grid" : "✓ every prompt produces cards"));
