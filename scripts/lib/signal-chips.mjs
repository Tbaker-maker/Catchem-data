// Signal chips for a read. Thresholds and dot cutoffs stay in catchem-data-private.
// This file only applies the rules it is given. It does not decide which reads exist.
// An overall score is added only when the private rules name a proven signal.
import { flagLine, isClean } from "./copy-rules.mjs";

export const CHIP_ORDER = Object.freeze([
  "supply", "move", "gone", "range", "momentum", "rotation", "art", "era", "confidence",
]);

const ART_BADGE = Object.freeze({
  "special illustration rare": "SIR",
  "illustration rare": "IR",
  "full art": "FA",
});

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GONE_WORD = ["", "light", "steady", "fast"];

export function dayNum(iso) {
  const t = Date.parse(`${String(iso || "").slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? Math.round(t / 86400000) : NaN;
}

export function addDays(iso, n) {
  const d = dayNum(iso);
  if (!Number.isFinite(d)) return "";
  return new Date(d * 86400000 + n * 86400000).toISOString().slice(0, 10);
}

export function dayLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}`;
}

export function isSealedRead(read) {
  const kind = String(read?.kind || read?.readKind || read?.item?.kind || "").toLowerCase();
  const href = String(read?.href || "");
  return kind === "sealed" || kind === "listings" || href.startsWith("/p/");
}

import { runStage, sellerTag } from "./seller-stage.mjs";
import { isVintageRelease, WOTC_END } from "./price-trust.mjs";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function roundPct(n) {
  return Math.round(n);
}

function nearest(points, iso, slack) {
  const want = dayNum(iso);
  if (!Number.isFinite(want)) return null;
  let best = null;
  let gap = Infinity;
  for (const p of points) {
    const g = Math.abs(dayNum(p[0]) - want);
    if (g < gap) { gap = g; best = p; }
  }
  if (!best || gap > slack) return null;
  return best;
}

function cleanPoints(list) {
  const out = [];
  for (const row of list || []) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const iso = String(row[0] || "").slice(0, 10);
    const price = num(row[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !(price > 0)) continue;
    out.push([iso, price]);
  }
  out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return out;
}

function pointsFromRead(read) {
  const asOf = String(read?.asOf || "").slice(0, 10);
  const days = num(read?.windowDays);
  const pct = num(read?.changePct);
  const now = num(read?.price);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !(days > 0) || !Number.isFinite(pct) || !(now > 0)) return [];
  const denom = 1 + pct / 100;
  if (!(denom > 0)) return [];
  const then = now / denom;
  if (!(then > 0)) return [];
  return [[addDays(asOf, -days), then], [asOf, now]];
}

function artBadge(read, ctx) {
  if (isSealedRead(read)) return "";
  const bits = [];
  if (ctx?.art) bits.push(ctx.art);
  if (read?.art) bits.push(read.art);
  if (Array.isArray(read?.tags)) bits.push(...read.tags);
  for (const bit of bits) {
    const key = String(bit || "").trim().toLowerCase();
    if (ART_BADGE[key]) return ART_BADGE[key];
  }
  return "";
}

function artName(badge) {
  if (badge === "SIR") return "Special Illustration Rare";
  if (badge === "IR") return "Illustration Rare";
  if (badge === "FA") return "Full Art";
  return "";
}

function held(read, ctx) {
  if (ctx?.held === true) return true;
  const status = String(read?.priceStatus || "").toLowerCase();
  if (status === "checking" || status === "unverified") return true;
  const head = String(read?.headline || "");
  return /price being checked/i.test(head);
}

function moveChip(points, asOf, rules, checked) {
  if (checked) {
    return { kind: "move", dir: "dash", text: "", label: "Price being checked" };
  }
  const move = rules?.move;
  if (!move || !(num(move.flatAbs) >= 0)) return null;
  const slack = num(move.slackDays);
  const prefer = Array.isArray(move.preferDays) ? move.preferDays.map(num).filter((n) => n > 0) : [];
  let hit = null;
  for (const days of prefer) {
    const now = nearest(points, asOf, slack);
    const then = nearest(points, addDays(asOf, -days), slack);
    if (now && then && now[0] !== then[0]) { hit = { days, now: now[1], then: then[1], thenDate: then[0], nowDate: now[0] }; break; }
  }
  if (!hit && points.length >= 2) {
    const days = dayNum(points[points.length - 1][0]) - dayNum(points[0][0]);
    if (days >= num(move.minDays)) hit = { days, now: points[points.length - 1][1], then: points[0][1], thenDate: points[0][0], nowDate: points[points.length - 1][0] };
  }
  if (!hit) return null;
  const pct = ((hit.now - hit.then) / hit.then) * 100;
  if (!Number.isFinite(pct)) return null;
  const abs = Math.abs(pct);
  const dir = abs < num(move.flatAbs) ? "flat" : (pct > 0 ? "up" : "down");
  const shown = dir === "flat" ? 0 : roundPct(abs);
  const window = `${hit.days}D`;
  const text = `${shown}% ${window}`;
  const word = dir === "up" ? "up" : dir === "down" ? "down" : "flat";
  return {
    kind: "move",
    dir,
    text,
    label: dir === "flat" ? `Price flat over ${hit.days} days` : `Price ${word} ${shown} percent over ${hit.days} days`,
    pct: Math.round(abs * 10) / 10,
    days: hit.days,
    then: hit.then,
    thenDate: hit.thenDate,
    now: hit.now,
    nowDate: hit.nowDate,
  };
}

function listingSeries(row) {
  const out = [];
  const seen = new Set();
  const add = (date, n) => {
    const iso = String(date || "").slice(0, 10);
    const count = num(n);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !(count >= 0) || seen.has(iso)) return;
    seen.add(iso);
    out.push({ date: iso, n: count });
  };
  for (const point of row?.series || []) add(point?.date || point?.[0], point?.n ?? point?.[1]);
  add(row?.prevDate, row?.prev);
  add(row?.date, row?.n);
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

function nearestCount(series, iso, slack) {
  const want = dayNum(iso);
  if (!Number.isFinite(want)) return null;
  let best = null;
  let gap = Infinity;
  for (const row of series) {
    const g = Math.abs(dayNum(row.date) - want);
    if (g < gap) { gap = g; best = row; }
  }
  if (!best || gap > slack) return null;
  return best;
}

function countWindow(series, asOf, days, slack) {
  const now = nearestCount(series, asOf, slack);
  const then = nearestCount(series, addDays(asOf, -days), slack);
  if (!now || !then || now.date === then.date || !(then.n > 0)) return null;
  const span = dayNum(now.date) - dayNum(then.date);
  if (!(span > 0)) return null;
  const pct = ((now.n - then.n) / then.n) * 100;
  if (!Number.isFinite(pct)) return null;
  return { pct, days: span };
}

function priceWindow(points, asOf, days, slack) {
  const now = nearest(points, asOf, slack);
  const then = nearest(points, addDays(asOf, -days), slack);
  if (!now || !then || now[0] === then[0] || !(then[1] > 0)) return null;
  const pct = ((now[1] - then[1]) / then[1]) * 100;
  return Number.isFinite(pct) ? { pct } : null;
}

function paceWord(series, hit, spec, asOf) {
  const dir = hit.pct < 0 ? "Draining" : "Stacking";
  const multiple = num(spec?.paceMultiple);
  const windowDays = num(spec?.windowDays) > 0 ? num(spec.windowDays) : hit.days;
  const slack = Number.isFinite(num(spec?.slackDays)) ? num(spec.slackDays) : 0;
  if (!(multiple > 0) || !(windowDays > 0)) return dir;
  const samples = [];
  let cursor = addDays(asOf, -windowDays);
  for (let i = 0; i < 6; i++) {
    const older = countWindow(series, cursor, windowDays, slack);
    if (!older) break;
    samples.push(Math.abs(older.pct));
    cursor = addDays(cursor, -windowDays);
  }
  if (!samples.length) return dir;
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  if (Math.abs(hit.pct) + 0.0001 < mid * multiple) return "quiet";
  return dir;
}

function sellerWord(row, spec) {
  const n = num(row?.sellers);
  const share = num(row?.topShare);
  const fewMax = num(spec?.fewSellersMax);
  const fewShare = num(spec?.fewShareMin);
  const manyMin = num(spec?.manySellersMin);
  if (!(n >= 0) || !(fewMax >= 0) || !(manyMin >= 0)) return "";
  if (n <= fewMax || (Number.isFinite(fewShare) && Number.isFinite(share) && share >= fewShare)) return "Few sellers";
  if (n >= manyMin) return "Many sellers";
  return "";
}

function stageWord(series, points, asOf, spec) {
  const days = num(spec?.stageDays) > 0 ? num(spec.stageDays) : 0;
  const slack = Number.isFinite(num(spec?.slackDays)) ? num(spec.slackDays) : 0;
  const flat = num(spec?.flatAbs);
  if (!(days > 0) || !(flat >= 0)) return "";
  const recent = countWindow(series, asOf, days, slack);
  const prior = countWindow(series, addDays(asOf, -days), days, slack);
  if (!recent || !prior) return "";
  const priceRecent = priceWindow(points, asOf, days, slack);
  const r = recent.pct;
  const p = prior.pct;
  if (Math.abs(r) < flat && (!priceRecent || Math.abs(priceRecent.pct) < flat)) return "Stalled";
  if (((r < 0 && p > 0) || (r > 0 && p < 0)) && Math.abs(r) >= flat && Math.abs(p) >= flat) return "Reversing";
  const faster = Math.abs(r) > Math.abs(p);
  const slower = Math.abs(r) < Math.abs(p);
  if (r < 0 && faster && (!priceRecent || priceRecent.pct >= 0)) return "Building";
  if (r < 0 && slower) return "Slowing";
  if (r > 0 && faster) return "Building";
  if (r > 0 && slower) return "Slowing";
  return "";
}

function supplyChip(ctx, rules) {
  const spec = rules?.supply;
  const min = num(spec?.minAbsPct);
  const row = ctx?.listings;
  if (!(min >= 0) || !row) return null;
  const asOf = String(row.date || ctx.asOf || "").slice(0, 10);
  const series = listingSeries(row);
  const windowDays = num(spec?.windowDays) > 0 ? num(spec.windowDays) : 0;
  const slack = Number.isFinite(num(spec?.slackDays)) ? num(spec.slackDays) : 0;
  let hit = windowDays > 0 ? countWindow(series, asOf, windowDays, slack) : null;
  if (!hit) {
    const n = num(row.n);
    const prev = num(row.prev);
    if (!(prev > 0) || !(n >= 0)) return null;
    hit = { pct: ((n - prev) / prev) * 100, days: 0 };
  }
  if (!Number.isFinite(hit.pct) || Math.abs(hit.pct) < min) return null;
  const pace = paceWord(series, hit, spec, asOf);
  if (pace === "quiet") return null;
  // Seller and stage words stay off until their measurement is approved.
  const extras = spec?.publicExtras === true;
  const sellers = extras ? sellerWord(row, spec) : "";
  const stage = extras ? stageWord(series, cleanPoints(ctx.points), asOf, spec) : "";
  const shown = roundPct(Math.abs(hit.pct));
  const sign = hit.pct < 0 ? "-" : "+";
  const dayBit = hit.days > 0 ? ` ${hit.days}d` : "";
  const parts = [`Listings ${sign}${shown}%${dayBit}`];
  if (pace === "Draining" || pace === "Stacking") parts.push(pace);
  if (sellers) parts.push(sellers);
  if (stage) parts.push(stage);
  const text = parts.join(" · ");
  const dir = hit.pct < 0 ? "down" : "up";
  const way = dir === "down" ? "down" : "up";
  const over = hit.days > 0 ? ` over ${hit.days} days` : "";
  let label = `Listings counted ${way} ${shown} percent${over}`;
  if (pace === "Draining" || pace === "Stacking") label += `. ${pace}`;
  if (sellers) label += `. ${sellers}`;
  if (stage) label += `. ${stage}`;
  return { kind: "supply", dir, text, label };
}

function goneChip(ctx, rules) {
  const cuts = Array.isArray(rules?.gone?.cuts) ? rules.gone.cuts.map(num) : [];
  if (cuts.length < 2) return null;
  const row = ctx?.listings;
  if (!row) return null;
  const n = num(row.n);
  const prev = num(row.prev);
  if (!(prev > 0) || !(n >= 0) || n >= prev) return null;
  const rate = ((prev - n) / prev) * 100;
  let dots = 3;
  if (rate < cuts[0]) dots = 1;
  else if (rate < cuts[1]) dots = 2;
  const word = GONE_WORD[dots];
  return { kind: "gone", dots, word, rate, label: `Listings gone, ${word}` };
}

function rangeChip(points, asOf, rules) {
  const minDays = num(rules?.range?.minDays);
  if (!(minDays > 0) || points.length < 3) return null;
  const end = dayNum(asOf);
  const window = points.filter((p) => end - dayNum(p[0]) <= 90 && end - dayNum(p[0]) >= 0);
  const rows = window.length >= 3 ? window : points;
  const days = dayNum(rows[rows.length - 1][0]) - dayNum(rows[0][0]);
  if (!(days >= minDays)) return null;
  const vals = rows.map((p) => p[1]);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  if (!(hi > lo)) return null;
  const today = nearest(rows, asOf, Number.isFinite(num(rules?.move?.slackDays)) ? num(rules.move.slackDays) : 0) || rows[rows.length - 1];
  const pos = Math.round(((today[1] - lo) / (hi - lo)) * 100) / 100;
  const place = pos < 0.34 ? "lower part" : pos > 0.66 ? "upper part" : "middle";
  return {
    kind: "range",
    pos,
    days,
    label: `Today sits in the ${place} of the ${days} day range`,
  };
}

function momentumChip(points, asOf, rules) {
  const m = rules?.momentum;
  if (!m || !Number.isFinite(num(m.risingMin)) || !Number.isFinite(num(m.coolingMax))) return null;
  const days = num(m.recentDays);
  const slack = num(rules?.move?.slackDays);
  const now = nearest(points, asOf, Number.isFinite(slack) ? slack : 0);
  const then = nearest(points, addDays(asOf, -days), Number.isFinite(slack) ? slack : 0);
  if (!now || !then || now[0] === then[0] || !(then[1] > 0)) return null;
  const pct = ((now[1] - then[1]) / then[1]) * 100;
  const word = pct >= num(m.risingMin) ? "Rising" : pct <= num(m.coolingMax) ? "Cooling" : "Flat";
  return { kind: "momentum", word, mag: Math.abs(pct), label: `Momentum ${word}` };
}

function rotationChip(ctx) {
  const months = num(ctx?.rotationMonths);
  if (!(months >= 1) || months > 36) return null;
  const n = Math.round(months);
  return { kind: "rotation", text: `Rotates in ${n} mo`, label: `Rotates in ${n} months` };
}

// Vintage means a WOTC era set, released before 2003-06-01, and nothing else.
// A promo uses the card's own release date. The set start is not that day.
// The private rule only switches the chip on; it never moves the line.
function eraRelease(ctx) {
  const setRelease = String(ctx?.release || "").slice(0, 10);
  const cardRelease = String(ctx?.cardRelease || "").slice(0, 10);
  const setOk = /^\d{4}-\d{2}-\d{2}$/.test(setRelease);
  const cardOk = /^\d{4}-\d{2}-\d{2}$/.test(cardRelease);
  if (ctx?.promo) {
    if (cardOk && (!setOk || cardRelease !== setRelease)) return cardRelease;
    if (setOk && setRelease >= WOTC_END) return setRelease;
    return "";
  }
  if (setOk) return setRelease;
  return cardOk ? cardRelease : "";
}

function eraChip(ctx, rules) {
  if (!rules?.era) return null;
  const release = eraRelease(ctx);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(release)) return null;
  const tag = isVintageRelease(release) ? "Vintage" : "Modern";
  return { kind: "era", tag, label: tag === "Vintage" ? "Vintage, a WOTC era set" : "Modern" };
}

function confidenceChip(points, rules) {
  const cuts = Array.isArray(rules?.confidence?.cuts) ? rules.confidence.cuts.map(num).filter(Number.isFinite).slice(0, 4) : [];
  if (cuts.length < 2 || !points.length) return null;
  const n = points.length;
  let bars = 1;
  for (const cut of cuts) if (n >= cut) bars += 1;
  const of = cuts.length + 1;
  const word = ["", "One", "Two", "Three", "Four", "Five"][bars];
  return { kind: "confidence", bars, of, label: `${word} data bars on file` };
}

function priority(chips, rules) {
  const order = CHIP_ORDER.slice();
  for (const boost of rules?.boost || []) {
    const kind = String(boost?.kind || "");
    const ahead = String(boost?.aheadOf || "");
    const hit = chips.find((chip) => chip.kind === kind
      && (!boost.badge || chip.badge === boost.badge)
      && !(Number.isFinite(num(boost.maxMonths)) && !(num(chip.months) <= num(boost.maxMonths))));
    if (!hit) continue;
    const from = order.indexOf(kind);
    const to = order.indexOf(ahead);
    if (from < 0 || to < 0 || from <= to) continue;
    order.splice(from, 1);
    order.splice(to, 0, kind);
  }
  return order;
}

function blurbFor(chip, asOf) {
  const when = dayLabel(asOf);
  const dated = when ? `, as of ${when}` : "";
  if (!chip) return "";
  if (chip.kind === "move" && chip.dir === "dash") return "Price being checked.";
  if (chip.kind === "move") {
    const bits = String(chip.text || "").split(" ");
    const pct = bits[0] || "";
    const days = String(bits[1] || "").replace(/D$/, "");
    if (chip.dir === "flat") return `TCGplayer market is flat over ${days} days${dated}.`;
    const word = chip.dir === "up" ? "up" : "down";
    return `TCGplayer market is ${word} ${pct} over ${days} days${dated}.`;
  }
  if (chip.kind === "supply" || chip.kind === "listings") {
    const matched = String(chip.text || "").match(/(\d+)%(?:\s+(\d+)d)?/);
    const pct = matched ? matched[1] : String(chip.text || "").replace("%", "");
    const days = matched && matched[2] ? ` over ${matched[2]} days` : "";
    const word = chip.dir === "up" ? "up" : "down";
    return `Listings counted are ${word} ${pct}%${days}${dated}.`;
  }
  if (chip.kind === "gone") return `Listings gone are ${GONE_WORD[chip.dots] || "steady"}.`;
  if (chip.kind === "range") return `Today sits in the ${chip.days} day range.`;
  if (chip.kind === "momentum") return `Momentum is ${chip.word}.`;
  if (chip.kind === "rotation") return `Rotates in ${String(chip.text || "").replace(" mo", " months")}.`;
  if (chip.kind === "art") return `Art type is ${artName(chip.badge)}.`;
  // An era tag is not a read; it never becomes the blurb.
  if (chip.kind === "era") return "";
  if (chip.kind === "confidence") {
    const word = chip.bars === 1 ? "One" : chip.bars === 2 ? "Two" : "Three";
    return `${word} data bars are on file.`;
  }
  return "";
}

function publish(chip) {
  if (!chip) return null;
  if (chip.kind === "move") return { kind: "move", dir: chip.dir, text: chip.text, label: chip.label };
  if (chip.kind === "supply") return { kind: "listings", dir: chip.dir, text: chip.text, label: chip.label };
  if (chip.kind === "gone") return { kind: "gone", dots: chip.dots, word: chip.word || GONE_WORD[chip.dots] || "steady", label: chip.label };
  if (chip.kind === "range") return { kind: "range", pos: chip.pos, days: chip.days, label: chip.label };
  if (chip.kind === "momentum") return { kind: "momentum", word: chip.word, label: chip.label };
  if (chip.kind === "rotation") return { kind: "rotation", text: chip.text, label: chip.label };
  if (chip.kind === "art") return { kind: "art", badge: chip.badge, label: chip.label };
  if (chip.kind === "era") return { kind: "era", tag: chip.tag, label: chip.label };
  if (chip.kind === "confidence") return { kind: "confidence", bars: chip.bars, label: chip.label };
  return null;
}

function quart(sorted, p) {
  if (!sorted.length) return NaN;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function sourceName(read, fallback) {
  const raw = String(read?.source || "").replace(/,\s*\d{4}-\d{2}-\d{2}.*$/, "").trim();
  if (/ebay/i.test(raw)) return "eBay asks";
  if (/tcgplayer/i.test(raw)) return "TCGplayer market";
  return fallback;
}

// Listings counted tile. Only for products with real nightly counts.
// The band is the product's own middle range of counts before the window.
export function listingsTile(ctx = {}, rules = {}) {
  const row = ctx?.listings;
  if (!row) return null;
  const spec = rules?.supply || {};
  const series = listingSeries(row);
  if (series.length < 2) return null;
  const asOf = String(row.date || ctx.asOf || "").slice(0, 10);
  const windowDays = num(spec.windowDays) > 0 ? num(spec.windowDays) : 0;
  const slack = Number.isFinite(num(spec.slackDays)) ? num(spec.slackDays) : 0;
  let hit = windowDays > 0 ? countWindow(series, asOf, windowDays, slack) : null;
  if (!hit) {
    const last = series[series.length - 1];
    const prev = series[series.length - 2];
    const span = dayNum(last.date) - dayNum(prev.date);
    if (!(prev.n > 0) || !(span > 0)) return null;
    hit = { pct: ((last.n - prev.n) / prev.n) * 100, days: span };
  }
  if (!Number.isFinite(hit.pct)) return null;
  let word = "Steady";
  const min = num(spec.minAbsPct);
  if (min >= 0 && Math.abs(hit.pct) >= min) {
    const pace = paceWord(series, hit, spec, asOf);
    if (pace === "Draining" || pace === "Stacking") word = pace;
  }
  const recent = series.slice(-14);
  const start = addDays(asOf, -hit.days);
  const before = series.filter((p) => p.date < start).map((p) => p.n).sort((a, b) => a - b);
  const band = before.length >= 4 ? [Math.round(quart(before, 0.25)), Math.round(quart(before, 0.75))] : null;
  const shown = roundPct(Math.abs(hit.pct));
  const out = {
    word,
    dir: shown === 0 ? "flat" : (hit.pct < 0 ? "down" : "up"),
    pct: shown,
    days: hit.days,
    spark: recent.map((p) => p.n),
    band,
    from: recent[0].date,
    to: recent[recent.length - 1].date,
  };
  // Seller mix and run stage show only when a private rule fires on deep enough data.
  const tag = sellerTag(row.nights, row.peers, rules?.sellerTag);
  if (tag) out.tag = tag;
  const stage = runStage(row.prices, asOf, rules?.stage, series);
  if (stage) out.stage = stage;
  return out;
}

// Five data bars from time on file and how many daily prices fill it.
// The level is the lower of the two, so a long but sparse history does not
// look as deep as a full one. Cuts are private.
export function depthBars(counts, asOf, spec) {
  const spanCuts = Array.isArray(spec?.spanCuts) ? spec.spanCuts.map(num).filter(Number.isFinite) : [];
  const priceCuts = Array.isArray(spec?.priceCuts) ? spec.priceCuts.map(num).filter(Number.isFinite) : [];
  if (spanCuts.length !== 4 || priceCuts.length !== 4) return null;
  const prices = num(counts?.prices);
  const since = String(counts?.since || "");
  if (!(prices > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(since)) return null;
  const span = dayNum(asOf) - dayNum(since);
  if (!Number.isFinite(span) || span < 0) return null;
  const level = (v, cuts) => 1 + cuts.filter((c) => v >= c).length;
  return { bars: Math.min(level(span, spanCuts), level(prices, priceCuts)), of: 5 };
}

function spanWords(since, through) {
  const days = dayNum(through) - dayNum(since);
  if (!(days > 0)) return "";
  if (days < 60) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30.44)} mos`;
  const yrs = Math.round((days / 365.25) * 2) / 2;
  return `${yrs} ${yrs === 1 ? "yr" : "yrs"}`;
}

// Data, price and listings tiles. Counts and dates only, never a cutoff.
export function tilesFor(read, all, ctx = {}, rules = {}) {
  const asOf = String(ctx.asOf || read?.asOf || "").slice(0, 10);
  const tiles = {};
  const src = sourceName(read, "TCGplayer market");
  const conf = all.find((chip) => chip.kind === "confidence");
  const counts = ctx.counts || null;
  const depth = depthBars(counts, asOf, rules?.confidence?.depth);
  if ((depth || conf) && counts && counts.prices > 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(counts.since || ""))) {
    tiles.data = {
      bars: depth ? depth.bars : conf.bars,
      of: depth ? depth.of : (conf.of || 3),
      prices: counts.prices,
      recent: counts.recent || 0,
      since: counts.since,
      through: asOf,
      span: spanWords(counts.since, asOf),
      source: src,
    };
  }
  const move = all.find((chip) => chip.kind === "move");
  const daily = cleanPoints(ctx.daily && ctx.daily.length ? ctx.daily : ctx.points);
  const cut = addDays(asOf, -30);
  const spark = daily.filter((p) => p[0] >= cut).map((p) => Math.round(p[1] * 100) / 100);
  const rw = num(read?.windowDays);
  const rp = num(read?.changePct);
  const rnow = num(read?.price);
  const flat = num(rules?.move?.flatAbs);
  const dirOf = (pct) => (flat >= 0 && Math.abs(pct) < flat ? "flat" : (pct > 0 ? "up" : pct < 0 ? "down" : "flat"));
  const priceTile = (pct, days, from, fromDate) => {
    const dir = dirOf(pct);
    return {
      dir,
      pct: dir === "flat" ? 0 : Math.round(Math.abs(pct) * 10) / 10,
      days,
      from: Math.round(from * 100) / 100,
      fromDate,
      spark: spark.length >= 3 ? spark : [],
      source: src,
      asOf,
    };
  };
  // The Price tile is a short window only. A read built on a long window (a
  // high, a low, a first price) gets a 7 day tile from daily prices, or none.
  // It never falls back to an all time change.
  const SHORT_MAX = 35;
  const sevenDay = () => {
    const now = nearest(daily, asOf, 2);
    const then = nearest(daily, addDays(asOf, -7), 2);
    if (!now || !then || now[0] === then[0] || !(then[1] > 0)) return null;
    const span = dayNum(now[0]) - dayNum(then[0]);
    if (!(span > 0) || span > SHORT_MAX) return null;
    return priceTile(((now[1] - then[1]) / then[1]) * 100, 7, then[1], then[0]);
  };
  if (move && move.dir === "dash") {
    tiles.price = { dash: true, source: src, asOf };
  } else if (rw > 0 && rw <= SHORT_MAX && Number.isFinite(rp) && rnow > 0) {
    // The read's own short window, so the tile matches the price line on the card.
    const then = nearest(daily.length ? daily : cleanPoints(ctx.points), addDays(asOf, -rw), 2);
    tiles.price = priceTile(rp, rw, then ? then[1] : rnow / (1 + rp / 100), then ? then[0] : addDays(asOf, -rw));
  } else if (!(rw > SHORT_MAX) && move && move.days > 0 && move.days <= SHORT_MAX) {
    const t = priceTile(move.dir === "flat" ? 0 : (move.dir === "down" ? -move.pct : move.pct), move.days, move.then, move.thenDate || "");
    t.dir = move.dir;
    t.pct = move.dir === "flat" ? 0 : move.pct;
    tiles.price = t;
  } else {
    const seven = sevenDay();
    if (seven) tiles.price = seven;
  }
  const listed = listingsTile(ctx, rules);
  if (listed) tiles.listings = listed;
  // Singles carry the run stage on the price tile. Sealed uses the listings check above.
  if (tiles.price && !tiles.price.dash && !isSealedRead(read) && !ctx.listings) {
    const stage = runStage(daily, asOf, rules?.stage, null);
    if (stage) tiles.price.stage = stage;
  }
  return Object.keys(tiles).length ? tiles : null;
}

// Every chip the data can support, before the cap.
export function qualifyChips(read, ctx = {}, rules = {}) {
  const asOf = String(ctx.asOf || read?.asOf || "").slice(0, 10);
  const checked = held(read, ctx);
  const series = cleanPoints(ctx.points);
  const points = checked ? [] : (series.length ? series : cleanPoints(pointsFromRead(read)));
  const art = artBadge(read, ctx);
  const rotation = rotationChip(ctx);
  const chips = [
    moveChip(points, asOf, rules, checked),
    supplyChip(ctx, rules),
    goneChip(ctx, rules),
    rangeChip(points, asOf, rules),
    momentumChip(points, asOf, rules),
    rotation ? { ...rotation, months: num(ctx.rotationMonths) } : null,
    art ? { kind: "art", badge: art, label: artName(art) } : null,
    eraChip(ctx, rules),
    confidenceChip(points, rules),
  ].filter(Boolean);
  if (isSealedRead(read)) return chips.filter((chip) => chip.kind !== "art");
  return chips;
}

export function pickChips(chips, rules = {}) {
  const cap = Number.isFinite(num(rules.max)) ? num(rules.max) : 4;
  const order = priority(chips, rules);
  const chosen = [];
  for (const kind of order) {
    const hit = chips.find((chip) => chip.kind === kind);
    if (!hit) continue;
    chosen.push(hit);
    if (chosen.length >= cap) break;
  }
  const display = CHIP_ORDER.map((kind) => chosen.find((chip) => chip.kind === kind)).filter(Boolean);
  return display.map(publish).filter(Boolean);
}

function clipDots(n) {
  const v = Math.round(Number(n));
  if (!(v >= 1)) return 1;
  return v > 5 ? 5 : v;
}

function fromCuts(value, cuts, invert) {
  if (!Number.isFinite(value) || !Array.isArray(cuts)) return 1;
  let n = 1;
  for (const cut of cuts) {
    const c = Number(cut);
    if (!Number.isFinite(c)) continue;
    if (invert ? value < c : value > c) n += 1;
  }
  return clipDots(n);
}

function specStrength(mag, spec) {
  if (spec == null) return 1;
  if (Array.isArray(spec)) return fromCuts(Number(mag), spec, false);
  if (typeof spec === "object") {
    if (Array.isArray(spec.cuts)) return fromCuts(Number(mag), spec.cuts, spec.invert === true);
    const hit = spec[String(mag)];
    return Number.isFinite(Number(hit)) ? clipDots(hit) : 1;
  }
  return 1;
}

function chipMagnitude(chip) {
  if (!chip) return null;
  if (chip.kind === "move" || chip.kind === "supply") {
    if (chip.dir === "dash") return null;
    const m = String(chip.text || "").match(/(\d+(?:\.\d+)?)%/);
    return m ? Number(m[1]) : 0;
  }
  if (chip.kind === "gone") return Number.isFinite(num(chip.rate)) ? num(chip.rate) : num(chip.dots);
  if (chip.kind === "range") {
    const pos = num(chip.pos);
    return Number.isFinite(pos) ? Math.abs(pos - 0.5) * 2 : null;
  }
  if (chip.kind === "momentum") return Number.isFinite(num(chip.mag)) ? Math.abs(num(chip.mag)) : null;
  if (chip.kind === "rotation") return num(chip.months);
  if (chip.kind === "art") return chip.badge || null;
  if (chip.kind === "era") return chip.tag || null;
  if (chip.kind === "confidence") return num(chip.bars);
  return null;
}

function cohortKey(read, ctx, rules) {
  const side = isSealedRead(read) ? "sealed" : "singles";
  const cut = String(rules?.era?.vintageBefore || "");
  const release = String(ctx?.release || "").slice(0, 10);
  const vintage = /^\d{4}-\d{2}-\d{2}$/.test(cut) && /^\d{4}-\d{2}-\d{2}$/.test(release) && release < cut;
  return `${side}:${vintage ? "vintage" : "modern"}`;
}

function withStrength(published, internal, cohort, rules) {
  if (!published || published.dir === "dash" || !rules?.strength) return published;
  const spec = rules.strength.cohorts?.[cohort]?.[published.kind] ?? rules.strength.fallback?.[published.kind];
  if (spec == null) return published;
  const mag = chipMagnitude(internal);
  if (mag == null || (typeof mag === "number" && !Number.isFinite(mag))) return published;
  return { ...published, strength: specStrength(mag, spec) };
}

function overallStrength(signals, rules) {
  const proven = Array.isArray(rules?.strength?.proven) ? rules.strength.proven.map(String) : [];
  if (!proven.length) return null;
  const weights = rules.strength.weights && typeof rules.strength.weights === "object" ? rules.strength.weights : {};
  let total = 0;
  let den = 0;
  for (const chip of signals) {
    if (!proven.includes(chip.kind) || chip.dir === "dash") continue;
    const dots = num(chip.strength);
    if (!(dots >= 1)) continue;
    const w = num(weights[chip.kind]);
    const weight = Number.isFinite(w) && w > 0 ? w : 1;
    total += dots * weight;
    den += weight;
  }
  if (!(den > 0)) return null;
  return clipDots(Math.round(total / den));
}

export function readSignals(read, ctx = {}, rules = {}) {
  const asOf = String(ctx.asOf || read?.asOf || "").slice(0, 10);
  const all = qualifyChips(read, ctx, rules);
  const cohort = cohortKey(read, ctx, rules);
  const signals = pickChips(all, rules).map((chip) => {
    const internal = all.find((row) => (row.kind === "supply" ? "listings" : row.kind) === chip.kind);
    return withStrength(chip, internal, cohort, rules);
  });
  const tiles = tilesFor(read, all, ctx, rules);
  if (!signals.length) return tiles ? { signals: [], blurb: "", tiles } : { signals: [], blurb: "" };
  const lead = signals.find((chip) => chip.kind === "move" && chip.dir === "dash") || signals[0];
  let blurb = blurbFor(lead, asOf);
  if (isSealedRead(read) && /\bNM\b|Near Mint|\bcondition\b/i.test(blurb)) blurb = "";
  if (blurb && !isClean(blurb)) {
    flagLine(blurb, { field: "blurb", id: String(read?.id || "") });
    blurb = "";
  }
  if (blurb && /[\u2013\u2014]/.test(blurb)) blurb = "";
  const out = { signals, blurb };
  if (tiles) out.tiles = tiles;
  const strength = overallStrength(signals, rules);
  if (strength) out.strength = strength;
  return out;
}

export function signalsLookSecret(value) {
  const blob = JSON.stringify(value);
  return /flatAbs|threshold|cutoff|"score"|rankExtra|"cuts"|"weight"|proven|cohorts|fallback|"invert"/.test(blob);
}
