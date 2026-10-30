// Year-range, year-ago, and season reads.
// Year-range uses chart hist plus fillHist. An own day wins on the same date.
// Fill is kept only before the first own day. Singles pick up year-range when
// their fill file covers the same gate. Year-ago and season use that merged
// line for sealed, and the long own archive for singles.
// A set-wide season line needs 20 items with both ends. Nothing is invented.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { chartSeries, money, pretty, BANNED as BUNDLE_BAN, FILLER_BAN } from "./public-bundle.mjs";
import { addDays, dateLabel as monthLabel } from "./history-reads.mjs";
import { loadFillMap } from "./fill-history.mjs";
import { loadHistoryCards } from "./history-reads.mjs";
import { publicCopyOk } from "./year-patterns.mjs";
import { speakDates } from "./read-quality.mjs";
import { cardTitle, tcgAmount } from "./card-face.mjs";

const usd = (n) => tcgAmount(n, money);

export const MIN_HISTORY_DAYS = 300;
export const MIN_RANGE_PCT = 10;
export const NEAR_EDGE = 0.15;
export const YEAR_SLACK_DAYS = 3;
export const MIN_MOVE_PCT = 5;
export const MAX_MOVE_PCT = 500;
export const SEASON_DAYS = 30;
export const MIN_SET_ITEMS = 20;
export const MIN_PRICE = 5;
export const YEAR_RANGE_CAP = 6;
export const YEAR_AGO_CAP = 6;
export const SEASON_ITEM_CAP = 4;
export const SEASON_SET_CAP = 3;
export const FAN_NOTE = "Earlier days come from public fan-site data (PokeVizInvestor, TCGplayer market).";

const PRINT_WORD = /\bprintings?\b/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function spanCopyOk(text) {
  const s = String(text || "");
  return publicCopyOk(s) && !BUNDLE_BAN.test(s) && !FILLER_BAN.test(s) && !PRINT_WORD.test(s);
}

function fullDate(iso, asOf) {
  const label = monthLabel(iso, asOf);
  return label.includes(iso.slice(0, 4)) ? label : `${label}, ${iso.slice(0, 4)}`;
}

function numText(n) {
  const v = Math.round(Number(n) * 10) / 10;
  if (!Number.isFinite(v)) return "";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function signedPct(n) {
  const body = numText(Math.abs(n));
  if (n > 0) return `+${body}%`;
  if (n < 0) return `-${body}%`;
  return "0%";
}

export function shownPct(from, to) {
  if (!(from > 0) || !(to > 0)) return null;
  return Math.round(((to - from) / from) * 1000) / 10;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function pairsOf(rows) {
  const out = [];
  for (const raw of rows || []) {
    const date = Array.isArray(raw) ? raw[0] : raw?.date;
    const price = Number(Array.isArray(raw) ? raw[1] : raw?.price);
    if (!DAY.test(String(date || "")) || !(price > 0)) continue;
    out.push([date, Math.round(price * 100) / 100]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return out;
}

// Own days win. A fill day on or after the first own day is left out.
export function mergeOwnFill(hist, fillHist) {
  const own = pairsOf(hist);
  const first = own.length ? own[0][0] : null;
  const map = new Map();
  if (first) {
    for (const [date, price] of pairsOf(fillHist)) {
      if (date >= first) continue;
      map.set(date, { date, price, src: "fill" });
    }
  }
  for (const [date, price] of own) map.set(date, { date, price, src: "own" });
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function nearest(points, day, slack) {
  let best = null;
  for (const p of points || []) {
    if (!p || !DAY.test(p.date) || !(p.price > 0)) continue;
    const dist = Math.abs(daysBetween(day, p.date));
    if (dist > slack) continue;
    if (!best || dist < best.dist || (dist === best.dist && p.date < best.p.date)) best = { dist, p };
  }
  return best ? best.p : null;
}

function ownNow(points, asOf) {
  return nearest((points || []).filter((p) => p.src !== "fill"), asOf, YEAR_SLACK_DAYS);
}

function usedFill(points) {
  return (points || []).some((p) => p && p.src === "fill");
}

function finishRead(read) {
  const bits = [read.headline, read.path, read.why, read.source, ...(read.lines || []), read.chart?.label || ""];
  if (bits.some((s) => !s || !spanCopyOk(s))) return null;
  if (read.lines.length < 3 || read.lines.length > 6) return null;
  return read;
}

function hrefFor(item) {
  if (item.href) return item.href;
  return item.kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`;
}

function base(kind, item, headline, lines, asOf, source, extra) {
  return finishRead({
    id: `span-${kind}-${String(item.id || item.set || "x")}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90),
    sku: item.sku || item.id || "",
    href: extra.href != null ? extra.href : hrefFor(item),
    readKind: kind,
    kind,
    deep: kind,
    board: "v3",
    family: kind,
    name: item.name || item.set || "",
    set: item.set || "",
    ...(item.number ? { number: item.number } : {}),
    headline: speakDates(headline, asOf),
    path: speakDates(headline, asOf),
    lines: (lines || []).map((line) => speakDates(line, asOf)),
    asOf,
    source: speakDates(source, asOf),
    why: extra.why ? speakDates(extra.why, asOf) : extra.why,
    price: extra.price,
    startDate: extra.startDate,
    endDate: extra.endDate,
    chart: extra.chart,
    receipt: extra.receipt,
  });
}

function extreme(points, dir) {
  let best = points[0];
  for (const p of points) {
    const better = dir > 0
      ? p.price > best.price || (p.price === best.price && p.date < best.date)
      : p.price < best.price || (p.price === best.price && p.date < best.date);
    if (better) best = p;
  }
  return best;
}

export function yearRangeRead(item, asOf) {
  const points = (item?.points || []).filter((p) => DAY.test(p.date) && p.price > 0 && p.date <= asOf && p.date >= addDays(asOf, -365));
  if (points.length < 2) return null;
  const sorted = points.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const span = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  if (span < MIN_HISTORY_DAYS) return null;
  const now = ownNow(sorted, asOf);
  if (!now || now.price < MIN_PRICE) return null;
  const low = extreme(sorted, -1);
  const high = extreme(sorted, 1);
  if (!(high.price > low.price)) return null;
  const rangePct = ((high.price - low.price) / low.price) * 100;
  if (Math.round(rangePct * 10) / 10 < MIN_RANGE_PCT) return null;
  const pos = (now.price - low.price) / (high.price - low.price);
  const edge = pos <= NEAR_EDGE ? "low" : pos >= 1 - NEAR_EDGE ? "high" : "";
  if (!edge) return null;
  const fill = usedFill(sorted);
  const spot = Math.round(pos * 100);
  const headline = `Near the ${edge} end of its 12-month range: ${item.name}, ${usd(now.price)} on ${fullDate(now.date, asOf)}.`;
  const lines = [
    `Low ${usd(low.price)} on ${fullDate(low.date, asOf)}. High ${usd(high.price)} on ${fullDate(high.date, asOf)}.`,
    `Latest price ${usd(now.price)} on ${fullDate(now.date, asOf)}, ${spot}% of the way from the low to the high.`,
    `Points on file from ${fullDate(sorted[0].date, asOf)} to ${fullDate(sorted[sorted.length - 1].date, asOf)}, ${span} days. The range is ${numText(rangePct)}% from the low to the high.`,
  ];
  if (fill) lines.push(FAN_NOTE);
  const why = `The low and the high are the lowest and highest points from ${sorted[0].date} to ${sorted[sorted.length - 1].date}. Near the low end means the latest price is in the lowest 15% of that range. Near the high end means the highest 15%. A history under 300 days, or a range under 10%, is not used.`;
  const chartPts = [low, high, now]
    .filter((p, i, arr) => arr.findIndex((q) => q.date === p.date && q.price === p.price) === i)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((p) => [p.date, p.price]);
  return base("year-range", item, headline, lines, asOf, `TCGplayer market, ${sorted[0].date} to ${sorted[sorted.length - 1].date}`, {
    why,
    price: now.price,
    startDate: sorted[0].date,
    endDate: now.date,
    chart: chartPts.length >= 2 ? { label: "12-month low, high, and latest", points: chartPts } : undefined,
    receipt: { edge, pos: Math.round(pos * 1000) / 1000, spanDays: span, rangePct: Math.round(rangePct * 10) / 10, low, high, now, usedFill: fill, kind: item.kind },
  });
}

export function calendarEnds(asOf) {
  const end = addDays(asOf, -365);
  return { mode: "calendar", start: addDays(end, -SEASON_DAYS), end };
}

export function releaseEnds(release, asOf) {
  if (!DAY.test(String(release || "")) || !DAY.test(String(asOf || ""))) return null;
  const md = release.slice(5);
  const year = Number(asOf.slice(0, 4));
  let ann = `${year}-${md}`;
  if (new Date(`${ann}T00:00:00Z`).toISOString().slice(0, 10) !== ann) return null;
  if (ann > asOf) ann = `${year - 1}-${md}`;
  if (new Date(`${ann}T00:00:00Z`).toISOString().slice(0, 10) !== ann) return null;
  const age = daysBetween(ann, asOf);
  if (age < 0 || age > SEASON_DAYS) return null;
  const start = addDays(ann, -365);
  if (!DAY.test(start)) return null;
  const first = Math.abs(daysBetween(release, start)) <= YEAR_SLACK_DAYS;
  return { mode: "release", start, end: addDays(start, SEASON_DAYS), first };
}

export function yearAgoRead(item, asOf) {
  const now = ownNow(item?.points, asOf);
  if (!now || now.price < MIN_PRICE) return null;
  const want = addDays(asOf, -365);
  const then = nearest(item.points, want, YEAR_SLACK_DAYS);
  if (!then || then.date === now.date) return null;
  const pct = shownPct(then.price, now.price);
  if (pct == null || Math.abs(pct) < MIN_MOVE_PCT || Math.abs(pct) > MAX_MOVE_PCT) return null;
  const today = then.date === want && now.date === asOf;
  const headline = today
    ? `A year ago today it was ${usd(then.price)} on ${fullDate(then.date, asOf)}, now ${usd(now.price)} on ${fullDate(now.date, asOf)} (${signedPct(pct)}).`
    : `A year ago it was ${usd(then.price)} on ${fullDate(then.date, asOf)}, now ${usd(now.price)} on ${fullDate(now.date, asOf)} (${signedPct(pct)}).`;
  const fill = then.src === "fill" || now.src === "fill";
  const lines = [
    `${usd(then.price)} on ${then.date}. ${usd(now.price)} on ${now.date}. ${signedPct(pct)} across ${daysBetween(then.date, now.date)} days.`,
    today
      ? `The earlier point is the same month and day last year.`
      : `The earlier point is ${fullDate(then.date, asOf)}, at most 3 days from ${fullDate(want, asOf)}.`,
    `TCGplayer market. Moves under 5% are not used. Moves over 500% are not used.`,
  ];
  if (fill) lines.push(FAN_NOTE);
  return base("year-ago", item, headline, lines, asOf, `TCGplayer market, ${then.date} and ${now.date}`, {
    why: `The earlier price is a real point at most 3 days from ${want}. The latest price is an own day at most 3 days from ${asOf}. Moves under 5% or over 500% are not used.`,
    price: now.price,
    startDate: then.date,
    endDate: now.date,
    chart: { label: "A year ago and latest", points: [[then.date, then.price], [now.date, now.price]] },
    receipt: { then, now, pct, today, usedFill: fill, kind: item.kind },
  });
}

function seasonPair(item, asOf, now, mode) {
  const start = nearest(item.points, mode.start, YEAR_SLACK_DAYS);
  const end = nearest(item.points, mode.end, YEAR_SLACK_DAYS);
  if (!start || !end || start.date === end.date) return null;
  if (daysBetween(start.date, end.date) < SEASON_DAYS - YEAR_SLACK_DAYS * 2) return null;
  const pct = shownPct(start.price, end.price);
  if (pct == null) return null;
  return { start, end, pct, now, mode };
}

export function seasonItemRead(item, asOf) {
  const now = ownNow(item?.points, asOf);
  if (!now || now.price < MIN_PRICE) return null;
  const modes = [];
  const release = releaseEnds(item.release, asOf);
  if (release) modes.push(release);
  modes.push(calendarEnds(asOf));
  for (const mode of modes) {
    const pair = seasonPair(item, asOf, now, mode);
    if (!pair || Math.abs(pair.pct) < MIN_MOVE_PCT || Math.abs(pair.pct) > MAX_MOVE_PCT) continue;
    const fill = pair.start.src === "fill" || pair.end.src === "fill" || now.src === "fill";
    const when = mode.mode === "release"
      ? (mode.first ? `in the 30 days after ${item.set || "the set"} released` : "in the 30 days after its release date last year")
      : "in the same 30 days last year";
    const headline = `${item.name}: ${when}, ${usd(pair.start.price)} on ${fullDate(pair.start.date, asOf)} to ${usd(pair.end.price)} on ${fullDate(pair.end.date, asOf)} (${signedPct(pair.pct)}).`;
    const lines = [
      `${usd(pair.start.price)} on ${pair.start.date}. ${usd(pair.end.price)} on ${pair.end.date}. ${signedPct(pair.pct)}.`,
      `Latest price ${usd(now.price)} on ${fullDate(now.date, asOf)}.`,
      mode.mode === "release"
        ? `The window is the 30 days after the release date last year. Each end is a real point at most 3 days from ${mode.start} or ${mode.end}.`
        : `The window is the 30 days ending on the same date last year. Each end is a real point at most 3 days from ${mode.start} or ${mode.end}.`,
    ];
    if (fill) lines.push(FAN_NOTE);
    const read = base("season", item, headline, lines, asOf, `TCGplayer market, ${pair.start.date} and ${pair.end.date}`, {
      why: `Last year's 30-day window uses real points at most 3 days from each end. Item lines under 5% or over 500% are not used.`,
      price: now.price,
      startDate: pair.start.date,
      endDate: pair.end.date,
      chart: { label: "Same 30 days last year", points: [[pair.start.date, pair.start.price], [pair.end.date, pair.end.price]] },
      receipt: { mode: mode.mode, start: pair.start, end: pair.end, now, pct: pair.pct, usedFill: fill, kind: item.kind, set: item.set || "" },
    });
    if (read) return read;
  }
  return null;
}

function dateSpan(dates, asOf) {
  const list = [...new Set(dates.filter((d) => DAY.test(d)))].sort();
  if (!list.length) return "";
  if (list.length === 1) return fullDate(list[0], asOf);
  return `${fullDate(list[0], asOf)} to ${fullDate(list[list.length - 1], asOf)}`;
}

export function seasonSetRead(items, asOf) {
  const list = (items || []).filter((item) => item && item.set);
  if (!list.length) return null;
  const release = releaseEnds(list.find((item) => item.release)?.release || "", asOf);
  const modes = [];
  if (release) modes.push(release);
  modes.push(calendarEnds(asOf));
  for (const mode of modes) {
    const measured = [];
    for (const item of list) {
      const now = ownNow(item.points, asOf);
      if (!now) continue;
      const pair = seasonPair(item, asOf, now, mode);
      if (!pair) continue;
      measured.push({ item, ...pair });
    }
    if (measured.length < MIN_SET_ITEMS) continue;
    let up = 0;
    let down = 0;
    let flat = 0;
    for (const row of measured) {
      if (row.pct > 0) up += 1;
      else if (row.pct < 0) down += 1;
      else flat += 1;
    }
    const calm = measured.filter((row) => Math.abs(row.pct) <= MAX_MOVE_PCT);
    const pool = calm.length ? calm : measured;
    const lead = pool.slice().sort((a, b) => {
      const dollars = Math.abs(b.end.price - b.start.price) - Math.abs(a.end.price - a.start.price);
      if (dollars) return dollars;
      return Math.abs(b.pct) - Math.abs(a.pct) || (a.item.id < b.item.id ? -1 : 1);
    })[0];
    const kind = list[0].kind === "sealed" ? "sealed" : "single";
    const noun = kind === "sealed" ? "priced sealed items" : "priced cards";
    const fill = measured.some((row) => row.start.src === "fill" || row.end.src === "fill");
    const when = mode.mode === "release"
      ? (mode.first ? "in the 30 days after release last year" : "in the 30 days after its release date last year")
      : "in the same 30 days last year";
    const headline = `${list[0].set}, ${when}: ${up} of ${measured.length} ${noun} were up and ${down} were down.`;
    const lines = [
      `Up ${up}, down ${down}, flat ${flat}, of ${measured.length} ${noun} with a real point at both ends.`,
      `Start points ${dateSpan(measured.map((row) => row.start.date), asOf)}. End points ${dateSpan(measured.map((row) => row.end.date), asOf)}.`,
      `Largest move: ${lead.item.name}, ${usd(lead.start.price)} on ${fullDate(lead.start.date, asOf)} to ${usd(lead.end.price)} on ${fullDate(lead.end.date, asOf)} (${signedPct(lead.pct)}).`,
      `TCGplayer market. A set line needs at least 20 items with both ends.`,
    ];
    if (fill) lines.push(FAN_NOTE);
    const slug = list.find((item) => item.setSlug)?.setSlug || "";
    const read = base("season", { id: `set-${slug || list[0].set}-${kind}`, name: list[0].set, set: list[0].set, sku: lead.item.id }, headline, lines, asOf, `TCGplayer market, ${mode.start} to ${mode.end}`, {
      href: slug ? `/sets/${slug}` : hrefFor(lead.item),
      why: `Each item needs its own point at most 3 days from each end of last year's window. Groups under 20 items get no set-wide line.`,
      price: lead.end.price,
      startDate: mode.start,
      endDate: mode.end,
      chart: { label: "Largest move last year, $", points: [[lead.start.date, lead.start.price], [lead.end.date, lead.end.price]] },
      receipt: { mode: mode.mode, set: list[0].set, kind, n: measured.length, up, down, flat, lead: { id: lead.item.id, start: lead.start, end: lead.end, pct: lead.pct }, usedFill: fill, setWide: true },
    });
    if (read) return read;
  }
  return null;
}

function takeHalf(rows, cap) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.half;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const keys = [...groups.keys()];
  const out = [];
  const seen = new Set();
  const share = Math.max(1, Math.ceil(cap / Math.max(keys.length, 1)));
  for (const key of keys) {
    for (const row of groups.get(key).slice(0, share)) {
      if (seen.has(row.read.id)) continue;
      seen.add(row.read.id);
      out.push(row);
    }
  }
  for (const row of rows) {
    if (out.length >= cap) break;
    if (seen.has(row.read.id)) continue;
    seen.add(row.read.id);
    out.push(row);
  }
  return out.slice(0, cap);
}

export function assembleSpanReads({ rangeItems = [], agoItems = [], asOf }) {
  const yearRange = [];
  for (const item of rangeItems) {
    const read = yearRangeRead(item, asOf);
    if (!read) continue;
    yearRange.push({ read, half: read.receipt.edge, rank: read.receipt.edge === "low" ? read.receipt.pos : 1 - read.receipt.pos });
  }
  yearRange.sort((a, b) => a.rank - b.rank || (a.read.id < b.read.id ? -1 : 1));
  const yearAgo = [];
  for (const item of agoItems) {
    const read = yearAgoRead(item, asOf);
    if (!read) continue;
    yearAgo.push({ read, half: read.receipt.kind === "sealed" ? "sealed" : "single", rank: -Math.abs(read.receipt.pct) });
  }
  yearAgo.sort((a, b) => a.rank - b.rank || (a.read.id < b.read.id ? -1 : 1));
  const seasonItem = [];
  for (const item of agoItems) {
    const read = seasonItemRead(item, asOf);
    if (!read) continue;
    seasonItem.push({ read, half: read.receipt.mode, rank: -Math.abs(read.receipt.pct) });
  }
  seasonItem.sort((a, b) => a.rank - b.rank || (a.read.id < b.read.id ? -1 : 1));
  const groups = new Map();
  for (const item of agoItems) {
    if (!item.set) continue;
    const key = `${item.kind || "single"}|${item.set}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const seasonSet = [];
  for (const list of groups.values()) {
    const read = seasonSetRead(list, asOf);
    if (!read) continue;
    seasonSet.push({ read, half: read.receipt.mode, rank: -read.receipt.n });
  }
  seasonSet.sort((a, b) => a.rank - b.rank || (a.read.id < b.read.id ? -1 : 1));
  const picked = [
    ...takeHalf(yearRange, YEAR_RANGE_CAP),
    ...takeHalf(yearAgo, YEAR_AGO_CAP),
    ...takeHalf(seasonItem, SEASON_ITEM_CAP),
    ...takeHalf(seasonSet, SEASON_SET_CAP),
  ];
  const reads = [];
  const seen = new Set();
  for (const row of picked) {
    if (seen.has(row.read.id)) continue;
    seen.add(row.read.id);
    reads.push(row.read);
  }
  const countOf = (list, pred) => list.filter(pred).length;
  return {
    reads,
    counts: {
      yearRangeQualified: yearRange.length,
      yearRange: reads.filter((r) => r.readKind === "year-range").length,
      yearRangeLow: countOf(yearRange, (r) => r.half === "low"),
      yearRangeHigh: countOf(yearRange, (r) => r.half === "high"),
      yearAgoQualified: yearAgo.length,
      yearAgo: reads.filter((r) => r.readKind === "year-ago").length,
      yearAgoSingle: countOf(yearAgo, (r) => r.half === "single"),
      yearAgoSealed: countOf(yearAgo, (r) => r.half === "sealed"),
      seasonItemQualified: seasonItem.length,
      seasonItem: reads.filter((r) => r.readKind === "season" && !r.receipt?.setWide).length,
      seasonCalendar: countOf(seasonItem, (r) => r.half === "calendar"),
      seasonRelease: countOf(seasonItem, (r) => r.half === "release"),
      seasonSetQualified: seasonSet.length,
      seasonSet: reads.filter((r) => r.receipt?.setWide).length,
    },
  };
}

function normName(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function loadOwnSeries(root) {
  const map = new Map();
  const dir = join(root, "data/history/tcgcsv-daily");
  for (const file of (await readdir(dir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const day = file.slice(0, 10);
    if (!DAY.test(day)) continue;
    const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", file), "utf8"));
    for (const row of doc.prices || []) {
      const id = Number(row.id);
      const price = Number(row.market);
      if (!id || !(price > 0)) continue;
      if (!map.has(id)) map.set(id, new Map());
      map.get(id).set(day, Math.round(price * 100) / 100);
    }
  }
  return map;
}

function pointsFromSeries(series, pid, fillMap) {
  const days = series.get(Number(pid));
  if (!days || !days.size) return [];
  const hist = chartSeries([...days.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  const fill = fillMap.get(Number(pid));
  return mergeOwnFill(hist, fill?.points || []);
}

export async function collectSpanReads({ root, asOf, series }) {
  const day = String(asOf || "").slice(0, 10);
  if (!DAY.test(day)) return { reads: [], counts: {} };
  const own = series || await loadOwnSeries(root);
  const fillMap = loadFillMap(root);
  const catalog = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const setsDoc = JSON.parse(await readFile(join(root, "research/assets/public/sets.json"), "utf8"));
  let groups = {};
  try { groups = JSON.parse(await readFile(join(root, "data/tcgcsv-group-dates.json"), "utf8")); } catch { groups = {}; }
  const setByName = new Map((setsDoc.sets || []).map((row) => [normName(row.name), row]));
  const rangeItems = [];
  const sealedAgo = [];
  for (const item of catalog.items || []) {
    const points = pointsFromSeries(own, item.tcgplayerProductId, fillMap);
    if (points.length < 2) continue;
    const meta = setByName.get(normName(pretty(item.set))) || {};
    const release = groups[String(item.groupId)] || meta.release || "";
    const kind = item.kind === "sealed" ? "sealed" : "single";
    const titled = item.number
      ? cardTitle({ name: pretty(item.name), set: pretty(item.set || meta.name || ""), number: item.number })
      : pretty(item.name);
    const row = {
      id: item.id,
      name: titled,
      number: item.number || "",
      set: pretty(item.set || meta.name || ""),
      setSlug: meta.slug || "",
      kind,
      release,
      href: kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
      points,
    };
    rangeItems.push(row);
    if (kind === "sealed") sealedAgo.push(row);
  }
  const { cards } = await loadHistoryCards(root);
  const singles = [];
  for (const card of cards) {
    const points = (card.pts || []).filter((p) => Array.isArray(p) && DAY.test(p[0]) && Number(p[1]) > 0).map((p) => ({ date: p[0], price: Number(p[1]), src: "own" }));
    if (points.length < 2) continue;
    singles.push({
      id: card.id,
      name: cardTitle(card),
      number: card.number || "",
      set: card.set || "",
      setSlug: card.setSlug || "",
      kind: "single",
      release: card.release || "",
      href: `/c/${card.id}`,
      points,
    });
  }
  const agoItems = [...singles, ...sealedAgo];
  return assembleSpanReads({ rangeItems, agoItems, asOf: day });
}
