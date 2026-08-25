// build-shots.mjs — a vertical page a creator can screen-record.
//
// Tyler, 2026-08-25: video content for YouTube / TikTok / Instagram, to help
// creators who then market us for free.
//
// **WE CANNOT RENDER VIDEO** — static HTML, no encoder. So this produces the
// thing one step before video, which is also the hard part: a **1080×1920 page
// with the shots timed**, that plays itself when you press a key and can be
// screen-recorded on any phone or desktop.
//
// THE SAFE ZONES ARE NOT DECORATION. TikTok, Reels and Shorts cover the top 12%
// with the caption row, the bottom 20% with the description and sound, and the
// right 15% with the like/comment/share rail. **Anything placed there is
// invisible in the app** — and this is the single most common mistake in
// vertical content, because it looks perfect in the editor.
//
// AND FOUR CARDS DOES NOT TRANSFER. The 2×2 that works on X puts each card at
// 33% of the frame; vertically the same layout is unreadable. One card fills
// 85% of the usable width, two fill 41% each. **Never four.**
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf-8"));

const W = 1080, H = 1920;
const SAFE = { top: Math.round(H * 0.12), bottom: Math.round(H * 0.20), right: Math.round(W * 0.15) };
const USABLE_W = W - SAFE.right, USABLE_H = H - SAFE.top - SAFE.bottom;

const idx = await J("research/assets/card-index.json");
const byId = {}; for (const c of idx) byId[c.i] = c;
const hooks = (await J("data/video-hooks.json")).hooks;

const which = process.argv[2];
const hook = which ? hooks.find(h => h.kind === which) || hooks[0] : hooks[0];
const cards = hook.shots.map(i => byId[i]).filter(Boolean);
if (!cards.length) { console.error("  no cards on that hook"); process.exit(1); }

const img = (id) => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// THE SHOT LIST. Timing is the whole craft here: the hook has to land before
// somebody's thumb moves, which is under two seconds.
const shots = [
  { at: 0,   secs: hook.seconds[0], text: hook.hook, cards: cards.slice(0, 1), note: "THE HOOK. It has to land before a thumb moves — under two seconds." },
  { at: hook.seconds[0], secs: hook.seconds[1], text: hook.say, cards: cards.slice(0, 2), note: "THE TURN. Both cards on screen; the viewer compares them themselves." },
  { at: hook.seconds[0] + hook.seconds[1], secs: 3, text: "", cards: cards.slice(0, 2), note: "THE HOLD. Silence over the image. Let them look before you ask anything." },
];
const total = shots.reduce((s, x) => s + x.secs, 0);

const html = `<!doctype html><meta charset="utf-8">
<title>shot list — ${esc(hook.hook.slice(0, 40))}</title>
<meta name="robots" content="noindex">
<style>
  :root{--ink:#0b0e14;--live:#36d399;--text:#eef1f6;--faint:#5c637a;--warn:#f0a132}
  *{box-sizing:border-box;margin:0}
  body{background:#05070b;color:var(--text);font:400 15px/1.6 ui-sans-serif,system-ui,sans-serif;
    display:flex;gap:32px;padding:28px;align-items:flex-start;flex-wrap:wrap}
  .stage{position:relative;width:${W / 2.4}px;height:${H / 2.4}px;background:var(--ink);
    border-radius:20px;overflow:hidden;flex:0 0 auto;box-shadow:0 24px 60px rgba(0,0,0,.6)}
  .frame{position:absolute;inset:0}
  /* THE SAFE ZONES, drawn. Every creator knows they exist and almost nobody
     knows where they actually fall — showing them is the whole point. */
  .zone{position:absolute;background:rgba(240,161,50,.11);border:1px dashed rgba(240,161,50,.4);
    font:500 9px ui-monospace,monospace;color:var(--warn);padding:3px 5px;letter-spacing:.08em;pointer-events:none}
  .z-top{top:0;left:0;right:0;height:${SAFE.top / 2.4}px}
  .z-bot{bottom:0;left:0;right:0;height:${SAFE.bottom / 2.4}px}
  .z-right{top:${SAFE.top / 2.4}px;right:0;width:${SAFE.right / 2.4}px;bottom:${SAFE.bottom / 2.4}px}
  .safe{position:absolute;top:${SAFE.top / 2.4}px;left:0;width:${USABLE_W / 2.4}px;height:${USABLE_H / 2.4}px;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px}
  .cards{display:flex;gap:10px;align-items:center;justify-content:center;width:100%}
  .cards img{border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.5);max-height:${(USABLE_H * 0.62) / 2.4}px}
  .line{font:700 20px/1.25 ui-sans-serif,system-ui,sans-serif;text-align:center;text-wrap:balance;
    text-shadow:0 2px 12px rgba(0,0,0,.8);padding:0 6px}
  .brand{position:absolute;bottom:${(SAFE.bottom / 2.4) + 8}px;left:0;width:${USABLE_W / 2.4}px;
    text-align:center;font:600 10px ui-monospace,monospace;color:var(--live);letter-spacing:.14em}
  .side{flex:1 1 340px;min-width:320px}
  h1{font:700 21px/1.3 ui-sans-serif,system-ui;margin-bottom:4px}
  .sub{color:var(--faint);font-size:13.5px;margin-bottom:22px}
  .shot{border-left:2px solid #1b2130;padding:0 0 20px 16px;position:relative}
  .shot:before{content:"";position:absolute;left:-5px;top:5px;width:8px;height:8px;border-radius:50%;background:var(--live)}
  .t{font:600 10.5px ui-monospace,monospace;color:var(--live);letter-spacing:.1em}
  .say{font-size:15.5px;margin:5px 0 6px}
  .why{color:var(--faint);font-size:13px}
  .check{margin-top:22px;padding:14px 16px;background:#0d1017;border-radius:11px;
    border-left:2px solid var(--live);font-size:13px;color:#aeb6c6}
  .check b{color:var(--live);font:600 10px ui-monospace,monospace;letter-spacing:.12em;display:block;margin-bottom:5px}
  button{background:var(--live);color:var(--ink);border:0;border-radius:10px;padding:11px 18px;
    font:600 14px ui-sans-serif,system-ui;cursor:pointer;margin-top:18px}
  .hint{color:var(--faint);font-size:12.5px;margin-top:9px}
</style>

<div class="stage" id="stage">
  <div class="frame">
    <div class="safe" id="safe">
      <div class="cards" id="cards"></div>
      <div class="line" id="line"></div>
    </div>
    <div class="brand">CATCHEMTCG.COM</div>
    <div class="zone z-top">CAPTION ROW — covered by the app</div>
    <div class="zone z-bot">DESCRIPTION &amp; SOUND — covered</div>
    <div class="zone z-right">BUTTONS</div>
  </div>
</div>

<div class="side">
  <h1>${esc(hook.hook)}</h1>
  <p class="sub">${total}s · ${shots.length} shots · 1080×1920 · ${cards.length} card${cards.length > 1 ? "s" : ""}</p>
  ${shots.map((s, n) => `<div class="shot">
    <div class="t">${String(s.at).padStart(4)}s — ${String(s.at + s.secs)}s</div>
    <div class="say">${s.text ? esc(s.text) : "<i style='color:#5c637a'>no words — hold on the image</i>"}</div>
    <div class="why">${esc(s.note)}</div>
  </div>`).join("")}

  <div class="check">
    <b>WHERE THE NUMBER COMES FROM</b>
    ${esc(hook.check)}
    <br><br>Read this before you say it on camera. If it doesn't match what you
    know, don't use it — a wrong number costs <i>you</i> credibility, not us.
  </div>

  <button onclick="play()">Play it through</button>
  <p class="hint">Screen-record the left panel. The dashed areas are covered by the app's own UI — nothing important goes there.</p>
</div>

<script>
// THE SHOTS, PLAYED. A creator needs to see the timing, not read it — four
// seconds feels much longer on a page than it does on a phone.
const SHOTS = ${JSON.stringify(shots.map(s => ({ secs: s.secs, text: s.text, cards: s.cards.map(c => ({ i: c.i, n: c.n })) })))};
const CARD_IMG = ${JSON.stringify(Object.fromEntries(cards.map(c => [c.i, img(c.i)])))};
function draw(shot){
  const box = document.getElementById("cards");
  box.innerHTML = shot.cards.map(c => '<img src="' + CARD_IMG[c.i] + '" alt="' + c.n + '">').join("");
  document.getElementById("line").textContent = shot.text || "";
}
function play(){
  let n = 0;
  const step = () => {
    if (n >= SHOTS.length) { draw(SHOTS[SHOTS.length - 1]); return; }
    const s = SHOTS[n++];
    draw(s);
    setTimeout(step, s.secs * 1000);
  };
  step();
}
draw(SHOTS[0]);
window.play = play;
</script>`;

await mkdir(join(ROOT, "research/pulse/video"), { recursive: true });
const out = join(ROOT, "research/pulse/video/shot-list.html");
await writeFile(out, html);
console.log(`✓ shots: ${shots.length} over ${total}s · ${cards.length} card(s) · 1080x1920 with safe zones drawn`);
console.log(`\n  "${hook.hook}"`);
console.log(`  ${hook.check}\n`);
console.log(`  ${out.replace(ROOT + "/", "")}`);
