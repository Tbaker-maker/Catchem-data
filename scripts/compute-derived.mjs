// scripts/compute-derived.mjs — Derived Intelligence, layer 1
// (a) PACK MATH: price-per-sealed-pack across comparable SKUs. Arithmetic on
//     today's ask medians — no history needed, no estimation. Era-aware pack
//     counts; products with variable counts are excluded BY NAME with reasons.
// (b) NARRATIVE vs TAPE: cross-references the intelligence agent's latest
//     digest against tracker sets — what's talked-about vs what's moving.
// Output: data/derived-insights.json. Trust: every number traceable to inputs.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { flag } from "./flags.mjs";
import { indexLevel, sealedPremium } from "./lib/instruments.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { applyPackBasis } from "./pack-basis.mjs";
import { rotate } from "./rotate.mjs";

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 8000;
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
const packPricing = applyPackBasis(sp.products, div.rows);

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
  if (offTcg) read = "Vintage-class era. This market historically trades on eBay, at shows and in collector groups, so we read eBay figures only.";
  else if (avgGap == null) read = "cross-market read still pending — not enough matched data yet to say anything";
  else if (avgGap >= 15) read = "eBay normally runs a little higher because photos show the exact item. Asks here sit well past that, which typically points to demand.";
  else if (avgGap >= 6) read = "The gap sits inside the range photos usually explain, so nothing here is signalling on its own.";
  else if (avgGap >= 0) read = "The two venues typically drift a little, and right now they barely do.";
  else read = "eBay asks under TCGplayer usually means motivated sellers across the era. Worth watching, not acting on.";
  const bx = (eraBoxes[era]||[]).sort((x,y)=>x-y);
  const boxMedian = bx.length ? bx[Math.floor(bx.length/2)] : null;
  // Sandbox Rule: every instrument ships a plain-words version one tap away.
  // The Improver caught all five era indexes shipping without one, and partial
  // compliance is the same as none for whoever lands on the one that lacks it.
  const simple = `Think of each era as its own shelf in the shop. This is what a typical box from the ${era} shelf costs right now, across the ${b.n} products we price from it. It is not what the whole era is worth — it is what one box from that shelf costs today.`;
  return { era, products: b.n, level, boxMedian, simple, index: idx100, avgGapPct: offTcg ? null : avgGap, venueClass: offTcg ? "ebay-native" : "cross-market", totalListings: b.listings, listingsPerProduct: lpp, read, chip: "READ" };
}).sort((a,b)=>b.level-a.level);
// persist today (merge-by-date+era — pathogen-proof)
eiHist.entries = (eiHist.entries||[]).filter(e=>e.date!==today);
for (const r of eraIndexes) eiHist.entries.push({ date: today, era: r.era, level: r.level, avgGapPct: r.avgGapPct, listings: r.totalListings });
await writeFile(new URL("../data/era-index-history.json", import.meta.url), JSON.stringify(eiHist,null,1));


// ── (h) THE CATCH'EM SEALED INDEX — chain-linked ────────────────────────
// REBUILT 2026-08-23. The old method averaged each product's ratio against
// its own first price. That is stable against price changes but NOT against
// COMPOSITION changes: on 2026-08-21 twenty-five products entered at ratio
// 1.0 and dragged the mean toward 100, and seven blocked products silently
// left the pool — neither of which is a market event. The pack-basis switch
// was the same disease caught one instance at a time.
//
// The fix is what real indices do: measure the MATCHED-SAMPLE return day over
// day, then chain it onto the previous level. Only products present on BOTH
// days contribute to a day's move, so entries, exits, QA blocks and basis
// changes cannot print as price movement. Ever.
let ixh = { note: "Catchem Sealed Index — chain-linked daily returns on a matched sample; composition changes cannot move the level", entries: [] };
try { ixh = await J("research/pulse/index-history.json"); } catch {}
const todayIx = new Date().toISOString().slice(0, 10);
const priceToday = new Map(liveList.filter(p => p.priceMedian).map(p => [p.id, p.priceMedian]));
// yesterday's prices, from the last committed day of history
const byDay = {};
for (const r of hh) if (r.price) (byDay[r.date] ||= {})[r.id] = r.price;
const priorDays = Object.keys(byDay).filter(d => d < todayIx).sort();
const prevDay = priorDays[priorDays.length - 1];
const prevPrices = prevDay ? byDay[prevDay] : null;

const prevEntry = (ixh.entries || []).filter(e => e.date < todayIx).sort((a, b) => a.date < b.date ? -1 : 1).slice(-1)[0];
let idxLevel, dayReturn = null, matched = 0;
const breadth = { up: 0, down: 0, flat: 0 };
if (prevPrices && prevEntry) {
  const rets = [];
  for (const p of liveList) {
    if (!seasoned(p) || !p.priceMedian) continue;
    if (p.basisChangedOn === todayIx) continue;      // basis change is not a market move
    const was = prevPrices[p.id];
    if (!was) continue;                               // entered today — contributes from tomorrow
    const r = p.priceMedian / was - 1;
    rets.push(r); matched++;
    if (r > 0.002) breadth.up++; else if (r < -0.002) breadth.down++; else breadth.flat++;
  }
  dayReturn = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  idxLevel = Math.round(prevEntry.level * (1 + dayReturn) * 10) / 10;
} else {
  idxLevel = 100.0;                                   // first day of a clean series
}
const sealedIndex = { name: "Catchem Sealed Index", level: idxLevel,
  ddPct: dayReturn == null ? null : Math.round(dayReturn * 1000) / 10,
  constituents: liveList.filter(p => seasoned(p) && p.priceMedian).length,
  matchedSample: matched,
  seasoningBench: liveList.filter(p => !seasoned(p)).length,
  medianProductUsd: (() => { const a = liveList.filter(p=>p.priceMedian).map(p=>p.priceMedian).sort((x,y)=>x-y); return a.length ? a[Math.floor(a.length/2)] : null; })(),
  baseline: "chain-linked from 100.0; each day's move is the average return of products present on both days",
  breadth, chip: "VERIFIED", methodologyUrl: "/methodology.html",
  simple: `One number for the whole sealed market. It starts at 100 and moves by the average daily change of the products we track — only products we could price on both days count toward a move, so adding or removing products never shifts it.` };
{
  ixh.entries = (ixh.entries || []).filter(e => e.date !== todayIx);
  ixh.entries.push({ date: todayIx, level: idxLevel, constituents: sealedIndex.constituents, matched, up: breadth.up, down: breadth.down });
  await writeFile(new URL("../research/pulse/index-history.json", import.meta.url), JSON.stringify(ixh, null, 1));
}

const rebasedToday = new Set((sp.products || []).filter(p => p.basisChangedOn === new Date().toISOString().slice(0,10)).map(p => p.id));
// Baselines for the twin and the subtype indexes, from the clean cut.
const firstSeen = {};
for (const r of [...hh].sort((a, b) => a.date < b.date ? -1 : 1)) {
  if (r.date < "2026-08-19" || !r.price) continue;
  if (rebasedToday.has(r.id)) continue;
  if (!firstSeen[r.id]) firstSeen[r.id] = r.price;
}
for (const p of liveList) if (rebasedToday.has(p.id) && p.priceMedian) firstSeen[p.id] = p.priceMedian;

// ── RAW CHASE INDEX — same equation, the singles shelf ──────────────────
let sgh = { note: "singles history — merge-by-date", entries: [] };
try { sgh = await J("research/pulse/singles-history.json"); } catch {}
const todayS = new Date().toISOString().slice(0, 10);
const chasesLive = (sgAll.cards || []).filter(c => c.cardId && c.priceMarket && c.dataStatus !== "error");
sgh.entries = (sgh.entries || []).filter(e => e.date !== todayS);
for (const c of chasesLive) sgh.entries.push({ date: todayS, cardId: c.cardId, price: c.priceMarket });
await writeFile(new URL("../research/pulse/singles-history.json", import.meta.url), JSON.stringify(sgh, null, 1));
const rawFirst = {};
for (const e of [...sgh.entries].sort((a, b) => a.date < b.date ? -1 : 1)) if (!rawFirst[e.cardId]) rawFirst[e.cardId] = e.price;
const rawRatios = chasesLive.map(c => c.priceMarket / (rawFirst[c.cardId] || c.priceMarket));
const rawIndex = { name: "Raw Chase Index",
  level: rawRatios.length ? Math.round(rawRatios.reduce((a, b) => a + b, 0) / rawRatios.length * 1000) / 10 : 100.0,
  constituents: rawRatios.length,
  baselineDate: [...new Set(sgh.entries.map(e => e.date))].sort()[0] ?? todayS,
  note: "same equation as the Sealed Index — confirmed chase singles, each against its own first clean price", chip: "VERIFIED" };
const gradedIndex = { available: false, note: "same equation, graded shelf — waiting on a licensed daily graded-price feed" };

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
// Was ranked by spreadPct off signal rows. Retiring the Spread made
// r.signal permanently false, which silently emptied this pool and killed
// Rip-or-Hold entirely — a held instrument taking an unrelated feature down
// with it. Rebuilt on our own eBay-side numbers: rippable sealed with real
// listing depth, rotated daily so it is not the same product every morning.
const rohPool = liveList
  .filter(p => p.priceMedian && (p.listingCount ?? 0) >= 10
    && ["booster-box", "etb", "pc-etb", "booster-bundle"].includes(p.subtype)
    && !blockedIds.has(p.id))
  .sort((a, b) => (b.listingCount ?? 0) - (a.listingCount ?? 0))
  .slice(0, 25)
  .map(p => ({ id: p.id, name: p.name, ebayAskMedian: p.priceMedian }));
const rohPick = rotate(rohPool) || null;
const ripOrHold = rohPick ? { id: rohPick.id, name: rohPick.name, price: rohPick.ebayAskMedian,
  question: `${rohPick.name} at $${rohPick.ebayAskMedian} — rip it or hold it sealed?`,
  note: "one-tap daily vote; results revisited next morning" } : null;
const notification = { title: `Catchem Sealed Index ${sealedIndex.level}${sealedIndex.ddPct!=null?` (${sealedIndex.ddPct>0?"+":""}${sealedIndex.ddPct}%)`:""}`,
  body: rohPick ? `Today: ${rohPick.name} — eBay asks ${Math.abs(rohPick.spreadPct)}% ${rohPick.spreadPct>0?"more":"less"} than TCGplayer.` : "The Morning Pulse is out." };


// Listing/price pairs for the last two days, independent of the index.
const lastTwo = {}, lastTwoN = {};
for (const r of [...hh].sort((a, b) => a.date < b.date ? -1 : 1)) {
  if (r.date < "2026-08-19") continue;
  if (r.price) { (lastTwo[r.id] ||= []).push(r.price); if (lastTwo[r.id].length > 2) lastTwo[r.id].shift(); }
  (lastTwoN[r.id] ||= []).push(r.listingCount ?? null); if (lastTwoN[r.id].length > 2) lastTwoN[r.id].shift();
}

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
  if (dPct > 0 && priceD != null && priceD < -0.5) read = "Usually a reprint hitting shelves, reprint chatter, or a large holder stepping out.";
  else if (dPct > 0 && priceD != null && priceD > 0.5) read = "New copies arriving and typically getting bought about as fast as they land.";
  else if (dPct > 0) read = "Sellers usually stepping in ahead of demand.";
  else if (priceD != null && priceD > 0.5) read = "Shelves draining while asks rise, which historically means demand-led buying or one large buyer.";
  else read = "Likely listings expiring or sellers stepping back.";
  const cat = recentCatalysts.find(c => (c.context||c.text||"").toLowerCase().includes((p.set||"").toLowerCase().slice(0,12)) && (p.set||"").length > 3);
  supplyShifts.push({ id: p.id, name: p.name, listings: ln[1], prev: ln[0], dPct, priceDPct: priceD, read,
    catalystMatch: cat ? `matches ${cat.kind||"catalyst"} logged ${cat.date}` : null, chip: "READ" });
}
supplyShifts.sort((a,b) => Math.abs(b.dPct) - Math.abs(a.dPct));

let fx = null;
try { const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=CAD", { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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



// ── 📦 RIP IT, SELL IT, OR TRADE IT (Tyler, 2026-08-23) ─────────────────
// Three paths out of one sealed box, priced with numbers we already compute.
// Nobody else can answer this because nobody else holds all three at once.
//
//   RIP IT   — what the packs inside are worth loose, right now.
//   SELL IT  — what you keep selling it online, after fees.
//   TRADE IT — what a face-to-face deal is worth, using the seller floor.
//
// THE HONEST LIMIT, stated on the instrument itself: ripping for the CARDS is
// a gamble we do not model and will not pretend to. What we can price is the
// packs, because packs have a market. Anyone telling you the expected value of
// what you will pull is guessing with extra steps.
const ripSellTrade = { note: "Three paths out of one sealed box, priced from what we already measure. Ripping is valued as PACKS, never as a guess at what you might pull.",
  chip: "READ", byId: {} };
for (const p of liveList) {
  if (!p.priceMedian || p.publishBlock) continue;
  const pm = packRows?.find?.(r => r.id === p.id) ?? null;
  const packs = pm?.packs ?? null, loose = pm?.loosePack ?? null;
  const np = netProceeds?.byId?.[p.id] ?? null;
  const dz = dealZone?.byId?.[p.id] ?? null;
  if (!packs || !loose || !np || !dz) continue;
  const rip = Math.round(packs * loose * 100) / 100;      // packs at today's loose price
  const sell = Math.round((np.ebayNet ?? np.net ?? 0) * 100) / 100;
  const trade = dz.sellerFloor;
  const paths = [{ path: "rip", value: rip }, { path: "sell", value: sell }, { path: "trade", value: trade }]
    .filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  if (paths.length < 2) continue;
  const best = paths[0], worst = paths[paths.length - 1];
  const spreadPct = Math.round((best.value / worst.value - 1) * 1000) / 10;
  const WORD = { rip: "ripping it for the packs", sell: "selling it online", trade: "trading it face to face" };
  ripSellTrade.byId[p.id] = { name: p.name, sealed: p.priceMedian,
    rip, sell, trade, packs, loosePack: loose,
    best: best.path, bestValue: best.value, spreadPct,
    read: spreadPct < 5
      ? `All three paths land within ${spreadPct}% of each other, so this is a question of effort rather than money — sell it whichever way you find easiest.`
      : `${WORD[best.path].replace(/^./, c => c.toUpperCase())} comes out ahead at $${best.value.toLocaleString("en-US")}, about ${spreadPct}% above the weakest option. That gap is the whole decision.`,
    caveat: "Ripping is priced as the packs inside at today's loose price. What you might pull is a gamble we do not model." };
}


// ── 🔁 REPRINT PRESSURE — one computation, three audiences ─────────────────
// The creator agent found the same missing crossing from three directions:
// creators want "reprints", buyers want "hidden gems", vendors want "what do I
// bring". All three are answered by crossing a set's PRINT WINDOW against what
// its shelves are doing — and both halves have been sitting two fields apart.
//
//   late print + shelves FILLING  → a reprint is landing or already has.
//                                   Vendor: leave it home. Buyer: wait.
//   late print + shelves DRAINING → the window is closing while stock leaves.
//                                   Vendor: bring it. Buyer: this is the gem.
//   early print + either          → normal. Say nothing rather than invent a story.
//
// READ, never VERIFIED: a print window is an estimate off a 30-month model and
// shelf counts are listings, not sales. Two soft signals crossed are still soft.
const reprintPressure = (() => {
  const shiftBySet = {};
  for (const s of (supplyShifts ?? [])) {
    const p = (sp.products || []).find(x => x.id === s.id);
    if (p?.setId) (shiftBySet[p.setId] ||= []).push(s.dPct);
  }
  const rows = [];
  for (const pw of (printWatch ?? [])) {
    const deltas = shiftBySet[pw.setId];
    if (!deltas?.length) continue;
    const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
    const late = /late print|likely EOL/i.test(pw.phase ?? "");
    if (!late || Math.abs(median) < 10) continue;
    const filling = median > 0;
    rows.push({ setId: pw.setId, set: pw.set, phase: pw.phase,
      shelfMovePct: Math.round(median * 10) / 10, products: deltas.length,
      signal: filling ? "SUPPLY ARRIVING" : "WINDOW CLOSING",
      chip: "READ",
      forBuyers: filling
        ? "Shelves filling this late usually means fresh stock arriving — often a reprint. Patience tends to be rewarded here."
        : "Stock leaving a set whose print window is closing is the shape people mean by a hidden gem. It is also the shape of a set nobody is restocking, which is not the same thing.",
      forVendors: filling
        ? "Worth leaving at home. Table space costs more than the margin on something the room is about to be full of."
        : "Worth bringing. Supply is thinning while the window closes, and you will be one of fewer tables carrying it.",
      forCreators: filling
        ? `${pw.set} shelves are up ${Math.abs(Math.round(median))}% while its print window is closing — that is the reprint conversation, before anyone announces anything.`
        : `${pw.set} is losing stock as its print window closes. That is the "nobody is talking about this" video, and the numbers are already here.`,
      simple: `${pw.set} is late in its printing life, and the number of copies for sale ${filling ? "went up" : "went down"} by about ${Math.abs(Math.round(median))}%. More copies appearing late usually means new stock arriving; fewer copies means the shelf is emptying while it can still be refilled — or that nobody is refilling it.`,
    });
  }
  return rows.sort((a, b) => Math.abs(b.shelfMovePct) - Math.abs(a.shelfMovePct)).slice(0, 12);
})();

const demandData = await J("research/pulse/demand.json").catch(() => null);
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
  ripSellTrade,
  reprintPressure,
  sealedIndex: { ...sealedIndex, valueWeighted }, rawIndex, gradedIndex, netProceeds, packPricing, dealZone, fx, subtypeIndexes, watchOutcomes, supplyShifts: supplyShifts.slice(0,8), ripOrHold, notification,
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
    const SCREAMING_SPREAD = 60;   // raised from 40 — a gap must be extraordinary to outrank a lens      // an outlier worth repeating for
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
      // Was Math.abs(r.spreadPct) — ranking by the retired instrument. Depth
      // is the honest stand-in: a product with more live listings is a better
      // subject than a thin one, and it is measured, not inferred.
      const strength = Math.min(20, (r.ebayListings ?? 0) / 5);
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
    // GAP DE-EMPHASIS (Tyler, 2026-08-23): "we're giving WAY too much weight to
// the gap between TCG and eBay — there is always a gap, and it is often closer
// than it says." Both halves of that were right: the measurement was inflated
// (delivered vs item-only) and the instrument was over-represented. The gap
// lens now sits LAST in the rotation instead of first, and the screaming-deal
// override needs a much higher bar before it can bump a lens pick.
const LENSES = [
      { id: "premium", label: "biggest sealed premium over loose packs",
        pick: () => eligibleAll.map(r => ({ r, p: pm.get(r.id) })).filter(x => x.p?.premium != null && !x.p.thin)
                      .sort((a,b)=>Math.abs(b.p.premium)-Math.abs(a.p.premium))[0]?.r,
        why: r => { const p = pm.get(r.id); return `Sealed carries a ${Math.abs(p.premium)}% ${p.premium>0?"premium over":"discount to"} the cost of its packs bought loose — the widest gap of that kind we track today.`; } },
      { id: "perpack", label: "most expensive rip on the board",
        pick: () => eligibleAll.map(r => ({ r, p: pm.get(r.id) })).filter(x => x.p?.perPack)
                      .sort((a,b)=>b.p.perPack-a.p.perPack)[0]?.r,
        why: r => `Works out to $${pm.get(r.id).perPack} a pack, the most expensive rip we track. A pack at retail runs about $4.49.` },
      { id: "room", label: "widest distance between the cheapest listing and the middle",
        pick: () => eligibleAll.map(r => ({ r, p: prodById.get(r.id) }))
                      .filter(x => x.p?.priceFloorClean && x.p?.priceMedian && x.p.listingCount >= 10)
                      .sort((a,b)=>(b.p.priceMedian/b.p.priceFloorClean)-(a.p.priceMedian/a.p.priceFloorClean))[0]?.r,
        why: r => { const p = prodById.get(r.id); return `Cheapest believable listing $${p.priceFloorClean.toLocaleString("en-US")}, middle of the market $${p.priceMedian.toLocaleString("en-US")}. A floor that far below the median usually rewards patience.`; } },
      { id: "zone", label: "most room in a face-to-face deal",
        // A wide PERCENTAGE on a $5 pack is not a story — $1.50 of room is not a
        // negotiation. Headlines need enough absolute room to matter.
        pick: () => eligibleAll.map(r => ({ r, z: dealZone.byId[r.id] }))
                      .filter(x => x.z?.zoneWidth >= 40)
                      .sort((a,b)=>b.z.zoneWidth-a.z.zoneWidth)[0]?.r,
        why: r => { const z = dealZone.byId[r.id]; return `A seller keeps about $${z.sellerFloor.toLocaleString("en-US")} online; a buyer pays about $${z.buyerCeiling.toLocaleString("en-US")}. Roughly $${z.zoneWidth.toLocaleString("en-US")} of room where a face-to-face trade beats the internet.`; } },
      // The gap lens is gated by the flag registry rather than by being
      // deleted, so the condition lives in exactly one named place
      // (data/flags.json → spread.headline) and a second author cannot add a
      // parallel gate without colliding on the key. Tyler ruled it false on
      // 2026-08-22: the spread is biased in a known direction by an
      // unmeasurable amount — our eBay side includes postage, the TCGplayer
      // side excludes it, and no shipping-inclusive TCG figure is purchasable
      // at any tier. An instrument we cannot correct must not choose what we
      // put in front of readers. Still computed, still a labelled stat on
      // product pages; it just no longer drives a pick.
      ...(flag("spread.headline") ? [{ id: "gap", label: "widest gap between the two markets",
        pick: () => eligibleAll.filter(r => r.signal).sort((a,b)=>Math.abs(b.spreadPct)-Math.abs(a.spreadPct))[0],
        why: r => `The two marketplaces are ${Math.abs(r.spreadPct)}% apart on the same product — eBay at $${r.ebayAskMedian.toLocaleString("en-US")}, TCGplayer at $${(r.tcgMarket||0).toLocaleString("en-US")}. The widest disagreement on the board today.` }] : []),
    ];
    let lensUsed = null, lensPick = null;
    for (let i = 0; i < LENSES.length && !lensPick; i++) {
      const L = rotate(LENSES, i);
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
    // The screaming-deal override is GONE with the gap lens (2026-08-22). It
    // let a large spread bump whatever the lens had chosen, which is the same
    // biased instrument steering the card in through a side door — and the
    // bigger the spread, the more of it was likely the shipping asymmetry
    // rather than a real disagreement. Nothing replaces it: if no lens finds a
    // candidate the existing fallbacks already handle the day.
    let repeatReason = null;
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
        why = "chase";
      }
      if (pick) {
        const L2 = Object.values(lifecycle).find(l=>l.setId && sp.products.some(pp=>pp.setId===l.setId && pp.set===pick.setName));
        const lifeBit = L2 ? ` Its set is ${L2.ageMonths} months old${L2.standardLegal?" and still Standard-legal":""}.` : "";
        rawPick = { name: pick.name, set: pick.setName, price: pick.priceMarket, chip:"READ", reason: "chase",
          explain: `Widely treated as the card ${pick.setName} is priced around, at $${Math.round(pick.priceMarket).toLocaleString("en-US")} ungraded.${lifeBit}` };
      }
    }
    // THIRD SLOT: graded needs a licensed feed. Rather than render a padlock —
    // which advertises absence — promote an instrument we fully own. A shelf
    // move is a different lens from a price gap and a chase.
    const shelfPick = (!gradedPick || gradedPick.gated)
      ? (supplyShifts || []).find(x => !blockedIds.has(x.id) && !isRepeat(x.name)) || null
      : null;
    return {
      // ── GRADED PICK, at last ────────────────────────────────────────
      // This slot has been a padlock or a substitute since the beginning,
      // because we had no graded feed. We do now: completed PSA sale prices,
      // which is why this can carry VERIFIED where a graded ASK could not.
      // Empty until enrichment covers a card whose numbers actually differ —
      // an empty slot is honest and a manufactured one is not.
      graded: (() => {
        const g = (demandData?.gradedPremium ?? []).find(x => x.psa10Count >= 20 && x.tenClears > 0);
        if (!g) return null;
        return { name: g.name, raw: g.raw, psa9: g.psa9, psa10: g.psa10,
          chip: "VERIFIED", reason: "graded",
          explain: g.read, simple: g.simple, basis: g.basis };
      })(),
      shelf: shelfPick ? { name: shelfPick.name, listings: shelfPick.listings, prev: shelfPick.prev,
        dPct: shelfPick.dPct, priceDPct: shelfPick.priceDPct, chip: "READ", reason: "shelf move",
        explain: `Listings moved ${shelfPick.prev} to ${shelfPick.listings} overnight. ${shelfPick.read.split(" — ")[0].charAt(0).toUpperCase() + shelfPick.read.split(" — ")[0].slice(1)}${shelfPick.priceDPct != null ? `, with asks ${shelfPick.priceDPct >= 0 ? "up" : "down"} ${Math.abs(shelfPick.priceDPct)}%` : ""}.` } : null,
      sealed: (() => {
        if (!sealedPick) return null;
        const _rr = repeatReason;
        const L = lifecycle[sealedPick.setId];
        const life = L ? ` The set is ${L.ageMonths} months old (${L.phase.split(" \u2014")[0]}).` : "";
        // tcg and spreadPct are deliberately NOT emitted here (2026-08-22).
        // The card used to lead on the gap and the app rendered a "Spread"
        // stat straight off these fields, which is how a held instrument was
        // still headlining the Today screen after the hold shipped. The lens
        // now supplies whyChosen; explain carries the product's own measured
        // context instead of a cross-market comparison we cannot correct.
        return {
          whyChosen: whyLine, lens: lensId, name: sealedPick.name, ebay: sealedPick.ebayAskMedian,
          listings: sealedPick.ebayListings, chip:"VERIFIED",
          reason: lensUsed && lensId === lensUsed.id ? lensUsed.label : "the day's clearest read on the sealed board",
          explain: `Asking $${(sealedPick.ebayAskMedian||0).toLocaleString("en-US")} across ${sealedPick.ebayListings} live listings.${life}` };
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
await (await import("./heartbeat.mjs")).beat("derived");
console.log(`✓ derived: ${packRows.length} pack-math rows · news-mentioned sets: ${inNews.length} · quiet movers: ${quietMovers.length} (digest: ${digestName})`);
console.log("  priciest pack:", packRows[0]?.name, "$"+packRows[0]?.perPack+"/pack");
console.log("  cheapest pack:", packRows[packRows.length-1]?.name, "$"+packRows[packRows.length-1]?.perPack+"/pack");
