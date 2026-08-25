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
.promptbar{margin-bottom:20px}
#ask{width:100%;background:var(--panel);border:1px solid var(--line);border-radius:14px;
  color:var(--text);padding:18px 20px;font:400 17px var(--body)}
#ask:focus{outline:none;border-color:var(--live)}
.suggest{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}
.sg{background:var(--panel);border:1px solid var(--live);color:var(--live);border-radius:8px;
  padding:7px 13px;font:500 13.5px var(--body);cursor:pointer}
.egs{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.eg{background:transparent;border:1px solid var(--line);color:var(--soft);border-radius:20px;
  padding:8px 15px;font:400 13.5px var(--body);cursor:pointer}
.eg:hover{border-color:var(--live);color:var(--live)}
.askreply{color:var(--live);font:400 14px var(--body);margin-top:12px;min-height:20px}
.askreply.bad{color:var(--warn)}
.advanced{margin-bottom:20px}
.advanced summary{color:var(--faint);font:400 14px var(--body);cursor:pointer;padding:8px 0;list-style:none}
.advanced summary::-webkit-details-marker{display:none}
.advanced summary:before{content:"▸ ";color:var(--faint)}
.advanced[open] summary:before{content:"▾ "}
.advanced summary:hover{color:var(--live)}
.ratingrow{background:var(--panel);border:1px solid var(--line);border-radius:13px;
  padding:16px 18px;margin-bottom:14px}
.ratingrow .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
.ratingwhy{font:400 12.5px var(--body);color:var(--faint);margin-top:10px;line-height:1.55}
.moodrow{background:linear-gradient(180deg,rgba(54,211,153,.05),transparent),var(--panel);
  border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-bottom:22px}
.moodlabel{display:block;font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:11px}
.moodrow .chip{font-size:14.5px}
.moodrow .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
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
.moodcard{padding:12px 0;border-top:1px solid var(--line)}
.moodcard:first-of-type{border-top:0;padding-top:6px}
.mc-name{display:block;font:600 16px var(--body);color:var(--text)}
.mc-meta{display:block;font:400 11.5px var(--mono);color:var(--faint);margin-top:2px;letter-spacing:.02em}
.mc-why{display:block;font:300 15px var(--body);color:var(--soft);margin-top:7px;line-height:1.5}
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
.reachrow{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.reachrow label{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.14em}
#followers{width:110px;background:var(--ink);border:1px solid var(--line);border-radius:9px;color:var(--text);padding:9px 11px;font:400 14px var(--mono)}
.reachnote{font:400 12.5px var(--body);color:var(--faint)}
.lines{margin-bottom:14px}
.selfreply{background:var(--panel);border:1px solid var(--line);border-radius:12px;
  padding:14px 16px;margin-bottom:14px}
.selfreply .srhead{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:9px}
.selfreply pre{margin:0 0 11px;font:400 13.5px var(--mono);color:var(--soft);
  white-space:pre-wrap;line-height:1.65}
.selfreply button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:8px;padding:8px 14px;font:400 13px var(--body);cursor:pointer}
.selfreply button:hover{border-color:var(--live);color:var(--live)}
.lines .lhead{font:500 10.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-bottom:9px}
.lineopt{display:block;width:100%;text-align:left;background:var(--panel);border:1px solid var(--line);
  border-radius:11px;padding:12px 15px;margin-bottom:7px;cursor:pointer;transition:border-color .16s var(--ease)}
.lineopt:hover{border-color:var(--live)}
.lineopt .tag2{display:inline-block;font:500 9px var(--mono);color:var(--faint);letter-spacing:.14em;
  border:1px solid var(--line);border-radius:5px;padding:2px 6px;margin-right:9px;vertical-align:1px}
.lineopt .txt{font:300 16px var(--body);color:var(--text)}
.acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
button.pri{background:var(--live);color:var(--ink);border:0;border-radius:13px;padding:14px 26px;
  font:600 15px var(--body);cursor:pointer;transition:opacity .18s var(--ease)}
button.pri:hover{opacity:.9}
button.sec{background:transparent;color:var(--soft);border:1px solid var(--line);border-radius:13px;
  padding:14px 20px;font:400 14.5px var(--body);cursor:pointer;transition:all .18s var(--ease)}
button.sec:hover{border-color:var(--faint);color:var(--text)}
button:disabled{opacity:.32;cursor:not-allowed}
#outimg{max-width:100%;border-radius:13px;border:1px solid var(--line);display:block}
.savehint{font:400 13.5px var(--body);color:var(--live);margin:10px 0 0;text-align:center}
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
.imgstatus{background:rgba(217,164,65,.1);border:1px solid rgba(217,164,65,.3);
  border-radius:9px;padding:11px 14px;margin-bottom:12px;color:var(--warn);font:400 13px var(--body)}
.hit.failed img{display:none}
.hit.failed{background:rgba(217,164,65,.08);border:1px dashed rgba(217,164,65,.35)}
.hit .failmsg{display:none;font:500 9.5px var(--mono);color:var(--warn);padding:16px 4px;line-height:1.5}
.hit.failed .failmsg{display:block}
.monbar{margin-bottom:14px}
#monq{width:100%;background:var(--ink);border:1px solid var(--line);border-radius:11px;
  color:var(--text);padding:13px 15px;font:400 15px var(--body);margin-bottom:9px}
#monq:focus{outline:none;border-color:var(--live)}
#monchips{max-height:104px;overflow-y:auto;margin-bottom:9px}
#monchips .chip.on{border-color:var(--live);color:var(--live);background:rgba(54,211,153,.08)}
.streakstate{display:inline-block;font:500 10px var(--mono);letter-spacing:.14em;
  padding:4px 9px;border-radius:6px;margin-left:9px}
.streakstate.on{background:rgba(54,211,153,.15);color:var(--live)}
.streakstate.off{background:rgba(138,147,166,.12);color:var(--faint)}
.streakwrap summary{color:var(--soft);font:400 15px var(--body);cursor:pointer;
  padding:10px 0;list-style:none}
.streakwrap summary::-webkit-details-marker{display:none}
.streakwrap summary:before{content:"▸ ";color:var(--faint)}
.streakwrap[open] summary:before{content:"▾ "}
.streakwrap summary:hover{color:var(--live)}
.streakexplain{font:300 14px var(--body);color:var(--soft);margin:9px 0;line-height:1.55;max-width:62ch}
.streakactions button:disabled{opacity:.45;cursor:default}
.streakactions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}
.streakactions button{background:transparent;border:1px solid var(--line);color:var(--soft);
  border-radius:8px;padding:8px 13px;font:400 13px var(--body);cursor:pointer}
.streakactions button.go{background:var(--live);color:var(--ink);border:0;font-weight:600}
.sortrow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.sortlabel{font:500 9.5px var(--mono);color:var(--faint);letter-spacing:.16em;margin-right:4px}
.sortrow .chip.on{border-color:var(--live);color:var(--live)}
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

<div id="boot" style="background:#1a1410;border:1px solid #4a3a20;border-radius:10px;padding:14px 16px;margin-bottom:16px;color:#d9a441;font:400 13.5px system-ui,sans-serif;line-height:1.6">Starting…</div>
<div class="promptbar">
  <input id="ask" placeholder="What do you want to post?" autocomplete="off">
  <div class="suggest" id="suggest" hidden></div>
  <div class="egs" id="egs"></div>
  <div class="askreply" id="askreply"></div>
</div>
<details class="advanced"><summary>Browse, filter and fine-tune</summary>
<div class="ratingrow">
  <span class="moodlabel">NARROW BY RATING — every one derives from a printed field</span>
  <div class="chips" id="frating"></div>
</div>

<div class="moodrow">
  <span class="moodlabel">HOW ARE YOU FEELING?</span>
  <div class="chips" id="fmood"></div>
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
<div class="reachrow"><label for="views">Typical views per post</label><input id="views" type="number" inputmode="numeric" placeholder="e.g. 900"><span class="reachnote" id="reachnote"></span></div>
<div class="monbar">
  <input id="monq" placeholder="Filter by Pokémon — type a name" autocomplete="off">
  <div class="chips" id="monchips"></div>
  <div class="sortrow">
    <span class="sortlabel">SORT</span>
    <button class="chip on" data-sort="mon">By Pokémon</button>
    <button class="chip" data-sort="price">Most valuable</button>
    <button class="chip" data-sort="new">Newest</button>
    <button class="chip" data-sort="old">Oldest</button>
  </div>
</div>
</details>
<div class="imgstatus" id="imgstatus" hidden></div>
<div class="results" id="res"></div>
<div class="pager" id="pager"></div>
</details>

<!-- The old streak block lived here: a paragraph, two dropdowns and a Begin
     button, rendering above the collapsed one that replaced it. I built the
     replacement and never removed what it replaced, so the page shouted about
     streaks to everyone regardless. -->
<div class="streak" id="streakbar"></div>
<div class="page-label" id="plabel">YOUR PAGE</div>
<div class="binder" id="tray"></div>
<div class="status" id="st"></div>
<div class="tally" id="tally" hidden></div>
<div class="lines" id="lines" hidden></div>
<div class="selfreply" id="selfreply" hidden></div>
<input id="label" placeholder="Your line — or leave it blank and let the cards talk" style="margin-bottom:18px">

<p class="savehint" id="savehint"></p>
<div class="acts">
<button class="go" id="make">Make the image</button>
<button id="copy" onclick="copyImage()">Copy image</button>
<button id="share" onclick="shareImage()">Share</button>
<button id="dl" onclick="dlImage()">Download</button>
<button onclick="openImage()">Open in a tab</button>
</div>
<img id="outimg" alt="your image — press and hold to save" hidden>
<canvas id="cv"></canvas>

<div class="foot">Every image carries the Catch'em mark and the artist's name — the credit isn't ours to remove.
Cards marked in amber have no artist recorded in the public dataset. That's a backfill gap on recent sets,
not a Pokémon decision, and you can still use them.</div>
</div>
<script>
const THEMES = ${JSON.stringify(themes?.themes ?? [])};
const SETS = ${JSON.stringify(sets)};
${await (async () => { const { readFile: rf } = await import('node:fs/promises'); const t = JSON.parse(await rf(join(ROOT,'data/card-text.json'),'utf-8')).cards; const slim = {}; for (const [k,v] of Object.entries(t)) if (v.a && v.a.length) slim[k] = { a: v.a.slice(0,1) }; const eng = await rf(join(ROOT,'scripts/line-engine.js'),'utf-8'); return eng.replace('__CARD_TEXT__', JSON.stringify(slim)); })()}
// ONE TABLE, POST-WORTHY ONLY. Five tables keyed by the same ids repeated the
// ids ~200KB each, and a Common nobody would ever post is dead weight on a
// phone. 4.6MB became 1.6MB, which is the difference between the script running
// and the script dying — and when it dies the moods, angles and images all
// vanish together, because JS renders all three.
const MOODS = ${JSON.stringify(Object.values((await J('data/moods.json'))?.moods ?? {}).map(m => ({ id: m.id, label: m.label, emoji: m.emoji, say: m.say, cards: (m.cards ?? []).slice(0, 18).map(c => ({ id: c.id, matched: c.matched, why: c.why })) })))};
// ROWS AS ARRAYS. Each object row repeated its key names 6,658 times; positional
// arrays plus a rehydrate loop drop a quarter of the payload and, more
// importantly, parse faster — mobile is failing on the work of parsing a huge
// literal, not on memory.
const CARD_ROWS = ${await (async () => {
  const attrs = (await J('data/card-attrs.json'))?.cards ?? {};
  const bios = (await J('data/card-bios.json'))?.bios ?? {};
  const lore = (await J('data/lore.json'))?.lore ?? {};
  const ctext = (await J('data/card-text.json'))?.cards ?? {};
  const HERO_R = /Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Rare Shiny|Special Illustration/i;
    // COMPLETE THE LINES. Sixty-eight Pokémon were needed to finish an evolution
  // line and were excluded — Metapod, Kakuna, Roselia, the stages nobody
  // chases. The post-worthy filter was right in general and wrong here: a cocoon
  // is not post-worthy alone and is essential to the line that is. Five KB.
  const FORM_P = new RegExp("^(Galarian|Alolan|Hisuian|Paldean|Dark|Mega|Shadow|Crystal|Light|Shining|Radiant)\\s+", "i");
  const MECH_P = new RegExp("\\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X)$");
  const monP = (n) => { let x = String(n); for (let i = 0; i < 2; i++) x = x.replace(FORM_P, ""); return x.replace(MECH_P, "").trim().split(" ")[0]; };
  const base = index.filter(c => HERO_R.test(c.r ?? '') || (c.p ?? 0) >= 8);
  const have = new Set(base.map(c => monP(c.n)));
  const evoOf = {};
  for (const c of index) if (attrs[c.i]?.ev) evoOf[monP(c.n)] = monP(attrs[c.i].ev);
  const need = new Set();
  for (const [child, parent] of Object.entries(evoOf)) {
    if (have.has(child) && !have.has(parent)) need.add(parent);
    if (have.has(parent) && !have.has(child)) need.add(child);
  }
  const extra = [];
  for (const m of need) {
    const best = index.filter(c => monP(c.n) === m && c.a).sort((x, y) => (y.p ?? 0) - (x.p ?? 0))[0];
    if (best) extra.push(best);
  }
  const rows = base.concat(extra).map(c => {
    const A = attrs[c.i] ?? {}, B = bios[c.i] ?? {}, T = ctext[c.i] ?? {};
    const st = (A.st ?? []).filter(x => /^(Basic|Stage 1|Stage 2|Baby|ex|EX|V|VMAX|VSTAR|GX|MEGA)$/.test(x));
    return [c.i, c.n, c.s, c.y, c.a ?? 0, c.r ?? 0, c.p ?? 0,
      A.t ?? 0, A.dex ?? 0, A.ev ?? 0, A.hp ?? 0, st.length ? st : 0,
      Object.keys(B.ratings ?? {}).length ? B.ratings : 0,
      lore[c.i] ?? 0, T.a?.length ? T.a.slice(0, 2) : 0,
      // WEAKNESS. Captured weeks ago and never shipped, so every matchup lookup
      // read undefined. It is one short string per card.
      A.w ?? 0];
  });
  return JSON.stringify(rows);
})()};
// Rehydrate once. Positional decode is trivial and keeps every reader unchanged.
const CARD_INDEX = CARD_ROWS.map(function(r){
  var o = { i: r[0], n: r[1], s: r[2], y: r[3] };
  if (r[4]) o.a = r[4];
  if (r[5]) o.r = r[5];
  if (r[6]) o.p = r[6];
  if (r[7]) o.T = r[7];
  if (r[8]) o.D = r[8];
  if (r[9]) o.E = r[9];
  if (r[10]) o.H = r[10];
  if (r[11]) o.S = r[11];
  if (r[12]) o.R = r[12];
  if (r[13]) o.L = r[13];
  if (r[14]) o.A = r[14];
  if (r[15]) o.W = r[15];
  return o;
});
// Sourced facts, so the 'story' shape has something true to build on. Only
// VERIFIED ones ship — an unsourced claim on a card image is the one mistake
// this whole project exists to avoid.
const FACTS = ${JSON.stringify((await (async () => { try { return (JSON.parse(await readFile(join(ROOT, 'data/knowledge.json'), 'utf-8')).facts ?? []).filter(f => f.confidence === 'VERIFIED').map(f => ({ id: f.id, claim: f.claim })); } catch { return []; } })()))};
const LAYOUTS = ${JSON.stringify(LAYOUTS)};
const SUPPORTED = Object.keys(LAYOUTS).map(Number);
// BOOT REPORT. Three wrong guesses at why this dies on a phone, all made from
// a sandbox that cannot run mobile Safari. A blank screen tells nobody
// anything, so the page now reports its own failure on the page itself.
function bootSay(msg, bad){
  var el2 = document.getElementById("boot");
  if (!el2) return;
  el2.textContent = msg;
  if (bad) { el2.style.color = "#e0705a"; el2.style.borderColor = "#5a2a20"; }
}
window.onerror = function(m, src, line, col){
  bootSay("Script error: " + m + "  (line " + line + ")", true);
  return false;
};
bootSay("Script parsed. Loading catalogue…");

// THE POKEMON, NOT THE PREFIX. Splitting on the first space produced "Galarian"
// with 72 cards and "Dark" with 69 — those are form and owner prefixes, not
// creatures, and every grouping built on them was wrong. Strip the known
// prefixes and the trailing mechanic suffix to get the actual name.
const FORM_PREFIX = new RegExp("^(" + "Galarian|Alolan|Hisuian|Paldean|Dark|Light|Shining|Radiant|Team Aqua's|Team Magma's|Rocket's|Team Rocket's|Misty's|Brock's|Erika's|Sabrina's|Blaine's|Koga's|Giovanni's|Lillie's|N's|Marnie's|Ethan's|Cynthia's|Steven's|Iono's|Arven's|Hop's|Bea's|Crystal|Shadow|Mega" + ")" + String.fromCharCode(92) + "s+", "i");
const MECH_SUFFIX = new RegExp(String.fromCharCode(92) + "s+(" + "ex|EX|GX|V|VMAX|VSTAR|BREAK|LEGEND|Prime|Star|LV.X|-EX|-GX" + ")$");
function monName(full){
  let n = String(full || "");
  for (let i = 0; i < 2; i++) n = n.replace(FORM_PREFIX, "");
  // HYPHENATED MECHANICS TOO. "Charizard-GX" is the same creature as Charizard,
  // and MECH_SUFFIX only strips a SPACE-separated suffix — so autocomplete
  // offered the same Pokémon four times and wasted every slot.
  n = n.replace(new RegExp("-(EX|GX|ex|V|VMAX|VSTAR)$"), "");
  n = n.replace(MECH_SUFFIX, "").trim();
  return n.split(" ")[0] || String(full);
}
// intent.js — one box instead of six panels.
//
// Tyler, 2026-08-24: "Our UI is way too sloppy and confusing… maybe do prompts
// just like Claude does so it doesn't feel overwhelming. At the moment it does."
//
// He is right, and my own research said so before I built it: **"one clear
// primary action, never more than one CTA"** — and the editor opens with six
// panels competing. I read that finding, wrote it into house-theses, and then
// shipped the opposite.
//
// BUT A BARE TEXT BOX FAILS TOO, for a reason the research also names:
// **"capability ambiguity is the last failure point — users cannot see what the
// system understands, so without visible examples it starts with guesswork."**
// So: one box, example chips that fill it in a tap, and a recovery path that
// SUGGESTS rather than erroring, because redirecting unclear queries to
// structured suggestions "reduced abandonment significantly".
//
// AND IT IS NOT AN LLM. This is a static file with no key and no network. Every
// match here is against data already in the page — Pokémon names, artists, sets,
// types, ratings, moods — which means it can only find things that genuinely
// exist. That is a feature: it cannot hallucinate a card.
//
// WHEN IT DOES NOT UNDERSTAND, it says what it DID find and offers the nearest
// real thing. "I don't know that one" is the sentence that loses a user.

function parseIntent(text, ctx) {
  const q = String(text || "").toLowerCase().trim();
  if (!q) return null;
  const found = { count: null, mon: null, artist: null, set: null, type: null,
    rating: null, mood: null, shape: null, matched: [], missed: [] };

  // NO WORD BOUNDARIES AT ALL. Every \b in this parser emitted as a BACKSPACE
  // character, so every shape and rating match silently failed — thirteenth
  // escaping casualty, same root cause each time. These phrases are distinctive
  // enough that a substring match is correct, and it removes the one construct
  // that keeps breaking.
  // COUNT. People say "four cards" and "a pair" and "9" — all the same thing.
  const words = { one: 1, two: 2, three: 3, four: 4, six: 6, nine: 9, pair: 2, single: 1 };
  const num = q.match(/\b(\d+)\s*(cards?|of them)?\b/);
  if (num && [1, 2, 3, 4, 6, 8, 9].includes(Number(num[1]))) { found.count = Number(num[1]); found.matched.push(found.count + " cards"); }
  else for (const [w, n] of Object.entries(words)) if (q.indexOf(w) >= 0) { found.count = n; found.matched.push(n + " cards"); break; }

  // POKÉMON. Longest name first, so "mr. mime" beats "mime".
  // NOT CREATURE NAMES. "Dark", "Light", "Team" and "Mega" are form prefixes,
  // and "dark" in a sentence means the mood, not Dark Charizard. Fifth time the
  // prefix problem has surfaced.
  // A TYPE IS NOT A POKEMON. "psychic types" parsed mon=Psychic and type=Psychic,
  // then narrowed to cards literally NAMED Psychic — Sabrina's Psychic Control,
  // a Trainer. Type words and form prefixes can never be creature names.
  const NOT_MON = /^(dark|light|team|mega|shadow|crystal|shining|radiant|energy|great|iron|roaring|walking|raging|scream|brute|flutter|sandy|gouging|slither|fire|water|grass|lightning|psychic|fighting|darkness|metal|dragon|fairy|colorless|type|types)$/i;
  const mons = (ctx.monNames || []).filter(m => !NOT_MON.test(m)).slice().sort((a, b) => b.length - a.length);
  for (const m of mons) {
    if (m.length < 4) continue;
    // "Type: Null" reduces to "Type:", whose punctuation became a dot wildcard
    // and matched "types". Strip punctuation before the blocklist test.
    if (NOT_MON.test(m.replace(/[^A-Za-z]/g, ""))) continue;
    if (new RegExp(String.fromCharCode(92) + "b" + m.toLowerCase().replace(/[^a-z0-9']/g, ".") + String.fromCharCode(92) + "b").test(q)) { found.mon = m; found.matched.push(m); break; }
  }

  // ARTIST. Surname alone is how people actually refer to them.
  for (const a of (ctx.artists || [])) {
    const last = a.split(" ").pop().toLowerCase();
    if (last.length >= 5 && q.includes(last)) { found.artist = a; found.matched.push(a); break; }
  }

  // SET.
  for (const s of (ctx.sets || []).slice().sort((a, b) => b.length - a.length)) {
    // "151" is a set name and three characters long. The old five-character
    // floor excluded it entirely, so "from 151" matched nothing. Short names
    // must match as whole words; long ones can match loosely.
    const sl = s.toLowerCase();
    const hit = sl.length >= 5 ? q.indexOf(sl) >= 0
      : (" " + q + " ").indexOf(" " + sl + " ") >= 0;
    if (hit) { found.set = s; found.matched.push(s); break; }
  }

  // TYPE — the printed card type, which differs from the game type.
  for (const t of ["fire", "water", "grass", "lightning", "psychic", "fighting", "darkness", "metal", "dragon", "fairy", "colorless"])
    if (new RegExp(String.fromCharCode(92) + "b" + t + String.fromCharCode(92) + "b").test(q)) { found.type = t[0].toUpperCase() + t.slice(1); found.matched.push(found.type + " type"); break; }

  // RATINGS, in the words people use rather than our field names.
  const RATING = [
    [/(cute|adorable|sweet|wholesome)/, "cute", "cute"],
    [/(funny|silly|joke|stupid|ridiculous)/, "comedy", "funny"],
    [/(dark|grim|creepy|scary|unsettling|sinister)/, "serious", "dark"],
    [/(cheap|budget|under a|affordable|low.cost)/, "cheap", "cheap"],
    [/(expensive|dear|grail|pricey|chase)/, "dear", "expensive"],
    [/(rare|scarce|hard to find)/, "scarce", "scarce"],
    [/(beautiful|gorgeous|artwork|stunning|pretty)/, "artprem", "art people pay for"],
  ];
  for (const [rx, id, label] of RATING) if (rx.test(q)) { found.rating = id; found.matched.push(label); break; }

  // MOOD.
  for (const m of (ctx.moods || []))
    if (q.includes(m.label.toLowerCase()) || (m.id === "tired" && /\b(tired|wiped|exhausted|late night|sleepy)\b/.test(q))
      || (m.id === "bright" && /\b(good morning|morning|sunrise|gm)\b/.test(q))) { found.mood = m.id; found.matched.push(m.label); break; }

  // SHAPE — the phrasing that names a format.
  const SHAPE = [
    [/(nobody talks about|obscure|underrated|forgotten|no one mentions|unknown)/, "obscure", "cards nobody talks about"],
    [/(evolution|whole line|evolves|line)/, "evo-line", "the evolution line"],
    [/(years apart|over time|through the years|across eras|decades)/, "eras", "across the years"],
    [/(same artist|one artist|by the same)/, "artist-span", "one artist, years apart"],
    [/(power creep|hp over time|stronger)/, "power-creep", "power creep"],
    [/(story|lore|says about itself|flavou?r text)/, "lore-self", "what the card says"],
    [/(versus|battle|which is better)/, "battle", "a battle"],
  ];
  for (const [rx, id, label] of SHAPE) if (rx.test(q)) { found.shape = id; found.matched.push(label); break; }

  found.understood = found.matched.length > 0;
  return found;
}

// WHAT IT DID NOT UNDERSTAND, said usefully. The research is explicit that
// redirecting an unclear query to structured suggestions rather than a generic
// failure "reduced abandonment significantly" — so this never says "I don't
// know that one", which is the sentence that loses a user.
function intentReply(found, ctx) {
  if (!found || !found.understood) {
    return { ok: false,
      say: "I didn't catch anything I hold data on. Try naming a Pokémon, an artist, a set, or a feeling — or tap one of the examples.",
      suggest: ctx.examples.slice(0, 4) };
  }
  const bits = found.matched.join(" · ");
  return { ok: true, say: "Showing " + bits + ".", found };
}


// VIEWS, NOT FOLLOWERS. Followers are an accumulated number and views are a live
// signal — bought, bot, dormant and lapsed followers count toward the first and
// none toward the second. Crambo has 17.6k followers and took 37.1k views on one
// post; a 50k account with dormant followers might see 3k. The tiers answer one
// question — is there a crowd big enough to answer a question — and that is a
// views question.
const REACH_TIERS = [
  { id: "quiet", upTo: 800, label: "under 800 views a post",
    prefer: ["observation", "confession"],
    avoid: ["question", "permission", "divide"],
    why: "A question with three replies looks worse than a post with none, because an unanswered request is visibly unanswered. Lead with something that stands alone and let the reply be optional",
    hypothesis: true },
  { id: "building", upTo: 4000, label: "800 to 4k views a post",
    prefer: ["observation", "confession", "invite"],
    avoid: ["divide"],
    why: "Enough eyes that a low-effort ask lands. INVITE beats ASK here: 'add the one I missed' costs a reader nothing, where 'which is best' asks them to defend a choice",
    hypothesis: true },
  { id: "crowd", upTo: 20000, label: "4k to 20k views a post",
    prefer: ["question", "permission", "invite", "observation"],
    avoid: [],
    why: "The band where the permission mechanic is documented working — tall_alan took roughly 900 replies from an account this size. There is a crowd and a question finds it",
    hypothesis: true },
  { id: "loud", upTo: Infinity, label: "20k+ views a post",
    prefer: ["divide", "permission", "question"],
    avoid: [],
    why: "A divisive question is safe when there are enough answers to make a thread rather than a silence",
    hypothesis: true },
];

// FOLLOWERS ONLY AS A LAST RESORT, and openly derated. A rough rule of thumb is
// that a healthy account sees views in the region of its follower count; a
// neglected one sees a fraction. Using it means guessing at the very thing the
// tier is trying to measure.
function tierFor(typicalViews, followersFallback){
  let n = Number(typicalViews) || 0;
  if (!n && followersFallback) n = Number(followersFallback) * 0.5;
  if (!n) return null;
  return REACH_TIERS.find(t => n <= t.upTo) || REACH_TIERS[REACH_TIERS.length - 1];
}

// THE BEST INPUT IS THE ONE WE ALREADY HOLD. Once read-metrics fills the
// outcome log, nobody needs to type anything — the median of the last several
// settled posts IS the answer, and it is measured rather than remembered.
function typicalViewsFrom(posts){
  const settled = (posts || []).filter(p => p.measured && p.measured.views);
  if (settled.length < 3) return null;
  const v = settled.slice(-8).map(p => p.measured.views).sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
}
// THE TCG DOES NOT PRINT THE BABY LINK. A Pikachu card is a Basic and never
// says "evolves from Pichu" — the game rule and the card rule differ, exactly
// like the type field. Babies are a small closed list and a documented
// relationship, so filling it in completes a real fact rather than inventing
// one. All eighteen have both sides in our catalogue.
const BABY_OF = { "Pikachu": "Pichu", "Clefairy": "Cleffa", "Jigglypuff": "Igglybuff",
  "Togetic": "Togepi", "Jynx": "Smoochum", "Electabuzz": "Elekid", "Magmar": "Magby",
  "Marill": "Azurill", "Wobbuffet": "Wynaut", "Roselia": "Budew", "Chimecho": "Chingling",
  "Sudowoodo": "Bonsly", "Chansey": "Happiny", "Snorlax": "Munchlax", "Lucario": "Riolu",
  "Mantine": "Mantyke", "Mr. Mime": "Mime Jr.", "Hitmonlee": "Tyrogue" };
// resolve.js — the prompt picks the cards. Nothing else gets to override it.
//
// Tyler, 2026-08-24: "It's still showing the wrong cards. How do we keep coming
// into this problem?"
//
// THE ANSWER TO THAT QUESTION IS UNCOMFORTABLE AND WORTH WRITING DOWN. I put
// this in ask-smoke's own blind-spot file and never closed it:
//
//   "Whether the cards it returns are the RIGHT ones. It proves every prompt
//    fills the tray; it has no view on whether 'something dark' returned
//    anything actually dark."
//
// So the test went green on every build while the output was wrong. **I
// documented the exact gap and then trusted the test that declared it.**
//
// THE BUG ITSELF: a parsed prompt set filters AND selected a theme, then handed
// off to the theme builder — which picks from its own pool and never consults
// those filters. "charizard through the years" parsed Charizard correctly and
// returned Alakazam. "fire types" returned Gyarados, which is Water.
//
// THE FIX: the prompt resolves its own cards. Every constraint is applied as a
// filter, in order, and each one can only ever REMOVE cards. A theme may
// suggest an ordering; it may never widen the pool past what was asked for.

function resolvePrompt(found, INDEX, helpers) {
  const { monName, attrs, ratingOf, HERO_RX } = helpers;
  const why = [];

  // START WIDE, NARROW ONLY. Every clause below removes cards and none adds
  // any. That property is what makes the result explainable — and it is exactly
  // what the theme handoff broke.
  let pool = INDEX.slice();
  const narrow = (fn, label) => {
    const next = pool.filter(fn);
    // NEVER NARROW TO NOTHING SILENTLY. Dropping a constraint is sometimes
    // right, but doing it without saying so is how you get confident wrong
    // output — which is the whole complaint.
    if (!next.length) { why.push(label + " (skipped — nothing matched)"); return; }
    pool = next; why.push(label);
  };

  // THE POKEMON IS THE HARDEST CONSTRAINT. If somebody names one, every card
  // returned must be it. This is the clause the theme handoff ignored.
  // AN EVO LINE IS THE CHAIN, NOT THREE PRINTINGS OF ONE CARD. Pinning to the
  // named Pokémon and taking three of them returned Charmander, Charmander,
  // Charmander.
  if (found.mon && found.shape === "evo-line") {
    const line = (helpers.evoLineFor && helpers.evoLineFor(found.mon)) || [found.mon];
    narrow(c => line.indexOf(monName(c.n)) >= 0, line.join(" → "));
  } else if (found.mon) narrow(c => monName(c.n) === found.mon, found.mon);

  // POKEMON ONLY, unless a Trainer was explicitly asked for. "Cards nobody
  // talks about" returned Erika's Invitation and Giovanni's Charisma — both
  // Trainers, neither a card anybody means by that phrase.
  if (!found.trainerOk) narrow(c => { const a = attrs[c.i]; return a && a.dex; }, "Pokémon only");

  if (found.artist) narrow(c => c.a === found.artist, found.artist);
  if (found.set) narrow(c => c.s === found.set, found.set);

  // THE PRINTED TYPE, from the type field — not from the name, and not from
  // what the video game says. "Fire types" returned Gyarados because the type
  // was parsed and then never applied.
  if (found.type) narrow(c => { const a = attrs[c.i]; return a && (a.t || []).indexOf(found.type) >= 0; }, found.type + " type");

  // RANK BY THE RATING, DO NOT FILTER ON IT. A threshold of 6 matched almost
  // nothing — most cards carry no score on a given axis — so the clause was
  // skipped and "cute" and "dark" returned identical cards. Ranking always
  // orders, even when few clear a bar.
  let rankBy = null;
  if (found.rating) {
    const scored = pool.filter(c => (ratingOf(c.i, found.rating) || 0) > 0);
    if (scored.length >= 4) { pool = scored; rankBy = found.rating; why.push(found.rating); }
    else why.push(found.rating + " (few cards scored)");
  }

  // OBSCURE IS A REAL QUERY, not a vibe: a Pokémon with few printings, an
  // illustrated card, and not one of the names everybody already says.
  if (found.shape === "obscure") {
    const counts = {};
    for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
    const FAMOUS = /Charizard|Pikachu|Eevee|Umbreon|Mewtwo|Rayquaza|Lugia|Gengar|Blastoise|Venusaur|Sylveon|Espeon|Snorlax/i;
    narrow(c => counts[monName(c.n)] <= 8 && !FAMOUS.test(c.n) && HERO_RX.test(c.r || ""), "rarely printed");
  }

  // Everything shown must be worth showing, and must credit its artist.
  narrow(c => c.a, "credited");
  const withHero = pool.filter(c => HERO_RX.test(c.r || ""));
  if (withHero.length >= (found.count || 2)) { pool = withHero; why.push("hero rarities"); }

  const n = found.count || (found.shape === "evo-line" ? 3 : 2);

  // ONE CARD PER POKEMON, unless the shape is about one Pokémon over time.
  // Nine Charizards is a composition; nine different Pokémon is a set.
  const acrossTime = found.shape === "eras" || found.shape === "power-creep" || found.mon;
  let picked;
  if (acrossTime && found.mon) {
    // Oldest to newest, spread across the years rather than clustered.
    const byYear = pool.slice().sort((a, b) => String(a.y).localeCompare(String(b.y)));
    if (byYear.length <= n) picked = byYear;
    else {
      picked = [];
      const step = (byYear.length - 1) / (n - 1);
      for (let i = 0; i < n; i++) picked.push(byYear[Math.round(i * step)]);
    }
    why.push("spread across the years");
  } else {
    const best = {};
    for (const c of pool) { const k = monName(c.n);
      if (!best[k] || (c.p || 0) > (best[k].p || 0)) best[k] = c; }
    picked = Object.values(best).sort(function(a, b){
      if (rankBy) { const d = (ratingOf(b.i, rankBy) || 0) - (ratingOf(a.i, rankBy) || 0); if (d) return d; }
      return (b.p || 0) - (a.p || 0);
    }).slice(0, n);
  }

  return { cards: picked, why, poolSize: pool.length };
}


const byIdRow = {};
const ATTRS = new Proxy({}, { get: (_, k) => { const r = byIdRow[k]; return r ? { t: r.T, dex: r.D, d: r.D, e: r.E, ev: r.E, h: r.H, hp: r.H, s: r.S, st: r.S, w: r.W } : undefined; } });
const BIOS = new Proxy({}, { get: (_, k) => byIdRow[k]?.R });
const LORE = new Proxy({}, { get: (_, k) => byIdRow[k]?.L });
let INDEX = [], tray = [], blob = null;

// CONSTRUCTED URLS 404 TO A CARD BACK. Newer sets serve from a different host
// entirely, and a 404 here returns a valid 200 PNG of the wrong side of a card.
// card-composite was fixed for this yesterday; the editor still had the old
// code. The index carries no URL, so: try one host, fall back to the other on
// error, and show a visible failure rather than a plausible wrong image.
// SMALL FOR BROWSING, LARGE FOR THE COMPOSITE. We requested _hires.png for
// every thumbnail — 1-2MB each, and thirty-six of them is ~54MB of transfer to
// draw images 96 pixels wide. On a phone that never finishes, which is a grid of
// blank squares.
const imgSmall = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + ".png";
const imgUrl = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const imgAlt = (id) => "https://images.scrydex.com/pokemon/" + id + "/large";
function imgTag(c, cls){
  const alt = imgAlt(c.i).replace(/'/g, "");
  return "<img src='" + imgUrl(c.i) + "' alt='" + String(c.n).replace(/'/g, "") +
    "' onerror='this.onerror=null;this.src=&quot;" + alt + "&quot;'>";
}

// EMBEDDED, NOT FETCHED. fetch() of a sibling file from a file:// page is
// blocked by Chrome as cross-origin, so INDEX stayed empty — and every symptom
// followed from that one cause: no images, no themes, no search. A fetch also
// means two files that must travel together, and a single file cannot arrive
// half-configured.
INDEX = CARD_INDEX;
  for (const r of INDEX) byIdRow[r.i] = r;
// Deferred one tick. The fetch used to provide this gap by accident, so
// removing it exposed an ordering bug that had always been there — el() and
// the render functions are declared further down the file.
setTimeout(() => {
    // Show the default as chosen, so the state on screen matches the state in
    // memory — an invisible default is the same trap one level down.
    const cc = el("fcount");
    if (cc) cc.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", Number(x.dataset.n) === fCount));
    renderThemes(); search();
    try {
      var nCards = (document.getElementById("res") || {}).innerHTML || "";
      var nThemes = (document.getElementById("ftheme") || {}).innerHTML || "";
      var imgs = (nCards.match(/<img/g) || []).length;
      var chips = (nThemes.match(/data-t=/g) || []).length;
      bootSay("Loaded " + INDEX.length + " cards · " + imgs + " thumbnails on screen · " + chips + " angles. If the pictures are blank, the card art host is unreachable from this browser.");
      if (!imgs || !chips) bootSay("Loaded " + INDEX.length + " cards but rendered " + imgs + " thumbnails and " + chips + " angles — the data arrived and the drawing failed.", true);
    } catch (e) { bootSay("Render failed: " + e.message, true); }
  }, 0);

const el = id => document.getElementById(id);

// NO TOP-LEVEL LINE MAY HALT THE FILE. One throw during initial execution
// stops everything below it: every let never initializes, the boot timer then
// hits a dead binding, and the page is blank with "script error" — which is
// exactly what a phone showed while every dev machine showed green.
function safeWire(fn, what){
  try { fn(); }
  catch (e) {
    try { const b = el("bootpanel") || el("status"); if (b) { b.hidden = false; b.textContent = "setup skipped (" + (what || "block") + "): " + e.message; } } catch (x) {}
  }
}
// STORAGE THAT CANNOT THROW. iOS private browsing throws on setItem — the
// classic works-on-every-dev-machine killer. Losing a preference is fine;
// dying over one is not.
const store = {
  get(k){ try { return store.get(k); } catch (e) { return null; } },
  set(k, v){ try { store.set(k, v); } catch (e) {} },
  del(k){ try { store.del(k); } catch (e) {} },
};
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
// BUILT WITH DOM CALLS, NOT A STRING. Three attempts at quoting this one line
// failed, each in a different way. A string with quotes inside quotes inside a
// template is a losing game; createElement has nothing to escape.
function suggestHtml(q){
  const guess = didYouMean(q);
  const d = document.createElement("div");
  d.className = "empty";
  if (!guess) { d.textContent = "nothing matched"; return d.outerHTML; }
  d.appendChild(document.createTextNode("Nothing for " + q + ". Did you mean "));
  const b = document.createElement("b");
  b.textContent = guess;
  b.style.color = "var(--live)";
  b.style.cursor = "pointer";
  b.setAttribute("onclick", "tryName(" + JSON.stringify(guess) + ")");
  d.appendChild(b);
  d.appendChild(document.createTextNode("?"));
  return d.outerHTML;
}
function tryName(n){ el("q").value = n; resetPage(); search(); }
window.tryName = tryName;
function goPage(n){ page = Math.max(0, n); search(); el("res").scrollTop = 0; }

// Any change to the filters resets to page one — staying on page 400 of a new
// search is a way of showing somebody nothing and calling it a result.
function resetPage(){ page = 0; }

// FORGIVING SEARCH. Pokemon names are hard to spell — Chandelure, Aegislash,
// Volcarona, Gholdengo — and an exact match punishes a typo with an empty
// screen, which reads as a broken tool rather than a misspelling. This runs
// ONLY when the exact match finds nothing, so it costs nothing normally.
let NAMES = null;
function editDistance(a, b){
  if (Math.abs(a.length - b.length) > 3) return 99;
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function didYouMean(q){
  if (q.length < 3) return null;
  NAMES = NAMES ?? [...new Set(INDEX.map(c => monName(c.n)))];
  let best = null, bestD = 99;
  for (const nm of NAMES) {
    const d = editDistance(q, nm.toLowerCase());
    if (d < bestD) { bestD = d; best = nm; }
  }
  // Allow more slack on longer words: one slip in "chandalure" is the same
  // mistake as one slip in "mew", and only one of them is ambiguous.
  return bestD <= Math.max(1, Math.floor(q.length / 4)) ? best : null;
}

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
    const ranked = sortCards(INDEX.filter(c => monPass(c) && ratingPass(c) && streakPass(c)));
    const pages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
    if (page >= pages) page = 0;
    const showcase = ranked.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    renderPager(ranked.length, pages);
    el("res").innerHTML = showcase.map(c =>
      \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgSmall(c.i)}" alt="" loading=\"lazy\" onerror=\"imgFallback(this,&#39;\${c.i}&#39;)\">
        <span class=\"failmsg\"></span><b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i>\${c.a}</i></div>\`).join("");
    return;
  }
  // PAGING. The whole index stays in memory — 1.7MB is nothing — and only the
  // current PAGE renders. Holding data is cheap; painting sixteen thousand
  // images is not, and that distinction is the entire performance story.
  // The picker and the sort apply in BOTH paths. A filter that works only
  // after you have typed something is worse than no filter.
  const all = sortCards(INDEX.filter(c => monPass(c) && streakPass(c) &&
    (!q || (c.n + " " + (c.a || "") + " " + c.s).toLowerCase().includes(q)) &&
    (!rar || c.r === rar) && (!yr || c.y === yr)));
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  if (page >= pages) page = 0;
  const hits = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  renderPager(all.length, pages);
  el("res").innerHTML = hits.length ? hits.map(c =>
    \`<div class="hit" onclick="add('\${c.i}')"><img src="\${imgSmall(c.i)}" alt="" loading=\"lazy\" onerror=\"imgFallback(this,&#39;\${c.i}&#39;)\">
      <span class=\"failmsg\"></span><b>\${c.n}</b><i>\${c.s} · \${c.y}</i><i class="\${c.a ? "" : "nocred"}">\${c.a || "no credit recorded"}</i></div>\`).join("")
    : suggestHtml(q);
}
safeWire(function(){ ["q","rar","yr"].forEach(id => el(id).addEventListener("input", () => { resetPage(); search(); })); }, "wiring");

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
try { owned = JSON.parse(store.get("catchem-owned") || "{}"); } catch {}
function toggleOwn(id){
  owned[id] = !owned[id];
  try { store.set("catchem-owned", JSON.stringify(owned)); } catch {}
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
safeWire(function(){ el("fintent").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fIntent = b.dataset.i;
  el("fintent").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.i === fIntent));
  render();
}); }, "fintent");

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
try { streak = JSON.parse(store.get("catchem-streak") || "null"); } catch {}

function saveStreak(){ try { store.set("catchem-streak", JSON.stringify(streak)); } catch {} }

const STREAK_FILTERS = {
  "ir-any":    { series: "posting one Illustration Rare a day", label: "Illustration Rares", test: c => /Illustration Rare/i.test(c.r || "") },
  "ir-cheap":  { series: "posting one Illustration Rare under $3", label: "IRs under $10",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 10 },
  "ir-mid":    { series: "posting one mid-priced Illustration Rare a day", label: "IRs under $25",      test: c => /Illustration Rare/i.test(c.r || "") && c.p != null && c.p < 25 },
  "sir-only":  { series: "posting one Special Illustration Rare a day", label: "Special Illustration Rares", test: c => /Special Illustration Rare/i.test(c.r || "") },
  "ir-modern": { series: "posting one modern Illustration Rare a day", label: "IRs from 2024 on",   test: c => /Illustration Rare/i.test(c.r || "") && c.y >= "2024" },
  // PRICE BANDS. Restricted to Illustration Rares these pools are 18 and 32
  // cards — nine and sixteen days, which is not a streak, it is a fortnight.
  // Open to every hero rarity they run 141 and 119 days, and nothing is lost:
  // a Rare Holo at $2.50 is exactly as postable as an IR at $2.50, and the
  // PRICE BAND is the theme. Restricting rarity too was my assumption, not the ask.
  "two-dollar":  { series: "posting one card I love that costs under $3", label: "The $2–3 shelf", test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 2 && c.p <= 3 },
  "five-dollar": { series: "posting one card I love that costs under $6", label: "The $5 pickup",  test: c => HERO_RX.test(c.r || "") && c.p != null && c.p >= 4.50 && c.p <= 5.95 },
  // THE SCOUT'S ANGLES — found by searching the data rather than my memory,
  // which was thinking in categories while the data thinks in structure.
  // Chronological is the strongest: a streak with a DIRECTION beats one with a
  // filter, because "Day 40, we've reached Neo Destiny" is a story and "Day 40,
  // another card" is a counter.
  "chronological": { series: "walking the whole history of this game, one set a day", label: "The whole history, in order", ordered: "date",
    test: c => HERO_RX.test(c.r || "") && c.a && c.y },
  "one-artist":    { series: "posting one card by a single artist", label: "One artist at a time", ordered: "artist",
    test: c => HERO_RX.test(c.r || "") && c.a },
  "cheapest-up":   { series: "posting the cheapest card I have not shown yet", label: "Cheapest first, working up", ordered: "price",
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
  // REFUSE AN UNKNOWN FILTER rather than storing it and crashing later. Writing
  // a bad name to localStorage turns one bad click into a permanently broken
  // page.
  if (!STREAK_FILTERS[filterId]) { setStatus("Unknown streak filter: " + filterId, true); return; }
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
  if (!box) return;
  box.hidden = false;
  box.innerHTML = "";

  // COLLAPSED UNLESS IT MATTERS. A wall of explanation shown to everybody,
  // including the majority not starting a streak today, is the same mistake the
  // prompt bar fixed. But an ACTIVE streak with a day due is exactly what
  // somebody needs to see, and hiding that is how they miss a day.
  const st = streak ? streakState() : { day: 0, status: "not started" };
  const wrap = document.createElement("details");
  wrap.className = "streakwrap";
  if (streak && st.status !== "done today") wrap.open = true;

  const sum = document.createElement("summary");
  sum.textContent = !streak ? "Start a daily series"
    : st.status === "done today" ? "Day " + st.day + " — done today"
    : st.status === "due" ? "Day " + (st.day + 1) + " is due"
    : st.status === "broken" ? "Day " + st.day + " — gap of " + st.missed + " day" + (st.missed > 1 ? "s" : "")
    : "Daily series";
  wrap.appendChild(sum);

  if (!streak) {
    const p = document.createElement("div");
    p.className = "streakexplain";
    p.textContent = "Pick a rule — one Illustration Rare a day, one card under $3, the whole history in order. The rule is what makes it a series rather than a man posting cards, and the day number is what brings people back. We never repeat a card you have used.";
    wrap.appendChild(p);
    const row = document.createElement("div");
    row.className = "streakactions";
    for (const k of Object.keys(STREAK_FILTERS)) {
      const f = STREAK_FILTERS[k];
      const b = document.createElement("button");
      b.textContent = f.label;
      b.onclick = function(){ startStreak(k); };
      row.appendChild(b);
    }
    wrap.appendChild(row);
    box.appendChild(wrap);
    return;
  }

  const f = STREAK_FILTERS[streak.filter];
  const used = new Set(streak.used || []);
  const left = INDEX.filter(function(c){ return f.test(c) && !used.has(c.i) && c.a; }).length;

  const note = document.createElement("div");
  note.className = "streakexplain";
  note.textContent = st.status === "broken"
    ? "You last counted a day on " + st.last + ". Nothing has been changed — you decide whether this continues the run or starts a new one."
    : left + " card" + (left === 1 ? "" : "s") + " left that you have not used. The count only moves when you tell us you posted.";
  wrap.appendChild(note);

  const row = document.createElement("div");
  row.className = "streakactions";
  const load = document.createElement("button");
  load.className = "go";
  load.textContent = "Load today's card";
  load.onclick = function(){ todaysCard(); };
  const conf = document.createElement("button");
  conf.textContent = st.status === "done today" ? "Already counted today" : "I posted it — count day " + (st.day + 1);
  conf.disabled = st.status === "done today";
  conf.onclick = function(){ confirmPosted(); };
  const filt = document.createElement("button");
  filt.textContent = streakFilterOn ? "Show all cards" : "Show only my streak pool";
  filt.onclick = function(){ toggleStreakFilter(); };
  row.appendChild(load); row.appendChild(conf); row.appendChild(filt);
  wrap.appendChild(row);
  box.appendChild(wrap);
}

function endStreak(){ streak = null; try { store.del("catchem-streak"); } catch {} el("streakbar").hidden = true; }

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
safeWire(function(){ el("fslab").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fSlab = b.dataset.s;
  el("fslab").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.s === fSlab));
  blob = null; render();
}); }, "fslab");

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

// MOOD. The only feature built directly on evidence: all three posts that
// worked started from how Tyler felt, and none used the 84 formulas we
// generate. It matches the WORDS PRINTED ON THE CARD rather than an opinion
// of how a card feels — Psyduck's attack is literally called Overthink — so
// every match is checkable by looking at the card.
let fMood = null;
{
  const box = el("fmood");
  if (box) {
    box.innerHTML = MOODS.map(m => "<button class='chip' data-m='" + m.id + "'>" + m.emoji + " " + m.label + "</button>").join("");
    box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      fMood = fMood === b.dataset.m ? null : b.dataset.m;
      box.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.m === fMood));
      if (fMood) loadMood(fMood);
      else { renderThemes(); buildIdeas(); }
    });
  }
}

function loadMood(id){
  const m = MOODS.find(x => x.id === id);
  if (!m) return;
  const need = fCount || 2;
  // Take from the top of the ranked list, but not the same cards every time —
  // a mood you can only post once is a mood you use once.
  const top = m.cards.slice(0, Math.min(24, m.cards.length));
  const picked = [];
  const used = new Set();
  while (picked.length < need && used.size < top.length) {
    const i = Math.floor(Math.random() * top.length);
    if (used.has(i)) continue;
    used.add(i);
    const c = INDEX.find(x => x.i === top[i].id);
    if (c) picked.push(c);
  }
  if (picked.length < need) return;
  tray = picked; blob = null;
  el("label").value = m.say;
  // Show WHY each card matched, so nobody has to take our word for it.
  const box = el("ideas");
  // BUILT WITH DOM CALLS. Seven escaped-quote collapses in this file and every
  // string attempt has failed; the DOM approach has held every time. Nothing to
  // escape at any level.
  const ideaBox = el("ideas");
  if (ideaBox) {
    ideaBox.innerHTML = "";
    const d = document.createElement("div");
    d.className = "idea";
    d.onclick = () => loadMood(id);
    const b = document.createElement("b");
    b.textContent = m.emoji + " " + m.label;
    // ONE LINE PER CARD, each with its own reason. A run-on separated by dots
    // is a field dump; a line per card with the reason under it is something
    // somebody actually reads.
    for (const c of picked) {
      const h = m.cards.find(x => x.id === c.i);
      const row = document.createElement("div");
      row.className = "moodcard";
      const nm = document.createElement("span");
      nm.className = "mc-name";
      nm.textContent = c.n;
      const meta = document.createElement("span");
      meta.className = "mc-meta";
      meta.textContent = c.s + " · " + c.y + " · " + (c.a || "artist not recorded");
      const rz = document.createElement("span");
      rz.className = "mc-why";
      rz.textContent = h && h.why ? h.why : "";
      row.appendChild(nm); row.appendChild(meta); row.appendChild(rz);
      d.appendChild(row);
    }
    const hk = document.createElement("div");
    hk.className = "hook";
    hk.textContent = "Matched on the words printed on the card. Click again for a different set.";
    d.appendChild(b); d.appendChild(hk);
    ideaBox.appendChild(d);
  }
  render();
}
window.loadMood = loadMood;

// IMAGE FAILURES, COUNTED AND NAMED. A broken-image icon tells nobody anything,
// and I have now guessed twice at why images fail on Tyler's machine from a
// sandbox that cannot reach the image host. This turns "images aren't working"
// into "34 of 36 failed, first was ecard2-149" — a thing somebody can act on.
let imgFail = 0, imgTotal = 0, firstFail = null;
function imgOk(){ imgTotal++; reportImages(); }
function imgBad(node, id){
  imgFail++; imgTotal++;
  firstFail = firstFail || id;
  const hit = node.closest ? node.closest(".hit") : null;
  if (hit) { hit.classList.add("failed"); const m = hit.querySelector(".failmsg"); if (m) m.textContent = id; }
  reportImages();
}
function reportImages(){
  const box = el("imgstatus");
  if (!box) return;
  if (!imgFail) { box.hidden = true; return; }
  box.hidden = false;
  box.textContent = imgFail + " of " + imgTotal + " card images failed to load. First: " + firstFail +
    ". Card art is hosted by pokemontcg.io — if everything failed, the host is unreachable from your browser.";
}
window.imgOk = imgOk; window.imgBad = imgBad;

// LINE SUGGESTIONS. Options, never a finished post — fifty creators posting an
// identical generated sentence is a bot farm, and the whole point is that each
// register sounds like a different person.
function renderLines(){
  const box = el("lines");
  if (!box) return;
  if (!tray.length) { box.hidden = true; return; }
  const themeName = fTheme ? (THEMES.find(x => x.id === fTheme) || {}).name : null;
  const opts = lineOptions(tray, themeName, Number(store.get("typicalViews")) || 0);
  if (!opts.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = "";
  const h = document.createElement("div");
  h.className = "lhead";
  h.textContent = "SOMETHING TO SAY — TAP ONE, THEN MAKE IT YOURS";
  box.appendChild(h);
  for (const o of opts) {
    const b = document.createElement("button");
    b.className = "lineopt";
    const tg = document.createElement("span");
    tg.className = "tag2";
    tg.textContent = o.label.toUpperCase();
    const tx = document.createElement("span");
    tx.className = "txt";
    tx.textContent = o.text;
    b.appendChild(tg); b.appendChild(tx);
    b.onclick = () => { el("label").value = o.text; blob = null; };
    box.appendChild(b);
  }
}

// THE SELF-REPLY. @shotguncaio posts the card list as a reply to his own post,
// every time, and those replies pull 1.7K-2K views on their own. It answers the
// question every card post gets before anyone asks it — and the editor already
// knows the answer, so nobody should type it by hand.
// THE DAY NUMBER IS THE HOOK. shotguncaio is on Day 90 of "one Pokemon card I
// love that costs under $10" at 43k followers, and the NUMBER is what makes it a
// series — without it, it is a man posting cards. We built the streak and never
// wrote the sentence.
function streakLine(){
  if (!streak) return null;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) return null;
  const day = (streak.used || []).length + 1;
  const what = f.series || f.label.toLowerCase();
  return "Day " + day + " of " + what + ".";
}
function renderStreakLine(){
  if (!streak || !tray.length) return;
  const line = streakLine();
  const lab = el("label");
  // Only fills an EMPTY label. Overwriting something Tyler wrote would be the
  // tool competing with him, which is the one thing it must never do.
  if (line && lab && !lab.value.trim()) lab.value = line;
}

function renderSelfReply(){
  const box = el("selfreply");
  if (!box) return;
  if (!tray.length) { box.hidden = true; return; }
  box.hidden = false;
  const NL = String.fromCharCode(10);
  const text = "Cards above:" + NL + tray.map(c => {
    const num = c.i.slice(c.i.lastIndexOf("-") + 1);
    return "· " + c.n + " (" + num + " – " + c.s + ")" + (c.a ? " – " + c.a : "");
  }).join(NL);
  box.innerHTML = "";
  const h = document.createElement("div");
  h.className = "srhead";
  h.textContent = "POST THIS AS A REPLY TO YOUR OWN POST";
  const pre = document.createElement("pre");
  pre.textContent = text;
  const b = document.createElement("button");
  b.textContent = "Copy the list";
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(text); b.textContent = "Copied"; }
    catch { b.textContent = "Select and copy above"; }
  };
  box.appendChild(h); box.appendChild(pre); box.appendChild(b);
}

// RATING FILTERS. Each one is a real threshold on a derived number, and the
// panel says which printed field the number came from — because a filter you
// cannot explain is a filter nobody should trust.
const RATING_FILTERS = [
  { id: "cute", label: "Cute", test: (r) => (r.cute ?? 0) >= 7, note: "the Baby subtype, or an unevolved Basic at 60 HP or less" },
  { id: "comedy", label: "Funny", test: (r) => (r.comedy ?? 0) >= 8, note: "the attack name is a genuinely absurd one" },
  { id: "serious", label: "Dark", test: (r) => (r.serious ?? 0) >= 9, note: "the printed flavour text uses grim language" },
  { id: "cheap", label: "Under a fiver", test: (r) => (r.price ?? 99) <= 4, note: "the bottom 40% of every priced card" },
  { id: "dear", label: "Expensive", test: (r) => (r.price ?? 0) >= 9, note: "the top 10% of every priced card" },
  { id: "strong", label: "High HP", test: (r) => (r.power ?? 0) >= 8, note: "300 HP or more, printed" },
  { id: "artprem", label: "Art people pay for", test: (r) => (r.artPremium ?? 0) >= 3, note: "it trades at 2.5x or more the median Illustration Rare of its own set — the community paying extra for the artwork specifically" },
  { id: "scarce", label: "Scarce", test: (r) => (r.scarcity ?? 0) >= 8, note: "an Illustration Rare or better, printed" },
];
let fRating = null;
{
  const box = el("frating");
  if (box) {
    box.innerHTML = RATING_FILTERS.map(f => "<button class='chip' data-i='" + f.id + "'>" + f.label + "</button>").join("")
      + "<div class='ratingwhy' id='ratingwhy'></div>";
    box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
      fRating = fRating === b.dataset.i ? null : b.dataset.i;
      box.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.i === fRating));
      const f = RATING_FILTERS.find(x => x.id === fRating);
      const w = el("ratingwhy");
      if (w) w.textContent = f ? "Showing cards where " + f.note + "." : "";
      resetPage(); search(); renderThemes(); buildIdeas();
    });
  }
}
function ratingPass(c){
  if (!fRating) return true;
  const f = RATING_FILTERS.find(x => x.id === fRating);
  const b = BIOS[c.i];
  return f && b ? f.test(b) : false;
}

// POKEMON PICKER. 1,547 distinct Pokemon in the shipped set, and 510 of them
// have exactly one card — a flat list would be useless, so the picker shows the
// ones with the most cards and narrows as you type.
let fMon = null, fSort = "mon";
function renderMonChips(q){
  const box = el("monchips");
  if (!box) return;
  const counts = {};
  for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
  let names = Object.keys(counts);
  if (q) { const lq = q.toLowerCase(); names = names.filter(n => n.toLowerCase().indexOf(lq) === 0); }
  names.sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  box.innerHTML = names.slice(0, 40).map(n =>
    "<button class='chip" + (fMon === n ? " on" : "") + "' data-m='" + n + "'>" + n + " " + counts[n] + "</button>").join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    fMon = fMon === b.dataset.m ? null : b.dataset.m;
    renderMonChips(el("monq") ? el("monq").value.trim() : "");
    resetPage(); search();
  });
}
function monPass(c){ return !fMon || monName(c.n) === fMon; }
{
  const q = el("monq");
  if (q) q.addEventListener("input", () => renderMonChips(q.value.trim()));
  const sr = document.querySelector(".sortrow");
  if (sr) sr.querySelectorAll(".chip").forEach(b => b.onclick = () => {
    fSort = b.dataset.sort;
    sr.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x.dataset.sort === fSort));
    resetPage(); search();
  });
}
// SORTING. "Organised" means different things depending on the job — grouping
// by Pokemon keeps every Charizard together, which is what browsing wants, and
// price ordering is what shopping wants.
function sortCards(list){
  const a = list.slice();
  if (fSort === "price") return a.sort(function(x, y){ return (y.p || 0) - (x.p || 0); });
  if (fSort === "new") return a.sort(function(x, y){ return String(y.y).localeCompare(String(x.y)); });
  if (fSort === "old") return a.sort(function(x, y){ return String(x.y).localeCompare(String(y.y)); });
  return a.sort(function(x, y){
    var mx = monName(x.n), my = monName(y.n);
    if (mx !== my) return mx.localeCompare(my);
    return (y.p || 0) - (x.p || 0);
  });
}

// THE STREAK MUST SHOW ITS STATE AND CHANGE THE CARDS. It used to render a bar
// and never touch the browse grid, so turning it on had no visible effect —
// which is indistinguishable from broken, and Tyler read it exactly that way.
let streakFilterOn = false;
function streakPass(c){
  if (!streakFilterOn || !streak) return true;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) return true;
  const used = new Set(streak.used || []);
  return f.test(c) && !used.has(c.i);
}
function toggleStreakFilter(){
  streakFilterOn = !streakFilterOn;
  resetPage(); search(); renderStreak();
}
function todaysCard(){
  // A MISSING FILTER MUST NOT CRASH. A stale localStorage entry from an older
  // build, or a filter renamed between versions, lands here with a name that no
  // longer exists — and reading .test on undefined took the whole page down.
  if (!streak) return;
  const f = STREAK_FILTERS[streak.filter];
  if (!f) { setStatus("That streak used a filter this version no longer has. Start a new one.", true); return; }
  const used = new Set(streak.used || []);
  const pool = INDEX.filter(c => f.test(c) && !used.has(c.i) && c.a);
  if (!pool.length) return;
  // Ordered streaks walk the pool in sequence; the rest pick at random so two
  // creators on the same filter do not get the same card.
  const pick = f.ordered ? pool[0] : pool[Math.floor(Math.random() * pool.length)];
  tray = [pick]; blob = null;
  render();
}
window.toggleStreakFilter = toggleStreakFilter;
window.todaysCard = todaysCard;

// SHOW A REAL IMAGE, NOT A CANVAS. The first thing anybody does with an image
// on a phone is hold it and pick Save Image, and a <canvas> never offers that
// menu — so the most natural action on the device silently did nothing and the
// tool read as broken. Swapping in a real <img> after composing makes the
// obvious gesture work.
function showSaveable(dataUrl){
  const img = el("outimg"), cv = el("cv");
  if (!img || !cv) return;
  img.src = dataUrl;
  img.hidden = false;
  cv.style.display = "none";
  const hint = el("savehint");
  if (hint) hint.textContent = "Press and hold the image to save it — or use the buttons below.";
}
window.showSaveable = showSaveable;

// FIVE WAYS OUT, ONE OF WHICH CANNOT FAIL. Press-and-hold works on phones,
// Copy is fastest on desktop, Share opens the native sheet, Download is the
// desktop default, and OPEN IN A TAB is just a URL — nothing to block. Every
// one reports what happened, because a silent success looks exactly like a
// silent failure and that is what makes people give up.
async function copyImage(){
  const cv = el("cv");
  try {
    const b = await new Promise(r => cv.toBlob(r, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
    setStatus("Copied — paste it straight into your post.", false);
  } catch (e) {
    setStatus("Copy is blocked in this browser. Press and hold the image above, or use Open in a tab.", true);
  }
}
async function shareImage(){
  const cv = el("cv");
  try {
    const b = await new Promise(r => cv.toBlob(r, "image/png"));
    const f = new File([b], "catchem.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      await navigator.share({ files: [f] });
      setStatus("Shared.", false);
    } else setStatus("Sharing is not available here. Press and hold the image above to save it.", true);
  } catch (e) { setStatus("Share cancelled.", false); }
}
function openImage(){
  // THE ONE THAT CANNOT FAIL. No download attribute, no clipboard permission,
  // no share API — just an image at a URL, which every browser can show and
  // every user can then save however their device does it.
  const cv = el("cv");
  const w = window.open();
  if (w) { w.document.write('<img src="' + cv.toDataURL("image/png") + '" style="max-width:100%">'); w.document.close(); }
  else setStatus("Your browser blocked the new tab. Press and hold the image above instead.", true);
}
function dlImage(){
  const cv = el("cv");
  const a = document.createElement("a");
  a.href = cv.toDataURL("image/png");
  a.download = "catchem.png";
  a.click();
  // iOS often OPENS this instead of saving, so say what to do when it does.
  setStatus("If that opened the image instead of saving it, press and hold it.", false);
}
window.dlImage = dlImage;
window.copyImage = copyImage; window.shareImage = shareImage; window.openImage = openImage;

// A FAILED IMAGE MUST SAY SO. A broken icon explains nothing, and the user
// cannot tell a slow connection from a dead host from a broken tool. This tries
// the second host once, then reports — and counts the failures so the boot
// panel can say how many.
let imgFails = 0;
function imgFallback(node, id){
  if (node.dataset.tried) {
    imgFails++;
    node.style.display = "none";
    const hit = node.parentElement;
    if (hit) hit.style.opacity = "0.45";
    const box = el("imgstatus");
    if (box) {
      box.hidden = false;
      box.textContent = imgFails + " card image" + (imgFails > 1 ? "s" : "") + " failed to load. The art is hosted by pokemontcg.io — if every one failed, that host is unreachable from this browser or connection.";
    }
    return;
  }
  node.dataset.tried = "1";
  node.src = "https://images.scrydex.com/pokemon/" + id + "/small";
}
window.imgFallback = imgFallback;

// APPLY WHAT WAS UNDERSTOOD. The box sets the same filters the panels do, so
// there is one system underneath and the advanced controls stay honest — they
// show what the sentence actually did.
const EXAMPLES = [
  "cards nobody talks about",
  "charizard through the years",
  "cute cards under a fiver",
  "two cards by the same artist",
  "something dark",
  "the whole charmander line",
];
function intentCtx(){
  return {
    monNames: [...new Set(INDEX.map(c => monName(c.n)))],
    artists: [...new Set(INDEX.map(c => c.a).filter(Boolean))],
    sets: [...new Set(INDEX.map(c => c.s))],
    moods: MOODS,
    examples: EXAMPLES,
  };
}
function runAsk(text){
  const ctx = intentCtx();
  const found = parseIntent(text, ctx);
  const reply = intentReply(found, ctx);
  const box = el("askreply");
  if (box) { box.textContent = reply.say; box.className = "askreply" + (reply.ok ? "" : " bad"); }
  if (!reply.ok) return;
  // THE PROMPT RESOLVES ITS OWN CARDS. The old path set filters and then handed
  // off to the theme builder, which picks from its own pool and never consults
  // them — so "charizard through the years" parsed Charizard correctly and
  // returned Alakazam, and "fire types" returned Gyarados. A theme may suggest
  // an ordering; it may never widen the pool past what was asked for.
  fMon = null; fRating = null; fSet = ""; fTheme = null;
  if (found.count) fCount = found.count;
  if (found.mon) fMon = found.mon;
  if (found.set) fSet = found.set;
  if (found.rating) fRating = found.rating;
  if (found.mood) { loadMood(found.mood); return; }

  const res = resolvePrompt(found, INDEX, {
    monName: monName,
    attrs: ATTRS,
    // THE RATING LOOKUP WAS WRONG, so "cute" and "dark" returned identical cards —
    // the clause matched nothing and was silently skipped. Ratings live on the
    // row, not in a separate BIOS map.
    ratingOf: function(id, k){
      // Ratings are card.R — column 12 of the row becomes R on the object, and
      // byIdRow holds OBJECTS not rows, so [12] was always undefined and every
      // card silently scored zero.
      const c = byIdRow[id];
      return c && c.R && typeof c.R[k] === "number" ? c.R[k] : 0;
    },
    HERO_RX: HERO_RX,
    // The chain, walked from evolvesFrom which is a printed field.
    evoLineFor: function(name){
      const line = [name]; let cur = name;
      for (var i = 0; i < 3; i++) {
        var next = null;
        for (var id in ATTRS) { var a = ATTRS[id]; if (a && a.ev === cur) { var row = byIdRow[id]; if (row) { next = monName(row[1]); break; } } }
        if (!next || line.indexOf(next) >= 0) break;
        line.push(next); cur = next;
      }
      return line;
    },
  });

  if (res.cards.length) {
    tray = res.cards; blob = null;
    // SAY WHICH CONSTRAINTS WERE APPLIED. When the answer looks wrong, the user
    // can see whether the tool misread the sentence or the catalogue simply has
    // nothing — and those need different responses from them.
    if (box) { box.textContent = "Showing " + res.why.join(" · ") + "."; box.className = "askreply"; }
    render(); resetPage(); search();
    return;
  }
  if (box) { box.textContent = "Nothing in the catalogue fits all of that. Try dropping one part of it."; box.className = "askreply bad"; }
}
{
  const eg = el("egs");
  if (eg) {
    eg.innerHTML = EXAMPLES.map(function(e){ return "<button class='eg'>" + e + "</button>"; }).join("");
    eg.querySelectorAll(".eg").forEach(function(b){ b.onclick = function(){ el("ask").value = b.textContent; runAsk(b.textContent); }; });
  }
  const ask = el("ask");
  if (ask) {
    ask.addEventListener("keydown", function(e){ if (e.key === "Enter") { el("suggest").hidden = true; runAsk(ask.value); } });
    ask.addEventListener("input", function(){ renderSuggest(ask.value); });
  }
}
window.runAsk = runAsk;

// THE ONE INPUT THE TIERS NEED, asked once and remembered. And the note says
// plainly that it is unproven — we hold five logged posts, so presenting a
// threshold as a finding would be the slop law on a new surface.
// VIEWS, NOT FOLLOWERS. Tyler: "follower count can be misleading sometimes."
// Right — followers are an accumulated number and views are a live signal, and
// the tier is only trying to answer whether there is a crowd big enough to
// answer a question. That is a views question.
function setReach(){
  const f = el("views"), note = el("reachnote");
  if (!f) return;
  const saved = store.get("typicalViews");
  if (saved) f.value = saved;
  const show = function(){
    const n = Number(f.value) || 0;
    if (!n) { if (note) note.textContent = "Optional — it orders the line suggestions. Views beat followers here."; return; }
    store.set("typicalViews", String(n));
    const t = tierFor(n);
    if (note && t) note.textContent = t.label + " — " + t.why + ". (Unproven: five logged posts.)";
    renderLines();
  };
  f.addEventListener("input", show);
  show();
}
setReach();

// THE COUNT NEVER ADVANCES ON ITS OWN (Tyler, 2026-08-24: "we can't be the
// reason they miss a day or say the wrong day").
//
// A wrong day number is a PUBLIC credibility hit for the creator, not for us —
// they are the one who typed "Day 47" under a picture. So every rule here is
// about never letting the tool make a claim it cannot back.
//
// FIVE WAYS A STREAK COUNTER LIES, and what each costs:
//   1. Advances on open — Day 47 becomes a number we invented
//   2. Double counts — two visits on a Tuesday jump two days
//   3. Misses a break — they skip Thursday and somebody in the replies notices
//   4. Timezone — 11pm Monday and 1am Wednesday, is that a miss?
//   5. Repeats a card — Day 60 shows Day 12's card and the premise collapses
//
// The rule that solves most of it: **it advances only when they confirm they
// posted.** Everything else is a claim we cannot stand behind.
const DAY_MS = 86400000;
// A DAY IS A LOCAL CALENDAR DAY. Anything else is arbitrary, and "posted at
// 11pm then 1am" has to be two days or the count argues with the timeline.
function dayKey(d){
  const x = d ? new Date(d) : new Date();
  return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0");
}
function daysBetween(a, b){
  const A = new Date(a + "T12:00:00"), B = new Date(b + "T12:00:00");
  return Math.round((B - A) / DAY_MS);
}
function streakState(){
  if (!streak || !streak.days || !streak.days.length) return { day: 0, status: "not started" };
  const days = streak.days.slice().sort();
  const last = days[days.length - 1];
  const gap = daysBetween(last, dayKey());
  // BROKEN IS A STATE, NOT A RESET. Silently starting again at Day 1 hides
  // something they would want to know, and quietly continuing the count is a
  // lie somebody in their replies can check.
  // MISSED DAYS = the gap minus today. Last posted four days ago means three
  // days went by unposted. Getting this wrong by one puts a wrong number in
  // front of an audience, which is the whole thing we are guarding against.
  if (gap > 1) return { day: days.length, status: "broken", missed: gap - 1, last };
  if (gap === 1) return { day: days.length, status: "due", last };
  return { day: days.length, status: "done today", last };
}
function confirmPosted(){
  // Same guard. The fuzzer reached this with no streak and with an unknown
  // filter, 173 times across 300 random journeys.
  if (!streak) { setStatus("No streak running — start one first.", false); return; }
  if (!STREAK_FILTERS[streak.filter]) { setStatus("That streak used a filter this version no longer has. Start a new one.", true); return; }
  const k = dayKey();
  streak.days = streak.days || [];
  // DOUBLE-COUNT GUARD. Two confirmations on one calendar day is one day.
  if (streak.days.indexOf(k) >= 0) { setStatus("Already counted today — the streak stays at day " + streak.days.length + ".", false); renderStreak(); return; }
  const st = streakState();
  if (st.status === "broken") {
    // NEVER DECIDE THIS FOR THEM. Continuing or restarting is a claim about
    // their own history, and only they know whether they posted elsewhere.
    var NL2 = String.fromCharCode(10);
    const keep = confirm("You last posted " + st.missed + " day" + (st.missed > 1 ? "s" : "") + " ago, so the run has a gap." + NL2 + NL2 + "OK = count this as day " + (st.day + 1) + " and keep the total." + NL2 + "Cancel = start again at day 1.");
    if (!keep) streak.days = [];
  }
  streak.days.push(k);
  // NEVER REPEAT A CARD. Day 60 showing Day 12's card ends the series.
  if (tray.length) {
    streak.used = streak.used || [];
    for (const c of tray) if (streak.used.indexOf(c.i) < 0) streak.used.push(c.i);
  }
  saveStreak();
  setStatus("Day " + streak.days.length + " counted. See you tomorrow.", false);
  renderStreak();
}
window.confirmPosted = confirmPosted;

// AUTOCOMPLETE. Chandelure, Volcarona, Gholdengo, Poltchageist — an exact-match
// box punishes a typo with an empty screen, which reads as broken rather than
// misspelled. Three passes in order of confidence: prefix, contains, then edit
// distance so "chandalure" still finds Chandelure.
let SUGGEST_NAMES = null;
function suggestNames(q){
  if (!q || q.length < 2) return [];
  if (!SUGGEST_NAMES) {
    const counts = {};
    for (const c of INDEX) { const m = monName(c.n); if (m) counts[m] = (counts[m] || 0) + 1; }
    // Ranked by how many cards exist, so the Pokémon somebody is likelier to
    // mean comes first.
    SUGGEST_NAMES = Object.keys(counts).sort(function(a, b){ return counts[b] - counts[a]; });
  }
  const lq = q.toLowerCase();
  const pre = [], mid = [];
  for (const n of SUGGEST_NAMES) {
    const ln = n.toLowerCase();
    if (ln.indexOf(lq) === 0) pre.push(n);
    else if (ln.indexOf(lq) > 0) mid.push(n);
    if (pre.length >= 6) break;
  }
  let out = pre.concat(mid).slice(0, 6);
  // ONLY IF NOTHING MATCHED. Edit distance is expensive and imprecise, so it is
  // the last resort rather than the first.
  if (!out.length && lq.length >= 4) {
    const scored = [];
    for (const n of SUGGEST_NAMES) {
      const d = editDistance(lq, n.toLowerCase());
      // A LONGER WORD TOLERATES A BIGGER GAP. "chandal" to "chandelure" is three
      // edits and unmistakably the same word; the old third-of-length rule
      // rejected it at seven characters.
      if (d <= Math.max(2, Math.ceil(lq.length / 2))) scored.push([d, n]);
    }
    out = scored.sort(function(a, b){ return a[0] - b[0]; }).slice(0, 4).map(function(x){ return x[1]; });
  }
  return out;
}
function renderSuggest(q){
  const box = el("suggest");
  if (!box) return;
  // Only suggest on the LAST word — "charizard evo" should still suggest for
  // "evo" being typed, not re-suggest Charizard.
  const word = String(q).split(/\s+/).pop();
  const names = suggestNames(word);
  if (!names.length) { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = names.map(function(n){ return "<button class='sg'>" + n + "</button>"; }).join("");
  box.querySelectorAll(".sg").forEach(function(b){
    b.onclick = function(){
      const ask = el("ask");
      const parts = String(ask.value).split(/\s+/);
      parts[parts.length - 1] = b.textContent;
      ask.value = parts.join(" ");
      box.innerHTML = ""; box.hidden = true;
      runAsk(ask.value);
    };
  });
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
    \`<div class="pocket filled"><img src="\${imgUrl(c.i)}" alt="\${c.n}" loading=\"lazy\" onerror=\"this.onerror=null;this.src=this.src.replace(&#39;_hires&#39;,&#39;&#39;)\"><button class="x" onclick="remove(\${k})" aria-label="Remove \${c.n}">×</button><button class="own \${owned[c.i] ? 'yes' : ''}" onclick="toggleOwn('\${c.i}')">\${owned[c.i] ? 'OWNED' : 'want'}</button></div>\`).join("");
  for (let i = tray.length; i < slots; i++) html += '<div class="pocket"></div>';
  box.innerHTML = html || '<div class="pocket"></div><div class="pocket"></div><div class="pocket"></div>';
  const allowed = checkIntent();
  renderLines();
  renderStreakLine();
  renderSelfReply();
  renderStreak();
  renderTally();
  el("plabel").textContent = L ? ("YOUR PAGE — " + L.name.toUpperCase()) : "YOUR PAGE";

  el("make").disabled = !L || !allowed;
  el("cv").style.display = "none";
  ["copy","share","dl"].forEach(i => el(i).hidden = true);
  if (!tray.length) { setStatus("Pick an idea above, or search for a card."); return; }
  if (L) {
    // WARN AT COMPOSE TIME. 216 cards are addable with no recorded artist, and
    // nothing said so before the image was made — card-composite refuses an
    // uncredited art post and the editor let one through silently.
    const missing = tray.filter(c => !c.a).length;
    setStatus(\`\${tray.length} cards · \${L.cols} across\` + (missing ? \` · \${missing} will publish with NO artist credit\` : ""), missing > 0);
  } else {
    const below = SUPPORTED.filter(n => n < tray.length).pop(), above = SUPPORTED.find(n => n > tray.length);
    setStatus(\`\${tray.length} cards has no frame. \${below ? "Remove " + (tray.length - below) : ""}\${below && above ? " or add " + (above - tray.length) : ""}.\`, true);
  }
}

// THE FUNNEL. Three small questions, then real combinations - not a list of
// themes but a list of POSTS, each already loadable into the tray. A creator
// who arrives without an idea should leave with three.
// NOTHING GATES, EVERY CONTROL REFINES. fCount used to start at 0, so clicking
// an angle before a count returned silently and the whole column read as broken.
// Two is the default because it is the shape that did 18,800 views.
let fSet = "", fCount = 2, fTheme = null;

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
      for (const c of pool) if (c.a) (byMon[monName(c.n)] = byMon[monName(c.n)] || new Set()).add(c.a);
      return Object.values(byMon).some(set => set.size >= need);
    }
    if (t.id === "artist-career" || t.id === "first-and-last") {
      const byArtist = {};
      for (const c of pool) if (c.a) (byArtist[c.a] = byArtist[c.a] || []).push(c);
      return Object.values(byArtist).some(l => l.length >= need);
    }
    return pool.length >= need;
  };
  const fits = THEMES.filter(t => (!fCount || (t.bestAt || []).includes(fCount)) && canFill(t));
  // GROUPED, NOT HIDDEN. 35 chips in one row is a wall, and putting them
  // behind "more options" would be worse — hiding a core control is friction
  // dressed as minimalism. Structure beats disclosure at this size.
  if (!fits.length) { box.innerHTML = "<span class='empty'>Nothing fits that count. Try another.</span>"; return; }
  const groups = {};
  for (const t of fits) (groups[t.group || "OTHER"] = groups[t.group || "OTHER"] || []).push(t);
  const order = ["BY SUBJECT", "BY ARTIST", "BY STORY", "BY ERA", "BY SET", "BY ARGUMENT", "OTHER"];
  box.innerHTML = order.filter(g => groups[g]).map(g =>
    "<div class='tgroup'><span class='tglabel'>" + g + "</span>" +
    groups[g].map(t => "<button class='chip" + (fTheme === t.id ? " on" : "") + "' data-t='" + t.id + "'>" + t.name + "</button>").join("") +
    "</div>").join("");
  box.querySelectorAll(".chip").forEach(b => b.onclick = () => { fTheme = b.dataset.t; renderThemes(); buildIdeas(); });
}
safeWire(function(){ el("fcount").querySelectorAll(".chip").forEach(b => b.onclick = () => {
  fCount = fCount === +b.dataset.n ? 0 : +b.dataset.n;
  el("fcount").querySelectorAll(".chip").forEach(x => x.classList.toggle("on", +x.dataset.n === fCount));
  if (fTheme && !THEMES.find(t => t.id === fTheme && (t.bestAt||[]).includes(fCount))) fTheme = null;
  renderThemes(); buildIdeas();
}); }, "fcount");
el("fset").onchange = () => { fSet = el("fset").value; renderThemes(); buildIdeas(); };

const HERO_RX = /(Special Illustration|Illustration Rare|Rare Holo|Rare Secret|Rare Ultra|Rare Rainbow|Ultra Rare)/i;

function buildIdeas(){
  const box = el("ideas");
  if (!fCount || !fTheme) { box.innerHTML = ""; return; }
  const t = THEMES.find(x => x.id === fTheme);
  // A STALE SELECTION IS THE REALISTIC PATH HERE, not a hostile user: pick a
  // theme, then pick a set that excludes it, and fTheme points at something no
  // longer in the list. It threw on .shape.
  if (!t) { fTheme = null; box.innerHTML = ""; return; }
  const pool = INDEX.filter(c => (!fSet || c.s === fSet) && HERO_RX.test(c.r || "") && ratingPass(c));
  const need = fCount;
  const ideas = [];

  // BUILDERS BY SHAPE, not by id. buildIdeas used to switch on t.id, so four
  // themes produced silently nothing and two shared a branch and returned
  // identical results. Each theme now declares a SHAPE and dispatch is on that
  // — a theme without a builder fails visibly instead of quietly.
  const shape = t.shape || (t.kind === "named list" ? "list" : "unbuilt");

  if (shape === "list") {
    const byMon = {};
    for (const c of pool) {
      const m = (t.members || []).find(x => c.n.startsWith(x));
      if (!m) continue;
      if (!byMon[m] || (c.p || 0) > (byMon[m].p || 0)) byMon[m] = c;
    }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need) ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: t.hook, cards: picked });
  }

  else if (shape === "many-hands") {
    const byName = {};
    for (const c of pool) if (c.a) (byName[monName(c.n)] = byName[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byName)) {
      const seen = new Map();
      for (const c of list) if (!seen.has(c.a)) seen.set(c.a, c);
      if (seen.size >= need) ideas.push({ title: mon + " by " + need + " artists",
        sub: [...seen.keys()].slice(0, need).join(" · "),
        hook: need + " artists. One " + mon + ". Which is definitive?", cards: [...seen.values()].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "artist-span") {
    // The FIRST and LAST card by one hand — the gap is the story.
    const byArtist = {};
    for (const c of pool) if (c.a && c.y) (byArtist[c.a] = byArtist[c.a] || []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      const sorted = list.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1);
      const span = Number(sorted[sorted.length - 1].y) - Number(sorted[0].y);
      if (span < 8 || sorted.length < need) continue;
      const picked = need === 2 ? [sorted[0], sorted[sorted.length - 1]]
        : sorted.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / need)) === 0).slice(0, need);
      if (picked.length !== need) continue;
      ideas.push({ title: artist, sub: picked.map(c => c.n + " " + c.y).join("  →  "),
        hook: span + " years apart. Same artist.", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "debut") {
    // Their EARLIEST card beside their best-known — a different claim entirely
    // from the span, which is why sharing a branch was wrong.
    const byArtist = {};
    for (const c of pool) if (c.a && c.y) (byArtist[c.a] = byArtist[c.a] || []).push(c);
    for (const [artist, list] of Object.entries(byArtist)) {
      if (list.length < need) continue;
      const first = list.slice().sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1)[0];
      const best = list.slice().sort((a, b) => (b.p || 0) - (a.p || 0))[0];
      if (first.i === best.i) continue;
      const picked = [first, best].slice(0, need);
      if (picked.length !== need) continue;
      ideas.push({ title: artist + " started here", sub: first.n + " " + first.y + "  →  " + best.n + " " + best.y,
        hook: "Everybody starts somewhere.", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "battle") {
    // Two versions of one Pokemon, close on value — a battle nobody can settle
    // by pointing at a price.
    const byMon = {};
    for (const c of pool) if (c.p && c.a) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const ranked = list.sort((a, b) => (b.p || 0) - (a.p || 0));
      if (ranked.length < 2) continue;
      const [a, b] = ranked;
      if ((b.p / a.p) < 0.55) continue;
      if (a.a === b.a && a.y === b.y) continue;
      ideas.push({ title: mon + ": " + a.a + " or " + b.a, sub: a.s + "  vs  " + b.s,
        hook: mon + ". " + a.s + " or " + b.s + "? No wrong answer, but you have one.", cards: [a, b].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "one-set") {
    const bySet = {};
    for (const c of pool) (bySet[c.s] = bySet[c.s] || []).push(c);
    for (const [set, list] of Object.entries(bySet)) {
      if (list.length < need) continue;
      const picked = list.sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
      ideas.push({ title: set + ", by value", sub: picked.map(c => c.n).join(" · "),
        hook: need + " from " + set + ". Which page are you filling first?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "eras") {
    // The same Pokemon across widely separated years.
    const byMon = {};
    for (const c of pool) if (c.y) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const years = [...new Set(list.map(c => c.y))].sort();
      if (years.length < need) continue;
      const step = Math.max(1, Math.floor(years.length / need));
      const picked = years.filter((_, i) => i % step === 0).slice(0, need)
        .map(y => list.filter(c => c.y === y).sort((a, b) => (b.p || 0) - (a.p || 0))[0]);
      if (picked.length !== need || picked.some(c => !c)) continue;
      const span = Number(picked[picked.length - 1].y) - Number(picked[0].y);
      if (span < 8) continue;
      ideas.push({ title: mon + " across " + span + " years", sub: picked.map(c => c.y).join(" → "),
        hook: "Which era got " + mon + " right?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "matchup") {
    // THE MATCHUP IS PRINTED ON THE CARD. Every Pokémon card prints a WEAKNESS —
    // a type it takes double damage from — which is a rivalry the game itself
    // declared, not one we invented. 605 cards have both sides available in the
    // catalogue, and "Charmander fears Water → Magikarp" is a joke the data told.
    // A MATCHUP IS ABOUT ITS CARDS, WHATEVER THE RARITY — third time this
    // lesson has appeared. Weakness is printed on every card, and restricting to
    // hero rarity threw away most of both sides.
    const mPool = INDEX.filter(function(c){ return (!fSet || c.s === fSet) && c.a && ATTRS[c.i] && ATTRS[c.i].t; });
    const byType = {};
    for (const c of mPool) for (const t of (ATTRS[c.i]?.t || [])) { byType[t] = byType[t] || []; byType[t].push(c); }
    for (const c of mPool) {
      const w = ATTRS[c.i]?.w;
      if (!w || !byType[w]) continue;
      const enemy = byType[w].filter(function(x){ return monName(x.n) !== monName(c.n); })
        .sort(function(a, b){ return (b.p || 0) - (a.p || 0); })[0];
      if (!enemy) continue;
      ideas.push({ title: monName(c.n) + " fears " + w,
        sub: monName(c.n) + "  ×2 from  " + monName(enemy.n),
        hook: "It says so on the card. Would it actually go that way?",
        cards: [c, enemy].slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "same-attack") {
    // SAME ATTACK, DIFFERENT CREATURES. Thirty-seven attack names are shared by
    // three or more unrelated Pokémon — a connection nobody would notice by
    // browsing, and one only a full catalogue can surface.
    const byAtk = {};
    for (const c of pool) for (const at of (CARD_TEXT[c.i]?.a || [])) {
      if (String(at).length < 7) continue;
      byAtk[at] = byAtk[at] || []; byAtk[at].push(c);
    }
    for (const [name, list] of Object.entries(byAtk)) {
      const distinct = [];
      const seen = {};
      for (const c of list) { const k = monName(c.n); if (!seen[k]) { seen[k] = 1; distinct.push(c); } }
      if (distinct.length < need) continue;
      ideas.push({ title: "All called " + String.fromCharCode(8220) + name + String.fromCharCode(8221),
        sub: distinct.slice(0, need).map(function(c){ return monName(c.n); }).join(" · "),
        hook: "Same attack, different creatures. Which one earned the name?",
        cards: distinct.slice(0, need) });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "twenty-years") {
    // TWENTY YEARS APART. 374 Pokémon have cards two decades apart, and the gap
    // itself is the story — the Arita pairing at 18,800 views was exactly this
    // shape found by hand.
    const byMon = {};
    for (const c of pool) { if (!c.y) continue; const k = monName(c.n); byMon[k] = byMon[k] || []; byMon[k].push(c); }
    for (const [mon, list] of Object.entries(byMon)) {
      const sorted = list.slice().sort(function(a, b){ return String(a.y).localeCompare(String(b.y)); });
      const span = Number(sorted[sorted.length - 1].y) - Number(sorted[0].y);
      if (span < 20) continue;
      const picked = need === 2 ? [sorted[0], sorted[sorted.length - 1]]
        : [sorted[0]].concat(sorted.slice(1, -1).filter(function(_, i){ return i % Math.max(1, Math.floor((sorted.length - 2) / (need - 2))) === 0; }).slice(0, need - 2)).concat([sorted[sorted.length - 1]]);
      if (picked.length !== need) continue;
      ideas.push({ title: mon + ", " + span + " years apart",
        sub: picked.map(function(c){ return c.y; }).join("  →  "),
        hook: span + " years. Which one is still the best?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "evo") {
    // A LINE IS ABOUT ITS CARDS, WHATEVER THE RARITY. Only 34 three-stage lines
    // resolved from hero rarity because the MIDDLE stage breaks them — Metapod
    // has zero Illustration Rares, Kakuna none, Pichu two. Nobody makes a chase
    // card of a cocoon. Same lesson as Koga: filtering by rarity excluded the
    // only card that could complete the request.
    const evoPool = INDEX.filter(function(c){ return (!fSet || c.s === fSet) && c.a && ratingPass(c); });
    // THE EVOLUTION LINE. A real relationship in the data, walked from the
    // evolvesFrom field — Charmander to Charmeleon to Charizard, in order. No
    // name list could produce this, because the relationship IS the content and
    // a list only knows membership.
    const byMon = {};
    for (const c of evoPool) { const k = monName(c.n);
      // Prefer the best card at each stage — hero rarity first, then price —
      // without REQUIRING it, or the cocoon stage kills the line.
      const rank = function(x){ return (HERO_RX.test(x.r || "") ? 1000000 : 0) + (x.p || 0); };
      if (!byMon[k] || rank(c) > rank(byMon[k])) byMon[k] = c; }
    // THE EVO SHAPE IGNORED THE POKEMON. It walked every entry and returned the
    // first complete line, so asking for Charizard announced Charizard and handed
    // back Chansey — saying one thing while showing another, which is the failure
    // that reads as researched.
    const wanted = fMon ? String(fMon).toLowerCase() : null;
    for (const [base, card] of Object.entries(byMon)) {
      if (ATTRS[card.i]?.e) continue;
      // START FROM THE PLAIN CARD. The walk begins at the highest-ranked card for
      // that Pokemon, and for Magikarp that is a Tag Team — "Magikarp & Wailord-GX"
      // — which evolves from nothing and stops the chain on its first step.
      // Choose a PLAIN card for the base rather than dropping the creature.
      // Skipping meant Magikarp never entered the walk at all, when the fix was
      // simply to start from a different Magikarp.
      let startCard = card;
      if (/[&]/.test(startCard.n)) {
        const plain = evoPool.filter(function(x){ return monName(x.n) === base && !/[&]/.test(x.n) && !ATTRS[x.i]?.e; });
        if (!plain.length) continue;
        startCard = plain.sort(function(a,b){ return (HERO_RX.test(b.r||"")?1e6:0)+(b.p||0) - ((HERO_RX.test(a.r||"")?1e6:0)+(a.p||0)); })[0];
      }                 // start at the bottom only
      const line = [startCard];
      let cur = base;
      for (let i = 0; i < 3 && line.length < need; i++) {
        // PICK THE CARD THAT LINKS. The best Gengar is a VMAX, and a Gengar
        // VMAX evolves from Gengar V rather than Haunter — so choosing by value
        // broke the chain on the card being accurate. Look through EVERY card of
        // the next stage for one that names this stage.
        let next = Object.values(byMon).find(x => ATTRS[x.i]?.e === cur);
        // A CARD CANNOT EVOLVE INTO ITSELF. A Machamp VMAX evolves from
        // "Machamp", so searching for a card naming the current stage found
        // Machamp again — and again. The next stage must be a DIFFERENT creature.
        if (next && monName(next.n) === cur) next = null;
        // FALL BACK TO THE BABY LINK. The card will not name it, so the walk
        // stops at Pichu unless we supply the relationship the game defines.
        if (!next) {
          const child = Object.keys(BABY_OF).find(function(k){ return BABY_OF[k] === cur; });
          if (child && byMon[child]) next = byMon[child];
        }
        if (!next) {
          const linking = evoPool.filter(function(x){ return ATTRS[x.i] && ATTRS[x.i].e === cur; });
          const linkingReal = linking.filter(function(x){ return monName(x.n) !== cur; });
          if (linkingReal.length) next = linkingReal.sort(function(a, b){
            return (HERO_RX.test(b.r || "") ? 1000000 : 0) + (b.p || 0) - ((HERO_RX.test(a.r || "") ? 1000000 : 0) + (a.p || 0));
          })[0];
        }
        if (!next) break;
        line.push(next); cur = next.n.split(" ")[0];
      }
      // A LINE OF ONE IS NOT A LINE. Returning a single card whose name merely
      // contains the word is worse than returning nothing, because it looks like
      // an answer. Eevee has eight branches and no single line; it belongs in the
      // Eeveelutions theme, not here.
      // THE LINE IS AS LONG AS IT IS. Magikarp → Gyarados is two stages, and
      // demanding three rejected the whole line and returned a Tag Team card
      // instead. Requiring a count the creature does not have is asking the data
      // to be wrong.
      if (line.length < 2) continue;
      if (line.length > need) line.length = need;
      // NEVER PROMISE A COUNT THE LINE CANNOT FILL. Padding a two-stage line to
      // three said three and produced two.
      // A SHORT LINE IS FINE IF IT IS THE WHOLE LINE. Magikarp → Gyarados is
      // two stages, and blocking it confused "only two long" with "the walk
      // stopped early". The idea now promises what it HAS rather than what was
      // asked for.
      if (line.length < 2) continue;
      // Any stage of the line satisfies the request — asking for Charizard, or
      // Charmander, should both find Charmander → Charmeleon → Charizard.
      if (wanted && !line.some(c => monName(c.n).toLowerCase() === wanted)) continue;
      ideas.push({ count: line.length, title: line.map(c => monName(c.n)).join(" → "),
        sub: line.map(c => c.y).join("  ·  "),
        hook: "The whole line. Which stage is the best card?", cards: line });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "mechanic") {
    // A MECHANIC ERA. V, GX, EX, VMAX — each is a period the game actually had,
    // and collectors date their own history by them. Only possible now the
    // subtype field exists.
    const q = t.query || {};
    const hits = pool.filter(c => (ATTRS[c.i]?.s || []).includes(q.value));
    const byMon = {};
    for (const c of hits) { const k = monName(c.n);
      if (!byMon[k] || (c.p || 0) > (byMon[k].p || 0)) byMon[k] = c; }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need)
      ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: t.hook, cards: picked });
  }

  else if (shape === "power-creep") {
    // POWER CREEP, as a real number over real years. HP runs 30 to 380 and the
    // climb is a story the cards tell on themselves — a fact with no source
    // needed because both numbers are printed.
    const withHp = pool.filter(c => ATTRS[c.i]?.h && c.y);
    const byMon = {};
    for (const c of withHp) (byMon[monName(c.n)] = byMon[monName(c.n)] || []).push(c);
    for (const [mon, list] of Object.entries(byMon)) {
      const sorted = list.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1);
      const oldest = sorted[0], newest = sorted[sorted.length - 1];
      const gap = ATTRS[newest.i].h - ATTRS[oldest.i].h;
      if (gap < 100 || Number(newest.y) - Number(oldest.y) < 8) continue;
      // THE ENDS ARE THE CLAIM. Sampling by step never included the LAST card, so
      // the title said "120 → 330 HP" while the final card shown had 280. Always
      // anchor on oldest and newest and fill the middle between them.
      let picked;
      if (need === 2) picked = [oldest, newest];
      else {
        const middle = sorted.slice(1, -1);
        const step = Math.max(1, Math.floor(middle.length / (need - 2)));
        picked = [oldest, ...middle.filter((_, i) => i % step === 0).slice(0, need - 2), newest];
      }
      if (picked.length !== need) continue;
      ideas.push({ title: mon + ": " + ATTRS[oldest.i].h + " HP → " + ATTRS[newest.i].h + " HP",
        sub: oldest.y + "  →  " + newest.y,
        hook: "Same Pokémon. " + gap + " more HP. Was the power creep worth it?", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "type" || shape === "dex") {
    // A QUERY, NOT A LIST. This is the whole difference: a theme built on a real
    // field is never out of date, and a list I maintain is wrong the day a set
    // lands.
    const q = t.query || {};
    const match = shape === "type"
      ? (c) => (ATTRS[c.i]?.t || []).includes(q.value)
      : (c) => { const d = ATTRS[c.i]?.d; return d && d >= q.from && d <= q.to; };
    const hits = pool.filter(match);
    // One card per Pokemon, best first — nine Charizards is a composition, not
    // a set of nine.
    const byMon = {};
    for (const c of hits) { const k = monName(c.n);
      if (!byMon[k] || (c.p || 0) > (byMon[k].p || 0)) byMon[k] = c; }
    const picked = Object.values(byMon).sort((a, b) => (b.p || 0) - (a.p || 0)).slice(0, need);
    if (picked.length === need)
      ideas.push({ title: t.name, sub: picked.map(c => c.n).join(" · "), hook: t.hook, cards: picked });
  }

  else if (shape === "lore") {
    // THE CARD TELLS ITS OWN STORY. 4,464 cards carry printed flavour text, and
    // it needs no research and no sourcing — it is on the object. This is the
    // difference between a story shape that reaches 0.89% of the catalogue and
    // one that reaches 27%.
    const withLore = pool.filter(c => LORE[c.i]);
    const seen = new Set();
    for (const c of withLore) {
      const key = monName(c.n);
      if (seen.has(key)) continue;
      seen.add(key);
      const group = withLore.filter(x => monName(x.n) === key).slice(0, need);
      if (group.length !== need) continue;
      ideas.push({ title: c.n, sub: LORE[c.i].slice(0, 96) + (LORE[c.i].length > 96 ? "…" : ""),
        hook: "The card says this about itself.", cards: group });
      if (ideas.length >= 6) break;
    }
  }

  else if (shape === "story" || shape === "story-controversial") {
    // Two questions, two slices. These shared one shape and walked the same
    // list from the top, which is why two themes returned identical results.
    const CONTROVERSIAL = /banned|censor|lawsuit|sued|withdrawn|absence|stopped|removed|pulled/i;
    const source = shape === "story-controversial"
      ? FACTS.filter(f => CONTROVERSIAL.test(f.claim))
      : FACTS.filter(f => !CONTROVERSIAL.test(f.claim));
    // Cards our knowledge base has something sourced to say about.
    for (const f of source) {
      // FULL NAME OR NOTHING. This used to match the FIRST WORD of a card name
      // against the claim, so "The Rocket's Trap" appeared beside a fact about
      // Koga's Ninja Trick — because the sentence contains "The". A wrong card
      // beside a true claim is worse than no card: it reads as researched.
      const norm = (x) => x.replace(/[\u2018\u2019]/g, "'").toLowerCase();
      const claim = norm(f.claim);
      // A story is about its CARD, whatever the rarity. Koga's Ninja Trick is an
      // Uncommon, and filtering stories by hero rarity excluded the only card
      // that could illustrate the fact.
      const storyPool = INDEX.filter(c => !fSet || c.s === fSet);
      const named = storyPool.filter(c => c.n.length >= 5 && claim.includes(norm(c.n)));
      if (named.length < need) continue;
      const picked = named.sort((a, b) => (a.y || "") < (b.y || "") ? -1 : 1).slice(0, need);
      ideas.push({ title: f.id.replace(/-/g, " "), sub: picked.map(c => c.n + " " + c.y).join("  →  "),
        hook: f.claim.split(".")[0] + ".", cards: picked });
      if (ideas.length >= 6) break;
    }
  }

  else {
    // A theme with no builder says so, rather than showing an empty box that
    // looks like the tool is broken.
    box.innerHTML = "<div class='empty'>" + t.name + " has no builder yet — pick another angle.</div>";
    window.__ideas = [];
    return;
  }

  box.innerHTML = ideas.length ? ideas.slice(0, 6).map((idea, k) =>
    "<div class='idea' onclick='loadIdea(" + k + ")'><b>" + idea.title + "</b><i>" + idea.sub + "</i><div class='hook'>" + (idea.hook || "") + "</div></div>").join("")
    : "<div class='empty'>Nothing fits " + (fSet || "that") + " at " + fCount + " cards. Widen the set or change the count.</div>";
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

safeWire(function(){ el("make").onclick = async () => {
  const L = LAYOUTS[tray.length]; if (!L) return;
  // ENFORCE AT THE POINT OF ACTION, not only in the UI. The refusal used to
  // live entirely in el("make").disabled, and a disabled attribute is an
  // affordance rather than a guard — re-enabling it in the console, or calling
  // this handler directly, produced the sell image the refusal exists to
  // prevent. Re-checking here means the rule holds wherever the call comes from.
  if (!checkIntent()) { setStatus("that combination is refused — see the note above", true); return; }
  setStatus("composing…");
  const missingArt = [];
  const CW = 745, CH = 1040, GAP = 60, PAD = 90, CAP = tray.length <= 4 ? 70 : 0;
  const LABEL = el("label").value.trim();
  // Reserve height for the WRAPPED label, not one line of it. measureText needs
  // a context we do not have yet, so estimate from character count at 52px bold
  // (~28px per glyph across the usable width) and cap at the three lines the
  // renderer will draw. Over-reserving costs blank pixels; under-reserving costs
  // a caption printed through the footer.
  // MEASURE, DO NOT ESTIMATE. The height used to be guessed from character
  // count at a hardcoded width while the wrapping was measured at the real one,
  // so on a narrower frame the estimate said two lines and the draw produced
  // four — and the last fell off the canvas. Both now come from the same
  // measurement, taken once.
  const LABLINES = LABEL ? (() => {
    const probe = document.createElement("canvas").getContext("2d");
    probe.font = "800 52px system-ui,sans-serif";
    const maxW = L.W - 160;
    let lines = 1, cur = "";
    for (const w of LABEL.split(/\s+/)) {
      const t = cur ? cur + " " + w : w;
      if (probe.measureText(t).width > maxW && cur) { lines++; cur = w; } else cur = t;
    }
    return lines;
  })() : 0;
  const LABH = LABEL ? 110 + (LABLINES - 1) * 62 : 0;
  const ROWS = Math.ceil(tray.length / L.cols);
  // THE TABLE OWNS THE FRAME. This used to recompute the width from the column
  // count, which threw away the WIDENING that keeps a 2x2 from cropping on X —
  // the table said 2056 and the renderer drew 1730. A table is only a source of
  // truth if the thing downstream reads it.
  const W = L.W;
  const SLAB_EXTRA = fSlab ? CH * 0.17 + CW * 0.18 : 0;
  const H = L.H + SLAB_EXTRA * ROWS + (LABEL ? LABH : 0);
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
      // ONE FAILED IMAGE MUST NOT KILL THE WHOLE IMAGE. This threw on the first
      // card that would not load, so a single blocked request produced NOTHING —
      // which is what Tyler saw, and what my harness hid by making every image
      // succeed. A missing card leaves a labelled gap instead: three cards and
      // one hole is a usable post, three cards and an error is not.
      if (!img) { missingArt.push(tray[i].n); continue; }
      // Centre the grid inside the widened frame, or a padded layout sits hard left.
      const gridW = CW*L.cols + GAP*(L.cols-1);
      const originX = Math.round((W - gridW) / 2);
      const x = originX + (i % L.cols)*(CW+GAP), y = PAD + Math.floor(i/L.cols)*(CH+CAP+GAP);
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
    // SAY WHICH ONES ARE MISSING. A silent gap looks like a bug; a named one
    // looks like a card that would not load, which is the truth.
    if (missingArt.length) setStatus("Made it, but " + missingArt.length + " card image" + (missingArt.length > 1 ? "s" : "") + " would not load: " + missingArt.join(", ") + ". The art host may be blocked on this connection.", true);
    else setStatus("ready — " + W + "×" + H);
    // A CANVAS CANNOT BE LONG-PRESSED. Swap in a real <img> so the first
    // gesture anybody tries on a phone actually works.
    // THE IMAGE IS DRAWN BEFORE THE SWAP. If toDataURL throws — a tainted
    // canvas, an old browser — the compose must NOT report failure, because the
    // drawing succeeded and the canvas is right there. Reporting a failure over
    // a finished image is the worst of both.
    try { showSaveable(cv.toDataURL("image/png")); }
    catch (e) { setStatus("Image is ready. Press and hold it, or use Open in a tab.", false); }
  }catch(e){ setStatus("could not compose: " + (e.message||"unknown"), true); }
}; }, "make");

const fname = () => "catchem-" + (el("label").value.trim() || tray.map(c=>c.n).join("-") || "cards")
  .replace(/[^a-z0-9]+/gi,"-").toLowerCase().slice(0,48) + ".png";
safeWire(function(){ el("dl").onclick = () => { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=fname(); a.click(); }; }, "dl");
safeWire(function(){ el("copy").onclick = async () => { try{ await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]); setStatus("copied — paste into the post"); }catch(e){ setStatus("copy failed: "+e.message,true); } }; }, "copy");
safeWire(function(){ el("share").onclick = async () => { try{ await navigator.share({files:[new File([blob],fname(),{type:"image/png"})]}); }catch(e){ if(e.name!=="AbortError") setStatus("share failed: "+e.message,true); } }; }, "share");
</script>`;

  await writeFile(join(ROOT, "research/assets/build.html"), html);
  console.log(`✓ editor: ${index.length.toLocaleString("en-US")} cards searchable · ${Object.keys(LAYOUTS).length} frames · watermark and credit locked`);
}
