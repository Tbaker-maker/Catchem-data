// Chart scanner engine. Pure: same items and date always return the same grades.
// Replay walks each series with only the points known on that day.
// A hit is a later move of at least 3% that also beats the market median.
// Public gate: own-day cases only, n >= 20, decayed hit rate above the base rate.

import { HIT_PCT, HORIZONS, MIN_N, addDays } from "../tracker.mjs";
import { speciesToken } from "../fact-reads.mjs";
import {
  EXPLORE_SHARE, HALF_LIFE_DAYS, TOP_SEALED, TOP_SINGLES,
  bucketOf, dayNum, daysBetween, hash32, mulberry32, pct, round1, seedFromDate,
} from "./common.mjs";
import * as slowClimb from "./patterns/slow-climb.mjs";
import * as slowSlide from "./patterns/slow-slide.mjs";
import * as breakout from "./patterns/breakout.mjs";
import * as sharpSpike from "./patterns/sharp-spike.mjs";
import * as spikeRevert from "./patterns/spike-revert.mjs";
import * as recovery from "./patterns/recovery.mjs";
import * as flatRange from "./patterns/flat-range.mjs";
import * as listingsDown from "./patterns/listings-down-flat.mjs";
import * as listingsUp from "./patterns/listings-up-flat.mjs";
import * as bothUp from "./patterns/price-up-listings-up.mjs";
import * as bothDown from "./patterns/price-down-listings-down.mjs";
import * as thinJump from "./patterns/thin-jump.mjs";
import * as groupTogether from "./patterns/group-together.mjs";
import * as breakaway from "./patterns/breakaway.mjs";
import * as releaseWindow from "./patterns/release-window.mjs";
import * as yearAgo from "./patterns/year-ago.mjs";

export const PATTERNS = [
  slowClimb, slowSlide, breakout, sharpSpike, spikeRevert, recovery, flatRange,
  listingsDown, listingsUp, bothUp, bothDown, thinJump, groupTogether, breakaway,
  releaseWindow, yearAgo,
];

const ITEM_PATTERNS = PATTERNS.filter((p) => p.id !== "group-together" && p.id !== "breakaway");
const EXPLORE_WINDOWS = [5, 10, 20, 45, 90, 120];

export function itemPatterns() {
  return ITEM_PATTERNS;
}

export function eraOf(set) {
  const m = String(set || "").match(/^(SWSH|SV|SM|ME|XY|BW|HGSS|DP)/i);
  return m ? m[1].toUpperCase() : "";
}

export function gridDates(asOf) {
  const out = [];
  let n = dayNum(addDays(asOf, -364));
  n -= n % 7;
  const last = dayNum(asOf);
  for (let d = n; d <= last; d += 7) {
    const iso = new Date(d * 86400000).toISOString().slice(0, 10);
    out.push(iso);
  }
  return out;
}

export function forwardMove(points, from, horizon) {
  const to = addDays(from, horizon);
  let start = null;
  let end = null;
  for (const p of points || []) {
    if (!p || !(p.price > 0)) continue;
    const ds = daysBetween(from, p.date);
    if (ds >= 0 && ds <= 3 && (!start || p.date < start.date)) start = p;
    const de = daysBetween(p.date, to);
    if (de >= 0 && de <= 3 && p.date >= from && (!end || p.date > end.date)) end = p;
  }
  if (!start || !end || start.date >= end.date) return null;
  if (daysBetween(start.date, end.date) < horizon - 3) return null;
  const change = pct(start.price, end.price);
  if (change == null) return null;
  return {
    pct: round1(change),
    from: start.date,
    to: end.date,
    fromSrc: start.src || "own",
    toSrc: end.src || "own",
    p0: start.price,
    p1: end.price,
  };
}

function medianOf(values) {
  const all = values.filter((n) => n != null && Number.isFinite(n)).sort((a, b) => a - b);
  if (!all.length) return null;
  return all[Math.floor(all.length / 2)];
}

function decayWeight(date, asOf) {
  const age = Math.max(0, daysBetween(date, asOf));
  return 0.5 ** (age / HALF_LIFE_DAYS);
}

export function buildMedians(items, asOf) {
  const dates = gridDates(asOf);
  const medians = new Map();
  const base = new Map();
  for (const date of dates) {
    for (const h of HORIZONS) {
      if (addDays(date, h) > asOf) continue;
      const moves = [];
      for (const item of items) {
        const move = forwardMove(item.points, date, h);
        if (move) moves.push({ item, move });
      }
      const market = medianOf(moves.map((row) => row.move.pct));
      if (market == null) continue;
      medians.set(`${date}|${h}`, market);
      for (const row of moves) {
        const hit = row.move.pct >= HIT_PCT && row.move.pct > market;
        addBucket(base, `${row.item.kind}|${h}d`, date, asOf, hit, row.move.pct);
      }
    }
  }
  return { medians, base, dates };
}

function addBucket(map, key, date, asOf, hit, value) {
  if (!map.has(key)) map.set(key, { n: 0, hits: 0, w: 0, wh: 0, values: [] });
  const row = map.get(key);
  const w = decayWeight(date, asOf);
  row.n += 1;
  row.w += w;
  if (hit) { row.hits += 1; row.wh += w; }
  if (row.values.length < 400) row.values.push(value);
}

export function gradeDetection(row, points, medians, asOf) {
  const grades = {};
  const grid = gridDates(asOf);
  for (const h of HORIZONS) {
    const due = addDays(row.date, h) <= asOf;
    if (!due) { grades[`${h}d`] = { due: false, scored: false }; continue; }
    const move = forwardMove(points, row.date, h);
    const gridDay = grid.find((d) => d >= row.date) || grid.at(-1);
    const market = gridDay ? medians.get(`${gridDay}|${h}`) : null;
    // Prefer the grid date on or before the detection.
    const prior = [...grid].reverse().find((d) => d <= row.date);
    const marketUse = prior ? medians.get(`${prior}|${h}`) : market;
    if (!move || marketUse == null) { grades[`${h}d`] = { due: true, scored: false }; continue; }
    grades[`${h}d`] = {
      due: true,
      scored: true,
      hit: move.pct >= HIT_PCT && move.pct > marketUse,
      pct: move.pct,
      market: round1(marketUse),
      from: move.from,
      to: move.to,
      fromSrc: move.fromSrc,
      toSrc: move.toSrc,
      p0: move.p0,
      p1: move.p1,
    };
  }
  return grades;
}

function pointOn(points, date) {
  return (points || []).find((p) => p.date === date) || null;
}

function detectionFrom(item, hit, date, extra = {}) {
  const start = pointOn(item.points, hit.dates.start);
  const end = pointOn(item.points, hit.dates.end);
  return {
    id: item.id,
    name: item.name || item.set || "",
    kind: item.kind || "single",
    pattern: hit.pattern,
    stage: hit.stage,
    date,
    strength: hit.strength,
    start: hit.dates.start,
    end: hit.dates.end,
    p0: start?.price ?? hit.metrics?.priceStart ?? null,
    p1: end?.price ?? hit.metrics?.priceEnd ?? null,
    startSrc: hit.metrics?.startSrc || start?.src || "own",
    endSrc: hit.metrics?.endSrc || end?.src || "own",
    metrics: hit.metrics || {},
    privateOnly: extra.privateOnly === true,
    explore: extra.explore === true,
    candidate: extra.candidate || "",
    href: item.href || "",
    set: item.set || "",
  };
}

export function replayOne(item, asOf, medians, patterns = ITEM_PATTERNS) {
  const pts = (item.points || []).filter((p) => p.date <= asOf);
  if (pts.length < 4) return [];
  const step = pts.length > 16 ? 14 : 1;
  const indexes = [];
  for (let i = 0; i < pts.length; i += step) indexes.push(i);
  if (indexes.at(-1) !== pts.length - 1) indexes.push(pts.length - 1);
  const seen = new Set();
  const out = [];
  const exploreItem = hash32(item.id) % 10 < 3;
  const from = addDays(asOf, -365);
  for (const i of indexes) {
    const day = pts[i].date;
    if (day < from) continue;
    const view = { ...item, points: pts.slice(0, i + 1), asOf: day };
    const confirmed = [];
    for (const pat of patterns) {
      const hit = pat.detect(view, {});
      if (!hit) continue;
      const key = `${pat.id}|${hit.stage}|${hit.dates.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = detectionFrom(item, hit, day, { privateOnly: pat.privateOnly === true });
      row.grades = gradeDetection(row, pts, medians, asOf);
      out.push(row);
      if (hit.stage === "confirmed" && !pat.privateOnly) confirmed.push(pat.id);
    }
    if (confirmed.length >= 2) {
      const pair = confirmed.slice().sort().join("+");
      const key = `cand|${pair}|${item.id}|${day.slice(0, 7)}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          id: item.id, name: item.name || "", kind: item.kind, pattern: pair, stage: "confirmed",
          date: day, strength: 10, start: day, end: day, p0: pts[i].price, p1: pts[i].price,
          startSrc: pts[i].src || "own", endSrc: pts[i].src || "own", metrics: {},
          privateOnly: false, explore: false, candidate: pair, href: item.href || "", set: item.set || "",
          grades: gradeDetection({ date: day }, pts, medians, asOf),
        });
      }
    }
    if (exploreItem && i === indexes.at(-1)) {
      const windowDays = EXPLORE_WINDOWS[hash32(`${item.id}|${day}`) % EXPLORE_WINDOWS.length];
      for (const pat of patterns) {
        if (pat.privateOnly) continue;
        const hit = pat.detect(view, { windowDays });
        if (!hit) continue;
        const key = `ex|${pat.id}|${hit.stage}|${hit.dates.start}|${windowDays}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const row = detectionFrom(item, hit, day, { explore: true });
        row.windowDays = windowDays;
        row.grades = gradeDetection(row, pts, medians, asOf);
        out.push(row);
      }
    }
  }
  return out;
}

function changeInto(points, asOf, days) {
  const from = addDays(asOf, -days);
  const pts = (points || []).filter((p) => p.date <= asOf);
  let start = null;
  let end = null;
  for (const p of pts) {
    if (Math.abs(daysBetween(p.date, from)) <= 3 && (!start || Math.abs(daysBetween(p.date, from)) < Math.abs(daysBetween(start.date, from)))) start = p;
    if (p.date <= asOf && daysBetween(p.date, asOf) <= 3 && (!end || p.date > end.date)) end = p;
  }
  if (!start || !end || start.date >= end.date) return null;
  const change = pct(start.price, end.price);
  if (change == null) return null;
  return { change, start, end };
}

export function groupRowsAt(items, asOf) {
  const rows = [];
  for (const item of items) {
    const move = changeInto(item.points, asOf, 28);
    if (!move) continue;
    rows.push({ item, ...move });
  }
  return rows;
}

function medianChange(rows) {
  return medianOf(rows.map((r) => r.change));
}

export function buildGroupSeries(rows, asOf) {
  const packs = [];
  const by = new Map();
  const add = (key, type, name, row) => {
    if (!key || !name) return;
    if (!by.has(key)) by.set(key, { type, name, rows: [] });
    by.get(key).rows.push(row);
  };
  for (const row of rows) {
    const item = row.item;
    if (item.kind === "single" && item.set) add(`set|${item.set}`, "set", item.set, row);
    if (item.kind === "sealed" && item.set) add(`set|${item.set}|sealed`, "set", item.set, row);
    const era = eraOf(item.set);
    if (era && item.kind === "single") add(`era|${era}`, "era", era, row);
    if (item.artist) add(`artist|${item.artist}`, "artist", item.artist, row);
    const mon = item.pokemon || speciesToken(item.name || "");
    if (mon && item.kind === "single") add(`mon|${mon}`, "pokemon", mon, row);
  }
  for (const [key, group] of by) {
    const med = medianChange(group.rows);
    if (med == null) continue;
    let up = 0;
    let down = 0;
    let start = group.rows[0].start.date;
    let end = group.rows[0].end.date;
    for (const row of group.rows) {
      if (row.change >= 3) up += 1;
      else if (row.change <= -3) down += 1;
      if (row.start.date < start) start = row.start.date;
      if (row.end.date > end) end = row.end.date;
    }
    const fill = group.rows.some((row) => row.start.src === "fill" || row.end.src === "fill");
    packs.push({
      key, type: group.type, name: group.name, n: group.rows.length, up, down,
      medianPct: round1(med), start, end, fill, kind: group.rows[0].item.kind, asOf,
    });
  }
  return packs;
}

export function replayGroups(items, asOf, medians) {
  const out = [];
  const seen = new Set();
  const dates = gridDates(asOf).filter((date, i, all) => i % 4 === 0 || i === all.length - 1);
  for (const date of dates) {
    if (date < addDays(asOf, -365)) continue;
    const rows = groupRowsAt(items, date);
    const priorRows = groupRowsAt(items, addDays(date, -7));
    const groups = buildGroupSeries(rows, date);
    stampPrior(groups, buildGroupSeries(priorRows, addDays(date, -7)));
    for (const group of groups) {
      const series = {
        asOf: date,
        kind: "group",
        id: group.key,
        name: group.name,
        set: group.type === "set" ? group.name : "",
        group: group,
      };
      const hit = groupTogether.detect(series);
      if (!hit) continue;
      const key = `${group.key}|${hit.stage}|${hit.dates.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const members = items.filter((item) => memberOf(item, group));
      const row = {
        id: group.key, name: group.name, kind: "group", pattern: "group-together", stage: hit.stage,
        date, strength: hit.strength, start: hit.dates.start, end: hit.dates.end,
        p0: null, p1: null, startSrc: group.fill ? "fill" : "own", endSrc: group.fill ? "fill" : "own",
        metrics: { ...hit.metrics, groupType: group.type, noun: group.kind },
        privateOnly: false, explore: false, candidate: "", href: "", set: group.type === "set" ? group.name : "",
        grades: gradeGroup(date, members, medians, asOf),
      };
      out.push(row);
    }
    for (const row of breakaways(rows, priorRows)) {
      const hit = breakaway.detect({ breakaway: row.breakaway, asOf: date });
      if (!hit) continue;
      const key = `${row.item.id}|breakaway|${hit.stage}|${hit.dates.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const det = detectionFrom(row.item, hit, date, {});
      det.pattern = "breakaway";
      det.grades = gradeDetection(det, row.item.points, medians, asOf);
      out.push(det);
    }
  }
  return out;
}

function memberOf(item, group) {
  if (group.type === "set") return item.set === group.name && item.kind === group.kind;
  if (group.type === "era") return eraOf(item.set) === group.name && item.kind === "single";
  if (group.type === "artist") return item.artist === group.name;
  if (group.type === "pokemon") return (item.pokemon || speciesToken(item.name || "")) === group.name && item.kind === "single";
  return false;
}

function gradeGroup(date, members, medians, asOf) {
  const grades = {};
  const grid = gridDates(asOf);
  const prior = [...grid].reverse().find((d) => d <= date);
  for (const h of HORIZONS) {
    if (addDays(date, h) > asOf) { grades[`${h}d`] = { due: false, scored: false }; continue; }
    const values = [];
    let fill = false;
    for (const item of members) {
      const move = forwardMove(item.points, date, h);
      if (!move) continue;
      values.push(move.pct);
      if (move.fromSrc === "fill" || move.toSrc === "fill") fill = true;
    }
    const market = prior ? medians.get(`${prior}|${h}`) : null;
    const mid = medianOf(values);
    if (mid == null || market == null || values.length < 8) { grades[`${h}d`] = { due: true, scored: false }; continue; }
    grades[`${h}d`] = {
      due: true, scored: true, hit: mid >= HIT_PCT && mid > market, pct: round1(mid), market: round1(market),
      from: date, to: addDays(date, h), fromSrc: fill ? "fill" : "own", toSrc: fill ? "fill" : "own",
    };
  }
  return grades;
}

function stampPrior(groups, prior) {
  const map = new Map((prior || []).map((g) => [g.key, g]));
  for (const g of groups) {
    const p = map.get(g.key);
    if (!p?.n) continue;
    g.priorShare = Math.max(p.up, p.down) / p.n;
    g.priorStart = p.start;
  }
}

function gapTable(rows) {
  const bySet = new Map();
  for (const row of rows) {
    if (row.item.kind !== "single" || !row.item.set) continue;
    if (!bySet.has(row.item.set)) bySet.set(row.item.set, []);
    bySet.get(row.item.set).push(row);
  }
  const byId = new Map();
  for (const list of bySet.values()) {
    if (list.length < 20) continue;
    const med = medianChange(list);
    if (med == null) continue;
    for (const row of list) {
      byId.set(row.item.id, {
        change: row.change, median: med, n: list.length,
        start: row.start.date, end: row.end.date, abs: Math.abs(row.change - med),
      });
    }
  }
  return byId;
}

function breakaways(rows, priorRows = []) {
  const current = gapTable(rows);
  const prior = gapTable(priorRows);
  const bySet = new Map();
  for (const row of rows) {
    if (!current.has(row.item.id)) continue;
    const set = row.item.set;
    if (!bySet.has(set)) bySet.set(set, []);
    bySet.get(set).push(row);
  }
  const out = [];
  for (const list of bySet.values()) {
    let best = null;
    let ender = null;
    for (const row of list) {
      const g = current.get(row.item.id);
      const priorAbs = prior.get(row.item.id)?.abs || 0;
      if (g.abs >= 6 && (!best || g.abs > best.gap)) best = { row, g, priorAbs, gap: g.abs };
      if (priorAbs >= 10 && g.abs < 4 && (!ender || priorAbs > ender.priorAbs)) ender = { row, g, priorAbs, gap: g.abs };
    }
    const picked = [];
    if (best) picked.push(best);
    if (ender && (!best || ender.row.item.id !== best.row.item.id)) picked.push(ender);
    for (const pick of picked) {
      out.push({
        item: pick.row.item,
        breakaway: {
          change: round1(pick.g.change), median: round1(pick.g.median), n: pick.g.n,
          start: pick.g.start, end: pick.g.end, priorAbs: round1(pick.priorAbs),
        },
      });
    }
  }
  return out;
}

export function replayItems(items, asOf) {
  const { medians, base } = buildMedians(items, asOf);
  const detections = [];
  for (const item of items) detections.push(...replayOne(item, asOf, medians));
  detections.push(...replayGroups(items, asOf, medians));
  return { detections, medians, base };
}

function ownGrade(row, h) {
  const g = row.grades?.[`${h}d`];
  if (!g?.scored) return null;
  if (row.privateOnly || row.explore || row.candidate) return null;
  if (row.startSrc === "fill" || row.endSrc === "fill") return null;
  if (g.fromSrc === "fill" || g.toSrc === "fill") return null;
  return g;
}

export function scoreGates(detections, base, asOf) {
  const buckets = new Map();
  for (const row of detections) {
    for (const h of HORIZONS) {
      const g = ownGrade(row, h);
      if (!g) continue;
      const key = `${row.pattern}|${row.stage}|${row.kind}|${h}d`;
      if (!buckets.has(key)) buckets.set(key, { pattern: row.pattern, stage: row.stage, kind: row.kind, horizon: h, n: 0, hits: 0, w: 0, wh: 0, examples: [] });
      const b = buckets.get(key);
      const weight = decayWeight(row.date, asOf);
      b.n += 1;
      b.w += weight;
      if (g.hit) { b.hits += 1; b.wh += weight; }
      b.examples.push({ id: row.id, name: row.name, from: g.from, to: g.to, p0: g.p0, p1: g.p1, pct: g.pct, date: row.date });
    }
  }
  const gates = [];
  for (const row of buckets.values()) {
    const baseKind = row.kind === "group" ? (row.metrics?.noun === "sealed" ? "sealed" : "single") : row.kind;
    const baseRow = base.get(`${baseKind}|${row.horizon}d`);
    const rate = row.w > 0 ? row.wh / row.w : 0;
    const baseRate = baseRow && baseRow.w > 0 ? baseRow.wh / baseRow.w : null;
    const passed = row.n >= MIN_N && baseRate != null && baseRow.n >= MIN_N && rate > baseRate;
    const dated = row.examples.filter((ex) => ex.from && ex.to);
    const mid = medianOf(row.examples.map((ex) => ex.pct));
    const examples = row.examples
      .filter((ex) => ex.p0 > 0 && ex.p1 > 0)
      .sort((a, b) => Math.abs(a.pct - mid) - Math.abs(b.pct - mid) || (a.id < b.id ? -1 : 1))
      .slice(0, 3);
    gates.push({
      ...row,
      rate: round1(rate * 100),
      decayedRate: rate,
      baseRate: baseRate == null ? null : round1(baseRate * 100),
      baseDecayed: baseRate,
      passed,
      weight: passed ? round1(rate * 1000) / 1000 : 0,
      medianPct: mid == null ? null : round1(mid),
      examples,
      from: dated.length ? dated.map((ex) => ex.from).sort()[0] : "",
      to: dated.length ? dated.map((ex) => ex.to).sort().at(-1) : "",
    });
  }
  gates.sort((a, b) => (a.pattern < b.pattern ? -1 : 1) || (a.stage < b.stage ? -1 : 1) || (a.horizon - b.horizon));
  return gates;
}

export function provenPatterns(gates) {
  const ids = new Set();
  for (const row of gates) if (row.passed && !row.pattern.includes("+")) ids.add(row.pattern);
  return ids;
}

export function rotationMembership(items, asOf) {
  const sealed = items.filter((item) => item.kind === "sealed").slice().sort(topOrder);
  const singles = items.filter((item) => item.kind === "single").slice().sort(topOrder);
  const tops = new Set([...sealed.slice(0, TOP_SEALED), ...singles.slice(0, TOP_SINGLES)].map((item) => item.id));
  const night = dayNum(asOf) % 7;
  const tonight = items.filter((item) => tops.has(item.id) || bucketOf(item.id) === night);
  return { tops, tonight, night };
}

function topOrder(a, b) {
  return (b.price || 0) - (a.price || 0) || (a.id < b.id ? -1 : 1);
}

export function splitScan(tonight, tops, asOf) {
  const rng = mulberry32(seedFromDate(asOf));
  const proven = [];
  const explore = [];
  const ordered = tonight.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const item of ordered) {
    if (tops.has(item.id) || rng() >= EXPLORE_SHARE) proven.push(item);
    else explore.push(item);
  }
  const tail = ordered.filter((item) => !tops.has(item.id));
  const tailExplore = explore.filter((item) => !tops.has(item.id)).length;
  return {
    proven, explore,
    provenN: proven.length,
    exploreN: explore.length,
    tailExploreShare: tail.length ? tailExplore / tail.length : 0,
  };
}

export function coveredInWeek(ids, startDate) {
  const seen = new Set();
  for (let i = 0; i < 7; i += 1) {
    const night = dayNum(addDays(startDate, i)) % 7;
    for (const id of ids) if (bucketOf(id) === night) seen.add(id);
  }
  return seen.size === new Set(ids).size;
}

function scanView(item, asOf) {
  return { ...item, asOf, points: (item.points || []).filter((p) => p.date <= asOf) };
}

export function presentDetections({ items, groupItems, asOf, gates, ready = false }) {
  const plan = ready
    ? { tops: new Set(items.filter((item) => item.top).map((item) => item.id)), tonight: items }
    : rotationMembership(items, asOf);
  const { tops, tonight } = plan;
  const split = splitScan(tonight, tops, asOf);
  const proven = provenPatterns(gates);
  const present = [];
  const useProven = () => {
    if (!proven.size) return ITEM_PATTERNS;
    const matched = ITEM_PATTERNS.filter((pat) => pat.privateOnly || proven.has(pat.id));
    return matched.length ? matched : ITEM_PATTERNS;
  };
  for (const item of split.proven) {
    const view = scanView(item, asOf);
    for (const pat of useProven()) {
      const hit = pat.detect(view, {});
      if (!hit) continue;
      present.push(detectionFrom(item, hit, asOf, { privateOnly: pat.privateOnly === true }));
    }
  }
  for (const item of split.explore) {
    const view = scanView(item, asOf);
    const confirmed = [];
    for (const pat of ITEM_PATTERNS) {
      const hit = pat.detect(view, {});
      if (!hit) continue;
      present.push(detectionFrom(item, hit, asOf, { privateOnly: pat.privateOnly === true }));
      if (hit.stage === "confirmed" && !pat.privateOnly) confirmed.push(pat.id);
    }
    const windowDays = EXPLORE_WINDOWS[hash32(`${item.id}|${asOf}`) % EXPLORE_WINDOWS.length];
    for (const pat of ITEM_PATTERNS) {
      if (pat.privateOnly) continue;
      const hit = pat.detect(view, { windowDays });
      if (!hit) continue;
      present.push(detectionFrom(item, hit, asOf, { explore: true }));
    }
    if (confirmed.length >= 2) {
      const pair = confirmed.slice().sort().join("+");
      present.push({
        id: item.id, name: item.name || "", kind: item.kind, pattern: pair, stage: "confirmed",
        date: asOf, strength: 10, start: asOf, end: asOf, p0: null, p1: null,
        startSrc: "own", endSrc: "own", metrics: {}, privateOnly: false, explore: false,
        candidate: pair, href: item.href || "", set: item.set || "",
      });
    }
  }
  const grouped = groupItems || items;
  const nowRows = groupRowsAt(grouped, asOf);
  const prevRows = groupRowsAt(grouped, addDays(asOf, -7));
  const groups = buildGroupSeries(nowRows, asOf);
  stampPrior(groups, buildGroupSeries(prevRows, addDays(asOf, -7)));
  for (const group of groups) {
    const hit = groupTogether.detect({ group, asOf });
    if (!hit) continue;
    present.push({
      id: group.key, name: group.name, kind: "group", pattern: "group-together", stage: hit.stage,
      date: asOf, strength: hit.strength, start: hit.dates.start, end: hit.dates.end,
      p0: null, p1: null, startSrc: group.fill ? "fill" : "own", endSrc: group.fill ? "fill" : "own",
      metrics: { ...hit.metrics, groupType: group.type, noun: group.kind },
      privateOnly: false, explore: false, candidate: "", href: "", set: group.type === "set" ? group.name : "",
    });
  }
  const breakRows = breakaways(nowRows, prevRows);
  for (const row of breakRows) {
    const hit = breakaway.detect({ breakaway: row.breakaway, asOf });
    if (!hit) continue;
    present.push(detectionFrom(row.item, hit, asOf, {}));
  }
  return { present, split, tops: tops.size, tonight: tonight.length };
}

export function gateFor(gates, pattern, stage, kind) {
  const rows = gates.filter((row) => row.passed && row.pattern === pattern && row.stage === stage && row.kind === kind);
  return rows.find((row) => row.horizon === 30) || rows.find((row) => row.horizon === 7) || rows.find((row) => row.horizon === 90) || null;
}

export function rankExtremes(gates) {
  const ranked = gates.filter((row) => row.n >= MIN_N && row.horizon === 30 && !String(row.pattern).includes("+"));
  const pool = ranked.length >= 6 ? ranked : gates.filter((row) => row.n >= MIN_N && !String(row.pattern).includes("+"));
  const sorted = pool.slice().sort((a, b) => b.decayedRate - a.decayedRate || b.n - a.n || (a.pattern < b.pattern ? -1 : 1));
  return { strongest: sorted.slice(0, 3), weakest: sorted.slice(-3).reverse() };
}
