// Private year study of what came before a 7/30/90-day move.
// The study may use fill days before a product's first own tcgcsv day.
// A present-day match and any public line use own days only.
// Script only. No invented prices. Same hit rule as scripts/lib/tracker.mjs.

import { banGuard } from "./copy-rules.mjs";
import { withFill } from "./fill-history.mjs";
import { addDays, backtest, changeOver, HIT_PCT, HORIZONS, MIN_N } from "./tracker.mjs";

export { HORIZONS, HIT_PCT, MIN_N, addDays, backtest };

export const STRIDE_EQUALS_HORIZON = true;
export const ROTATION_NEAR_DAYS = 45;
export const DIP_PCT = -8;
export const SLOW_CLIMB_LO = 3;
export const SLOW_CLIMB_HI = 15;
export const LISTINGS_MOVE_PCT = 10;
export const LISTINGS_DROP_PCT = 40;
export const PRICE_JUMP_PCT = 10;
export const SPIKE_PCT = 15;
export const SPIKE_DAYS = 3;
export const REVERT_DAYS = 7;
export const THIN_SALES_MAX = 2;
export const THIN_MOVE_PCT = 5;
export const RELIST_PCT = 30;

const DAY = 86400000;

// Shared advice-phrase rules (rules/advice-phrases.json), dashes included.
export const PUBLIC_BANNED = banGuard("year patterns", { house: true });

const KEY_ORDER = ["kind", "set_age", "rotation_stage", "rotation_timing", "path", "listings_14d", "crowd"];

// Day numbers are cached per ISO date: with singles fill the study calls this millions of times.
const DAY_NUM = new Map();
function dayNum(iso) {
  let n = DAY_NUM.get(iso);
  if (n === undefined) { n = Date.parse(`${iso}T00:00:00Z`) / DAY; DAY_NUM.set(iso, n); }
  return n;
}

export function daysBetween(a, b) {
  return Math.round(dayNum(b) - dayNum(a));
}

export function publicCopyOk(text) {
  const s = String(text || "");
  return s.length > 0 && !PUBLIC_BANNED.test(s);
}

export function round4(x) {
  return Math.round(Number(x) * 10000) / 10000;
}

export function medianLower(values) {
  const all = values.filter((n) => n != null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!all.length) return null;
  return all[Math.floor(all.length / 2)];
}

// Own points always win. Fill points are kept only before the first own day.
export function studyPoints(ownPairs, fill) {
  const own = (ownPairs || [])
    .filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number(p[1]) > 0)
    .map((p) => [p[0], Number(p[1])])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const filled = withFill(own, fill);
  const firstOwn = own.length ? own[0][0] : null;
  return filled.points.map(([date, price]) => ({
    date,
    price,
    src: firstOwn && date < firstOwn ? "fill" : "own",
  }));
}

export function ownPoints(points) {
  return (points || []).filter((p) => p && p.src === "own");
}

// Same percent as tracker.changeOver, but the two points must cover the horizon.
// A short stretch inside a long window is not labeled as that window.
export function coveredChange(points, from, to, horizon) {
  const series = [];
  const srcOf = new Map();
  for (const p of points || []) {
    const date = Array.isArray(p) ? p[0] : p?.date;
    const price = Number(Array.isArray(p) ? p[1] : p?.price);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !(price > 0)) continue;
    series.push([date, price]);
    if (!Array.isArray(p) && p.src) srcOf.set(date, p.src);
  }
  series.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const change = changeOver(series, from, to);
  if (change == null) return null;
  const a = series.find((p) => p[0] >= from && p[0] <= to);
  const b = [...series].reverse().find((p) => p[0] <= to && p[0] >= from);
  if (!a || !b) return null;
  const span = daysBetween(a[0], b[0]);
  if (span < Number(horizon) - 3) return null;
  if (daysBetween(from, a[0]) > 3) return null;
  if (daysBetween(b[0], to) > 3) return null;
  return {
    change,
    from: a[0],
    to: b[0],
    startPrice: a[1],
    endPrice: b[1],
    startSrc: srcOf.get(a[0]) || "own",
    endSrc: srcOf.get(b[0]) || "own",
  };
}

export function isHit(change, market) {
  return change != null && market != null && change >= HIT_PCT && change > market;
}

export function gridStarts(minDate, asOf, horizon) {
  const out = [];
  if (!minDate || !asOf || !(horizon > 0)) return out;
  let d = minDate;
  while (d <= asOf) {
    const end = addDays(d, horizon);
    if (end > asOf) break;
    out.push(d);
    d = addDays(d, horizon);
  }
  return out;
}

export function setAgeKey(release, start) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release || "") || !/^\d{4}-\d{2}-\d{2}$/.test(start || "")) return null;
  const age = daysBetween(release, start);
  if (age < 0) return "before_release";
  if (age < 90) return "under_90d";
  if (age < 365) return "under_1y";
  if (age < 365 * 3) return "1_to_3y";
  return "over_3y";
}

export function rotationTiming(mark, start, sources) {
  if (!mark || !/^\d{4}-\d{2}-\d{2}$/.test(start || "")) return null;
  const src = (sources || []).find((s) => s && s.mark === mark && /^\d{4}-\d{2}-\d{2}$/.test(s.date || ""));
  if (!src) return null;
  const days = Math.abs(daysBetween(src.date, start));
  return days <= ROTATION_NEAR_DAYS ? "near" : "away";
}

export function pathKey(points, start) {
  const c14 = coveredChange(points, addDays(start, -14), start, 14);
  const c30 = coveredChange(points, addDays(start, -30), start, 30);
  if (c14 && c14.change <= DIP_PCT) return "dip";
  if (c30 && c30.change >= SLOW_CLIMB_LO && c30.change < SLOW_CLIMB_HI) return "slow_climb";
  if (c30 && c30.change >= SLOW_CLIMB_HI) return "fast_climb";
  if (c30 && c30.change <= -3) return "slide";
  if (c30) return "flat";
  return null;
}

export function listingsKey(series, start) {
  const c = coveredChange(series, addDays(start, -14), start, 14);
  if (!c) return null;
  if (c.change <= -LISTINGS_MOVE_PCT) return "down";
  if (c.change >= LISTINGS_MOVE_PCT) return "up";
  return "flat";
}

// events: { pid, date, dir } from a private claim file. No file means no key.
export function crowdKey(events, pid, start) {
  if (!events || !events.length || pid == null || !start) return null;
  const from = addDays(start, -14);
  let up = 0;
  let down = 0;
  let n = 0;
  for (const e of events) {
    if (Number(e.pid) !== Number(pid) || e.date < from || e.date > start) continue;
    n += 1;
    if (e.dir > 0) up += 1;
    else if (e.dir < 0) down += 1;
  }
  if (!n) return null;
  if (up >= 3 && up > down) return "up";
  if (down >= 3 && down > up) return "down";
  if (n >= 5) return "mixed";
  return null;
}

export function conditionKeys({ points, listings, crowdEvents, meta, sources, start }) {
  const keys = [];
  if (meta?.kind === "sealed" || meta?.kind === "single") keys.push(`kind=${meta.kind}`);
  const age = setAgeKey(meta?.release, start);
  if (age) keys.push(`set_age=${age}`);
  if (meta?.rotationStage) keys.push(`rotation_stage=${meta.rotationStage}`);
  const timing = rotationTiming(meta?.mark, start, sources);
  if (timing) keys.push(`rotation_timing=${timing}`);
  const path = pathKey(points, start);
  if (path) keys.push(`path=${path}`);
  const listed = listingsKey(listings, start);
  if (listed) keys.push(`listings_14d=${listed}`);
  const crowd = crowdKey(crowdEvents, meta?.pid, start);
  if (crowd) keys.push(`crowd=${crowd}`);
  return keys;
}

export function orderKeys(keys) {
  return [...(keys || [])].sort((a, b) => {
    const ia = KEY_ORDER.indexOf(String(a).split("=")[0]);
    const ib = KEY_ORDER.indexOf(String(b).split("=")[0]);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b));
  });
}

export function partialMatch(itemKeys, patternKeys) {
  const ordered = orderKeys(patternKeys);
  const have = new Set(itemKeys || []);
  let matched = 0;
  for (const k of ordered) if (have.has(k)) matched += 1;
  let prefix = 0;
  for (const k of ordered) {
    if (!have.has(k)) break;
    prefix += 1;
  }
  const of = ordered.length;
  return {
    matched,
    of,
    pctComplete: of ? Math.round((100 * matched) / of) : 0,
    stage: prefix,
    stageName: prefix ? ordered[prefix - 1].split("=")[0] : "none",
    complete: of > 0 && matched === of,
  };
}

export function splitByDate(rows, frac = 0.3) {
  const dates = [...new Set((rows || []).map((r) => r.start))].sort();
  if (dates.length < 2) return { train: rows || [], test: [], cutoff: null };
  const cutIdx = Math.min(dates.length - 1, Math.max(1, Math.floor(dates.length * (1 - frac))));
  const cutoff = dates[cutIdx];
  return {
    train: rows.filter((r) => r.start < cutoff),
    test: rows.filter((r) => r.start >= cutoff),
    cutoff,
  };
}

function rateOf(rows, pred) {
  const sub = [];
  for (const r of rows) if (pred(r)) sub.push(r);
  const n = sub.length;
  if (!n) return { n: 0, hits: 0, rate: null };
  const hits = sub.filter((r) => r.hit).length;
  return { n, hits, rate: hits / n };
}

function hasKeys(row, keys) {
  for (const k of keys) if (!row.keys.includes(k)) return false;
  return true;
}

export function mineYearPatterns(rows, { minN = MIN_N, holdoutFrac = 0.3, horizon } = {}) {
  const pool = horizon == null ? (rows || []) : (rows || []).filter((r) => r.horizon === horizon);
  const { train, test, cutoff } = splitByDate(pool, holdoutFrac);
  const baseTrain = rateOf(train, () => true);
  const baseTest = rateOf(test, () => true);
  const passed = [];
  const failed = [];
  if (baseTrain.rate == null || baseTest.rate == null) {
    return { passed, failed, baseTrain, baseTest, cutoff, trainN: train.length, testN: test.length, horizon };
  }
  const seen = new Set();
  for (const r of train) for (const k of r.keys || []) seen.add(k);
  const singles = [];
  for (const key of seen) {
    const tr = rateOf(train, (r) => r.keys.includes(key));
    if (tr.n < minN || tr.rate == null || tr.rate <= baseTrain.rate) continue;
    singles.push(key);
  }
  const consider = (keys) => {
    const tr = rateOf(train, (r) => hasKeys(r, keys));
    if (tr.n < minN || tr.rate == null || tr.rate <= baseTrain.rate) return;
    const te = rateOf(test, (r) => hasKeys(r, keys));
    const row = {
      id: `yp:${horizon}d:${orderKeys(keys).join("+")}`,
      horizon,
      keys: orderKeys(keys),
      trainN: tr.n,
      trainHits: tr.hits,
      trainRate: round4(tr.rate),
      testN: te.n,
      testHits: te.hits,
      testRate: te.rate == null ? null : round4(te.rate),
      baseTrain: round4(baseTrain.rate),
      baseTest: round4(baseTest.rate),
      lift: te.rate == null ? null : round4(te.rate - baseTest.rate),
      cutoff,
    };
    const ok = te.n >= minN && te.rate != null && te.rate > baseTest.rate;
    row.passedLater = ok;
    (ok ? passed : failed).push(row);
  };
  for (const key of singles) consider([key]);
  const top = singles.slice(0, 25);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      if (top[i].split("=")[0] === top[j].split("=")[0]) continue;
      consider([top[i], top[j]]);
    }
  }
  passed.sort((a, b) => (b.lift || 0) - (a.lift || 0) || b.testN - a.testN);
  failed.sort((a, b) => (b.trainRate || 0) - (a.trainRate || 0));
  return { passed, failed, baseTrain, baseTest, cutoff, trainN: train.length, testN: test.length, horizon };
}

export function gateOwnOnly(keys, testRows, { minN = MIN_N } = {}) {
  const own = (testRows || []).filter((r) => !r.usesFill);
  const base = rateOf(own, () => true);
  const sub = rateOf(own, (r) => hasKeys(r, keys));
  const passed = sub.n >= minN && sub.rate != null && base.rate != null && sub.rate > base.rate;
  return {
    passed,
    n: sub.n,
    hits: sub.hits,
    rate: sub.rate == null ? null : round4(sub.rate),
    base: base.rate == null ? null : round4(base.rate),
  };
}

export function provenLine(pattern, ownGate) {
  const when = (pattern.keys || []).map((k) => k.replace("=", " ")).join(" and ");
  const pct = Math.round(Number(ownGate.rate) * 1000) / 10;
  return `On later own-day windows where ${when}, ${pct}% of ${ownGate.n} windows moved and finished above the median (${pattern.horizon}-day window).`;
}

export function auditRows(keys, testRows) {
  return (testRows || []).filter((r) => hasKeys(r, keys)).map((r) => ({
    id: r.id,
    pid: r.pid,
    itemId: r.itemId,
    horizon: r.horizon,
    start: r.start,
    change: Math.round(r.change * 10) / 10,
    market: r.market == null ? null : Math.round(r.market * 10) / 10,
    hit: r.hit,
    startSrc: r.startSrc,
    endSrc: r.endSrc,
    usesFill: Boolean(r.usesFill),
  }));
}

export function presentMatches(items, patterns) {
  const out = [];
  for (const item of items || []) {
    for (const p of patterns || []) {
      if (!p.keys?.length) continue;
      if (p.keys.every((k) => (item.keys || []).includes(k))) {
        out.push({
          patternId: p.id,
          pid: item.pid,
          itemId: item.itemId,
          horizon: p.horizon,
          asOf: item.asOf,
          ownOnly: true,
        });
      }
    }
  }
  return out;
}

export function formingLine({ matched, of, stageName, asOf }) {
  return `${matched} of ${of} conditions on file as of ${asOf}. Furthest ordered stage: ${stageName}.`;
}

export function formingWarnings(items, patterns, { minPct = 0 } = {}) {
  const out = [];
  for (const item of items || []) {
    for (const p of patterns || []) {
      const part = partialMatch(item.keys, p.keys);
      if (part.matched < 1 || part.complete) continue;
      if (part.pctComplete < minPct) continue;
      const row = {
        patternId: p.id,
        pid: item.pid,
        itemId: item.itemId,
        stage: part.stage,
        stageName: part.stageName,
        matched: part.matched,
        of: part.of,
        pctComplete: part.pctComplete,
        asOf: item.asOf,
      };
      row.line = formingLine(row);
      out.push(row);
    }
  }
  return out;
}

export function backtestForming(rows, pattern, { minN = MIN_N, cutoff = null } = {}) {
  const same = (rows || []).filter((r) => r.horizon === pattern.horizon);
  const byPid = new Map();
  for (const r of same) {
    if (!byPid.has(r.pid)) byPid.set(r.pid, []);
    byPid.get(r.pid).push(r);
  }
  const events = [];
  for (const arr of byPid.values()) {
    arr.sort((a, b) => (a.start < b.start ? -1 : 1));
    for (let i = 0; i < arr.length; i++) {
      const part = partialMatch(arr[i].keys, pattern.keys);
      if (part.matched < 1 || part.complete) continue;
      const limit = addDays(arr[i].start, pattern.horizon);
      let later = false;
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j].start > limit) break;
        if (partialMatch(arr[j].keys, pattern.keys).complete) { later = true; break; }
      }
      events.push({ start: arr[i].start, hit: Boolean(arr[i].hit), laterComplete: later, success: later && Boolean(arr[i].hit) });
    }
  }
  const test = cutoff ? events.filter((e) => e.start >= cutoff) : events;
  const baseRows = cutoff ? same.filter((r) => r.start >= cutoff) : same;
  const base = rateOf(baseRows, () => true);
  const n = test.length;
  const hits = test.filter((e) => e.hit).length;
  const both = test.filter((e) => e.success).length;
  const rate = n ? hits / n : null;
  const bothRate = n ? both / n : null;
  const passed = n >= minN && bothRate != null && base.rate != null && bothRate > base.rate;
  return {
    patternId: pattern.id,
    n,
    hits,
    rate: rate == null ? null : round4(rate),
    laterComplete: test.filter((e) => e.laterComplete).length,
    both,
    bothRate: bothRate == null ? null : round4(bothRate),
    base: base.rate == null ? null : round4(base.rate),
    passed,
  };
}

function priceOn(series, day) {
  let v = null;
  for (const p of series || []) if (p[0] === day && Number(p[1]) > 0) v = Number(p[1]);
  return v;
}

function pctChange(a, b) {
  if (!(a > 0) || !(b > 0)) return null;
  return ((b - a) / a) * 100;
}

export function listingsDropPriceJump(pid, prices, listings) {
  const out = [];
  const lists = listings || [];
  for (let i = 1; i < lists.length; i++) {
    const [d1, n1] = lists[i - 1];
    const [d2, n2] = lists[i];
    const gap = daysBetween(d1, d2);
    if (gap < 1 || gap > 2 || !(n1 > 0)) continue;
    const listed = ((n2 - n1) / n1) * 100;
    if (listed > -LISTINGS_DROP_PCT) continue;
    const p1 = priceOn(prices, d1);
    const p2 = priceOn(prices, d2);
    const moved = pctChange(p1, p2);
    if (moved == null || moved < PRICE_JUMP_PCT) continue;
    const line = `listings counted fell ${Math.round(Math.abs(listed))}% in ${gap} day${gap === 1 ? "" : "s"} while the market price rose ${Math.round(moved * 10) / 10}% (${d1} to ${d2}).`;
    out.push({ kind: "listings_drop_price_jump", pid, date: d2, from: d1, days: gap, line });
  }
  return out;
}

export function spikeReverts(pid, prices) {
  const pts = prices || [];
  const out = [];
  const used = new Set();
  for (let i = 0; i < pts.length; i++) {
    const [dPeak, pPeak] = pts[i];
    let base = null;
    for (let j = i - 1; j >= 0; j--) {
      const gap = daysBetween(pts[j][0], dPeak);
      if (gap < 1 || gap > SPIKE_DAYS) continue;
      const rise = pctChange(pts[j][1], pPeak);
      if (rise != null && rise >= SPIKE_PCT) base = { date: pts[j][0], price: pts[j][1], rise, gap };
    }
    if (!base || used.has(dPeak)) continue;
    const halfBack = base.price + (pPeak - base.price) * 0.5;
    for (let k = i + 1; k < pts.length; k++) {
      const gap = daysBetween(dPeak, pts[k][0]);
      if (gap < 1) continue;
      if (gap > REVERT_DAYS) break;
      if (pts[k][1] <= halfBack) {
        used.add(dPeak);
        const line = `market price rose ${Math.round(base.rise * 10) / 10}% in ${base.gap} day${base.gap === 1 ? "" : "s"}, then gave back at least half of that rise by ${pts[k][0]}.`;
        out.push({ kind: "spike_revert", pid, date: pts[k][0], from: base.date, peak: dPeak, line });
        break;
      }
    }
  }
  return out;
}

export function thinPrints(pid, prices, sales) {
  if (!sales || !sales.length) return { events: [], skipped: "no sales count on file" };
  const out = [];
  for (let i = 1; i < prices.length; i++) {
    const gap = daysBetween(prices[i - 1][0], prices[i][0]);
    if (gap < 1 || gap > 2) continue;
    const moved = pctChange(prices[i - 1][1], prices[i][1]);
    if (moved == null || Math.abs(moved) < THIN_MOVE_PCT) continue;
    const sale = sales.find((s) => s[0] === prices[i][0]);
    if (!sale || !(Number(sale[1]) >= 0) || Number(sale[1]) > THIN_SALES_MAX) continue;
    const line = `market price moved ${Math.round(Math.abs(moved) * 10) / 10}% on ${prices[i][0]} with ${sale[1]} sales on file.`;
    out.push({ kind: "thin_print", pid, date: prices[i][0], sales: Number(sale[1]), line });
  }
  return { events: out, skipped: null };
}

export function relistsAfterSpike(pid, prices, listings) {
  const out = [];
  const lists = listings || [];
  for (let i = 1; i < lists.length; i++) {
    const [d2, n2] = lists[i];
    const [d1, n1] = lists[i - 1];
    const gap = daysBetween(d1, d2);
    if (gap < 1 || gap > 2 || !(n1 > 0)) continue;
    const listed = ((n2 - n1) / n1) * 100;
    if (listed < RELIST_PCT) continue;
    let rose = null;
    for (const p of prices || []) {
      const back = daysBetween(p[0], d1);
      if (back < 1 || back > SPIKE_DAYS) continue;
      const chg = pctChange(p[1], priceOn(prices, d1));
      if (chg != null && chg >= PRICE_JUMP_PCT && (!rose || chg > rose.chg)) rose = { from: p[0], chg, gap: back };
    }
    if (!rose) continue;
    const line = `listings counted rose ${Math.round(listed)}% in ${gap} day${gap === 1 ? "" : "s"} after the market price rose ${Math.round(rose.chg * 10) / 10}% (${rose.from} to ${d2}).`;
    out.push({ kind: "relist_after_spike", pid, date: d2, from: rose.from, line });
  }
  return out;
}

export function unusualEvents({ pid, prices, listings, sales }) {
  const drop = listingsDropPriceJump(pid, prices, listings);
  const spike = spikeReverts(pid, prices);
  const thin = thinPrints(pid, prices, sales);
  const relist = relistsAfterSpike(pid, prices, listings);
  return {
    events: [...drop, ...spike, ...thin.events, ...relist],
    thinSkipped: thin.skipped,
  };
}

export function alertsDocument({ asOf, enabled, warningsPassed, items }) {
  const safe = (items || []).filter((row) => publicCopyOk(row.line));
  return {
    asOf,
    private: true,
    alertsEnabled: enabled === true,
    warningsPassed: warningsPassed === true,
    flag: "config/year-patterns.json alerts",
    shape: ["patternId", "itemId", "pid", "stage", "stageName", "matched", "of", "pctComplete", "asOf", "line"],
    items: safe,
    userLines: enabled === true && warningsPassed === true ? safe.map((row) => row.line) : [],
  };
}
