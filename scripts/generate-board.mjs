// scripts/generate-board.mjs — The Board
// The real thing: catchemtcg.com's core page, generated from live production
// data. No mockup numbers, no illustrative states — if an instrument is
// calibrating, the page says so. Output: research/assets/the-board.html
import { rootCss } from "./lib/brand.mjs";
import { freshnessFromReport } from "./lib/freshness.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { cardImage } from "./image-source.mjs";
import { money, pretty, esc, headerHtml, footerHtml, chromeCss, FONTS, stampLabel } from "./lib/public-chrome.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT,p),"utf-8"));
const cardImg = id => cardImage(id, false) || null; // source-published URL, never constructed
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
let runReport = null; try { runReport = await J("data/ppt/run-report.json"); } catch {}
const fresh = freshnessFromReport(runReport);
try { const ov = await J("data/image-overrides.json"); __imgOv = ov?.products || {}; } catch {}
try { const cm = await J("data/crosscheck-id-map.json");
  for (const e of (cm.entries||[])) if (e.reviewed && !e.exclude && e.tcgPlayerId) __tcgIds[e.id] = e.tcgPlayerId;
} catch {}

const div = await J("data/divergence-report.json").catch?.() ?? await J("data/divergence-report.json");
const heat = await J("data/heat-report.json");
const spreadBy = new Map((div.rows||[]).map(r=>[r.id,r]));
// HELD products stay on the Board but carry a held label, with no price and
// no gap: qa-gate (or the durable quarantine) says the number is suspect, so
// it does not get shown as a price. Same rule as the feed's held rows.
const { loadBlocked } = await import("./lib/publish-guard.mjs");
const __blk = await loadBlocked();
const isHeld = (p) => Boolean(p.publishBlock || __blk.blocked(p.id));
const heldWhy = (p) => (p.qaReasons || [])[0] || __blk.reasonFor?.(p.id) || "held pending re-verification";

const rows = sp.products
  .filter(p=>p.dataStatus==="live")
  .map(p=>({p, s:spreadBy.get(p.id)}))
  .sort((a,b)=>((isHeld(a.p)?1:0)-(isHeld(b.p)?1:0)) || ((b.s?.signal?1:0)-(a.s?.signal?1:0)) || (b.p.listingCount||0)-(a.p.listingCount||0));

const showSpread = rows.some(({ s }) => s && typeof s.spreadPct === "number");
const thumb = (p) => {
  const src = sealedImg(p);
  if (!src) return `<span class="ph" aria-hidden="true"></span>`;
  return `<img class="ph" src="${esc(src)}" alt="">`;
};
const tr = ({ p, s }) => `
<tr>
  <td class="name">${thumb(p)}<span><a href="/dive/${esc(p.id)}">${esc(pretty(p.name))}</a><span class="sub">${esc(pretty(p.set || ""))}</span></span></td>
  <td data-label="Type"><span class="pill">${esc((p.subtype || "").replaceAll("-", " "))}</span></td>
  <td class="num" data-label="Median">${isHeld(p) ? "held" : (money(p.priceMedian) || "—")}</td>
  <td class="num" data-label="Listings">${p.listingCount ?? "—"}</td>
  ${showSpread ? `<td data-label="Gap">${!isHeld(p) && s && typeof s.spreadPct === "number" ? `<span class="spread">${s.spreadPct > 0 ? "+" : ""}${s.spreadPct}%</span>` : `<span class="spread na">—</span>`}</td>` : ""}
  <td data-label="Status">${isHeld(p) ? `<span class="dot held"></span><span title="${esc(heldWhy(p))}">held</span>` : `<span class="dot"></span>priced`}</td>
</tr>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${FONTS}" rel="stylesheet">
<title>The Board — Catch'em</title><style>
${rootCss()}
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--faint:#9a9184;--gold:#d9b779;--green:#7fc79a;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:var(--bg);color:var(--txt);font:16px/1.5 var(--sans)}
${chromeCss}
h1{font:500 36px/1.1 var(--serif);letter-spacing:-.02em;margin:0}
.byline{color:var(--dim);font-size:14px;margin-top:6px}
.stats{max-width:1040px;margin:14px auto 0;padding:0 22px;display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--dim);font-size:14px}
.stats b{color:var(--txt)}
main{max-width:1040px;margin:18px auto 0;padding:0 22px 12px}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th{font:600 11px/1 var(--sans);text-transform:uppercase;letter-spacing:.08em;color:var(--dim);text-align:left;padding:12px 14px;border-bottom:1px solid var(--line)}
td{padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:middle}
tr:last-child td{border-bottom:0}
.name{font-weight:600;display:flex;align-items:center;gap:10px}
.name a{color:var(--txt);text-decoration:none}
.name a:hover{color:var(--gold)}
.sub{display:block;font-size:12px;color:var(--dim);font-weight:400}
.ph{width:42px;height:42px;flex:none;border-radius:8px;background:#211e1a;border:1px solid var(--line);object-fit:contain}
.pill{font-size:11px;letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--line);border-radius:20px;padding:3px 8px;color:var(--dim)}
.num{font-variant-numeric:tabular-nums}
.spread{font-variant-numeric:tabular-nums;color:var(--gold)}
.spread.na{color:var(--faint)}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;background:var(--green)}
.dot.held{background:var(--gold)}
@media (max-width:720px){
  table,thead,tbody,tr,td{display:block;width:100%}
  thead{display:none}
  tr{border:1px solid var(--line);border-radius:12px;margin:0 0 12px;padding:12px 14px;background:var(--panel)}
  td{border:0;padding:3px 0}
  td[data-label]{display:flex;justify-content:space-between;gap:12px}
  td[data-label]::before{content:attr(data-label);color:var(--dim);font-size:12px}
}
</style></head><body>
${headerHtml("Board")}
<header class="board-intro" style="max-width:1040px;margin:0 auto;padding:28px 22px 0">
<h1>The Board</h1>
<div class="byline" id="fresh" data-at="${fresh.at || ""}">${fresh.at ? stampLabel(fresh.at) : fresh.label}</div>
</header>
<div class="stats"><span><b>${sp.products.length}</b> tracked</span><span><b>${rows.filter(({ p }) => !isHeld(p)).length}</b> with a price</span>${rows.some(({ p }) => isHeld(p)) ? `<span><b>${rows.filter(({ p }) => isHeld(p)).length}</b> held for re-verification</span>` : ""}</div>
<main><table><thead><tr><th>Product</th><th>Type</th><th>Median</th><th>Listings</th>${showSpread ? "<th>Price gap</th>" : ""}<th>Status</th></tr></thead>
<tbody>${rows.map(tr).join("")}</tbody></table></main>
${footerHtml()}
</body></html>`;
await writeFile(join(ROOT,"research/assets/the-board.html"), html);
console.log("✓ The Board: " + rows.length + " live rows, " + (div.rows||[]).filter(r=>r.signal).length + " signals rendered");
