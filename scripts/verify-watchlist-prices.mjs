// scripts/verify-watchlist-prices.mjs — dual-source price gate (Tyler
// directive Aug 18: "verify prices"). Before ANY candidate price is shown
// for curation/confirmation: fetch pokemontcg.io AND PPT singles for the
// same printing. Within 20% → status "verified" (show the tcgplayer number
// with dual-source stamp). Divergent/missing → "unverified" (shown as ⚠,
// never as fact). Output: data/watchlist-price-verify.json.
// Needs POKEMONPRICETRACKER_API_KEY (CC/CI). pokemontcg.io keyless w/ backoff.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.log("verify gate needs PPT key — run from CC/CI"); process.exit(0); }
// @file support (2026-08-18): "@path" reads whitespace/newline-separated ids
// from a file — 300+ candidate ids don't fit comfortably on a command line.
let ids = process.argv.slice(2); // pass candidate cardIds, e.g. swsh3-20 swsh1-206
if (ids.length === 1 && ids[0].startsWith("@")) {
  ids = (await readFile(ids[0].slice(1), "utf-8")).split(/\s+/).filter(Boolean);
}
if (!ids.length) { console.log("usage: node verify-watchlist-prices.mjs <cardId...> | @ids.txt"); process.exit(0); }
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
async function ptcg(id, tries=3){ for(let i=0;i<tries;i++){ try{
  const r=await fetch(`https://api.pokemontcg.io/v2/cards/${id}?select=id,name,set,number,tcgplayer`);
  if(r.status>=500||r.status===429){await sleep(800*(i+1));continue;}
  if(!r.ok) return null; return (await r.json()).data;}catch{await sleep(800);}} return null;}
// v2 (2026-08-18): PPT setIds are NUMERIC and card numbers are N/M fractions
// (saved raws; /prices with pokemontcg ids 404s). Name-map via /sets once,
// then the proven /cards endpoint with number-prefix matching.
let PPT_SETS=null;
async function pptSets(){ if(PPT_SETS) return PPT_SETS;
  const r=await fetch(`https://www.pokemonpricetracker.com/api/v2/sets?limit=500`,
    {headers:{Authorization:`Bearer ${KEY}`}}); PPT_SETS=r.ok?(await r.json()).data||[]:[];
  return PPT_SETS; }
async function ppt(setName, cardName, number){
  const sets=await pptSets(); const want=(setName||"").toLowerCase();
  const s=sets.find(x=>{const n=(x.name||"").toLowerCase();return n===want||n.endsWith(": "+want)||n.includes(want);});
  if(!s) return null;
  const r=await fetch(`https://www.pokemonpricetracker.com/api/v2/cards?setId=${encodeURIComponent(s.id)}&search=${encodeURIComponent(cardName)}&limit=10`,
    {headers:{Authorization:`Bearer ${KEY}`}}); if(!r.ok) return null;
  const d=await r.json();
  return (d.data||[]).find(p=>String(p.cardNumber||"").split("/")[0].replace(/^0+/,"")===String(number).replace(/^0+/,""))??null; }
const out=[];
for (const id of ids){ await sleep(350);
  const c=await ptcg(id); if(!c){out.push({id,status:"unverified",note:"pokemontcg.io miss"});continue;}
  const t=Object.values(c.tcgplayer?.prices||{}).find(v=>v?.market!=null)?.market??null;
  const p=await ppt(c.set?.name, c.name, c.number);
  const pv=p?.prices?.market ?? p?.marketPrice ?? p?.price ?? null;
  let status="unverified", note="";
  if (t!=null&&pv!=null){ const dv=Math.abs(t-pv)/((t+pv)/2);
    status = dv<=0.20?"verified":"divergent"; note=`ptcgio $${t} vs PPT $${pv} (Δ${Math.round(dv*100)}%)`; }
  else note=`ptcgio ${t??"—"} · PPT ${pv??"—"}`;
  out.push({id,name:c.name,number:c.number,setId:c.set?.id,tcgMarket:t,pptMarket:pv,status,note});
  console.log(`${status==="verified"?"✓":"⚠"} ${id} ${c.name} — ${note}`);}
// MERGE, never overwrite (2026-08-18: a targeted 8-id run wholesale-replaced
// the 329-row dataset — same bug class as the singles resolver's carry-forward
// fix). Prior rows persist; this run's ids win on collision.
let prevCards=[];
try{ const prev=JSON.parse(await readFile(join(ROOT,"data/watchlist-price-verify.json"),"utf-8"));
  prevCards=prev.cards||prev.results||[]; }catch{}
const byId=new Map(prevCards.map(r=>[r.id,r]));
for(const r of out){
  const prior=byId.get(r.id);
  // Auto-quarantine (Tyler ruling 2026-08-18): a row flagged
  // verified-at-next-refresh that fails the 20% gate AGAIN gets quarantined —
  // two strikes means the divergence is structural, not noise.
  if(prior?.reVerifyPolicy==="verified-at-next-refresh"&&(r.status==="divergent"||r.status==="unverified")){
    byId.set(r.id,{...r,status:"quarantined",strikes:(prior.strikes||1)+1,
      ruling:prior.ruling,note:(r.note||"")+" — quarantined on re-fail (strike "+((prior.strikes||1)+1)+")"});
  } else if(prior?.reVerifyPolicy==="verified-at-next-refresh"&&r.status==="verified"){
    byId.set(r.id,{...r,note:(r.note||"")+" — cleared verified-at-next-refresh"});
  } else byId.set(r.id,{...(prior?.ruling?{ruling:prior.ruling}:{}),...r});
}
await writeFile(join(ROOT,"data/watchlist-price-verify.json"),JSON.stringify({verifiedAt:new Date().toISOString(),rule:"dual-source ≤20% = verified; else flagged, never shown as fact",cards:[...byId.values()]},null,2)+"\n");
