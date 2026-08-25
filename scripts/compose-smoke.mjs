import { readFile } from "node:fs/promises";
// RUN THE COMPOSE. I have now grepped for variables twice and been wrong twice.
// The only reliable check is to execute the thing.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const drawn = [];
const ctx = { fillStyle:"", font:"", textAlign:"", globalAlpha:1, lineWidth:1, strokeStyle:"",
  fillRect(){}, fillText(t){ drawn.push("text:" + String(t).slice(0,26)); },
  drawImage(){ drawn.push("image"); }, measureText(t){ return { width: String(t).length * 26 }; },
  save(){}, restore(){}, translate(){}, rotate(){}, beginPath(){}, rect(){}, roundRect(){},
  fill(){}, stroke(){} };
const mk = id => nodes[id] ||= { id, innerHTML:"", value:"", textContent:"", hidden:false,
  style:{}, dataset:{}, width:0, height:0,
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, onclick:null,
  scrollIntoView(){}, appendChild(){}, getContext:()=>ctx, toBlob(cb){ cb({size:1}); } };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll:()=>[], querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}), createElement:()=>({ style:{}, click(){}, getContext:()=>ctx,
    setAttribute(){}, appendChild(){}, get outerHTML(){return "<div></div>"}, className:"", textContent:"" }),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value:{}, configurable:true });
globalThis.AbortSignal = { timeout: () => null };
globalThis.Image = function(){ const o={ crossOrigin:"" };
  Object.defineProperty(o,"src",{ set(v){ setTimeout(()=>o.onload && o.onload(), 1); } }); return o; };
globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };

const api = new Function(js + "\n;return { add:(id)=>add(id), make:()=>document.getElementById('make').onclick(), tray:()=>tray };")();
await new Promise(r => setTimeout(r, 80));

// Put four cards in and compose, exactly as a user would.
const ids = JSON.parse(js.match(/const CARD_ROWS = (\[[\s\S]*?\]);\n/)[1]).slice(0,4).map(r=>r[0]);
for (const id of ids) api.add(id);
console.log("tray size after 4 adds:", api.tray().length);

let err = null;
try { await api.make(); } catch (e) { err = e; }
await new Promise(r => setTimeout(r, 120));

console.log("compose threw:", err ? err.message.slice(0,100) : "no");
console.log("images drawn:", drawn.filter(d=>d==="image").length);
console.log("status message:", nodes.st?.textContent || "(none)");
