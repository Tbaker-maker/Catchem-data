import { readFile } from "node:fs/promises";
// ATTACK 1: THE HOSTILE USER. Every test so far has driven the editor the way I
// expect it to be driven. Nobody has tried to break it.
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
;return { add, remove, tray:()=>tray, setCount:(n)=>{fCount=n}, setTheme:(t)=>{fTheme=t},
  setSet:(s)=>{fSet=s}, buildIdeas, renderThemes, search, loadMood, render,
  setQuery:(q)=>{ document.getElementById("q").value=q; }, INDEX:()=>INDEX, THEMES:()=>THEMES, MOODS:()=>MOODS };`)();
await new Promise(r => setTimeout(r, 60));

const fails = [];
const t = (label, fn) => { try { fn(); } catch (e) { fails.push(label + " → THREW: " + e.message.slice(0, 70)); } };

// Things a real person does that I never tested.
t("add the same card ten times", () => { const id = api.INDEX()[0].i; for (let i=0;i<10;i++) api.add(id); });
t("remove from an empty tray", () => { while (api.tray().length) api.remove(0); api.remove(0); });
t("remove index 99", () => api.remove(99));
t("count of 5 (unsupported)", () => { api.setCount(5); api.buildIdeas(); });
t("count of 0", () => { api.setCount(0); api.buildIdeas(); });
t("count of 999", () => { api.setCount(999); api.renderThemes(); api.buildIdeas(); });
t("theme that does not exist", () => { api.setTheme("not-a-real-theme"); api.buildIdeas(); });
t("set that does not exist", () => { api.setSet("Not A Real Set"); api.setCount(2); api.renderThemes(); api.buildIdeas(); });
t("mood that does not exist", () => api.loadMood("not-a-mood"));
t("search for a single quote", () => { api.setQuery("'"); api.search(); });
t("search for a regex bomb", () => { api.setQuery("((((("); api.search(); });
t("search 500 chars", () => { api.setQuery("x".repeat(500)); api.search(); });
t("search an emoji", () => { api.setQuery("🔥"); api.search(); });
t("empty tray render", () => { api.setSet(""); while (api.tray().length) api.remove(0); api.render(); });

// Duplicates: adding one card ten times should not produce a ten-card tray the
// layout table has no frame for.
while (api.tray().length) api.remove(0);
const dupe = api.INDEX()[0].i;
for (let i=0;i<10;i++) api.add(dupe);
if (api.tray().length > 9) fails.push(`ten adds of ONE card gives a tray of ${api.tray().length} — past the largest frame, and it is the same card ten times`);

console.log(fails.length ? "\n✗ HOSTILE USER — " + fails.length + " problem(s):\n" : "\n✓ hostile user: survived every abuse");
for (const f of fails) console.log("   " + f);
