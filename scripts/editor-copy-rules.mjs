import { readFile } from "node:fs/promises";
// ATTACK 2: RUN THE EDITOR'S OWN OUTPUT THROUGH OUR PUBLISHING GUARDS. Every
// other surface we ship is checked by slop-guard, windowless-price-guard and
// the assertion rules. The editor generates text that goes straight onto a
// public timeline and NOTHING has ever checked it.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] ||= { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{},
  classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, onclick:null, scrollIntoView(){}, appendChild(){}, getContext:()=>null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null, querySelectorAll:()=>[],
  createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},getContext:()=>null,get outerHTML(){return""}}),
  createTextNode:()=>({}), addEventListener(){} };
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis,"navigator",{value:{},configurable:true});
globalThis.Image = function(){}; globalThis.AbortSignal = { timeout:()=>null };
globalThis.fetch = async () => { throw new TypeError("no network"); };
const api = new Function(js + `
;return { add, tray:()=>tray, setCount:(n)=>{fCount=n}, setTheme:(t)=>{fTheme=t}, buildIdeas,
  ideas:()=>window.__ideas, lineOptions, THEMES:()=>THEMES, MOODS:()=>MOODS, INDEX:()=>INDEX, remove };`)();
await new Promise(r => setTimeout(r, 60));

// The rules every other published surface obeys.
const RULES = [
  [/\b(best|worst|greatest|most underrated|underrated|slept on|overlooked|top \d|definitive|essential|must-have)\b/i,
   "ASSERTS significance — a superlative closes the conversation by being agreed with or wrong"],
  [/\bPSA\s*\d|\bBGS\s*\d|graded (at|a) \d/i, "names a GRADE — we do not predict grades"],
  [/\bguaranteed\b|\bwill be worth\b|\bwill go up\b|\binvest\b/i, "makes a FINANCIAL claim"],
  [/undefined|NaN|\[object|null\b/i, "leaked a JS value into copy"],
];
const problems = [];
const check = (where, s) => { if (!s) return;
  // A superlative inside a QUESTION is the opposite of an assertion — asking
  // which is definitive invites an answer, stating it invites a correction.
  // Third time I have caught a word and missed the form.
  const isQuestion = /\?\s*$/.test(s.trim());
  for (const [rx, why] of RULES) { if (!rx.test(s)) continue; if (isQuestion && /ASSERTS/.test(why)) continue; problems.push(where + ": " + why + "  → " + s.slice(0, 70)); } };

// Every theme, every count, every generated hook and line.
let checked = 0;
for (const t of api.THEMES()) {
  for (const n of (t.bestAt ?? [2])) {
    api.setTheme(t.id); api.setCount(n);
    try { api.buildIdeas(); } catch { continue; }
    for (const idea of (api.ideas() ?? [])) {
      check("theme " + t.id + " hook", idea.hook);
      check("theme " + t.id + " title", idea.title);
      checked += 2;
      if (idea.cards?.length) {
        for (const o of api.lineOptions(idea.cards, t.name)) { check("line [" + o.label + "]", o.text); checked++; }
      }
    }
  }
}
// Every mood line too.
for (const m of api.MOODS()) { check("mood " + m.id, m.say); checked++; }

console.log(`checked ${checked} generated strings across ${api.THEMES().length} themes and ${api.MOODS().length} moods`);
console.log(problems.length ? "\n✗ PUBLISHING RULES — " + problems.length + " violation(s):\n" : "\n✓ every generated string obeys the rules our other surfaces obey");
for (const p of [...new Set(problems)].slice(0, 10)) console.log("   " + p);
