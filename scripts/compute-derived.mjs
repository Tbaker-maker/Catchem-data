// scripts/compute-derived.mjs — Derived Intelligence, layer 1
// (a) PACK MATH: price-per-sealed-pack across comparable SKUs. Arithmetic on
//     today's ask medians — no history needed, no estimation. Era-aware pack
//     counts; products with variable counts are excluded BY NAME with reasons.
// (b) NARRATIVE vs TAPE: cross-references the intelligence agent's latest
//     digest against tracker sets — what's talked-about vs what's moving.
// Output: data/derived-insights.json. Trust: every number traceable to inputs.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { indexLevel, sealedPremium } from "./lib/instruments.mjs";
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
// SEASONING RULE (Tyler, Aug 20): new sets sit out their first 90 days —
// release hype is not market weather. S&P-style eligibility window.
const SEASONING_DAYS = 90;
const seasoned = p => { const rd = relDates[p.setId]; if (!rd) return true;
  return (Date.now() - new Date(rd).getTime()) / 86400000 >= SEASONING_DAYS; };
let setMarks = {}; try { setMarks = (await J("data/set-marks.json")).marks ?? {}; } catch {}
const LEGAL_MARKS = ["I","J"]; // per rotation state Aug 2026; review at next April rotation

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
const loosePackNBySet = {}, loosePackVenue = {};
const tcgPack = new Map((div.rows||[]).filter(r=>r.id.endsWith("-pack") && r.tcgMarket).map(r=>[r.id.replace(/-pack$/,""), r.tcgMarket]));
for (const r of packRows) if (r.subtype === "booster-pack") {
  const tcg = tcgPack.get(r.setId);
  // RT-4b: sealed packs are commodities — no photo premium justification;
  // TCGplayer is the accurate per-pack venue. Prefer it when mapped.
  loosePackBySet[r.setId] = tcg ?? r.perPack;
  loosePackVenue[r.setId] = tcg ? "tcg" : "ebay";
  loosePackNBySet[r.setId] = r.listings ?? null;
}
for (const r of packRows) {
  if (r.subtype === "booster-pack") { r.role = "loose-anchor"; continue; }
  const lp = loosePackBySet[r.setId];
  r.loosePack = lp ?? null;
  r.loosePackN = loosePackNBySet[r.setId] ?? null;
  r.premiumBasis = loosePackVenue[r.setId] ?? null;
  const prem = sealedPremium(r.perPack, lp, r.loosePackN); // lib canon, CI-tested
  r.sealedPremiumPct = prem.pct;
  r.premiumThin = prem.thin;
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
// Union with the durable quarantine file: the fetch rebuild wipes
// publishBlock and qa-gate runs later (inside generate-pulse), so at this
// point flags alone are empty — the 2026-08-22 PGO-ETB leak (publish-guard).
const { loadBlocked } = await import("./lib/publish-guard.mjs");
const __q = await loadBlocked();
const blockedIds = new Set([...(sp.products||[]).filter(p=>p.publishBlock).map(p=>p.id), ...__q.ids]);
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
  if (months <= 12) { phase = "reads as active print — supply still arriving on the 30-month model"; tag = "🖨"; }
  else if (months <= 30) { phase = "late print — reprint waves typical"; tag = "🖨⏳"; }
  else { phase = "reads as likely EOL — supply looks fixed on the model (est.)"; tag = "📦🔒"; }
  const mark = setMarks[p.setId] ?? null;
  const legal = mark ? LEGAL_MARKS.includes(mark) : null;
  return { setId: p.setId, ageMonths: months, phase, tag, chip: "READ",
    mark, standardLegal: legal,
    legalTag: mark ? (legal ? `⚖ ${mark} · Standard-legal` : `${mark} · rotated`) : "pre-mark era",
    note: months > 30 ? "RT-1 cycle territory: supply now finite" : null };
}
const lifecycle = {};
for (const p of liveList) if (!lifecycle[p.setId]) { const L = lifecycleFor(p); if (L) lifecycle[p.setId] = L; }
const rotationContext = { nextInPerson: "2027-04 (est. — annual April cadence)",
  note: "rotation = demand-side for competitive staples; legality mark map lands via enrichment pass" };


// ── (f) PRINT & ROTATION WATCH — EOL countdown × supply × reprint signal ──
// Countdown = 30-month print-window MODEL (est., doctrine block). Supply =
// sum of active listings across a set's tracked products. Reprint = from
// accumulated catalyst log (starts 2026-08-18; no fabricated history).
let clog = { entries: [] }; try { clog = await J("data/catalyst-log.json"); } catch {}
// accumulate today's catalysts (merge-by-date — pathogen-proof)
{
  const today = new Date().toISOString().slice(0,10);
  clog.entries = (clog.entries||[]).filter(e=>e.date!==today);
  for (const c of catalysts) clog.entries.push({ date: today, ...c });
  await writeFile(new URL("../data/catalyst-log.json", import.meta.url), JSON.stringify(clog,null,1));
}
const supplyBySet = {};
for (const p of liveList) supplyBySet[p.setId] = (supplyBySet[p.setId]||0) + (p.listingCount||0);
const setNameBy = {}; for (const p of sp.products) if (p.setId && p.set) setNameBy[p.setId] = p.set;
const reprintSets = new Set();
for (const e of (clog.entries||[])) if (e.class==="bullish" && /reprint|print run|back in print|restock/.test(e.trigger||"")) {
  for (const sid of Object.keys(setNameBy)) if ((e.context||"").includes(setNameBy[sid])) reprintSets.add(sid);
}
const EOL_MO = 30;
const printWatch = Object.entries(lifecycle).map(([sid, L]) => {
  const daysToEOL = Math.round((EOL_MO - L.ageMonths) * 30.44);
  return { setId: sid, set: setNameBy[sid] || sid, ageMonths: L.ageMonths,
    phase: L.phase, mark: L.mark, standardLegal: L.standardLegal, legalTag: L.legalTag,
    supply: supplyBySet[sid] ?? 0,
    eol: daysToEOL > 0 ? { status:"printing", daysLeftEst: daysToEOL } : { status:"outOfPrint", monthsOutEst: Math.round(-daysToEOL/30.44) },
    reprintSignal: reprintSets.has(sid) ? "📣 reprint in news" : null, chip:"READ" };
}).sort((a,b)=> (a.eol.daysLeftEst ?? -a.eol.monthsOutEst*30) - (b.eol.daysLeftEst ?? -b.eol.monthsOutEst*30));
const pwSupplies = printWatch.map(r=>r.supply).sort((x,y)=>x-y);
const loQ = pwSupplies[Math.floor(pwSupplies.length*0.25)]||0, hiQ = pwSupplies[Math.floor(pwSupplies.length*0.75)]||0;
for (const r of printWatch) r.supplyTier = r.supply <= loQ ? "low" : r.supply >= hiQ ? "high" : "mid";
const tightening = printWatch.filter(r=>r.supplyTier==="low" && !r.reprintSignal && (r.eol.status==="outOfPrint" || (r.eol.daysLeftEst??999) < 240)).slice(0,3);
const rotationCohorts = {};
for (const r of printWatch) { const k = r.mark ?? "pre-mark"; (rotationCohorts[k] ||= []).push(r.set); }


// ── (g) SPECIALTY vs MAINLINE cohort study — cross-section daily, history accumulates ──
// Taper/velocity curves only exist if we collect forward. cohort-history.json
// appends one row per class per day (merge-by-date, pathogen-proof).
let setClasses = {}; try { setClasses = (await J("data/set-classes.json")).classes ?? {}; } catch {}
const cohortCompare = (() => {
  const agg = { specialty: {sets:new Set(),products:0,supply:0,ageSum:0,spreadSum:0,spreadN:0,perPackSum:0,perPackN:0},
                mainline:  {sets:new Set(),products:0,supply:0,ageSum:0,spreadSum:0,spreadN:0,perPackSum:0,perPackN:0} };
  for (const p of liveList) {
    const cls = setClasses[p.setId]; if (!cls) continue;
    const a = agg[cls]; a.sets.add(p.setId); a.products++; a.supply += p.listingCount||0;
    const L = lifecycle[p.setId]; if (L) a.ageSum += L.ageMonths;
    const sr = spreadBy.get(p.id); if (sr?.spreadPct!=null) { a.spreadSum += sr.spreadPct; a.spreadN++; }
    const pm = packRows.find(r=>r.id===p.id && r.subtype!=="booster-pack"); if (pm) { a.perPackSum += pm.perPack; a.perPackN++; }
  }
  const mk = a => ({ sets: a.sets.size, products: a.products, totalSupply: a.supply,
    supplyPerProduct: a.products? Math.round(a.supply/a.products*10)/10 : null,
    supplyPerSetMonth: a.ageSum? Math.round(a.supply/a.ageSum*10)/10 : null,
    avgSpreadPct: a.spreadN? Math.round(a.spreadSum/a.spreadN*10)/10 : null,
    avgPerPack: a.perPackN? Math.round(a.perPackSum/a.perPackN*100)/100 : null });
  return { specialty: mk(agg.specialty), mainline: mk(agg.mainline),
    note: "supplyPerSetMonth = listings per set-age month (taper proxy; falls as sets absorb). Velocity/taper curves build in cohort-history.json from 2026-08-18 forward." };
})();
{ // accumulate history (merge-by-date)
  let ch = { entries: [] }; try { ch = await J("data/cohort-history.json"); } catch {}
  const today = new Date().toISOString().slice(0,10);
  ch.entries = (ch.entries||[]).filter(e=>e.date!==today);
  for (const cls of ["specialty","mainline"]) ch.entries.push({ date: today, class: cls, ...cohortCompare[cls] });
  await writeFile(new URL("../data/cohort-history.json", import.meta.url), JSON.stringify(ch,null,1));
}


// ── (h) TOPIC MONITOR — watched topics scanned across the whole machine ──
let topicCfg = { topics: [] }; try { topicCfg = await J("data/topic-watch.json"); } catch {}
const topicHits = [];
for (const t of (topicCfg.topics||[])) {
  const terms = [t.term, ...(t.aliases||[])].map(x=>x.toLowerCase());
  const hits = [];
  if (digestText) for (const term of terms) { const i = digestText.toLowerCase().indexOf(term);
    if (i>=0) { hits.push({ where:"news", detail: "…"+digestText.slice(Math.max(0,i-50),i+110).replace(/\s+/g," ").trim()+"…" }); break; } }
  for (const r of (div.rows||[])) if (r.signal && terms.some(x=>(r.name||"").toLowerCase().includes(x)||(r.set||"").toLowerCase().includes(x)))
    { hits.push({ where:"price gap", detail:`${r.name} — ${r.spreadPct>0?"+":""}${r.spreadPct}% eBay vs TCGplayer` }); break; }
  for (const c of ((sgAll&&sgAll.cards)||[])) if (!c.needsReview && terms.some(x=>(c.name||"").toLowerCase().includes(x)))
    { hits.push({ where:"chase board", detail:`${c.name} — $${c.priceMarket}` }); break; }
  for (const r of printWatch) if (terms.some(x=>r.set.toLowerCase().includes(x)) && (r.eol.status==="printing" ? r.eol.daysLeftEst<240 : true))
    { hits.push({ where:"print watch", detail: r.eol.status==="printing" ? `${r.set} — window closes ~${r.eol.daysLeftEst}d (est.)` : `${r.set} — out of print ~${r.eol.monthsOutEst}mo` }); break; }
  if (hits.length) topicHits.push({ topic: t.term, kind: t.kind, hits: hits.slice(0,3) });
}


// ── (g) GENERATION INDEXES — era-level benchmarks (Tyler, Aug 18) ────────
// Level = equal-weight median of live product medians per era. Baseline
// 100 = 2026-08-19 (first clean pricing-v2 day). History appends
// merge-by-date. Pressure read = era avg eBay-vs-TCG gap (RT-4 baseline
// applies era-wide) + supply saturation. Newcomer-clear labels, v4/v5.
const ERA = id => id.startsWith("me") ? "Mega Evolution"
  : id.startsWith("sv") ? "Scarlet & Violet"
  : id.startsWith("swsh") || id.startsWith("cel25") ? "Sword & Shield"
  : id.startsWith("sm") ? "Sun & Moon"
  : id.startsWith("xy") ? "XY" : "Vintage & other";
const spreadById = new Map((div.rows||[]).map(r=>[r.id, r.spreadPct]));
const eraBuckets = {};
const eraBoxes = {};
for (const p of liveList) {
  const e = ERA(p.setId || p.id);
  if (p.subtype === "booster-box" && p.priceMedian) (eraBoxes[e] ||= []).push(p.priceMedian);
  (eraBuckets[e] ||= { prices: [], gaps: [], listings: 0, n: 0 });
  eraBuckets[e].prices.push(p.priceMedian);
  eraBuckets[e].listings += p.listingCount || 0;
  eraBuckets[e].n += 1;
  const g = spreadById.get(p.id);
  if (g != null) eraBuckets[e].gaps.push(g);
}
const BASE_DATE = "2026-08-19";
let eiHist = { note: "era index history; baseline 100 = " + BASE_DATE + " (first clean pricing-v2 day)", entries: [] };
try { eiHist = await J("data/era-index-history.json"); } catch {}
const today = new Date().toISOString().slice(0,10);
const eraIndexes = Object.entries(eraBuckets).filter(([,b])=>b.n>=3).map(([era,b])=>{
  const ps = [...b.prices].sort((x,y)=>x-y);
  const level = ps[Math.floor(ps.length/2)];
  const avgGap = b.gaps.length ? Math.round(b.gaps.reduce((a,c)=>a+c,0)/b.gaps.length*10)/10 : null;
  const lpp = Math.round(b.listings / b.n);
  const eraRows = (eiHist.entries||[]).filter(e=>e.era===era).sort((a,b)=>a.date<b.date?-1:1);
  const baseRow = eraRows.find(e=>e.date===BASE_DATE) || eraRows[0] || null;
  const idx100 = baseRow ? Math.round(level / baseRow.level * 1000)/10 : 100.0;
  const offTcg = era === "Sun & Moon" || era === "XY" || era === "Vintage & other";
  let read;
  if (offTcg) read = "vintage-class era — this market historically trades on eBay, card shows, and collector groups, so we read eBay-native stats only and skip the cross-venue comparison (RT-4a)";
  else if (avgGap == null) read = "cross-market read still pending — not enough matched data yet to say anything";
  else if (avgGap >= 15) read = "reads hot — asks sit well past the usual photo premium, which typically points to demand-side pressure rather than seller optimism";
  else if (avgGap >= 6) read = "reads normal — the gap sits inside the range photos usually explain, so nothing here is signalling on its own";
  else if (avgGap >= 0) read = "reads aligned — the two venues typically drift a little, and right now they barely do";
  else read = "reads soft — eBay asks sitting under TCGplayer usually means motivated sellers across the era, which is worth watching rather than acting on";
  const bx = (eraBoxes[era]||[]).sort((x,y)=>x-y);
  const boxMedian = bx.length ? bx[Math.floor(bx.length/2)] : null;
  return { era, products: b.n, level, boxMedian, index: idx100, avgGapPct: offTcg ? null : avgGap, venueClass: offTcg ? "ebay-native" : "cross-market", totalListings: b.listings, listingsPerProduct: lpp, read, chip: "READ" };
}).sort((a,b)=>b.level-a.level);
// persist today (merge-by-date+era — pathogen-proof)
eiHist.entries = (eiHist.entries||[]).filter(e=>e.date!==today);
for (const r of eraIndexes) eiHist.entries.push({ date: today, era: r.era, level: r.level, avgGapPct: r.avgGapPct, listings: r.totalListings });
await writeFile(new URL("../data/era-index-history.json", import.meta.url), JSON.stringify(eiHist,null,1));


// ── (h) THE CATCH'EM SEALED INDEX — composite, baseline-relative ─────────
// Equal-weight mean of per-product ratios vs each product's own first
// clean-history price (self-healing baselines). Breadth = advancers vs
// decliners day-over-day. Methodology public: research/assets/methodology.html
let ixh = { note: "Catchem Sealed Index history — merge-by-date", entries: [] };
try { ixh = await J("research/pulse/index-history.json"); } catch {}
const firstSeen = {}, lastTwo = {}, lastTwoN = {};
for (const r of [...hh].sort((a,b)=>a.date<b.date?-1:1)) {
  if (r.date < "2026-08-19" || !r.price) continue; // CLEAN CUT: first full pricing-v2 day — the index measures market, never our cleanup
  if (!firstSeen[r.id]) firstSeen[r.id] = r.price;
  (lastTwo[r.id] ||= []).push(r.price);
  (lastTwoN[r.id] ||= []).push(r.listingCount ?? null);
  if (lastTwoN[r.id].length > 2) lastTwoN[r.id].shift();
  if (lastTwo[r.id].length > 2) lastTwo[r.id].shift();
}
const ratios = [], breadth = { up: 0, down: 0, flat: 0 };
for (const p of liveList) {
  if (!seasoned(p)) continue;
  const base = firstSeen[p.id];
  if (base && p.priceMedian) ratios.push(p.priceMedian / base);
  const lt = lastTwo[p.id];
  if (lt && lt.length === 2) {
    const d = (lt[1]-lt[0])/lt[0];
    if (d > 0.002) breadth.up++; else if (d < -0.002) breadth.down++; else breadth.flat++;
  }
}
const idxLevel = indexLevel(ratios); // lib canon — one equation, CI-tested
const prevIx = (ixh.entries||[]).slice(-1)[0];

// ── RAW CHASE INDEX + graded slot — same equation, different shelves ────
let sgh = { note: "singles history — merge-by-date", entries: [] };
try { sgh = await J("research/pulse/singles-history.json"); } catch {}
const todayS = new Date().toISOString().slice(0,10);
const chasesLive = (sgAll.cards||[]).filter(c=>!c.needsReview && c.dataStatus==="live" && c.priceMarket);
sgh.entries = (sgh.entries||[]).filter(e=>e.date!==todayS);
for (const c of chasesLive) sgh.entries.push({ date: todayS, cardId: c.cardId, price: c.priceMarket });
await writeFile(new URL("../research/pulse/singles-history.json", import.meta.url), JSON.stringify(sgh,null,1));
const rawFirst = {};
for (const e of [...sgh.entries].sort((a,b)=>a.date<b.date?-1:1)) if (!rawFirst[e.cardId]) rawFirst[e.cardId] = e.price;
const rawRatios = chasesLive.map(c=>c.priceMarket/(rawFirst[c.cardId]||c.priceMarket));
const rawLevel = indexLevel(rawRatios); // same lib equation as the composite
const rawIndex = { name:"Raw Chase Index", level: rawLevel, constituents: rawRatios.length,
  baselineDate: [...new Set(sgh.entries.map(e=>e.date))].sort()[0] ?? todayS,
  note:"same equation as the Sealed Index — confirmed chase singles, each vs its own first clean price", chip:"VERIFIED" };
const gradedIndex = { available: false, note:"same equation, graded shelf — waiting on a licensed daily graded-price feed" };
const medAll = [...liveList.filter(p=>p.priceMedian).map(p=>p.priceMedian)].sort((a,b)=>a-b);
const medianProductUsd = medAll.length ? medAll[Math.floor(medAll.length/2)] : null;
// ── VALUE-WEIGHTED TWIN (Tyler, Aug 22) ─────────────────────────────────
// The equal-weight index gives a $8 pack the same vote as a $5,000 box,
// and cheap items swing harder in percentage terms — measured 2026-08-22,
// the cheapest quartile drove 54% of daily movement. That is not wrong,
// it is a choice, and the honest response is to publish its twin rather
// than hide the effect. Same baselines, weighted by each product's value
// at baseline (so composition changes cannot distort it either).
// Precedent: S&P 500 vs S&P 500 Equal Weight — both real, both published.
let vwLevel = null, vwConstituents = 0;
{
  let wsum = 0, num = 0;
  for (const p of liveList) {
    if (!seasoned(p)) continue;
    const base = firstSeen[p.id];
    if (!base || !p.priceMedian) continue;
    num += (p.priceMedian / base) * base;   // ratio weighted by baseline value
    wsum += base;
    vwConstituents++;
  }
  if (wsum) vwLevel = Math.round(num / wsum * 1000) / 10;
}
const valueWeighted = vwLevel == null ? null : {
  name: "Catchem Sealed Index — value weighted", level: vwLevel, constituents: vwConstituents,
  vsEqualWeight: Math.round((vwLevel - idxLevel) * 10) / 10,
  simple: "Same shelf, but the expensive boxes get a bigger say. If this number and the main one disagree, the cheap end and the expensive end of the market are moving differently.",
  method: "Each product's move is weighted by what it was worth at its baseline, so a $5,000 box counts for more than a $10 pack. The main index gives every product one equal vote.",
  chip: "VERIFIED" };
const sealedIndex = { name: "Catchem Sealed Index", level: idxLevel,
  ddPct: prevIx ? Math.round((idxLevel/prevIx.level - 1)*1000)/10 : null,
  medianProductUsd, constituents: ratios.length, seasoningBench: liveList.filter(p=>!seasoned(p)).length, baseline: "each product vs its first clean-history price (2026-08-18 cut)",
  breadth, chip: "VERIFIED", methodologyUrl: "/methodology.html", valueWeighted,
  simple: `One number for all ${ratios.length} sealed products. 100 was the starting line; ${idxLevel} means the whole shelf is worth ${idxLevel>=100?"more":"less"} than when we started. Each product competes only against itself — one product, one vote.` };
{
  const today = new Date().toISOString().slice(0,10);
  ixh.entries = (ixh.entries||[]).filter(e=>e.date!==today);
  ixh.entries.push({ date: today, level: idxLevel, constituents: ratios.length, up: breadth.up, down: breadth.down });
  await writeFile(new URL("../research/pulse/index-history.json", import.meta.url), JSON.stringify(ixh,null,1));
}


// ── NET PROCEEDS TRUTH (engine side) — what a sale actually pockets ─────
// eBay trading-cards model: 13.25% final value + $0.30 fixed (published
// schedule, labeled est.). Delivered-price basis.
const FEE = { pct: 13.25, fixed: 0.30, venue: "eBay", source: "eBay trading-cards fee schedule, est." };
const netProceeds = { model: FEE, byId: {} };
for (const p of liveList) if (p.priceMedian)
  netProceeds.byId[p.id] = Math.round((p.priceMedian * (1 - FEE.pct/100) - FEE.fixed) * 100) / 100;


// ── SUITE UPGRADES (Aug 19) — pre-out: subtype indexes, outcomes, logs ──
const subBuckets = {};
for (const p of liveList) {
  if (!seasoned(p)) continue;
  const base = firstSeen[p.id];
  if (base && p.priceMedian) (subBuckets[p.subtype] ||= []).push(p.priceMedian / base);
}
const subtypeIndexes = Object.entries(subBuckets).filter(([,r])=>r.length>=5)
  .map(([sub, rs]) => ({ subtype: sub, level: Math.round(rs.reduce((a,b)=>a+b,0)/rs.length*1000)/10, constituents: rs.length }))
  .sort((a,b)=>b.constituents-a.constituents);
let wlog = { note: "daily-three pick log — merge-by-date; outcomes next day", entries: [] };
try { wlog = await J("research/pulse/watch-log.json"); } catch {}
const todayW = new Date().toISOString().slice(0,10);
const yRow = [...(wlog.entries||[])].filter(e=>e.date<todayW).sort((a,b)=>a.date<b.date?1:-1)[0];
let watchOutcomes = null;
if (yRow) {
  const res = pick => { if (!pick) return null;
    let now = null;
    if (pick.kind === "sealed") now = (liveList.find(p => pick.id ? p.id===pick.id : p.name===pick.name) || {}).priceMedian;
    else {
      const byId = pick.id ? (sgAll.cards||[]).find(c => c.cardId === pick.id) : null;
      const byName = (sgAll.cards||[]).find(c => c.name === pick.name || (c.watchLabel||"").includes(pick.name));
      now = (byId || byName || {}).priceMarket;
    }
    let dPct = now && pick.price ? Math.round((now/pick.price-1)*1000)/10 : null;
    if (dPct != null && Math.abs(dPct) > 60 && !pick.id) dPct = null; // name-collision quarantine: no id + implausible swing = wrong card, publish nothing
    return { ...pick, now: now ?? null, dPct }; };
  const notBlocked = pk => pk && !blockedIds.has(pk.id ?? "") && ![...blockedIds].some(id => (sp.products||[]).find(p=>p.id===id)?.name === pk.name);
  watchOutcomes = { date: yRow.date, sealed: notBlocked(yRow.sealed) ? res(yRow.sealed) : null, raw: notBlocked(yRow.raw) ? res(yRow.raw) : null };
}
let ph = { note: "sealed-premium history — merge-by-date", entries: [] };
try { ph = await J("research/pulse/premium-history.json"); } catch {}
ph.entries = (ph.entries||[]).filter(e=>e.date!==todayW);
for (const r of packRows) if (r.sealedPremiumPct!=null && !r.premiumThin)
  ph.entries.push({ date: todayW, id: r.id, premium: r.sealedPremiumPct });
await writeFile(new URL("../research/pulse/premium-history.json", import.meta.url), JSON.stringify(ph,null,1));
netProceeds.tcgModel = { source: "TCGplayer 10.75% + 2.5% + $0.30 (Feb 2026), est." };
netProceeds.tcgById = {};
for (const p of liveList) if (p.priceMedian)
  netProceeds.tcgById[p.id] = Math.round((p.priceMedian * (1 - 0.1325) - 0.30) * 100) / 100;


// ── ENGAGEMENT: Rip-or-Hold daily question + notification payload ───────
const rohPool = (div.rows||[]).filter(r=>r.signal).sort((a,b)=>Math.abs(b.spreadPct)-Math.abs(a.spreadPct));
const rohPick = rohPool[new Date().getUTCDate() % Math.max(rohPool.length,1)] || null;
const ripOrHold = rohPick ? { id: rohPick.id, name: rohPick.name, price: rohPick.ebayAskMedian,
  question: `${rohPick.name} at $${rohPick.ebayAskMedian} — rip it or hold it sealed?`,
  note: "one-tap daily vote; results revisited next morning" } : null;
const notification = { title: `Catchem Sealed Index ${sealedIndex.level}${sealedIndex.ddPct!=null?` (${sealedIndex.ddPct>0?"+":""}${sealedIndex.ddPct}%)`:""}`,
  body: rohPick ? `Today: ${rohPick.name} — eBay asks ${Math.abs(rohPick.spreadPct)}% ${rohPick.spreadPct>0?"more":"less"} than TCGplayer.` : "The Morning Pulse is out." };


// ── 🌊 SUPPLY SHIFTS (Tyler, Aug 20) — % supply change + cause candidates ──
// Gate: n>=20 listings and |Δ|>=15% (small shelves make noisy percents).
let recentCatalysts = [];
try { const cl = await J("data/catalyst-log.json"); const cutoff = Date.now() - 7*86400000;
  recentCatalysts = (cl.entries||[]).filter(e => new Date(e.date).getTime() >= cutoff); } catch {}
const supplyShifts = [];
for (const p of liveList) {
  const ln = lastTwoN[p.id]; if (!ln || ln.length < 2 || !ln[0] || !ln[1]) continue;
  if (Math.max(ln[0], ln[1]) < 20) continue;
  const dPct = Math.round((ln[1]/ln[0] - 1) * 1000) / 10;
  if (Math.abs(dPct) < 15) continue;
  const lp = lastTwo[p.id]; const priceD = lp && lp.length === 2 && lp[0] ? Math.round((lp[1]/lp[0]-1)*1000)/10 : null;
  let read;
  if (dPct > 0 && priceD != null && priceD < -0.5) read = "reads as a seller wave — usually a reprint hitting shelves, reprint chatter, or a large holder stepping out";
  else if (dPct > 0 && priceD != null && priceD > 0.5) read = "reads as a restock being absorbed — new copies arriving and typically getting bought as fast";
  else if (dPct > 0) read = "reads as supply building — sellers usually stepping in ahead of demand";
  else if (priceD != null && priceD > 0.5) read = "reads as absorption — shelves draining while asks rise, which historically means demand-led buying or a single large buyer";
  else read = "reads as a quiet drain — likely listings expiring or sellers stepping back";
  const cat = recentCatalysts.find(c => (c.context||c.text||"").toLowerCase().includes((p.set||"").toLowerCase().slice(0,12)) && (p.set||"").length > 3);
  supplyShifts.push({ id: p.id, name: p.name, listings: ln[1], prev: ln[0], dPct, priceDPct: priceD, read,
    catalystMatch: cat ? `matches ${cat.kind||"catalyst"} logged ${cat.date}` : null, chip: "READ" });
}
supplyShifts.sort((a,b) => Math.abs(b.dPct) - Math.abs(a.dPct));

let fx = null;
try { const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=CAD");
  const j = await r.json(); fx = { usdcad: j.rates?.CAD ?? null, date: j.date ?? null, source: "frankfurter.app" };
} catch { fx = null; }

// ── 🤝 THE DEAL ZONE (Tyler, Aug 22) — show-floor math for both sides ────
// A buyer's true online cost is the DELIVERED total plus sales tax.
// A seller's true online outcome is the ask MINUS marketplace fees.
// Those two numbers are far apart, and every price between them beats the
// online alternative FOR BOTH PARTIES. That gap is the deal zone, and it
// is the honest referee number for a card-show negotiation.
// Sources: eBay charges 13.25% final value on trading cards plus a per-order
// fee, calculated on item + shipping + tax; eBay collects sales tax from
// buyers by state. Tax rate is an assumption, labelled est. and tunable.
const TAX_DEFAULT = 0.07;            // US average-ish; user-adjustable in app
const EBAY_FVF = 0.1325, EBAY_PER_ORDER = 0.40;
const dealZone = { model: {
    buyerSide: "delivered eBay total + sales tax (est. " + Math.round(TAX_DEFAULT*100) + "% — set your own in the app)",
    sellerSide: "eBay ask minus " + (EBAY_FVF*100) + "% final value fee and $" + EBAY_PER_ORDER.toFixed(2) + " per order",
    note: "Both figures are estimates from published fee schedules. A show price between them beats the online route for buyer and seller alike.",
    // NUMERIC fields — the ONE source for client-side recompute (§19 Show
    // Mode settings). The app reads these; it never hardcodes a rate.
    formula: "buyerCeiling = ask × (1 + taxPct/100) · sellerFloor = ask × (1 − feePct/100) − feeFixed",
    taxPctDefault: Math.round(TAX_DEFAULT * 1000) / 10,
    feeTiers: [
      { id: "ebay-standard", label: "eBay Standard", pct: EBAY_FVF * 100, fixed: EBAY_PER_ORDER, default: true },
      { id: "ebay-trp", label: "eBay Top Rated Plus", pct: 11.93, fixed: EBAY_PER_ORDER, note: "≈10% FVF discount (est.)" },
      { id: "ebay-basic-store", label: "eBay Basic Store", pct: 14.9, fixed: EBAY_PER_ORDER, note: "est." },
      { id: "tcgplayer", label: "TCGplayer", pct: 13.25, fixed: 0, note: "10.75% + 2.5% processing" },
    ] },
  byId: {} };
for (const p of liveList) {
  if (!p.priceMedian || p.publishBlock) continue;
  const ceiling = Math.round(p.priceMedian * (1 + TAX_DEFAULT) * 100) / 100;   // buyer pays this online
  const floor = Math.round((p.priceMedian * (1 - EBAY_FVF) - EBAY_PER_ORDER) * 100) / 100; // seller keeps this online
  if (floor <= 0 || ceiling <= floor) continue;
  dealZone.byId[p.id] = { ask: p.priceMedian, buyerCeiling: ceiling, sellerFloor: floor,
    zoneWidth: Math.round((ceiling - floor) * 100) / 100,
    zonePct: Math.round((ceiling - floor) / p.priceMedian * 1000) / 10,
    midpoint: Math.round(((ceiling + floor) / 2) * 100) / 100 };
}

const out = {
  generatedAt: new Date().toISOString(),
  method: "Pack Math: ask median / era-aware pack count (arithmetic, no estimation; variable-count products excluded by name). Narrative: latest agent digest cross-referenced against tracked sets; 'quiet movers' = spread signal with zero digest mention.",
  digestUsed: digestName,
  packMath: { all: packRows.map(r=>({id:r.id,setId:r.setId,perPack:r.perPack,premium:r.sealedPremiumPct,thin:r.premiumThin??false,loosePackN:r.loosePackN??null})), priciest: packRows.slice(0,6), cheapest: [...packRows].reverse().slice(0,6) },
  narrative: { inNews: inNews.slice(0,6), quietMovers: quietMovers.slice(0,6) },
  catalysts,
  depthReads,
  lifecycle, rotationContext,
  printWatch, tightening, rotationCohorts,
  eraIndexes,
  sealedIndex, rawIndex, gradedIndex, netProceeds, dealZone, fx, subtypeIndexes, watchOutcomes, supplyShifts: supplyShifts.slice(0,8), ripOrHold, notification,
  cohortCompare,
  topicHits,
  dailyThree: (() => {
    // ── FRESHNESS ROTATION (Tyler, 2026-08-22) ────────────────────────
    // A repeat pick tells the reader nothing new, and the obvious pick
    // tells them nothing they didn't know. Anything featured in the last
    // 7 days is out — unless it is a screaming deal, which is the only
    // thing worth repeating for. Novelty then favours the deep cut over
    // the famous product: a reader who has never considered a product
    // learns more than one who already owns the story.
    const FEATURE_COOLDOWN_DAYS = 7;
    const SCREAMING_SPREAD = 40;      // an outlier worth repeating for
    const featuredAgo = new Map();    // name -> days since featured
    {
      const nowMs = Date.parse(new Date().toISOString().slice(0, 10));
      for (const e of (wlog.entries || [])) {
        const days = Math.round((nowMs - Date.parse(e.date)) / 86400000);
        if (days < 0 || days > FEATURE_COOLDOWN_DAYS) continue;
        for (const k of ["sealed", "raw"]) {
          const n = e[k]?.name; if (!n) continue;
          if (!featuredAgo.has(n) || featuredAgo.get(n) > days) featuredAgo.set(n, days);
        }
      }
    }
    const isRepeat = name => featuredAgo.has(name);
    // Deep-cut bonus: rank each product by how prominent it is (price and
    // listing depth). The most visible products are the ones every reader
    // already watches; a surprising pick beats a loud one.
    const prominence = new Map();
    {
      const ranked = [...liveList].filter(p => p.priceMedian).sort((a, b) => b.priceMedian - a.priceMedian);
      ranked.forEach((p, i) => prominence.set(p.id, i / Math.max(1, ranked.length - 1))); // 0 = most famous
    }
    const noveltyScore = r => {
      const strength = Math.abs(r.spreadPct);
      const deepCut = (prominence.get(r.id) ?? 0.5) * 12;   // up to +12 for obscurity
      const cooldown = isRepeat(r.name) ? -1000 : 0;         // hard exclusion
      const unseen = featuredAgo.size && !isRepeat(r.name) ? 4 : 0;
      return strength + deepCut + unseen + cooldown;
    };

    // ── SELECTION LENS (Tyler, 2026-08-22) ───────────────────────────
    // The sealed pick was always chosen by the widest eBay-vs-TCG gap and
    // then explained by that same gap — one instrument doing all the work,
    // which makes every day read the same. The lens now rotates, so the
    // reason a product earned its place changes with the day. Each lens
    // writes its own whyChosen line: what got it here, distinct from what
    // it means. If a lens has no candidate today, the next one is tried.
    const pm = new Map((packRows || []).map(r => [r.id, { premium: r.sealedPremiumPct, thin: r.premiumThin, perPack: r.perPack }]));
    const prodById = new Map(liveList.map(p => [p.id, p]));
    const eligibleAll = (div.rows||[]).filter(r => !blockedIds.has(r.id) && !isRepeat(r.name));
    const LENSES = [
      { id: "gap", label: "widest gap between the two markets",
        pick: () => eligibleAll.filter(r => r.signal).sort((a,b)=>Math.abs(b.spreadPct)-Math.abs(a.spreadPct))[0],
        why: r => `It is on the list because the two marketplaces disagree about it more than anything else we track today — eBay is asking ${Math.abs(r.spreadPct)}% ${r.spreadPct>0?"more":"less"} than TCGplayer.` },
      { id: "premium", label: "biggest sealed premium over loose packs",
        pick: () => eligibleAll.map(r => ({ r, p: pm.get(r.id) })).filter(x => x.p?.premium != null && !x.p.thin)
                      .sort((a,b)=>Math.abs(b.p.premium)-Math.abs(a.p.premium))[0]?.r,
        why: r => { const p = pm.get(r.id); return `It is on the list because the sealed box is priced ${Math.abs(p.premium)}% ${p.premium>0?"above":"below"} what its packs cost loose — the widest gap of that kind on the board today.`; } },
      { id: "perpack", label: "most expensive rip on the board",
        pick: () => eligibleAll.map(r => ({ r, p: pm.get(r.id) })).filter(x => x.p?.perPack)
                      .sort((a,b)=>b.p.perPack-a.p.perPack)[0]?.r,
        why: r => `It is on the list because it works out to $${pm.get(r.id).perPack} a pack — the most expensive rip we track right now.` },
      { id: "room", label: "widest distance between the cheapest listing and the middle",
        pick: () => eligibleAll.map(r => ({ r, p: prodById.get(r.id) }))
                      .filter(x => x.p?.priceFloorClean && x.p?.priceMedian && x.p.listingCount >= 10)
                      .sort((a,b)=>(b.p.priceMedian/b.p.priceFloorClean)-(a.p.priceMedian/a.p.priceFloorClean))[0]?.r,
        why: r => { const p = prodById.get(r.id); return `It is on the list because its cheapest believable listing sits at $${p.priceFloorClean.toLocaleString("en-US")} while the middle of the market is $${p.priceMedian.toLocaleString("en-US")} — an unusually wide spread between the two, which usually means patience is worth something here.`; } },
      { id: "zone", label: "most room in a face-to-face deal",
        pick: () => eligibleAll.map(r => ({ r, z: dealZone.byId[r.id] })).filter(x => x.z?.zonePct)
                      .sort((a,b)=>b.z.zonePct-a.z.zonePct)[0]?.r,
        why: r => { const z = dealZone.byId[r.id]; return `It is on the list because it has the widest deal zone on the board — a seller keeps about $${z.sellerFloor.toLocaleString("en-US")} selling online while a buyer pays about $${z.buyerCeiling.toLocaleString("en-US")}, so there is roughly $${z.zoneWidth.toLocaleString("en-US")} of room where a face-to-face trade beats the internet for both people.`; } },
    ];
    let lensUsed = null, lensPick = null;
    for (let i = 0; i < LENSES.length && !lensPick; i++) {
      const L = LENSES[(new Date().getUTCDate() + i) % LENSES.length];
      const cand = L.pick();
      if (cand) { lensPick = cand; lensUsed = L; }
    }
    const eligible = (div.rows||[]).filter(r => r.signal && !blockedIds.has(r.id));
    const screaming = eligible.filter(r => Math.abs(r.spreadPct) >= SCREAMING_SPREAD && (featuredAgo.get(r.name) ?? 99) >= 3);
    const fresh = eligible.filter(r => !isRepeat(r.name));
    // Fresh first, ranked by novelty. If the cooldown empties the pool,
    // fall back to the least-recently-featured rather than publishing
    // nothing — a stale pick beats no edition, but only as a last resort.
    let sealedPick = lensPick || (fresh.length ? [...fresh].sort((a, b) => noveltyScore(b) - noveltyScore(a))[0]
      : (screaming.length ? [...screaming].sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct))[0]
        : [...eligible].sort((a, b) => (featuredAgo.get(b.name) ?? 99) - (featuredAgo.get(a.name) ?? 99))[0] || null));
    // A screaming deal outranks freshness — that is the whole point of the
    // exception. Label it so the repeat reads as deliberate, not lazy.
    const topScream = screaming.sort((a, b) => Math.abs(b.spreadPct) - Math.abs(a.spreadPct))[0];
    // The lens chose; record why. If the screaming-deal override replaces the
    // pick below, it rewrites this line — a card must always explain the reason
    // it is actually on the list, not the reason a different candidate was.
    let whyLine = (lensUsed && lensPick === sealedPick) ? lensUsed.why(sealedPick) : null;
    let lensId = (lensUsed && lensPick === sealedPick) ? lensUsed.id : null;
    let repeatReason = null;
    if (topScream && sealedPick && Math.abs(topScream.spreadPct) > Math.abs(sealedPick.spreadPct) + 12) {
      if (isRepeat(topScream.name)) repeatReason = `back on the board ${featuredAgo.get(topScream.name)} day(s) later — the gap widened past anything else we track`;
      sealedPick = topScream;
      whyLine = `It is on the list because the gap opened up past everything else we track today — eBay is asking ${Math.abs(topScream.spreadPct)}% ${topScream.spreadPct > 0 ? "more" : "less"} than TCGplayer, which is far enough out of line to bump whatever else was in this slot.`;
      lensId = "screaming";
    }
    let gradedPick = null;
    {
      const g = ((enr&&enr.cards)||[])
        .map(c=>({ name: c.watchLabel || c.name,
                   raw: c.raw?.market ?? null,
                   psa10: c.ebaySold?.psa10?.median ?? null,
                   premium: c.gradingPremium?.psa10 ?? null,
                   n10: c.ebaySold?.psa10?.count ?? null }))
        .filter(c=>c.premium!=null && c.raw!=null && (c.n10==null || c.n10>=10))
        .sort((a,b)=>b.premium-a.premium)[0];
      if (g) gradedPick = { name:g.name, raw:g.raw, psa10:g.psa10, premium:g.premium, n10:g.n10, chip:"VERIFIED",
        reason:`widest grading payoff on the board today`, gated:true,
        explain:`Ungraded copies trade around $${Math.round(g.raw).toLocaleString("en-US")}. Perfect-graded (PSA 10) copies have been SELLING near $${Math.round(g.psa10).toLocaleString("en-US")} \u2014 about $${Math.round(g.premium).toLocaleString("en-US")} ahead even after the $79.99 grading fee.${g.n10?` Based on ${g.n10} recorded PSA 10 sales.`:""}` };
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
        if (pick) { why = `the top chase from ${fs} — a set moving in today\u2019s numbers`; break; }
      }
      // Same freshness law: a chase featured this week steps aside.
      if (pick && isRepeat(pick.name)) pick = null;
      if (!pick) {
        const freshChases = chases.filter(c => !isRepeat(c.name));
        const pool = freshChases.length ? freshChases : chases;
        // Rotate through the value ladder rather than always the top card:
        // pick the priciest fresh chase from a set we have not featured.
        pick = [...pool].sort((a, b) => b.priceMarket - a.priceMarket)[0];
        why = freshChases.length ? "a chase we have not put in front of you this week" : "chase-board anchor — the raw single the market prices everything against";
      }
      if (pick) {
        const L2 = Object.values(lifecycle).find(l=>l.setId && sp.products.some(pp=>pp.setId===l.setId && pp.set===pick.setName));
        const lifeBit = L2 ? ` Its set is ${L2.ageMonths} months old${L2.standardLegal?" and still Standard-legal":""}.` : "";
        rawPick = { name: pick.name, set: pick.setName, price: pick.priceMarket, chip:"READ", reason: why,
          explain: `Widely treated as the card collectors hunt hardest from ${pick.setName} \u2014 the card the whole set gets priced around. Market sits at $${Math.round(pick.priceMarket).toLocaleString("en-US")} today.${lifeBit}` };
      }
    }
    // THIRD SLOT (2026-08-22): graded needs a licensed feed. Rather than render
    // a padlock — which advertises absence and is the worst card on the page —
    // promote an instrument we fully own. A shelf move is a genuinely different
    // lens from a price gap and a chase.
    const shelfPick = (!gradedPick || gradedPick.gated)
      ? (supplyShifts || []).find(x => !blockedIds.has(x.id) && !isRepeat(x.name)) || null
      : null;
    return {
      shelf: shelfPick ? { name: shelfPick.name, listings: shelfPick.listings, prev: shelfPick.prev,
        dPct: shelfPick.dPct, priceDPct: shelfPick.priceDPct, chip: "READ",
        explain: shelfPick.read, reason: "shelf move worth a look" } : null,
      sealed: (() => {
        if (!sealedPick) return null;
        const _rr = repeatReason;
        const L = lifecycle[sealedPick.setId];
        const dir = sealedPick.spreadPct > 0 ? "more" : "less";
        const mag = Math.abs(sealedPick.spreadPct);
        const base = sealedPick.spreadPct > 0
          ? `eBay usually runs a little higher on sealed \u2014 this is asking ${mag}% more, well past that baseline.`
          : `eBay sellers are asking ${mag}% LESS than TCGplayer \u2014 unusual, since photos normally earn eBay a premium.`;
        const life = L ? ` The set is ${L.ageMonths} months old (${L.phase.split(" \u2014")[0]}).` : "";
        return {
          whyChosen: whyLine, lens: lensId, name: sealedPick.name, ebay: sealedPick.ebayAskMedian, tcg: sealedPick.tcgMarket,
          spreadPct: sealedPick.spreadPct, listings: sealedPick.ebayListings, chip:"VERIFIED",
          reason: lensUsed && lensId === lensUsed.id ? lensUsed.label : "biggest price gap between the two markets today",
          explain: `${base} ${sealedPick.ebayListings} listings are live right now.${life}` };
      })(),
      graded: gradedPick, // null until Premium table exists — the slot says so honestly
      raw: rawPick,
    };
  })(),
};
// today's picks into the watch log (post-out: reads out.dailyThree safely)
wlog.entries = (wlog.entries||[]).filter(e=>e.date!==todayW);
wlog.entries.push({ date: todayW,
  sealed: out.dailyThree?.sealed ? { kind:"sealed", name: out.dailyThree.sealed.name, price: out.dailyThree.sealed.ebay, id: (liveList.find(p=>p.name===out.dailyThree.sealed.name)||{}).id ?? null } : null,
  raw: out.dailyThree?.raw ? { kind:"raw", name: out.dailyThree.raw.name, price: out.dailyThree.raw.price,
    id: ((sgAll.cards||[]).find(c => c.name === out.dailyThree.raw.name && Math.abs((c.priceMarket??0) - out.dailyThree.raw.price) < 1) || {}).cardId ?? null } : null });
await writeFile(new URL("../research/pulse/watch-log.json", import.meta.url), JSON.stringify(wlog,null,1));
await writeFile(join(ROOT,"data/derived-insights.json"), JSON.stringify(out,null,2)+"\n");
console.log(`✓ derived: ${packRows.length} pack-math rows · news-mentioned sets: ${inNews.length} · quiet movers: ${quietMovers.length} (digest: ${digestName})`);
console.log("  priciest pack:", packRows[0]?.name, "$"+packRows[0]?.perPack+"/pack");
console.log("  cheapest pack:", packRows[packRows.length-1]?.name, "$"+packRows[packRows.length-1]?.perPack+"/pack");
