// PkmnPrices read pathways. Pure: the same item, date and limits always return
// the same hit. Each detector sees only rows dated on or before asOf, and an
// eBay comp only once PkmnPrices had ingested it, so a replay has no look-ahead.
// A hit carries the numbers its read states and the dates they come from.
//
// "Sold" means eBay sold comps (PkmnPrices). Supply stays "listings counted".
import {
  addDays, daysBetween, dropHalfPrice, inWindow, isDay, median, pct, pointAtOrBefore, pointNear, round1, round2, upTo,
} from "./series.mjs";

// The four kinds of row a pathway can use, each cut to what was known on asOf.

// Per-item caches. A replay asks for the same windows many times; the rows
// themselves never change inside one run.
const CACHE = new WeakMap();
function cacheOf(ppp) {
  if (!ppp) return null;
  let c = CACHE.get(ppp);
  if (!c) { c = new Map(); CACHE.set(ppp, c); }
  return c;
}

function eligibleComps(item, key, gradedOnly) {
  const cache = cacheOf(item?.ppp);
  const k = `elig|${key}|${item.kind}`;
  if (cache?.has(k)) return cache.get(k);
  const rows = (item?.ppp?.comps || []).filter((c) => {
    if (c.currency !== "USD") return false;
    if (item.kind !== "sealed" && c.attribution !== "exact") return false;
    if (gradedOnly == null ? c.graded : !gradedOnly(c)) return false;
    return true;
  }).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  cache?.set(k, rows);
  return rows;
}

function firstAfter(rows, day) {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].date <= day) lo = mid + 1; else hi = mid; }
  return lo;
}

export function rawComps(item, asOf, days, { gradedOnly = null, key = gradedOnly ? "graded" : "raw" } = {}) {
  const cache = cacheOf(item?.ppp);
  const ck = `win|${key}|${asOf}|${days}|${item?.printing || ""}`;
  if (cache?.has(ck)) return cache.get(ck);
  const rows = eligibleComps(item, key, gradedOnly);
  const from = addDays(asOf, -days);
  const win = [];
  for (let i = firstAfter(rows, from); i < rows.length && rows[i].date <= asOf; i += 1) {
    const c = rows[i];
    if (c.ingested && c.ingested > asOf) continue;
    win.push(c);
  }
  let out = win;
  if (item.kind !== "sealed") {
    if (item.printing) out = win.filter((c) => c.variant === item.printing);
    else out = new Set(win.map((c) => c.variant).filter((v) => v != null)).size <= 1 ? win : [];
  }
  // A truncated comps page (only the newest rows) cannot count a window that
  // starts before its oldest comp.
  const coverFrom = gradedOnly ? item?.ppp?.gradedFrom : item?.ppp?.compsFrom;
  if (isDay(coverFrom) && addDays(from, 1) < coverFrom) out = [];
  // Raw medians compare with a Near Mint market: titles naming a played,
  // damaged, graded or foreign copy are left out and counted. A slab keeps
  // its condition words (the grade is the condition).
  const clean = out.filter((c) => !c.titleFlag || (gradedOnly && c.titleFlag === "condition") || (gradedOnly && c.titleFlag === "graded"));
  clean.titleDropped = out.length - clean.length;
  cache?.set(ck, clean);
  return clean;
}

export function soldMedian(rows, minComps, L = null) {
  const { kept, dropped } = dropHalfPrice(rows);
  if (kept.length < minComps) return null;
  // When the half-price filter has to drop a large share, the window mixes
  // copies (a slab or a lot among raw cards) and no median is trusted.
  const maxShare = L?.maxHalfDropShare ?? 0.25;
  if (dropped.length / (kept.length + dropped.length) > maxShare) return null;
  const dates = kept.map((r) => r.date).sort();
  return { median: round2(median(kept.map((r) => r.price))), n: kept.length, dropped: dropped.length, titleDropped: rows.titleDropped || 0, from: dates[0], to: dates.at(-1) };
}

// Raw daily eBay sold counts, all printings of this product summed.
export function salesByDay(item, asOf) {
  const cache = cacheOf(item?.ppp);
  if (cache?.has(`sales|${asOf}`)) return cache.get(`sales|${asOf}`);
  const map = new Map();
  for (const r of item?.ppp?.volume || []) {
    if (r.graded || r.date > asOf) continue;
    map.set(r.date, (map.get(r.date) || 0) + r.sales);
  }
  cache?.set(`sales|${asOf}`, map);
  return map;
}

function sumSales(map, fromExcl, toIncl) {
  let n = 0;
  for (const [d, v] of map) if (d > fromExcl && d <= toIncl) n += v;
  return n;
}

// Days where sales across every tracked product fell under half the median
// day: a PkmnPrices tracking gap, not a market move. Windows touching one are skipped.
export function thinDaysOf(itemsVolume, L) {
  const totals = new Map();
  let n = 0;
  for (const rows of itemsVolume) {
    if (!rows?.length) continue;
    n += 1;
    for (const r of rows) if (!r.graded) totals.set(r.date, (totals.get(r.date) || 0) + r.sales);
  }
  const out = new Set();
  if (n < (L?.coverageMinItems ?? 20) || totals.size < 14) return out;
  const days = [...totals.keys()].sort();
  // Fill missing days with 0 between the first and last day.
  for (let d = days[0]; d <= days.at(-1); d = addDays(d, 1)) if (!totals.has(d)) totals.set(d, 0);
  const med = median([...totals.values()]);
  for (const [d, v] of totals) if (v < med * (L?.thinDayRatio ?? 0.5)) out.add(d);
  return out;
}

function touchesThin(item, fromExcl, toIncl) {
  const thin = item?.ppp?.thinDays;
  if (!thin?.size) return false;
  for (let d = addDays(fromExcl, 1); d <= toIncl; d = addDays(d, 1)) if (thin.has(d)) return true;
  return false;
}

function volumeFrom(item) {
  if (isDay(item?.ppp?.volumeFrom)) return item.ppp.volumeFrom;
  const days = (item?.ppp?.volume || []).map((r) => r.date).sort();
  return days[0] || "";
}

export function marketNear(item, day, L) {
  return pointNear((item?.points || []).filter((p) => (p.src || "own") === "own"), day, L.marketSlackDays, day);
}

// TCGplayer USD history from PkmnPrices for the printing our own price follows.
export function usdHistory(item, asOf, L) {
  const rows = upTo(item?.ppp?.history || [], asOf).filter((r) => r.currency === "USD" && /tcgplayer/.test(r.source));
  return pickGroup(rows, item, marketNear(item, asOf, L));
}

export function eurHistory(item, asOf) {
  const rows = upTo(item?.ppp?.history || [], asOf).filter((r) => r.currency === "EUR" && /cardmarket/.test(r.source));
  return pickGroup(rows, item, null);
}

function pickGroup(rows, item, anchor) {
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.variant ?? ""}|${r.condition ?? ""}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  if (!groups.size) return [];
  let list = [...groups.entries()];
  if (item?.printing) list = list.filter(([k]) => k.startsWith(`${item.printing}|`));
  if (list.length > 1 && anchor) {
    list = list.filter(([, g]) => {
      const p = pointNear(g, anchor.date, 3, anchor.date);
      return p && Math.abs(pct(anchor.price, p.price)) <= 3;
    });
  }
  if (list.length > 1) {
    const nm = list.filter(([k]) => /\|(Near Mint)?$/.test(k));
    if (nm.length === 1) list = nm;
  }
  if (list.length !== 1) return [];
  return list[0][1].map((r) => ({ date: r.date, price: r.price, variant: r.variant, condition: r.condition }));
}

function popVariant(item, asOf) {
  const rows = upTo(item?.ppp?.pop || [], asOf);
  if (!rows.length) return [];
  const byVariant = new Map();
  for (const r of rows) {
    const k = r.variant ?? "";
    if (!byVariant.has(k)) byVariant.set(k, []);
    byVariant.get(k).push(r);
  }
  if (item?.printing && byVariant.has(item.printing)) return byVariant.get(item.printing);
  // Variants that are one physical print carry the same counts; pick the largest.
  const best = [...byVariant.values()].sort((a, b) => (b.at(-1).total - a.at(-1).total))[0];
  return best;
}

function hit(pathway, dir, metrics, evidence) {
  return { pathway, stage: "seen", dir, metrics, evidence };
}

// 1. eBay sold median vs TCGplayer market.
export function soldGap(item, asOf, L) {
  const c = L.soldGap;
  const sold = soldMedian(rawComps(item, asOf, L.soldWindowDays), c.minComps, L);
  const mkt = marketNear(item, asOf, L);
  if (!sold || !mkt) return null;
  const gap = pct(mkt.price, sold.median);
  if (gap == null || Math.abs(gap) < c.minGapPct || Math.abs(sold.median - mkt.price) < c.minGapUsd) return null;
  // A gap this wide is more often a different printing or condition than a market gap.
  if (Math.abs(gap) > c.maxGapPct) return null;
  return hit("sold-gap", gap > 0 ? "up" : "down",
    { soldMedian: sold.median, comps: sold.n, dropped: sold.dropped, titleDropped: sold.titleDropped, market: mkt.price, marketDate: mkt.date, gapPct: round1(gap) },
    { from: sold.from, to: sold.to, source: "eBay sold comps via PkmnPrices; TCGplayer market" });
}

// 2. Sales pace: last 7 days against the 8 weeks before.
export function soldPace(item, asOf, L) {
  const c = L.soldPace;
  const end = addDays(asOf, -c.lagDays);
  const mid = addDays(end, -c.recentDays);
  const start = addDays(mid, -c.baseDays);
  const from = volumeFrom(item);
  if (!from || from > addDays(start, 7)) return null;
  if (touchesThin(item, start, end)) return null;
  const map = salesByDay(item, asOf);
  if (!map.size) return null;
  const recent = sumSales(map, mid, end);
  const base = sumSales(map, start, mid);
  const weekly = base / (c.baseDays / 7);
  const ratio = weekly > 0 ? recent / weekly : null;
  const metrics = { recent, baseTotal: base, baseWeekly: round1(weekly), ratio: ratio == null ? null : round1(ratio), recentFrom: addDays(mid, 1), recentTo: end, baseFrom: addDays(start, 1), baseTo: mid };
  if (weekly >= c.spikeMinBaseWeekly && recent >= c.spikeMinSales && ratio >= c.spikeRatio) return hit("sold-pace", "up", { ...metrics, move: "spike" }, { from: metrics.baseFrom, to: end, source: "eBay sold comps via PkmnPrices" });
  // A zero week can be a tracking gap on one card; a drop needs a sale in it.
  if (weekly >= c.dropMinBaseWeekly && recent >= c.dropMinRecent && ratio != null && ratio <= c.dropRatio) return hit("sold-pace", "down", { ...metrics, move: "drop" }, { from: metrics.baseFrom, to: end, source: "eBay sold comps via PkmnPrices" });
  return null;
}

// 3. eBay sold median four weeks apart against the TCGplayer market move.
export function soldTrend(item, asOf, L) {
  const c = L.soldTrend;
  const then = addDays(asOf, -L.compareGapDays);
  const now = soldMedian(rawComps(item, asOf, L.soldWindowDays), c.minComps, L);
  const was = soldMedian(rawComps(item, then, L.soldWindowDays), c.minComps, L);
  const m1 = marketNear(item, asOf, L);
  const m0 = marketNear(item, then, L);
  if (!now || !was || !m0 || !m1 || m0.date >= m1.date) return null;
  const soldPct = pct(was.median, now.median);
  const mktPct = pct(m0.price, m1.price);
  if (soldPct == null || mktPct == null) return null;
  const div = soldPct - mktPct;
  if (Math.abs(soldPct) < c.minSoldMovePct || Math.abs(div) < c.minDivergencePts) return null;
  return hit("sold-trend", soldPct > 0 ? "up" : "down",
    { soldThen: was.median, soldNow: now.median, compsThen: was.n, compsNow: now.n, thenFrom: was.from, thenTo: was.to, nowFrom: now.from, nowTo: now.to,
      soldPct: round1(soldPct), market0: m0.price, market0Date: m0.date, market1: m1.price, market1Date: m1.date, marketPct: round1(mktPct), divergencePts: round1(div) },
    { from: was.from, to: now.to, source: "eBay sold comps via PkmnPrices; TCGplayer market" });
}

function listingsNear(item, day) {
  let best = null;
  for (const r of item?.listings || []) {
    if (!isDay(r?.date) || r.date > day || daysBetween(r.date, day) > 3 || !(r.n >= 0)) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best;
}

function throughAt(item, day, L) {
  const c = L.sellThrough;
  const end = addDays(day, -c.lagDays);
  const from = volumeFrom(item);
  if (!from || from > addDays(end, -L.soldWindowDays + 1)) return null;
  if (touchesThin(item, addDays(end, -L.soldWindowDays), end)) return null;
  const list = listingsNear(item, day);
  if (!list || list.n < c.minListings) return null;
  const sold = sumSales(salesByDay(item, day), addDays(end, -L.soldWindowDays), end);
  return { sold, listings: list.n, listingsDate: list.date, ratio: round2(sold / list.n), from: addDays(end, -L.soldWindowDays + 1), to: end };
}

// 4. Sell-through: eBay sold in 14 days per listing counted, four weeks apart.
export function sellThrough(item, asOf, L) {
  const c = L.sellThrough;
  const now = throughAt(item, asOf, L);
  const was = throughAt(item, addDays(asOf, -L.compareGapDays), L);
  if (!now || !was) return null;
  const metrics = { soldNow: now.sold, listingsNow: now.listings, listingsNowDate: now.listingsDate, ratioNow: now.ratio, nowFrom: now.from, nowTo: now.to,
    soldThen: was.sold, listingsThen: was.listings, listingsThenDate: was.listingsDate, ratioThen: was.ratio, thenFrom: was.from, thenTo: was.to };
  if (now.sold >= c.minSold && now.ratio >= c.minLevel && was.ratio > 0 && now.ratio / was.ratio >= c.riseRatio) return hit("sell-through", "up", metrics, { from: was.from, to: now.to, source: "eBay sold comps via PkmnPrices; eBay listings counted" });
  if (was.sold >= c.minSold && was.ratio >= c.minLevel && now.ratio / was.ratio <= c.fallRatio) return hit("sell-through", "down", metrics, { from: was.from, to: now.to, source: "eBay sold comps via PkmnPrices; eBay listings counted" });
  return null;
}

function snapPair(rows, minGap, maxGap) {
  const last = rows.at(-1);
  if (!last) return null;
  const prev = rows.slice(0, -1).reverse().find((r) => {
    const g = daysBetween(r.date, last.date);
    return g >= minGap && g <= maxGap;
  });
  return prev ? { prev, last } : null;
}

// 5. Graded population growth week over week.
export function popGrowth(item, asOf, L) {
  const c = L.popGrowth;
  const pair = snapPair(popVariant(item, asOf), c.minGapDays, c.maxGapDays);
  if (!pair || !(pair.prev.total > 0)) return null;
  const added = pair.last.total - pair.prev.total;
  const growth = (added / pair.prev.total) * 100;
  if (added < c.minNew || growth < c.minPct) return null;
  return hit("pop-growth", "down",
    { variant: pair.last.variant, total0: pair.prev.total, total1: pair.last.total, added, growthPct: round1(growth), gems0: pair.prev.gems, gems1: pair.last.gems, date0: pair.prev.date, date1: pair.last.date, graders: pair.last.graders },
    { from: pair.prev.date, to: pair.last.date, source: "PSA, BGS, CGC and SGC population via PkmnPrices" });
}

// 6. Gem rate shift over four to five weeks.
export function gemShift(item, asOf, L) {
  const c = L.gemShift;
  const pair = snapPair(popVariant(item, asOf), c.minGapDays, c.maxGapDays);
  if (!pair || pair.prev.gemRate == null || pair.last.gemRate == null) return null;
  const added = pair.last.total - pair.prev.total;
  const shift = pair.last.gemRate - pair.prev.gemRate;
  if (added < c.minNewGraded || Math.abs(shift) < c.minShiftPts) return null;
  return hit("gem-rate", shift > 0 ? "up" : "down",
    { variant: pair.last.variant, rate0: pair.prev.gemRate, rate1: pair.last.gemRate, shiftPts: round1(shift), added, total0: pair.prev.total, total1: pair.last.total, date0: pair.prev.date, date1: pair.last.date },
    { from: pair.prev.date, to: pair.last.date, source: "PSA, BGS, CGC and SGC population via PkmnPrices" });
}

// 7. Low gem-grade population against the TCGplayer market move.
export function lowPop(item, asOf, L) {
  const c = L.lowPop;
  const pair = snapPair(popVariant(item, asOf), c.minGapDays, c.maxGapDays);
  if (!pair || pair.last.gems > c.maxGems || !(pair.prev.gems > 0)) return null;
  const m0 = marketNear(item, pair.prev.date, L);
  const m1 = marketNear(item, pair.last.date, L);
  if (!m0 || !m1 || m0.date >= m1.date) return null;
  const pricePct = pct(m0.price, m1.price);
  const gemsPct = ((pair.last.gems - pair.prev.gems) / pair.prev.gems) * 100;
  const metrics = { gems0: pair.prev.gems, gems1: pair.last.gems, gemsPct: round1(gemsPct), date0: pair.prev.date, date1: pair.last.date, market0: m0.price, market0Date: m0.date, market1: m1.price, market1Date: m1.date, pricePct: round1(pricePct) };
  const evidence = { from: pair.prev.date, to: pair.last.date, source: "Graded population via PkmnPrices; TCGplayer market" };
  if (pricePct >= c.priceUpPct && gemsPct <= c.gemsFlatPct) return hit("low-pop", "up", { ...metrics, shape: "price-up-pop-flat" }, evidence);
  if (gemsPct >= c.gemsUpPct && pricePct <= c.priceDownPct) return hit("low-pop", "down", { ...metrics, shape: "pop-up-price-down" }, evidence);
  return null;
}

// 8. PSA 10 eBay sold median over the raw sold median, four weeks apart.
export function gradedSpread(item, asOf, L) {
  const c = L.gradedSpread;
  if (item.kind === "sealed") return null;
  const isGem = (x) => x.graded && x.grader === c.grader && x.grade === c.grade && !x.qualifier;
  const at = (day) => {
    const g = soldMedian(rawComps(item, day, L.soldWindowDays, { gradedOnly: isGem, key: `gem|${c.grader}|${c.grade}` }), c.minGraded, L);
    const r = soldMedian(rawComps(item, day, L.soldWindowDays), c.minRaw, L);
    if (!g || !r || !(r.median > 0)) return null;
    return { graded: g, raw: r, multiple: round2(g.median / r.median) };
  };
  const now = at(asOf);
  const was = at(addDays(asOf, -L.compareGapDays));
  if (!now || !was) return null;
  const change = pct(was.multiple, now.multiple);
  if (change == null || Math.abs(change) < c.minChangePct) return null;
  return hit("graded-spread", change > 0 ? "up" : "down",
    { grader: c.grader, grade: c.grade, gradedNow: now.graded.median, gradedNowN: now.graded.n, rawNow: now.raw.median, rawNowN: now.raw.n, multipleNow: now.multiple,
      gradedThen: was.graded.median, rawThen: was.raw.median, multipleThen: was.multiple, changePct: round1(change),
      nowFrom: [now.graded.from, now.raw.from].sort()[0], nowTo: [now.graded.to, now.raw.to].sort().at(-1), thenTo: [was.graded.to, was.raw.to].sort().at(-1) },
    { from: [was.graded.from, was.raw.from].sort()[0], to: [now.graded.to, now.raw.to].sort().at(-1), source: "eBay sold comps via PkmnPrices" });
}

function fxOn(fx, day, slack) {
  return pointAtOrBefore((fx || []).map((r) => ({ date: r.date, price: r.usdPerEur })), day, slack);
}

function euGapAt(item, day, L, fx) {
  const c = L.euGap;
  const usd = marketNear(item, day, L);
  if (!usd) return null;
  const eu = pointNear(eurHistory(item, day), day, c.euSlackDays, day);
  if (!eu) return null;
  const rate = fxOn(fx, eu.date, c.fxSlackDays);
  if (!rate) return null;
  const usdEq = round2(eu.price * rate.price);
  return { usd: usd.price, usdDate: usd.date, eur: eu.price, eurDate: eu.date, fx: rate.price, fxDate: rate.date, usdEq, gapPct: round1(pct(usd.price, usdEq)) };
}

// 9. Cardmarket (EUR at the ECB rate) against TCGplayer, a gap that moved.
export function euGap(item, asOf, L, ctx = {}) {
  const c = L.euGap;
  const now = euGapAt(item, asOf, L, ctx.fx);
  const was = euGapAt(item, addDays(asOf, -L.compareGapDays), L, ctx.fx);
  if (!now || !was || now.gapPct == null || was.gapPct == null) return null;
  const move = now.gapPct - was.gapPct;
  if (Math.abs(now.gapPct) < c.minGapPct || Math.abs(move) < c.minGapMovePts) return null;
  return hit("eu-gap", now.gapPct > 0 ? "up" : "down",
    { ...Object.fromEntries(Object.entries(now).map(([k, v]) => [`${k}Now`, v])), ...Object.fromEntries(Object.entries(was).map(([k, v]) => [`${k}Then`, v])), gapMovePts: round1(move) },
    { from: was.eurDate, to: now.eurDate, source: "Cardmarket via PkmnPrices; ECB euro reference rate; TCGplayer market" });
}

// 10. Japanese printing against the English card over 30 days.
export function jpEn(item, asOf, L) {
  const c = L.jpEn;
  const jp = upTo(item?.ppp?.jp || [], asOf);
  if (!jp.length) return null;
  const currencies = new Set(jp.map((r) => r.currency));
  if (currencies.size !== 1) return null;
  const from = addDays(asOf, -c.windowDays);
  const jpWin = jp.filter((r) => r.date >= from);
  const enWin = (item.points || []).filter((p) => (p.src || "own") === "own" && p.date >= from && p.date <= asOf);
  if (jpWin.length < c.minPoints || enWin.length < c.minPoints) return null;
  const j0 = pointNear(jp, from, 3, asOf);
  const j1 = pointNear(jp, asOf, 3, asOf);
  const e0 = pointNear(enWin, from, 3, asOf);
  const e1 = marketNear(item, asOf, L);
  if (!j0 || !j1 || !e0 || !e1 || j0.date >= j1.date || e0.date >= e1.date) return null;
  const jpPct = pct(j0.price, j1.price);
  const enPct = pct(e0.price, e1.price);
  const div = jpPct - enPct;
  if (Math.abs(div) < c.minDivergencePts) return null;
  return hit("jp-en", div > 0 ? "up" : "down",
    { jpCurrency: [...currencies][0], jp0: j0.price, jp0Date: j0.date, jp1: j1.price, jp1Date: j1.date, jpPct: round1(jpPct), en0: e0.price, en0Date: e0.date, en1: e1.price, en1Date: e1.date, enPct: round1(enPct), divergencePts: round1(div) },
    { from: [j0.date, e0.date].sort()[0], to: [j1.date, e1.date].sort().at(-1), source: "Japanese card prices via PkmnPrices; TCGplayer market" });
}

// 11. 52-week high or low on a year of TCGplayer market history.
export function range52(item, asOf, L) {
  const c = L.range52;
  const now = marketNear(item, asOf, L);
  if (!now) return null;
  const own = new Map((item.points || []).filter((p) => (p.src || "own") === "own" && p.date <= asOf).map((p) => [p.date, p.price]));
  const hist = usdHistory(item, asOf, L);
  const merged = new Map(hist.map((p) => [p.date, p.price]));
  for (const [d, v] of own) merged.set(d, v);
  const start = addDays(asOf, -365);
  const cut = addDays(asOf, -c.excludeRecentDays);
  const prior = [...merged.entries()].filter(([d]) => d >= start && d < cut).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (prior.length < c.minPoints || daysBetween(prior[0][0], asOf) < c.minCoverDays) return null;
  let hi = prior[0];
  let lo = prior[0];
  for (const p of prior) { if (p[1] > hi[1]) hi = p; if (p[1] < lo[1]) lo = p; }
  const metrics = { price: now.price, date: now.date, coverFrom: prior[0][0], points: prior.length, high: hi[1], highDate: hi[0], low: lo[1], lowDate: lo[0], historyPoints: hist.length };
  const evidence = { from: prior[0][0], to: now.date, source: "TCGplayer market (own days, and PkmnPrices history before them)" };
  if (now.price > hi[1] * 1.01) return hit("range52", "up", { ...metrics, edge: "high", pctPast: round1(pct(hi[1], now.price)) }, evidence);
  if (now.price < lo[1] * 0.99) return hit("range52", "down", { ...metrics, edge: "low", pctPast: round1(pct(lo[1], now.price)) }, evidence);
  return null;
}

// 12. Sealed eBay sold median against its sourced MSRP.
export function msrpSold(item, asOf, L, ctx = {}) {
  const c = L.msrpSold;
  if (item.kind !== "sealed") return null;
  const msrp = ctx.msrp?.get?.(item.pid);
  if (!msrp || !(msrp.usd > 0)) return null;
  const now = soldMedian(rawComps(item, asOf, c.windowDays), c.minComps, L);
  if (!now) return null;
  const ratio = round2(now.median / msrp.usd);
  const was = soldMedian(rawComps(item, addDays(asOf, -L.compareGapDays), c.windowDays), c.minComps, L);
  const ratioThen = was ? round2(was.median / msrp.usd) : null;
  const move = ratioThen ? pct(ratioThen, ratio) : null;
  const level = ratio >= c.highRatio ? "above" : ratio <= c.lowRatio ? "below" : "";
  if (!level) return null;
  const dir = move != null && Math.abs(move) >= c.minRatioMovePct ? (move > 0 ? "up" : "down") : "";
  return hit("msrp-sold", dir,
    { soldMedian: now.median, comps: now.n, dropped: now.dropped, titleDropped: now.titleDropped, msrp: msrp.usd, msrpSource: msrp.source, msrpChecked: msrp.checked, ratio, ratioThen, ratioMovePct: move == null ? null : round1(move), level },
    { from: now.from, to: now.to, source: "eBay sold comps via PkmnPrices; sourced US MSRP" });
}

export const PATHWAYS = [
  { id: "sold-gap", run: soldGap },
  { id: "sold-pace", run: soldPace },
  { id: "sold-trend", run: soldTrend },
  { id: "sell-through", run: sellThrough },
  { id: "pop-growth", run: popGrowth },
  { id: "gem-rate", run: gemShift },
  { id: "low-pop", run: lowPop },
  { id: "graded-spread", run: gradedSpread },
  { id: "eu-gap", run: euGap },
  { id: "jp-en", run: jpEn },
  { id: "range52", run: range52 },
  { id: "msrp-sold", run: msrpSold },
];

export function runPathways(item, asOf, L, ctx = {}) {
  const out = [];
  for (const p of PATHWAYS) {
    try {
      const h = p.run(item, asOf, L, ctx);
      if (h) out.push(h);
    } catch (err) {
      out.push({ pathway: p.id, error: String(err?.message || err) });
    }
  }
  return out;
}
