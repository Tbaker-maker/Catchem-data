import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const mk = id => ({ id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, appendChild(){}, getContext:()=>null, scrollIntoView(){}, click(){} });
globalThis.document={getElementById:id=>present.has(id)?mk(id):null,querySelectorAll:()=>[],
  querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},getContext:()=>null,get outerHTML(){return"";}}),
  createTextNode:()=>({}),addEventListener(){}};
globalThis.window=globalThis; globalThis.addEventListener=()=>{};
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image=function(){}; globalThis.fetch=async()=>{throw new TypeError("x")};
globalThis.AbortSignal={timeout:()=>null}; globalThis.confirm=()=>true;
const api=new Function(js+";return {runAsk,tray:()=>tray,monName,ATTRS:()=>ATTRS,parseIntent,intentCtx};")();
await new Promise(r=>setTimeout(r,80));
const ATTRS=api.ATTRS();

// EVERY PROMPT A REAL PERSON MIGHT TYPE, not the eleven I invented. Grouped by
// what they're trying to do, because a category that fails entirely is worse
// than a scattered miss.
const GROUPS = {
  "the six example chips": ["cards nobody talks about","charizard through the years","cute cards under a fiver","two cards by the same artist","something dark","the whole charmander line"],
  "naming a Pokémon": ["pikachu","show me mewtwo","gengar cards","four eevee cards","umbreon","magikarp","snorlax please"],
  "naming a type": ["fire types","water cards","psychic types","dragon","grass pokemon","metal type cards"],
  "naming an artist": ["arita","cards by mitsuhiro arita","ken sugimori","kouki saitou art"],
  "naming a set": ["base set","151","evolving skies","team rocket","celebrations cards"],
  "a feeling": ["cute","funny cards","something dark","beautiful art","wholesome","creepy"],
  "money": ["cheap cards","expensive cards","grails","cards under a fiver","budget picks"],
  "a shape": ["evolution line","power creep","same artist years apart","the whole eevee line","lore"],
  "vague or rude": ["idk","something good","surprise me","best cards","pokemon","asdfgh","","cards"],
  "mixed": ["four cheap cute fire cards","two dark charizards","three psychic cards by arita","charizard and pikachu"],
};

let total=0, empty=0, wrong=0;
const problems=[];
for (const [group, prompts] of Object.entries(GROUPS)) {
  let bad=0;
  for (const p of prompts) {
    total++;
    let got=[];
    try { api.runAsk(p); got=api.tray().slice(); }
    catch(e) { problems.push(`[${group}] "${p}" THREW ${e.message.slice(0,44)}`); bad++; continue; }
    if (!got.length) { if (p.trim()) { problems.push(`[${group}] "${p}" returned NOTHING`); empty++; bad++; } continue; }
    // Correctness where we can assert it.
    const parsed=api.parseIntent(p, api.intentCtx());
    if (parsed?.mon && !got.every(c=>api.monName(c.n)===parsed.mon)) { problems.push(`[${group}] "${p}" → asked ${parsed.mon}, got ${got.map(c=>c.n).join(", ")}`); wrong++; bad++; }
    else if (parsed?.type && !got.every(c=>(ATTRS[c.i]?.t||[]).includes(parsed.type))) { problems.push(`[${group}] "${p}" → asked ${parsed.type}, got ${got.map(c=>c.n).join(", ")}`); wrong++; bad++; }
    else if (parsed?.artist && !got.every(c=>c.a===parsed.artist)) { problems.push(`[${group}] "${p}" → asked ${parsed.artist}, got ${got.map(c=>c.a).join(", ")}`); wrong++; bad++; }
    else if (parsed?.count && got.length!==parsed.count) { problems.push(`[${group}] "${p}" → asked ${parsed.count}, got ${got.length}`); wrong++; bad++; }
  }
  console.log(`  ${bad?"✗":"ok"}  ${group.padEnd(24)}${prompts.length - bad}/${prompts.length}`);
}
console.log(`\n${total} prompts · ${empty} empty · ${wrong} wrong\n`);
for (const p of problems.slice(0,20)) console.log("   " + p);

// EXIT NON-ZERO ON FAILURE, or the pipeline cannot gate on it — a check that
// reports a problem and exits clean is a check nobody acts on.
if (typeof problems !== "undefined" && problems.length) process.exitCode = 1;
if (typeof fails !== "undefined" && fails.length) process.exitCode = 1;
if (typeof bad !== "undefined" && bad) process.exitCode = 1;
if (typeof wrong !== "undefined" && (wrong || empty)) process.exitCode = 1;
