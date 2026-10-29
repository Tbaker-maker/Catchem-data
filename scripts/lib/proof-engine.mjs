// Proof engine math. Limits come from the caller. This file has no cutoff numbers.
// A missing price, retail, or later day stays missing. It is never stored as 0.

const LIMIT_KEYS = [
  "flatAbsPct", "minSample", "minPriorWindows", "heldOutFraction",
  "moveWindowDays", "dateSlackDays", "stepDays",
  "listingsJumpPct", "causeWindowDays", "runwayNights",
  "bandLow", "bandHigh", "curveWeeksBefore", "curveWeeksAfter",
];

export function limitsOk(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  for (const key of LIMIT_KEYS) {
    if (typeof cfg[key] !== "number" || !Number.isFinite(cfg[key])) return false;
  }
  if (!Array.isArray(cfg.horizons) || cfg.horizons.length < 1) return false;
  if (!cfg.horizons.every((n) => Number.isInteger(n) && n > 0)) return false;
  if (!(cfg.flatAbsPct >= 0)) return false;
  if (!(cfg.minSample >= 1) || !(cfg.minPriorWindows >= 2)) return false;
  if (!(cfg.heldOutFraction > 0 && cfg.heldOutFraction < 1)) return false;
  if (!(cfg.stepDays >= 1) || !(cfg.moveWindowDays >= 1)) return false;
  if (!(cfg.dateSlackDays >= 0)) return false;
  if (!(cfg.bandLow > 0 && cfg.bandLow < cfg.bandHigh && cfg.bandHigh < 1)) return false;
  if (!(cfg.curveWeeksAfter >= 1) || !(cfg.curveWeeksBefore >= 0)) return false;
  return true;
}

export function assertLimits(cfg) {
  if (!limitsOk(cfg)) {
    const err = new Error("proof limits not loaded");
    err.code = "LIMITS_MISSING";
    throw err;
  }
  return cfg;
}

export function round4(n) {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
}

export function pctChange(from, to) {
  if (!(from > 0) || to == null || !Number.isFinite(to)) return null;
  return ((to - from) / from) * 100;
}

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function median(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function quantile(xs, q) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return v[lo];
  return v[lo] * (hi - pos) + v[hi] * (pos - lo);
}

export function directionOf(pct, flatAbsPct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (Math.abs(pct) <= flatAbsPct) return "flat";
  return pct > 0 ? "up" : "down";
}

// Archive rows are [date, price] or {date, price}. Our price wins on a shared date.
// Archive days on or after our first own day are not copied in.
// A product with no own prices keeps the archive. A missing day is left out, never stored as 0.
export function joinSeries(own, mirrorRows) {
  const mine = (own || [])
    .filter((p) => p && p.date && p.price != null && Number.isFinite(p.price) && p.price > 0)
    .map((p) => ({ date: p.date, price: p.price, source: p.source || "own" }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const byDate = new Map();
  for (const p of mine) byDate.set(p.date, p);
  const first = mine[0]?.date || null;
  let usedArchive = false;
  for (const row of mirrorRows || []) {
    const date = Array.isArray(row) ? row[0] : row && row.date;
    const price = Array.isArray(row) ? Number(row[1]) : Number(row && row.price);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(price > 0)) continue;
    if (byDate.has(date)) continue;
    if (first && date >= first) continue;
    byDate.set(date, { date, price, source: "archived-market" });
    usedArchive = true;
  }
  const points = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const p of points) p.t = Date.parse(`${p.date}T00:00:00Z`);
  return { points, usedArchive };
}

export function priceOn(points, date) {
  let best = null;
  for (const p of points || []) {
    if (!p || p.date > date) break;
    best = p;
  }
  return best;
}

export function priceNear(points, date, slackDays) {
  if (!points?.length || !date || slackDays == null) return null;
  const target = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(target)) return null;
  const slack = slackDays * 86400000;
  let lo = 0;
  let hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const t = points[mid].t ?? Date.parse(`${points[mid].date}T00:00:00Z`);
    if (t < target) lo = mid + 1;
    else hi = mid;
  }
  let best = null;
  let bestGap = Infinity;
  for (let i = lo - 1; i >= 0; i -= 1) {
    const t = points[i].t ?? Date.parse(`${points[i].date}T00:00:00Z`);
    const gap = target - t;
    if (gap > slack) break;
    if (gap < bestGap) { best = points[i]; bestGap = gap; }
  }
  for (let i = lo; i < points.length; i += 1) {
    const t = points[i].t ?? Date.parse(`${points[i].date}T00:00:00Z`);
    const gap = t - target;
    if (gap > slack) break;
    if (gap < bestGap) { best = points[i]; bestGap = gap; }
  }
  return best;
}

function windowPct(points, endDate, windowDays, slackDays) {
  const end = priceNear(points, endDate, slackDays);
  if (!end) return null;
  const startTarget = addDays(end.date, -windowDays);
  const start = priceNear(points, startTarget, slackDays);
  if (!start || start.date >= end.date) return null;
  const span = dayGap(start.date, end.date);
  if (span == null || Math.abs(span - windowDays) > slackDays) return null;
  const pct = pctChange(start.price, end.price);
  if (pct == null) return null;
  return { pct, from: start.date, to: end.date, fromPrice: start.price, toPrice: end.price };
}

export function callDates(points, stepDays) {
  const dates = [];
  let last = null;
  for (const p of points || []) {
    if (!last || dayGap(last, p.date) >= stepDays) {
      dates.push(p.date);
      last = p.date;
    }
  }
  return dates;
}

export function swingBefore(points, endDate, limits) {
  const priors = [];
  let cursor = addDays(endDate, -limits.stepDays);
  for (let i = 0; i < 24; i += 1) {
    const w = windowPct(points, cursor, limits.moveWindowDays, limits.dateSlackDays);
    if (w) priors.push(Math.abs(w.pct));
    cursor = addDays(cursor, -limits.stepDays);
    if (priors.length >= 12) break;
  }
  if (priors.length < limits.minPriorWindows) return null;
  return median(priors);
}

// A hit has to clear the product's own typical move and the sealed market.
// A raw tick the other side of zero is not enough.
export function isHit(direction, productPct, swing, marketPct) {
  if (productPct == null || swing == null || marketPct == null) return null;
  if (direction === "flat") return Math.abs(productPct) <= swing;
  if (direction === "up") return productPct > swing && productPct > marketPct;
  if (direction === "down") return productPct < -swing && productPct < marketPct;
  return null;
}

export function outcomeAt(points, fromDate, horizon, slackDays) {
  const start = priceNear(points, fromDate, slackDays);
  if (!start) return null;
  const end = priceNear(points, addDays(start.date, horizon), slackDays);
  if (!end || end.date <= start.date) return null;
  const span = dayGap(start.date, end.date);
  if (span == null || Math.abs(span - horizon) > slackDays) return null;
  return { pct: pctChange(start.price, end.price), from: start.date, to: end.date, fromPrice: start.price, toPrice: end.price };
}

export function marketOn(rows, endDate, horizon, slackDays) {
  const pcts = [];
  for (const row of rows) {
    const w = outcomeAt(row.points, endDate, horizon, slackDays);
    if (w && w.pct != null) pcts.push(w.pct);
  }
  return median(pcts);
}

export function buildMoveCalls(products, limits) {
  const calls = [];
  for (const product of products) {
    const dates = callDates(product.points, limits.stepDays);
    for (const date of dates) {
      const w = windowPct(product.points, date, limits.moveWindowDays, limits.dateSlackDays);
      if (!w) continue;
      const direction = directionOf(w.pct, limits.flatAbsPct);
      if (!direction) continue;
      const swing = swingBefore(product.points, w.to, limits);
      calls.push({
        type: `move-${direction}`,
        direction,
        productId: product.id,
        name: product.name,
        date: w.to,
        windowDays: limits.moveWindowDays,
        price: w.toPrice,
        fromPrice: w.fromPrice,
        priorPct: round4(w.pct),
        swing: swing == null ? null : round4(swing),
        listingsCounted: countOn(product.listings, w.to),
      });
    }
  }
  return calls;
}

export function buildMonthCalls(products, limits) {
  const calls = [];
  for (const product of products) {
    const byMonth = new Map();
    for (const p of product.points) {
      const month = p.date.slice(0, 7);
      const prev = byMonth.get(month);
      if (!prev || p.date > prev.date) byMonth.set(month, p);
    }
    const months = [...byMonth.keys()].sort();
    for (let i = 1; i < months.length; i += 1) {
      const prev = byMonth.get(months[i - 1]);
      const cur = byMonth.get(months[i]);
      const pct = pctChange(prev.price, cur.price);
      const direction = directionOf(pct, limits.flatAbsPct);
      if (!direction) continue;
      const swing = swingBefore(product.points, cur.date, limits);
      calls.push({
        type: `pulse-month-${direction}`,
        direction,
        productId: product.id,
        name: product.name,
        date: cur.date,
        windowDays: dayGap(prev.date, cur.date),
        price: cur.price,
        fromPrice: prev.price,
        priorPct: round4(pct),
        swing: swing == null ? null : round4(swing),
        listingsCounted: countOn(product.listings, cur.date),
      });
    }
  }
  return calls;
}

function countOn(listings, date) {
  let best = null;
  for (const row of listings || []) {
    if (!row || row.date > date) break;
    if (row.count == null || !Number.isFinite(row.count)) continue;
    best = row;
  }
  return best ? best.count : null;
}

export function scoreCalls(calls, products, limits) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const marketCache = new Map();
  const scored = [];
  for (const call of calls) {
    const product = byId.get(call.productId);
    if (!product) continue;
    const marks = {};
    for (const horizon of limits.horizons) {
      const key = String(horizon);
      const outcome = outcomeAt(product.points, call.date, horizon, limits.dateSlackDays);
      if (!outcome || call.swing == null) {
        marks[key] = { hit: null, productPct: outcome ? round4(outcome.pct) : null, marketPct: null };
        continue;
      }
      const cacheKey = `${call.date}|${horizon}`;
      let marketPct = marketCache.get(cacheKey);
      if (marketPct === undefined) {
        marketPct = marketOn(products, call.date, horizon, limits.dateSlackDays);
        marketCache.set(cacheKey, marketPct);
      }
      const hit = isHit(call.direction, outcome.pct, call.swing, marketPct);
      marks[key] = {
        hit,
        productPct: round4(outcome.pct),
        marketPct: round4(marketPct),
        excessPct: marketPct == null ? null : round4(outcome.pct - marketPct),
      };
    }
    scored.push({ ...call, marks });
  }
  return scored;
}

export function heldOutCut(dates, fraction) {
  const unique = [...new Set(dates)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (unique.length < 2) return null;
  const index = Math.floor(unique.length * (1 - fraction));
  return unique[Math.min(unique.length - 1, Math.max(1, index))];
}

function rate(hits, n) {
  if (!(n > 0)) return null;
  return round4((100 * hits) / n);
}

function familyOf(type) {
  if (type.startsWith("pulse-month-")) return "pulse-month";
  if (type.startsWith("read-")) return "read";
  if (type.startsWith("chip-")) return "chip";
  if (type.startsWith("move-")) return "move";
  return type;
}

export function summarize(scored, limits) {
  const cut = heldOutCut(scored.map((c) => c.date), limits.heldOutFraction);
  const types = new Map();
  for (const row of scored) {
    if (!types.has(row.type)) types.set(row.type, []);
    types.get(row.type).push(row);
  }
  const heldAll = cut ? scored.filter((r) => r.date >= cut) : [];
  const out = [];
  for (const [type, rows] of types) {
    const held = cut ? rows.filter((r) => r.date >= cut) : [];
    const family = familyOf(type);
    const universe = heldAll.filter((r) => familyOf(r.type) === family);
    const direction = rows[0]?.direction || null;
    const horizonStats = {};
    for (const horizon of limits.horizons) {
      const key = String(horizon);
      const bag = held.filter((r) => r.marks?.[key]?.hit != null);
      const hits = bag.filter((r) => r.marks[key].hit === true).length;
      let baseHits = 0;
      let baseN = 0;
      for (const r of universe) {
        const mark = r.marks?.[key];
        if (!mark || r.swing == null || mark.productPct == null || mark.marketPct == null) continue;
        const hit = isHit(direction, mark.productPct, r.swing, mark.marketPct);
        if (hit == null) continue;
        baseN += 1;
        if (hit) baseHits += 1;
      }
      const hitRate = rate(hits, bag.length);
      const baseRate = rate(baseHits, baseN);
      const lift = hitRate == null || baseRate == null ? null : round4(hitRate - baseRate);
      const dates = bag.map((r) => r.date).sort();
      const pub = bag.length >= limits.minSample && lift != null && lift > 0;
      horizonStats[key] = {
        n: bag.length,
        hits,
        hitRate,
        baseRate,
        lift,
        public: pub,
        since: dates[0] || null,
      };
    }
    const mature = limits.horizons.map(String).filter((key) => horizonStats[key].n >= limits.minSample);
    const proven = mature.length > 0 && mature.every((key) => horizonStats[key].lift != null && horizonStats[key].lift > 0);
    out.push({
      type,
      direction,
      calls: rows.length,
      heldOutFrom: cut,
      horizons: horizonStats,
      public: proven,
      publicHorizon: proven ? Number(mature[0]) : null,
    });
  }
  out.sort((a, b) => a.type.localeCompare(b.type));
  return { heldOutFrom: cut, types: out };
}

const TYPE_LABEL = {
  "move-up": "Move up",
  "move-down": "Move down",
  "move-flat": "Move flat",
  "pulse-month-up": "Month up",
  "pulse-month-down": "Month down",
  "pulse-month-flat": "Month flat",
  "read-up": "Read up",
  "read-down": "Read down",
  "read-flat": "Read flat",
  "chip-up": "Chip up",
  "chip-down": "Chip down",
  "chip-flat": "Chip flat",
};

export function monthName(iso) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, d] = String(iso || "").split("-");
  const name = months[Number(m) - 1];
  if (!name || !y || !d) return null;
  return `${name} ${Number(d)} ${y}`;
}

export function publicReceipts(summary) {
  const lines = [];
  for (const row of summary.types) {
    if (!row.public || row.publicHorizon == null) continue;
    const stat = row.horizons[String(row.publicHorizon)];
    const since = monthName(stat.since);
    const label = TYPE_LABEL[row.type] || row.type;
    if (!since || !(stat.n > 0)) continue;
    lines.push({
      type: label,
      line: `${stat.hits} of ${stat.n} called right since ${since}`,
    });
  }
  return {
    note: lines.length
      ? "Each line is a held-out check. Scores and weights are not shown."
      : "No signal type is public yet.",
    lines,
  };
}

export function weekIndex(release, date) {
  const gap = dayGap(release, date);
  if (gap == null) return null;
  return Math.floor(gap / 7);
}

export function curveFor(rows, limits) {
  const weeks = new Map();
  for (const row of rows) {
    if (!row.release || !row.points?.length) continue;
    const seen = new Set();
    for (const p of row.points) {
      const week = weekIndex(row.release, p.date);
      if (week == null || week < -limits.curveWeeksBefore || week > limits.curveWeeksAfter) continue;
      if (seen.has(week)) continue;
      seen.add(week);
      const multiple = row.retail > 0 ? p.price / row.retail : null;
      const list = weeks.get(week) || [];
      list.push({ price: p.price, multiple, early: week < 0 });
      weeks.set(week, list);
    }
  }
  const out = [];
  for (const [week, list] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
    const prices = list.map((x) => x.price);
    const multiples = list.map((x) => x.multiple).filter((x) => x != null);
    out.push({
      week,
      early: week < 0,
      n: list.length,
      median: round4(median(prices)),
      low: round4(quantile(prices, limits.bandLow)),
      high: round4(quantile(prices, limits.bandHigh)),
      multipleMedian: multiples.length ? round4(median(multiples)) : null,
      multipleN: multiples.length,
    });
  }
  return out;
}

export function placeOnCurve(price, weekRow) {
  if (price == null || !weekRow || weekRow.low == null || weekRow.high == null) return null;
  if (weekRow.early) return "before release";
  if (price > weekRow.high) return "above";
  if (price < weekRow.low) return "below";
  return "inside";
}

export function nearestCause(moveDate, causes, windowDays) {
  const hits = [];
  for (const cause of causes || []) {
    if (!cause?.date) continue;
    const gap = Math.abs(dayGap(cause.date, moveDate) ?? 9999);
    if (gap <= windowDays) hits.push({ ...cause, daysApart: gap });
  }
  hits.sort((a, b) => a.daysApart - b.daysApart || a.date.localeCompare(b.date));
  return hits;
}

export function whyLine(causes) {
  if (!causes?.length) return "no clear cause on file";
  return causes.map((c) => c.line).join(" ");
}

export function runwayDays(listings, nights) {
  const rows = (listings || []).filter((r) => r && r.date && r.count != null && Number.isFinite(r.count)).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  if (rows.length < 2) return { days: null, note: "not enough listing nights" };
  const recent = rows.slice(-Math.max(2, nights));
  if (recent.length < nights) return { days: null, nights: recent.length, note: "not enough listing nights" };
  const drops = [];
  for (let i = 1; i < recent.length; i += 1) {
    drops.push(recent[i - 1].count - recent[i].count);
  }
  const avg = drops.reduce((s, n) => s + n, 0) / drops.length;
  const last = recent[recent.length - 1].count;
  if (!(avg > 0) || !(last >= 0)) return { days: null, nights: recent.length, avgDrop: round4(avg), listingsCounted: last, note: "listings counted are not falling" };
  return { days: round4(last / avg), nights: recent.length, avgDrop: round4(avg), listingsCounted: last, note: null };
}

export const BANNED_PUBLIC = /(\bsold\b|\bsales?\b|\bbuy\b|\bsell\b|\bshould\b|\binvest\w*|\brecommend\w*|\bload up\b|\bcan.?t lose\b|\bcollectr\b|\bsupply\b|\u2013|\u2014|\bNM\b)/i;

export function publicTextOk(text) {
  return !BANNED_PUBLIC.test(String(text || ""));
}
