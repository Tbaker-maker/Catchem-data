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

  const themes = await J("data/themes.json");
  const sets = [...new Set(Object.values(cat.cards).map(c => c.setName).filter(Boolean))].sort();
  const index = Object.entries(cat.cards).map(([id, c]) => ({
    i: id, n: c.name, a: c.artist ?? null, s: c.setName,
    y: (c.releaseDate ?? "").slice(0, 4), r: c.rarity ?? "", p: typeof c.price === "number" ? Math.round(c.price * 100) / 100 : null,
  }));
  await mkdir(join(ROOT, "research/assets"), { recursive: true }).catch(() => {});
  await writeFile(join(ROOT, "research/assets/card-index.json"), JSON.stringify(index));

  const html = `<!doctype html><meta charset="utf-8"><title>Catch'em Creators — build a post</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@300;400;600&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --ink:#0a0c12; --panel:#11141c; --raise:#171b25; --line:#20252f;
  --text:#e8ebf2; --soft:#8a93a6; --faint:#5a6273;
  --live:#36d399; --warn:#d9a441;
  --display:'Syne',system-ui,sans-serif; --body:'Sora',system-ui,sans-serif; --mono:'JetBrains Mono',ui-monospace,monospace;
  --ease:cubic-bezier(.22,.61,.36,1);
}
*{box-sizing:border-box}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{margin:0;background:var(--ink);color:var(--text);font:300 16px/1.6 var(--body);padding:0 0 120px}
.wrap{max-width:1000px;margin:0 auto;padding:0 24px}

/* Masthead — type does the work, no hero graphic, no gradient. */
.top{padding:56px 0 40px;border-bottom:1px solid var(--line);margin-bottom:40px}
h1{font:800 clamp(34px,6vw,52px)/1 var(--display);letter-spacing:-.028em;margin:0 0 12px}
h1 em{font-style:normal;color:var(--live)}
.lede{color:var(--soft);font-size:17px;max-width:46ch;margin:0}

/* Steps — a real sequence, so numbering earns its place. */
.steps{display:grid;grid-template-columns:1.2fr .7fr 1fr 1.3fr;gap:22px;margin-bottom:44px}
.refuse{background:#1a1410;border:1px solid #3d2f1a;border-radius:12px;padding:14px 17px;margin-bottom:18px;color:#d9a441;font-size:14px;line-height:1.55}
.step{min-width:0}
.step .n{font:500 11px/1 var(--mono);color:var(--faint);letter-spacing:.14em;display:block;margin-bottom:10px}
.step .t{font:600 14.5px/1.3 var(--body);margin-bottom:12px;display:block}
select,input{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:9px;
  color:var(--text);padding:13px 14px;font:400 14.5px var(--body);transition:border-color .18s var(--ease)}
select:focus,input:focus{outline:none;border-color:var(--live)}
.chips{display:flex;flex-wrap:wrap;gap:7px}
.chip{background:var(--panel);border:1px solid var(--line);color:var(--soft);border-radius:9px;
  padding:10px 14px;font:400 13.5px var(--body);cursor:pointer;transition:all .18s var(--ease)}
.chip:hover{border-color:var(--faint);color:var(--text)}
.chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.07)}
.chip[data-n]{font-family:var(--mono);font-weight:500;min-width:44px;text-align:center}

/* Ideas — a filmstrip, not a list. */
.ideas{display:grid;gap:9px;margin-bottom:40px}
.idea{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:17px 20px;
  cursor:pointer;transition:all .2s var(--ease)}
.idea:hover{border-color:var(--live);transform:translateY(-1px)}
.idea b{display:block;font:600 16.5px/1.35 var(--body);margin-bottom:4px}
.idea i{font-style:normal;color:var(--faint);font:400 12.5px var(--mono);display:block}
.idea .hook{color:var(--soft);font-size:14px;margin-top:9px}

/* THE SIGNATURE: the binder page. Empty pockets show what still fits. */
.page-label{font:500 11px/1 var(--mono);color:var(--faint);letter-spacing:.14em;margin-bottom:14px}
.binder{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px;
  display:grid;gap:12px;justify-content:center;margin-bottom:16px}
.pocket{aspect-ratio:745/1040;border-radius:9px;background:var(--raise);
  border:1px dashed var(--line);position:relative;overflow:hidden;
  animation:settle .34s var(--ease) both}
.pocket.filled{border-style:solid;border-color:transparent;background:transparent}
.pocket img{width:100%;height:100%;object-fit:contain;display:block}
.pocket .x{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;border:0;
  background:rgba(10,12,18,.82);color:#fff;font-size:14px;line-height:1;cursor:pointer;opacity:0;
  transition:opacity .16s var(--ease)}
.pocket:hover .x{opacity:1}
@keyframes settle{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.pocket{animation:none}.idea:hover{transform:none}}

.status{font:400 13px var(--mono);color:var(--faint);margin-bottom:10px;min-height:18px}
.tally{display:flex;gap:22px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);
  border-radius:13px;padding:14px 18px;margin-bottom:20px}
.tally div{min-width:0}
.tally .k{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.13em;display:block;margin-bottom:3px}
.tally .v{font:500 19px var(--mono);color:var(--text)}
.tally .v.have{color:var(--live)}
.pocket .own{position:absolute;bottom:5px;left:5px;border:0;border-radius:6px;padding:3px 7px;
  font:500 9.5px var(--mono);cursor:pointer;background:rgba(10,12,18,.86);color:var(--faint);opacity:0;
  transition:opacity .16s var(--ease)}
.pocket:hover .own{opacity:1}
.pocket .own.yes{opacity:1;background:var(--live);color:var(--ink)}
.status.bad{color:var(--warn)}
.acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
button.pri{background:var(--live);color:var(--ink);border:0;border-radius:13px;padding:14px 26px;
  font:600 15px var(--body);cursor:pointer;transition:opacity .18s var(--ease)}
button.pri:hover{opacity:.9}
button.sec{background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:13px;
  padding:14px 20px;font:400 14.5px var(--body);cursor:pointer;transition:all .18s var(--ease)}
button.sec:hover{border-color:var(--faint);color:var(--text)}
button:disabled{opacity:.32;cursor:not-allowed}
canvas{max-width:100%;border-radius:13px;margin-top:24px;display:none;border:1px solid var(--line)}

/* Search — the escape hatch, deliberately quiet. */
details{margin-bottom:36px;border-top:1px solid var(--line);padding-top:18px}
summary{color:var(--faint);font:400 13.5px var(--body);cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary:before{content:"→ ";color:var(--faint)}
.controls{display:grid;grid-template-columns:2fr 1fr .8fr;gap:9px;margin:16px 0 12px}
.results{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:9px;
  max-height:290px;overflow-y:auto;padding:3px}
.hit{cursor:pointer;text-align:center;border-radius:9px;padding:6px;transition:background .16s var(--ease)}
.hit:hover{background:var(--raise)}
.hit img{width:100%;aspect-ratio:745/1040;object-fit:contain;border-radius:9px;background:var(--raise)}
.hit b{display:block;font:600 11px/1.3 var(--body);margin-top:6px}
.hit i{display:block;font-style:normal;font:400 9.5px var(--mono);color:var(--faint);margin-top:2px}
.hit .nocred{color:var(--warn)}
.empty{color:var(--faint);font-size:14px;grid-column:1/-1;padding:22px 0;text-align:center}
.foot{color:var(--faint);font-size:13px;margin-top:46px;border-top:1px solid var(--line);padding-top:20px;line-height:1.7}
:focus-visible{outline:2px solid var(--live);outline-offset:2px}
@media(max-width:760px){.steps{grid-template-columns:1fr;gap:22px}.controls{grid-template-columns:1fr}
  .acts button{width:100%}}
</style>
<div class="wrap">
<div class="top">
  <h1>Build a page<em>.</em></h1>
  <p class="lede">Pick a direction and we'll find combinations worth posting. Every image credits the illustrator.
     &nbsp;·&nbsp; <a href="/creators" style="color:var(--live)">Or start from one we made &rsaquo;</a></p>
</div>

<div class="steps">
  <div class="step"><span class="n">01 / SET</span><span class="t">Narrow it down, or don't</span>
    <select id="fset"><option value="">Every set</option>${sets.map(x => `<option>${x.replace(/&/g, "&amp;")}</option>`).join("")}</select></div>
  <div class="step"><span class="n">02 / COUNT</span><span class="t">How many cards</span>
    <div class="chips" id="fcount">${[1,2,3,4,6,8,9].map(n => `<button class="chip" data-n="${n}">${n}</button>`).join("")}</div></div>
  <div class="step"><span class="n">03 / WHY</span><span class="t">What is this for</span>
    <div class="chips" id="fintent">
      <button class="chip on" data-i="post">A post</button>
      <button class="chip" data-i="want">Want list</button>
      <button class="chip" data-i="trade">Trade list</button>
      <button class="chip" data-i="sell">Selling</button>
    </div></div>
  <div class="step"><span class="n">04 / ANGLE</span><span class="t">What kind of post</span>
    <div class="chips" id="ftheme"></div></div>
</div>

<div id="refuse" class="refuse" hidden></div>
<div id="ideas" class="ideas"></div>

<details><summary>Search all ${index.length.toLocaleString("en-US")} cards instead</summary>
<div class="controls">
  <input id="q" placeholder="Pokémon, illustrator, or set" autocomplete="off">
  <select id="rar"><option value="">Any rarity</option>
    <option>Special Illustration Rare</option><option>Illustration Rare</option>
    <option>Rare Holo</option><option>Rare Secret</option><option>Rare Ultra</option></select>
  <input id="yr" placeholder="Year" inputmode="numeric">
</div>
<div class="results" id="res"></div>
</details>

<div class="page-label" id="plabel">YOUR PAGE</div>
<div class="binder" id="tray"></div>
<div class="status" id="st"></div>
<div class="tally" id="tally" hidden></div>
<input id="label" placeholder="Your line — or leave it blank and let the cards talk" style="margin-bottom:18px">

<div class="acts">
  <button class="pri" id="make" disabled>Make the image</button>
  <button class="sec" id="copy" hidden>Copy</button>
  <button class="sec" id="share" hidden>Share</button>
  <button class="sec" id="dl" hidden>Download</button>
</div>
<canvas id="cv"></canvas>

<div class="foot">Every image carries the Catch'em mark and the illustrator's name — the credit isn't ours to remove.
Cards marked in amber have no illustrator recorded in the public dataset. That's a backfill gap on recent sets,
not a Pokémon decision, and you can still use them.</div>
</div>
<script>
const THEMES = ${JSON.stringify(themes?.themes ?? [])};
const SETS = ${JSON.stringify(sets)};
const LAYOUTS = ${JSON.stringify(Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, { cols: v.cols, cardW: v.cardW, name: v.name }])))};
const SUPPORTED = Object.keys(LAYOUTS).map(Number);
let INDEX = [], tray = [], blob = null;

const imgUrl = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";

fetch("card-index.json", { signal: AbortSignal.timeout(20000) }).then(r => r.json()).then(d => { INDEX = d; search(); })
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

// OWN / WANT is browser-only, on purpose. The moment we store what somebody owns
// we are holding collection data, which trips user-data-handling in the
// compliance register. In the browser it is a planning tool; on a server it is a
// liability we have not prepared for.
let owned = {};
try { owned = JSON.parse(localStorage.getItem("catchem-owned") || "{}"); } catch {}
function toggleOwn(id){
  owned[id] = !owned[id];
  try { localStorage.setItem("catchem-owned", JSON.stringify(owned)); } catch {}
  render();
}

function renderTally(){
  const box = el("tally");
  if (!tray.length) { box.hidden = true; return; }
  box.hidden = false;
  const priced = tray.filter(c => c.p != null);
  const total = priced.reduce((s, c) => s + c.p, 0);
  const have = tray.filter(c => owned[c.i]);
  const haveVal = have.filter(c => c.p != null).reduce((s, c) => s + c.p, 0);
  const missing = tray.length - priced.length;
  const money = n => "$" + Math.round(n).toLocaleString();
  // A total built from partial data must say so. Nine cards where two have no
  // price is not a page total, it is seven cards plus a guess.
  var html = "";
  // SINGLE-QUOTED ATTRIBUTES, DELIBERATELY. These lines are emitted INTO an
  // inline script, and the generator writes them from a template literal, where
  // a backslash-quote is an escape that resolves to a bare quote. So the
  // escaped class attribute here arrived in the output as a plain quoted
  // attribute, sitting inside a double-quoted JS string — which terminated that
  // string and left a stray identifier behind. The whole editor script failed
  // to parse: INDEX, add() and search() were all undefined and the page did
  // nothing at all. Single quotes need no escaping and cannot repeat it.
  // (This comment avoids backticks for the same reason: it lives inside the
  // template literal it describes.)
  html += "<div><span class='k'>PAGE COST</span><span class='v'>" + money(total);
  if (missing) html += " <span style='font-size:12px;color:var(--warn)'>+ " + missing + " unpriced</span>";
  html += "</span></div>";
  html += "<div><span class='k'>YOU HAVE</span><span class='v have'>" + have.length + " / " + tray.length + "</span></div>";
  html += "<div><span class='k'>STILL TO FIND</span><span class='v'>" + money(total - haveVal) + "</span></div>";
  if (priced.length) html += "<div><span class='k'>DEAREST</span><span class='v'>" + money(Math.max.apply(null, priced.map(c => c.p))) + "</span></div>";
  box.innerHTML = html;
}

// INTENT drives the copy, the frame, and one refusal.
let fIntent = "post";
el("fintent").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fIntent = b.dataset.i;
  el("fintent").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.i === fIntent));
  render();
});

// SEALED stock imagery is standard - every sealed box looks identical and a
// buyer is purchasing a SKU. SINGLES stock imagery is misrepresentation, because
// the whole question on a single is condition and the buyer needs to see THAT
// card. The refusal is the feature.
function checkIntent(){
  const box = el("refuse");
  const singles = tray.filter(c => !/booster|elite trainer|bundle|collection|tin|box/i.test(c.n));
  if (fIntent === "sell" && singles.length) {
    box.hidden = false;
    box.innerHTML = "<b>We will not make a sell image for singles.</b><br>" +
      "The whole question on a single is condition, and a buyer needs to see the card you are actually sending. " +
      "Stock art of a pristine copy is misrepresentation and marketplaces treat it that way. " +
      "<br><br>Photograph the card and we will format your photo instead — or switch to <b>want</b>, <b>trade</b> or <b>a post</b>, where stock art is exactly right.";
    return false;
  }
  box.hidden = true;
  return true;
}

function render(){
  const L = LAYOUTS[tray.length];
  const box = el("tray");
  // THE BINDER PAGE. Empty pockets are drawn for the rest of the chosen layout,
  // so a creator sees how many more fit without being told - the constraint
  // teaches itself, the way a nine-pocket page does in your hands.
  const cols = L ? L.cols : Math.min(Math.max(tray.length, 3), 3);
  const slots = L ? L.cols * Math.ceil(tray.length / L.cols) : Math.max(tray.length, 3);
  box.style.gridTemplateColumns = \`repeat(\${cols}, minmax(0, \${cols > 3 ? 120 : 148}px))\`;
  let html = tray.map((c, k) =>
    \`<div class="pocket filled"><img src="\${imgUrl(c.i)}" alt="\${c.n}"><button class="x" onclick="remove(\${k})" aria-label="Remove \${c.n}">×</button><button class="own \${owned[c.i] ? 'yes' : ''}" onclick="toggleOwn('\${c.i}')">\${owned[c.i] ? 'OWNED' : 'want'}</button></div>\`).join("");
  for (let i = tray.length; i < slots; i++) html += '<div class="pocket"></div>';
  box.innerHTML = html || '<div class="pocket"></div><div class="pocket"></div><div class="pocket"></div>';
  const allowed = checkIntent();
  renderTally();
  el("plabel").textContent = L ? ("YOUR PAGE — " + L.name.toUpperCase()) : "YOUR PAGE";

  el("make").disabled = !L || !allowed;
  el("cv").style.display = "none";
  ["copy","share","dl"].forEach(i => el(i).hidden = true);
  if (!tray.length) { setStatus("Pick an idea above, or search for a card."); return; }
  if (L) {
    const missing = tray.filter(c => !c.a).length;
    setStatus(\`\${tray.length} cards · \${L.cols} across\` + (missing ? \` · \${missing} without a recorded illustrator\` : ""), false);
  } else {
    const below = SUPPORTED.filter(n => n < tray.length).pop(), above = SUPPORTED.find(n => n > tray.length);
    setStatus(\`\${tray.length} cards has no frame. \${below ? "Remove " + (tray.length - below) : ""}\${below && above ? " or add " + (above - tray.length) : ""}.\`, true);
  }
}

// THE FUNNEL. Three small questions, then real combinations - not a list of
// themes but a list of POSTS, each already loadable into the tray. A creator
// who arrives without an idea should leave with three.
let fSet = "", fCount = 0, fTheme = null;

function renderThemes(){
  const box = el("ftheme");
  const fits = THEMES.filter(t => !fCount || (t.bestAt || []).includes(fCount));
  box.innerHTML = fits.map(t => \`<button class="chip\${fTheme===t.id?" on":""}" data-t="\${t.id}">\${t.name}</button>\`).join("")
    || "<span class='empty'>no theme suits that count — try another</span>";
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => { fTheme = b.dataset.t; renderThemes(); buildIdeas(); });
}
el("fcount").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fCount = fCount === +b.dataset.n ? 0 : +b.dataset.n;
  el("fcount").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", +x.dataset.n === fCount));
  if (fTheme && !THEMES.find(t => t.id === fTheme && (t.bestAt||[]).includes(fCount))) fTheme = null;
  renderThemes(); buildIdeas();
});
el("fset").onchange = () => { fSet = el("fset").value; buildIdeas(); };

const HERO_RX = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare)/i;

function buildIdeas(){
  const box = el("ideas");
  if (!fCount || !fTheme) { box.innerHTML = ""; return; }
  const t = THEMES.find(x => x.id === fTheme);
  const pool = INDEX.filter(c => (!fSet || c.s === fSet) && HERO_RX.test(c.r || ""));
  const ideas = [];

  if (t.kind === "named list") {
    // A stored list, so the grouping is arguable rather than asserted.
    const hits = pool.filter(c => t.members.some(m => c.n.startsWith(m)));
    const byMon = {};
    for (const c of hits) { const m = t.members.find(x => c.n.startsWith(x)); if (!byMon[m]) byMon[m] = c; }
    const picked = Object.values(byMon).slice(0, fCount);
    if (picked.length === fCount) ideas.push({ title: t.name, sub: picked.map(c=>c.n).join(" · "), hook: t.hook, cards: picked });
  }
  if (t.id === "many-hands") {
    const byName = {};
    for (const c of pool) (byName[c.n.split(" ")[0]] ||= []).push(c);
    for (const [mon, list] of Object.entries(byName)) {
      const seen = new Map();
      for (const c of list) if (c.a && !seen.has(c.a)) seen.set(c.a, c);
      if (seen.size >= fCount) ideas.push({ title: mon + " by " + fCount + " illustrators",
        sub: [...seen.keys()].slice(0, fCount).join(" · "), hook: fCount + " artists. One " + mon + ". Which is definitive?",
        cards: [...seen.values()].slice(0, fCount) });
      if (ideas.length >= 6) break;
    }
  }
  if (t.id === "artist-career" || t.id === "first-and-last") {
    const byArtist = {};
    for (const c of pool) if (c.a) (byArtist[c.a] ||= []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < fCount) continue;
      const sorted = list.sort((a,b) => (a.y||"") < (b.y||"") ? -1 : 1);
      const span = Number(sorted[sorted.length-1].y) - Number(sorted[0].y);
      if (span < 8) continue;
      const picked = fCount === 2 ? [sorted[0], sorted[sorted.length-1]]
        : sorted.filter((_,i,arr) => i % Math.max(1, Math.floor(arr.length/fCount)) === 0).slice(0, fCount);
      if (picked.length !== fCount) continue;
      ideas.push({ title: artist, sub: picked.map(c => c.n + " " + c.y).join("  →  "),
        hook: span + " years apart. Same illustrator.", cards: picked });
      if (ideas.length >= 6) break;
    }
  }
  if (t.id === "set-showcase" && fSet) {
    const best = pool.slice(0, fCount);
    if (best.length === fCount) ideas.push({ title: "The best of " + fSet, sub: best.map(c=>c.n).join(" · "),
      hook: fCount + " from " + fSet + ". Which page are you filling first?", cards: best });
  }

  box.innerHTML = ideas.length ? ideas.slice(0,6).map((idea,k) =>
    \`<div class="idea" onclick="loadIdea(\${k})"><b>\${idea.title}</b><i>\${idea.sub}</i><div class="hook">\${idea.hook}</div></div>\`).join("")
    : "<div class='empty'>nothing fits that combination — try a different count or set</div>";
  window.__ideas = ideas;
}

function loadIdea(k){
  const idea = window.__ideas[k]; if (!idea) return;
  tray = idea.cards.slice(); blob = null;
  el("label").value = idea.hook;
  render();
  el("make").scrollIntoView({ behavior: "smooth", block: "center" });
}
renderThemes();

el("make").onclick = async () => {
  const L = LAYOUTS[tray.length]; if (!L) return;
  setStatus("composing…");
  const CW = 745, CH = 1040, GAP = 60, PAD = 90, CAP = tray.length <= 4 ? 70 : 0;
  const LABEL = el("label").value.trim();
  // Reserve height for the WRAPPED label, not one line of it. measureText needs
  // a context we do not have yet, so estimate from character count at 52px bold
  // (~28px per glyph across the usable width) and cap at the three lines the
  // renderer will draw. Over-reserving costs blank pixels; under-reserving costs
  // a caption printed through the footer.
  const LABLINES = LABEL ? Math.min(3, Math.max(1, Math.ceil(LABEL.length / Math.floor((2535 - 160) / 28)))) : 0;
  const LABH = LABEL ? 110 + (LABLINES - 1) * 62 : 0;
  const ROWS = Math.ceil(tray.length / L.cols);
  const W = PAD*2 + CW*L.cols + GAP*(L.cols-1);
  const H = PAD + (CH+CAP)*ROWS + GAP*(ROWS-1) + LABH + (fIntent === "post" ? 110 : 190);
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
      // WRAP, DO NOT OVERFLOW. A 182-character label was drawn as one line and
      // ran off BOTH edges — it started mid-word and ended mid-word, because
      // fillText neither wraps nor clips, it just draws past the canvas. The
      // label is the one field a creator controls, so it is the one most
      // certain to be longer than anyone designing the layout expected.
      // DOUBLE BACKSLASH. This string is written from a template literal, where
      // \\s is not a recognised escape and collapses to a bare s — so a regex
      // written here as one backslash arrived in the browser as /s+/ and split
      // the label on the LETTER s. Every s vanished: "absolutely" rendered as
      // "ab olutely". Same root cause as the quote bug above, one line later.
      var maxW = W - 160, words = LABEL.split(/\\s+/), lines = [], cur = "";
      for (var wi = 0; wi < words.length; wi++){
        var trial = cur ? cur + " " + words[wi] : words[wi];
        if (g.measureText(trial).width > maxW && cur){ lines.push(cur); cur = words[wi]; }
        else cur = trial;
      }
      if (cur) lines.push(cur);
      // Three lines is already a paragraph on a card; past that the label is
      // doing the job the post's own text should do.
      if (lines.length > 3){ lines = lines.slice(0,3); lines[2] = lines[2].replace(/\\s+\\S*$/, "") + "…"; }
      for (var li = 0; li < lines.length; li++)
        g.fillText(lines[li], W/2, H - 150 - (lines.length - 1 - li) * 62);
    }
    // WANT LIST FRAME. A post wants a clean image; a want list is a WORKING
    // document. It gets held up at a table or pasted into a trade thread, so
    // it needs the price under each card and a total at the bottom - the two
    // things somebody deciding whether to help you actually needs.
    if (fIntent === "want" || fIntent === "trade" || fIntent === "sell") {
      const priced = tray.filter(c => c.p != null);
      const total = priced.reduce((a, c) => a + c.p, 0);
      g.fillStyle = "#8a93a8"; g.font = "26px system-ui,sans-serif"; g.textAlign = "center";
      tray.forEach((c, i) => {
        if (c.p == null) return;
        const x = PAD + (i % L.cols) * (CW + GAP), y = PAD + Math.floor(i / L.cols) * (CH + CAP + GAP);
        g.fillStyle = owned[c.i] ? "#36d399" : "#8a93a8";
        g.fillText((owned[c.i] ? "HAVE  " : "") + "$" + Math.round(c.p).toLocaleString(), x + CW / 2, y + CH + (CAP ? 82 : 40));
      });
      const label = fIntent === "want" ? "Looking for" : fIntent === "trade" ? "Trade list" : "For sale";
      g.fillStyle = "#f4f5f8"; g.font = "800 44px system-ui,sans-serif"; g.textAlign = "left";
      g.fillText(label, PAD, H - 118);
      g.font = "34px ui-monospace,monospace"; g.fillStyle = "#8a93a8"; g.textAlign = "right";
      // A total built from partial data says so, here as everywhere.
      const missing = tray.length - priced.length;
      g.fillText("$" + Math.round(total).toLocaleString() + (missing ? "  +" + missing + " unpriced" : ""), W - PAD, H - 118);
    }
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
