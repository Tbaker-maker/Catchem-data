import { readFile } from "node:fs/promises";
// EVERY THEME MUST PRODUCE, AND NO TWO MAY PRODUCE THE SAME THING. Tyler found
// both faults by clicking; nothing checked either.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] ||= { id, innerHTML: "", value: "", textContent: "", hidden: false,
  style: {}, dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
  querySelectorAll: () => [], querySelector: () => null, addEventListener(){}, onclick: null,
  scrollIntoView(){}, appendChild(){}, getContext: () => null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll: () => [], querySelector: (sel) => ({ querySelectorAll: () => [], addEventListener(){}, onclick: null, classList:{toggle(){},add(){},remove(){},contains(){return false}} }), createElement: () => ({ style:{}, click(){}, getContext:()=>null,
    setAttribute(){}, appendChild(){}, get outerHTML(){ return "<div class='empty'></div>"; } }),
  createTextNode: () => ({}), addEventListener(){} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
globalThis.Image = function(){};
globalThis.AbortSignal = { timeout: () => null };
globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };

const api = new Function(js + "\n;return { THEMES, buildIdeas, setTheme:(id,n)=>{ fTheme=id; fCount=n; }, ideas:()=>window.__ideas };")();
await new Promise(r => setTimeout(r, 60));

const results = {}, fails = [];
for (const t of api.THEMES) {
  let produced = 0, sig = null;
  for (const n of (t.bestAt ?? [2, 4])) {
    api.setTheme(t.id, n);
    try { api.buildIdeas(); } catch (e) { fails.push(`${t.id} THREW at ${n}: ${e.message.slice(0, 50)}`); continue; }
    const ideas = api.ideas() ?? [];
    if (ideas.length) { produced += ideas.length; sig = sig ?? ideas.map(i => (i.cards ?? []).map(c => c.i).join("|")).join("//"); }
  }
  results[t.id] = { produced, sig, name: t.name };
  if (!produced) fails.push(`${t.name} (${t.id}) produces NOTHING at any of its own bestAt counts`);
}
// No two themes may return an identical set — that is the "two themes give the
// same results" fault, and it was invisible to everything we had.
const seen = {};
for (const [id, r] of Object.entries(results)) {
  if (!r.sig) continue;
  if (seen[r.sig]) fails.push(`${r.name} and ${results[seen[r.sig]].name} return IDENTICAL results`);
  else seen[r.sig] = id;
}
if (fails.length) { console.error(`\n✗ THEME SMOKE — ${fails.length} problem(s):\n`); for (const f of fails) console.error("   " + f); console.error(""); process.exitCode = 1; }
else console.log(`✓ theme smoke: ${api.THEMES.length} themes, every one produces, no two identical`);
