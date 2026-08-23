import { readFile } from "node:fs/promises";
// SIMULATE THE CREATORS PAGE. It has never had a smoke test, and the editor
// shipped dead three times while parsing perfectly — parsing is necessary and
// nowhere near sufficient.
const html = await readFile("research/assets/creators.html", "utf8");
const js = (html.match(/<script>([\s\S]*?)<\/script>/) ?? [])[1] ?? "";

const nodes = {};
const mk = id => nodes[id] ||= { id, innerHTML: "", value: "", textContent: "", hidden: false,
  style: {}, dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains: () => false },
  querySelectorAll: () => [], querySelector: () => null, addEventListener(){}, appendChild(){},
  scrollIntoView(){}, getContext: () => null, click(){} };
// Give it every id the page references, so a missing element is not mistaken
// for a broken script.
for (const m of html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)) mk(m[1]);
globalThis.document = { getElementById: id => nodes[id] ?? null,
  querySelectorAll: () => [], querySelector: () => null,
  createElement: () => ({ style:{}, getContext: () => null, click(){}, appendChild(){} }),
  addEventListener(){}, body: mk("body") };
globalThis.window = globalThis;
globalThis.localStorage = { getItem: () => null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
globalThis.Image = function(){};
globalThis.AbortSignal = { timeout: () => null };
globalThis.fetch = async () => ({ ok: true, json: async () => ([]) });

let err = null;
try { new Function(js)(); } catch (e) { err = e; }
await new Promise(r => setTimeout(r, 50));

const fails = [];
if (err) fails.push("the emitted script THREW: " + err.message.slice(0, 80));
// The page's whole purpose is pairings a creator can act on.
const pairings = (html.match(/class="pair/g) ?? []).length;
if (pairings < 3) fails.push(`only ${pairings} pairing block(s) rendered into the HTML — the page's entire purpose is pairings`);
const imgs = (html.match(/<img/g) ?? []).length;
if (imgs < 6) fails.push(`only ${imgs} images — a creator portal with no card art is a list`);
const angles = /angle|Angle/.test(html);
if (!angles) fails.push("no angles present — the page hands over finished copy instead of starting points, or nothing at all");
// Handlers called from inline onclick must exist on window, the bug that made
// every pager button in the editor do nothing.
const inline = [...html.matchAll(/onclick="([a-zA-Z_]+)\(/g)].map(m => m[1]);
const missing = [...new Set(inline)].filter(fn => typeof globalThis[fn] !== "function");
if (missing.length) fails.push(`inline onclick calls ${missing.join(", ")} which ${missing.length > 1 ? "are" : "is"} not on window — the button renders, clicks, and does nothing`);

if (fails.length) {
  console.error(`\n✗ CREATORS SMOKE — the page parses and does not work:\n`);
  for (const f of fails) console.error("   " + f);
  console.error("");
  process.exitCode = 1;
} else {
  console.log(`✓ creators smoke: ${pairings} pairings, ${imgs} images, angles present, ${new Set(inline).size} inline handler(s) all reachable`);
}
