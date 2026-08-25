// journey-smoke.mjs — the WHOLE journey, not the links.
//
// Tyler, 2026-08-24: "Used our Charizard prompt and it failed. I asked for an
// audit and you told me it would work."
//
// He is right, and the audit was the failure rather than the bug. I had five
// tests — does the script run, do themes produce, does the tray fill, do
// evolution lines resolve, does the draw loop run — and **not one of them
// pressed the button after the prompt.** Every test stopped at the tray.
//
// **I audited five links of a six-link chain and reported that it works.**
//
// This test does what a person does: type the sentence, press Make the image,
// and check something came out. A chain is only as good as the step nobody
// tested, and the untested step is where it broke.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const html = await readFile(join(ROOT, "research/assets/build.html"), "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

const drawn = [];
const ctx = { fillStyle:"", font:"", textAlign:"", globalAlpha:1, lineWidth:1, strokeStyle:"",
  fillRect(){}, fillText(t){ drawn.push("text"); }, drawImage(){ drawn.push("image"); },
  measureText(t){ return { width: String(t).length * 22 }; },
  save(){}, restore(){}, translate(){}, rotate(){}, beginPath(){}, rect(){}, roundRect(){},
  fill(){}, stroke(){}, clip(){}, createLinearGradient(){ return { addColorStop(){} }; } };
const nodes = {};
const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false,
  style:{}, dataset:{}, width:0, height:0, disabled:false,
  classList:{toggle(){},add(){},remove(){},contains(){return false}},
  querySelectorAll:()=>[], querySelector:()=>null, addEventListener(){}, onclick:null,
  scrollIntoView(){}, appendChild(){}, getContext:()=>ctx,
  toDataURL(){ return "data:image/png;base64,AAAA"; },
  toBlob(cb){ cb({ size: 1024, type: "image/png" }); } };
globalThis.document = { getElementById: id => present.has(id) ? mk(id) : null,
  querySelectorAll: () => [],
  querySelector: () => ({ querySelectorAll:()=>[], addEventListener(){}, onclick:null,
    classList:{toggle(){},add(){},remove(){},contains(){return false}} }),
  createElement: () => ({ style:{}, className:"", textContent:"", setAttribute(){}, appendChild(){},
    click(){}, getContext:()=>ctx, get outerHTML(){ return ""; } }),
  createTextNode: () => ({}), addEventListener(){} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
Object.defineProperty(globalThis, "navigator", { value:{}, configurable:true });
globalThis.AbortSignal = { timeout: () => null };
// Images resolve, as they do on a real device with a working connection.
let IMAGES_FAIL = false;
globalThis.Image = function(){ const o = { crossOrigin:"" };
  Object.defineProperty(o, "src", { set(){ setTimeout(function(){ if (IMAGES_FAIL) { o.onerror && o.onerror(new Error("blocked")); } else { o.onload && o.onload(); } }, 1); } }); return o; };
globalThis.__setImagesFail = function(v){ IMAGES_FAIL = v; };
globalThis.fetch = async () => { throw new TypeError("no network"); };
globalThis.confirm = () => true;

const api = new Function(js + `
;return { runAsk, tray:()=>tray, make:()=>document.getElementById("make").onclick(),
  status:()=>document.getElementById("st") ? document.getElementById("st").textContent : "",
  outimg:()=>document.getElementById("outimg") ? document.getElementById("outimg").src : "" };`)();
await new Promise(r => setTimeout(r, 80));

// The sentences a person actually types, end to end.
const JOURNEYS = [
  "charizard evolution from 151",
  "cards nobody talks about",
  "blastoise fears",
  "what it fears",
  "charmander evolution",
  "two cards by the same artist",
  "cute cards under a fiver",
  "twenty years apart",
  "same attack",
  "psychic types",
];

const fails = [];
console.log("THE WHOLE JOURNEY: type it, press Make the image, check something came out.\n");
for (const j of JOURNEYS) {
  drawn.length = 0;
  let err = null;
  try { api.runAsk(j); } catch (e) { err = "runAsk threw: " + e.message.slice(0, 50); }
  const n = api.tray().length;
  if (!err && !n) err = "no cards in the tray";
  if (!err) {
    try { await api.make(); } catch (e) { err = "MAKE THE IMAGE threw: " + e.message.slice(0, 60); }
    await new Promise(r => setTimeout(r, 60));
    const images = drawn.filter(d => d === "image").length;
    if (!err && !images) err = "the button ran but drew NO images";
    else if (!err && images < n) err = "drew " + images + " images for " + n + " cards";
  }
  if (err) fails.push(j + " — " + err);
  console.log("  " + (err ? "✗ " : "✓ ") + j.padEnd(32) + (err ? err : n + " cards, " + drawn.filter(d => d === "image").length + " drawn"));
}

// SECOND PASS: every image fails to load, which is what a blocked host or a
// dead connection looks like. The compose must still finish and must say
// something useful rather than hanging or reporting a silent success.
console.log("\nSAME JOURNEYS, WITH EVERY IMAGE FAILING TO LOAD:\n");
globalThis.__setImagesFail(true);
for (const j of JOURNEYS.slice(0, 4)) {
  drawn.length = 0;
  let err = null;
  try { api.runAsk(j); await api.make(); } catch (e) { err = "threw: " + e.message.slice(0, 60); }
  await new Promise(r => setTimeout(r, 120));
  const st = api.status();
  if (err) fails.push(j + " (images failing) — " + err);
  else if (!st) fails.push(j + " (images failing) — finished SILENTLY, no message at all");
  console.log("  " + (err ? "✗ " : "✓ ") + j.padEnd(32) + (err || st.slice(0, 60)));
}
globalThis.__setImagesFail(false);

// REPLAY EVERY FUZZ FINDING. A fuzzer that finds a bug, watches it get fixed,
// and forgets is a fuzzer that lets it come back. These are the exact inputs
// that broke the editor, replayed forever.
try {
  const rec = JSON.parse(await readFile(join(ROOT, "data/fuzz-findings.json"), "utf-8"));
  const cases = (rec.findings ?? []).filter(f => f.firstInput);
  if (cases.length) {
    console.log("\nREPLAYING " + cases.length + " INPUT(S) THAT BROKE IT BEFORE:\n");
    for (const c of cases) {
      let e2 = null;
      try { api.runAsk(c.firstInput); if (api.tray().length) await api.make(); }
      catch (e) { e2 = e.message.slice(0, 60); }
      if (e2) fails.push("REGRESSION on a known fuzz input: " + JSON.stringify(c.firstInput.slice(0, 40)) + " — " + e2);
      console.log("  " + (e2 ? "✗ " : "✓ ") + JSON.stringify(c.firstInput.slice(0, 46)) + (e2 ? "  " + e2 : ""));
    }
  }
} catch {}

if (fails.length) {
  console.error(`\n✗ JOURNEY — ${fails.length} of ${JOURNEYS.length} fail between the prompt and the image.\n`);
  console.error(`   Every other test stops at the tray. This is the step nobody tested,\n   and it is where it broke.\n`);
  process.exitCode = 1;
} else {
  console.log(`\n✓ journey: all ${JOURNEYS.length} go from a typed sentence to a drawn image`);
}
