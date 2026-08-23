// build-faq.mjs — gives faq.html an owner.
//
// The designer found it orphaned: created 20 August, written by no generator,
// linked from nothing, deployed nowhere. A page nothing owns cannot be
// maintained — every style fix applied at the source missed it, so it drifted
// daily and nobody could tell, because nobody could reach it either.
//
// DELETING IT WAS THE WRONG CALL. Its content is real and reader-facing: what
// the Sealed Index is, how berries are earned, why draws are provably fair,
// where the methodology lives. That is the page a stranger wants before they
// trust a number. It was not junk — it was unplugged.
//
// So the content moved to data/faq.json, which is EDITORIAL and hand-edited,
// and this renders it. The split matters: the words stay Tyler's, the styling
// becomes shared and fixable in one place, and the page now has exactly one
// writer — which is what the designer was asking for.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const faq = JSON.parse(await readFile(join(ROOT, "data/faq.json"), "utf-8"));

// ONE TYPE SCALE, deliberately. The designer's standing question across nine
// pages is whether near-identical sizes are steps or the same intent typed
// twice; on this page there are three sizes and each is a real step.
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catch'em — FAQ</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@800&family=Sora:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#0a0c12;--panel:#11141c;--line:#20252f;--text:#e8ebf2;--soft:#8a93a6;--live:#36d399}
*{box-sizing:border-box}
body{margin:0;background:var(--ink);color:var(--text);font:400 16px/1.65 'Sora',system-ui,sans-serif;padding:0 0 80px}
.wrap{max-width:720px;margin:0 auto;padding:0 22px}
h1{font:800 clamp(30px,5vw,44px)/1.05 'Syne',system-ui,sans-serif;letter-spacing:-.025em;margin:56px 0 12px}
.dim{color:var(--soft);font-size:15px;margin-bottom:34px}
.dim a{color:var(--live)}
details{border-bottom:1px solid var(--line);padding:16px 0}
summary{cursor:pointer;font-weight:600;font-size:16px;list-style:none}
summary::-webkit-details-marker{display:none}
summary:before{content:"+ ";color:var(--live);font-weight:700}
details[open] summary:before{content:"− "}
details p{color:var(--soft);font-size:15px;margin:12px 0 2px}
.foot{color:var(--soft);font-size:15px;margin-top:40px;border-top:1px solid var(--line);padding-top:20px}
.foot a{color:var(--live)}
</style>
<div class="wrap">
<h1>${esc(faq.title)}</h1>
<div class="dim">Tap any question. Deeper receipts live on the <a href="/methodology">methodology page</a>.</div>
${faq.entries.map(e => `<details><summary>${esc(e.q)}</summary><p>${esc(e.a)}</p></details>`).join("\n")}
<div class="foot">Still stuck? <a href="/creators">Build a post</a> or read <a href="/corrections">what we got wrong</a>.</div>
</div>
`;

await writeFile(join(ROOT, "research/assets/faq.html"), html);
console.log(`✓ faq: ${faq.entries.length} question(s) rendered from data/faq.json`);
