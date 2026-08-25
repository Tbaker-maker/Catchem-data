// prompt-correctness.mjs — do the prompts return the RIGHT cards?
//
// Tyler, 2026-08-24: "It's still showing the wrong cards. How do we keep coming
// into this problem?"
//
// BECAUSE ask-smoke ONLY CHECKED THAT CARDS APPEARED. I wrote the gap into its
// own blind-spot file — "it has no view on whether 'something dark' returned
// anything actually dark" — and then trusted the green tick anyway. This is
// that gap, closed.
//
// Every case asserts a property the OUTPUT must have, not merely that output
// exists. A prompt naming a Pokémon must return that Pokémon. A prompt naming a
// type must return that type. Trainers never appear unless asked for.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(join(ROOT, "research/assets/build.html"), "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const mk = id => ({ id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, scrollIntoView(){}, appendChild(){}, getContext:()=>null, click(){} });
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},getContext:()=>null,get outerHTML(){return"";}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.fetch = async () => { throw new TypeError("x"); };
globalThis.AbortSignal = { timeout:()=>null }; globalThis.confirm = () => true;

const api = new Function(js + ";return {runAsk, tray:()=>tray, monName, ATTRS:()=>ATTRS};")();
await new Promise(r => setTimeout(r, 80));
const ATTRS = api.ATTRS();

// EACH CASE ASSERTS A PROPERTY OF THE OUTPUT. That is the difference between
// this and ask-smoke, and the difference is the whole bug.
const CASES = [
  { ask: "charizard through the years",
    must: cs => cs.every(c => api.monName(c.n) === "Charizard"),
    say: "every card is a Charizard" },
  { ask: "psychic types",
    must: cs => cs.every(c => (ATTRS[c.i]?.t || []).includes("Psychic")),
    say: "every card is printed Psychic" },
  { ask: "fire types",
    must: cs => cs.every(c => (ATTRS[c.i]?.t || []).includes("Fire")),
    say: "every card is printed Fire" },
  { ask: "cards nobody talks about",
    must: cs => cs.every(c => ATTRS[c.i]?.dex),
    say: "no Trainers — every card is a Pokémon" },
  { ask: "cute cards under a fiver",
    must: cs => cs.length > 0,
    differsFrom: "something dark",
    say: "cute and dark return different cards" },
  { ask: "two cards by arita",
    must: cs => cs.length === 2,
    say: "exactly two cards" },
  { ask: "four cute cards",
    must: cs => cs.length === 4,
    say: "exactly four cards" },
];

const problems = [];
for (const c of CASES) {
  let got = [];
  try { api.runAsk(c.ask); got = api.tray().slice(); } catch (e) { problems.push(`"${c.ask}" THREW: ${e.message.slice(0,50)}`); continue; }
  if (!got.length) { problems.push(`"${c.ask}" returned nothing`); continue; }
  if (!c.must(got)) problems.push(`"${c.ask}" → ${c.say} FAILED: ${got.map(x=>x.n).join(", ")}`);
  if (c.differsFrom) {
    let other = [];
    try { api.runAsk(c.differsFrom); other = api.tray().slice(); } catch (e) {}
    const same = got.length === other.length && got.every((x,i) => x.i === other[i]?.i);
    if (same) problems.push(`"${c.ask}" and "${c.differsFrom}" returned IDENTICAL cards — a filter is being silently skipped`);
  }
}

if (problems.length) {
  console.error(`\n✗ PROMPT CORRECTNESS — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error("   " + p);
  console.error(`\n   ask-smoke passes on all of these. It only checks cards APPEAR.\n`);
  process.exitCode = 1;
} else {
  console.log(`✓ prompt correctness: ${CASES.length} cases, every one returns cards matching what was asked`);
}
