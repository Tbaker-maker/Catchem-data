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
const sgAll = await J("data/singles-prices.json").catch(()=>null) ?? { cards: [] };
let enr = null; try { enr = await J("data/singles-enrichment.json"); } catch {}
let hh = []; try { hh = await J("data/heat-history.json"); } catch {}
let relDates = {}; try { relDates = (await J("data/set-release-dates.json")).dates ?? {}; } catch {}

// ── (a) Pack Math ────────────────────────────────────────────────────────────
function packsFor(p) {
  const era = /^me/.test(p.setId||"") ? "me" : /^sv/.test(p.setId||"") ? "sv" : /^swsh/.test(p.setId||"") ? "swsh" : null;
  if ((p.setId||"") === "cel25") return null;            // Celebrations: 4-card mini packs, not comparable (KB #5 adjacency)
  if (p.subtype === "booster-pack") return 1;
  if (p.subtype === "booster-box") return 36;
  if (p.subtype === "booster-bundle") return 6;
  if (p.subtype === "etb" || p.subtype === "pc-etb") return era === "swsh" ? 8 : (era ? 9 : null);
  return null;                                            // upc/premium/tins: counts vary — excluded honestly
}
const packRows = sp.products
  .filter(p=>p.dataStatus==="live" && p.priceMedian)
  .map(p=>({ p, packs: packsFor(p) }))
  .filter(x=>x.packs)
  .map(({p,packs})=>({ id: p.id, name: p.name, subtype: p.subtype, setId: p.setId,
    price: p.priceMedian, packs, perPack: Math.round(p.priceMedian/packs*100)/100,
    listings: p.listingCount ?? null }))
  .sort((a,b)=>b.perPack-a.perPack);
// Loose-pack anchor per set → signed sealed premium on every multi-pack row
const loosePackBySet = {};
for (const r of packRows) if (r.subtype === "booster-pack") loosePackBySet[r.setId] = r.perPack;
for (const r of packRows) {
  if (r.subtype === "booster-pack") { r.role = "loose-anchor"; continue; }
  const lp = loosePackBySet[r.setId];
  r.loosePack = lp ?? null;
  r.sealedPremiumPct = lp ? Math.round((r.perPack/lp - 1) * 1000)/10 : null;
}

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


// ── (c) CATALYST CLASSIFIER v1 — bullish/bearish reads on the news layer ──
// Keyword taxonomy over latest digest + radar. Emits READ-class tags with
// horizon + house-thesis links (research/house-theses.md). Never advice.
const TAXONOMY = [
  { k:["reprint","reprinted","back in print","restock wave","second wave","print run"],
    cls:"bullish", horizon:"long", thesis:"RT-1", note:"reprint = short-term supply, long-term demand (RT-1)" },
  { k:["tin","bundle","collection box","injection"], cls:"mixed", horizon:"short", thesis:"RT-2",
    note:"supply injection — absorb-or-stall watch (RT-2)" },
  { k:["rotation","rotates","regulation mark"], cls:"bearish", horizon:"short", thesis:null,
    note:"format rotation — competitive demand shifts off rotated sets" },
  { k:["anniversary","30th","celebration","special set"], cls:"bullish", horizon:"long", thesis:null,
    note:"franchise moment — demand catalyst" },
  { k:["ban","errata","recall"], cls:"bearish", horizon:"short", thesis:null, note:"negative shock class" },
  { k:["grading price","psa price","fee increase","turnaround"], cls:"mixed", horizon:"short", thesis:null,
    note:"grading-economics shift — premium math moves" },
];
const catalysts = [];
if (digestText) {
  for (const t of TAXONOMY) {
    for (const kw of t.k) {
      const i = digestText.indexOf(kw);
      if (i >= 0) {
        const ctx = digestText.slice(Math.max(0,i-60), i+90).replace(/\s+/g," ").trim();
        catalysts.push({ trigger: kw, class: t.cls, horizon: t.horizon,
          thesis: t.thesis, note: t.note, context: "…"+ctx+"…", provenance: `digest ${digestName}`, chip:"READ" });
        break;
      }
    }
  }
}


// ── (d) DEPTH READS — RT-3 matrix on the deepest markets ─────────────────
// Active Listings (measured) × listing-delta flow (Buy Pressure est.).
// Reads unlock per-product at 3+ clean snapshot days; calibrating until.
const CLEAN_CUT = "2026-08-18";
const liveList = sp.products.filter(p=>p.dataStatus==="live" && p.listingCount);
const counts = liveList.map(p=>p.listingCount).sort((a,b)=>a-b);
const q3 = counts[Math.floor(counts.length*0.75)] ?? 0;
function flowFor(id){
  const rows = hh.filter(r=>r.id===id && r.date>=CLEAN_CUT).sort((a,b)=>a.date<b.date?-1:1);
  if (rows.length < 3) return { state:"calibrating", days: rows.length };
  const a = rows[0].listingCount, b = rows[rows.length-1].listingCount;
  if (!a) return { state:"calibrating", days: rows.length };
  const d = (b-a)/a;
  return { state: d <= -0.05 ? "draining" : d >= 0.05 ? "building" : "flat", pct: Math.round(d*100), days: rows.length };
}
const depthReads = [...liveList].sort((a,b)=>b.listingCount-a.listingCount).slice(0,6).map(p=>{
  const f = flowFor(p.id);
  const hiS = p.listingCount >= q3;
  let read, tag;
  if (f.state==="calibrating") { read = `flow calibrating — day ${f.days}/3`; tag = "⏳"; }
  else if (hiS && f.state==="building") { read = "pile-up — supply outpacing demand est. (RT-3)"; tag = "⚠"; }
  else if (hiS && f.state==="draining") { read = "deep & moving — churn; historically reversal-prone (RT-3)"; tag = "🌊"; }
  else if (hiS) { read = "holding pattern — deep, flow flat"; tag = "⏸"; }
  else if (f.state==="draining") { read = "thinning fast — scarcity forming"; tag = "📉"; }
  else if (f.state==="building") { read = "restocking or interest fading — context decides"; tag = "❓"; }
  else { read = "quiet depth"; tag = "·"; }
  return { id:p.id, name:p.name, listings:p.listingCount, price:p.priceMedian,
    flow:f.state, flowPct:f.pct??null, flowDays:f.days??null, supplyTier: hiS?"high":"mid",
    tag, read, chip:"READ" };
});


// ── (e) LIFECYCLE — print-phase EST + rotation context (Doctrine block) ──
const NOW = new Date();
function lifecycleFor(p){
  const rel = p.releaseDate || relDates[p.setId] || null;
  if (!rel) return null;
  const months = Math.floor((NOW - new Date(rel)) / (30.44*86400000));
  let phase, tag;
  if (months <= 12) { phase = "active print"; tag = "🖨"; }
  else if (months <= 30) { phase = "late print — reprint waves typical"; tag = "🖨⏳"; }
  else { phase = "likely EOL — supply fixed (est.)"; tag = "📦🔒"; }
  return { setId: p.setId, ageMonths: months, phase, tag, chip: "READ",
    note: months > 30 ? "RT-1 cycle territory: supply now finite" : null };
}
const lifecycle = {};
for (const p of liveList) if (!lifecycle[p.setId]) { const L = lifecycleFor(p); if (L) lifecycle[p.setId] = L; }
const rotationContext = { nextInPerson: "2027-04 (est. — annual April cadence)",
  note: "rotation = demand-side for competitive staples; legality mark map lands via enrichment pass" };

const out = {
  generatedAt: new Date().toISOString(),
  method: "Pack Math: ask median / era-aware pack count (arithmetic, no estimation; variable-count products excluded by name). Narrative: latest agent digest cross-referenced against tracked sets; 'quiet movers' = spread signal with zero digest mention.",
  digestUsed: digestName,
  packMath: { priciest: packRows.slice(0,6), cheapest: [...packRows].reverse().slice(0,6) },
  narrative: { inNews: inNews.slice(0,6), quietMovers: quietMovers.slice(0,6) },
  catalysts,
  depthReads,
  lifecycle, rotationContext,
  dailyThree: (() => {
    const sealedPick = (div.rows||[]).filter(r=>r.signal).sort((a,b)=>Math.abs(b.spreadPct)-Math.abs(a.spreadPct))[0] || null;
    let gradedPick = null;
    {
      const g = ((enr&&enr.cards)||[]).filter(c=>c.psa10&&c.raw).map(c=>({...c, premium: Math.round((c.psa10-c.raw-79.99)*100)/100}))
                 .sort((a,b)=>b.premium-a.premium)[0];
      if (g) gradedPick = { name:g.name, raw:g.raw, psa10:g.psa10, premium:g.premium, chip:"VERIFIED",
        reason:`widest Grading Premium on the board (+$${g.premium} after $79.99 floor)` };
    }
    // RAW = singles only. v1 heuristic: a confirmed chase from a set the
    // tape flagged (quiet-mover first, then in-news); fallback = top chase.
    let rawPick = null;
    {
      const chases = (sgAll.cards||[]).filter(c=>!c.needsReview && c.dataStatus==="live" && c.priceMarket);
      const flaggedSets = [...quietMovers.map(q=>q.set), ...inNews.map(n=>n.set)];
      let pick = null, why = "";
      for (const fs of flaggedSets) {
        pick = chases.filter(c=>c.setName===fs).sort((a,b)=>b.priceMarket-a.priceMarket)[0];
        if (pick) { why = `the chase inside ${fs} — a set the tape flagged today`; break; }
      }
      if (!pick && chases.length) { pick = [...chases].sort((a,b)=>b.priceMarket-a.priceMarket)[0]; why = "chase-board anchor — the raw single the market prices everything against"; }
      if (pick) rawPick = { name: pick.name, set: pick.setName, price: pick.priceMarket, chip:"READ", reason: why };
    }
    return {
      sealed: sealedPick ? { name: sealedPick.name, ebay: sealedPick.ebayAskMedian, tcg: sealedPick.tcgMarket,
        spreadPct: sealedPick.spreadPct, listings: sealedPick.ebayListings, chip:"VERIFIED",
        reason:"strongest cross-market divergence today" } : null,
      graded: gradedPick, // null until Premium table exists — the slot says so honestly
      raw: rawPick,
      disclosure: "Daily watches, not calls. READ = our interpretation; you decide.",
    };
  })(),
};
await writeFile(join(ROOT,"data/derived-insights.json"), JSON.stringify(out,null,2)+"\n");
console.log(`✓ derived: ${packRows.length} pack-math rows · news-mentioned sets: ${inNews.length} · quiet movers: ${quietMovers.length} (digest: ${digestName})`);
console.log("  priciest pack:", packRows[0]?.name, "$"+packRows[0]?.perPack+"/pack");
console.log("  cheapest pack:", packRows[packRows.length-1]?.name, "$"+packRows[packRows.length-1]?.perPack+"/pack");
