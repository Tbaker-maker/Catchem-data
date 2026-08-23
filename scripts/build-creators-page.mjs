// build-creators-page.mjs — Catch'em Creators.
//
// The Arita post landed: 154 views, 9 likes and an unsolicited reply from a
// verified creator, posted at a bad hour from an account coming back after a
// break. One post is an anecdote, not a model — but it is the first thing we
// have made that somebody outside this project reacted to.
//
// The job now is making it repeatable BY SOMEBODY ELSE. Tyler had the whole
// system, the catalogue and a conversation with me. A creator has none of that
// and about ninety seconds of patience. Every pause between opening this and
// hitting record is a cut, and enough cuts and they go back to reading
// somebody else's tweet on camera.
//
// SO THE PAGE DOES THREE THINGS AND STOPS: shows the ranked pairings, says in
// one line why each one works, and hands over the image. It does NOT write
// their copy. The post that landed did so partly because the words were
// Tyler's own — a hedge in social copy reads as a lack of conviction, and
// borrowed copy reads as borrowed.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

const pairs = await J("research/pulse/pairings.json") ?? { pairings: [] };
const outcomes = await J("data/post-outcomes.json") ?? { posts: [] };
const cat = await J("data/card-catalogue.json") ?? { cards: {} };

// The image URL must come from the source, never be constructed — a built path
// 404s on newer sets and the host answers with a card back, which renders
// perfectly and is a picture of the wrong thing.
const urlFor = async (id) => {
  const set = id.slice(0, id.lastIndexOf("-"));
  try {
    const r = await fetch(`https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/${set}.json`, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) return null;
    const d = await r.json();
    return d.find(c => c.id === id)?.images?.large ?? null;
  } catch { return null; }
};


// ANGLES, NOT TWEETS. "Never write their copy" was too rigid - Tyler's post used
// facts I handed him. The real failure is fifty creators posting IDENTICAL text,
// which makes them look like a bot farm and us like the operator running it.
// So each pairing offers several DIRECTIONS and the facts behind them. The
// creator picks a direction and writes it in their own voice, which is the part
// that made the one successful post work.
const anglesFor = (p) => {
  const sameMon = p.first.name === p.last.name;
  const out = [];
  out.push({ name: "The disbelief angle",
    seed: `It's wild that the person who drew ${p.first.name} in ${p.first.year} is still making cards today.`,
    note: "What Tyler used. Works because it is a reaction, not a fact." });
  out.push({ name: "The permission angle",
    seed: `${p.years} years after ${p.first.name}, they let the same artist draw ${p.last.name}.`,
    note: "The 'they let him' framing implies a decision somebody made, which invites a reply." });
  if (sameMon) out.push({ name: "The same-subject angle",
    seed: `Same artist. Same Pokémon. ${p.years} years apart. Look what changed.`,
    note: "Strongest when the art style visibly shifted — let the images argue." });
  out.push({ name: "The quiet-career angle",
    seed: `${p.artist} has been drawing Pokémon cards since ${p.first.year}. Most people have never heard the name.`,
    note: "Works on people who do not follow the market at all." });
  out.push({ name: "The question angle",
    seed: `Which one is better? ${p.first.name} ${p.first.year} or ${p.last.name} ${p.last.year}. Same artist.`,
    note: "A question gets replies. Replies are the whole game." });
  return out;
};

const rows = [];
for (const p of (pairs.pairings ?? []).slice(0, 10)) {
  const [a, b] = await Promise.all([urlFor(p.first.id), urlFor(p.last.id)]);
  if (!a || !b) continue;                    // no image, no card — never a placeholder
  rows.push({ ...p, urlA: a, urlB: b, angles: anglesFor(p) });
}

const proven = outcomes.posts?.[0];
const html = `<!doctype html><meta charset="utf-8"><title>Catch'em Creators</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#070910;--surf:#0f1219;--ink:#e9ecf3;--dim:#8b93a7;--green:#36d399;--line:rgba(255,255,255,.08)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 20px 90px}
.wrap{max-width:940px;margin:0 auto}
h1{font-size:32px;margin:0 0 4px;letter-spacing:-.4px}
.sub{color:var(--dim);margin:0 0 26px}
.proof{border-left:3px solid var(--green);background:var(--surf);padding:14px 18px;border-radius:0 10px 10px 0;margin:0 0 30px}
.proof b{color:var(--green)}
.card{background:var(--surf);border:1px solid var(--line);border-radius:14px;padding:20px;margin:0 0 18px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.title{font-size:20px;font-weight:700}
.artist{color:var(--dim);font-size:14px}
.why{color:#c3cad8;font-size:14.5px;margin:8px 0 14px}
.pair{display:flex;gap:14px;align-items:flex-start}
.pair img{width:132px;aspect-ratio:745/1040;object-fit:contain;border-radius:8px;background:#0b0d14}
.meta{color:var(--dim);font-size:12.5px;text-align:center;margin-top:6px;width:132px}
.act{margin-left:auto;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
button{background:var(--green);color:#070910;border:0;border-radius:9px;padding:11px 18px;
  font-size:14.5px;font-weight:700;cursor:pointer;white-space:nowrap}
button.ghost{background:transparent;color:var(--dim);border:1px solid var(--line);font-weight:500}
.msg{color:var(--dim);font-size:12.5px;min-height:16px}
.note{color:var(--dim);font-size:13.5px;margin-top:34px;border-top:1px solid var(--line);padding-top:18px}
.setup{margin-top:16px;border-top:1px solid var(--line);padding-top:16px}
.facts{color:#c3cad8;font-size:14px;background:#0b0d14;border-radius:9px;padding:12px 14px;margin-bottom:12px}
.angles{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.angle{background:transparent;border:1px solid var(--line);color:var(--dim);font-weight:500;font-size:13px;padding:8px 12px}
.angle.on{border-color:var(--green);color:var(--green)}
textarea{width:100%;background:#0b0d14;border:1px solid var(--line);border-radius:9px;color:var(--ink);
  padding:12px 14px;font:15px/1.5 inherit;resize:vertical}
.hint{color:var(--dim);font-size:12.5px;margin:6px 0 12px;min-height:16px}
.row2{display:flex;gap:8px;flex-wrap:wrap}
.warn{color:#8b93a7;font-size:12.5px;margin-top:10px}
@media(max-width:620px){.pair img,.meta{width:104px}.act{margin:12px 0 0;align-items:stretch;width:100%}}
</style>
<div class="wrap">
<h1>Catch'em Creators</h1>
<p class="sub">Pairings worth posting. Pick one, download the image, write your own words.
 &nbsp;·&nbsp; <a href="/build" style="color:#36d399">Or build your own &rsaquo;</a></p>

${proven ? `<div class="proof"><b>The shape below is not a guess.</b> One post using it — Base Set Charizard beside the 151 Blastoise ex, same illustrator, ${proven.measured.views} views and ${proven.measured.likes} likes at a bad hour from a small account, plus an unsolicited reply from a verified creator. <b>One post is an anecdote, not a model</b>, and these are ranked on what made that one work rather than on what we can prove.</div>` : ""}

${rows.map((p, i) => `<div class="card">
  <div class="top"><span class="title">${esc(p.first.name)} ${p.first.year} &nbsp;→&nbsp; ${esc(p.last.name)} ${p.last.year}</span>
    <span class="artist">${esc(p.artist)} · ${p.years} years</span></div>
  <div class="why">${esc(p.because.join(" · "))}</div>
  <div class="pair">
    <div><img src="${p.urlA}" alt="${esc(p.first.name)}" loading="lazy"><div class="meta">${esc(p.first.set)}<br>${p.first.year}</div></div>
    <div><img src="${p.urlB}" alt="${esc(p.last.name)}" loading="lazy"><div class="meta">${esc(p.last.set)}<br>${p.last.year}</div></div>
    <div class="act">
      <button onclick="grab(${i})">Download image</button>
      <button class="ghost" onclick="setup(${i})">Set up the post</button>
      <div class="msg" id="m${i}"></div>
    </div>
  </div>
  <div class="setup" id="s${i}" style="display:none">
    <div class="facts"><b>The facts, so you do not have to look them up:</b>
      ${esc(p.artist)} illustrated <b>${esc(p.first.name)}</b> in ${esc(p.first.set)} (${p.first.year}, ${esc(p.first.rarity ?? "")})
      and <b>${esc(p.last.name)}</b> in ${esc(p.last.set)} (${p.last.year}, ${esc(p.last.rarity ?? "")}). ${p.years} years apart.</div>
    <div class="angles">${p.angles.map((a, k) => `<button class="angle" onclick="pick(${i},${k})">${esc(a.name)}</button>`).join("")}</div>
    <textarea id="t${i}" rows="3" placeholder="Pick an angle above, then make it sound like you."></textarea>
    <div class="hint" id="h${i}"></div>
    <div class="row2"><button onclick="toX(${i})">Open X with this</button>
      <button class="ghost" onclick="grab(${i})">Download the image first</button></div>
    <div class="warn">Rewrite it. Fifty creators posting the same sentence helps nobody — the words are the part that has to be yours.</div>
  </div>
</div>`).join("\n")}

<div class="note"><b>We do not write your copy.</b> The post that worked did partly because the words were the creator's own — two conversational lines, no numbers in them. A hedge in a post reads as a lack of conviction, and borrowed copy reads as borrowed. The image carries the claim; the words carry the feeling, and the feeling has to be yours.</div>
</div>
<script>
const PAIRS = ${JSON.stringify(rows.map(p => ({ a: p.urlA, b: p.urlB, an: p.first.name, ay: p.first.year, bn: p.last.name, by: p.last.year, artist: p.artist, years: p.years, ids: [p.first.id, p.last.id], angles: p.angles })))};
function setup(i){ const el=document.getElementById("s"+i); el.style.display = el.style.display==="none" ? "block" : "none"; }
function pick(i,k){
  const a = PAIRS[i].angles[k];
  document.getElementById("t"+i).value = a.seed;
  document.getElementById("h"+i).textContent = a.note;
  document.querySelectorAll("#s"+i+" .angle").forEach((b,j)=>b.classList.toggle("on", j===k));
}
function toX(i){
  const t = document.getElementById("t"+i).value.trim();
  if(!t){ document.getElementById("m"+i).textContent="pick an angle and write it first"; return; }
  window.open("https://twitter.com/intent/tweet?text="+encodeURIComponent(t), "_blank");
  document.getElementById("m"+i).textContent="X opened — attach the image you downloaded";
}
async function grab(i){
  const p = PAIRS[i], msg = document.getElementById("m"+i);
  msg.textContent = "composing…";
  const CW=745, CH=1040, GAP=60, PAD=90, CAP=130, LAB=110;
  const W = PAD*2 + CW*2 + GAP, H = PAD + CH + CAP + LAB + 90;
  const cv = document.createElement("canvas"); cv.width=W; cv.height=H;
  // THUMBNAIL LEGIBILITY. Seen first as a ~400px feed preview and decided on
  // there — text sized for the full canvas vanishes at that scale.
  const thumbScale = 400 / W;
  const px = (n) => Math.max(n, Math.round(n / thumbScale / 2.2));
  const g = cv.getContext("2d");
  g.fillStyle="#070910"; g.fillRect(0,0,W,H);
  try{
    const imgs = await Promise.all([p.a,p.b].map(u => new Promise((res,rej)=>{
      const im=new Image(); im.crossOrigin="anonymous"; im.onload=()=>res(im); im.onerror=rej; im.src=u; })));
    imgs.forEach((im,k)=>{
      const x = PAD + k*(CW+GAP);
      g.drawImage(im, x, PAD, CW, CH);
      g.fillStyle="#8a93a8"; g.font="28px system-ui,sans-serif"; g.textAlign="center";
      g.fillText((k?p.bn:p.an)+" · "+(k?p.by:p.ay), x+CW/2, PAD+CH+52);
    });
    g.fillStyle="#f4f5f8"; g.font="800 52px system-ui,sans-serif"; g.textAlign="center";
    g.fillText(p.years+" years apart. Same illustrator.", W/2, PAD+CH+CAP+40);
    g.fillStyle="#36d399"; g.font="800 38px system-ui,sans-serif"; g.textAlign="left";
    g.fillText("Catch'em", PAD, H-34);
    g.fillStyle="#5c637a"; g.font="24px ui-monospace,monospace"; g.textAlign="right";
    g.fillText(p.artist, W-PAD, H-34);
    const a=document.createElement("a");
    a.href=cv.toDataURL("image/png");
    a.download="catchem-"+p.artist.replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".png";
    a.click();
    msg.textContent="downloaded";
  }catch(e){ msg.textContent="the image host blocked the copy — right-click each card and save instead"; }
}
</script>`;

await writeFile(join(ROOT, "research/assets/creators.html"), html);
console.log(`✓ Catch'em Creators: ${rows.length} pairing(s), each one download away${rows.length < (pairs.pairings ?? []).length ? ` · ${(pairs.pairings ?? []).length - rows.length} skipped for missing images` : ""}`);
