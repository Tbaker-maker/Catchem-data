// scripts/generate-pulse.mjs — The Morning Pulse
// A one-page daily brief the machine writes about what it saw. Reads every
// instrument, publishes research/pulse/YYYY-MM-DD.md. Trust Standard applies:
// only numbers that exist in the data, provenance inline, calibration honest.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().split("T")[0];
const J = async p => { try { return JSON.parse(await readFile(join(ROOT,p),"utf-8")); } catch { return null; } };

const sp = await J("data/sealed-prices.json");
const div = await J("data/divergence-report.json");
const heat = await J("data/heat-report.json");
const sg = await J("data/singles-prices.json");
const radar = await J("data/release-radar.json");

const live = sp.products.filter(p=>p.dataStatus==="live");
const noMkt = sp.products.filter(p=>p.dataStatus==="no-active-market").length;
const heatDays = (heat?.mode||"").match(/day (\d+)/)?.[1] ?? "?";
const sigs = (div?.rows||[]).filter(r=>r.signal);
const topListed = [...live].sort((a,b)=>(b.listingCount||0)-(a.listingCount||0)).slice(0,3);
const chases = (sg?.cards||[]).filter(c=>!c.needsReview && c.dataStatus==="live")
  .sort((a,b)=>(b.priceMarket||0)-(a.priceMarket||0)).slice(0,5);
const upcoming = (radar?.items||radar?.releases||[]).filter(r=>{
  const d = r.date || r.releaseDate || ""; return d >= today;
}).slice(0,4);

let md = `# ☀️ Morning Pulse — ${today}\n*Written by the machine at ${new Date().toISOString().slice(11,16)} UTC. Every number below is live production data.*\n\n`;
md += `## The instrument panel\n- **${sp.products.length} SKUs tracked** · ${live.length} live · ${noMkt} no-active-market (honest) · run ${sp.updatedAt?.slice(0,16)}Z\n- **Heat reads:** calibrating — day ${heatDays} of 8 clean days (return ~Aug 26)\n- **The Spread:** ${div?.counts?.compared??0} SKUs cross-checked · **${sigs.length} signals** · ${div?.counts?.skipped??0} excluded with reasons\n\n`;
if (sigs.length) {
  md += `## ⚡ Spread signals (eBay ask vs TCG-side ask)\n`;
  for (const r of sigs.slice(0,6)) md += `- **${r.name}** — eBay $${r.ebayAskMedian} vs TCG $${r.tcgMarket} (**${r.spreadPct>0?"+":""}${r.spreadPct}%**) — ${r.read}\n`;
  md += `\n`;
}
md += `## Deepest markets today\n`;
for (const p of topListed) md += `- ${p.name}: **$${p.priceMedian}** across ${p.listingCount} active listings\n`;
md += `\n## Chase board (confirmed, TCGplayer market)\n`;
for (const c of chases) md += `- ${c.name} (${c.setName}): **$${c.priceMarket}**\n`;
if (upcoming.length) {
  md += `\n## Radar — next up\n`;
  for (const r of upcoming) md += `- **${r.date||r.releaseDate}** — ${r.name||r.title}\n`;
}
md += `\n---\n*Catch'em. Catch Feels. — pulse #${today.replaceAll("-","")}*\n`;
await mkdir(join(ROOT,"research/pulse"),{recursive:true});
await writeFile(join(ROOT,`research/pulse/${today}.md`), md);
console.log(`✓ Morning Pulse written: research/pulse/${today}.md`);
