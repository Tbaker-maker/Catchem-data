// Synthesized reads for one item. The headline, the chips and the lines share
// the lead window. A 7 day line does not sit next to a 30 day line or a year
// line. Supporting sentences come from that same window only.
// The lead sentence is the most notable finding for that item.
// Every number is a real dated point kept in receipt.synth.
// Every limit and weight lives in catchem-data-private (config/read-synthesis.json).
// Without them nothing is rewritten and the step says so.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { banGuard } from "./copy-rules.mjs";
import { money } from "./public-bundle.mjs";
import { cardTitle, tcgAmount } from "./card-face.mjs";
import { monthDay } from "./takes.mjs";
import { dayNum, addDays, dateLabel, nearestPoint, loadHistoryCards, oneNightMove } from "./history-reads.mjs";
import { eraTagOf, priceRange, dayLabel } from "./signal-chips.mjs";
import { sourceNamesDay, speakDates } from "./read-quality.mjs";
import { rotationPhrase } from "./board-mix.mjs";

export const HEADLINE_MAX = 300;

// Keep a headline inside a readable length. A whole sentence stays when it fits.
// A sentence that is itself too long ends on a word, never mid-word.
export function capHeadline(text, max = HEADLINE_MAX) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const parts = s.split(/(?<=[.!?])\s+/);
  let out = "";
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const slice = s.slice(0, max);
  const word = slice.lastIndexOf(" ");
  return (word > 0 ? slice.slice(0, word) : slice).trim();
}
const BANNED = banGuard("read synthesis");
const DASH = /[\u2014\u2013]/;
const SOLD = /\b(?:sold|sales)\b/i;
const CONDITION = /\b(?:NM|Near Mint|LP|Lightly Played|MP|Moderately Played|HP|Heavily Played|DMG|Damaged)\b/;
const WINDOWS = [7, 30, 90, 365];
const NUM_KEYS = ["maxOpeningShare", "minSignals", "ebayMinListings", "listingsMinN", "listingsMinChangePct", "spreadMinPct", "peerMinN", "peerMinGapPts", "nearHighPct", "drawdownMinPct", "streakMinWeeks", "divergenceMinPct", "longMinDays", "minTrendUsd", "peerMinPrice"];
const WEIGHT_KEYS = ["high", "low", "nearHigh", "drawdown", "trend", "divergence", "streak", "peers", "listings", "spread", "kind"];
// Reads that are one product's own price story. Multi card and set wide reads keep their own copy.
const ITEM_KINDS = new Set(["year", "backto", "high", "low", "plain", "year-range", "year-ago", "streak", "single", "sealed", "season", "turned", "deep"]);
const DEEP_ITEM = new Set(["card", "recovery", "slump", "sealedrating", "singlesvssealed"]);

export function validSynth(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const out = { weights: {}, trendMinPct: {}, slackDays: {} };
  for (const k of NUM_KEYS) { const n = Number(cfg[k]); if (cfg[k] == null || !Number.isFinite(n)) return null; out[k] = n; }
  for (const k of WEIGHT_KEYS) { const n = Number(cfg.weights?.[k]); if (!Number.isFinite(n)) return null; out.weights[k] = n; }
  for (const w of WINDOWS) {
    const a = Number(cfg.trendMinPct?.[w]); const b = Number(cfg.slackDays?.[w]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    out.trendMinPct[w] = a; out.slackDays[w] = b;
  }
  for (const k of ["peerInlineMaxPts", "spikeRatio", "baselineSpikeRatio", "neighborBand", "launchSkipDays"]) { const n = Number(cfg[k]); if (cfg[k] != null && Number.isFinite(n)) out[k] = n; }
  return out;
}

export async function loadSynth(root) {
  const paths = [process.env.READ_SYNTH_FILE, join(root, "..", "catchem-data-private", "config", "read-synthesis.json")].filter(Boolean);
  for (const p of paths) { try { const got = validSynth(JSON.parse(await readFile(p, "utf8"))); if (got) return got; } catch { /* next */ } }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/read-synthesis.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-read-synthesis" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? validSynth(await res.json()) : null;
  } catch { return null; }
}

// The full receipt for each rewritten read (every fact and its numbers) goes to a
// side file, feed/read-synth.json, so reads.json stays small. reads.json keeps the
// lead, title, signals and the closing point, and names the side file.
export const SYNTH_FILE = "feed/read-synth.json";
export function splitReceipts(reads, asOf) {
  const receipts = {};
  const out = reads.map((r) => {
    const full = r?.receipt?.synth;
    if (!full || typeof full !== "object" || !r.id) return r;
    receipts[r.id] = full;
    const { lead, title, signals, now } = full;
    return { ...r, receipt: { ...r.receipt, synth: { lead, title, signals, now, facts: SYNTH_FILE } } };
  });
  return { reads: out, side: { asOf, note: "Every fact and number behind each synthesized read in reads.json, by read id.", receipts } };
}

export function isItemRead(r) {
  if (!r || !/^tcgcsv-\d+$/.test(String(r.sku || ""))) return false;
  const kind = String(r.readKind || r.kind || "");
  if (!ITEM_KINDS.has(kind)) return false;
  if (kind === "deep" && !DEEP_ITEM.has(String(r.deep || ""))) return false;
  if ((r.receipt?.cards || []).length > 1 || (r.receipt?.up || []).length > 1) return false;
  return true;
}

// The opening of a read with names, numbers and dates masked. Used to measure variety.
export function openingKey(text, names = []) {
  let s = String(text || "").split(/(?<=[.!?])\s/)[0];
  for (const n of names.filter(Boolean).sort((a, b) => b.length - a.length)) s = s.split(n).join("<item>");
  s = s.replace(/\$[\d,]+(?:\.\d+)?/g, "#").replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(?:, \d{4})?/g, "<d>").replace(/\d+(?:\.\d+)?%?/g, "#");
  return s.split(/\s+/).slice(0, 4).join(" ");
}

const usd = (n) => tcgAmount(n, money);
const pct = (a, b) => ((b - a) / a) * 100;
const r0 = (x) => Math.round(Math.abs(x));
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
const at = (p, asOf) => `${usd(p[1])} on ${dateLabel(p[0], asOf)}`;

const closeBand = (a, b, band) => Math.abs(a - b) / Math.max(a, b) <= band;

// A one-day (or short-run) spike is not a window baseline. Neighbours that agree
// within the band, with the mid point sticking out by baselineSpikeRatio (or
// spikeRatio), are replaced by the earlier neighbour.
function isBaselineSpike(pts, idx, cfg, last) {
  if (idx <= 0 || idx >= pts.length) return false;
  const left = pts[idx - 1]?.[1];
  const right = (pts[idx + 1]?.[1] ?? last?.[1]);
  if (!(left > 0) || !(right > 0)) return false;
  const band = Number(cfg.neighborBand);
  const ratioMin = Number(cfg.baselineSpikeRatio) > 1
    ? Number(cfg.baselineSpikeRatio)
    : (Number(cfg.spikeRatio) > 1 ? Number(cfg.spikeRatio) : 0);
  if (!(ratioMin > 1)) return false;
  const mid = pts[idx][1];
  if (!(mid > 0)) return false;
  if (Number.isFinite(band) && band > 0 && !closeBand(left, right, band)) return false;
  return mid / Math.max(left, right) >= ratioMin;
}

function changeAt(pts, asOf, days, cfg) {
  const last = pts[pts.length - 1];
  if (!last || last[0] !== asOf) return null;
  const prior = pts.slice(0, -1);
  const target = addDays(asOf, -days);
  let p = prior.find((row) => row[0] === target);
  if (!p) p = nearestPoint(prior, target, cfg.slackDays[days]);
  if (!p) return null;
  let idx = prior.findIndex((row) => row[0] === p[0]);
  while (idx > 0 && isBaselineSpike(prior, idx, cfg, last)) {
    p = prior[idx - 1];
    idx -= 1;
  }
  const span = dayNum(last[0]) - dayNum(p[0]);
  if (!(span > 0)) return null;
  // A week is 7 days. A point one day off is a different window, not a week.
  if (span === 7 && oneNightMove(pts, p[0], last[0])) return null;
  return { days: span, asked: days, from: p, to: last, pct: pct(p[1], last[1]) };
}

function weeklyStreak(pts, asOf) {
  const weeks = [];
  for (let k = 0; k <= 12; k += 1) { const p = nearestPoint(pts, addDays(asOf, -7 * k), 3); if (!p) break; weeks.push(p); }
  let n = 0; let dir = 0;
  for (let i = 0; i + 1 < weeks.length; i += 1) {
    const d = Math.sign(weeks[i][1] - weeks[i + 1][1]);
    if (!d || (dir && d !== dir)) break;
    dir = d; n += 1;
  }
  return n ? { n, dir, from: weeks[n], to: weeks[0] } : null;
}

function movedDays(pts, asOf) {
  const cut = addDays(asOf, -30);
  const recent = pts.filter((p) => p[0] >= cut);
  let moved = 0;
  for (let i = 1; i < recent.length; i += 1) if (Math.round(recent[i][1] * 100) !== Math.round(recent[i - 1][1] * 100)) moved += 1;
  return recent.length > 2 ? { moved, of: recent.length - 1 } : null;
}

// Every finding for one item. Each has a weight score, a signal tag, a sentence and the numbers behind it.
export function findings(item, ctx, cfg) {
  const { pts, title, asOf } = item;
  const out = [];
  const last = pts[pts.length - 1];
  if (!last || last[0] !== asOf) return out;
  const span = dayNum(asOf) - dayNum(pts[0][0]);
  const ch = {};
  for (const w of WINDOWS) ch[w] = changeAt(pts, asOf, w, cfg);
  const prior = pts.slice(0, -1);
  // Range
  if (prior.length && span >= cfg.longMinDays) {
    // A one day spike (a single point far above both neighbours) is not a real peak.
    const spikeRatio = Number(cfg.spikeRatio) > 1 ? Number(cfg.spikeRatio) : Infinity;
    const peakable = prior.filter((p, i) => {
      const a = prior[i - 1]?.[1]; const b = prior[i + 1]?.[1] ?? last[1];
      // The first point on file has one neighbour, so it is judged against that one.
      const near = [a, b].filter((x) => x != null);
      return !(near.length && p[1] > spikeRatio * Math.max(...near));
    });
    // Launch week prices are not a peak either: points before release plus launchSkipDays are left out.
    // With no release date or no limit on file nothing changes. If every earlier point is in that window, no peak is claimed.
    const skip = Number(cfg.launchSkipDays);
    const rel = /^\d{4}-\d{2}-\d{2}$/.test(String(item.release || "")) ? item.release : "";
    const settled = rel && skip > 0 ? addDays(rel, skip) : "";
    const pool = (peakable.length ? peakable : prior).filter((p) => !settled || p[0] >= settled);
    const hi = pool.length ? pool.reduce((m, p) => (p[1] > m[1] ? p : m)) : null;
    const lo = prior.reduce((m, p) => (p[1] < m[1] ? p : m));
    // The high sentence and the range chip share one window on these same points.
    // A "highest" or "level" line is not used when today is not the high of that window.
    const shared = priceRange(pts, asOf, { minDays: 1, slackDays: 0 });
    const atSharedHigh = !!(shared && shared.place === "upper part" && Math.round(shared.high * 100) === Math.round(last[1] * 100));
    if (!hi) { if (last[1] < lo[1]) out.push({ tag: "range", type: "low", score: cfg.weights.low, nums: { lo, now: last }, text: `Lowest price on file for ${title}: ${usd(last[1])} on ${monthDay(asOf)}, under the earlier low of ${at(lo, asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.`, short: `That is its lowest price on file, back to ${dateLabel(pts[0][0], asOf)}, under the earlier low of ${at(lo, asOf)}.` }); }
    else if (last[1] > hi[1] && atSharedHigh) out.push({ tag: "range", type: "high", window: shared.days, score: cfg.weights.high, nums: { hi, now: last, window: shared }, text: `Highest price in the ${shared.days} day range for ${title}: ${usd(last[1])} on ${monthDay(asOf)}, above the earlier peak of ${at(hi, asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.`, short: `That is its highest price in the ${shared.days} day range, back to ${dateLabel(pts[0][0], asOf)}, above the earlier peak of ${at(hi, asOf)}.` });
    else if (last[1] < lo[1]) out.push({ tag: "range", type: "low", score: cfg.weights.low, nums: { lo, now: last }, text: `Lowest price on file for ${title}: ${usd(last[1])} on ${monthDay(asOf)}, under the earlier low of ${at(lo, asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.`, short: `That is its lowest price on file, back to ${dateLabel(pts[0][0], asOf)}, under the earlier low of ${at(lo, asOf)}.` });
    else if (hi) {
      const off = (1 - last[1] / hi[1]) * 100;
      const level = Math.round(hi[1] * 100) === Math.round(last[1] * 100);
      if (level && !atSharedHigh) { /* the chip window does not call this a high, so the headline does not either */ }
      else if (off <= cfg.nearHighPct) out.push({ tag: "range", type: "nearHigh", window: level ? shared.days : undefined, score: cfg.weights.nearHigh, nums: { hi, now: last, window: shared },
        text: level ? `Level with its highest price in the ${shared.days} day range: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}, the same as on ${dateLabel(hi[0], asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.` : `About ${Math.max(1, r0(off))}% under its highest price on file: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}, against a peak of ${at(hi, asOf)}.`,
        short: level ? `It is level with its highest price in the ${shared.days} day range, first reached on ${dateLabel(hi[0], asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.` : `It sits about ${Math.max(1, r0(off))}% under its highest price on file, ${at(hi, asOf)}.` });
      else if (off >= cfg.drawdownMinPct) out.push({ tag: "range", type: "drawdown", score: cfg.weights.drawdown * (off / 100), nums: { hi, now: last }, text: `Still ${r0(off)}% under its peak of ${at(hi, asOf)}: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}.`, short: `It is still ${r0(off)}% under its peak of ${at(hi, asOf)}.` });
    }
  }
  // One finding per window. A read leads with one of them, never several at once.
  const moves = WINDOWS.map((w) => ch[w]).filter((c) => c && Math.abs(c.pct) >= cfg.trendMinPct[c.asked] && Math.abs(c.to[1] - c.from[1]) >= cfg.minTrendUsd);
  for (const move of moves) {
    const when = move.days === 7 ? "in a week" : move.days === 30 ? "over 30 days" : move.days === 90 ? "in the last 90 days" : move.days === 365 ? "on the year" : `in ${move.days} days`;
    const over = move.days === 365 ? "a year" : move.days === 7 ? "a week" : `${move.days} days`;
    out.push({ tag: "trend", type: `trend${move.asked}${move.pct >= 0 ? "up" : "down"}`, window: move.days, score: cfg.weights.trend * (Math.abs(move.pct) / cfg.trendMinPct[move.asked]), nums: { lead: move },
      text: `${move.pct >= 0 ? "Up" : "Down"} ${r0(move.pct)}% ${when}: ${title} went from ${at(move.from, asOf)} to ${usd(move.to[1])} on ${monthDay(asOf)}.`,
      short: `${move.pct >= 0 ? "Up" : "Down"} ${r0(move.pct)}% over ${over}, to ${usd(last[1])} on ${monthDay(asOf)}.` });
  }
  // Weekly streak and how often it moved
  const st = weeklyStreak(pts, asOf);
  if (st && st.n >= cfg.streakMinWeeks && Math.abs(st.to[1] - st.from[1]) >= cfg.minTrendUsd) {
    const spanDays = dayNum(st.to[0]) - dayNum(st.from[0]);
    out.push({ tag: "streak", type: `streak${st.dir > 0 ? "up" : "down"}`, window: spanDays > 0 ? spanDays : undefined, score: cfg.weights.streak * st.n, nums: { st },
      text: `${st.dir > 0 ? "Higher" : "Lower"} for ${st.n} weeks running: ${title} moved from ${at(st.from, asOf)} to ${usd(st.to[1])} on ${monthDay(asOf)}.`, short: `It has closed ${st.dir > 0 ? "higher" : "lower"} ${st.n} weeks running, from ${at(st.from, asOf)}.` });
  }
  const mv = movedDays(pts, asOf);
  if (mv) out.push({ tag: "activity", type: "activity", window: 30, score: 0, nums: { mv }, text: `The price changed on ${mv.moved} of the last ${mv.of} days on file.`, short: `The price changed on ${mv.moved} of the last ${mv.of} days on file.` });
  // Against its set and the market
  const peer = ctx.peers?.get(item.setSlug);
  const sg = (x) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(1)}%`;
  if (ch[30] && peer && peer.n >= cfg.peerMinN) {
    const gap = ch[30].pct - peer.median;
    const own = r0(ch[30].pct) < 1 ? "flat" : `${ch[30].pct >= 0 ? "up" : "down"} ${r0(ch[30].pct)}%`;
    const mkt = ctx.market && ctx.market.n >= cfg.peerMinN ? `, and ${sg(ctx.market.median)} for ${ctx.market.n} priced items across the market` : "";
    const base = `${sg(peer.median)} median for ${peer.n} ${item.set} items priced ${usd(cfg.peerMinPrice)} or more${mkt}`;
    if (Math.abs(gap) >= cfg.peerMinGapPts) out.push({ tag: "peers", type: gap > 0 ? "peersAhead" : "peersBehind", window: 30, score: cfg.weights.peers * (Math.abs(gap) / cfg.peerMinGapPts), nums: { peer, market: ctx.market, own: ch[30] },
      text: `${gap > 0 ? "Ahead of" : "Behind"} its set: ${title} is ${own} over 30 days against a ${base}.`,
      short: `That ${gap > 0 ? "beats" : "trails"} its set over 30 days: ${own} against a ${base}.` });
    else {
      // "In line" only for a small gap. A wider one says which side it is on, without leading the read.
      const inlineMax = Number.isFinite(Number(cfg.peerInlineMaxPts)) ? Number(cfg.peerInlineMaxPts) : cfg.peerMinGapPts;
      const short = Math.abs(gap) <= inlineMax ? `Over 30 days it is ${own}, in line with a ${base}.` : `Over 30 days it is ${own}, ${gap > 0 ? "ahead of" : "trailing"} a ${base}.`;
      out.push({ tag: "peers", type: "peersInline", window: 30, score: 0, nums: { peer, market: ctx.market, own: ch[30] }, short });
    }
  }
  // Supply and eBay asks (sealed)
  const lc = ctx.listings?.get(item.id);
  if (lc && lc.n >= cfg.listingsMinN && lc.prev && lc.prev.n > 0) {
    const c = pct(lc.prev.n, lc.n);
    const span = `from ${lc.prev.n} on ${dateLabel(lc.prev.date, asOf)} to ${lc.n} on ${dateLabel(lc.date, asOf)}`;
    if (Math.abs(c) >= cfg.listingsMinChangePct) out.push({ tag: "listings", type: c > 0 ? "listingsUp" : "listingsDown", score: cfg.weights.listings * (Math.abs(c) / cfg.listingsMinChangePct), nums: { lc },
      text: `${c > 0 ? "More" : "Fewer"} listings counted for ${title}: ${span}, with the price at ${usd(last[1])}.`,
      short: `Listings counted went ${span}.` });
    else out.push({ tag: "listings", type: "listingsInline", score: 0, nums: { lc }, short: `Listings counted held steady, ${span}.` });
  }
  const ask = ctx.asks?.get(item.id);
  if (ask && ask.count >= cfg.ebayMinListings && ask.date === asOf) {
    const g = pct(last[1], ask.median);
    const body = `a median ask of ${usd(ask.median)} against ${usd(last[1])} on TCGplayer market on ${monthDay(asOf)}`;
    if (Math.abs(g) >= cfg.spreadMinPct) out.push({ tag: "ask", type: g > 0 ? "askAbove" : "askBelow", score: cfg.weights.spread * (Math.abs(g) / cfg.spreadMinPct), nums: { ask, now: last },
      text: `eBay asks for ${title} sit ${r0(g)}% ${g > 0 ? "above" : "under"} TCGplayer market: ${body}.`,
      short: `eBay asks sit ${r0(g)}% ${g > 0 ? "above" : "under"} that, ${body}.` });
    else out.push({ tag: "ask", type: "askInline", score: 0, nums: { ask, now: last }, short: `eBay asks are close to it, ${body}.` });
  }
  // Set context, always supporting
  const bits = [];
  const era = eraTagOf(item.release);
  if (item.set && item.release) bits.push(`${item.set} came out ${dateLabel(item.release, asOf)}`);
  if (era) bits.push(`${era} era`);
  const rot = ctx.rotation?.get(item.setSlug);
  if (rot?.status) bits.push(rotationPhrase(rot.status));
  const sv = ctx.setValue?.get(item.setSlug);
  if (sv?.total > 0 && sv.priced > 1) bits.push(`its ${sv.priced} priced cards add up to ${usd(sv.total)}`);
  if (bits.length) out.push({ tag: "set", type: "set", score: 0, nums: { era, rot, sv, release: item.release }, short: `${bits[0]}${bits.length > 1 ? `, ${bits.slice(1).join(", ")}` : ""}.` });
  const clean = (t) => !t || (!BANNED.test(t) && !DASH.test(t) && !SOLD.test(t));
  return out.filter((f) => (f.text || f.short) && clean(f.text) && clean(f.short));
}

// Lead with the strongest finding whose opening is not over the share cap, then add
// up to two supporting sentences from other signals, scored ones first.
function saidMove(text, dir, pct, days) {
  const t = String(text || "");
  const n = String(days);
  const window = n === "365" ? "a year" : `${n} days`;
  if (new RegExp(`\\b${dir} ${pct}% over ${window}\\b`, "i").test(t)) return true;
  if (new RegExp(`\\bover ${window} it is ${dir} ${pct}%\\b`, "i").test(t)) return true;
  return false;
}

// A supporting sentence that repeats a move the lead already stated keeps the comparison only.
function unrepeated(have, short) {
  const s = String(short || "");
  const over = s.match(/^Over (\d+) days it is (up|down) (\d+)%(?:, (.*))?$/i);
  if (over) {
    if (!saidMove(have, over[2], over[3], over[1])) return s;
    const rest = over[4] || "";
    if (!rest) return "";
    const body = rest.replace(/\.$/, "");
    return body.charAt(0).toUpperCase() + body.slice(1) + ".";
  }
  // "Down 27% over 30 days, to $537.33 on Nov 11." after a lead that already said down 27% over 30 days.
  const trend = s.match(/^(Up|Down) (\d+)% over (\d+) days, to /);
  if (trend && saidMove(have, trend[1].toLowerCase(), trend[2], trend[3])) return "";
  const that = s.match(/^That (trails|beats) its set over (\d+) days: (up|down) (\d+)% against (.*)$/i);
  if (that && saidMove(have, that[3], that[4], that[2])) {
    const verb = that[1].toLowerCase() === "beats" ? "Ahead of" : "Trailing";
    return `${verb} ${that[5].replace(/\.$/, "")}.`;
  }
  return s;
}

// +1 for a finding that says the price went up, -1 for down, 0 for neither.
export function findingDir(f) {
  const type = String(f?.type || "");
  if (f?.tag === "trend" || f?.tag === "streak") return /up$/.test(type) ? 1 : /down$/.test(type) ? -1 : 0;
  if (type === "high" || type === "nearHigh") return 1;
  if (type === "low" || type === "drawdown") return -1;
  return 0;
}

// The direction a lead must not contradict. A slump read is about a fall and a
// recovery read about a rise. Otherwise the shortest qualifying trend (7 or 30
// days) is the most recent fact, so a longer window cannot lead against it.
export function leadDirection(item, fs) {
  if (item?.kind === "deep:slump") return -1;
  if (item?.kind === "deep:recovery") return 1;
  const recent = (fs || []).filter((f) => f.tag === "trend" && f.score > 0 && Number(f.window) > 0 && Number(f.window) <= 30)
    .sort((a, b) => Number(a.window) - Number(b.window))[0];
  return recent ? findingDir(recent) : 0;
}

function pairEnds(pair) {
  if (Array.isArray(pair?.from) && Array.isArray(pair?.to) && pair.from[0] && pair.to[0]) return { from: String(pair.from[0]), to: String(pair.to[0]) };
  return null;
}

function moveEnds(f) {
  return pairEnds(f?.nums?.step) || pairEnds(f?.nums?.st) || pairEnds(f?.nums?.lead);
}

// A one-week drop is a 7 day window. It cannot sit under a multi-week streak
// by leaving window unset. #548's drop finding carries nums.step.
export function ensureDropWindow(f) {
  if (!f) return f;
  if (f.tag === "drop" || f.nums?.step) f.window = 7;
  return f;
}

export function compose(item, fs, cfg, used) {
  for (const f of fs || []) ensureDropWindow(f);
  const ranked = fs.filter((f) => f.score > 0 && f.text).sort((a, b) => b.score - a.score);
  const kindF = item.kindLine ? { tag: "kind", type: `kind:${item.kind}`, score: cfg.weights.kind, text: item.kindLine } : null;
  if (kindF) { ranked.push(kindF); ranked.sort((a, b) => b.score - a.score); }
  if (!ranked.length) return null;
  const cap = used ? Math.max(1, Math.floor(cfg.maxOpeningShare * used.total)) : Infinity;
  const key = (f) => openingKey(f.text, [item.title]);
  const count = (f) => (used ? used.byType.get(key(f)) || 0 : 0);
  // A lead cannot argue against the read's own story: a slump read does not
  // open on a gain, and a year gain does not lead over a fresh fall.
  const want = leadDirection(item, fs);
  const strict = item?.kind === "deep:slump" || item?.kind === "deep:recovery";
  const against = (f) => findingDir(f) === -want && (strict || f.tag === "trend" || f.tag === "streak");
  const agree = want ? ranked.filter((f) => !against(f)) : ranked;
  const leadPool = agree.length ? agree : ranked;
  const lead = leadPool.find((f) => count(f) < cap) || leadPool.slice().sort((a, b) => count(a) - count(b))[0];
  const leadWindow = Number.isFinite(Number(lead.window)) ? Number(lead.window) : null;
  const leadEnds = moveEnds(lead);
  const sameWindow = (f) => {
    const ends = moveEnds(f);
    // A second price move has to use the lead's own dates. A 90 day line
    // under a 12 week streak is a different window, so that line drops.
    if (leadEnds && ends && (leadEnds.from !== ends.from || leadEnds.to !== ends.to)) return false;
    if (!leadWindow || !Number.isFinite(Number(f.window))) return true;
    return Number(f.window) === leadWindow;
  };
  const tags = new Set([lead.tag]);
  const pick = [lead];
  const ORDER = ["trend", "range", "listings", "ask", "peers", "streak", "activity", "set"];
  const pool = ranked.filter((f) => f !== lead && f.short && sameWindow(f)).concat(fs.filter((f) => !(f.score > 0) && f.short && sameWindow(f)).sort((a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag)));
  for (const f of pool) {
    if (pick.length >= 3) break;
    if (tags.has(f.tag)) continue;
    tags.add(f.tag); pick.push(f);
  }
  const avail = new Set(fs.map((f) => f.tag).concat(kindF ? ["kind"] : [])).size;
  if (tags.size < Math.min(cfg.minSignals, avail)) return null;
  const parts = [];
  for (let i = 0; i < pick.length; i += 1) {
    const raw = i ? pick[i].short : pick[i].text;
    const piece = i ? unrepeated(parts.join(" "), raw) : raw;
    if (!piece) continue;
    parts.push(piece);
  }
  const text = capHeadline(parts.join(" "));
  if (BANNED.test(text) || DASH.test(text) || SOLD.test(text)) return null;
  if (item.sealed && CONDITION.test(text)) return null;
  if (used) used.byType.set(key(lead), (used.byType.get(key(lead)) || 0) + 1);
  return { text, lead, pick };
}

// Context built once per night from the public files.
export async function loadContext(root, asOf, cfg) {
  const pub = join(root, "research/assets/public");
  const J = (p, fb) => readFile(join(root, p), "utf8").then(JSON.parse).catch(() => fb);
  const series = new Map();
  const rows = new Map();
  const { cards } = await loadHistoryCards(root);
  for (const c of cards) series.set(c.id, c.pts);
  const { readdir } = await import("node:fs/promises");
  let files = [];
  try { files = (await readdir(join(pub, "buckets"))).filter((f) => /^\d\d\.json$/.test(f)); } catch { /* none */ }
  for (const f of files) {
    const b = await J(`research/assets/public/buckets/${f}`, []);
    for (const r of b) {
      if (!r?.id) continue;
      rows.set(r.id, r);
      if (!series.has(r.id)) {
        const pts = (r.hist || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number(p[1]) > 0).map((p) => [p[0], Number(p[1])]);
        if (pts.length) series.set(r.id, pts);
      }
    }
  }
  const sets = await J("research/assets/public/sets.json", { sets: [] });
  const setRel = new Map((sets.sets || []).map((s) => [s.slug, s.release || ""]));
  // 30 day change for every priced item, by set and across the market
  const bySet = new Map(); const all = [];
  for (const [id, pts] of series) {
    const last = pts[pts.length - 1];
    if (!last || last[0] !== asOf || !(last[1] >= cfg.peerMinPrice)) continue;
    const p = nearestPoint(pts.slice(0, -1), addDays(asOf, -30), cfg.slackDays[30]);
    if (!p) continue;
    const c = pct(p[1], last[1]);
    all.push(c);
    const slug = rows.get(id)?.setSlug;
    if (slug) { if (!bySet.has(slug)) bySet.set(slug, []); bySet.get(slug).push(c); }
  }
  const peers = new Map([...bySet].map(([k, v]) => [k, { median: median(v), n: v.length }]));
  const market = all.length ? { median: median(all), n: all.length } : null;
  const sealed = await J("data/sealed-prices.json", { products: [] });
  const lcDoc = await J("research/assets/public/listings-counted.json", { products: [] });
  const lcById = new Map((lcDoc.products || []).map((p) => [p.id, p.listingsCounted]));
  const listings = new Map(); const asks = new Map();
  const sealedDay = String(sealed.updatedAt || "").slice(0, 10);
  for (const p of sealed.products || []) {
    if (!/^\d+$/.test(String(p.tcgPlayerId || ""))) continue;
    const id = `tcgcsv-${p.tcgPlayerId}`;
    const lc = lcById.get(p.id);
    if (lc?.n > 0) listings.set(id, lc);
    if (Number(p.ebayMedianAsk) > 0) asks.set(id, { median: Number(p.ebayMedianAsk), count: Number(p.ebayMedianCount) || 0, date: sealedDay, source: "data/sealed-prices.json" });
  }
  const rot = await J("research/assets/public/rotation-status.json", { sets: [] });
  const rotation = new Map((rot.sets || []).filter((s) => s.status).map((s) => [s.slug, s]));
  const setValue = new Map();
  for (const s of sets.sets || []) {
    const v = await J(`research/assets/public/set-value/${s.slug}.json`, null);
    if (v?.master) setValue.set(s.slug, { total: Number(v.master.total) || 0, priced: Number(v.master.priced) || 0 });
  }
  return { series, rows, setRel, peers, market, listings, asks, rotation, setValue };
}

function firstSentence(s) { return String(s || "").split(/(?<=[.!?])\s/)[0]; }
const HIST_KINDS = new Set(["year", "backto", "high", "low", "plain", "year-range", "year-ago", "streak", "single", "sealed"]);

export function itemOf(read, ctx) {
  const pts = ctx.series.get(read.sku);
  const row = ctx.rows.get(read.sku) || {};
  if (!pts || pts.length < 2) return null;
  const sealed = row.kind === "sealed" || read.readKind === "sealed";
  const title = sealed ? String(row.name || read.name || "") : cardTitle({ name: row.name || read.name, set: row.set || read.set, number: row.num || read.number });
  if (!title) return null;
  const kind = String(read.readKind || read.kind || "");
  const own = HIST_KINDS.has(kind) ? "" : firstSentence(read.headline);
  return { id: read.sku, pts, title, asOf: read.asOf, set: row.set || read.set || "", setSlug: row.setSlug || "", release: String(row.release || ctx.setRel.get(row.setSlug) || "").slice(0, 10), sealed, kind: kind === "deep" ? `deep:${read.deep}` : kind, kindLine: own && !CONDITION.test(own) ? own : "" };
}


// Dollars named in why/whyItMatters must match the lead window, not an older
// board proof. Synthesis rewrites the headline from findings; keep why in step.
function leadPricePair(lead) {
  const n = lead?.nums;
  if (!n || typeof n !== "object") return null;
  if (n.st?.from && n.st?.to) return [n.st.from[1], n.st.to[1]];
  if (n.lead?.from && n.lead?.to) return [n.lead.from[1], n.lead.to[1]];
  if (n.own?.from && n.own?.to) return [n.own.from[1], n.own.to[1]];
  if (n.hi && n.now) return [n.hi[1], n.now[1]];
  if (n.lo && n.now) return [n.lo[1], n.now[1]];
  return null;
}

function whyFromLead(lead) {
  const pair = leadPricePair(lead);
  if (!pair) return null;
  const from = Number(pair[0]);
  const to = Number(pair[1]);
  if (!(from > 0) || !(to > 0)) return null;
  const delta = to - from;
  const dir = delta >= 0 ? "Up" : "Down";
  return `${dir} ${money(Math.abs(delta))} on those two dates.`;
}

function namedWindows(text) {
  const s = String(text || "");
  const hit = new Set();
  if (/\b7\s*[- ]?days?\b|\b7D\b|\bin a week\b/i.test(s)) hit.add(7);
  if (/\b30\s*[- ]?days?\b|\b30D\b/i.test(s)) hit.add(30);
  if (/\b90\s*[- ]?days?\b|\b90D\b/i.test(s)) hit.add(90);
  if (/\b365\s*[- ]?days?\b|\bon the year\b|\bin a year\b|\bover the year\b|\bover a year\b/i.test(s)) hit.add(365);
  // Any other count of days, written out ("21 days", "29 day range") or as a chip ("21D").
  for (const m of s.matchAll(/\b(\d+)\s*[- ]?days?\b/gi)) hit.add(Number(m[1]));
  for (const m of s.matchAll(/\b(\d+)D\b/g)) hit.add(Number(m[1]));
  return hit;
}

function chipDays(chip) {
  const named = namedWindows(`${chip?.text || ""} ${chip?.label || ""}`);
  if (named.size > 1) return -1;
  if (named.size === 1) return [...named][0];
  const n = Number(chip?.days);
  return n > 0 ? n : null;
}

// Drop chips, tiles and lines that name a different window than the lead.
// The move chip for a trend lead, built from the lead's own two points so the
// chip and the headline share one window and one percent.
export function leadMoveChip(lead, days, dropped = null) {
  const c = lead?.tag === "trend" ? lead?.nums?.lead : lead?.tag === "peers" ? lead?.nums?.own : null;
  if (!c || !Array.isArray(c.from) || !Array.isArray(c.to) || Number(c.days) !== Number(days)) return null;
  const a = Number(c.from[1]); const b = Number(c.to[1]);
  if (!(a > 0) || !(b > 0)) return null;
  const p = ((b - a) / a) * 100;
  const shown = r0(p);
  if (!shown) return null;
  const dir = p > 0 ? "up" : "down";
  const strength = dropped && dropped.dir === dir && Number(dropped.strength) > 0 ? Number(dropped.strength) : 1;
  return { kind: "move", dir, text: `${shown}% ${days}D`, label: `Price ${dir} ${shown} percent over ${days} days`, strength };
}

export function alignToWindow(read, days, lead = null) {
  const n = Number(days);
  if (!(n > 0) || !read) return read;
  const next = { ...read, windowDays: n };
  if (Array.isArray(read.signals)) {
    let dropped = null;
    next.signals = read.signals.filter((chip) => {
      const w = chipDays(chip);
      const ok = w == null || w === n;
      if (!ok && chip?.kind === "move" && !dropped) dropped = chip;
      return ok;
    });
    const own = next.signals.some((chip) => chip?.kind === "move") ? null : leadMoveChip(lead, n, dropped);
    if (own) next.signals = [own, ...next.signals];
  }
  if (typeof read.blurb === "string" && read.blurb) {
    const hit = namedWindows(read.blurb);
    if (hit.size && !(hit.size === 1 && hit.has(n))) {
      const move = (next.signals || []).find((chip) => chip?.kind === "move" && chipDays(chip) === n);
      const when = dayLabel(read.asOf);
      const pctText = move ? String(move.text || "").split(" ")[0] : "";
      next.blurb = move && pctText ? `TCGplayer market is ${move.dir} ${pctText} over ${n} days${when ? `, as of ${when}` : ""}.` : "";
    }
  }
  const tile = read.tiles?.price;
  if (tile && !tile.dash && Number(tile.days) > 0 && Number(tile.days) !== n) {
    const tiles = { ...read.tiles };
    delete tiles.price;
    next.tiles = tiles;
  }
  const keep = (line) => {
    if (typeof line !== "string") return true;
    const hit = namedWindows(line);
    return hit.size === 0 || (hit.size === 1 && hit.has(n));
  };
  if (Array.isArray(read.lines)) next.lines = read.lines.filter(keep);
  return next;
}

function leadEnds(lead) {
  const n = lead?.nums || {};
  const c = n.lead || n.own || n.s;
  if (Array.isArray(c?.from) && Array.isArray(c?.to) && /^\d{4}-\d{2}-\d{2}$/.test(String(c.from[0])) && /^\d{4}-\d{2}-\d{2}$/.test(String(c.to[0]))) {
    return { startDate: String(c.from[0]), endDate: String(c.to[0]) };
  }
  return null;
}

function speakRead(read) {
  const asOf = read?.asOf;
  const next = { ...read };
  if (next.headline) next.headline = speakDates(next.headline, asOf);
  if (next.path) next.path = speakDates(next.path, asOf);
  if (next.source) next.source = speakDates(next.source, asOf);
  if (next.why) next.why = speakDates(next.why, asOf);
  if (next.whyItMatters) next.whyItMatters = speakDates(next.whyItMatters, asOf);
  if (Array.isArray(next.lines)) next.lines = next.lines.map((line) => typeof line === "string" ? speakDates(line, asOf) : line);
  if (Array.isArray(next.variants)) next.variants = next.variants.map((line) => typeof line === "string" ? speakDates(line, asOf) : line);
  if (Array.isArray(next.signals)) {
    next.signals = next.signals.map((chip) => {
      if (!chip || typeof chip !== "object") return chip;
      const out = { ...chip };
      if (typeof out.label === "string") out.label = speakDates(out.label, asOf);
      if (typeof out.text === "string") out.text = speakDates(out.text, asOf);
      return out;
    });
  }
  return next;
}

// The shape the test gate checks on reads.json (scripts/tests/deep-reads.suite.mjs,
// scripts/tests/public-bundle.suite.mjs). Synthesis runs after that gate, so a
// rewrite that breaks the shape was published unchecked: on Nov 11, 18 deep
// reads went out with 1 or 2 lines, and 22 of 51 history reads named dates in
// their source that did not match their start date (14 more only spoke the date).
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const GATE_HIST_KINDS = new Set(["high", "low", "year", "plain", "backto", "set"]);
export function readContractOk(read) {
  if (!read || typeof read !== "object") return false;
  if (read.readKind === "deep") {
    if (!(Array.isArray(read.lines) && read.lines.length >= 3 && read.lines.length <= 6 && read.source && ISO_DAY.test(String(read.asOf || "")))) return false;
  }
  if (read.board === "hist") {
    if (!(GATE_HIST_KINDS.has(read.readKind) && read.kind === read.readKind && ISO_DAY.test(String(read.startDate || "")) && read.endDate === read.asOf && sourceNamesDay(read.source, read.startDate, read.asOf))) return false;
  }
  return true;
}

// Keep the rewrite only when it keeps the shape the original already had.
// Otherwise the original read, which is what the gate passed, goes out.
export function keepContract(next, original) {
  return readContractOk(next) || !readContractOk(original) ? next : original;
}

// Rewrite the item reads. Returns the new list and a report.
export function synthesizeReads(reads, ctx, cfg) {
  const items = reads.filter(isItemRead);
  const used = { total: items.length, byType: new Map() };
  const report = { item: items.length, rewritten: 0, kept: 0, keptForShape: 0 };
  const out = reads.map((r) => {
    if (!isItemRead(r)) return r;
    const item = itemOf(r, ctx);
    if (!item) { report.kept += 1; return r; }
    const fs = findings(item, ctx, cfg);
    const got = compose(item, fs, cfg, used);
    if (!got) { report.kept += 1; return r; }
    report.rewritten += 1;
    const lead = got.lead;
    // A lead price read keeps its TCGplayer market headline; the summary is its lead line.
    const leadPrice = ((r.board !== "v3" && r.readKind === "price") || r.kind === "single" || r.kind === "sealed") && /\bon TCGplayer market\b/.test(String(r.headline || ""));
    const useSynth = !(leadPrice && r.headline);
    const text = capHeadline(useSynth ? got.text : r.headline);
    let next = { ...r, headline: text, path: text, variants: [text], synth: true,
      receipt: { ...(r.receipt || {}), synth: { lead: lead.type, title: item.title, signals: got.pick.map((p) => p.tag), facts: got.pick.map((p) => ({ tag: p.tag, type: p.type, nums: p.nums || null })), now: item.pts[item.pts.length - 1], sources: ["research/assets/public/hist-long", "research/assets/public/buckets", "research/assets/public/listings-counted.json", "data/sealed-prices.json", "research/assets/public/set-value", "research/assets/public/rotation-status.json"] } } };
    const windowDays = Number(lead.window) || (namedWindows(text).size === 1 ? [...namedWindows(text)][0] : 0);
    if (useSynth) {
      next.lines = got.pick.slice(1).map((p) => p.short).filter((line) => typeof line === "string" && line.trim());
      const ends = leadEnds(lead);
      if (ends && windowDays) {
        next.startDate = ends.startDate;
        next.endDate = ends.endDate;
      }
    }
    if (windowDays) next = alignToWindow(next, windowDays, lead);
    const whyLead = whyFromLead(lead);
    if (whyLead) {
      next.why = whyLead;
      next.whyItMatters = whyLead;
    }
    const spoken = speakRead(next);
    const final = keepContract(spoken, r);
    if (final === r) { report.rewritten -= 1; report.kept += 1; report.keptForShape += 1; }
    return final;
  });
  return { reads: out, report };
}
