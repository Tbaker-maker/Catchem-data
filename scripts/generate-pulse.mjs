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

// Email capture (retention hedge: iOS PWA push is unreliable, email is the
// backstop). Posts to the LIVE Formspree waitlist — the same list newsletter
// 001 imports from. TODO(Tyler): claim a buttondown.com username, set it here
// AND in catchem-app/src/Ticker.jsx — the two capture points flip together.
const BUTTONDOWN_USERNAME = "catchemtcg";
const CAPTURE_URL = BUTTONDOWN_USERNAME
  ? `https://buttondown.com/api/emails/embed-subscribe/${BUTTONDOWN_USERNAME}`
  : "https://formspree.io/f/xgorlypa";
const captureBlock = `<div style="margin-top:26px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px">
<b style="font-size:15px">Get the Morning Pulse in your inbox</b>
<div style="font-size:12px;color:var(--dim);margin:4px 0 10px">Same page, delivered every morning. No spam, unsubscribe anytime.</div>
<form id="cap" style="display:flex;gap:8px">
<input name="email" type="email" required placeholder="you@example.com" aria-label="email address" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:10px 12px;font:13px 'Sora',sans-serif">
<button type="submit" style="background:var(--green);border:0;color:#0b0d14;font:700 13px 'Sora',sans-serif;border-radius:8px;padding:10px 16px;cursor:pointer">Send it</button>
</form>
<div id="capmsg" style="font-size:12px;color:var(--dim);margin-top:8px"></div>
<script>document.getElementById("cap").addEventListener("submit",async e=>{e.preventDefault();const f=e.target,m=document.getElementById("capmsg");m.textContent="sending…";try{const r=await fetch("${CAPTURE_URL}",{method:"POST",body:new FormData(f),headers:{Accept:"application/json"}});if(!r.ok)throw 0;f.style.display="none";m.textContent="✓ You're on the list — the Pulse lands from the next send.";}catch{m.textContent="Couldn't reach the list — try again in a moment."}});</script>
</div>`;

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
  if (t3.sealed) md += `- **SEALED:** ${t3.sealed.name} — eBay $${t3.sealed.ebay} vs TCG $${t3.sealed.tcg}. ${t3.sealed.reason}.\n  ${t3.sealed.explain}\n`;
  md += t3.graded ? `- **GRADED:** ${t3.graded.name} — ${t3.graded.reason}.\n  ${t3.graded.explain}\n`
                  : `- **GRADED:** calibrating — returns with the Grading Premium table.\n`;
  if (t3.raw) md += `- **RAW:** ${t3.raw.name} — $${t3.raw.price}. ${t3.raw.reason}.\n  ${t3.raw.explain}\n`;
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
  if (der?.topicHits?.length) {
  md += `\n## 🔎 Watched topics\n`;
  for (const t of der.topicHits) md += `- **${t.topic}** — ${t.hits.map(h=>`${h.where}: ${h.detail}`).join(" · ")}\n`;
}
if (der?.cohortCompare) { const c=der.cohortCompare;
  md += `\n## 🧬 Specialty vs mainline (today's cross-section)\n- Specialty: ${c.specialty.sets} sets · ${c.specialty.supplyPerProduct} listings/product · $${c.specialty.avgPerPack}/pack avg\n- Mainline: ${c.mainline.sets} sets · ${c.mainline.supplyPerProduct} listings/product · $${c.mainline.avgPerPack}/pack avg\n- Taper curves accumulate daily from Aug 18 — the new-print-facility question gets answered with data.\n`; }
if (der?.sealedIndex) { const six = der.sealedIndex;
  md += `\n## 📈 CATCH'EM SEALED INDEX: **${six.level}**${six.ddPct!=null?` (${six.ddPct>0?"▲":"▼"} ${Math.abs(six.ddPct)}% vs yesterday)`:" — baseline era, day 2"} · ${six.constituents} sealed products · breadth ▲${six.breadth.up} ▼${six.breadth.down}\n*One number for the whole sealed market. New here? The five-year-old version lives on the methodology page — you will get it in thirty seconds.*\n`;
}
if (der?.watchOutcomes?.sealed?.dPct != null || der?.watchOutcomes?.raw?.dPct != null) {
  md += `\n## 📊 Yesterday's watches, revisited\n`;
  const w = der.watchOutcomes;
  if (w.sealed?.dPct != null) md += `- Sealed — **${w.sealed.name}**: ${w.sealed.dPct>0?"▲":w.sealed.dPct<0?"▼":"·"} ${Math.abs(w.sealed.dPct)}% since we flagged it.\n`;
  if (w.raw?.dPct != null) md += `- Raw — **${w.raw.name}**: ${w.raw.dPct>0?"▲":w.raw.dPct<0?"▼":"·"} ${Math.abs(w.raw.dPct)}% since.\n`;
  md += `*We keep our own score — hits and misses both.*\n`;
}
if (der?.subtypeIndexes?.length) md += `\n**Product-class indexes:** ${der.subtypeIndexes.map(s=>`${s.subtype} ${s.level}`).join(" · ")} *(same equation, shelves by class)*\n`;
if (der?.supplyShifts?.length) {
  md += `\n## 🌊 Supply shifts\n`;
  for (const x of der.supplyShifts.slice(0,5)) md += `- **${x.name}** — listings ${x.prev}→${x.listings} (**${x.dPct>0?"+":""}${x.dPct}%**)${x.priceDPct!=null?`, price ${x.priceDPct>0?"+":""}${x.priceDPct}%`:""}. ${x.read}${x.catalystMatch?` · ${x.catalystMatch}`:""}.\n`;
  md += `*Shelf math, plainly: how many are for sale vs yesterday — and what usually causes a swing that size.*\n`;
}
md += `\n## 🏛 Generation indexes\n`;
for (const e of (der?.eraIndexes??[])) md += `- **${e.era}** — ${e.boxMedian?`boxes $${e.boxMedian.toLocaleString("en-US")} · `:""}all-products median $${e.level.toLocaleString("en-US")} · ${e.avgGapPct!=null?`asking ${Math.abs(e.avgGapPct)}% ${e.avgGapPct>=0?"more":"less"} on eBay than TCGplayer · `:""}${e.products} products · ${e.listingsPerProduct} listings each. ${e.read}.\n`;
md += `*Baseline 100 set today — era momentum lines start tomorrow.*\n`;
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
// Sandbox rule: plain-words labels ride the display path DARK until each
// instrument's debut date (lib gates) — launches arrive pre-translated.
const { HEAT_DEBUT, DEPTH_DEBUT, heatPlain, depthPlain } = await import("./lib/instruments.mjs");
const depthReadOf = r => (today >= DEPTH_DEBUT && depthPlain[r.flow])
  ? `${depthPlain[r.flow].label} — ${depthPlain[r.flow].plain}`
  : r.read;
const deepRows = (der?.depthReads??[]).map(r=>`<div class="row"><span>${r.tag} ${r.name} <em>${depthReadOf(r)}</em></span><span class="mono">$${r.price} · ${r.listings}L</span></div>`).join("") + `<div class="foot">Depth read = Active Listings (measured) × flow (Buy Pressure est.) · unlocks at 3 clean days per product.</div>`;
const heatReads = Array.isArray(heat?.reads) ? heat.reads : [];
const heatSection = (today >= HEAT_DEBUT && heatReads.length)
  ? `<h2>🌦 Heat reads — the weather on the shelf</h2>` + heatReads.slice(0, 8).map(r => {
      const w = heatPlain[r.state] || { emoji: "", label: r.state, plain: r.read || "" };
      return `<div class="row"><span>${w.emoji} <b>${r.name || r.id}</b><em> ${w.label} — ${w.plain}</em></span><span class="mono">${r.confidence || ""}</span></div>`;
    }).join("")
  : "";
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
.idxhead{display:flex;justify-content:space-between;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 16px}
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
${der.dailyThree.sealed?`<div class="sig">${(()=>{const pr=sp.products.find(x=>x.name===der.dailyThree.sealed.name);const u=pr&&sealedImg(pr);return u?`<img class="thumb logo" src="${u}" alt="">`:"";})()}<div class="sigbody"><div class="sighead"><span class="pct">SEALED</span><span class="signame">${der.dailyThree.sealed.name}</span></div><div class="sigsub">eBay <b>$${der.dailyThree.sealed.ebay}</b> vs TCG <b>$${der.dailyThree.sealed.tcg}</b> </div><div class="sigread">eBay asks ${Math.abs(der.dailyThree.sealed.spreadPct)}% ${der.dailyThree.sealed.spreadPct>0?"more":"less"} than TCGplayer</div><div class="sigread">${der.dailyThree.sealed.explain??der.dailyThree.sealed.reason}</div></div></div>`:""}
<div class="sig" style="border-left-color:${der.dailyThree.graded?"var(--gold)":"var(--line)"}"><div class="sighead"><span class="pct">GRADED</span><span class="signame">${der.dailyThree.graded?der.dailyThree.graded.name:"calibrating"}</span></div><div class="sigsub">${der.dailyThree.graded?`raw <b>$${der.dailyThree.graded.raw}</b> → PSA10 <b>$${der.dailyThree.graded.psa10}</b> · premium +$${der.dailyThree.graded.premium}`:"returns with the Grading Premium table"}</div>${der.dailyThree.graded?`<div class="sigread">${der.dailyThree.graded.explain}</div>`:""}</div>
${der.dailyThree.raw?`<div class="sig">${(()=>{const c=(sg?.cards||[]).find(x=>x.name===der.dailyThree.raw.name&&x.setName===der.dailyThree.raw.set);const u=c&&cardImg(c.cardId);return u?`<img class="thumb" src="${u}" alt="">`:"";})()}<div class="sigbody"><div class="sighead"><span class="pct">RAW</span><span class="signame">${der.dailyThree.raw.name}</span></div><div class="sigsub"><b>$${der.dailyThree.raw.price}</b> · ${der.dailyThree.raw.set}</div><div class="sigread">${der.dailyThree.raw.explain}</div></div></div>`:""}
`:""}
${der?.catalysts?.length?`<h2>📡 Catalyst reads</h2>${der.catalysts.slice(0,4).map(c=>`<div class="row"><span>${c.note}</span><span class="mono">${c.class.toUpperCase()}·${c.horizon}</span></div>`).join("")}`:""}
${der?.packMath?`<h2>🧮 Pack math — $ per sealed pack</h2>
${der.packMath.priciest.slice(0,3).map(r=>`<div class="row"><span>${r.name}${r.sealedPremiumPct!=null?` <em>vs loose $${r.loosePack}</em>`:""}</span><span class="mono">$${r.perPack}/pk${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}%`:""}</span></div>`).join("")}
<div class="row" style="border-bottom:0"><span style="color:var(--dim)">···</span><span></span></div>
${der.packMath.cheapest.slice(0,3).map(r=>`<div class="row"><span>${r.name}${r.sealedPremiumPct!=null?` <em>vs loose $${r.loosePack}</em>`:""}</span><span class="mono">$${r.perPack}/pk${r.sealedPremiumPct!=null?` · ${r.sealedPremiumPct>0?"+":""}${r.sealedPremiumPct}%`:""}</span></div>`).join("")}`:""}
${der?.narrative?`${der?.topicHits?.length?`<h2>🔎 Watched topics</h2>${der.topicHits.map(t=>`<div class="row"><span>${t.topic}<em> ${t.hits.map(h=>h.where).join(" · ")}</em></span><span class="mono" style="max-width:55%;text-align:right">${t.hits[0].detail.slice(0,64)}${t.hits[0].detail.length>64?"…":""}</span></div>`).join("")}`:""}
${der?.sealedIndex?`<div class="idxhead"><div><div class="lbl" style="font-size:10px;letter-spacing:.09em;color:var(--dim)">CATCH'EM SEALED INDEX</div><div style="font-family:'JetBrains Mono';font-size:34px;font-weight:700">${der.sealedIndex.level}${der.sealedIndex.ddPct!=null?` <span style="font-size:16px;color:${der.sealedIndex.ddPct>=0?"var(--green)":"#ef5a5a"}">${der.sealedIndex.ddPct>0?"▲":"▼"} ${Math.abs(der.sealedIndex.ddPct)}%</span>`:""}</div></div><div class="mono" style="text-align:right;color:var(--dim);font-size:12px">${der.sealedIndex.constituents} sealed products<br>breadth ▲${der.sealedIndex.breadth.up} ▼${der.sealedIndex.breadth.down}<br><a href="/methodology.html" style="color:var(--green)">methodology →</a></div></div${der?.rawIndex?`<div class="foot" style="margin:-8px 0 14px">Raw Chase Index <b class="mono">${der.rawIndex.level}</b> (${der.rawIndex.constituents} chases, baseline ${der.rawIndex.baselineDate}) · Graded Index: same equation, awaits licensed daily feed</div>`:""}`:""}
${der?.eraIndexes?.length?`<h2>\ud83c\udfdb Generation indexes</h2>${der.eraIndexes.map(e=>`<div class="row"><span><b>${e.era}</b><em> ${e.products} products \u00b7 ${e.avgGapPct!=null?`asking ${Math.abs(e.avgGapPct)}% ${e.avgGapPct>=0?"more":"less"} than TCGplayer \u00b7 `:"eBay-native era \u00b7 "}${e.listingsPerProduct} listings each</em></span><span class="mono">${e.boxMedian?`$${e.boxMedian.toLocaleString("en-US")}`:`$${e.level.toLocaleString("en-US")}`}</span></div>`).join("")}${der?.supplyShifts?.length?`<h2>\ud83c\udf0a Supply shifts</h2>${der.supplyShifts.slice(0,5).map(x=>`<div class="row"><span><b>${x.name}</b><em> ${x.prev}\u2192${x.listings} listings${x.priceDPct!=null?` \u00b7 price ${x.priceDPct>0?"+":""}${x.priceDPct}%`:""} \u00b7 ${x.read}${x.catalystMatch?` \u00b7 ${x.catalystMatch}`:""}</em></span><span class="mono" style="color:${x.dPct>0?"var(--gold)":"var(--green)"}">${x.dPct>0?"+":""}${x.dPct}%</span></div>`).join("")}<div class="foot">Shelf count vs yesterday \u00b7 cause candidates, never verdicts \u00b7 gated at 20+ listings so small shelves can\u2019t fake big percents.</div>`:""}
<div class="foot">Bold figure = median BOOSTER BOX (the anchor collectors price eras by); packs and bundles keep the all-products median lower — both shown. Baseline 100 today \u2014 momentum lines grow from tomorrow.</div>`:""}
${der?.watchOutcomes && (der.watchOutcomes.sealed?.dPct!=null||der.watchOutcomes.raw?.dPct!=null)?`<h2>\ud83d\udcca Yesterday's watches, revisited</h2>${["sealed","raw"].map(k=>{const w=der.watchOutcomes[k];return w&&w.dPct!=null?`<div class="row"><span><b>${w.name}</b><em> ${k} watch</em></span><span class="mono" style="color:${w.dPct>0?"var(--green)":w.dPct<0?"#ef5a5a":"var(--dim)"}">${w.dPct>0?"\u25b2":w.dPct<0?"\u25bc":"\u00b7"} ${Math.abs(w.dPct)}%</span></div>`:""}).join("")}<div class="foot">We keep our own score \u2014 hits and misses both.</div>`:""}
${der?.subtypeIndexes?.length?`<div class="foot" style="margin:-6px 0 14px">Product-class indexes: ${der.subtypeIndexes.map(s=>`${s.subtype} <b class="mono">${s.level}</b>`).join(" \u00b7 ")}</div>`:""}
${der?.printWatch?.length?`<h2>⏳ Print watch</h2>${der.printWatch.filter(r=>r.eol.status==="printing").slice(0,2).map(r=>`<div class="row"><span>${r.set}<em> est. window closes ~${r.eol.daysLeftEst}d (30-mo model)</em></span><span class="mono">${r.supply} listings</span></div>`).join("")}${der.tightening?.length?`<div class="row"><span>🔒 Tightening<em> out of print · low supply · no reprint news</em></span><span class="mono">${der.tightening.map(t=>t.set.split(" ")[0]).join(" · ")}</span></div>`:""}`:""}
<h2>📣 In today's Pokémon news</h2>
${der.narrative.inNews.slice(0,3).map(r=>`<div class="row"><span>${r.set}<em>${r.spreadPct!=null?` asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay than TCGplayer`:""}</em></span><span class="mono">$${r.price}</span></div>`).join("")}
<h2>🤫 Moving without headlines</h2>
${der.narrative.quietMovers.slice(0,3).map(r=>`<div class="row"><span>${r.flagship}<em> asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} on eBay — no coverage anywhere ⚡</em></span><span class="mono">$${r.price}</span></div>`).join("")}`:""}
${upcoming.length?`<h2>Radar</h2>${radarRows}`:""}
${heatSection}
${captureBlock}
${heatSection ? "" : `<div class="calib">HEAT READS: day ${heatDays} of 8 clean days — Wyckoff states return ~Aug 26. We publish nothing false in the meantime.</div>`}
<footer>Catch'em. Catch Feels. · prices: Catchem-data, eBay active listings (measured) · spread: internal instrument</footer>
</body></html>`;
await writeFile(join(ROOT,`research/pulse/${today}.html`), html);
await writeFile(join(ROOT,`research/assets/the-pulse.html`), html);

// ── Feed history: real sparklines for first-time visitors ──
// Per-product daily {date, price, listings} from heat-history.json (committed
// by the daily run). Post-2026-08-18 cut — pre-fix rows are contaminated and
// are never charted. Depth-capped to hold the feed under budget.
const HIST_DEPTH = 14;
let heatHist = []; try { heatHist = (await J("data/heat-history.json")) ?? []; } catch {}
const histCut = heatHist.filter(r => r.date >= "2026-08-18" && r.price != null);
const histDates = [...new Set(histCut.map(r => r.date))].sort().slice(-HIST_DEPTH);
const histSet = new Set(histDates);
const history = {};
for (const r of histCut) {
  if (!histSet.has(r.date)) continue;
  (history[r.id] ??= []).push([r.date, r.price, r.listingCount ?? null]);
}
for (const k in history) history[k].sort((a, b) => (a[0] < b[0] ? -1 : 1));

// Era-index series straight from data/era-index-history.json — the workflow's
// git-add list now commits it daily (write-vs-commit matrix, 2026-08-19), so
// the mirror workaround that briefly lived at research/pulse/era-history.json
// is retired.
let eraSrc = null; try { eraSrc = await J("data/era-index-history.json"); } catch {}
const eraEntries = [...(eraSrc?.entries ?? [])]
  .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.era < b.era ? -1 : 1));
const eraHistory = {};
for (const e of eraEntries) (eraHistory[e.era] ??= []).push([e.date, e.level]);
for (const k in eraHistory) eraHistory[k] = eraHistory[k].slice(-HIST_DEPTH);

// Product catalog for the app (detail pages, Board depth, offline Deal Check
// without the full tape). eBay-native numbers only — PPT stays gated.
// Pack counts mirror packsFor() in compute-derived.mjs exactly.
const packsForFeed = (p) => {
  const era = /^me/.test(p.setId || "") ? "me" : /^sv/.test(p.setId || "") ? "sv" : /^swsh/.test(p.setId || "") ? "swsh" : null;
  if ((p.setId || "") === "cel25") return null;
  if (p.subtype === "booster-pack") return 1;
  if (p.subtype === "booster-box") return 36;
  if (p.subtype === "booster-bundle") return 6;
  if (p.subtype === "etb" || p.subtype === "pc-etb") return era === "swsh" ? 8 : (era ? 9 : null);
  return null;
};
const looseLane = new Map(sp.products
  .filter(p => p.subtype === "booster-pack" && p.dataStatus === "live" && p.priceMedian != null)
  .map(p => [p.setId, p.priceMedian]));
const catalog = sp.products.map(p => {
  const packs = packsForFeed(p);
  const live = p.dataStatus === "live";
  const perPack = live && packs > 1 && p.priceMedian != null ? Math.round(p.priceMedian / packs * 100) / 100 : null;
  const loose = perPack != null ? looseLane.get(p.setId) : null;
  const row = { id: p.id, name: p.name, set: p.set, setId: p.setId, subtype: p.subtype, status: p.dataStatus };
  if (p.vintage) row.vintage = true;
  const img = sealedImg(p); if (img) row.img = img;
  if (live) {
    if (p.priceMedian != null) row.median = p.priceMedian;
    if (p.priceFloorClean != null) row.floor = p.priceFloorClean;
    if (p.priceHigh != null) row.high = p.priceHigh;
    if (p.listingCount != null) row.listings = p.listingCount;
    if (perPack != null) { row.packs = packs; row.perPack = perPack; }
    if (loose) { row.loosePack = loose; row.vsLoosePct = Math.round(100 * (perPack - loose) / loose); }
  }
  return row;
});

// ── Story Kits (Studio v0): three shaped stories a day from live instruments.
// The post-ideas angles, machine-readable: angle + numbers + receipts line.
// [FACT]-class numbers only; voice stays Tyler's. Kit 1 carries the same
// TCG-side numbers feed.signals already publishes — no new exposure.
const storyKits = [];
const s0 = [...sigs].sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct))[0];
if (s0) storyKits.push({
  id: "gap", angle: "Two markets, one product — who's right?",
  headline: `${s0.name}: two markets, ${Math.abs(s0.spreadPct)}% apart`,
  body: `eBay asks $${s0.ebayAskMedian} (${s0.ebayListings ?? "—"} active listings) while the TCG side sits at $${s0.tcgMarket}. ${s0.spreadPct > 0 ? "Sellers reaching, or eBay supply tightening" : "eBay discounting the TCG-side ask"} — somebody's wrong.`,
  productId: s0.id,
  receipts: `eBay active asks, BIN-only delivered · TCG-side provider market · ${today} · catchemtcg.com`,
});
{
  const thin = live.filter(p => p.listingCount && p.listingCount < 8).sort((a, b) => a.listingCount - b.listingCount)[0];
  const deep = [...live].sort((a, b) => (b.listingCount || 0) - (a.listingCount || 0))[0];
  storyKits.push(thin
    ? { id: "supply", angle: "Scarcity on tape",
        headline: `${thin.name}: ${thin.listingCount} listings left`,
        body: `Only ${thin.listingCount} active listing${thin.listingCount === 1 ? "" : "s"} on all of eBay, asking $${thin.priceMedian}. Try to buy one — that's the story.`,
        productId: thin.id,
        receipts: `eBay active listings, BIN-only delivered, title-filtered · ${today} · catchemtcg.com` }
    : { id: "supply", angle: "Liquidity king",
        headline: `${deep.name}: the deepest market on the board`,
        body: `${deep.listingCount} active listings at a $${deep.priceMedian} median — the easiest entry and exit in the hobby today.`,
        productId: deep.id,
        receipts: `eBay active listings, BIN-only delivered, title-filtered · ${today} · catchemtcg.com` });
}
if (der?.packMath?.priciest?.[0] && der?.packMath?.cheapest?.[0]) {
  const hi = der.packMath.priciest[0], lo = der.packMath.cheapest[0];
  storyKits.push({
    id: "packmath", angle: "What a pack actually costs",
    headline: `$${hi.perPack} vs $${lo.perPack}: the sealed pack spectrum`,
    body: `${hi.name} runs $${hi.perPack}/pack inside the box; ${lo.name} is the cheapest real wax on the board at $${lo.perPack}/pack. Same hobby, ${Math.round(hi.perPack / lo.perPack)}× apart.`,
    productId: hi.id,
    receipts: `sealed ask median ÷ era-aware pack count · eBay BIN-only delivered · ${today} · catchemtcg.com`,
  });
}
// Catalyst kit: today's strongest read, hedged in voice ([READ] class — our
// interpretation, never a call).
const cat0 = (der?.catalysts ?? [])[0];
if (cat0) storyKits.push({
  id: "catalyst", angle: `Catalyst read — ${cat0.class}, ${cat0.horizon} horizon`,
  headline: `${cat0.trigger}: ${cat0.note}`,
  body: `${(cat0.context || "").trim() || "The read comes straight from today's research digest."} Possible, not promised — the falsifier is on the tape.`,
  receipts: `machine read [READ] · ${cat0.provenance || "daily digest"} · ${today} · catchemtcg.com`,
});
// Print-watch kit: nearest EOL countdown + the tightening trio.
{
  const printing = (der?.printWatch ?? []).filter(r => r.eol?.status === "printing")
    .sort((a, b) => (a.eol.daysLeftEst ?? 9e9) - (b.eol.daysLeftEst ?? 9e9))[0];
  const tight = (der?.tightening ?? []).map(t => t.set);
  if (printing) storyKits.push({
    id: "printwatch", angle: "The print window is a clock",
    headline: `${printing.set}: ~${printing.eol.daysLeftEst} days of printing left (est.)`,
    body: `The 30-month model puts ${printing.set}'s print window closing in roughly ${printing.eol.daysLeftEst} days — ${printing.supply} listings on the tape today${tight.length ? `. Already out of print and thinning with no reprint news: ${tight.join(", ")}` : ""}. Estimates, not announcements — TPC can reprint anything.`,
    receipts: `30-month print model (est.) × live listing depth · eBay active listings · ${today} · catchemtcg.com`,
  });
}

// Kit archive (accumulating, merge-by-date, CI-committed via research/pulse/) —
// powers /studio/archive without any directory-listing API.
{
  const { mergeByDate } = await import("./lib/instruments.mjs");
  let arch = null;
  try { arch = await J("research/pulse/kits-archive.json"); } catch {}
  arch ??= { note: "story-kit archive — merge-by-date", entries: [] };
  arch.entries = mergeByDate(arch.entries, [{ date: today, kits: storyKits }], today);
  arch.entries.sort((a, b) => (a.date < b.date ? -1 : 1));
  await writeFile(join(ROOT, "research/pulse/kits-archive.json"), JSON.stringify(arch, null, 1) + "\n");
}

// Composite index series for the overlay/header spark (CI-committed path).
let ixHist = null; try { ixHist = await J("research/pulse/index-history.json"); } catch {}
const indexHistory = (ixHist?.entries ?? []).slice(-HIST_DEPTH).map(e => [e.date, e.level]);

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
  printWatch: (der?.printWatch ?? []).filter(r => r.eol?.status === "printing")
    .sort((a, b) => (a.eol.daysLeftEst ?? 9e9) - (b.eol.daysLeftEst ?? 9e9)).slice(0, 8)
    .map(r => ({ setId: r.setId, set: r.set, ageMonths: r.ageMonths,
      daysLeft: r.eol.daysLeftEst ?? null, supply: r.supply, tier: r.supplyTier,
      legalTag: r.legalTag, reprint: r.reprintSignal ?? null })),
  tightening: (der?.tightening ?? []).map(t => ({ setId: t.setId, set: t.set, supply: t.supply })),
  eraIndexes: der?.eraIndexes ?? [],
  sealedIndex: der?.sealedIndex ?? null,
  watchOutcomes: der?.watchOutcomes ?? null,
  rawIndex: der?.rawIndex ?? null,
  netProceeds: der?.netProceeds ? { ...der.netProceeds,
    tcgModel: { pct: 13.25, fixed: 0.30, venue: "TCGplayer", ...(der.netProceeds.tcgModel || {}) } } : null,
  fx: der?.fx ?? null,
  ripOrHold: der?.ripOrHold ?? null,
  notification: der?.notification ?? null,
  gradedIndex: der?.gradedIndex ?? null,
  machine: { generatedAt: new Date().toISOString(), products: sp.products.length, live: sp.products.filter(x=>x.dataStatus==="live").length, historyDepthDays: (der?.sealedIndex?.constituents?1:0) && undefined },
  cohortCompare: der?.cohortCompare ?? null,
  topicHits: der?.topicHits ?? [],
  rotationCohorts: der?.rotationCohorts ?? {},
  rotationContext: der?.rotationContext ?? null,
  catalysts: (der?.catalysts??[]).slice(0,4),
  packMath: der?.packMath ? { priciest: der.packMath.priciest.slice(0,3), cheapest: der.packMath.cheapest.slice(0,3),
    best: der.packMath.cheapest[0] ? { id: der.packMath.cheapest[0].id, name: der.packMath.cheapest[0].name, perPack: der.packMath.cheapest[0].perPack } : null,
    worst: der.packMath.priciest[0] ? { id: der.packMath.priciest[0].id, name: der.packMath.priciest[0].name, perPack: der.packMath.priciest[0].perPack } : null,
    all: der.packMath.all ?? [], class:"VERIFIED" } : null,
  radar: upcoming.slice(0,4),
  chases: chases.map(c=>({ cardId:c.cardId, name:c.name, set:c.setName, market:c.priceMarket, imageUrl: cardImg(c.cardId),
    provenance:c.provenance, class:"VERIFIED" })),
  disclosure: "Buy Pressure is estimated from listing activity — not reported sales. Active Listings are measured.",
  products: catalog,
  history,
  eraHistory,
  indexHistory,
  storyKits,
};
// Two copies, both compact (machine feed; pretty-printing triples the bytes):
//  - research/pulse/pulse-feed.json — the CANONICAL app URL. research/pulse/
//    is in the daily run's git-add list, so this copy updates every CI run.
//  - research/assets/pulse-feed.json — legacy path for app builds deployed
//    before the FEED_URL switch; committed only by human sessions.
const feedJson = JSON.stringify(feed) + "\n";
await writeFile(join(ROOT,"research/pulse/pulse-feed.json"), feedJson);
await writeFile(join(ROOT,"research/assets/pulse-feed.json"), feedJson);

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
<h2>Specialty vs Mainline</h2><div class="co">${["specialty","mainline"].map(k=>{const c=der.cohortCompare?.[k];return c?`<div style="margin-bottom:8px"><b style="text-transform:capitalize">${k}</b> — ${c.sets} sets · ${c.products} products · <span class="mono">${c.supplyPerProduct}</span> listings/product · <span class="mono">$${c.avgPerPack??"—"}</span>/pack avg · <span class="mono">${c.avgSpreadPct??"—"}%</span> avg market gap</div>`:""}).join("")}<div class="dim">Taper &amp; sell-through curves accumulate in cohort-history from Aug 18, 2026 — built for the new-print-capacity era.</div></div>
<h2>Rotation cohorts</h2>${cohorts}
<div class="foot">Rotation lands each April — next: April 2027. Reprint signals accumulate from the news layer starting Aug 18, 2026; sourced history backfills over time.</div>`;
  await writeFile(new URL("../research/assets/print-watch.html", import.meta.url), pwHtml);
}

console.log("✓ pulse-feed.json (app Ticker feed) written");
console.log("✓ Pulse HTML edition written (dated + stable path)");
console.log(`✓ Morning Pulse written: research/pulse/${today}.md`);

await import("./mint-cards.mjs");
await import("./mint-social-card.mjs");
await import("./social-posts.mjs");
