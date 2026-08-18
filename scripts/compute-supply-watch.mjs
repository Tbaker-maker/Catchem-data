// scripts/compute-supply-watch.mjs — cross-market supply lead-lag ("Supply Watch")
// Compares 7-day listing-count deltas: eBay (data/heat-history.json) vs
// TCG side (data/crosscheck-history.json, filled once a provider is live).
// When one market's supply drains first, the other gets a WATCH read.
// Listing counts are inferred supply; lead-lag states are READS, not facts.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const TH = 0.12, MIN_DAYS = 8;

function delta7(rows, key) {
  const r = rows.sort((a,b)=>a.date<b.date?-1:1);
  if (r.length < MIN_DAYS) return { d: null, days: r.length };
  const now = r[r.length-1][key], then = r[r.length-8][key];
  return { d: then > 0 ? (now-then)/then : null, days: r.length, now, then };
}
const state = (e, t) => {
  if (e==null || t==null) return null;
  if (t<=-TH && Math.abs(e)<TH) return ["tcg-leading-drain","⚡ TCG supply shrinking first — watch eBay to follow"];
  if (e<=-TH && Math.abs(t)<TH) return ["ebay-leading-drain","⚡ eBay supply shrinking first — watch TCG to follow"];
  if (e<=-TH && t<=-TH) return ["confirmed-drain","🔥 both markets draining — cross-market confirmation"];
  if (e>=TH && t>=TH)   return ["confirmed-flood","❄️ both markets flooding — supply wave landing"];
  if ((e<=-TH&&t>=TH)||(e>=TH&&t<=-TH)) return ["cross-current","cross-current: markets disagree — arbitrage or data quirk, verify"];
  return ["balanced","supply steady both markets"];
};

const ebayH = JSON.parse(await readFile(join(DATA,"heat-history.json"),"utf-8").catch?.()||await readFile(join(DATA,"heat-history.json"),"utf-8"));
let tcgH; try { tcgH = JSON.parse(await readFile(join(DATA,"crosscheck-history.json"),"utf-8")); }
catch { console.log("no crosscheck-history.json yet — provider eval pending; exiting clean"); process.exit(0); }

const ids = [...new Set(ebayH.map(r=>r.id))];
const rows=[], maturing=[];
for (const id of ids) {
  const e = delta7(ebayH.filter(r=>r.id===id), "listingCount");
  const t = delta7(tcgH.filter(r=>r.id===id), "tcgListings");
  const s = state(e.d, t.d);
  if (!s) { maturing.push({ id, ebayDays: e.days, tcgDays: t.days }); continue; }
  rows.push({ id, state: s[0], read: s[1],
    ebay7d: e.d==null?null:Math.round(e.d*1000)/10, tcg7d: t.d==null?null:Math.round(t.d*1000)/10,
    ebayListings: e.now, tcgListings: t.now });
}
const sev = {"confirmed-drain":0,"tcg-leading-drain":1,"ebay-leading-drain":2,"confirmed-flood":3,"cross-current":4,"balanced":5};
rows.sort((a,b)=>sev[a.state]-sev[b.state]);
await writeFile(join(DATA,"supply-watch.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: "7-day listing-count deltas, eBay vs TCG-side. Inferred supply, not measured sales. Lead-lag states are reads. NOTE Aug 18: current provider exposes no sealed listing counts (tcgListings null) — TCG side dormant; eBay-side deltas remain valid via heat-history.",
  counts: { read: rows.length, maturing: maturing.length,
            signals: rows.filter(r=>r.state!=="balanced").length },
  rows, maturing }, null, 2)+"\n");
console.log(`✓ Supply Watch: ${rows.length} read, ${rows.filter(r=>r.state!=="balanced").length} signals, ${maturing.length} maturing`);
for (const r of rows.slice(0,5)) console.log(`  ${r.state.padEnd(18)} ebay ${r.ebay7d}% / tcg ${r.tcg7d}%  ${r.id}`);
