// mint-cards.mjs — daily share-card mint + public methodology page.
// Invoked by generate-pulse.mjs after the feed is written. Cards land in
// research/pulse/cards/ (CI-committed path). Watermark law: ⚡ Catch'em +
// date + provenance chip on every asset. Voice v4/v5 apply.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT, p), "utf-8"));

const der = await J("data/derived-insights.json");
const sp = await J("data/sealed-prices.json");
let cm = { entries: [] }; try { cm = await J("data/crosscheck-id-map.json"); } catch {}
let sg = { cards: [] }; try { sg = await J("data/singles-prices.json"); } catch {}
const tcgId = {}; for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) tcgId[e.id] = e.tcgPlayerId;
const prodImg = id => tcgId[id] ? `https://tcgplayer-cdn.tcgplayer.com/product/${tcgId[id]}_in_400x400.jpg`
  : (sp.products.find(p => p.id === id) || {}).image || "";
const cardImg = cid => { const m = /^(.+)-(\w+)$/.exec(cid || ""); return m ? `https://images.pokemontcg.io/${m[1]}/${m[2]}.png` : ""; };
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const today = new Date().toISOString().slice(0, 10);

function card({ label, title, hero, heroColor, sub, why, img, chip, wide }) {
  const W = 1200, H = 675; // share-ready 16:9
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Sora,system-ui,sans-serif">
<rect width="${W}" height="${H}" fill="#0b0d14"/>
<rect x="36" y="36" width="${W - 72}" height="${H - 72}" rx="28" fill="#141824" stroke="rgba(255,255,255,0.07)"/>
${img ? `<image href="${esc(img)}" x="72" y="120" width="${wide ? 320 : 300}" height="${wide ? 320 : 418}" preserveAspectRatio="xMidYMid meet"/>` : ""}
<text x="430" y="140" fill="#8a93a8" font-size="26" letter-spacing="4" font-weight="600">${esc(label)}</text>
<text x="${W - 90}" y="140" text-anchor="end" fill="${chip === "VERIFIED" ? "#36d399" : "#8a93a8"}" font-size="24" font-weight="700">${esc(chip)}</text>
<text x="430" y="205" fill="#f4f5f8" font-size="44" font-weight="700">${esc(title)}</text>
<text x="430" y="330" fill="${heroColor}" font-size="104" font-weight="800" font-family="JetBrains Mono,monospace">${esc(hero)}</text>
<text x="430" y="392" fill="#8a93a8" font-size="30">${esc(sub)}</text>
<foreignObject x="430" y="420" width="${W - 520}" height="150"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#8a93a8;font-size:26px;line-height:1.5;font-family:Sora,system-ui,sans-serif">${esc(why)}</div></foreignObject>
<text x="72" y="${H - 66}" fill="#36d399" font-size="30" font-weight="800">⚡ Catch'em</text>
<text x="${W - 90}" y="${H - 66}" text-anchor="end" fill="#5c637a" font-size="24" font-family="JetBrains Mono,monospace">${today} · catchemtcg.com</text>
</svg>`;
}

await mkdir(join(ROOT, "research/pulse/cards"), { recursive: true });
const t3 = der.dailyThree || {};
const six = der.sealedIndex || null;
const minted = [];
async function mint(name, svg) {
  await writeFile(join(ROOT, `research/pulse/cards/${today}-${name}.svg`), svg);
  await writeFile(join(ROOT, `research/pulse/cards/latest-${name}.svg`), svg);
  minted.push(name);
}
if (six) await mint("index", card({ label: "CATCH'EM SEALED INDEX", title: `${six.constituents} sealed products, one number`,
  hero: String(six.level), heroColor: "#36d399",
  sub: six.ddPct != null ? `${six.ddPct > 0 ? "▲" : "▼"} ${Math.abs(six.ddPct)}% vs yesterday · breadth ▲${six.breadth.up} ▼${six.breadth.down}` : `baseline 100 · breadth ▲${six.breadth.up} ▼${six.breadth.down}`,
  why: `${six.constituents} boxes, one honest number. 100 was the starting line. Today: ${six.breadth.up} boxes raised their hand and said "I went up" — ${six.breadth.down} said "I went down." Full story: catchemtcg.com/methodology`, chip: "VERIFIED", wide: true }));
if (t3.sealed) { const r = t3.sealed; const pid = (sp.products.find(p => p.name === r.name) || {}).id;
  await mint("sealed", card({ label: "SEALED · DAILY WATCH", title: r.name, hero: `$${Math.round(r.ebay).toLocaleString("en-US")}`,
    heroColor: "#f4f5f8", sub: `eBay asks ${Math.abs(r.spreadPct)}% ${r.spreadPct > 0 ? "more" : "less"} than TCGplayer · ${r.listings} listings`,
    why: r.explain || r.reason, img: prodImg(pid), chip: "VERIFIED", wide: true })); }
if (t3.graded) { const g = t3.graded; const gc = (sg.cards || []).find(c => (c.watchLabel || c.name || "").includes((g.name || "").split(" (")[0]));
  await mint("graded", card({ label: "GRADED · DAILY WATCH", title: g.name, hero: `+$${Math.round(g.premium).toLocaleString("en-US")}`,
    heroColor: "#c77dff", sub: `raw $${Math.round(g.raw).toLocaleString("en-US")} → PSA 10 sold $${Math.round(g.psa10).toLocaleString("en-US")}`,
    why: g.explain || g.reason, img: gc ? cardImg(gc.cardId) : "", chip: "VERIFIED" })); }
if (t3.raw) { const r = t3.raw; const rc = (sg.cards || []).find(c => c.name === r.name || (c.watchLabel || "").includes(r.name));
  await mint("raw", card({ label: "RAW · DAILY WATCH", title: `${r.name} · ${r.set}`, hero: `$${Math.round(r.price).toLocaleString("en-US")}`,
    heroColor: "#f4f5f8", sub: "the chase inside a set that moved without headlines",
    why: r.explain || r.reason, img: rc ? cardImg(rc.cardId) : "", chip: "READ" })); }

// ── Public methodology page — the receipts pillar, one URL ──────────────
const M = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Sora:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<title>Catch'em — Methodology</title><style>
body{background:#0b0d14;color:#f4f5f8;font:16px/1.65 'Sora',system-ui,sans-serif;margin:0;padding:40px 18px;max-width:760px;margin-inline:auto}
h1{font-family:'Syne';font-size:34px;margin:0 0 6px}h2{font-family:'Syne';font-size:21px;margin:34px 0 8px;color:#36d399}
p{color:#c7cbd6;margin:8px 0}.dim{color:#8a93a8;font-size:14px}b.mono{font-family:'JetBrains Mono'}
.law{background:#141824;border:1px solid rgba(255,255,255,.07);border-left:3px solid #ffb84d;border-radius:10px;padding:12px 16px;margin:14px 0;font-size:14.5px;color:#c7cbd6}
</style>
<h1>How our numbers are made</h1><p class="dim">Every figure on Catch'em carries a chip — <b style="color:#36d399">VERIFIED</b> (measured from listings) or <b>READ</b> (our interpretation, always with a stated way to prove it wrong). This page is the receipts. Updated ${today}.</p>
<h2>The Catch'em Sealed Index</h2>
<div class="law" style="border-left-color:#36d399"><b>The five-year-old version 🍭</b><br>
Imagine a shelf with 153 Pokémon boxes. Every morning we check every price, then squish them into <b>one magic number</b>. On day one we called it <b class="mono">100</b> — the starting line. Every day, each box answers one question: <i>am I worth more or less than when we started?</i> We average the answers. <b class="mono">100.6</b> means the shelf is worth a tiny bit more than at the start. And each box only competes against <i>itself</i> — the $2,900 box and the $99 box each get one vote, so no giant box can hog the number. <b>Breadth</b> just counts hands: today 42 boxes said "I went up," 4 said "I went down." Sunny day on the shelf.</div>
<p>The grown-up version: equal-weight composite: every tracked sealed product's price today divided by its own first clean-history price, averaged, times 100. Baseline era began <b class="mono">2026-08-18</b> — the day our BIN-only, delivered-price methodology went live. Breadth counts how many products rose vs fell day-over-day. Composition changes don't distort the level because each product is measured against itself.</p>
<h2>Prices</h2><p>Sealed prices are eBay asking medians: Buy-It-Now listings only, delivered price (item + shipping where stated), scam-vocabulary filtered, bounded per product class, with a clean-floor figure that ignores implausible outliers. We do not have sold-price data and we don't pretend to.</p>
<h2>Buy Pressure (est.)</h2><p>Estimated from listing-count changes — inventory draining or building. It is not reported sales; nobody outside the marketplaces has real sales data, and we say so.</p>
<h2>The Spread</h2><p>eBay ask vs TCGplayer market, per product. eBay normally runs a little higher on sealed — photos let buyers see exactly what they're getting — so the resting +5–15% is structural, not a signal. We flag beyond it, and negative gaps read stronger.</p>
<div class="law">Venue law: Sun &amp; Moon and older sealed rarely trades on TCGplayer — that market lives on eBay, card shows, and collector groups. For those eras we publish eBay-native stats only and gate the cross-market comparison entirely.</div>
<h2>House reads &amp; falsifiers</h2><p>Interpretations (reprint cycles, depth reads, the PSA-9 tax) publish with the condition that would prove them wrong, and when a falsifier trips we amend in public. Being seen self-correcting is the point.</p>
<p class="dim" style="margin-top:36px">⚡ Catch'em · questions → support@catchemtcg.com</p>`;
await writeFile(join(ROOT, "research/assets/methodology.html"), M);
console.log(`✓ minted ${minted.length} cards (${minted.join(", ")}) + methodology.html`);
