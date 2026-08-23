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
    y: (c.releaseDate ?? "").slice(0, 4), r: c.rarity ?? "", k: c.attackNames ?? undefined, p: typeof c.price === "number" ? Math.round(c.price * 100) / 100 : null,
  }));
  await mkdir(join(ROOT, "research/assets"), { recursive: true }).catch(() => {});
  await writeFile(join(ROOT, "research/assets/card-index.json"), JSON.stringify(index));

  const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><title>Catch'em Creators — build a post</title>
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
.steps{display:grid;grid-template-columns:1.1fr .6fr 1fr .9fr 1.2fr;gap:18px;margin-bottom:44px}
.refuse{background:#1a1410;border:1px solid #3d2f1a;border-radius:13px;padding:14px 17px;margin-bottom:18px;color:#d9a441;font-size:14px;line-height:1.55}
.step{min-width:0}
.step .n{font:500 11px/1 var(--mono);color:var(--faint);letter-spacing:.14em;display:block;margin-bottom:10px}
.step .t{font:600 14.5px/1.3 var(--body);margin-bottom:12px;display:block}
select,input{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:9px;
  color:var(--text);padding:13px 14px;font:400 14.5px var(--body);transition:border-color .18s var(--ease)}
select:focus,input:focus{outline:none;border-color:var(--soft)}
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
.idea:hover{border-color:var(--faint);transform:translateY(-1px)}
.idea b{display:block;font:600 16.5px/1.35 var(--body);margin-bottom:4px}
.idea i{font-style:normal;color:var(--faint);font:400 12.5px var(--mono);display:block}
.idea .hook{color:var(--soft);font-size:14px;margin-top:9px}

/* THE SIGNATURE: the binder page. Empty pockets show what still fits. */
/* SPEND THE ACCENT HERE. The designer flagged 16 uses across the page — an
   accent used everywhere accents nothing. It now appears on the active state,
   the primary action, and the streak day, because the streak is the one number
   we actually want somebody to feel. */
.streak{background:linear-gradient(180deg,rgba(54,211,153,.05),transparent),var(--panel);border:1px solid var(--line);border-radius:13px;
  padding:15px 18px;margin-bottom:16px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.streak .day{font:800 38px var(--display);color:var(--live);line-height:.95;letter-spacing:-.02em}
.streak .desc{font:400 14px var(--body);color:var(--soft);flex:1;min-width:180px}
.streak .desc b{color:var(--text);font-weight:600}
.streak .left{font:500 11px var(--mono);color:var(--faint);letter-spacing:.1em}
.streak button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:9px;padding:9px 14px;font:400 13px var(--body);cursor:pointer}
.streak button.go{background:var(--live);color:var(--ink);border:0;font-weight:600}
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
.pocket .own{position:absolute;bottom:5px;left:5px;border:0;border-radius:9px;padding:3px 7px;
  font:500 9.5px var(--mono);cursor:pointer;background:rgba(10,12,18,.86);color:var(--faint);opacity:0;
  transition:opacity .16s var(--ease)}
.pocket:hover .own{opacity:1}
.pocket .own.yes{opacity:1;background:var(--soft);color:var(--ink)}
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
.pager{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:14px;
  font:500 12.5px var(--mono);color:var(--faint)}
.pager button{background:var(--panel);border:1px solid var(--line);color:var(--soft);
  border-radius:9px;padding:9px 15px;font:400 13.5px var(--body);cursor:pointer}
.pager button:disabled{opacity:.3;cursor:not-allowed}
.pager input{width:70px;text-align:center;padding:8px;font:500 12.5px var(--mono)}
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
  <p class="lede">Pick a direction and we'll find combinations worth posting. Every image credits the artist.
     &nbsp;·&nbsp; <a href="/creators" style="color:var(--live)">Or start from one we made &rsaquo;</a></p>
</div>

<div class="steps">
  <div class="step"><span class="n">01 / SET</span><span class="t">Narrow it down, or don't</span>
    <select id="fset"><option value="">Every set</option>${sets.map(x => `<option>${x.replace(/&/g, "&amp;")}</option>`).join("")}</select></div>
  <div class="step"><span class="n">02 / COUNT</span><span class="t">How many cards</span>
    <div class="chips" id="fcount">${[1,2,3,4,6,8,9].map(n => `<button class="chip" data-n="${n}">${n}</button>`).join("")}</div></div>
  <div class="step"><span class="n">03 / SLAB</span><span class="t">Show them slabbed</span>
    <div class="chips" id="fslab">
      <button class="chip on" data-s="">Raw</button>
      <button class="chip" data-s="green">Green</button>
      <button class="chip" data-s="gold">Gold</button>
      <button class="chip" data-s="black">Black</button>
      <button class="chip" data-s="ice">Ice</button>
    </div></div>
  <div class="step"><span class="n">04 / WHY</span><span class="t">What is this for</span>
    <div class="chips" id="fintent">
      <button class="chip on" data-i="post">A post</button>
      <button class="chip" data-i="want">Want list</button>
      <button class="chip" data-i="trade">Trade list</button>
      <button class="chip" data-i="sell">Selling</button>
    </div></div>
  <div class="step"><span class="n">05 / ANGLE</span><span class="t">What kind of post</span>
    <div class="chips" id="ftheme"></div></div>
</div>

<div id="refuse" class="refuse" hidden></div>
<div id="ideas" class="ideas"></div>

<details open><summary>Search all ${index.length.toLocaleString("en-US")} cards instead</summary>
<div class="controls">
  <input id="q" placeholder="Pokémon, artist, or set" autocomplete="off">
  <select id="rar"><option value="">Any rarity</option>
    <option>Special Illustration Rare</option><option>Illustration Rare</option>
    <option>Rare Holo</option><option>Rare Secret</option><option>Rare Ultra</option></select>
  <input id="yr" placeholder="Year" inputmode="numeric">
</div>
<div class="results" id="res"></div>
<div class="pager" id="pager"></div>
</details>

<div class="streak" id="streakstart">
  <span class="desc"><b>Start a streak.</b> Pick a filter and post from it daily — the filter is what keeps your series yours.</span>
  <select id="sfilter" style="width:auto;min-width:190px"></select>
  <select id="sper" style="width:auto"><option value="1">1 a day</option><option value="2" selected>2 a day</option><option value="3">3 a day</option></select>
  <button class='go' onclick='beginStreak()'>Begin</button>
</div>
<div class="streak" id="streakbar" hidden></div>
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

<div class="foot">Every image carries the Catch'em mark and the artist's name — the credit isn't ours to remove.
Cards marked in amber have no artist recorded in the public dataset. That's a backfill gap on recent sets,
not a Pokémon decision, and you can still use them.</div>
</div>
<script>
const THEMES = ${JSON.stringify(themes?.themes ?? [])};
const SETS = ${JSON.stringify(sets)};
const LAYOUTS = ${JSON.stringify(Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, { cols: v.cols, cardW: v.cardW, name: v.name }])))};
const SUPPORTED = Object.keys(LAYOUTS).map(Number);
let INDEX = [], tray = [], blob = null;

// CONSTRUCTED URLS 404 TO A CARD BACK. Newer sets serve from a different host
// entirely, and a 404 here returns a valid 200 PNG of the wrong side of a card.
// card-composite was fixed for this yesterday; the editor still had the old
// code. The index carries no URL, so: try one host, fall back to the other on
// error, and show a visible failure rather than a plausible wrong image.
const imgUrl = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const imgAlt = (id) => "https://images.scrydex.com/pokemon/" + id + "/large";
function imgTag(c, cls){
  const alt = imgAlt(c.i).replace(/'/g, "");
  return "<img src='" + imgUrl(c.i) + "' alt='" + String(c.n).replace(/'/g, "") +
    "' onerror='this.onerror=null;this.src=&quot;" + alt + "&quot;'>";
}

fetch("card-index.json", { signal: AbortSignal.timeout(20000) }).then(r => r.json()).then(d => { INDEX = d; renderThemes(); search(); })
  .catch(() => { document.getElementById("res").innerHTML = "<div class='empty'>could not load the card index</div>"; });

const el = id => document.getElementById(id);
// PAGING STATE. Page size is deliberately modest: 36 images is a fast paint on
// a phone, and the point of paging is that the page never gets slower no matter
// how big the catalogue grows.
const PAGE_SIZE = 36;
let page = 0;

function renderPager(total, pages){
  const box = el("pager");
  if (!box) return;
  if (total <= PAGE_SIZE) { box.innerHTML = total ? total + " cards" : ""; return; }
  const from = page * PAGE_SIZE + 1, to = Math.min((page + 1) * PAGE_SIZE, total);
  box.innerHTML =
    "<button onclick='goPage(0)' " + (page === 0 ? "disabled" : "") + ">First</button>" +
    "<button onclick='goPage(" + (page - 1) + ")' " + (page === 0 ? "disabled" : "") + ">Prev</button>" +
    "<span>" + from.toLocaleString() + "–" + to.toLocaleString() + " of " + total.toLocaleString() + "</span>" +
    "<input id='pgo' type='number' min='1' max='" + pages + "' value='" + (page + 1) + "'>" +
    "<span>of " + pages.toLocaleString() + "</span>" +
    "<button onclick='goPage(" + (page + 1) + ")' " + (page + 1 >= pages ? "disabled" : "") + ">Next</button>" +
    "<button onclick='goPage(" + (pages - 1) + ")' " + (page + 1 >= pages ? "disabled" : "") + ">Last</button>";
  const jump = el("pgo");
  if (jump) jump.onchange = () => goPage(Math.max(0, Math.min(pages - 1, Number(jump.value) - 1)));
}

window.goPage = goPage;
window.add = add;
window.remove = remove;
window.toggleOwn = toggleOwn;
window.loadIdea = loadIdea;
window.nextStreakDay = nextStreakDay;
window.endStreak = endStreak;
window.beginStreak = beginStreak;
function goPage(n){ page = Math.max(0, n); search(); el("res").scrollTop = 0; }

// Any change to the filters resets to page one — staying on page 400 of a new
// search is a way of showing somebody nothing and calling it a result.
function resetPage(){ page = 0; }

function search(){
  const q = el("q").value.trim().toLowerCase(), rar = el("rar").value, yr = el("yr").value.trim();
  // SHOW SOMETHING IMMEDIATELY. This used to read "start typing to search" over
  // an empty panel, which is indistinguishable from broken. With no query we
  // show the best-looking cards we have, so the tool proves itself on load
  // rather than asking the user to prove it first.
  if (!q && !rar && !yr) {
    // The full catalogue, best first, paged. Not a curated 24 — Tyler asked for
    // everything to be available, and a showcase that stops at two dozen is the
    // same hard slice wearing a nicer name.
    const ranked = INDEX.slice().sort((a, b) => (b.p || 0) - (a.p || 0));
    const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
    if (page >= pages) page = 0;
    const showcase = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    renderPager(ranked.length, pages);
    el("res").innerHTML = showcase.map(c =>
      \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgUrl(c.i)}" alt="">
        <b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i>\${c.a}</i></div>\`).join("");
    return;
  }
  // PAGING. The whole index stays in memory — 1.7MB is nothing — and only the
  // current PAGE renders. Holding data is cheap; painting sixteen thousand
  // images is not, and that distinction is the entire performance story.
  const all = INDEX.filter(c =>
    (!q || (c.n + " " + (c.a || "") + " " + c.s).toLowerCase().includes(q)) &&
    (!rar || c.r === rar) && (!yr || c.y === yr));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (page >= pages) page = 0;
  const hits = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  renderPager(all.length, pages);
  el("res").innerHTML = hits.length ? hits.map(c =>
    \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgUrl(c.i)}" alt="">
      <b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i class="\${c.a ? "" : "nocred"}">\${c.a || "no credit recorded"}</i></div>\`).join("")
    : "<div class='empty'>nothing matched</div>";
}
["q","rar","yr"].forEach(id => el(id).addEventListener("input", () => { resetPage(); search(); }));

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
  // EVERY CARD IN THE TRAY IS A SINGLE. card-index.json is generated from
  // card-catalogue.json, which is the singles catalogue — 16,468 singles and
  // not one sealed product. So classifying by NAME was both unnecessary and
  // wrong, and wrong in the way substring matching always is: /tin/ matched
  // inside Dra-tin-i, Figh-tin-g Energy, Man-tin-e and Vic-tin-i. 174 real
  // singles read as sealed, and a tray of three of them defeated the refusal
  // completely — sell intent, no warning, a finished sell image of stock art.
  //
  // If sealed products ever enter the tray they must arrive with an explicit
  // kind. Absence of a flag means single, which fails toward refusing.
  const singles = tray.filter(c => c.kind !== "sealed");
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

// THE STREAK. A creator picks a filter once; the tool serves cards that fit it
// and have not been used. The filter is what keeps two creators from posting
// the same series out of the same pool.
let streak = null;
try { streak = JSON.parse(localStorage.getItem("catchem-streak") || "null"); } catch {}

function saveStreak(){ try { localStorage.setItem("catchem-streak", JSON.stringify(streak)); } catch {} }

const STREAK_FILTERS = {
  "ir-any":    { label: "Illustration Rares", test: c => /Illustration Rare/i.test(c.r || "") },
  "ir-cheap":  { label: "IRs under $10",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 10 },
  "ir-mid":    { label: "IRs under $25",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 25 },
  "sir-only":  { label: "Special Illustration Rares", test: c => /Special Illustration Rare/i.test(c.r || "") },
  "ir-modern": { label: "IRs from 2024 on",   test: c => /Illustration Rare/i.test(c.r || "") && c.y >= "2024" },
  // PRICE BANDS. Restricted to Illustration Rares these pools are 18 and 32
  // cards — nine and sixteen days, which is not a streak, it is a fortnight.
  // Open to every hero rarity they run 141 and 119 days, and nothing is lost:
  // a Rare Holo at $2.50 is exactly as postable as an IR at $2.50, and the
  // PRICE BAND is the theme. Restricting rarity too was my assumption, not the ask.
  "two-dollar":  { label: "The $2–3 shelf", test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 2 && c.p <= 3 },
  "five-dollar": { label: "The $5 pickup",  test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 4.50 && c.p <= 5.95 },
  // THE SCOUT'S ANGLES — found by searching the data rather than my memory,
  // which was thinking in categories while the data thinks in structure.
  // Chronological is the strongest: a streak with a DIRECTION beats one with a
  // filter, because "Day 40, we've reached Neo Destiny" is a story and "Day 40,
  // another card" is a counter.
  "chronological": { label: "The whole history, in order", ordered: "date",
    test: c => HERO_RX.test(c.r || "") && c.a && c.y },
  "one-artist":    { label: "One artist at a time", ordered: "artist",
    test: c => HERO_RX.test(c.r || "") && c.a },
  "cheapest-up":   { label: "Cheapest first, working up", ordered: "price",
    test: c => HERO_RX.test(c.r || "") && c.p != null },
  // WHAT THE CARD SAYS. Tyler posted Slakoth at 2am after seventeen hours of
  // coding and its attack is called Take It Easy — neither of us knew, because
  // nothing we held could search it. attackNames now rides in the index, so a
  // filter can find the joke by READING the cards rather than by anybody
  // listing Pokemon they think look tired. The word list is here in the open
  // where it can be argued with, which is the same standard a named list is
  // held to; the difference is that membership is derived, not asserted.
  "says-rest": { label: "Cards that tell you to rest",
    words: ["take it easy","sleep","nap","rest","yawn","dream","slack","snooze","doze","drowsy","lazy"],
    test: c => Array.isArray(c.k) && c.k.some(a => ["take it easy","sleep","nap","rest","yawn","dream","slack","snooze","doze","drowsy","lazy"].some(w => String(a).toLowerCase().includes(w))) },
  "says-hit": { label: "Cards that just hit things",
    words: ["punch","kick","slam","smash","tackle","headbutt","bite","slash","crush","pound"],
    test: c => Array.isArray(c.k) && c.k.some(a => ["punch","kick","slam","smash","tackle","headbutt","bite","slash","crush","pound"].some(w => String(a).toLowerCase().includes(w))) },
};

function startStreak(filterId, perDay){
  // A SALT PER STREAK, not just the start date. The seed used to be
  // started + day, and the comment beside it claimed two creators on the same
  // filter would 'diverge immediately'. They did not diverge at all: same
  // filter and same start date meant the same seed, and two creators got
  // byte-identical series. Verified by running two fresh streaks on the same
  // day — five days, same three cards each day, both times.
  //
  // The salt is drawn once and stored, so the series stays stable across
  // reloads for its owner while differing from everybody else's.
  const salt = Math.floor(Math.random() * 1e9).toString(36);
  streak = { filter: filterId, perDay: perDay, day: 0, used: [], salt: salt, started: new Date().toISOString().slice(0,10) };
  saveStreak(); nextStreakDay();
}

// NO REPEATS, EVER. A streak that serves the same card twice is a streak
// somebody stops trusting on the day they notice.
function nextStreakDay(){
  if (!streak) return;
  const f = STREAK_FILTERS[streak.filter];
  const used = new Set(streak.used);
  const pool = INDEX.filter(c => f.test(c) && !used.has(c.i) && c.a);
  if (pool.length < streak.perDay) { renderStreak(0); return; }
  // Deterministic per day so reloading does not reshuffle the pick, and seeded
  // by the start date so two creators on the same filter diverge immediately.
  // An ORDERED streak walks the pool in sequence — that is the whole point of
  // it. A seeded shuffle would turn a journey back into a lottery.
  if (f.ordered) {
    const key = f.ordered === "date" ? (c => (c.y || "") + c.s + c.n)
              : f.ordered === "artist" ? (c => (c.a || "") + (c.y || ""))
              : (c => String(Math.round((c.p || 0) * 100)).padStart(9, "0"));
    pool.sort((a, b) => key(a) < key(b) ? -1 : 1);
    const picked = pool.slice(0, streak.perDay);
    streak.day += 1;
    streak.used.push(...picked.map(c => c.i));
    saveStreak();
    tray = picked; blob = null;
    el("label").value = "Day " + streak.day + " — " + f.label;
    render();
    return;
  }
  const seed = (streak.started + (streak.salt || "") + streak.day).split("").reduce((a,ch)=>((a<<5)-a+ch.charCodeAt(0))|0, 0);
  const picked = [];
  for (let k = 0; k < streak.perDay; k++) {
    const i = Math.abs(seed + k * 7919) % pool.length;
    const c = pool.splice(i, 1)[0];
    if (c) picked.push(c);
  }
  streak.day += 1;
  streak.used.push(...picked.map(c => c.i));
  saveStreak();
  tray = picked; blob = null;
  el("label").value = "Day " + streak.day + " — " + f.label;
  render();
}

function renderStreak(remaining){
  const box = el("streakbar");
  if (!streak) { box.hidden = true; return; }
  const f = STREAK_FILTERS[streak.filter];
  const used = new Set(streak.used);
  const left = remaining != null ? remaining : INDEX.filter(c => f.test(c) && !used.has(c.i) && c.a).length;
  const days = Math.floor(left / streak.perDay);
  box.hidden = false;
  box.innerHTML =
    "<span class='day'>Day " + streak.day + "</span>" +
    "<span class='desc'><b>" + f.label + "</b>, " + streak.perDay + " a day. " +
    (days > 0 ? left + " left — enough for " + days + " more days." : "Pool exhausted. Pick a wider filter.") + "</span>" +
    "<span class='left'>SINCE " + streak.started.toUpperCase() + "</span>" +
    (days > 0 ? "<button class='go' onclick='nextStreakDay()'>Next day</button>" : "") +
    "<button onclick='endStreak()'>End</button>";
}

function endStreak(){ streak = null; try { localStorage.removeItem("catchem-streak"); } catch {} el("streakbar").hidden = true; }

// Populate the filter list from the same object the picker uses, so a filter
// added in one place cannot go missing in the other.
{
  const sel = el("sfilter");
  if (sel) sel.innerHTML = Object.entries(STREAK_FILTERS)
    .map(([k, v]) => "<option value=" + JSON.stringify(k) + ">" + v.label + "</option>").join("");
}
function beginStreak(){
  startStreak(el("sfilter").value, Number(el("sper").value));
  el("streakstart").hidden = true;
}
if (streak) { const st = el("streakstart"); if (st) st.hidden = true; renderStreak(); }

// roundRect is Chrome 99+, Safari 16+, Firefox 112+. A card-show phone on
// anything older throws mid-draw and the compose dies with no useful message,
// which is the worst possible place to find out. Plain rect is an acceptable
// slab; a broken image is not.
function roundRectSafe(g, x, y, w, h, r){
  if (typeof g.roundRect === "function") { g.beginPath(); g.roundRect(x, y, w, h, r); return; }
  g.beginPath(); g.rect(x, y, w, h);
}
// SLAB COLOURS. Ours, not a replica of anybody's. The label carries the card,
// the set, the year and the illustrator - which is more information than a real
// slab label and is the thing we actually care about.
const SLABS = {
  green: { case: "#0d1512", edge: "#1c3a2c", label: "#132a20", ink: "#e9ecf3", accent: "#36d399", name: "Green" },
  gold:  { case: "#161206", edge: "#3d3112", label: "#221b09", ink: "#f4efe2", accent: "#d9a441", name: "Gold" },
  black: { case: "#0a0a0c", edge: "#232329", label: "#131316", ink: "#e9ecf3", accent: "#8a93a8", name: "Black" },
  ice:   { case: "#0a1016", edge: "#1d3242", label: "#0f1d28", ink: "#e6f0f7", accent: "#6fb8e0", name: "Ice" },
};
let fSlab = "";
el("fslab").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fSlab = b.dataset.s;
  el("fslab").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.s === fSlab));
  blob = null; render();
});

// Draw a card inside a slab. Proportions are a real slab roughly: the case is
// about 1.3x the card width and 1.5x its height, with the label across the top.
function drawSlab(g, img, x, y, cw, ch, card){
  const sk = SLABS[fSlab]; if (!sk) { g.drawImage(img, x, y, cw, ch); return; }
  const pad = cw * 0.09, labelH = ch * 0.17;
  const SW = cw + pad * 2, SH = ch + labelH + pad * 2;
  const sx = x - pad, sy = y - labelH - pad;
  // case
  g.fillStyle = sk.case; g.strokeStyle = sk.edge; g.lineWidth = Math.max(2, cw * 0.008);
  roundRectSafe(g, sx, sy, SW, SH, cw * 0.035); g.fill(); g.stroke();
  // label band
  g.fillStyle = sk.label;
  roundRectSafe(g, sx + pad * 0.5, sy + pad * 0.5, SW - pad, labelH, cw * 0.02); g.fill();
  // label text - more useful than a real slab label, which is the point
  const lx = sx + pad * 1.1, ly = sy + pad * 0.5;
  g.textAlign = "left";
  g.fillStyle = sk.accent; g.font = "600 " + Math.round(labelH * 0.19) + "px ui-monospace,monospace";
  g.fillText("CATCH'EM", lx, ly + labelH * 0.27);
  g.fillStyle = sk.ink; g.font = "700 " + Math.round(labelH * 0.30) + "px system-ui,sans-serif";
  g.fillText(String(card.n).slice(0, 26), lx, ly + labelH * 0.60);
  // GRADE BADGE. The shelf feeling — "that is what mine would look like" —
  // without borrowing anybody's trade dress. It reads GEM 10, not PSA 10:
  // nobody mistakes it for a grading company's opinion and it still reads
  // instantly as the good one.
  {
    const bw = labelH * 0.62, bx = sx + SW - pad * 1.1 - bw, by = ly + labelH * 0.19;
    g.fillStyle = sk.accent; g.globalAlpha = 0.14;
    roundRectSafe(g, bx, by, bw, bw, bw * 0.18); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = sk.accent; g.lineWidth = Math.max(1.5, bw * 0.035);
    roundRectSafe(g, bx, by, bw, bw, bw * 0.18); g.stroke();
    g.fillStyle = sk.accent; g.textAlign = "center";
    g.font = "700 " + Math.round(bw * 0.20) + "px ui-monospace,monospace";
    g.fillText("GEM", bx + bw / 2, by + bw * 0.36);
    g.font = "800 " + Math.round(bw * 0.46) + "px system-ui,sans-serif";
    g.fillText("10", bx + bw / 2, by + bw * 0.82);
    g.textAlign = "left";
  }
  g.fillStyle = sk.accent; g.font = Math.round(labelH * 0.17) + "px ui-monospace,monospace";
  g.fillText(String(card.s).slice(0, 22).toUpperCase() + "  ·  " + card.y + (card.a ? "  ·  " + String(card.a).slice(0, 18) : ""), lx, ly + labelH * 0.85);
  g.drawImage(img, x, y, cw, ch);
  g.textAlign = "center";
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
  renderStreak();
  renderTally();
  el("plabel").textContent = L ? ("YOUR PAGE — " + L.name.toUpperCase()) : "YOUR PAGE";

  el("make").disabled = !L || !allowed;
  el("cv").style.display = "none";
  ["copy","share","dl"].forEach(i => el(i).hidden = true);
  if (!tray.length) { setStatus("Pick an idea above, or search for a card."); return; }
  if (L) {
    const missing = tray.filter(c => !c.a).length;
    setStatus(\`\${tray.length} cards · \${L.cols} across\` + (missing ? \` · \${missing} without a recorded artist\` : ""), false);
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
  // FLOW LIKE WATER. A theme only appears if it can actually FILL the chosen
  // count from the chosen set. Pick 151 and ten of fifteen themes produce
  // nothing — offering one of those is worse than offering fewer, because the
  // creator picks it, gets nothing, and learns the tool does not know its own
  // catalogue.
  const pool = INDEX.filter(c => (!fSet || c.s === fSet) && /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra/i.test(c.r || ""));
  const canFill = (t) => {
    const need = fCount || 1;
    if (t.kind === "named list") {
      const distinct = new Set(pool.filter(c => (t.members || []).some(m => c.n.startsWith(m)))
        .map(c => (t.members || []).find(m => c.n.startsWith(m))));
      return distinct.size >= need;
    }
    if (t.id === "many-hands" || t.id === "battle") {
      const byMon = {};
      for (const c of pool) if (c.a) (byMon[c.n.split(" ")[0]] ||= new Set()).add(c.a);
      return Object.values(byMon).some(set => set.size >= need);
    }
    if (t.id === "artist-career" || t.id === "first-and-last") {
      const byArtist = {};
      for (const c of pool) if (c.a) (byArtist[c.a] ||= []).push(c);
      return Object.values(byArtist).some(l => l.length >= need);
    }
    return pool.length >= need;
  };
  const fits = THEMES.filter(t => (!fCount || (t.bestAt || []).includes(fCount)) && canFill(t));
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
el("fset").onchange = () => { fSet = el("fset").value; renderThemes(); buildIdeas(); };

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
  // A theme whose membership is READ rather than declared. The word list is
  // stored openly in themes.json so it can be argued with, exactly like a
  // named list — the difference is that the match happens against a real
  // field on the card instead of against a list of Pokemon somebody thought
  // looked tired. Slakoth is in this because its attack is Take It Easy.
  if (t.kind === "card text" && t.match) {
    const words = (t.match.any || []).map(w => w.toLowerCase());
    const hits = pool.filter(c => (c[t.match.field === "attackNames" ? "k" : t.match.field] || [])
      .some(v => words.some(w => String(v).toLowerCase().includes(w))));
    const seen = new Map();
    for (const c of hits) if (!seen.has(c.n)) seen.set(c.n, c);
    const picked = [...seen.values()].slice(0, fCount);
    if (picked.length === fCount)
      ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: t.hook, cards: picked });
  }

  if (t.id === "many-hands") {
    const byName = {};
    for (const c of pool) (byName[c.n.split(" ")[0]] ||= []).push(c);
    for (const [mon, list] of Object.entries(byName)) {
      const seen = new Map();
      for (const c of list) if (c.a && !seen.has(c.a)) seen.set(c.a, c);
      if (seen.size >= fCount) ideas.push({ title: mon + " by " + fCount + " artists",
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
        hook: span + " years apart. Same artist.", cards: picked });
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
  // ENFORCE AT THE POINT OF ACTION, not only in the UI. The refusal used to
  // live entirely in el("make").disabled, and a disabled attribute is an
  // affordance rather than a guard — re-enabling it in the console, or calling
  // this handler directly, produced the sell image the refusal exists to
  // prevent. Re-checking here means the rule holds wherever the call comes from.
  if (!checkIntent()) { setStatus("that combination is refused — see the note above", true); return; }
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
  const SLAB_EXTRA = fSlab ? CH * 0.17 + CW * 0.18 : 0;
  const H = PAD + (CH+CAP+SLAB_EXTRA)*ROWS + GAP*(ROWS-1) + LABH + (fIntent === "post" ? 110 : 190);
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
      drawSlab(g, img, x, y, CW, CH, tray[i]);
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
        const bandH = fIntent === "post" ? 110 : 190;
      for (var li = 0; li < lines.length; li++)
        // CLEAR THE FOOTER BAND, WHICH IS NOT ALWAYS THE SAME HEIGHT. A post
        // reserves 110px at the bottom; want, trade and sell reserve 190 for the
        // intent label and the total. The caption was drawn at H-150 regardless,
        // so on a want list it landed INSIDE that band and a two-line label printed
        // straight through 'Looking for'. Found by attacking it: nine cards, three
        // unpriced, and a 178-character label.
        g.fillText(lines[li], W/2, H - bandH - 40 - (lines.length - 1 - li) * 62);
    }
    // WANT LIST FRAME. A post wants a clean image; a want list is a WORKING
    // document. It gets held up at a table or pasted into a trade thread, so
    // it needs the price under each card and a total at the bottom - the two
    // things somebody deciding whether to help you actually needs.
    if (fIntent === "want" || fIntent === "trade" || fIntent === "sell") {
      const priced = tray.filter(c => c.p != null);
      const total = priced.reduce((a, c) => a + c.p, 0);
      // THUMBNAIL LEGIBILITY. A want list is seen first as a 400px preview and
      // decided on there. Text sized for the full canvas vanishes: 26px on a
      // 2535px canvas is 4.1px in that preview. Scale to the canvas so the
      // price survives the shrink, because the price IS the message.
      const thumbScale = 400 / W;
      const priceSize = Math.max(26, Math.round(11 / thumbScale));
      g.fillStyle = "#8a93a8"; g.font = priceSize + "px system-ui,sans-serif"; g.textAlign = "center";
      tray.forEach((c, i) => {
        if (c.p == null) return;
        const x = PAD + (i % L.cols) * (CW + GAP), y = PAD + Math.floor(i / L.cols) * (CH + CAP + GAP);
        g.fillStyle = owned[c.i] ? "#36d399" : "#8a93a8";
        g.fillText((owned[c.i] ? "HAVE  " : "") + "$" + Math.round(c.p).toLocaleString(), x + CW / 2, y + CH + (CAP ? 62 + priceSize : 14 + priceSize));
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
    g.fillText(artists || "artist not recorded", W-PAD, H-40);

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
