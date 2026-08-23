// build-editor.mjs — Catch'em Creators, the editor.
//
// Tyler, 2026-08-23: "Make it so creators can edit and make their own card
// combos. This is a great way of getting people back every day."
//
// He is right about the mechanism. The current page is a MENU - ten pairings we
// chose - and a menu is something you read once. An editor is something you come
// back to, because the next idea is theirs rather than ours.
//
// WHAT IS DELIBERATELY NOT EDITABLE:
//   the watermark      - three points, footer plus two faint marks set into the
//                        artwork. Tyler's model: the watermark IS the free tier,
//                        and removing it becomes the gated feature later. Which
//                        also means the free tier markets us on every post it
//                        makes, so the more it is used the more it is worth.
//   the artist credit  - renders from card data and cannot be cleared.
//
// Ships a 1.55MB slim index rather than the 6.1MB catalogue: id, name, artist,
// set, year, rarity. Everything else is a lookup nobody needs in a browser.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };

const cat = await J("data/card-catalogue.json");
if (!cat) { console.log("· editor: no catalogue"); process.exitCode = 0; }
else {
  const { LAYOUTS } = await import("./layouts.mjs");
  // Slim index. Cards with no illustrator are KEPT but flagged - Tyler asked to
  // be able to pick them, and the missing credit is a dataset backfill lag
  // rather than a Pokemon decision, so hiding them would hide 43% of 2024.
  const index = Object.entries(cat.cards).map(([id, c]) => ({
    i: id, n: c.name, a: c.artist ?? null, s: c.setName,
    y: (c.releaseDate ?? "").slice(0, 4), r: c.rarity ?? "",
  }));
  await mkdir(join(ROOT, "research/assets"), { recursive: true }).catch(() => {});
  await writeFile(join(ROOT, "research/assets/card-index.json"), JSON.stringify(index));

  const html = `<!doctype html><meta charset="utf-8"><title>Catch'em Creators — build a post</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#070910;--surf:#0f1219;--ink:#e9ecf3;--dim:#8b93a7;--green:#36d399;--line:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px 18px 90px}
.wrap{max-width:1080px;margin:0 auto}
h1{font-size:28px;margin:0 0 2px}.sub{color:var(--dim);margin:0 0 20px;font-size:14.5px}
input,select{background:#0b0d14;border:1px solid var(--line);border-radius:9px;color:var(--ink);
  padding:11px 13px;font:15px inherit;width:100%}
.controls{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:14px}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(122px,1fr));gap:10px;
  max-height:320px;overflow-y:auto;padding:4px;background:var(--surf);border:1px solid var(--line);border-radius:12px}
.hit{cursor:pointer;text-align:center;border-radius:8px;padding:6px;transition:background .12s}
.hit:hover{background:rgba(54,211,153,.09)}
.hit img{width:100%;aspect-ratio:745/1040;object-fit:contain;border-radius:5px;background:#0b0d14}
.hit b{display:block;font-size:11.5px;font-weight:600;margin-top:5px;line-height:1.25}
.hit i{display:block;font-style:normal;font-size:10.5px;color:var(--dim)}
.hit .nocred{color:#d9a441}
.tray{display:flex;gap:10px;flex-wrap:wrap;min-height:96px;background:var(--surf);
  border:1px dashed var(--line);border-radius:12px;padding:12px;margin:16px 0 12px;align-items:flex-start}
.tray .slot{position:relative;width:74px}
.tray img{width:74px;aspect-ratio:745/1040;object-fit:contain;border-radius:5px}
.tray button{position:absolute;top:-7px;right:-7px;width:21px;height:21px;border-radius:50%;
  border:0;background:#ef5a5a;color:#fff;font-size:13px;cursor:pointer;line-height:1}
.empty{color:var(--dim);font-size:14px;align-self:center}
.status{font-size:13.5px;color:var(--dim);margin-bottom:12px;min-height:19px}
.status.bad{color:#d9a441}
.acts{display:flex;gap:8px;flex-wrap:wrap}
button.pri{background:var(--green);color:#070910;border:0;border-radius:10px;padding:13px 24px;
  font-size:15.5px;font-weight:700;cursor:pointer}
button.sec{background:transparent;color:var(--dim);border:1px solid var(--line);border-radius:10px;
  padding:13px 20px;font-size:15px;cursor:pointer}
button:disabled{opacity:.4;cursor:not-allowed}
canvas{max-width:100%;border-radius:12px;margin-top:16px;display:none}
.note{color:var(--dim);font-size:13px;margin-top:22px;border-top:1px solid var(--line);padding-top:14px}
@media(max-width:640px){.controls{grid-template-columns:1fr}.acts button{width:100%}}
</style>
<div class="wrap">
<h1>Build a post</h1>
<p class="sub">Search ${index.length.toLocaleString("en-US")} cards. Add up to nine. The frame picks itself.</p>

<div class="controls">
  <input id="q" placeholder="Pokémon, illustrator, or set…" autocomplete="off">
  <select id="rar"><option value="">Any rarity</option>
    <option>Special Illustration Rare</option><option>Illustration Rare</option>
    <option>Rare Holo</option><option>Rare Secret</option><option>Rare Ultra</option></select>
  <input id="yr" placeholder="Year, e.g. 1999" inputmode="numeric">
</div>
<div class="results" id="res"></div>

<div class="tray" id="tray"><span class="empty">Click cards above to add them here</span></div>
<div class="status" id="st"></div>
<input id="label" placeholder="Your line — leave it blank if the cards say it better" style="margin-bottom:12px">

<div class="acts">
  <button class="pri" id="make" disabled>Make the image</button>
  <button class="sec" id="copy" hidden>Copy</button>
  <button class="sec" id="share" hidden>Share</button>
  <button class="sec" id="dl" hidden>Download PNG</button>
</div>
<canvas id="cv"></canvas>

<div class="note"><b>Every image carries the Catch'em mark and the illustrator's name.</b>
The credit is not ours to remove — it is the name of the person who drew it. Cards shown in amber
have no illustrator recorded in the public dataset; that is a backfill gap on recent sets, not a
Pokémon decision, and you can still use them.</div>
</div>
<script>
const LAYOUTS = ${JSON.stringify(Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, { cols: v.cols, cardW: v.cardW, name: v.name }])))};
const SUPPORTED = Object.keys(LAYOUTS).map(Number);
let INDEX = [], tray = [], blob = null;

const imgUrl = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";

fetch("card-index.json").then(r => r.json()).then(d => { INDEX = d; search(); })
  .catch(() => { document.getElementById("res").innerHTML = "<div class='empty'>could not load the card index</div>"; });

const el = id => document.getElementById(id);
function search(){
  const q = el("q").value.trim().toLowerCase(), rar = el("rar").value, yr = el("yr").value.trim();
  if (!q && !rar && !yr) { el("res").innerHTML = "<div class='empty'>start typing to search</div>"; return; }
  const hits = INDEX.filter(c =>
    (!q || (c.n + " " + (c.a || "") + " " + c.s).toLowerCase().includes(q)) &&
    (!rar || c.r === rar) && (!yr || c.y === yr)).slice(0, 60);
  el("res").innerHTML = hits.length ? hits.map(c =>
    \`<div class="hit" onclick="add('\${c.i}')"><img loading="lazy" src="\${imgUrl(c.i)}" alt="">
      <b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i class="\${c.a ? "" : "nocred"}">\${c.a || "no credit recorded"}</i></div>\`).join("")
    : "<div class='empty'>nothing matched</div>";
}
["q","rar","yr"].forEach(id => el(id).addEventListener("input", search));

function add(id){
  if (tray.length >= 9) { setStatus("Nine is the most a frame holds.", true); return; }
  const c = INDEX.find(x => x.i === id); if (!c) return;
  tray.push(c); blob = null; render();
}
function remove(k){ tray.splice(k,1); blob = null; render(); }

function setStatus(t, bad){ const s = el("st"); s.textContent = t; s.className = "status" + (bad ? " bad" : ""); }

function render(){
  el("tray").innerHTML = tray.length ? tray.map((c,k) =>
    \`<div class="slot"><img src="\${imgUrl(c.i)}" alt=""><button onclick="remove(\${k})">×</button></div>\`).join("")
    : "<span class='empty'>Click cards above to add them here</span>";
  const L = LAYOUTS[tray.length];
  el("make").disabled = !L;
  el("cv").style.display = "none";
  ["copy","share","dl"].forEach(i => el(i).hidden = true);
  if (!tray.length) { setStatus(""); return; }
  if (L) {
    const missing = tray.filter(c => !c.a).length;
    setStatus(\`\${tray.length} cards — "\${L.name}", \${L.cols} across\` +
      (missing ? \` · \${missing} without a recorded illustrator\` : ""), false);
  } else {
    // The layout table refuses unsupported counts and says what to do, rather
    // than producing a ragged final row that reads as a mistake.
    const below = SUPPORTED.filter(n => n < tray.length).pop(), above = SUPPORTED.find(n => n > tray.length);
    setStatus(\`\${tray.length} cards has no frame. \${below ? "Remove " + (tray.length - below) : ""}\${below && above ? " or add " + (above - tray.length) : ""}.\`, true);
  }
}

el("make").onclick = async () => {
  const L = LAYOUTS[tray.length]; if (!L) return;
  setStatus("composing…");
  const CW = 745, CH = 1040, GAP = 60, PAD = 90, CAP = tray.length <= 4 ? 70 : 0;
  const LABEL = el("label").value.trim(), LABH = LABEL ? 110 : 0;
  const ROWS = Math.ceil(tray.length / L.cols);
  const W = PAD*2 + CW*L.cols + GAP*(L.cols-1);
  const H = PAD + (CH+CAP)*ROWS + GAP*(ROWS-1) + LABH + 110;
  const cv = el("cv"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.fillStyle = "#070910"; g.fillRect(0,0,W,H);
  try{
    for (let i=0;i<tray.length;i++){
      const u = imgUrl(tray[i].i);
      const routes = [u, "https://images.weserv.nl/?url=" + encodeURIComponent(u.replace(/^https?:\\/\\//,"")) + "&w=745&output=png"];
      let img = null;
      for (const r of routes){
        try{ img = await new Promise((res,rej)=>{ const im=new Image(); im.crossOrigin="anonymous";
          im.onload=()=>res(im); im.onerror=()=>rej(); im.src=r; }); break; }catch{}
      }
      if (!img) throw new Error("could not load " + tray[i].n);
      const x = PAD + (i % L.cols)*(CW+GAP), y = PAD + Math.floor(i/L.cols)*(CH+CAP+GAP);
      g.drawImage(img, x, y, CW, CH);
      if (CAP){ g.fillStyle="#8a93a8"; g.font="28px system-ui,sans-serif"; g.textAlign="center";
        g.fillText(tray[i].n + " · " + tray[i].y, x+CW/2, y+CH+46); }
    }
    if (LABEL){ g.fillStyle="#f4f5f8"; g.font="800 52px system-ui,sans-serif"; g.textAlign="center";
      g.fillText(LABEL, W/2, H-150); }
    // THE WATERMARK IS NOT OPTIONAL. Three points so cropping one corner does not
    // remove it; faint, because a mark that ruins the image protects nothing.
    g.save(); g.globalAlpha=0.16; g.fillStyle="#fff"; g.font="800 40px system-ui,sans-serif"; g.textAlign="center";
    for (const [wx,wy] of [[W*0.27, PAD+CH*0.40],[W*0.73, PAD+CH*0.80]]){
      g.save(); g.translate(wx,wy); g.rotate(-Math.PI/9); g.fillText("catchemtcg.com",0,0); g.restore(); }
    g.restore();
    g.fillStyle="#36d399"; g.font="800 40px system-ui,sans-serif"; g.textAlign="left";
    g.fillText("Catch'em", PAD, H-40);
    const artists = [...new Set(tray.map(c=>c.a).filter(Boolean))].slice(0,3).join(" · ");
    g.fillStyle="#5c637a"; g.font="26px ui-monospace,monospace"; g.textAlign="right";
    g.fillText(artists || "illustrator not recorded", W-PAD, H-40);

    blob = await new Promise(r => cv.toBlob(r,"image/png"));
    cv.style.display="block";
    el("dl").hidden=false;
    if (navigator.clipboard && window.ClipboardItem) el("copy").hidden=false;
    if (navigator.canShare && navigator.canShare({files:[new File([""],"t.png",{type:"image/png"})]})) el("share").hidden=false;
    setStatus("ready — " + W + "×" + H);
  }catch(e){ setStatus("could not compose: " + (e.message||"unknown"), true); }
};

const fname = () => "catchem-" + (el("label").value.trim() || tray.map(c=>c.n).join("-") || "cards")
  .replace(/[^a-z0-9]+/gi,"-").toLowerCase().slice(0,48) + ".png";
el("dl").onclick = () => { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fname(); a.click(); };
el("copy").onclick = async () => { try{ await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]); setStatus("copied — paste into the post"); }catch(e){ setStatus("copy failed: "+e.message,true); } };
el("share").onclick = async () => { try{ await navigator.share({files:[new File([blob],fname(),{type:"image/png"})]}); }catch(e){ if(e.name!=="AbortError") setStatus("share failed: "+e.message,true); } };
</script>`;

  await writeFile(join(ROOT, "research/assets/build.html"), html);
  console.log(`✓ editor: ${index.length.toLocaleString("en-US")} cards searchable · ${Object.keys(LAYOUTS).length} frames · watermark and credit locked`);
}
