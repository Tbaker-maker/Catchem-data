// Factual trend line for a public read, from own tcgcsv days only.
// A fill-tagged point is dropped. A missing day is a gap, not a filled price.
// The public line is dates and percents. A year-patterns path key, including
// slow_climb, stays in the private file and is not copied into the line.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { bannedWord } from "./public-bundle.mjs";
import { openPrivate } from "./private-store.mjs";
import { pathKey, publicCopyOk } from "./year-patterns.mjs";

export const MIN_SPAN_DAYS = 14;
export const MIN_MOVE_PCT = 3;
export const MAX_WEEKS = 6;
export const WEEK_SLACK_DAYS = 3;

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export function addDays(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

function monthDay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const month = MONTHS[Number(String(iso).slice(5, 7)) - 1];
  if (!month) return "";
  return `${month} ${Number(String(iso).slice(8, 10))}`;
}

function fmtPct(n) {
  const r = Math.round(Math.abs(Number(n)) * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

// Untagged pairs are own days. A point tagged fill is ignored.
// On one date, an own price replaces a fill price.
export function ownSeries(points) {
  const byDate = new Map();
  for (const raw of points || []) {
    const date = Array.isArray(raw) ? raw[0] : raw?.date;
    const price = Number(Array.isArray(raw) ? raw[1] : raw?.price);
    const src = Array.isArray(raw) ? "own" : (raw?.src || "own");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !(price > 0)) continue;
    if (src === "fill") {
      if (!byDate.has(date)) byDate.set(date, { date, price, src: "fill" });
      continue;
    }
    byDate.set(date, { date, price, src: "own" });
  }
  return [...byDate.values()].filter((p) => p.src !== "fill").sort((a, b) => (a.date < b.date ? -1 : 1));
}

function nearest(points, target, slack) {
  let best = null;
  for (const p of points) {
    const d = Math.abs(daysBetween(p.date, target));
    if (d > slack) continue;
    if (!best || d < best.d || (d === best.d && p.date < best.p.date)) best = { d, p };
  }
  return best ? best.p : null;
}

export function weekStats(points, asOf) {
  const ends = [];
  const used = new Set();
  for (let k = 0; k <= MAX_WEEKS; k += 1) {
    const target = addDays(asOf, -7 * k);
    const p = nearest(points, target, WEEK_SLACK_DAYS);
    if (!p || used.has(p.date)) break;
    // A week step is 7 days, plus or minus one. A wider gap is not called a week.
    if (ends.length) {
      const gap = daysBetween(p.date, ends[ends.length - 1].date);
      if (gap < 6 || gap > 8) break;
    }
    used.add(p.date);
    ends.push(p);
  }
  let up = 0;
  let down = 0;
  let flat = 0;
  for (let i = 0; i < ends.length - 1; i += 1) {
    const newer = Math.round(ends[i].price * 100);
    const older = Math.round(ends[i + 1].price * 100);
    if (newer > older) up += 1;
    else if (newer < older) down += 1;
    else flat += 1;
  }
  return { steps: Math.max(0, ends.length - 1), up, down, flat };
}

export function direction7(points, asOf) {
  const end = nearest(points, asOf, WEEK_SLACK_DAYS);
  if (!end) return null;
  const startDate = addDays(end.date, -7);
  const start = points.find((p) => p.date === startDate);
  if (!start || daysBetween(start.date, end.date) !== 7) return null;
  const a = Math.round(start.price * 100);
  const b = Math.round(end.price * 100);
  const dir = b > a ? "up" : b < a ? "down" : "flat";
  return { dir, from: start.date, to: end.date };
}

function weekSentence(w) {
  const n = w?.steps || 0;
  if (!n) return "";
  if (n === 1) {
    if (w.up === 1) return "Up in the last week.";
    if (w.down === 1) return "Down in the last week.";
    return "Flat in the last week.";
  }
  if (w.up === 0 && w.down === 0) return `Flat across the last ${n} weeks.`;
  if (w.down > w.up) return `Down ${w.down} of the last ${n} weeks.`;
  return `Up ${w.up} of the last ${n} weeks.`;
}

function changeSentence(change, from, to) {
  const word = change > 0 ? "Up" : "Down";
  const a = monthDay(from);
  const b = monthDay(to);
  if (!a || !b) return "";
  return `${word} ${fmtPct(change)}% from ${a} to ${b}.`;
}

function dirSentence(dir) {
  if (dir === "up") return "Up over 7 days.";
  if (dir === "down") return "Down over 7 days.";
  if (dir === "flat") return "Flat over 7 days.";
  return "";
}

export function publicTrendOk(text) {
  const s = String(text || "");
  if (!publicCopyOk(s) || bannedWord(s)) return false;
  if (/slow[ _-]?climb/i.test(s)) return false;
  if (/[\u2014\u2013]/.test(s)) return false;
  return true;
}

export function trendFacts(points, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return null;
  const own = ownSeries(points).filter((p) => p.date <= asOf);
  if (own.length < 2) return null;
  const from = own[0].date;
  const to = own[own.length - 1].date;
  const span = daysBetween(from, to);
  const change = ((own[own.length - 1].price - own[0].price) / own[0].price) * 100;
  const weeks = weekStats(own, asOf);
  const dir = direction7(own, asOf);
  const fresh = daysBetween(to, asOf) <= WEEK_SLACK_DAYS;
  let line = "";
  if (fresh && span >= MIN_SPAN_DAYS && Number.isFinite(change) && Math.abs(change) >= MIN_MOVE_PCT) {
    const parts = [weekSentence(weeks), changeSentence(change, from, to), dirSentence(dir?.dir)].filter(Boolean);
    const text = parts.join(" ");
    if (publicTrendOk(text)) line = text;
  }
  let path = null;
  try { path = pathKey(own.map((p) => ({ date: p.date, price: p.price, src: "own" })), asOf); }
  catch { path = null; }
  return {
    from,
    to,
    span,
    points: own.length,
    changePct: Math.round(change * 10) / 10,
    weeksUp: weeks.up,
    weeksDown: weeks.down,
    weeks: weeks.steps,
    direction7: dir?.dir || null,
    path,
    slowClimb: path === "slow_climb",
    line,
  };
}

export function primaryId(read) {
  const sku = String(read?.sku || "");
  if (/^tcgcsv-\d+$/.test(sku)) return sku;
  const href = String(read?.href || "");
  const hit = href.match(/\/(?:c|p)\/(tcgcsv-\d+)/);
  return hit ? hit[1] : "";
}

export function itemIds(read) {
  const out = [];
  const add = (value) => {
    const hit = String(value || "").match(/tcgcsv-(\d+)/);
    if (!hit) return;
    const id = `tcgcsv-${hit[1]}`;
    if (!out.includes(id)) out.push(id);
  };
  add(primaryId(read));
  const rec = read?.receipt || {};
  add(rec.lead?.id);
  for (const key of ["cards", "up", "down", "flat"]) {
    const rows = rec[key];
    if (!Array.isArray(rows)) continue;
    for (const row of rows) add(row?.id);
  }
  return out;
}

function seriesOf(series, id) {
  if (!series || !id) return [];
  const pid = Number(String(id).replace(/^tcgcsv-/, ""));
  return series.get(pid) || series.get(id) || [];
}

function withLine(read, line) {
  const prev = typeof read?.trend === "string" ? read.trend : "";
  if (!line) {
    if (!prev) return read;
    const out = { ...read };
    delete out.trend;
    if (Array.isArray(read.lines)) out.lines = read.lines.filter((row) => row !== prev);
    return out;
  }
  const out = { ...read, trend: line };
  if (Array.isArray(read.lines)) {
    const kept = read.lines.filter((row) => row !== prev && row !== line);
    out.lines = [...kept, line];
  }
  return out;
}

// One public line per read, from the lead item only. Other items are scored
// so a slow_climb path can be labeled privately without changing the line.
export function applyTrend(reads, series, asOf) {
  const labeled = [];
  let lined = 0;
  let shortSpan = 0;
  let smallMove = 0;
  const next = (reads || []).map((read) => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(read?.asOf || "")) ? read.asOf : asOf;
    const ids = itemIds(read);
    const facts = [];
    for (const id of ids) {
      const fact = trendFacts(seriesOf(series, id), day);
      if (!fact) continue;
      facts.push({ id, ...fact });
      if (fact.slowClimb) labeled.push({ readId: read?.id || "", itemId: id, asOf: day, path: "slow_climb" });
    }
    const leadId = primaryId(read);
    const lead = facts.find((row) => row.id === leadId) || null;
    if (lead && !lead.line) {
      if (lead.span < MIN_SPAN_DAYS) shortSpan += 1;
      else if (Math.abs(lead.changePct) < MIN_MOVE_PCT) smallMove += 1;
    }
    const line = lead?.line || "";
    if (line) lined += 1;
    return withLine(read, line);
  });
  return { reads: next, lined, labeled, shortSpan, smallMove };
}

async function loadOwnDaily(root) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const series = new Map();
  let asOf = "";
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    let doc;
    try { doc = JSON.parse(await readFile(join(dir, name), "utf8")); }
    catch { continue; }
    const date = String(doc?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (!asOf || date > asOf) asOf = date;
    for (const row of doc.prices || []) {
      const pid = Number(row.id);
      const price = Number(row.market);
      if (!(pid > 0) || !(price > 0)) continue;
      if (!series.has(pid)) series.set(pid, []);
      series.get(pid).push([date, price]);
    }
  }
  return { series, asOf };
}

export async function stampTrendContext({
  root,
  token = process.env.PRIVATE_DATA_TOKEN || "",
} = {}) {
  const readsPath = join(root, "research/assets/public/reads.json");
  const doc = JSON.parse(await readFile(readsPath, "utf8"));
  const { series, asOf: lastDay } = await loadOwnDaily(root);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(doc?.asOf || "")) ? doc.asOf : lastDay;
  if (!asOf) throw new Error("no dated own day");
  const applied = applyTrend(doc.reads || [], series, asOf);
  doc.reads = applied.reads;
  doc.count = applied.reads.length;
  await writeFile(readsPath, JSON.stringify(doc, null, 1) + "\n");

  const privateDoc = {
    asOf,
    private: true,
    source: "own tcgcsv days",
    note: "slow_climb is the year-patterns path key on own days only. The public line does not use that label.",
    count: applied.labeled.length,
    rows: applied.labeled,
  };
  let stored = false;
  try {
    let store;
    try { store = await openPrivate({ root, token }); }
    catch { store = await openPrivate({ root, token: "" }); }
    const dir = join(store.dir, "trend-context");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${asOf}.json`), JSON.stringify(privateDoc, null, 1) + "\n");
    await store.close([`trend-context/${asOf}.json`], `Trend context ${asOf}: ${applied.labeled.length} slow_climb`);
    stored = true;
  } catch (err) {
    console.error(`trend context private store skipped: ${err.message}`);
  }
  return {
    asOf,
    lined: applied.lined,
    shortSpan: applied.shortSpan,
    smallMove: applied.smallMove,
    slowClimb: applied.labeled.length,
    stored,
  };
}
