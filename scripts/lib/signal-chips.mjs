// Signal chips for a read. Thresholds stay in catchem-data-private
// (data/private/signal-chips/thresholds.json). This file only applies the
// rules it is given and returns the chip words. It does not score reads
// and it does not decide which reads exist.
import { flagLine, isClean } from "./copy-rules.mjs";

export const CHIP_ORDER = Object.freeze([
  "move", "supply", "gone", "range", "momentum", "rotation", "art", "era", "confidence",
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
    if (now && then && now[0] !== then[0]) { hit = { days, now: now[1], then: then[1] }; break; }
  }
  if (!hit && points.length >= 2) {
    const days = dayNum(points[points.length - 1][0]) - dayNum(points[0][0]);
    if (days >= num(move.minDays)) hit = { days, now: points[points.length - 1][1], then: points[0][1] };
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
  };
}

function supplyChip(ctx, rules) {
  const min = num(rules?.supply?.minAbsPct);
  const row = ctx?.listings;
  if (!(min >= 0) || !row) return null;
  const n = num(row.n);
  const prev = num(row.prev);
  if (!(n >= 0) || !(prev > 0)) return null;
  const pct = ((n - prev) / prev) * 100;
  if (Math.abs(pct) < min) return null;
  const dir = pct > 0 ? "up" : "down";
  const shown = roundPct(Math.abs(pct));
  const word = dir === "up" ? "up" : "down";
  return {
    kind: "supply",
    dir,
    text: `${shown}%`,
    label: `Listings counted ${word} ${shown} percent`,
  };
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
  return { kind: "gone", dots, label: `Listings gone, ${word}` };
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
  return { kind: "momentum", word, label: `Momentum ${word}` };
}

function rotationChip(ctx) {
  const months = num(ctx?.rotationMonths);
  if (!(months >= 1) || months > 36) return null;
  const n = Math.round(months);
  return { kind: "rotation", text: `Rotates in ${n} mo`, label: `Rotates in ${n} months` };
}

function eraChip(ctx, rules) {
  const cut = String(rules?.era?.vintageBefore || "");
  const release = String(ctx?.release || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cut) || !/^\d{4}-\d{2}-\d{2}$/.test(release)) return null;
  const tag = release < cut ? "Vintage" : "Modern";
  return { kind: "era", tag, label: tag };
}

function confidenceChip(points, rules) {
  const cuts = Array.isArray(rules?.confidence?.cuts) ? rules.confidence.cuts.map(num) : [];
  if (cuts.length < 2 || !points.length) return null;
  const n = points.length;
  let bars = 3;
  if (n < cuts[0]) bars = 1;
  else if (n < cuts[1]) bars = 2;
  const word = bars === 1 ? "One" : bars === 2 ? "Two" : "Three";
  return { kind: "confidence", bars, label: `${word} data bars on file` };
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
    const word = chip.dir === "up" ? "up" : "down";
    return `Listings counted are ${word} ${chip.text}${dated}.`;
  }
  if (chip.kind === "gone") return `Listings gone are ${GONE_WORD[chip.dots] || "steady"}.`;
  if (chip.kind === "range") return `Today sits in the ${chip.days} day range.`;
  if (chip.kind === "momentum") return `Momentum is ${chip.word}.`;
  if (chip.kind === "rotation") return `Rotates in ${String(chip.text || "").replace(" mo", " months")}.`;
  if (chip.kind === "art") return `Art type is ${artName(chip.badge)}.`;
  if (chip.kind === "era") return `Era tag is ${chip.tag}.`;
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
  if (chip.kind === "gone") return { kind: "gone", dots: chip.dots, label: chip.label };
  if (chip.kind === "range") return { kind: "range", pos: chip.pos, days: chip.days, label: chip.label };
  if (chip.kind === "momentum") return { kind: "momentum", word: chip.word, label: chip.label };
  if (chip.kind === "rotation") return { kind: "rotation", text: chip.text, label: chip.label };
  if (chip.kind === "art") return { kind: "art", badge: chip.badge, label: chip.label };
  if (chip.kind === "era") return { kind: "era", tag: chip.tag, label: chip.label };
  if (chip.kind === "confidence") return { kind: "confidence", bars: chip.bars, label: chip.label };
  return null;
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

export function readSignals(read, ctx = {}, rules = {}) {
  const asOf = String(ctx.asOf || read?.asOf || "").slice(0, 10);
  const all = qualifyChips(read, ctx, rules);
  const signals = pickChips(all, rules);
  if (!signals.length) return { signals: [], blurb: "" };
  const lead = signals[0];
  let blurb = blurbFor(lead, asOf);
  if (isSealedRead(read) && /\bNM\b|Near Mint|\bcondition\b/i.test(blurb)) blurb = "";
  if (blurb && !isClean(blurb)) {
    flagLine(blurb, { field: "blurb", id: String(read?.id || "") });
    blurb = "";
  }
  if (blurb && /[\u2013\u2014]/.test(blurb)) blurb = "";
  return { signals, blurb };
}

export function signalsLookSecret(value) {
  const blob = JSON.stringify(value);
  return /flatAbs|threshold|cutoff|"score"|rankExtra|"cuts"|"weight"/.test(blob);
}
