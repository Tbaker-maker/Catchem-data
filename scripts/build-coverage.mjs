// build-coverage.mjs — everything we track, in public.
//
// Nobody else in this hobby publishes their universe. Competitors show you a
// number and you have no idea what is behind it — which products, how many,
// how fresh, or what got excluded and why.
//
// Publishing the whole list is the cheapest trust we can buy: it is one page,
// it is generated from the same data the instruments run on so it cannot drift,
// and it makes every claim we make checkable by a stranger. It also documents
// what we DO NOT cover, which is the half most people leave out.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => { try { return JSON.parse(await readFile(join(ROOT, p), "utf-8")); } catch { return null; } };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");

const sp = await J("data/sealed-prices.json") ?? { products: [] };
const sg = await J("data/singles-prices.json") ?? { cards: [] };
const cat = await J("data/card-catalogue.json");
const q = await J("data/quarantine.json") ?? { entries: [] };
const der = await J("data/derived-insights.json") ?? {};
const held = new Set((q.entries ?? []).map(e => e.id));

const live = sp.products.filter(p => p.dataStatus === "live");
const SUBTYPE_NAME = { "booster-box": "Booster Boxes", "etb": "Elite Trainer Boxes", "pc-etb": "Pokémon Center ETBs",
  "booster-bundle": "Booster Bundles", "booster-pack": "Booster Packs", "upc": "Ultra Premium Collections",
  "special-collection": "Special Collections", "tin": "Tins" };

const groups = {};
for (const p of sp.products) (groups[p.subtype ?? "other"] ||= []).push(p);
const rows = Object.entries(groups).sort((a, b) => b[1].length - a[1].length).map(([sub, items]) => {
  const liveN = items.filter(p => p.dataStatus === "live").length;
  const list = items.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => {
    const status = held.has(p.id) ? `<span class="held">held</span>`
      : p.dataStatus !== "live" ? `<span class="held">no data</span>`
      : `<b>$${(p.priceMedian ?? 0).toLocaleString("en-US")}</b>`;
    const depth = p.listingCount ? `<i>${p.listingCount} listings</i>` : "";
    return `<tr><td>${esc(p.name)}</td><td>${status}</td><td>${depth}</td></tr>`;
  }).join("");
  return `<h3>${SUBTYPE_NAME[sub] ?? esc(sub)} <span class="dim">${liveN} priced of ${items.length}</span></h3>
<table>${list}</table>`;
}).join("\n");

const html = `<!doctype html><meta charset="utf-8"><title>What Catch'em tracks</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#070910;--surf:#0f1219;--ink:#e9ecf3;--dim:#8b93a7;--green:#36d399;--line:rgba(255,255,255,.07)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif;padding:32px 20px 80px}
.wrap{max-width:860px;margin:0 auto}h1{font-size:30px;margin:0 0 6px}h2{font-size:21px;margin:38px 0 10px}
h3{font-size:15px;margin:26px 0 8px;letter-spacing:.4px;text-transform:uppercase;color:var(--dim)}
p{color:#c3cad8;margin:10px 0}.dim{color:var(--dim);font-weight:400;text-transform:none;letter-spacing:0}
table{width:100%;border-collapse:collapse;font-size:14px;background:var(--surf);border:1px solid var(--line);border-radius:10px;overflow:hidden}
td{padding:8px 12px;border-bottom:1px solid var(--line)}tr:last-child td{border:0}
td:nth-child(2){text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
td:nth-child(3){text-align:right;white-space:nowrap;color:var(--dim);font-size:12.5px;width:96px}
i{font-style:normal}.held{color:var(--dim);font-size:12.5px}
.stat{display:inline-block;background:var(--surf);border:1px solid var(--line);border-radius:9px;padding:9px 14px;margin:0 8px 8px 0}
.stat b{display:block;font-size:21px;color:var(--green)}.stat i{font-style:normal;color:var(--dim);font-size:12.5px}
.note{border-left:3px solid var(--green);background:var(--surf);padding:12px 16px;border-radius:0 10px 10px 0;margin:18px 0}
a{color:var(--green)}
</style>
<div class="wrap">
<h1>Everything we track</h1>
<p class="dim">Generated ${new Date().toISOString().slice(0, 10)} from the same file the instruments read, so this page cannot drift from what the numbers actually cover.</p>

<div>
<span class="stat"><b>${sp.products.length}</b><i>sealed products tracked</i></span>
<span class="stat"><b>${live.length}</b><i>priced today</i></span>
<span class="stat"><b>${(sg.cards ?? []).filter(c => c.priceMarket).length}</b><i>single cards priced</i></span>
${cat ? `<span class="stat"><b>${Object.keys(cat.cards ?? {}).length.toLocaleString("en-US")}</b><i>cards in the catalogue</i></span>` : ""}
</div>

<div class="note"><b>Why publish this at all?</b><br>
Most tools show you a number and never tell you what is behind it. If we say the sealed market moved, you should be able to see exactly which products we asked, how many answered, and which ones we are deliberately holding back. A number whose universe is secret is a number you have to take on faith, and we would rather not ask for faith.</div>

<h2>What we do not cover</h2>
<p>Just as important, and usually left out. We do not track: graded cards of any kind, Japanese product, most singles (we price ${(sg.cards ?? []).filter(c => c.priceMarket).length} of ${cat ? Object.keys(cat.cards ?? {}).length.toLocaleString("en-US") : "thousands"} catalogued), anything sold outside eBay and TCGplayer, or completed private sales. Products marked <span class="held">held</span> are ones we have data for and are choosing not to publish, usually because the number failed a check.</p>

<h2>Sealed products</h2>
${rows}

<h2>Where the numbers come from</h2>
<p>Sealed prices come from live eBay listings, as delivered totals — item plus postage wherever a listing states one. Single pack prices come from TCGplayer, which is the deeper venue for that class; their listing counts still come from eBay, so a pack row shows a price from one marketplace beside a depth from another, and we label it rather than pretend they match.
Tax is never included anywhere. Full method on the <a href="/methodology.html">methodology page</a>, and everything we have got wrong is on the <a href="/corrections.html">corrections page</a>.</p>
</div>`;

await writeFile(join(ROOT, "research/assets/coverage.html"), html);
console.log(`✓ coverage page: ${sp.products.length} sealed products, ${Object.keys(groups).length} classes, ${held.size} held → research/assets/coverage.html`);
