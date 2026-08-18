// scripts/compute-derived.mjs — Derived Intelligence, layer 1
// (a) PACK MATH: price-per-sealed-pack across comparable SKUs. Arithmetic on
//     today's ask medians — no history needed, no estimation. Era-aware pack
//     counts; products with variable counts are excluded BY NAME with reasons.
// (b) NARRATIVE vs TAPE: cross-references the intelligence agent's latest
//     digest against tracker sets — what's talked-about vs what's moving.
// Output: data/derived-insights.json. Trust: every number traceable to inputs.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async p => JSON.parse(await readFile(join(ROOT,p),"utf-8"));

const sp = await J("data/sealed-prices.json");
let div = { rows: [] }; try { div = await J("data/divergence-report.json"); } catch {}
const spreadBy = new Map(div.rows.map(r=>[r.id, r]));

// ── (a) Pack Math ────────────────────────────────────────────────────────────
function packsFor(p) {
  const era = /^me/.test(p.setId||"") ? "me" : /^sv/.test(p.setId||"") ? "sv" : /^swsh/.test(p.setId||"") ? "swsh" : null;
  if ((p.setId||"") === "cel25") return null;            // Celebrations: 4-card mini packs, not comparable (KB #5 adjacency)
  if (p.subtype === "booster-box") return 36;
  if (p.subtype === "booster-bundle") return 6;
  if (p.subtype === "etb" || p.subtype === "pc-etb") return era === "swsh" ? 8 : (era ? 9 : null);
  return null;                                            // upc/premium/tins: counts vary — excluded honestly
}
const packRows = sp.products
  .filter(p=>p.dataStatus==="live" && p.priceMedian)
  .map(p=>({ p, packs: packsFor(p) }))
  .filter(x=>x.packs)
  .map(({p,packs})=>({ id: p.id, name: p.name, subtype: p.subtype,
    price: p.priceMedian, packs, perPack: Math.round(p.priceMedian/packs*100)/100,
    listings: p.listingCount ?? null }))
  .sort((a,b)=>b.perPack-a.perPack);

// ── (b) Narrative vs Tape ────────────────────────────────────────────────────
let digestText = "", digestName = null;
try {
  const dir = join(ROOT,"research","digests");
  const files = (await readdir(dir)).filter(f=>f.endsWith(".md")).sort();
  digestName = files[files.length-1] || null;
  if (digestName) digestText = (await readFile(join(dir,digestName),"utf-8")).toLowerCase();
} catch {}
const bySet = new Map();
for (const p of sp.products) {
  if (!bySet.has(p.set)) bySet.set(p.set, []);
  bySet.get(p.set).push(p);
}
const inNews = [], quietMovers = [];
for (const [setName, prods] of bySet) {
  const mentioned = digestText && setName && digestText.includes(setName.toLowerCase());
  const flag = prods.map(p=>spreadBy.get(p.id)).find(s=>s?.signal);
  const flagship = prods.filter(p=>p.dataStatus==="live" && p.priceMedian)
                        .sort((a,b)=>b.priceMedian-a.priceMedian)[0];
  if (!flagship) continue;
  if (mentioned) {
    inNews.push({ set: setName, flagship: flagship.name, price: flagship.priceMedian,
      listings: flagship.listingCount ?? null,
      spreadPct: spreadBy.get(flagship.id)?.spreadPct ?? null, signal: !!flag });
  } else if (flag) {
    // Surface the SIGNALING product itself, not the set's flagship
    const sigProd = sp.products.find(p=>p.id===flag.id);
    quietMovers.push({ set: setName, flagship: sigProd?.name || flag.name, price: flag.ebayAskMedian,
      listings: flag.ebayListings ?? null, spreadPct: flag.spreadPct, signal: true });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  method: "Pack Math: ask median / era-aware pack count (arithmetic, no estimation; variable-count products excluded by name). Narrative: latest agent digest cross-referenced against tracked sets; 'quiet movers' = spread signal with zero digest mention.",
  digestUsed: digestName,
  packMath: { priciest: packRows.slice(0,6), cheapest: [...packRows].reverse().slice(0,6) },
  narrative: { inNews: inNews.slice(0,6), quietMovers: quietMovers.slice(0,6) },
};
await writeFile(join(ROOT,"data/derived-insights.json"), JSON.stringify(out,null,2)+"\n");
console.log(`✓ derived: ${packRows.length} pack-math rows · news-mentioned sets: ${inNews.length} · quiet movers: ${quietMovers.length} (digest: ${digestName})`);
console.log("  priciest pack:", packRows[0]?.name, "$"+packRows[0]?.perPack+"/pack");
console.log("  cheapest pack:", packRows[packRows.length-1]?.name, "$"+packRows[packRows.length-1]?.perPack+"/pack");
