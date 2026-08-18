// scripts/generate-pulse.mjs — The Morning Pulse
// A one-page daily brief the machine writes about what it saw. Reads every
// instrument, publishes research/pulse/YYYY-MM-DD.md. Trust Standard applies:
// only numbers that exist in the data, provenance inline, calibration honest.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().split("T")[0];
const cardImg = id => { const m=/^(.+)-(\w+)$/.exec(id||""); return m?`https://images.pokemontcg.io/${m[1]}/${m[2]}.png`:null; };
let __tcgIds = {};
const sealedImg = p => p.representativeImage
  || (__tcgIds[p.id] ? `https://tcgplayer-cdn.tcgplayer.com/product/${__tcgIds[p.id]}_in_400x400.jpg` : null)
  || p.image || null;
const J = async p => { try { return JSON.parse(await readFile(join(ROOT,p),"utf-8")); } catch { return null; } };

const sp = await J("data/sealed-prices.json");
try { const cm = await J("data/crosscheck-id-map.json");
  for (const e of (cm.entries||[])) if (e.reviewed && !e.exclude && e.tcgPlayerId) __tcgIds[e.id] = e.tcgPlayerId;
} catch {}

const div = await J("data/divergence-report.json");
const heat = await J("data/heat-report.json");
const sg = await J("data/singles-prices.json");
const radar = await J("data/release-radar.json");
const der = await J("data/derived-insights.json");

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
md += `## The instrument panel\n- **${sp.products.length} sealed products tracked** · ${live.length} live · ${noMkt} no-active-market (honest) · run ${sp.updatedAt?.slice(0,16)}Z\n- **Heat reads:** calibrating — day ${heatDays} of 8 clean days (return ~Aug 26)\n- **The Spread:** ${div?.counts?.compared??0} sealed cross-checked · **${sigs.length} signals** · ${div?.counts?.skipped??0} excluded with reasons\n\n`;
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
const t3 = der?.dailyThree;
if (t3 && (t3.sealed||t3.graded||t3.raw)) {
  md += `\n## 🎯 The Daily Three\n`;
  if (t3.sealed) md += `- **SEALED:** ${t3.sealed.name} — eBay $${t3.sealed.ebay} vs TCG $${t3.sealed.tcg} (${t3.sealed.spreadPct>0?"+":""}${t3.sealed.spreadPct}%). ${t3.sealed.reason}.\n`;
  md += t3.graded ? `- **GRADED:** ${t3.graded.name} — raw $${t3.graded.raw} → PSA10 $${t3.graded.psa10} (premium +$${t3.graded.premium}). ${t3.graded.reason}.\n`
                  : `- **GRADED:** calibrating — returns with the Grading Premium table.\n`;
  if (t3.raw) md += `- **RAW:** ${t3.raw.name} (${t3.raw.set}) — $${t3.raw.price}. ${t3.raw.reason}.\n`;
}
if (der?.catalysts?.length) {
  md += `\n## 📡 Catalyst reads (house theses: research/house-theses.md)\n`;
  for (const c of der.catalysts.slice(0,4)) md += `- **${c.class.toUpperCase()}·${c.horizon}** — ${c.note}\n`;
}
if (der?.packMath) {
  md += `\n## 🧮 Pack Math — $ per sealed pack (arithmetic, no estimation)\n`;
  for (const r of der.packMath.priciest.slice(0,3)) md += `- ${r.name}: **$${r.perPack}/pack**${r.sealedPremiumPct!=null?` · loose $${r.loosePack} → **${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}% sealed premium**`:` · loose — (feed landing)`}\n`;
  md += `- …\n`;
  for (const r of der.packMath.cheapest.slice(0,3)) md += `- ${r.name}: **$${r.perPack}/pack**${r.sealedPremiumPct!=null?` · loose $${r.loosePack} → ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}% sealed premium`:``}\n`;
}
if (der?.narrative) {
  if (der?.printWatch?.length) {
  const near = der.printWatch.filter(r=>r.eol.status==="printing").slice(0,2);
  md += `\n## ⏳ Print watch\n`;
  for (const r of near) md += `- **${r.set}** — est. print window closes in ~${r.eol.daysLeftEst} days (30-month model) · ${r.supply} listings tracked\n`;
  if (der.tightening?.length) md += `- 🔒 Tightening: ${der.tightening.map(t=>t.set).join(" · ")} — out of print, low supply, no reprint news\n`;
}
md += `\n## 📣 In today's Pokémon news\n`;
  for (const r of der.narrative.inNews.slice(0,4)) md += `- **${r.set}** — top product sits at $${r.price}${r.spreadPct!=null?`, asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay than TCGplayer`:""}\n`;
  md += `\n## 🤫 Moving without headlines\n`;
  for (const r of der.narrative.quietMovers.slice(0,4)) md += `- **${r.flagship}** — $${r.price}, asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay than TCGplayer — and nobody's covering it\n`;
}
if (upcoming.length) {
  md += `\n## Radar — next up\n`;
  for (const r of upcoming) md += `- **${r.date||r.releaseDate}** — ${r.name||r.title}\n`;
}
md += `\n---\n*Catch'em. Catch Feels. — pulse #${today.replaceAll("-","")}*\n`;
await mkdir(join(ROOT,"research/pulse"),{recursive:true});
await writeFile(join(ROOT,`research/pulse/${today}.md`), md);

// ── HTML edition: the human-facing morning brief (same data, designed) ──
const sigCards = sigs.slice(0,6).map(r=>`
  <div class="sig"><div class="sighead"><span class="pct" title="eBay ask vs TCGplayer price">${r.spreadPct>0?"+":""}${r.spreadPct}% gap</span><span class="signame">${r.name}</span></div>
  <div class="sigsub">eBay <b>$${r.ebayAskMedian}</b> <span class="sup">· ${r.ebayListings??"—"} listings</span> &nbsp;vs&nbsp; TCG <b>$${r.tcgMarket}</b> <span class="sup">· supply ${r.tcgListings??"—"}</span></div>
  <div class="sigread">${r.read}</div></div>`).join("");
const supNote = sigs.some(r=>r.tcgListings==null) ? `<div class="foot">* TCG-side supply: provider exposes no sealed listing counts — slot is wired; lights up the day they ship it.</div>` : "";
const deepRows = (der?.depthReads??[]).map(r=>`<div class="row"><span>${r.tag} ${r.name} <em>${r.read}</em></span><span class="mono">$${r.price} · ${r.listings}L</span></div>`).join("") + `<div class="foot">Depth read = Active Listings (measured) × flow (Buy Pressure est.) · unlocks at 3 clean days per product.</div>`;
const chaseRows = chases.map(c=>`<div class="row"><span style="display:flex;align-items:center;gap:10px">${cardImg(c.cardId)?`<img class="thumb" style="width:34px" src="${cardImg(c.cardId)}" alt="">`:""}<span>${c.name} <em>${c.setName}</em></span></span><span class="mono">$${c.priceMarket}</span></div>`).join("");
const radarRows = upcoming.map(r=>`<div class="row"><span>${r.name||r.title}</span><span class="mono">${r.date||r.releaseDate}</span></div>`).join("");
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<title>Morning Pulse — ${today} · Catch'em</title><style>
:root{--bg:#0b0d14;--panel:#141824;--line:rgba(255,255,255,.07);--txt:#d8dde8;--dim:#8a93a8;--gold:#ffb84d;--green:#36d399}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:15px/1.55 'Sora',system-ui,sans-serif;max-width:680px;margin:0 auto;padding:36px 20px 60px}
.kicker{font:11px 'JetBrains Mono',monospace;letter-spacing:.14em;color:var(--gold)}
h1{font-size:34px;letter-spacing:-.5px;margin:6px 0 2px}h1 span{color:var(--dim);font-weight:400}
.byline{color:var(--dim);font-size:13px;margin-bottom:22px}
.panel{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:26px}
.stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 12px;text-align:center}
.stat b{display:block;font:22px 'JetBrains Mono',monospace;color:var(--txt)}
.stat i{font-style:normal;font-size:11px;color:var(--dim)}
h2{font-size:13px;font-family:'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:26px 0 10px}
.sig{display:flex;gap:12px;align-items:center;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:8px;padding:12px 14px;margin-bottom:8px}
.sighead{display:flex;gap:12px;align-items:baseline}.pct{font:16px 'JetBrains Mono',monospace;color:var(--gold)}
.signame{font-weight:600}.sigsub{font-size:13px;color:var(--dim);margin-top:3px}.sigsub b{color:var(--txt)}.sup{font:11px 'JetBrains Mono',monospace;color:var(--dim)}.sigread{font-size:12px;color:var(--dim);margin-top:4px;font-style:italic}.foot{font:11px 'JetBrains Mono',monospace;color:var(--dim);margin-top:8px}
.row{display:flex;justify-content:space-between;gap:12px;padding:9px 2px;border-bottom:1px solid var(--line)}
.row em{color:var(--dim);font-style:normal;font-size:12px}.mono{font:13px 'JetBrains Mono',monospace;color:var(--txt);white-space:nowrap}
.calib{margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:11px 14px;font:12px 'JetBrains Mono',monospace;color:var(--dim)}
footer{margin-top:30px;font:12px 'JetBrains Mono',monospace;color:var(--dim)}
.thumb{width:46px;height:auto;border-radius:6px;flex:none;border:1px solid rgba(255,255,255,.07)}.thumb.logo{width:56px;background:#0b0d14;padding:4px}.sigbody{flex:1}
</style></head><body>
<div class="kicker">CATCH'EM · MORNING PULSE</div>
<h1>☀️ ${today} <span>#${today.replaceAll("-","")}</span></h1>
<div class="byline">Written by the machine at ${new Date().toISOString().slice(11,16)} UTC · every number is live production data</div>
<div class="panel">
  <div class="stat"><b>${sp.products.length}</b><i>sealed products TRACKED</i></div>
  <div class="stat"><b>${sigs.length}</b><i>SPREAD SIGNALS</i></div>
  <div class="stat"><b>${heatDays}/8</b><i>READS CALIBRATING</i></div>
</div>
${sigs.length?`<h2>⚡ Biggest price gaps between eBay and TCGplayer</h2><div class="foot" style="margin:-2px 0 10px">eBay usually runs a little higher on sealed — photos let buyers see exactly what they're getting. We flag the gaps beyond that.</div>${sigCards}${supNote}`:""}
<h2>Deepest markets</h2>${deepRows}
<h2>Chase board · TCGplayer market</h2>${chaseRows}
${(der?.dailyThree&&(der.dailyThree.sealed||der.dailyThree.raw))?`<h2>🎯 The Daily Three</h2>
${der.dailyThree.sealed?`<div class="sig">${(()=>{const pr=sp.products.find(x=>x.name===der.dailyThree.sealed.name);const u=pr&&sealedImg(pr);return u?`<img class="thumb logo" src="${u}" alt="">`:"";})()}<div class="sigbody"><div class="sighead"><span class="pct">SEALED</span><span class="signame">${der.dailyThree.sealed.name}</span></div><div class="sigsub">eBay <b>$${der.dailyThree.sealed.ebay}</b> vs TCG <b>$${der.dailyThree.sealed.tcg}</b> </div><div class="sigread">eBay asks ${Math.abs(der.dailyThree.sealed.spreadPct)}% ${der.dailyThree.sealed.spreadPct>0?"more":"less"} than TCGplayer</div><div class="sigread">${der.dailyThree.sealed.reason}</div></div></div>`:""}
<div class="sig" style="border-left-color:${der.dailyThree.graded?"var(--gold)":"var(--line)"}"><div class="sighead"><span class="pct">GRADED</span><span class="signame">${der.dailyThree.graded?der.dailyThree.graded.name:"calibrating"}</span></div><div class="sigsub">${der.dailyThree.graded?`raw <b>$${der.dailyThree.graded.raw}</b> → PSA10 <b>$${der.dailyThree.graded.psa10}</b> · premium +$${der.dailyThree.graded.premium}`:"returns with the Grading Premium table"}</div></div>
${der.dailyThree.raw?`<div class="sig">${(()=>{const c=(sg?.cards||[]).find(x=>x.name===der.dailyThree.raw.name&&x.setName===der.dailyThree.raw.set);const u=c&&cardImg(c.cardId);return u?`<img class="thumb" src="${u}" alt="">`:"";})()}<div class="sigbody"><div class="sighead"><span class="pct">RAW</span><span class="signame">${der.dailyThree.raw.name}</span></div><div class="sigsub"><b>$${der.dailyThree.raw.price}</b> · ${der.dailyThree.raw.set}</div><div class="sigread">${der.dailyThree.raw.reason}</div></div></div>`:""}
`:""}
${der?.catalysts?.length?`<h2>📡 Catalyst reads</h2>${der.catalysts.slice(0,4).map(c=>`<div class="row"><span>${c.note}</span><span class="mono">${c.class.toUpperCase()}·${c.horizon}</span></div>`).join("")}`:""}
${der?.packMath?`<h2>🧮 Pack math — $ per sealed pack</h2>
${der.packMath.priciest.slice(0,3).map(r=>`<div class="row"><span>${r.name}${r.sealedPremiumPct!=null?` <em>vs loose $${r.loosePack}</em>`:""}</span><span class="mono">$${r.perPack}/pk${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}%`:""}</span></div>`).join("")}
<div class="row" style="border-bottom:0"><span style="color:var(--dim)">···</span><span></span></div>
${der.packMath.cheapest.slice(0,3).map(r=>`<div class="row"><span>${r.name}${r.sealedPremiumPct!=null?` <em>vs loose $${r.loosePack}</em>`:""}</span><span class="mono">$${r.perPack}/pk${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}%`:""}</span></div>`).join("")}`:""}
${der?.narrative?`${der?.printWatch?.length?`<h2>⏳ Print watch</h2>${der.printWatch.filter(r=>r.eol.status==="printing").slice(0,2).map(r=>`<div class="row"><span>${r.set}<em> est. window closes ~${r.eol.daysLeftEst}d (30-mo model)</em></span><span class="mono">${r.supply} listings</span></div>`).join("")}${der.tightening?.length?`<div class="row"><span>🔒 Tightening<em> out of print · low supply · no reprint news</em></span><span class="mono">${der.tightening.map(t=>t.set.split(" ")[0]).join(" · ")}</span></div>`:""}`:""}
<h2>📣 In today's Pokémon news</h2>
${der.narrative.inNews.slice(0,3).map(r=>`<div class="row"><span>${r.set}<em>${r.spreadPct!=null?` asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay than TCGplayer`:""}</em></span><span class="mono">$${r.price}</span></div>`).join("")}
<h2>🤫 Moving without headlines</h2>
${der.narrative.quietMovers.slice(0,3).map(r=>`<div class="row"><span>${r.flagship}<em> asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay — no coverage anywhere ⚡</em></span><span class="mono">$${r.price}</span></div>`).join("")}`:""}
${upcoming.length?`<h2>Radar</h2>${radarRows}`:""}
<div class="calib">HEAT READS: day ${heatDays} of 8 clean days — Wyckoff states return ~Aug 26. We publish nothing false in the meantime.</div>
<footer>Catch'em. Catch Feels. · prices: Catchem-data, eBay active listings (measured) · spread: internal instrument</footer>
</body></html>`;
await writeFile(join(ROOT,`research/pulse/${today}.html`), html);
await writeFile(join(ROOT,`research/assets/the-pulse.html`), html);

// ── Machine-readable feed for the app's Ticker (no HTML scraping, ever) ──
const feed = {
  generatedAt: new Date().toISOString(), date: today,
  panel: { skusTracked: sp.products.length, signals: sigs.length,
           calibrationDay: Number(heatDays)||null, calibrationOf: 8, heatMode: heat?.mode||null },
  signals: sigs.slice(0,8).map(r=>({ id:r.id, name:r.name, imageUrl: sealedImg(sp.products.find(x=>x.id===r.id)||{}), spreadPct:r.spreadPct,
    ebay:{ ask:r.ebayAskMedian, listings:r.ebayListings??null },
    tcg:{ market:r.tcgMarket, listings:r.tcgListings??null },
    read:r.read, provenance:r.provenance, class:"VERIFIED" })),
  quietMovers: (der?.narrative?.quietMovers??[]).slice(0,4).map(q=>({...q, class:"READ"})),
  dailyThree: der?.dailyThree ?? null,
  depthReads: der?.depthReads ?? [],
  lifecycle: der?.lifecycle ?? {},
  printWatch: der?.printWatch ?? [],
  tightening: der?.tightening ?? [],
  rotationCohorts: der?.rotationCohorts ?? {},
  rotationContext: der?.rotationContext ?? null,
  catalysts: (der?.catalysts??[]).slice(0,4),
  packMath: der?.packMath ? { priciest: der.packMath.priciest.slice(0,3), cheapest: der.packMath.cheapest.slice(0,3), class:"VERIFIED" } : null,
  radar: upcoming.slice(0,4),
  chases: chases.map(c=>({ cardId:c.cardId, name:c.name, set:c.setName, market:c.priceMarket, imageUrl: cardImg(c.cardId),
    provenance:c.provenance, class:"VERIFIED" })),
  disclosure: "Buy Pressure is estimated from listing activity — not reported sales. Active Listings are measured.",
};
await writeFile(join(ROOT,"research/assets/pulse-feed.json"), JSON.stringify(feed,null,2)+"\n");

// ── PRINT & ROTATION WATCH page (rides this step; no workflow change) ──
if (der?.printWatch?.length) {
  const rows = der.printWatch.map(r=>`<tr><td>${r.set}</td><td class="mono">${r.ageMonths}mo</td><td>${r.eol.status==="printing"?`<b class="ok">~${r.eol.daysLeftEst}d left</b> <i class="dim">est.</i>`:`<span class="dim">out ~${r.eol.monthsOutEst}mo</span>`}</td><td class="mono">${r.supply}</td><td><span class="pill ${r.supplyTier}">${r.supplyTier.toUpperCase()}</span></td><td>${r.reprintSignal??`<span class="dim">—</span>`}</td><td>${r.standardLegal?`<b class="ok">⚖ ${r.mark}</b>`:r.mark?`<span class="dim">${r.mark} rotated</span>`:`<span class="dim">pre-mark</span>`}</td></tr>`).join("");
  const cohorts = Object.entries(der.rotationCohorts).sort().map(([m,sets])=>`<div class="co"><b>${m==="pre-mark"?"Pre-mark era":"Mark "+m}</b>${["I","J"].includes(m)?` <span class="ok">⚖ Standard-legal</span>`:m==="pre-mark"?``:` <span class="dim">rotated</span>`}<div class="dim" style="margin-top:4px">${sets.join(" · ")}</div></div>`).join("");
  const pwHtml = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet"><title>Catchem — Print &amp; Rotation Watch</title><style>
:root{--bg:#0b0d14;--panel:#141824;--line:rgba(255,255,255,.07);--txt:#f4f5f8;--dim:#8a93a8;--green:#36d399;--gold:#ffb84d}
body{background:var(--bg);color:var(--txt);font:15px/1.5 "Sora",system-ui,sans-serif;margin:0;padding:28px 16px;max-width:980px;margin-inline:auto}
h1{font-family:"Syne",sans-serif;font-size:30px;margin:0 0 4px}.sub{color:var(--dim);margin:0 0 24px;font-size:13px}
table{width:100%;border-collapse:collapse;background:var(--panel);border-radius:10px;overflow:hidden}
th{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}
td{padding:10px 12px;border-bottom:1px solid var(--line);font-size:13.5px}.mono{font-family:"JetBrains Mono",monospace}
.ok{color:var(--green)}.dim{color:var(--dim)}.pill{font-size:10px;padding:2px 7px;border-radius:99px;border:1px solid var(--line)}.pill.low{color:var(--gold);border-color:var(--gold)}
.co{background:var(--panel);border-radius:10px;padding:14px 16px;margin:10px 0;font-size:13.5px}
h2{font-family:"Syne",sans-serif;font-size:20px;margin:30px 0 10px}.foot{color:var(--dim);font-size:12px;margin-top:18px}
</style><h1>⏳ Print &amp; Rotation Watch</h1><p class="sub">${sp.generatedAt?.slice(0,10)} · print windows are a 30-month model (est.) — exact EOL dates are rarely announced · supply = active listings across a set&#39;s tracked sealed products</p>
<table><tr><th>Set</th><th>Age</th><th>Print window</th><th>Supply</th><th>Tier</th><th>Reprint signal</th><th>Legality</th></tr>${rows}</table>
<h2>Rotation cohorts</h2>${cohorts}
<div class="foot">Rotation lands each April — next: April 2027. Reprint signals accumulate from the news layer starting Aug 18, 2026; sourced history backfills over time.</div>`;
  await writeFile(new URL("../research/assets/print-watch.html", import.meta.url), pwHtml);
}

console.log("✓ pulse-feed.json (app Ticker feed) written");
console.log("✓ Pulse HTML edition written (dated + stable path)");
console.log(`✓ Morning Pulse written: research/pulse/${today}.md`);
