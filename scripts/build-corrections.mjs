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
import { headerHtml, footerHtml, chromeCss, FONTS, stampLabel } from "./lib/public-chrome.mjs";
import { freshnessFromReport } from "./lib/freshness.mjs";
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

const fresh = freshnessFromReport(await J("data/ppt/run-report.json"));
const when = fresh.at ? stampLabel(fresh.at) : `Updated ${today}`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="${FONTS}" rel="stylesheet">
<title>Catch'em — Corrections</title><style>
:root{--bg:#12100e;--panel:#1a1815;--line:#2f2b26;--txt:#efe9de;--dim:#b3aa9c;--faint:#9a9184;--gold:#d9b779;--green:#7fc79a;--serif:'Fraunces',Georgia,serif;--sans:'IBM Plex Sans',system-ui,sans-serif}
*{box-sizing:border-box;margin:0}html,body{overflow-x:hidden}body{background:var(--bg);color:var(--txt);font:16px/1.65 var(--sans)}
${chromeCss}
main.col{max-width:720px;margin:0 auto;padding:28px 18px 12px}
h1{font:500 34px/1.15 var(--serif);margin:0 0 8px}
.lede{color:var(--dim);font-size:15px;margin:0 0 22px}
h2{font:500 22px/1.2 var(--serif);color:var(--gold);margin:28px 0 10px}
.c{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:12px;padding:14px 16px;margin:12px 0}
.d{font:600 12px/1 var(--sans);color:var(--dim);letter-spacing:.04em;margin-bottom:6px}
.w{font-size:15.5px;margin-bottom:8px}
.f{font-size:14px;color:var(--dim);margin-top:4px}
.chip{display:inline-block;font:600 10px/1 var(--sans);padding:3px 7px;border-radius:99px;border:1px solid;margin-left:6px;letter-spacing:.04em}
.m{color:var(--gold);border-color:var(--gold)}.i{color:var(--green);border-color:var(--green)}
.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14.5px;min-width:0}
.row span{min-width:0}
.row em{display:block;color:var(--dim);font-style:normal;font-size:12.5px}
.mono{color:var(--dim);font-size:12.5px;white-space:nowrap}
a{color:var(--gold)}
</style></head><body>
${headerHtml("")}
<main class="col">
<h1>Corrections</h1>
<p class="lede">Every number we publish is measured, and every measurement can be wrong. When one is, it gets fixed and it gets recorded here — dated, permanent, and findable. We don't do quiet edits.</p>
<p class="lede">${when}</p>

<h2>Currently held back</h2>
<p class="lede" style="margin-bottom:10px">Products our checks are holding out of published reads until they re-verify. They stay listed. They just don't headline.</p>
${held || '<p class="lede">Nothing held right now.</p>'}

<h2>Correction log</h2>
${rows || '<p class="lede">No published corrections yet.</p>'}
</main>
${footerHtml()}
</body></html>`;

await writeFile(join(ROOT, "research/assets/corrections.html"), html);
console.log(`✓ corrections page: ${(log.entries || []).length} logged, ${(q.entries || []).length} currently held`);
