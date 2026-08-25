import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

// NOT THROWING IS NOT WORKING. A save button that silently does nothing is the
// exact failure Tyler hit — it looked fine and stranded him. So this asserts
// each path either SUCCEEDS or SAYS WHY.
function boot(apply) {
  const g = globalThis; const nodes = {};
  const ctx = {drawImage(){},fillRect(){},fillText(){},measureText:()=>({width:10}),save(){},restore(){},beginPath(){},arc(){},fill(){},clip(){},roundRect(){},createLinearGradient:()=>({addColorStop(){}})};
  const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
    classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
    addEventListener(){}, onclick:null, appendChild(){}, getContext:()=>ctx, scrollIntoView(){}, click(){}, focus(){},
    toDataURL:()=>"data:image/png;base64,x", toBlob:cb=>cb({size:10,type:"image/png"}), width:100, height:100 };
  g.__nodes = nodes;
  g.document={getElementById:id=>present.has(id)?mk(id):null,querySelectorAll:()=>[],
    querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
    createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},getContext:()=>ctx,toDataURL:()=>"data:x",toBlob:cb=>cb({size:10}),get outerHTML(){return"";}}),
    createTextNode:()=>({}),addEventListener(){},body:mk("__b")};
  g.window=g; g.addEventListener=()=>{};
  g.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  Object.defineProperty(g,"navigator",{value:{clipboard:{write:async()=>{}},canShare:()=>false},configurable:true});
  g.Image=function(){setTimeout(()=>this.onload&&this.onload(),0);};
  g.fetch=async()=>{throw new TypeError("x")}; g.AbortSignal={timeout:()=>null};
  g.confirm=()=>true; g.ClipboardItem=function(){}; g.File=function(){}; g.Blob=function(){};
  g.matchMedia=()=>({matches:false,addEventListener(){}}); g.open=()=>({document:{write(){},close(){}}});
  apply(g);
  return new Function(js+";return {runAsk,copyImage,dlImage,openImage,shareImage,tray:()=>tray};")();
}

const CASES = [
  { env: "everything works", apply: g => {} },
  { env: "clipboard blocked", apply: g => { Object.defineProperty(g,"navigator",{value:{clipboard:{write:async()=>{throw new Error("NotAllowedError")}}},configurable:true}); } },
  { env: "no clipboard at all", apply: g => { Object.defineProperty(g,"navigator",{value:{},configurable:true}); delete g.ClipboardItem; } },
  { env: "share cancelled", apply: g => { Object.defineProperty(g,"navigator",{value:{canShare:()=>true,share:async()=>{throw new Error("AbortError")}},configurable:true}); } },
  { env: "popup blocked", apply: g => { g.open=()=>null; } },
];

const problems = [];
for (const c of CASES) {
  const api = boot(c.apply);
  await new Promise(r=>setTimeout(r,60));
  api.runAsk("two cards by arita");
  for (const [label, fn] of [["copy",api.copyImage],["download",api.dlImage],["open tab",api.openImage],["share",api.shareImage]]) {
    const before = globalThis.__nodes.st?.textContent ?? "";
    try { const r = fn(); if (r?.then) await r; } catch(e){ problems.push(`[${c.env}] ${label} THREW ${e.message.slice(0,36)}`); continue; }
    await new Promise(r=>setTimeout(r,20));
    const after = globalThis.__nodes.st?.textContent ?? "";
    // THE ASSERTION THAT MATTERS: it must have SAID something. Silence is the
    // failure — a user cannot tell a silent success from a silent failure.
    if (after === before || !after) problems.push(`[${c.env}] ${label} said NOTHING — silence is indistinguishable from broken`);
  }
}
console.log(`\nSAVE PATHS — 4 buttons × ${CASES.length} conditions\n`);
if (problems.length) { for (const p of problems.slice(0,16)) console.log("   ✗ " + p); console.log(`\n✗ ${problems.length} problem(s)\n`); }
else console.log(`✓ every save path either succeeds or says why, in all ${CASES.length} conditions\n`);

// EXIT NON-ZERO ON FAILURE, or the pipeline cannot gate on it — a check that
// reports a problem and exits clean is a check nobody acts on.
if (typeof problems !== "undefined" && problems.length) process.exitCode = 1;
if (typeof fails !== "undefined" && fails.length) process.exitCode = 1;
if (typeof bad !== "undefined" && bad) process.exitCode = 1;
if (typeof wrong !== "undefined" && (wrong || empty)) process.exitCode = 1;
