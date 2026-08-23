// build-promo.mjs — card art and branding in one frame.
//
// Tyler, 2026-08-23: "Can we combine a stat (with branding) + card art?"
//
// Yes, and it is the better format than either alone. The card-art posts are
// doing the numbers because they are CONTENT; the announcement card says what
// we are launching but is an advert. This is the card carrying the message
// rather than the message sitting next to a card.
//
// THE RULE THAT KEEPS IT FROM BECOMING AN ADVERT: the artwork is the largest
// thing in the frame and nothing overlaps it. The moment text sits on top of the
// art it stops being a card somebody wants to look at and becomes a banner. The
// message lives beside it, in our space, on our background.
//
// It runs in the BROWSER because the image host refuses my sandbox — same
// reason card-composite works this way. Open the HTML, click download, get a
// 1200x675 PNG.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const idx = JSON.parse(await readFile(join(ROOT, "research/assets/card-index.json"), "utf-8"));
const args = process.argv.slice(2);
const cardId = args[0] ?? "sv8-192";
const headline = (args[args.indexOf("--headline") + 1] !== cardId && args.includes("--headline"))
  ? args[args.indexOf("--headline") + 1] : "Waitlist open.";
const sub = args.includes("--sub") ? args[args.indexOf("--sub") + 1]
  : "Collectors. Content creators. Flippers.";
const kicker = args.includes("--kicker") ? args[args.indexOf("--kicker") + 1] : "CATCH'EM";

const card = idx.find(c => c.i === cardId);
if (!card) { console.error(`  no card ${cardId}`); process.exit(1); }
// A promo carrying somebody's artwork carries their name. Same rule as every
// other surface, and it is the one line that is never optional.
if (!card.a) { console.error(`  ${card.n} has no artist recorded — a promo carries the artwork, so it carries the name. Pick a credited card.`); process.exit(1); }

const n = (x) => x.toLocaleString("en-US");
const STATS = [[n(idx.length), "CARDS"], [n(new Set(idx.map(c => c.s)).size), "SETS"],
               [n(new Set(idx.map(c => c.a).filter(Boolean)).size), "ARTISTS"]];

const html = `<!doctype html><meta charset="utf-8"><title>Catch'em — promo</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<style>
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Sora:wght@300;600&family=JetBrains+Mono:wght@500&display=swap');
body{margin:0;background:#0a0c12;color:#e8ebf2;font:300 16px/1.6 'Sora',system-ui,sans-serif;
  padding:34px 22px 70px;text-align:center}
h1{font:800 26px 'Syne',system-ui,sans-serif;margin:0 0 6px}
.sub{color:#8a93a6;font-size:14.5px;margin:0 0 24px}
canvas{max-width:100%;border-radius:13px;border:1px solid #20252f}
button{background:#36d399;color:#0a0c12;border:0;border-radius:11px;padding:14px 26px;
  font:600 15.5px 'Sora',sans-serif;cursor:pointer;margin:20px 8px 0}
button.sec{background:transparent;color:#8a93a6;border:1px solid #20252f}
.msg{color:#5a6273;font:500 12.5px 'JetBrains Mono',monospace;margin-top:14px;min-height:18px}
</style>
<h1>${headline}</h1>
<p class="sub">${card.n} · ${card.s} · ${card.a}</p>
<canvas id="cv" width="1200" height="675"></canvas><br>
<button onclick="dl()">Download PNG</button>
<button class="sec" onclick="cp()">Copy</button>
<div class="msg" id="msg">rendering…</div>
<script>
const CARD = ${JSON.stringify(card)};
const STATS = ${JSON.stringify(STATS)};
const HEAD = ${JSON.stringify(headline)}, SUB = ${JSON.stringify(sub)}, KICK = ${JSON.stringify(kicker)};
const W = 1200, H = 675, PAD = 56;

const imgUrl = id => "https://images.pokemontcg.io/" + id.slice(0, id.lastIndexOf("-")) + "/" + id.slice(id.lastIndexOf("-") + 1) + "_hires.png";
const imgAlt = id => "https://images.scrydex.com/pokemon/" + id + "/large";

async function load(){
  for (const u of [imgUrl(CARD.i), imgAlt(CARD.i)]) {
    try {
      return await new Promise((res, rej) => {
        const im = new Image(); im.crossOrigin = "anonymous";
        im.onload = () => res(im); im.onerror = rej; im.src = u;
      });
    } catch {}
  }
  return null;
}

async function draw(){
  const cv = document.getElementById("cv"), g = cv.getContext("2d");
  g.fillStyle = "#0a0c12"; g.fillRect(0, 0, W, H);
  g.fillStyle = "#36d399"; g.fillRect(0, 0, W, 4);

  const img = await load();
  // NOTHING OVERLAPS THE ART. The moment text sits on the card it stops being
  // something somebody wants to look at and becomes a banner.
  const cardH = H - PAD * 2, cardW = Math.round(cardH * 745 / 1040);
  const cardX = W - PAD - cardW, cardY = PAD;
  if (img) {
    g.save();
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = 44; g.shadowOffsetY = 14;
    g.drawImage(img, cardX, cardY, cardW, cardH);
    g.restore();
  } else {
    g.fillStyle = "#171b25"; g.fillRect(cardX, cardY, cardW, cardH);
    g.fillStyle = "#5a6273"; g.font = "18px system-ui"; g.textAlign = "center";
    g.fillText("card art unavailable", cardX + cardW / 2, cardY + cardH / 2);
  }

  const L = PAD + 10, right = cardX - 44;
  g.textAlign = "left";
  g.fillStyle = "#36d399"; g.font = "500 19px ui-monospace,monospace";
  g.fillText(KICK, L, 116);
  g.fillStyle = "#e8ebf2"; g.font = "800 68px system-ui,sans-serif";
  // Wrap the headline rather than letting it run under the card.
  const words = HEAD.split(" "); let line = "", y = 210;
  for (const w of words) {
    if (g.measureText(line + w).width > right - L && line) { g.fillText(line.trim(), L, y); y += 74; line = w + " "; }
    else line += w + " ";
  }
  g.fillText(line.trim(), L, y);

  g.fillStyle = "#8a93a6"; g.font = "300 27px system-ui,sans-serif";
  g.fillText(SUB, L, y + 62);

  // Stats: the proof, in the monospace that reads as data without saying so.
  let sx = L;
  for (const [v, k] of STATS) {
    g.fillStyle = "#e8ebf2"; g.font = "500 34px ui-monospace,monospace";
    g.fillText(v, sx, H - 108);
    g.fillStyle = "#5a6273"; g.font = "500 14px ui-monospace,monospace";
    g.fillText(k, sx, H - 80);
    sx += Math.max(g.measureText(v).width, 150) + 46;
  }

  g.fillStyle = "#36d399"; g.font = "600 22px system-ui,sans-serif";
  g.fillText("catchemtcg.com", L, H - 40);
  // The artist credit, always. A promo carrying the artwork carries the name.
  g.fillStyle = "#5a6273"; g.font = "15px ui-monospace,monospace"; g.textAlign = "right";
  g.fillText(CARD.n + " · " + CARD.s + " · " + CARD.a, W - PAD, H - 22);

  document.getElementById("msg").textContent = img ? "ready — 1200x675" : "card art did not load; everything else drew";
}
draw();

const fname = "catchem-" + CARD.n.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
function dl(){ const a = document.createElement("a"); a.href = document.getElementById("cv").toDataURL("image/png"); a.download = fname; a.click(); }
async function cp(){
  try {
    const b = await new Promise(r => document.getElementById("cv").toBlob(r, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
    document.getElementById("msg").textContent = "copied — paste into the post";
  } catch (e) { document.getElementById("msg").textContent = "copy failed: " + e.message; }
}
window.dl = dl; window.cp = cp;
</script>`;

await writeFile(join(ROOT, "research/assets/promo.html"), html);
console.log(`✓ promo: ${card.n} · ${card.a} · 1200x675 · art untouched, credit on the frame`);
