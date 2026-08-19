// scripts/generate-weekly.mjs — The Week (dormant until data matures)
// 7-day recap: price movers (clean post-fix history only), listing deltas,
// signal summary, plus the Cold-issue slots: SLOT-7 Pack Math ladder and
// SLOT-8 Quiet Movers. Exits politely until 7 distinct snapshot days exist
// (~Aug 25) — then research/weekly/YYYY-MM-DD-week.md appears and feeds the
// Cold issue directly. WEEKLY_DRYRUN=1 bypasses the gate with whatever days
// exist and writes research/weekly/DRYRUN-*.md (never the live path).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT,p),"utf-8"));
const DRY = process.env.WEEKLY_DRYRUN === "1";
const hh = await J("data/heat-history.json");
const days = [...new Set(hh.map(r=>r.date))].sort();
if (days.length < 7 && !DRY) { console.log(`weekly dormant: ${days.length}/7 snapshot days`); process.exit(0); }
if (DRY && days.length < 2) { console.log(`dry-run needs 2+ days (have ${days.length})`); process.exit(0); }
const win = Math.min(7, days.length); // dry-run: whatever window exists
const sp = await J("data/sealed-prices.json");
let der = null; try { der = await J("data/derived-insights.json"); } catch {}
const CUT = "2026-08-18"; // fix-deploy: earlier rows untrusted
const movers = [];
for (const p of sp.products) {
  const h = (p.priceHistory||[]).filter(r=>r.date>=CUT);
  if (h.length>=win && p.dataStatus==="live" && h[h.length-win].price) {
    const wow=(h[h.length-1].price-h[h.length-win].price)/h[h.length-win].price;
    movers.push({name:p.name, now:h[h.length-1].price, wow:Math.round(wow*1000)/10});
  }
}
movers.sort((a,b)=>Math.abs(b.wow)-Math.abs(a.wow));
const supply = [];
for (const id of new Set(hh.map(r=>r.id))) {
  const rows = hh.filter(r=>r.id===id).sort((a,b)=>a.date<b.date?-1:1);
  if (rows.length>=win && rows[rows.length-win].listingCount>0)
    supply.push({id, d:(rows[rows.length-1].listingCount-rows[rows.length-win].listingCount)/rows[rows.length-win].listingCount});
}
supply.sort((a,b)=>a.d-b.d);
const wk = `${days[days.length-1]}-week`;
let md = `# 📅 The Week — ${days[days.length-win]} → ${days[days.length-1]}${DRY?` · ⚠ DRY-RUN (${win}-day window, NOT for publication)`:""}\n\n## Price movers (clean history only)\n`;
for (const m of movers.slice(0,8)) md += `- ${m.name}: $${m.now} (${m.wow>0?"+":""}${m.wow}%)\n`;
md += `\n## Supply drains (Active Listings, ${win}d)\n`;
for (const s of supply.slice(0,5)) md += `- ${s.id}: ${Math.round(s.d*100)}%\n`;
// ── SLOT-7: Pack Math ladder (source: derived-insights packMath) ──
md += `\n## SLOT-7 · Pack Math ladder ($/sealed pack)\n`;
if (der?.packMath?.priciest?.length && der?.packMath?.cheapest?.length) {
  for (const r of der.packMath.priciest.slice(0,3)) md += `- ${r.name}: **$${r.perPack}/pack**${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}% vs loose${r.premiumThin?" ⚠thin-lane":""}`:""}\n`;
  md += `- …\n`;
  for (const r of der.packMath.cheapest.slice(0,3)) md += `- ${r.name}: **$${r.perPack}/pack**${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}% vs loose${r.premiumThin?" ⚠thin-lane":""}`:""}\n`;
} else md += `- SLOT UNFILLED: derived-insights.packMath missing/empty — do not publish this section.\n`;
// ── SLOT-8: Quiet Movers (source: derived-insights narrative.quietMovers) ──
md += `\n## SLOT-8 · Quiet movers (moving without headlines)\n`;
if (der?.narrative?.quietMovers?.length) {
  for (const q of der.narrative.quietMovers.slice(0,5)) md += `- ${q.flagship}: $${q.price}${q.spreadPct!=null?` (asking ${Math.abs(q.spreadPct)}% ${q.spreadPct>0?"over":"under"} TCG-side)`:""} — zero coverage found\n`;
} else md += `- SLOT UNFILLED: narrative.quietMovers missing/empty — do not publish this section.\n`;
md += `\n*Feeds Cold-issue sections directly. Buy Pressure reads: see heat-report.*\n`;
await mkdir(join(ROOT,"research/weekly"),{recursive:true});
const out = DRY ? `research/weekly/DRYRUN-${days[days.length-1]}.md` : `research/weekly/${wk}.md`;
await writeFile(join(ROOT,out), md);
console.log(`✓ The Week written: ${out}${DRY?" (dry-run)":""}`);
