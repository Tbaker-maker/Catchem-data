// Synthesized reads for one item. Each read about a single product is rewritten
// into a 2 to 3 sentence summary from every signal on file for that item:
// price trend over 7, 30, 90 and 365 days, where today sits against its range,
// weekly streaks and how often the price moved, listings counted, the eBay ask
// against TCGplayer market, its set and the wider market, and set context.
// The lead sentence is the most notable finding for that item, so openings come
// from the data. Every number is a real dated point kept in receipt.synth.
// Every limit and weight lives in catchem-data-private (config/read-synthesis.json).
// Without them nothing is rewritten and the step says so.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { banGuard } from "./copy-rules.mjs";
import { money } from "./public-bundle.mjs";
import { cardTitle, tcgAmount } from "./card-face.mjs";
import { monthDay } from "./takes.mjs";
import { dayNum, addDays, dateLabel, nearestPoint, loadHistoryCards } from "./history-reads.mjs";
import { eraTagOf } from "./signal-chips.mjs";

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

function changeAt(pts, asOf, days, cfg) {
  const last = pts[pts.length - 1];
  const p = nearestPoint(pts.slice(0, -1), addDays(asOf, -days), cfg.slackDays[days]);
  if (!p) return null;
  return { days, from: p, to: last, pct: pct(p[1], last[1]) };
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
    const hi = prior.reduce((m, p) => (p[1] > m[1] ? p : m));
    const lo = prior.reduce((m, p) => (p[1] < m[1] ? p : m));
    if (last[1] > hi[1]) out.push({ tag: "range", type: "high", score: cfg.weights.high, nums: { hi, now: last }, text: `Highest price on file for ${title}: ${usd(last[1])} on ${monthDay(asOf)}, above the earlier peak of ${at(hi, asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.`, short: `That is its highest price on file, back to ${dateLabel(pts[0][0], asOf)}, above the earlier peak of ${at(hi, asOf)}.` });
    else if (last[1] < lo[1]) out.push({ tag: "range", type: "low", score: cfg.weights.low, nums: { lo, now: last }, text: `Lowest price on file for ${title}: ${usd(last[1])} on ${monthDay(asOf)}, under the earlier low of ${at(lo, asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.`, short: `That is its lowest price on file, back to ${dateLabel(pts[0][0], asOf)}, under the earlier low of ${at(lo, asOf)}.` });
    else {
      const off = (1 - last[1] / hi[1]) * 100;
      const level = Math.round(hi[1] * 100) === Math.round(last[1] * 100);
      if (off <= cfg.nearHighPct) out.push({ tag: "range", type: "nearHigh", score: cfg.weights.nearHigh, nums: { hi, now: last },
        text: level ? `Level with its highest price on file: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}, the same as on ${dateLabel(hi[0], asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.` : `Within ${Math.max(1, r0(off))}% of its highest price on file: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}, against a peak of ${at(hi, asOf)}.`,
        short: level ? `It is level with its highest price on file, first reached on ${dateLabel(hi[0], asOf)}, with records back to ${dateLabel(pts[0][0], asOf)}.` : `It sits within ${Math.max(1, r0(off))}% of its highest price on file, ${at(hi, asOf)}.` });
      else if (off >= cfg.drawdownMinPct) out.push({ tag: "range", type: "drawdown", score: cfg.weights.drawdown * (off / 100), nums: { hi, now: last }, text: `Still ${r0(off)}% under its peak of ${at(hi, asOf)}: ${title} is at ${usd(last[1])} on ${monthDay(asOf)}.`, short: `It is still ${r0(off)}% under its peak of ${at(hi, asOf)}.` });
    }
  }
  // Trend across windows
  const moves = WINDOWS.map((w) => ch[w]).filter((c) => c && Math.abs(c.pct) >= cfg.trendMinPct[c.days] && Math.abs(c.to[1] - c.from[1]) >= cfg.minTrendUsd);
  if (moves.length) {
    const lead = moves.reduce((m, c) => (Math.abs(c.pct) / cfg.trendMinPct[c.days] > Math.abs(m.pct) / cfg.trendMinPct[m.days] ? c : m));
    const others = WINDOWS.map((w) => ch[w]).filter((c) => c && c !== lead);
    const win = (c) => (c.days === 365 ? "a year" : `${c.days} days`);
    const word = (c) => (r0(c.pct) < 1 ? `flat over ${win(c)}` : `${c.pct >= 0 ? "up" : "down"} ${r0(c.pct)}% over ${win(c)}`);
    const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0]);
    const tail = others.length ? `, and is ${list(others.map(word))}` : "";
    const days = dayNum(asOf) - dayNum(lead.from[0]);
    out.push({ tag: "trend", type: `trend${lead.days}${lead.pct >= 0 ? "up" : "down"}`, window: lead.days, score: cfg.weights.trend * (Math.abs(lead.pct) / cfg.trendMinPct[lead.days]), nums: { lead, others },
      text: `${lead.pct >= 0 ? "Up" : "Down"} ${r0(lead.pct)}% ${lead.days === 7 ? "in a week" : lead.days === 365 ? "on the year" : `in ${days} days`}: ${title} went from ${at(lead.from, asOf)} to ${usd(lead.to[1])} on ${monthDay(asOf)}${tail}.`,
      short: `Over time it is ${list(WINDOWS.map((w) => ch[w]).filter(Boolean).map(word))}, to ${usd(last[1])} on ${monthDay(asOf)}.` });
  }
  // Short and long term disagree
  const s = ch[30]; const l = ch[365] || ch[90];
  if (s && l && Math.sign(s.pct) !== Math.sign(l.pct) && Math.abs(s.pct) >= cfg.divergenceMinPct && Math.abs(l.pct) >= cfg.divergenceMinPct) {
    out.push({ tag: "trend", type: "divergence", window: 30, score: cfg.weights.divergence, nums: { s, l },
      text: `The month and the ${l.days === 365 ? "year" : "quarter"} point different ways for ${title}: ${s.pct >= 0 ? "up" : "down"} ${r0(s.pct)}% since ${dateLabel(s.from[0], asOf)}, yet ${l.pct >= 0 ? "up" : "down"} ${r0(l.pct)}% since ${dateLabel(l.from[0], asOf)} (${usd(l.from[1])}).`, short: `The month and the ${l.days === 365 ? "year" : "quarter"} disagree: ${s.pct >= 0 ? "up" : "down"} ${r0(s.pct)}% since ${dateLabel(s.from[0], asOf)}, ${l.pct >= 0 ? "up" : "down"} ${r0(l.pct)}% since ${dateLabel(l.from[0], asOf)}.` });
  }
  // Weekly streak and how often it moved
  const st = weeklyStreak(pts, asOf);
  if (st && st.n >= cfg.streakMinWeeks && Math.abs(st.to[1] - st.from[1]) >= cfg.minTrendUsd) {
    out.push({ tag: "streak", type: `streak${st.dir > 0 ? "up" : "down"}`, score: cfg.weights.streak * st.n, nums: { st },
      text: `${st.dir > 0 ? "Higher" : "Lower"} for ${st.n} weeks running: ${title} moved from ${at(st.from, asOf)} to ${usd(st.to[1])} on ${monthDay(asOf)}.`, short: `It has closed ${st.dir > 0 ? "higher" : "lower"} ${st.n} weeks running, from ${at(st.from, asOf)}.` });
  }
  const mv = movedDays(pts, asOf);
  if (mv) out.push({ tag: "activity", type: "activity", score: 0, nums: { mv }, text: `The price changed on ${mv.moved} of the last ${mv.of} days on file.`, short: `The price changed on ${mv.moved} of the last ${mv.of} days on file.` });
  // Against its set and the market
  const peer = ctx.peers?.get(item.setSlug);
  const sg = (x) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(1)}%`;
  if (ch[30] && peer && peer.n >= cfg.peerMinN) {
    const gap = ch[30].pct - peer.median;
    const own = r0(ch[30].pct) < 1 ? "flat" : `${ch[30].pct >= 0 ? "up" : "down"} ${r0(ch[30].pct)}%`;
    const mkt = ctx.market && ctx.market.n >= cfg.peerMinN ? `, and ${sg(ctx.market.median)} for ${ctx.market.n} priced items across the market` : "";
    const base = `${sg(peer.median)} median for ${peer.n} ${item.set} items priced ${usd(cfg.peerMinPrice)} or more${mkt}`;
    if (Math.abs(gap) >= cfg.peerMinGapPts) out.push({ tag: "peers", type: gap > 0 ? "peersAhead" : "peersBehind", score: cfg.weights.peers * (Math.abs(gap) / cfg.peerMinGapPts), nums: { peer, market: ctx.market, own: ch[30] },
      text: `${gap > 0 ? "Ahead of" : "Behind"} its set: ${title} is ${own} over 30 days against a ${base}.`,
      short: `That ${gap > 0 ? "beats" : "trails"} its set over 30 days: ${own} against a ${base}.` });
    else out.push({ tag: "peers", type: "peersInline", score: 0, nums: { peer, market: ctx.market, own: ch[30] }, short: `Over 30 days it is ${own}, in line with a ${base}.` });
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
  if (rot?.status) bits.push(`${rot.status === "Standard" ? "still Standard legal" : String(rot.status).toLowerCase()}`);
  const sv = ctx.setValue?.get(item.setSlug);
  if (sv?.total > 0 && sv.priced > 1) bits.push(`its ${sv.priced} priced cards add up to ${usd(sv.total)}`);
  if (bits.length) out.push({ tag: "set", type: "set", score: 0, nums: { era, rot, sv, release: item.release }, short: `${bits[0]}${bits.length > 1 ? `, ${bits.slice(1).join(", ")}` : ""}.` });
  const clean = (t) => !t || (!BANNED.test(t) && !DASH.test(t) && !SOLD.test(t));
  return out.filter((f) => (f.text || f.short) && clean(f.text) && clean(f.short));
}

// Lead with the strongest finding whose opening is not over the share cap, then add
// up to two supporting sentences from other signals, scored ones first.
export function compose(item, fs, cfg, used) {
  const ranked = fs.filter((f) => f.score > 0 && f.text).sort((a, b) => b.score - a.score);
  const kindF = item.kindLine ? { tag: "kind", type: `kind:${item.kind}`, score: cfg.weights.kind, text: item.kindLine } : null;
  if (kindF) { ranked.push(kindF); ranked.sort((a, b) => b.score - a.score); }
  if (!ranked.length) return null;
  const cap = used ? Math.max(1, Math.floor(cfg.maxOpeningShare * used.total)) : Infinity;
  const key = (f) => openingKey(f.text, [item.title]);
  const count = (f) => (used ? used.byType.get(key(f)) || 0 : 0);
  const lead = ranked.find((f) => count(f) < cap) || ranked.slice().sort((a, b) => count(a) - count(b))[0];
  const tags = new Set([lead.tag]);
  const pick = [lead];
  const ORDER = ["trend", "range", "listings", "ask", "peers", "streak", "activity", "set"];
  const pool = ranked.filter((f) => f !== lead && f.short).concat(fs.filter((f) => !(f.score > 0) && f.short).sort((a, b) => ORDER.indexOf(a.tag) - ORDER.indexOf(b.tag)));
  for (const f of pool) {
    if (pick.length >= 3) break;
    if (tags.has(f.tag)) continue;
    tags.add(f.tag); pick.push(f);
  }
  const avail = new Set(fs.map((f) => f.tag).concat(kindF ? ["kind"] : [])).size;
  if (tags.size < Math.min(cfg.minSignals, avail)) return null;
  const text = pick.map((p, i) => (i ? p.short : p.text)).join(" ");
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

// Rewrite the item reads. Returns the new list and a report.
export function synthesizeReads(reads, ctx, cfg) {
  const items = reads.filter(isItemRead);
  const used = { total: items.length, byType: new Map() };
  const report = { item: items.length, rewritten: 0, kept: 0 };
  const out = reads.map((r) => {
    if (!isItemRead(r)) return r;
    const item = itemOf(r, ctx);
    if (!item) { report.kept += 1; return r; }
    const fs = findings(item, ctx, cfg);
    const got = compose(item, fs, cfg, used);
    if (!got) { report.kept += 1; return r; }
    report.rewritten += 1;
    const lead = got.lead;
    const next = { ...r, headline: got.text, path: got.text, variants: [got.text], synth: true,
      receipt: { ...(r.receipt || {}), synth: { lead: lead.type, title: item.title, signals: got.pick.map((p) => p.tag), facts: got.pick.map((p) => ({ tag: p.tag, type: p.type, nums: p.nums || null })), now: item.pts[item.pts.length - 1], sources: ["research/assets/public/hist-long", "research/assets/public/buckets", "research/assets/public/listings-counted.json", "data/sealed-prices.json", "research/assets/public/set-value", "research/assets/public/rotation-status.json"] } } };
    if (lead.window) next.windowDays = lead.window;
    return next;
  });
  return { reads: out, report };
}
