import { readFile } from "node:fs/promises";
// TEST IT THE WAY IT FAILS. No fetch at all — a file:// page in Chrome cannot
// fetch a sibling. My old harness supplied a fetch that always worked, which is
// how I certified a page that does nothing.
const html = await readFile("research/assets/build.html", "utf8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));
const nodes = {};
const mk = id => nodes[id] ||= { id, innerHTML: "", value: "", textContent: "", hidden: false,
  style: {}, dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } },
  querySelectorAll: () => [], querySelector: () => null, addEventListener(){}, onclick: null,
  scrollIntoView(){}, appendChild(){}, getContext: () => null };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll: () => [], querySelector: (sel) => ({ querySelectorAll: () => [], addEventListener(){}, onclick: null, classList:{toggle(){},add(){},remove(){},contains(){return false}} }), createElement: () => ({ style:{}, click(){}, getContext:()=>null }), addEventListener(){} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
globalThis.Image = function(){};
globalThis.AbortSignal = { timeout: () => null };
// THE POINT: fetch REJECTS, exactly as a file:// page does.
globalThis.fetch = async () => { throw new TypeError("Failed to fetch"); };

let err = null;
try { new Function(js)(); } catch (e) { err = e; }
await new Promise(r => setTimeout(r, 80));

const fails = [];
if (err) fails.push("script threw with no network: " + err.message.slice(0, 70));
const res = nodes.res?.innerHTML ?? "";
const imgs = (res.match(/<img/g) ?? []).length;
const themes = (nodes.ftheme?.innerHTML.match(/data-t=/g) ?? []).length;
if (imgs < 5) fails.push(`only ${imgs} images render with no network — this is the file:// case and it is how Tyler opened it`);
if (themes < 3) fails.push(`only ${themes} theme chips render with no network`);
const srcs = [...res.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
if (srcs.length && !/^https:\/\/images\./.test(srcs[0])) fails.push(`image src looks wrong: ${srcs[0]?.slice(0, 60)}`);

if (fails.length) { console.error("\n✗ OFFLINE SMOKE — the page does nothing without a network:\n");
  for (const f of fails) console.error("   " + f);
  console.error("\n   A tool that needs a server to show its own catalogue is a tool that\n   fails the first time somebody opens the file.\n"); process.exitCode = 1; }
else console.log(`✓ offline smoke: ${imgs} cards and ${themes} themes render with NO network · first src ${srcs[0]?.slice(0, 48)}`);
