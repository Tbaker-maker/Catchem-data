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
const ids = process.argv.slice(2); // pass candidate cardIds, e.g. swsh3-20 swsh1-206
if (!ids.length) { console.log("usage: node verify-watchlist-prices.mjs <cardId...>"); process.exit(0); }
const sleep = ms=>new Promise(r=>setTimeout(r,ms));
async function ptcg(id, tries=3){ for(let i=0;i<tries;i++){ try{
  const r=await fetch(`https://api.pokemontcg.io/v2/cards/${id}?select=id,name,set,number,tcgplayer`);
  if(r.status>=500||r.status===429){await sleep(800*(i+1));continue;}
  if(!r.ok) return null; return (await r.json()).data;}catch{await sleep(800);}} return null;}
async function ppt(setId, number){ const r=await fetch(
  `https://www.pokemonpricetracker.com/api/v2/prices?setId=${setId}&number=${number}`,
  {headers:{Authorization:`Bearer ${KEY}`}}); if(!r.ok) return null;
  const d=await r.json(); return Array.isArray(d?.data)?d.data[0]:d?.data??d; }
const out=[];
for (const id of ids){ await sleep(350);
  const c=await ptcg(id); if(!c){out.push({id,status:"unverified",note:"pokemontcg.io miss"});continue;}
  const t=Object.values(c.tcgplayer?.prices||{}).find(v=>v?.market!=null)?.market??null;
  const p=await ppt(c.set?.id, c.number);
  const pv=p?.prices?.market ?? p?.marketPrice ?? p?.price ?? null;
  let status="unverified", note="";
  if (t!=null&&pv!=null){ const dv=Math.abs(t-pv)/((t+pv)/2);
    status = dv<=0.20?"verified":"divergent"; note=`ptcgio $${t} vs PPT $${pv} (Δ${Math.round(dv*100)}%)`; }
  else note=`ptcgio ${t??"—"} · PPT ${pv??"—"}`;
  out.push({id,name:c.name,number:c.number,setId:c.set?.id,tcgMarket:t,pptMarket:pv,status,note});
  console.log(`${status==="verified"?"✓":"⚠"} ${id} ${c.name} — ${note}`);}
await writeFile(join(ROOT,"data/watchlist-price-verify.json"),JSON.stringify({verifiedAt:new Date().toISOString(),rule:"dual-source ≤20% = verified; else flagged, never shown as fact",cards:out},null,2)+"\n");
