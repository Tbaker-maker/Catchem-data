// build-corrections.mjs — the public corrections page.
// POLICY (Tyler, Aug 21): the newsletter is about the market, not about
// us. Corrections do not headline. But they are never hidden either — a
// quiet edit is the one move that actually destroys trust. So every
// correction lives here: permanent, dated, findable, linked from the
// methodology page footer. Speak of ourselves in a capability voice (v9);
// this page is the receipt that the voice is earned.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

const log = await J("data/corrections-log.json") ?? { entries: [] };
const q = await J("data/quarantine.json") ?? { entries: [] };
const today = new Date().toISOString().slice(0, 10);

const rows = (log.entries || []).slice().sort((a, b) => a.date < b.date ? 1 : -1).map(e => `
  <div class="c">
    <div class="d">${esc(e.date)}${e.material ? ' <span class="chip m">AFFECTED A PUBLISHED NUMBER</span>' : ' <span class="chip i">CAUGHT BEFORE PUBLICATION</span>'}</div>
    <div class="w">${esc(e.what)}</div>
    <div class="f"><b>Fixed:</b> ${esc(e.fix)}</div>
    ${e.guard ? `<div class="f"><b>So it can't recur:</b> ${esc(e.guard)}</div>` : ""}
  </div>`).join("");

const held = (q.entries || []).map(e => `
  <div class="row"><span><b>${esc(e.id)}</b><em>${esc(e.reason)}</em></span><span class="mono">held since ${esc(e.since)}</span></div>`).join("");

const html = `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<title>Catch'em — Corrections</title><style>
body{background:#0b0d14;color:#f4f5f8;font:16px/1.62 Sora,system-ui,sans-serif;margin:0;padding:40px 18px;max-width:720px;margin-inline:auto}
h1{font:800 30px Syne,system-ui,sans-serif;margin:0 0 6px}
.lede{color:#98a1b5;font-size:15px;margin:0 0 30px}
h2{font:700 17px Syne,system-ui,sans-serif;color:#36d399;margin:34px 0 12px}
.c{background:#141824;border:1px solid rgba(255,255,255,.07);border-left:3px solid #64a0ff;border-radius:12px;padding:14px 16px;margin:12px 0}
.d{font:700 11px JetBrains Mono,monospace;color:#98a1b5;letter-spacing:.06em;margin-bottom:6px}
.w{font-size:15.5px;margin-bottom:8px}
.f{font-size:14px;color:#c7cbd6;margin-top:4px}
.chip{display:inline-block;font:700 9px JetBrains Mono,monospace;padding:2px 7px;border-radius:99px;border:1px solid;margin-left:6px;letter-spacing:.06em}
.m{color:#ffb84d;border-color:rgba(255,184,77,.5)}.i{color:#36d399;border-color:rgba(54,211,153,.45)}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:14.5px}
.row em{display:block;color:#98a1b5;font-style:normal;font-size:12.5px}
.mono{font-family:JetBrains Mono,monospace;color:#98a1b5;font-size:12.5px;white-space:nowrap}
.foot{margin-top:40px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07);font-size:13px;color:#5c637a}
a{color:#36d399;text-decoration:none}
</style>
<h1>Corrections</h1>
<p class="lede">Every number we publish is measured, and every measurement can be wrong. When one is, it gets fixed and it gets recorded here — dated, permanent, and findable. We don't do quiet edits.</p>

<h2>Currently held back</h2>
<p class="lede" style="margin-bottom:10px">Products our checks are holding out of published reads until they re-verify. They stay visible in the data; they just don't headline.</p>
${held || '<p class="lede">Nothing held right now.</p>'}

<h2>Correction log</h2>
${rows || '<p class="lede">No published corrections yet.</p>'}

<div class="foot">Updated ${today} · How our numbers are made: <a href="/methodology.html">methodology</a> · ⚡ Catch'em</div>`;

await writeFile(join(ROOT, "research/assets/corrections.html"), html);
console.log(`✓ corrections page: ${(log.entries || []).length} logged, ${(q.entries || []).length} currently held`);
