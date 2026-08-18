// scripts/generate-weekly.mjs — The Week (dormant until data matures)
// 7-day recap: price movers (clean post-fix history only), listing deltas,
// signal summary. Exits politely until 7 distinct snapshot days exist
// (~Aug 25) — then research/weekly/YYYY-Wnn.md appears and feeds the Cold
// issue directly. Run manually or wire later; safe either way.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT,p),"utf-8"));
const hh = await J("data/heat-history.json");
const days = [...new Set(hh.map(r=>r.date))].sort();
if (days.length < 7) { console.log(`weekly dormant: ${days.length}/7 snapshot days`); process.exit(0); }
const sp = await J("data/sealed-prices.json");
const CUT = "2026-08-18"; // fix-deploy: earlier rows untrusted
const movers = [];
for (const p of sp.products) {
  const h = (p.priceHistory||[]).filter(r=>r.date>=CUT);
  if (h.length>=7 && p.dataStatus==="live") {
    const wow=(h[h.length-1].price-h[h.length-7].price)/h[h.length-7].price;
    movers.push({name:p.name, now:h[h.length-1].price, wow:Math.round(wow*1000)/10});
  }
}
movers.sort((a,b)=>Math.abs(b.wow)-Math.abs(a.wow));
const supply = [];
for (const id of new Set(hh.map(r=>r.id))) {
  const rows = hh.filter(r=>r.id===id).sort((a,b)=>a.date<b.date?-1:1);
  if (rows.length>=7 && rows[rows.length-7].listingCount>0)
    supply.push({id, d:(rows[rows.length-1].listingCount-rows[rows.length-7].listingCount)/rows[rows.length-7].listingCount});
}
supply.sort((a,b)=>a.d-b.d);
const wk = `${days[days.length-1]}-week`;
let md = `# 📅 The Week — ${days[days.length-7]} → ${days[days.length-1]}\n\n## Price movers (clean history only)\n`;
for (const m of movers.slice(0,8)) md += `- ${m.name}: $${m.now} (${m.wow>0?"+":""}${m.wow}%)\n`;
md += `\n## Supply drains (Active Listings, 7d)\n`;
for (const s of supply.slice(0,5)) md += `- ${s.id}: ${Math.round(s.d*100)}%\n`;
md += `\n*Feeds Cold-issue sections directly. Buy Pressure reads: see heat-report.*\n`;
await mkdir(join(ROOT,"research/weekly"),{recursive:true});
await writeFile(join(ROOT,`research/weekly/${wk}.md`), md);
console.log(`✓ The Week written: research/weekly/${wk}.md`);
