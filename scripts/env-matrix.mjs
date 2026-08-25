import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

// REAL BROWSERS, MODELLED ON HOW THEY ACTUALLY FAIL — not on their names.
// "Safari" is not a test; "localStorage.setItem throws" is.
const ENVS = {
  "pc-chrome":      g => {},
  "pc-firefox":     g => { delete g.ClipboardItem; },
  "safari-mac":     g => { Object.defineProperty(g,"navigator",{value:{clipboard:{},canShare:()=>false},configurable:true}); },
  "ios-safari":     g => { Object.defineProperty(g,"navigator",{value:{share:async()=>{},canShare:()=>true,maxTouchPoints:5},configurable:true}); delete g.ClipboardItem; },
  "ios-private":    g => { g.localStorage={getItem:()=>null,removeItem(){},setItem(){const e=new Error("QuotaExceeded");e.name="QuotaExceededError";throw e;}}; },
  "android-chrome": g => { Object.defineProperty(g,"navigator",{value:{share:async()=>{},canShare:()=>true,maxTouchPoints:5,clipboard:{write:async()=>{}}},configurable:true}); },
  "android-old":    g => { delete g.ClipboardItem; delete g.ResizeObserver; delete g.IntersectionObserver; Object.defineProperty(g,"navigator",{value:{maxTouchPoints:5},configurable:true}); },
  "in-app-browser": g => { delete g.localStorage; Object.defineProperty(g,"navigator",{value:{},configurable:true}); g.open=()=>null; },
  "offline":        g => { g.fetch=()=>Promise.reject(new TypeError("offline")); g.Image=function(){setTimeout(()=>this.onerror&&this.onerror(),0);}; },
};

const PROMPTS = ["cards nobody talks about","charizard through the years","fire types","something dark","four cute cards","arita","idk",""];
const rows = [];

for (const [name, apply] of Object.entries(ENVS)) {
  const g = globalThis;
  const mk = id => ({ id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
    classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
    addEventListener(){}, onclick:null, appendChild(){}, getContext:()=>null, scrollIntoView(){}, click(){}, focus(){} });
  g.document={getElementById:id=>present.has(id)?mk(id):null,querySelectorAll:()=>[],
    querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
    createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},getContext:()=>null,get outerHTML(){return"";}}),
    createTextNode:()=>({}),addEventListener(){},body:mk("__b")};
  g.window=g; g.addEventListener=()=>{};
  g.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  Object.defineProperty(g,"navigator",{value:{clipboard:{write:async()=>{}},canShare:()=>false},configurable:true});
  g.Image=function(){}; g.fetch=async()=>{throw new TypeError("x")};
  g.AbortSignal={timeout:()=>null}; g.confirm=()=>true; g.ClipboardItem=function(){};
  g.matchMedia=()=>({matches:false,addEventListener(){}}); g.open=()=>({document:{write(){},close(){}}});
  apply(g);

  let boot=false, ok=0, err=null;
  try {
    const api=new Function(js+";return {runAsk,tray:()=>tray};")();
    await new Promise(r=>setTimeout(r,70));
    boot=true;
    for (const p of PROMPTS) {
      try { api.runAsk(p); if (!p.trim() || api.tray().length) ok++; }
      catch(e){ err = err ?? (p+": "+e.message.slice(0,40)); }
    }
  } catch(e){ err="BOOT "+e.message.slice(0,50); }
  rows.push({name, boot, ok, of:PROMPTS.length, err});
}

console.log("\nENVIRONMENT MATRIX — every prompt in every browser\n");
let bad=0;
for (const r of rows) {
  const good = r.boot && r.ok===r.of && !r.err;
  if (!good) bad++;
  console.log(`  ${good?"ok ":"✗  "} ${r.name.padEnd(16)}${r.boot?"boots":"DEAD "} · ${r.ok}/${r.of} prompts${r.err?" · "+r.err:""}`);
}
console.log(bad ? `\n✗ ${bad} environment(s) fail\n` : `\n✓ all ${rows.length} environments boot and every prompt works\n`);

// EXIT NON-ZERO ON FAILURE, or the pipeline cannot gate on it — a check that
// reports a problem and exits clean is a check nobody acts on.
if (typeof problems !== "undefined" && problems.length) process.exitCode = 1;
if (typeof fails !== "undefined" && fails.length) process.exitCode = 1;
if (typeof bad !== "undefined" && bad) process.exitCode = 1;
if (typeof wrong !== "undefined" && (wrong || empty)) process.exitCode = 1;
