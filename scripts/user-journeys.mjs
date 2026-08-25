import { readFile } from "node:fs/promises";
const html = await readFile("research/assets/build.html", "utf-8");
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const present = new Set([...html.matchAll(/id="([a-zA-Z0-9_-]+)"/g)].map(m => m[1]));

// A WHOLE SESSION, not one action. Every real failure tonight came from state
// left behind by the PREVIOUS thing the user did — so this drives sequences.
function boot(envName, apply) {
  const g = globalThis;
  const nodes = {};
  const mk = id => nodes[id] = nodes[id] || { id, innerHTML:"", value:"", textContent:"", hidden:false, style:{}, dataset:{}, disabled:false,
    classList:{toggle(){},add(){},remove(){},contains(){return false}}, querySelectorAll:()=>[], querySelector:()=>null,
    addEventListener(){}, onclick:null, appendChild(){}, getContext:()=>({drawImage(){},fillRect(){},fillText(){},measureText:()=>({width:10}),save(){},restore(){},beginPath(){},arc(){},fill(){},clip(){},roundRect(){},createLinearGradient:()=>({addColorStop(){}})}),
    scrollIntoView(){}, click(){}, focus(){}, toDataURL:()=>"data:image/png;base64,x", toBlob:cb=>cb({size:10,type:"image/png"}), width:0, height:0 };
  g.document={getElementById:id=>present.has(id)?mk(id):null,querySelectorAll:()=>[],
    querySelector:()=>({querySelectorAll:()=>[],addEventListener(){},onclick:null,classList:{toggle(){},add(){},remove(){},contains(){return false}}}),
    createElement:()=>({style:{},className:"",textContent:"",setAttribute(){},appendChild(){},click(){},addEventListener(){},
      getContext:()=>({drawImage(){},fillRect(){},fillText(){},measureText:()=>({width:10}),save(){},restore(){},beginPath(){},arc(){},fill(){},clip(){},roundRect(){},createLinearGradient:()=>({addColorStop(){}})}),
      toDataURL:()=>"data:image/png;base64,x", toBlob:cb=>cb({size:10}), get outerHTML(){return"";}}),
    createTextNode:()=>({}),addEventListener(){},body:mk("__b")};
  g.window=g; g.addEventListener=()=>{};
  g.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  Object.defineProperty(g,"navigator",{value:{clipboard:{write:async()=>{}},canShare:()=>false},configurable:true});
  g.Image=function(){setTimeout(()=>this.onload&&this.onload(),0);};
  g.fetch=async()=>{throw new TypeError("x")};
  g.AbortSignal={timeout:()=>null}; g.confirm=()=>true; g.ClipboardItem=function(){};
  g.matchMedia=()=>({matches:false,addEventListener(){}}); g.open=()=>({document:{write(){},close(){}}});
  g.File=function(){}; g.Blob=function(){};
  apply(g);
  return new Function(js + ";return {runAsk,tray:()=>tray,startStreak:typeof startStreak!=='undefined'?startStreak:null,confirmPosted:typeof confirmPosted!=='undefined'?confirmPosted:null,todaysCard:typeof todaysCard!=='undefined'?todaysCard:null,toggleStreakFilter:typeof toggleStreakFilter!=='undefined'?toggleStreakFilter:null,copyImage:typeof copyImage!=='undefined'?copyImage:null,dlImage:typeof dlImage!=='undefined'?dlImage:null,openImage:typeof openImage!=='undefined'?openImage:null,shareImage:typeof shareImage!=='undefined'?shareImage:null,add:typeof add!=='undefined'?add:null,clearTray:typeof clearTray!=='undefined'?clearTray:null};")();
}

// SEQUENCES A REAL PERSON PERFORMS. Each is a session, not an action.
const JOURNEYS = [
  { name: "browse then post", steps: a => { a.runAsk("cards nobody talks about"); a.runAsk("charizard through the years"); a.copyImage?.(); } },
  { name: "change mind 5 times", steps: a => { for (const p of ["cute","fire types","something dark","arita","four eevee cards"]) a.runAsk(p); } },
  { name: "start a streak, use it", steps: a => { a.startStreak?.("ir-cheap"); a.todaysCard?.(); a.confirmPosted?.(); a.toggleStreakFilter?.(); a.runAsk("pikachu"); } },
  { name: "save every way", steps: a => { a.runAsk("two cards by arita"); a.copyImage?.(); a.dlImage?.(); a.openImage?.(); a.shareImage?.(); } },
  { name: "empty then real", steps: a => { a.runAsk(""); a.runAsk("asdfgh"); a.runAsk("pikachu"); } },
  { name: "streak then unrelated", steps: a => { a.startStreak?.("ir-any"); a.runAsk("fire types"); a.confirmPosted?.(); a.runAsk("idk"); } },
  { name: "spam the same prompt", steps: a => { for (let i=0;i<6;i++) a.runAsk("something dark"); } },
];

const ENVS = { "ios-safari": g => { Object.defineProperty(g,"navigator",{value:{share:async()=>{},canShare:()=>true,maxTouchPoints:5},configurable:true}); delete g.ClipboardItem; },
  "ios-private": g => { g.localStorage={getItem:()=>null,removeItem(){},setItem(){const e=new Error("Q");e.name="QuotaExceededError";throw e;}}; },
  "android-chrome": g => { Object.defineProperty(g,"navigator",{value:{share:async()=>{},canShare:()=>true,clipboard:{write:async()=>{}},maxTouchPoints:5},configurable:true}); },
  "pc-chrome": g => {} };

const fails = [];
for (const [env, apply] of Object.entries(ENVS)) {
  for (const j of JOURNEYS) {
    let api;
    try { api = boot(env, apply); } catch(e){ fails.push(`[${env}] BOOT: ${e.message.slice(0,40)}`); continue; }
    await new Promise(r=>setTimeout(r,60));
    try { j.steps(api); await new Promise(r=>setTimeout(r,30)); }
    catch(e){ fails.push(`[${env}] "${j.name}" THREW: ${e.message.slice(0,54)}`); }
  }
}
const total = Object.keys(ENVS).length * JOURNEYS.length;
console.log(`\nUSER JOURNEYS — ${JOURNEYS.length} sessions × ${Object.keys(ENVS).length} browsers = ${total} runs\n`);
if (fails.length) { for (const f of fails.slice(0,14)) console.log("   ✗ " + f); console.log(`\n✗ ${fails.length} of ${total} failed\n`); }
else console.log(`✓ all ${total} runs complete without throwing\n`);

// EXIT NON-ZERO ON FAILURE, or the pipeline cannot gate on it — a check that
// reports a problem and exits clean is a check nobody acts on.
if (typeof problems !== "undefined" && problems.length) process.exitCode = 1;
if (typeof fails !== "undefined" && fails.length) process.exitCode = 1;
if (typeof bad !== "undefined" && bad) process.exitCode = 1;
if (typeof wrong !== "undefined" && (wrong || empty)) process.exitCode = 1;
