// scripts/generate-board.mjs — The Board
// The real thing: catchemtcg.com's core page, generated from live production
// data. No mockup numbers, no illustrative states — if an instrument is
// calibrating, the page says so. Output: research/assets/the-board.html
import { rootCss } from "./lib/brand.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT,p),"utf-8"));
const cardImg = id => { const m=/^(.+)-(\w+)$/.exec(id||""); return m?`https://images.pokemontcg.io/${m[1]}/${m[2]}.png`:null; };
let __tcgIds = {}, __imgOv = {};
// PRIORITY FIXED 2026-08-22: clean catalogue shot FIRST. Seller photos are
// phone snapshots — glare, hands, kitchen tables — and they make every number
// beside them look casual. 400px was also too small; 1000px is the reliable max.
const sealedImg = p => {
  const ov = __imgOv[p.id];
  if (ov?.use === "none") return null;
  if (ov?.url) return ov.url;
  if (ov?.use === "seller") return p.representativeImage || p.image || null;
  return (__tcgIds[p.id] ? `https://tcgplayer-cdn.tcgplayer.com/product/${__tcgIds[p.id]}_in_1000x1000.jpg` : null)
    || p.representativeImage || p.image || null;
};

const sp = await J("data/sealed-prices.json");
try { const ov = await J("data/image-overrides.json"); __imgOv = ov?.products || {}; } catch {}
try { const cm = await J("data/crosscheck-id-map.json");
  for (const e of (cm.entries||[])) if (e.reviewed && !e.exclude && e.tcgPlayerId) __tcgIds[e.id] = e.tcgPlayerId;
} catch {}

const div = await J("data/divergence-report.json").catch?.() ?? await J("data/divergence-report.json");
const heat = await J("data/heat-report.json");
let der = {}; try { der = await J("data/derived-insights.json"); } catch {}
const heatDay = (heat.mode||"").match(/day (\d+)/)?.[1] ?? "1";
const spreadBy = new Map((div.rows||[]).map(r=>[r.id,r]));
const money = n => n==null ? "—" : "$"+Number(n).toLocaleString("en-US",{maximumFractionDigits:0});
const eraPill = e => ({swsh:"SWSH",sv:"SV",mega:"ME",me:"ME"}[e]||String(e||"").toUpperCase().slice(0,4));

const rows = sp.products
  .filter(p=>p.dataStatus==="live")
  .map(p=>({p, s:spreadBy.get(p.id)}))
  .sort((a,b)=>((b.s?.signal?1:0)-(a.s?.signal?1:0)) || (b.p.listingCount||0)-(a.p.listingCount||0));

const tr = ({p,s}) => `
<tr>
  <td class="name" style="display:flex;align-items:center;gap:10px">${sealedImg(p)?`<img src="${sealedImg(p)}" style="width:42px;background:#0b0d14;border-radius:5px;padding:3px;border:1px solid rgba(255,255,255,.07)" alt="">`:""}<span>${p.name}<span class="sub">${p.set||""}</span></span></td>
  <td><span class="pill">${p.subtype?.replace("-"," ").toUpperCase()||""}</span>${(der.lifecycle&&der.lifecycle[p.setId])?`<span class="pill" title="${der.lifecycle[p.setId].phase} (est.) · ${der.lifecycle[p.setId].legalTag||""}" style="margin-left:4px">${der.lifecycle[p.setId].tag} ${der.lifecycle[p.setId].ageMonths}mo${der.lifecycle[p.setId].standardLegal?" ⚖":""}</span>`:""}</td>
  <td class="num">${money(p.priceMedian)}</td>
  <td class="num">${p.listingCount??"—"}</td>
  <td>${s ? (s.signal
      ? `<span class="spread sig">${s.spreadPct>0?"+":""}${s.spreadPct}%</span>`
      : `<span class="spread ok">${s.spreadPct>0?"+":""}${s.spreadPct}%</span>`)
    : `<span class="spread na">—</span>`}</td>
  <td><span class="dot live"></span>live</td>
</tr>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<title>The Board — Catch'em</title><style>
${rootCss()}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--txt);font:15px/1.5 'Sora,system-ui,sans-serif',system-ui,sans-serif;padding:0 0 60px}
header{padding:34px 24px 18px;max-width:1080px;margin:0 auto}
h1{font-size:30px;letter-spacing:-.5px}h1 em{color:var(--gold);font-style:normal}
.tag{color:var(--dim);font-size:13px;margin-top:4px}
.calib{max-width:1080px;margin:14px auto 0;padding:12px 24px;display:flex;align-items:center;gap:14px}
.calib .bar{flex:1;height:6px;background:var(--line);border-radius:3px;overflow:hidden}
.calib .fill{height:100%;width:${Math.min(100,Math.round(+heatDay/8*100))}%;background:var(--green)}
.calib .lbl{font:12px 'JetBrains Mono,ui-monospace,monospace',monospace;color:var(--dim);white-space:nowrap}
.stats{max-width:1080px;margin:10px auto 0;padding:0 24px;display:flex;gap:26px;font:13px 'JetBrains Mono,ui-monospace,monospace',monospace;color:var(--dim)}
.stats b{color:var(--txt)}
main{max-width:1080px;margin:20px auto 0;padding:0 24px}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th{font:11px 'JetBrains Mono,ui-monospace,monospace',monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
.name{font-weight:600}.sub{display:block;font-size:11px;color:var(--dim);font-weight:400}
.pill{font:10px 'JetBrains Mono,ui-monospace,monospace',monospace;border:1px solid var(--line);border-radius:20px;padding:3px 8px;color:var(--dim)}
.num{font:14px 'JetBrains Mono,ui-monospace,monospace',monospace}
.spread{font:12px 'JetBrains Mono,ui-monospace,monospace',monospace;border-radius:6px;padding:3px 8px}
.spread.sig{background:rgba(245,200,66,.14);color:var(--gold);border:1px solid rgba(245,200,66,.35)}
.spread.ok{color:var(--dim)}.spread.na{color:#4a5065}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px}
.dot.live{background:var(--green);box-shadow:0 0 6px var(--green)}
footer{max-width:1080px;margin:22px auto 0;padding:0 24px;font:12px 'JetBrains Mono,ui-monospace,monospace',monospace;color:var(--dim)}
</style></head><body>
<header><h1>The <em>Board</em></h1>
<div class="tag">Every sealed product. Two markets. Honest instruments. — Catch'em</div></header>
<div class="calib"><span class="lbl">HEAT READS CALIBRATING</span><div class="bar"><div class="fill"></div></div><span class="lbl">day ${heatDay} of 8 · live ~Aug 26</span></div>
<div class="stats"><span><b>${sp.products.length}</b> sealed products tracked</span><span><b>${rows.length}</b> live</span><span><b>${(div.rows||[]).filter(r=>r.signal).length}</b> spread signals</span><span>run <b>${sp.updatedAt?.slice(0,16)}Z</b></span></div>
<main><table><thead><tr><th>Product</th><th>Type</th><th>Ask Median</th><th>Active Listings</th><th>Spread vs TCG</th><th>Status</th></tr></thead>
<tbody>${rows.map(tr).join("")}</tbody></table></main>
<footer>Prices: Catchem-data, eBay active listings (measured) · Spread: vs TCG-side ask (PPT), internal instrument · Buy Pressure &amp; heat states arrive with calibration · Generated ${new Date().toISOString().slice(0,16)}Z · Catch'em. Catch Feels.</footer>
</body></html>`;
await writeFile(join(ROOT,"research/assets/the-board.html"), html);
console.log("✓ The Board: " + rows.length + " live rows, " + (div.rows||[]).filter(r=>r.signal).length + " signals rendered");
