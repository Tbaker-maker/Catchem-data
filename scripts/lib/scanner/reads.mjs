// Public scanner reads. Own days only. No price call. No fill point in the text.

import { money, BANNED as BUNDLE_BAN, FILLER_BAN } from "../public-bundle.mjs";
import { publicCopyOk } from "../year-patterns.mjs";
import { dateLabel } from "../history-reads.mjs";
import { gateFor } from "./engine.mjs";
import { round1 } from "./common.mjs";

const LABEL = {
  "slow-climb": "slow climb",
  "slow-slide": "slow slide",
  breakout: "move out of a flat range",
  "sharp-spike": "sharp rise",
  "spike-revert": "sharp rise that gave back",
  recovery: "recovery after a slide",
  "flat-range": "flat range",
  "listings-down-flat": "listings counted falling while the price stays flat",
  "listings-up-flat": "listings counted rising while the price stays flat",
  "price-up-listings-up": "price and listings counted both rising",
  "price-down-listings-down": "price and listings counted both falling",
  "group-together": "group moving together",
  breakaway: "card moving apart from its set",
  "release-window": "release-window move",
  "year-ago": "same-date-last-year move",
};

const CAP = { "pattern-forming": 3, "pattern-ending": 2, "listings-vs-price": 2, "past-cases": 2 };

export function scannerCopyOk(text) {
  const s = String(text || "");
  return publicCopyOk(s) && !BUNDLE_BAN.test(s) && !FILLER_BAN.test(s) && !/\bpeers?\b/i.test(s);
}

function fullDate(iso, asOf) {
  const label = dateLabel(iso, asOf);
  return label.includes(String(iso).slice(0, 4)) ? label : `${label}, ${iso.slice(0, 4)}`;
}

function signed(n) {
  const body = round1(Math.abs(n));
  const text = Number.isInteger(body) ? String(body) : body.toFixed(1);
  if (n > 0) return `+${text}%`;
  if (n < 0) return `-${text}%`;
  return "0%";
}

function kindFor(row) {
  if (/listings|price-up-listings|price-down-listings/.test(row.pattern)) return "listings-vs-price";
  if (row.stage === "ending") return "pattern-ending";
  return "pattern-forming";
}

function stageWord(stage) {
  if (stage === "ending") return "ending";
  if (stage === "confirmed") return "confirmed";
  return "forming";
}

export function buildScannerReads(present, gates, asOf) {
  const rows = [];
  for (const row of present || []) {
    if (row.privateOnly || row.explore || row.candidate) continue;
    if (row.startSrc === "fill" || row.endSrc === "fill") continue;
    const gate = gateFor(gates, row.pattern, row.stage, row.kind);
    if (!gate) continue;
    const read = oneRead(row, gate, asOf);
    if (read) rows.push(read);
  }
  const past = pastReads(gates, present, asOf);
  const all = [...rows, ...past];
  const kept = [];
  const used = new Map();
  const sorted = all.slice().sort((a, b) => (b.receipt?.gate?.rate || b.receipt?.rate || 0) - (a.receipt?.gate?.rate || a.receipt?.rate || 0) || (b.strength || 0) - (a.strength || 0) || (a.id < b.id ? -1 : 1));
  for (const read of sorted) {
    const n = used.get(read.readKind) || 0;
    if (n >= CAP[read.readKind]) continue;
    if (kept.some((row) => row.headline === read.headline)) continue;
    if (kept.some((row) => row.readKind === read.readKind && row.receipt?.pattern === read.receipt?.pattern && row.receipt?.stage === read.receipt?.stage)) continue;
    used.set(read.readKind, n + 1);
    kept.push(read);
  }
  return kept.sort((a, b) => (a.id < b.id ? -1 : 1));
}

function oneRead(row, gate, asOf) {
  const label = LABEL[row.pattern] || row.pattern;
  const readKind = kindFor(row);
  const pct = row.metrics?.pct;
  if (!gate.from || !gate.to) return null;
  if (row.metrics?.groupType === "artist") return null;
  if (row.kind !== "group" && row.pattern !== "flat-range" && !(Math.abs(pct) >= 3)) return null;
  if (row.kind !== "group" && !(row.p1 >= 5) && row.pattern !== "flat-range") return null;
  if (row.kind !== "group" && !(row.p0 > 0) && !row.metrics?.priceStart) return null;
  const p0 = row.p0 || row.metrics?.priceStart;
  const p1 = row.p1 || row.metrics?.priceEnd;
  const past = `Past cases like this moved a median ${signed(gate.medianPct)} over ${gate.horizon} days, n=${gate.n}. Cases run from ${fullDate(gate.from, asOf)} to ${fullDate(gate.to, asOf)}.`;
  let headline = "";
  const lines = [];
  if (row.kind === "group") {
    const noun = row.metrics?.noun === "sealed" ? "priced sealed items" : "priced cards";
    const who = row.metrics?.groupType === "era" ? `${row.name} era` : row.metrics?.groupType === "pokemon" ? `${row.name} cards` : row.name;
    headline = `${who}: ${row.metrics.up} of ${row.metrics.n} ${noun} were up and ${row.metrics.down} were down, ${fullDate(row.start, asOf)} to ${fullDate(row.end, asOf)}. Median ${signed(row.metrics.pct)}.`;
    lines.push(`Up ${row.metrics.up}, down ${row.metrics.down}, of ${row.metrics.n} ${noun}.`);
    lines.push(`Median move ${signed(row.metrics.pct)}.`);
    lines.push(past);
  } else if (readKind === "listings-vs-price") {
    const fromN = row.metrics.listingsFrom;
    const toN = row.metrics.listingsTo;
    const ld0 = row.metrics.listingsStart;
    const ld1 = row.metrics.listingsEnd;
    if (fromN == null || toN == null || !ld0 || !ld1 || !(p0 > 0) || !(p1 > 0)) return null;
    headline = `${row.name}: listings counted ${fromN} on ${fullDate(ld0, asOf)} to ${toN} on ${fullDate(ld1, asOf)} (${signed(row.metrics.listingsPct)}), price ${money(p0)} on ${fullDate(row.start, asOf)} to ${money(p1)} on ${fullDate(row.end, asOf)} (${signed(pct)}).`;
    lines.push(`Listings counted ${fromN} on ${ld0}. Listings counted ${toN} on ${ld1}.`);
    lines.push(`Price ${money(p0)} on ${row.start}. Price ${money(p1)} on ${row.end}.`);
    lines.push(`The ${label} is ${stageWord(row.stage)}.`);
    lines.push(past);
  } else if (row.pattern === "breakaway") {
    headline = `${row.name} is ${stageWord(row.stage)} apart from its set: ${money(p0)} on ${fullDate(row.start, asOf)} to ${money(p1)} on ${fullDate(row.end, asOf)} (${signed(pct)}). Set median ${signed(row.metrics.medianPct)} on ${row.metrics.n} priced cards.`;
    lines.push(`${money(p0)} on ${row.start}. ${money(p1)} on ${row.end}.`);
    lines.push(`Set median ${signed(row.metrics.medianPct)} across ${row.metrics.n} priced cards.`);
    lines.push(past);
  } else {
    if (!(p0 > 0) || !(p1 > 0)) return null;
    const shown = round1(((p1 - p0) / p0) * 100);
    const peak = row.metrics?.peak;
    const peakDate = row.metrics?.peakDate;
    if (peak > 0 && peakDate && peakDate !== row.start && peakDate !== row.end) {
      const up = row.metrics.spikePct;
      const back = round1(((p1 - peak) / peak) * 100);
      headline = `${row.name}: a ${label} is ${stageWord(row.stage)}, ${money(p0)} on ${fullDate(row.start, asOf)} to ${money(peak)} on ${fullDate(peakDate, asOf)} (${signed(up)}), then ${money(p1)} on ${fullDate(row.end, asOf)} (${signed(back)}).`;
      lines.push(`${money(p0)} on ${row.start}. ${money(peak)} on ${peakDate}. ${money(p1)} on ${row.end}.`);
      lines.push(`The rise was ${signed(up)}. The move after that high was ${signed(back)}.`);
      lines.push(past);
    } else {
      headline = `${row.name}: a ${label} is ${stageWord(row.stage)}, ${money(p0)} on ${fullDate(row.start, asOf)} to ${money(p1)} on ${fullDate(row.end, asOf)} (${signed(shown)}).`;
      lines.push(`${money(p0)} on ${row.start}. ${money(p1)} on ${row.end}. ${signed(shown)}.`);
      lines.push(`Stage ${stageWord(row.stage)} on ${fullDate(row.date || row.end, asOf)}.`);
      lines.push(past);
    }
  }
  const source = `TCGplayer market, ${row.start} to ${row.end}`;
  const why = `Own TCGplayer market points only. This pattern passed the gate at n=${gate.n} on the ${gate.horizon}-day check. A hit is a later move of at least 3% that also beats the market median. Fill points are not used in this line.`;
  const bits = [headline, source, why, ...lines];
  if (bits.some((s) => !scannerCopyOk(s))) return null;
  if (row.kind === "single" && bits.some((s) => /\b(sealed|booster|elite trainer box|\betb\b)/i.test(s))) return null;
  const href = row.kind === "group" ? (row.href || "") : (row.href || (row.kind === "sealed" ? `/p/${row.id}` : `/c/${row.id}`));
  return {
    id: `scan-${readKind}-${row.pattern}-${String(row.id)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90),
    sku: row.kind === "group" ? "" : row.id,
    href,
    readKind,
    kind: readKind,
    deep: readKind,
    board: "v3",
    family: readKind,
    name: row.name,
    set: row.set || "",
    headline,
    path: headline,
    lines: lines.slice(0, 6),
    asOf,
    source,
    why,
    price: p1 || null,
    startDate: row.start,
    endDate: row.end,
    strength: row.strength || 0,
    chart: p0 > 0 && p1 > 0 ? { label: "Own prices, $", points: [[row.start, p0], [row.end, p1]] } : undefined,
    receipt: { pattern: row.pattern, stage: row.stage, gate: { n: gate.n, horizon: gate.horizon, rate: gate.rate, baseRate: gate.baseRate }, own: true },
  };
}

function pastReads(gates, present, asOf) {
  const openBest = new Map();
  for (const row of present || []) {
    if (row.privateOnly || row.explore || row.candidate) continue;
    if (row.startSrc === "fill" || row.endSrc === "fill") continue;
    if (row.metrics?.groupType === "artist") continue;
    if (!(row.p1 >= 5) || !(row.p0 > 0)) continue;
    const key = `${row.pattern}|${row.stage}|${row.kind}`;
    const prev = openBest.get(key);
    if (!prev || (row.strength || 0) > (prev.strength || 0) || ((row.strength || 0) === (prev.strength || 0) && String(row.id) < String(prev.id))) openBest.set(key, row);
  }
  const buckets = new Map();
  for (const gate of gates || []) {
    if (!gate.passed || gate.medianPct == null || !gate.from || !gate.to) continue;
    if (!gate.examples?.some((ex) => ex.p0 > 0 && ex.p1 > 0)) continue;
    if (String(gate.pattern).includes("+")) continue;
    const key = `${gate.pattern}|${gate.stage}|${gate.kind}`;
    const rank = gate.horizon === 30 ? 0 : gate.horizon === 7 ? 1 : 2;
    const cur = buckets.get(key);
    const curRank = cur ? (cur.horizon === 30 ? 0 : cur.horizon === 7 ? 1 : 2) : 9;
    if (!cur || rank < curRank) buckets.set(key, gate);
  }
  const passed = [...buckets.values()].sort((a, b) => (b.decayedRate - a.decayedRate) || (b.n - a.n) || (a.pattern < b.pattern ? -1 : 1));
  const out = [];
  for (const gate of passed) {
    const label = LABEL[gate.pattern] || gate.pattern;
    const noun = gate.kind === "sealed" ? "sealed items" : gate.kind === "group" ? "groups" : "singles";
    const headline = `Past cases like this moved a median ${signed(gate.medianPct)} over ${gate.horizon} days, n=${gate.n}. ${label} on ${noun}, from ${fullDate(gate.from, asOf)} to ${fullDate(gate.to, asOf)}.`;
    const lines = gate.examples.filter((ex) => ex.p0 > 0 && ex.p1 > 0).slice(0, 3).map((ex) => `${ex.name}: ${money(ex.p0)} on ${fullDate(ex.from, asOf)} to ${money(ex.p1)} on ${fullDate(ex.to, asOf)} (${signed(ex.pct)}).`);
    lines.push(`Hit rate ${gate.rate}% after decay. Base rate ${gate.baseRate}%. A hit is a later move of at least 3% that also beats the market median.`);
    const current = openBest.get(`${gate.pattern}|${gate.stage}|${gate.kind}`);
    if (current?.name && current.p0 > 0 && current.p1 > 0) {
      lines.push(`Open now: ${current.name}, ${money(current.p0)} on ${fullDate(current.start, asOf)} to ${money(current.p1)} on ${fullDate(current.end, asOf)}.`);
    }
    const source = `TCGplayer market, ${gate.from} to ${gate.to}`;
    const why = `These are closed own-day cases for this pattern and stage. The line states the past median only. It does not name a future price.`;
    const slice = lines.slice(0, 6);
    if (!slice.length || [headline, source, why, ...slice].some((s) => !scannerCopyOk(s))) continue;
    if (slice.length < 3) continue;
    out.push({
      id: `scan-past-cases-${gate.pattern}-${gate.stage}-${gate.kind}-${gate.horizon}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90),
      sku: "",
      href: "",
      readKind: "past-cases",
      kind: "past-cases",
      deep: "past-cases",
      board: "v3",
      family: "past-cases",
      name: label,
      set: "",
      headline,
      path: headline,
      lines: slice,
      asOf,
      source,
      why,
      startDate: gate.from,
      endDate: gate.to,
      strength: gate.rate,
      receipt: { pattern: gate.pattern, stage: gate.stage, kind: gate.kind, n: gate.n, horizon: gate.horizon, medianPct: gate.medianPct, rate: gate.rate },
    });
  }
  return out;
}
