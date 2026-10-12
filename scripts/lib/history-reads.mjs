// Long-history price reads for singles. Built only from real points:
//   research/assets/public/hist-long/NN.json  TCGplayer market via the tcgcsv daily
//     archive (change-only points with a 7-day heartbeat, 2024-02-08 to 2026-09-15)
//   research/assets/public/buckets/NN.json    our nightly TCGplayer market days
// Same TCGplayer product id and the same printing on both sides. Nothing is
// filled or interpolated. Every number in a line is a point on file, with its
// own date. When a window has no point on its exact day, the nearest real point
// within a few days is used and that point's own date is named.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { money } from "./public-bundle.mjs";
import { monthDay } from "./takes.mjs";

export const HIST_TAG = "hist";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LOW = new Set(["Common", "Uncommon", "Code Card", "None", ""]);
const BANNED = /\b(buy|buys|buying|sell|sells|selling|hold|holds|holding|support|resistance|bottom|printed|play|plays|playing|target|invest|investing|investment|crypto|token|moon|hodl|pump|dump|nft)\b/i;
const EM = /[\u2014\u2013]/;
const ok = (s) => !!s && !BANNED.test(s) && !EM.test(s);

export function dayNum(iso) { return Math.round(Date.parse(`${iso}T00:00:00Z`) / 86400000); }
export function isoOf(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
export function addDays(iso, n) { return isoOf(dayNum(iso) + n); }
export function monthYear(iso) { return `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`; }
// "Oct 12" this year, "Oct 9, 2025" any other year.
export function dateLabel(iso, asOf) {
  const md = monthDay(iso);
  return iso.slice(0, 4) === String(asOf || "").slice(0, 4) ? md : `${md}, ${iso.slice(0, 4)}`;
}
const pctOf = (a, b) => ((b - a) / a) * 100;
const shortSet = (s) => String(s || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
const cleanName = (n) => String(n || "").replace(/\s+-\s+[A-Z]*\d+\/[A-Z]*\d+\s*$/, "").trim();

// Nearest real point to a target day, within maxDays. Ties go to the earlier point.
export function nearestPoint(pts, target, maxDays) {
  const t = dayNum(target);
  let best = null;
  for (const p of pts) {
    const d = Math.abs(dayNum(p[0]) - t);
    if (d > maxDays) continue;
    if (!best || d < best.d || (d === best.d && p[0] < best.p[0])) best = { p, d };
  }
  return best ? best.p : null;
}

function parseLong(text) {
  const out = [];
  for (const pair of String(text || "").split(",")) {
    const [d, v] = pair.split(":");
    const n = Number(d), x = Number(v);
    if (Number.isInteger(n) && x > 0) out.push([isoOf(n), Math.round(x * 100) / 100]);
  }
  return out;
}

// Cards with both a long history and tonight's nightly price, verified by id and printing.
export async function loadHistoryCards(root) {
  const pub = join(root, "research/assets/public");
  let files = [];
  try { files = (await readdir(join(pub, "hist-long"))).filter((f) => /^\d\d\.json$/.test(f)).sort(); } catch { return { cards: [], longLast: "" }; }
  let longLast = "";
  try { longLast = JSON.parse(await readFile(join(pub, "hist-long/summary.json"), "utf8")).last || ""; } catch { /* optional */ }
  const cards = [];
  for (const f of files) {
    let long, bucket;
    try {
      long = JSON.parse(await readFile(join(pub, "hist-long", f), "utf8"));
      bucket = JSON.parse(await readFile(join(pub, "buckets", f), "utf8"));
    } catch { continue; }
    for (const r of bucket) {
      if (!r || r.kind !== "single" || !/^tcgcsv-\d+$/.test(String(r.id || ""))) continue;
      const lp = parseLong(long.rows?.[r.id]);
      const night = (r.hist || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number(p[1]) > 0).map((p) => [p[0], Number(p[1])]);
      if (lp.length < 2 || !night.length) continue;
      // A big step where the two sources meet means the printings may not match. Skip it.
      const a = lp[lp.length - 1][1], b = night[0][1];
      if (b / a > 2.5 || a / b > 2.5) continue;
      const map = new Map(lp);
      for (const p of night) map.set(p[0], p[1]);
      const pts = [...map.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1));
      cards.push({ id: r.id, name: r.name, artist: r.artist || "", number: r.num || "", set: r.set || "", setSlug: r.setSlug || "", release: r.release || "", rarity: r.rarity || "", printing: r.printing || "", pts });
    }
  }
  return { cards, longLast };
}

function eligible(c, asOf) {
  const last = c.pts[c.pts.length - 1];
  return last && last[0] === asOf && last[1] >= 10 && !LOW.has(c.rarity);
}
function who(c) { return c.set ? `${cleanName(c.name)} (${shortSet(c.set)})` : cleanName(c.name); }
function base(c, kind, headline, asOf, receipt, variants) {
  return {
    id: `${kind}-${c.id}`, sku: c.id, href: `/c/${c.id}`, readKind: kind, kind, board: HIST_TAG, family: "price",
    name: c.name, set: c.set, number: c.number, price: c.pts[c.pts.length - 1][1],
    headline, path: headline, asOf, endDate: asOf, startDate: receipt.startDate,
    source: `TCGplayer market (tcgcsv daily archive and our nightly days), ${receipt.startDate} and ${asOf}`,
    why: `Real TCGplayer market points for this product id and printing (${c.printing || "default"}), each with its own date.`,
    receipt, variants: (variants || []).filter(ok),
  };
}

// 52-week high / highest since / highest on file. Low mirrors it.
export function extremeRead(c, asOf, dir) {
  const pts = c.pts;
  const last = pts[pts.length - 1];
  const prior = pts.slice(0, -1);
  if (!prior.length || dayNum(asOf) - dayNum(pts[0][0]) < 365) return null;
  const beats = (x) => (dir > 0 ? x >= last[1] : x <= last[1]);
  let D = null;
  for (let i = prior.length - 1; i >= 0; i -= 1) if (beats(prior[i][1])) { D = prior[i]; break; }
  const yearAgo = addDays(asOf, -365);
  if (D && D[0] >= yearAgo) return null;
  const inYear = prior.filter((p) => p[0] >= yearAgo);
  if (!inYear.length) return null;
  const ext = inYear.reduce((m, p) => (dir > 0 ? (p[1] > m[1] ? p : m) : (p[1] < m[1] ? p : m)));
  const margin = dir > 0 ? last[1] / ext[1] - 1 : 1 - last[1] / ext[1];
  if (margin < 0.03 || Math.abs(last[1] - ext[1]) < 1) return null;
  const word = dir > 0 ? "high" : "low";
  const kind = dir > 0 ? "high" : "low";
  const now = `${money(last[1])} (${monthDay(asOf)})`;
  let headline;
  let variants;
  if (D && dayNum(asOf) - dayNum(D[0]) >= 540) {
    headline = `${dir > 0 ? "Highest" : "Lowest"} since ${monthYear(D[0])}: ${who(c)}, ${now} on TCGplayer market. Last time this ${dir > 0 ? "high" : "low"}: ${money(D[1])} on ${dateLabel(D[0], asOf)}.`;
    variants = [`${who(c)} is at ${now}, its ${dir > 0 ? "highest" : "lowest"} TCGplayer market price since ${dateLabel(D[0], asOf)} (${money(D[1])}).`];
  } else if (!D) {
    headline = `${dir > 0 ? "Highest" : "Lowest"} on file, back to ${monthYear(pts[0][0])}: ${who(c)}, ${now} on TCGplayer market.`;
    variants = [`${who(c)} at ${now} is the ${dir > 0 ? "highest" : "lowest"} of ${pts.length} TCGplayer market points on file, back to ${dateLabel(pts[0][0], asOf)}.`];
  } else {
    headline = `52-week ${word}: ${who(c)}, ${now} on TCGplayer market. The ${word} before it in the past year: ${money(ext[1])} on ${dateLabel(ext[0], asOf)}.`;
    variants = [`${who(c)} set a 52-week ${word} at ${now}. Before that, the year's ${word} was ${money(ext[1])} (${dateLabel(ext[0], asOf)}).`];
  }
  if (!ok(headline)) return null;
  return { ...base(c, kind, headline, asOf, { startDate: (D || pts[0])[0], since: D ? { date: D[0], price: D[1] } : null, yearExtreme: { date: ext[0], price: ext[1] }, now: { date: asOf, price: last[1] } }, variants), strength: margin };
}

export function windowRead(c, asOf, { days, slack, minPct, minUsd, maxPct = Infinity, kind }) {
  const last = c.pts[c.pts.length - 1];
  const p = nearestPoint(c.pts.slice(0, -1), addDays(asOf, -days), slack);
  if (!p) return null;
  const ch = pctOf(p[1], last[1]);
  if (Math.abs(ch) < minPct || Math.abs(ch) > maxPct || Math.abs(last[1] - p[1]) < minUsd) return null;
  const up = ch > 0;
  const span = `${money(p[1])} (${dateLabel(p[0], asOf)}) to ${money(last[1])} (${monthDay(asOf)})`;
  const r = Math.round(Math.abs(ch));
  const headline = kind === "year"
    ? `One year on: ${who(c)}, ${span} on TCGplayer market. ${up ? "Up" : "Down"} ${r}%.`
    : `${who(c)}: ${span} on TCGplayer market. ${up ? "Up" : "Down"} ${r}% in ${dayNum(asOf) - dayNum(p[0])} days.`;
  if (!ok(headline)) return null;
  return { ...base(c, kind, headline, asOf, { startDate: p[0], from: p[1], to: last[1], days: dayNum(asOf) - dayNum(p[0]) }, [`${span}: ${who(c)} on TCGplayer market, ${up ? "up" : "down"} ${r}%.`]), changePct: Math.round(ch * 10) / 10, windowDays: dayNum(asOf) - dayNum(p[0]), strength: Math.abs(ch) / 100 };
}

// Back to the price it had on an older date, after a big swing in between.
export function backToRead(c, asOf, { minAge = 180, band = 0.02, swing = 0.4 } = {}) {
  const pts = c.pts;
  const last = pts[pts.length - 1];
  const cut = addDays(asOf, -minAge);
  for (let i = pts.length - 2; i >= 0; i -= 1) {
    const p = pts[i];
    if (p[0] > cut) continue;
    if (Math.abs(p[1] / last[1] - 1) > band) continue;
    const between = pts.slice(i + 1, -1);
    if (!between.length) return null;
    const hi = between.reduce((m, q) => (q[1] > m[1] ? q : m));
    const lo = between.reduce((m, q) => (q[1] < m[1] ? q : m));
    const ext = hi[1] >= last[1] * (1 + swing) ? hi : lo[1] <= last[1] / (1 + swing) ? lo : null;
    if (!ext) continue;
    const went = ext === hi ? "reached" : "fell to";
    const headline = `Back to its ${dateLabel(p[0], asOf)} price: ${who(c)}, ${money(last[1])} (${monthDay(asOf)}) on TCGplayer market, ${money(p[1])} then. In between it ${went} ${money(ext[1])} (${dateLabel(ext[0], asOf)}).`;
    if (!ok(headline)) return null;
    return { ...base(c, "backto", headline, asOf, { startDate: p[0], then: p[1], now: last[1], between: { date: ext[0], price: ext[1] } }, [`${who(c)} is ${money(last[1])} again (${monthDay(asOf)}), the same as on ${dateLabel(p[0], asOf)}. It ${went} ${money(ext[1])} on ${dateLabel(ext[0], asOf)}.`]), strength: Math.abs(ext[1] / last[1] - 1) };
  }
  return null;
}

// One set, about 30 days: how many priced chase cards went up or down 10% and $1.
export function setReads(cards, asOf, { days = 30, slack = 4, minPriced = 10, minMoved = 5 } = {}) {
  const bySet = new Map();
  for (const c of cards) {
    const last = c.pts[c.pts.length - 1];
    const p = nearestPoint(c.pts.slice(0, -1), addDays(asOf, -days), slack);
    if (!p || !c.set) continue;
    if (!bySet.has(c.set)) bySet.set(c.set, []);
    bySet.get(c.set).push({ c, from: p[1], to: last[1], start: p[0] });
  }
  const out = [];
  for (const [set, rows] of bySet) {
    if (rows.length < minPriced) continue;
    const up = rows.filter((r) => r.to - r.from >= 1 && pctOf(r.from, r.to) >= 10);
    const down = rows.filter((r) => r.from - r.to >= 1 && pctOf(r.from, r.to) <= -10);
    if (Math.max(up.length, down.length) < minMoved) continue;
    const starts = rows.map((r) => r.start).sort();
    const a = starts[0], b = starts[starts.length - 1];
    const startText = a === b ? monthDay(a) : `${monthDay(a)} to ${monthDay(b)}`;
    const lead = (up.length >= down.length ? up : down).sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from))[0];
    const headline = `${shortSet(set)}, about 30 days: ${up.length} of ${rows.length} priced cards up 10% or more, ${down.length} down 10% or more. Start prices ${startText}, end ${monthDay(asOf)}, TCGplayer market.`;
    if (!ok(headline)) continue;
    out.push({
      id: `set30-${set}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), sku: lead.c.id, href: `/c/${lead.c.id}`, readKind: "set", kind: "set", board: HIST_TAG, family: "price",
      name: set, set, headline, path: headline, asOf, startDate: a, endDate: asOf,
      source: `TCGplayer market, start points ${a} to ${b}, end ${asOf}`,
      why: "Cards above Uncommon priced $10 or more tonight, matched by product id and printing. Moves need 10% and $1. Each start price is the real point nearest 30 days back, within 4 days.",
      receipt: { set, priced: rows.length, up: up.length, down: down.length, startFirst: a, startLast: b, end: asOf, lead: { id: lead.c.id, from: lead.from, to: lead.to, start: lead.start } },
      variants: [`${up.length} up and ${down.length} down, 10% or more, among ${rows.length} priced cards in ${set} (${startText} to ${monthDay(asOf)}). Biggest: ${cleanName(lead.c.name)}, ${money(lead.from)} to ${money(lead.to)}.`].filter(ok),
      strength: Math.max(up.length, down.length) / rows.length,
    });
  }
  return out.sort((x, y) => y.strength - x.strength);
}

function rotate(rows, day, take, salt) {
  const window = Math.max(12, take * 2);
  let seed = 7;
  for (const ch of `${day}|${salt}`) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pool = rows.slice(0, window);
  for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, take);
}

// All long-history reads for one night. Strongest 12 per kind, rotated by day so
// the board does not repeat. One card is used once.
export function historyReads(cards, asOf, { perKind = 2 } = {}) {
  const want = (k) => (typeof perKind === "number" ? perKind : perKind[k] || 2);
  const live = cards.filter((c) => eligible(c, asOf));
  const kinds = {
    high: live.map((c) => extremeRead(c, asOf, 1)).filter(Boolean),
    low: live.map((c) => extremeRead(c, asOf, -1)).filter(Boolean),
    year: live.map((c) => windowRead(c, asOf, { days: 365, slack: 7, minPct: 25, maxPct: 300, minUsd: 5, kind: "year" })).filter(Boolean),
    plain: live.map((c) => windowRead(c, asOf, { days: 30, slack: 4, minPct: 15, maxPct: 150, minUsd: 2, kind: "plain" })).filter(Boolean),
    backto: live.map((c) => backToRead(c, asOf)).filter(Boolean),
    set: setReads(live, asOf),
  };
  const counts = {};
  const picked = {};
  const used = new Set();
  for (const [k, rows] of Object.entries(kinds)) {
    rows.sort((a, b) => b.strength - a.strength);
    counts[k] = rows.length;
    picked[k] = rotate(rows.filter((r) => k === "set" || !used.has(r.sku)), asOf, want(k), k);
    for (const r of picked[k]) if (k !== "set") used.add(r.sku);
  }
  for (const k of Object.keys(picked)) for (const r of picked[k]) delete r.strength;
  return { counts, picked, cards: live.length };
}
