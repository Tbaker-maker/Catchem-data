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
  for (const r of sigs.slice(0,6)) md += `- **${r.name}** — eBay $${r.ebayAskMedian} (${r.ebayListings??"—"} listings) vs TCG $${r.tcgMarket} (supply ${r.tcgListings??"—"}) (**${r.spreadPct>0?"+":""}${r.spreadPct}%**) — ${r.read}\n`;
  if (sigs.some(r=>r.tcgListings==null)) md += `\n*TCG-side supply: provider exposes no sealed listing counts — slot is wired, lights up the day they ship it.*\n`;
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

// ── HTML edition: the human-facing morning brief (same data, designed) ──
const sigCards = sigs.slice(0,6).map(r=>`
  <div class="sig"><div class="sighead"><span class="pct">${r.spreadPct>0?"+":""}${r.spreadPct}%</span><span class="signame">${r.name}</span></div>
  <div class="sigsub">eBay <b>$${r.ebayAskMedian}</b> <span class="sup">· ${r.ebayListings??"—"} listings</span> &nbsp;vs&nbsp; TCG <b>$${r.tcgMarket}</b> <span class="sup">· supply ${r.tcgListings??"—"}</span></div>
  <div class="sigread">${r.read}</div></div>`).join("");
const supNote = sigs.some(r=>r.tcgListings==null) ? `<div class="foot">* TCG-side supply: provider exposes no sealed listing counts — slot is wired; lights up the day they ship it.</div>` : "";
const deepRows = topListed.map(p=>`<div class="row"><span>${p.name}</span><span class="mono">$${p.priceMedian} · ${p.listingCount} listings</span></div>`).join("");
const chaseRows = chases.map(c=>`<div class="row"><span>${c.name} <em>${c.setName}</em></span><span class="mono">$${c.priceMarket}</span></div>`).join("");
const radarRows = upcoming.map(r=>`<div class="row"><span>${r.name||r.title}</span><span class="mono">${r.date||r.releaseDate}</span></div>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Morning Pulse — ${today} · Catch'em</title><style>
:root{--bg:#0b0d14;--panel:#12141d;--line:#232736;--txt:#d8dde8;--dim:#8a93a8;--gold:#F5C842;--green:#36d399}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:15px/1.55 'Trebuchet MS',system-ui,sans-serif;max-width:680px;margin:0 auto;padding:36px 20px 60px}
.kicker{font:11px 'Courier New',monospace;letter-spacing:.14em;color:var(--gold)}
h1{font-size:34px;letter-spacing:-.5px;margin:6px 0 2px}h1 span{color:var(--dim);font-weight:400}
.byline{color:var(--dim);font-size:13px;margin-bottom:22px}
.panel{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:26px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 12px;text-align:center}
.stat b{display:block;font:22px 'Courier New',monospace;color:var(--txt)}
.stat i{font-style:normal;font-size:11px;color:var(--dim)}
h2{font-size:13px;font-family:'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:26px 0 10px}
.sig{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:8px;padding:12px 14px;margin-bottom:8px}
.sighead{display:flex;gap:12px;align-items:baseline}.pct{font:16px 'Courier New',monospace;color:var(--gold)}
.signame{font-weight:600}.sigsub{font-size:13px;color:var(--dim);margin-top:3px}.sigsub b{color:var(--txt)}.sup{font:11px 'Courier New',monospace;color:var(--dim)}.sigread{font-size:12px;color:var(--dim);margin-top:4px;font-style:italic}.foot{font:11px 'Courier New',monospace;color:var(--dim);margin-top:8px}
.row{display:flex;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid var(--line)}
.row em{color:var(--dim);font-style:normal;font-size:12px}.mono{font:13px 'Courier New',monospace;color:var(--txt);white-space:nowrap}
.calib{margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:11px 14px;font:12px 'Courier New',monospace;color:var(--dim)}
footer{margin-top:30px;font:12px 'Courier New',monospace;color:var(--dim)}
</style></head><body>
<div class="kicker">CATCH'EM · MORNING PULSE</div>
<h1>☀️ ${today} <span>#${today.replaceAll("-","")}</span></h1>
<div class="byline">Written by the machine at ${new Date().toISOString().slice(11,16)} UTC · every number is live production data</div>
<div class="panel">
  <div class="stat"><b>${sp.products.length}</b><i>SKUs TRACKED</i></div>
  <div class="stat"><b>${sigs.length}</b><i>SPREAD SIGNALS</i></div>
  <div class="stat"><b>${heatDays}/8</b><i>READS CALIBRATING</i></div>
</div>
${sigs.length?`<h2>⚡ Spread signals — price &amp; supply, both markets</h2>${sigCards}${supNote}`:""}
<h2>Deepest markets</h2>${deepRows}
<h2>Chase board · TCGplayer market</h2>${chaseRows}
${upcoming.length?`<h2>Radar</h2>${radarRows}`:""}
<div class="calib">HEAT READS: day ${heatDays} of 8 clean days — Wyckoff states return ~Aug 26. We publish nothing false in the meantime.</div>
<footer>Catch'em. Catch Feels. · prices: Catchem-data, eBay active listings (measured) · spread: internal instrument</footer>
</body></html>`;
await writeFile(join(ROOT,`research/pulse/${today}.html`), html);
await writeFile(join(ROOT,`research/assets/the-pulse.html`), html);
console.log("✓ Pulse HTML edition written (dated + stable path)");
console.log(`✓ Morning Pulse written: research/pulse/${today}.md`);
