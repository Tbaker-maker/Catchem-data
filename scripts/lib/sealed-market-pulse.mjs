// Sealed market pulse math. Limits come from the caller. This file has no cutoff numbers.
// A missing price stays missing. It is never written as 0%.

export const LIMIT_KEYS = ["flatAbsPct", "minMonthsForZ", "zQuiet", "zMid", "zCap", "colorMax", "minMonthsToInclude", "heatmapMonths"];

const BANNED = /(\bsold\b|\bsales?\b|\bbuy\b|\bsell\b|\bshould\b|\binvest\w*|\brecommend\w*|\u2013|\u2014)/i;

export function limitsOk(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  for (const k of LIMIT_KEYS) {
    if (typeof cfg[k] !== "number" || !Number.isFinite(cfg[k])) return false;
  }
  if (!Array.isArray(cfg.productOrder) || cfg.productOrder.length < 1) return false;
  if (typeof cfg.productTieBreak !== "string" || !cfg.productTieBreak) return false;
  const chase = cfg.chase;
  if (!chase || chase.pick !== "highest-market" || typeof chase.condition !== "string" || !chase.condition) return false;
  if (typeof chase.tieBreak !== "string" || !chase.tieBreak) return false;
  if (cfg.heatmapMonths < 1 || cfg.minMonthsForZ < 2 || cfg.flatAbsPct < 0 || cfg.zCap <= 0) return false;
  if (!(cfg.zQuiet < cfg.zMid && cfg.zMid < cfg.zCap)) return false;
  if (!(cfg.colorMax > 0 && cfg.colorMax <= 1)) return false;
  if (typeof cfg.ownMonthsBeforeCutover !== "number" || !Number.isFinite(cfg.ownMonthsBeforeCutover) || cfg.ownMonthsBeforeCutover < 1) return false;
  if (typeof cfg.mirrorGapPct !== "number" || !Number.isFinite(cfg.mirrorGapPct) || cfg.mirrorGapPct < 0) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cfg.archiveNoteDate || ""))) return false;
  return true;
}

export function assertLimits(cfg) {
  if (!limitsOk(cfg)) {
    const err = new Error("pulse limits not loaded");
    err.code = "LIMITS_MISSING";
    throw err;
  }
  return cfg;
}

const NOTE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function noteDate(iso) {
  const [y, m, d] = String(iso || "").split("-");
  const month = NOTE_MONTHS[Number(m) - 1];
  if (!month || !y || !d) return null;
  return `${month} ${Number(d)} ${y}`;
}

export function archiveAbout(iso) {
  const shown = noteDate(iso);
  if (!shown) return null;
  return `History before ${shown} comes from archived TCGplayer market prices.`;
}

export function ownOnlyAbout() {
  return "This product has no archived history, so the chart uses our own prices only.";
}

export function ownMonthSpan(points) {
  const dates = (points || []).map((p) => p && p.date).filter(Boolean).sort();
  if (!dates.length) return 0;
  const [ay, am] = dates[0].slice(0, 7).split("-").map(Number);
  const [by, bm] = dates[dates.length - 1].slice(0, 7).split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// Mirror rows are [date, price] or {date, price}.
// archiveNoteDate is the first Catch'em own day (Tyler: 2026-10-14).
// Mirror fills every day strictly before that date. Own prices on or after
// that date are kept. Own prices before the cutover are not mixed into the
// mirror window, so month ends stay on the archived calendar day.
// A gap over the private limit is returned, not used as the price.
export function joinMirror(own, mirrorRows, limits) {
  assertLimits(limits);
  const cutDate = String(limits.archiveNoteDate);
  const mineAll = (own || [])
    .filter((p) => p && p.date && p.price != null && Number.isFinite(p.price))
    .map((p) => ({ date: p.date, price: p.price, source: p.source || "own" }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const mine = mineAll.filter((p) => p.date >= cutDate);
  const gaps = [];
  if (!mineAll.length && !(mirrorRows || []).length) {
    return { points: [], usedMirror: false, ownMonths: 0, gaps, about: ownOnlyAbout() };
  }
  const ownMonths = ownMonthSpan(mine);
  const mirror = new Map();
  for (const row of mirrorRows || []) {
    const date = Array.isArray(row) ? row[0] : row && row.date;
    const price = Array.isArray(row) ? Number(row[1]) : Number(row && row.price);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(price) || price <= 0) continue;
    if (date >= cutDate) continue;
    mirror.set(date, price);
  }
  const dropMirror = ownMonths >= limits.ownMonthsBeforeCutover;
  if (dropMirror || !mirror.size) {
    if (!mine.length) return { points: [], usedMirror: false, ownMonths, gaps, about: ownOnlyAbout() };
    return { points: mine, usedMirror: false, ownMonths, gaps, about: ownOnlyAbout() };
  }
  // Gap check on shared dates in the mirror window (own prints that fell before cutover).
  for (const early of mineAll) {
    if (early.date >= cutDate) continue;
    if (!mirror.has(early.date)) continue;
    const archived = mirror.get(early.date);
    const gap = pctChange(archived, early.price);
    if (gap != null && Math.abs(gap) > limits.mirrorGapPct) {
      gaps.push({ date: early.date, archived, ours: early.price, gapPct: round4(gap) });
    }
  }
  const byDate = new Map();
  for (const [date, price] of mirror) {
    byDate.set(date, { date, price, source: "archived-market" });
  }
  for (const p of mine) byDate.set(p.date, p);
  const points = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!points.length) return { points: [], usedMirror: false, ownMonths, gaps, about: ownOnlyAbout() };
  const usedMirror = points.some((p) => p.source === "archived-market");
  return {
    points,
    usedMirror,
    ownMonths,
    gaps,
    about: usedMirror ? archiveAbout(limits.archiveNoteDate) : ownOnlyAbout(),
  };
}

export function yearAgo(points) {
  const real = (points || [])
    .filter((p) => p && p.date && p.price != null && Number.isFinite(p.price))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!real.length) return { pct: null };
  const cur = real[real.length - 1];
  const [y, m, d] = cur.date.split("-").map(Number);
  const target = new Date(Date.UTC(y - 1, m - 1, d)).toISOString().slice(0, 10);
  let prior = null;
  for (const p of real) {
    if (p.date <= target) prior = p;
    else break;
  }
  if (!prior) return { pct: null, target, current: cur.price, currentDate: cur.date };
  return {
    pct: round4(pctChange(prior.price, cur.price)),
    priorDate: prior.date,
    priorPrice: prior.price,
    current: cur.price,
    currentDate: cur.date,
    target,
  };
}

export function priceBasket(rows, fromMonth, toMonth) {
  let fromSum = 0;
  let toSum = 0;
  let n = 0;
  const excluded = [];
  for (const r of rows || []) {
    const a = (r.cells || []).find((c) => c.month === fromMonth);
    const b = (r.cells || []).find((c) => c.month === toMonth);
    if (!a || a.price == null || !b || b.price == null) {
      excluded.push(r.set);
      continue;
    }
    fromSum += a.price;
    toSum += b.price;
    n += 1;
  }
  return {
    from: fromMonth,
    to: toMonth,
    method: "sum of month-end prices",
    products: n,
    excluded,
    pct: n ? round4(pctChange(fromSum, toSum)) : null,
  };
}

export function round4(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function pctChange(from, to) {
  if (from == null || to == null || !Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

export function mean(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x));
  if (!v.length) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

export function median(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  if (v.length % 2) return v[mid];
  return (v[mid - 1] + v[mid]) / 2;
}

export function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthSpan(endMonth, count) {
  const out = [];
  for (let i = count - 1; i >= 0; i--) out.push(addMonths(endMonth, -i));
  return out;
}

export function directionOf(pct, flatAbsPct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (Math.abs(pct) < flatAbsPct) return "flat";
  return pct > 0 ? "up" : "down";
}

export function dayNumberToIso(n) {
  const d = new Date(Date.UTC(1970, 0, 1) + Number(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

export function parseHistRow(row) {
  if (!row) return [];
  const out = [];
  for (const part of String(row).split(",")) {
    if (!part) continue;
    const i = part.indexOf(":");
    if (i < 1) continue;
    const day = Number(part.slice(0, i));
    const price = Number(part.slice(i + 1));
    if (!Number.isFinite(day) || !Number.isFinite(price)) continue;
    out.push({ date: dayNumberToIso(day), price, source: "hist-long" });
  }
  return out;
}

export function monthEnds(points) {
  const out = new Map();
  for (const p of points || []) {
    if (!p || !p.date || p.price == null || !Number.isFinite(p.price)) continue;
    const month = p.date.slice(0, 7);
    const prev = out.get(month);
    if (!prev || p.date > prev.date) out.set(month, { date: p.date, price: p.price, source: p.source || null });
    else if (p.date === prev.date && p.source && p.source !== prev.source) {
      // same day, two sources: keep the one already stored (caller applies priority first)
    }
  }
  return out;
}

export function mergePoints(lists) {
  // later lists win on the same date. Never average.
  const byDate = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (!p || !p.date || p.price == null || !Number.isFinite(p.price)) continue;
      byDate.set(p.date, { date: p.date, price: p.price, source: p.source || null });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}

export function changesFor(ends, months, flatAbsPct) {
  return months.map((month, i) => {
    const cur = ends.get(month) || null;
    const prevMonth = i === 0 ? addMonths(month, -1) : months[i - 1];
    const prev = ends.get(prevMonth) || null;
    const pct = cur && prev ? pctChange(prev.price, cur.price) : null;
    let missing = null;
    if (pct == null) missing = !cur ? "no price" : "no prior month";
    return {
      month,
      pct: round4(pct),
      direction: directionOf(pct, flatAbsPct),
      price: cur ? cur.price : null,
      priceDate: cur ? cur.date : null,
      priceSource: cur ? cur.source : null,
      prevPrice: prev ? prev.price : null,
      prevDate: prev ? prev.date : null,
      missing,
    };
  });
}

export function zScores(changes, minMonths) {
  const vals = changes.map((c) => c.pct).filter((x) => x != null);
  if (vals.length < minMonths) return changes.map(() => null);
  const mu = mean(vals);
  const sd = Math.sqrt(vals.reduce((s, x) => s + (x - mu) ** 2, 0) / vals.length);
  if (!sd) return changes.map(() => null);
  return changes.map((c) => (c.pct == null ? null : round4((c.pct - mu) / sd)));
}

export function priorYears(ends, month, flatAbsPct) {
  const cal = month.slice(5);
  const year = Number(month.slice(0, 4));
  const out = [];
  for (const [m, row] of ends) {
    if (!m.endsWith("-" + cal)) continue;
    const y = Number(m.slice(0, 4));
    if (y >= year) continue;
    const prev = ends.get(addMonths(m, -1));
    const pct = prev ? pctChange(prev.price, row.price) : null;
    out.push({
      month: m,
      pct: round4(pct),
      direction: directionOf(pct, flatAbsPct),
      priceDate: row.date,
    });
  }
  out.sort((a, b) => a.month < b.month ? -1 : 1);
  return out;
}

export function listingsChange(listings, month, prevMonth) {
  const cur = lastOnOrInMonth(listings, month);
  const prev = lastOnOrInMonth(listings, prevMonth);
  if (!cur || !prev || prev.count == null || cur.count == null || prev.count === 0) return { listingsPct: null, listingsDate: cur ? cur.date : null, listingsCount: cur ? cur.count : null };
  return {
    listingsPct: round4(pctChange(prev.count, cur.count)),
    listingsDate: cur.date,
    listingsCount: cur.count,
    listingsPrevDate: prev.date,
    listingsPrevCount: prev.count,
  };
}

function lastOnOrInMonth(rows, month) {
  let best = null;
  for (const r of rows || []) {
    if (!r || !r.date || !r.date.startsWith(month)) continue;
    if (r.count == null || !Number.isFinite(r.count)) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best;
}

export function streakFrom(changes, ends, flatAbsPct) {
  if (!changes || !changes.length) return null;
  let i = changes.length - 1;
  if (changes[i].pct == null) return null;
  const dir = changes[i].direction;
  if (!dir) return null;
  const run = [];
  while (i >= 0 && changes[i].direction === dir) {
    run.push(changes[i]);
    i--;
  }
  run.reverse();
  let factor = 1;
  for (const c of run) factor *= 1 + c.pct / 100;
  const total = (factor - 1) * 100;
  const end = ends.get(run[run.length - 1].month);
  return {
    direction: dir,
    months: run.length,
    totalPct: round4(total),
    fromMonth: run[0].month,
    toMonth: run[run.length - 1].month,
    endDate: end ? end.date : null,
  };
}

export function compoundPct(pcts) {
  if (pcts.some((p) => p == null)) return null;
  let factor = 1;
  for (const p of pcts) factor *= 1 + p / 100;
  return (factor - 1) * 100;
}

export function pickRepresentative(products, limits) {
  const groups = new Map();
  for (const p of products) {
    if (!p || !p.setId || !p.subtype) continue;
    if (!limits.productOrder.includes(p.subtype)) continue;
    const list = groups.get(p.setId) || [];
    list.push(p);
    groups.set(p.setId, list);
  }
  const rows = [];
  for (const [setId, list] of groups) {
    list.sort((a, b) => {
      const oa = limits.productOrder.indexOf(a.subtype);
      const ob = limits.productOrder.indexOf(b.subtype);
      if (oa !== ob) return oa - ob;
      if (limits.productTieBreak === "id") return String(a.id).localeCompare(String(b.id));
      return 0;
    });
    rows.push(list[0]);
  }
  return rows;
}

export function highBelow(points) {
  const real = (points || []).filter((p) => p && p.price != null && Number.isFinite(p.price) && p.date);
  if (!real.length) return null;
  let high = real[0];
  let cur = real[0];
  const months = new Set();
  for (const p of real) {
    months.add(p.date.slice(0, 7));
    if (p.price > high.price || (p.price === high.price && p.date < high.date)) high = p;
    if (p.date > cur.date) cur = p;
  }
  return {
    current: cur.price,
    currentDate: cur.date,
    currentSource: cur.source || null,
    high: high.price,
    highDate: high.date,
    highSource: high.source || null,
    belowUsd: round4(high.price - cur.price),
    belowPct: round4(pctChange(high.price, cur.price)),
    monthsTracked: months.size,
  };
}

export function indexLine(sealedEnds, singleEndsList, baseMonth, endMonth) {
  const months = [];
  let m = baseMonth;
  while (m <= endMonth) {
    months.push(m);
    m = addMonths(m, 1);
  }
  const sealedBase = sealedEnds.get(baseMonth);
  const basket = (singleEndsList || []).filter((e) => e && e.get(baseMonth)?.price != null);
  const singleBase = median(basket.map((e) => e.get(baseMonth).price));
  const points = months.map((month) => {
    const sp = sealedEnds.get(month);
    const singles = basket.map((e) => e.get(month)?.price).filter((x) => x != null);
    const sm = median(singles);
    return {
      month,
      sealed: sealedBase && sp ? round4((sp.price / sealedBase.price) * 100) : null,
      singles: singleBase != null && sm != null ? round4((sm / singleBase) * 100) : null,
      sealedPrice: sp ? sp.price : null,
      sealedDate: sp ? sp.date : null,
      singlesMedian: sm == null ? null : round4(sm),
      singlesN: singles.length,
    };
  });
  const last = points[points.length - 1];
  return {
    baseMonth,
    baseMissing: !sealedBase || singleBase == null,
    sealedBaseDate: sealedBase ? sealedBase.date : null,
    points,
    sealedTrailingPct: last && last.sealed != null ? round4(last.sealed - 100) : null,
    singlesTrailingPct: last && last.singles != null ? round4(last.singles - 100) : null,
  };
}

export function fromHigh(ends, endMonth, window) {
  const months = monthSpan(endMonth, window);
  let high = null;
  let cur = ends.get(endMonth) || null;
  let n = 0;
  for (const m of months) {
    const row = ends.get(m);
    if (!row) continue;
    n++;
    if (!high || row.price > high.price) high = { ...row, month: m };
  }
  if (!cur || !high) return { pct: null, highDate: high ? high.date : null, monthsOnFile: n, window };
  return {
    pct: round4(pctChange(high.price, cur.price)),
    high: high.price,
    highDate: high.date,
    highMonth: high.month,
    current: cur.price,
    currentDate: cur.date,
    monthsOnFile: n,
    window,
  };
}

export function breadthBlock(rows, month, prevMonth) {
  const cells = rows.map((r) => {
    const cell = (r.cells || []).find((c) => c.month === month) || null;
    return { id: r.id, name: r.set, cell };
  });
  const known = cells.filter((x) => x.cell && x.cell.pct != null);
  const up = known.filter((x) => x.cell.direction === "up");
  const down = known.filter((x) => x.cell.direction === "down");
  const flat = known.filter((x) => x.cell.direction === "flat");
  const pcts = known.map((x) => x.cell.pct);
  const total = rows.length;
  return {
    month,
    green: up.length,
    total,
    withPrice: known.length,
    missing: total - known.length,
    greenPct: known.length && total ? round4((up.length / total) * 100) : null,
    up: up.length,
    flat: flat.length,
    down: down.length,
    average: round4(mean(pcts)),
    median: round4(median(pcts)),
    prevMonth,
  };
}

export function whatChanged(cur, prev) {
  if (!cur || !prev || cur.greenPct == null || prev.greenPct == null || cur.average == null || prev.average == null) {
    return "A month is missing, so the breadth compare is missing.";
  }
  const moreUp = cur.greenPct > prev.greenPct;
  const fewerUp = cur.greenPct < prev.greenPct;
  const avgWeaker = cur.average < prev.average;
  const avgStronger = cur.average > prev.average;
  if (moreUp && avgWeaker) return "More products are up than last month, but the average move is weaker.";
  if (fewerUp && avgStronger) return "Fewer products are up than last month, but the average move is stronger.";
  if (moreUp && avgStronger) return "More products are up than last month, and the average move is stronger.";
  if (fewerUp && avgWeaker) return "Fewer products are up than last month, and the average move is weaker.";
  if (cur.greenPct === prev.greenPct && cur.average === prev.average) return "Breadth and the average are unchanged from last month.";
  return "Breadth and the average did not split this month.";
}

export function leadLine(aName, aPct, bName, bPct, flatAbsPct) {
  if (aPct == null || bPct == null) return "One side is missing a price on the shared start, so the lead is missing.";
  if (Math.abs(aPct - bPct) < flatAbsPct) return `${aName} and ${bName} are level over this window.`;
  if (aPct > bPct) return `${aName} is ahead of ${bName} over this window.`;
  return `${bName} is ahead of ${aName} over this window.`;
}

export function colorStrength(z, limits) {
  if (z == null || !Number.isFinite(z)) return 0;
  const a = Math.abs(z);
  if (a < limits.zQuiet) return 0;
  if (a >= limits.zCap) return round4(limits.colorMax);
  const mid = limits.colorMax / 2;
  if (a <= limits.zMid) {
    const span = limits.zMid - limits.zQuiet;
    const t = span > 0 ? (a - limits.zQuiet) / span : 1;
    return round4(t * mid);
  }
  const span = limits.zCap - limits.zMid;
  const t = span > 0 ? (a - limits.zMid) / span : 1;
  return round4(mid + t * (limits.colorMax - mid));
}

export function guardProse(text) {
  if (BANNED.test(text || "")) {
    const err = new Error("banned wording");
    err.code = "WORDING";
    throw err;
  }
  return text;
}

function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    const as = a.streak;
    const bs = b.streak;
    const av = as && as.totalPct != null ? Math.abs(as.totalPct) : -1;
    const bv = bs && bs.totalPct != null ? Math.abs(bs.totalPct) : -1;
    if (bv !== av) return bv - av;
    const am = as ? as.months : 0;
    const bm = bs ? bs.months : 0;
    if (bm !== am) return bm - am;
    return String(a.set).localeCompare(String(b.set));
  });
}

export function buildFromSeries({ products, eras, months, marketChanges, limits, singlesBySet, built }) {
  assertLimits(limits);
  const sourceById = new Map();
  const rows = [];
  for (const p of products) {
    const pricedMonths = (p.changes || []).filter((c) => c.price != null).length;
    if (pricedMonths < limits.minMonthsToInclude) continue;
    sourceById.set(p.id, p);
    const zs = zScores(p.changes, limits.minMonthsForZ);
    const cells = p.changes.map((c, i) => {
      const mkt = marketChanges.get(c.month);
      const vs = c.pct != null && mkt != null ? round4(c.pct - mkt) : null;
      const list = p.listings ? listingsChange(p.listings, c.month, addMonths(c.month, -1)) : { listingsPct: null };
      return {
        ...c,
        vsMarket: vs,
        z: zs[i],
        color: colorStrength(zs[i], limits),
        listingsPct: list.listingsPct ?? null,
        listingsCount: list.listingsCount ?? null,
        listingsDate: list.listingsDate ?? null,
        priorYears: priorYears(p.ends, c.month, limits.flatAbsPct),
      };
    });
    const streak = streakFrom(cells, p.ends, limits.flatAbsPct);
    if (p.about) guardProse(p.about);
    rows.push({
      id: p.id,
      name: p.name,
      set: p.set,
      setId: p.setId,
      type: p.subtype,
      era: eras.get(p.setId) || eras.get(norm(p.set)) || null,
      image: p.image || null,
      logo: p.logo || null,
      tcgPlayerId: p.tcgPlayerId || null,
      tcgUrl: p.tcgPlayerId ? `https://www.tcgplayer.com/product/${p.tcgPlayerId}` : null,
      ebayUrl: p.searchQuery ? `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(p.searchQuery)}` : null,
      about: p.about || null,
      usedMirror: p.usedMirror === true,
      streak,
      cells,
    });
  }
  const sorted = sortRows(rows);
  const byEra = new Map();
  for (const r of sorted) {
    if (r.type !== "booster-box" || !r.era) continue;
    const list = byEra.get(r.era) || [];
    list.push(r);
    byEra.set(r.era, list);
  }
  const end = months[months.length - 1];
  const prev = months[months.length - 2] || addMonths(end, -1);
  const breadth = [];
  for (const [era, list] of byEra) {
    const cur = breadthBlock(list, end, prev);
    const last = breadthBlock(list, prev, addMonths(prev, -1));
    const line = whatChanged(cur, last);
    guardProse(line);
    const ranked = list
      .map((r) => {
        const cell = r.cells.find((c) => c.month === end);
        return { id: r.id, set: r.set, pct: cell ? cell.pct : null, direction: cell ? cell.direction : null, priceDate: cell ? cell.priceDate : null };
      })
      .sort((a, b) => {
        if (a.pct == null && b.pct == null) return 0;
        if (a.pct == null) return 1;
        if (b.pct == null) return -1;
        return b.pct - a.pct;
      });
    const basket = priceBasket(list, addMonths(end, -4), end);
    breadth.push({ era, type: "booster-box", current: cur, previous: last, whatChanged: line, ranked, basket });
  }
  breadth.sort((a, b) => (a.era === "Sword & Shield" ? -1 : b.era === "Sword & Shield" ? 1 : a.era.localeCompare(b.era)));

  const pairs = [];
  for (const r of sorted) {
    const src = sourceById.get(r.id);
    const singles = singlesBySet.get(r.setId) || [];
    const singleEnds = singles.map((s) => s.ends);
    const line = indexLine(src.ends, singleEnds, addMonths(end, -limits.heatmapMonths), end);
    const high = fromHigh(src.ends, end, limits.heatmapMonths);
    const chase = pickChase(singles, limits);
    const chaseHigh = chase ? highBelow(chase.points) : null;
    const sealedCard = highBelow(src.points);
    const year = yearAgo(src.points);
    const sharedStart = addMonths(end, -limits.heatmapMonths);
    const sealedAtStart = src.ends.get(sharedStart);
    const chaseAtStart = chase ? chase.ends.get(sharedStart) : null;
    const chaseNow = chase ? chase.ends.get(end) : null;
    const sealedNow = src.ends.get(end);
    const sealedFromStart = sealedAtStart && sealedNow ? round4(pctChange(sealedAtStart.price, sealedNow.price)) : null;
    const chaseFromStart = chaseAtStart && chaseNow ? round4(pctChange(chaseAtStart.price, chaseNow.price)) : null;
    const singlesLead = leadLine("Singles", line.singlesTrailingPct, "the sealed product", line.sealedTrailingPct, limits.flatAbsPct);
    const chaseLead = leadLine("The chase card", chaseFromStart, "the sealed product", sealedFromStart, limits.flatAbsPct);
    guardProse(singlesLead);
    guardProse(chaseLead);
    const chaseCard = chase ? {
      id: chase.id,
      name: chase.name,
      number: chase.number,
      condition: limits.chase.condition,
      price: chaseNow ? chaseNow.price : (chaseHigh ? chaseHigh.current : null),
      priceDate: chaseNow ? chaseNow.date : (chaseHigh ? chaseHigh.currentDate : null),
      source: chaseNow ? chaseNow.source : null,
      tcgUrl: chase.tcgUrl || null,
      ebayUrl: chase.ebayUrl || null,
      high: chaseHigh,
      fromStartPct: chaseFromStart,
      startDate: chaseAtStart ? chaseAtStart.date : null,
      spark: [...chase.ends.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([month, row]) => ({ month, price: row.price, date: row.date })),
    } : null;
    pairs.push({
      setId: r.setId,
      set: r.set,
      productId: r.id,
      line,
      high,
      sealedCard,
      sealedSeries: seriesFromEnds(src.ends),
      singlesLead,
      chaseLead,
      chase: chaseCard,
      sealedFromStartPct: sealedFromStart,
      sealedStartDate: sealedAtStart ? sealedAtStart.date : null,
      year,
    });
  }

  const missingCells = [];
  for (const r of sorted) {
    for (const c of r.cells) {
      if (c.pct == null) missingCells.push({ id: r.id, set: r.set, month: c.month, reason: c.missing || "missing" });
    }
  }
  const label = "Sealed market pulse. Each month uses the last dated price in that month. A month with no price is missing. Flag off.";
  guardProse(label);
  for (const b of breadth) guardProse(b.whatChanged);
  return {
    flag: "off",
    private: true,
    built,
    label,
    limits: "loaded",
    months,
    marketMedian: Object.fromEntries([...marketChanges.entries()].map(([k, v]) => [k, round4(v)])),
    rows: sorted,
    breadth,
    pairs,
    missingCount: missingCells.length,
    missingCells,
  };
}

function seriesFromEnds(ends) {
  return [...(ends || new Map()).entries()]
    .sort((a, b) => a[0] < b[0] ? -1 : 1)
    .map(([month, row]) => ({ month, price: row.price, date: row.date, source: row.source || null }));
}

function pickChase(singles, limits) {
  const real = singles.filter((s) => s.price != null && Number.isFinite(s.price));
  if (!real.length) return null;
  real.sort((a, b) => {
    if (b.price !== a.price) return b.price - a.price;
    if (limits.chase.tieBreak === "id") return String(a.id).localeCompare(String(b.id));
    return 0;
  });
  return real[0];
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function proseHasBanned(text) {
  return BANNED.test(text || "");
}
