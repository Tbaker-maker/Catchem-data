// Nightly read selection. Numbers come from files already on disk.
// Ranked kinds keep their order. Other kinds use a seeded shuffle.
// A card or product id shown in the last 5 days stays off.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { SHAPE_STATE_FILE } from "./shape-facts.mjs";
import { monthDay, money } from "./outlier-dive-reads.mjs";
import { seededShuffle } from "./extra-reads.mjs";
import { fullWindow, shiftDay } from "./tcgplayer-volume.mjs";
import { listingChangeRead } from "./product-dives.mjs";

export const COOLDOWN_DAYS = 5;
export const ROTATION_FILE = "research/assets/public/feed/rotation.json";
export const TYPE_CAP = 2;

export const QUIET_TAIL = "That is not a scarcity claim.";
export const MIX_CLAUSE = "This is the mix of copies that sold, not the copy in your hand.";
export const PAIR_CLAUSE = "Two condition prices. Not a grade result.";
export const MOVE_CLAUSE = "Sales and a price change in the same window. Not a cause.";
export const SHARE_CLAUSE = "Share of copies sold. Not share of dollars.";
export const SPREAD_CLAUSE = "Asking prices from the search. Not sold prices.";
export const ASK_CLAUSE = "The ask changed. The market price did not. Asks are not sales.";
export const MKT_CLAUSE = "The market price changed. The ask did not. Asks are not sales.";
export const STILL_CLAUSE = "Asks and listing count. Not sales.";

export const RANKED_KINDS = new Set(["setshare", "spread"]);
export const KIND_ORDER = ["quiet", "mix", "conditions", "solddown", "setshare", "spread", "askmove", "mktmove", "listing"];
export const EMPTY_COPY = {
  quiet: "No quiet Near Mint window is on file.",
  mix: "No condition mix is on file.",
  conditions: "No pair of condition prices is on file.",
  soldflat: "No flat-price sales window is on file.",
  solddown: "No falling-price sales window is on file.",
  setshare: "No set share is on file.",
  spread: "No asking spread is on file.",
  askmove: "No ask move with a still market price is on file.",
  mktmove: "No market move with a still ask is on file.",
  still: "No unchanged ask is on file.",
  listing: "No 7-night Browse total is on file.",
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function quietClause(days) {
  return `No TCGplayer sales recorded in ${days} days. ${QUIET_TAIL}`;
}

function phraseIndex(seedText, n) {
  let seed = 2166136261;
  const text = String(seedText || "");
  for (let i = 0; i < text.length; i += 1) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return (seed >>> 0) % n;
}

function pickPhrase(phrases, seedText) {
  return phrases[phraseIndex(seedText, phrases.length)];
}

function displayName(item) {
  const name = String(item?.name || "").trim();
  const num = String(item?.number || "").trim();
  if (num && name.endsWith(` - ${num}`)) return name.slice(0, -(num.length + 3)).trim();
  return name;
}

function copiesSold(n) {
  return `${n} Near Mint ${n === 1 ? "copy" : "copies"} sold`;
}

function range(from, to) {
  const a = monthDay(from);
  const b = monthDay(to);
  return a && b ? `${a}–${b}` : "";
}

function baseRead(kind, item, path, asOf) {
  const name = displayName(item);
  if (!name || !path) return null;
  return {
    id: `${kind}-${item.id}`,
    sku: item.id,
    readKind: kind,
    kind,
    name,
    set: item.set || "",
    path,
    headline: path,
    why: path,
    asOf,
    href: item.kind === "sealed" ? `/p/${encodeURIComponent(item.id)}` : `/c/${encodeURIComponent(item.id)}`,
    lane: item.kind === "sealed" ? "sealed" : "single",
  };
}

function finishRead(row, clause) {
  if (!row || !clause) return null;
  const signal = String(row.path || "").replace(/\s+/g, " ").trim();
  if (!signal || signal.includes(clause)) return null;
  row.path = signal;
  row.headline = signal;
  row.why = `${signal} ${clause}`;
  return row;
}

export function quietRead(fact, item, asOf) {
  const q = fact?.quiet;
  if (!q || !Number.isInteger(q.days) || !(q.price >= 5) || !range(q.from, q.to)) return null;
  const name = displayName(item);
  const price = money(q.price);
  const when = range(q.from, q.to);
  if (!name || !price) return null;
  const signalBit = `No TCGplayer sales recorded in ${q.days} days.`;
  const phrases = [
    `${name}: ${signalBit} The Near Mint market price stayed ${price} over ${when}.`,
    `${signalBit} ${name} stayed ${price} in Near Mint over ${when}.`,
    `${name} in Near Mint stayed ${price} over ${when}. ${signalBit}`,
  ];
  const path = pickPhrase(phrases, `${asOf}|quiet|${item.id}`);
  const row = baseRead("quiet", item, path, q.to);
  if (!row || !row.path.includes(signalBit)) return null;
  row.receipt = { days: q.days, price: q.price, from: q.from, to: q.to, printing: fact.printing };
  return finishRead(row, QUIET_TAIL);
}

export function mixRead(fact, item, asOf) {
  const mix = fact?.mix;
  if (!mix || !Array.isArray(mix.conditions) || mix.conditions.length < 2) return null;
  const when = range(mix.from, mix.to);
  const name = displayName(item);
  if (!when || !name) return null;
  const bits = mix.conditions.map((row) => `${row.sold} ${row.condition}`);
  if (bits.some((bit) => !/^\d+ /.test(bit))) return null;
  const sold = mix.conditions.reduce((sum, row) => sum + Number(row.sold), 0);
  if (!Number.isInteger(sold) || sold < 10) return null;
  const list = bits.join(", ");
  const phrases = [
    `${name}, ${when}: ${list}.`,
    `${list} for ${name} over ${when}.`,
    `${name}: ${list} over ${when}.`,
  ];
  const path = pickPhrase(phrases, `${asOf}|mix|${item.id}`);
  const row = baseRead("mix", item, path, mix.to);
  if (!row) return null;
  row.receipt = { from: mix.from, to: mix.to, conditions: mix.conditions, printing: fact.printing };
  return finishRead(row, MIX_CLAUSE);
}

export function pairRead(fact, item, asOf) {
  const pair = fact?.pair;
  if (!pair || !monthDay(pair.date)) return null;
  const nm = money(pair.nearMint);
  const played = money(pair.played);
  const name = displayName(item);
  if (!nm || !played || !name || !pair.playedCondition) return null;
  const when = monthDay(pair.date);
  const phrases = [
    `${name} on ${when}: Near Mint ${nm}, ${pair.playedCondition} ${played}.`,
    `Near Mint ${nm} and ${pair.playedCondition} ${played} for ${name} on ${when}.`,
    `${name}: Near Mint ${nm}. ${pair.playedCondition} ${played}. ${when}.`,
  ];
  const path = pickPhrase(phrases, `${asOf}|conditions|${item.id}`);
  const row = baseRead("conditions", item, path, pair.date);
  if (!row) return null;
  row.receipt = { date: pair.date, nearMint: pair.nearMint, played: pair.played, playedCondition: pair.playedCondition };
  return finishRead(row, PAIR_CLAUSE);
}

export function flatRead(fact, item, asOf) {
  const flat = fact?.flat;
  if (!flat || !Number.isInteger(flat.sold) || flat.sold <= 0 || !range(flat.from, flat.to)) return null;
  const name = displayName(item);
  const price = money(flat.price);
  const when = range(flat.from, flat.to);
  if (!name || !price) return null;
  const phrases = [
    `${name}: ${copiesSold(flat.sold)} over ${when} and the market price stayed ${price}.`,
    `${copiesSold(flat.sold)}, and ${name} stayed ${price} over ${when}.`,
    `${name} stayed ${price} over ${when}, with ${copiesSold(flat.sold)}.`,
  ];
  const path = pickPhrase(phrases, `${asOf}|soldflat|${item.id}`);
  const row = baseRead("soldflat", item, path, flat.to);
  if (!row || row.path.includes(MOVE_CLAUSE)) return null;
  row.receipt = { days: flat.days, sold: flat.sold, price: flat.price, from: flat.from, to: flat.to };
  return finishRead(row, "The market price did not move. Not a cause.");
}

export function fellRead(fact, item, asOf) {
  const fell = fact?.fell;
  if (!fell || !Number.isInteger(fell.sold) || fell.sold <= 0) return null;
  const name = displayName(item);
  const fromPrice = money(fell.fromPrice);
  const toPrice = money(fell.toPrice);
  const when = range(fell.from, fell.to);
  if (!name || !fromPrice || !toPrice || !when || !(fell.toPrice < fell.fromPrice)) return null;
  const phrases = [
    `${name}: ${copiesSold(fell.sold)} over ${when} and the market price went from ${fromPrice} to ${toPrice}.`,
    `${copiesSold(fell.sold)} while ${name} went from ${fromPrice} to ${toPrice} over ${when}.`,
    `${name} went from ${fromPrice} to ${toPrice} over ${when}, with ${copiesSold(fell.sold)}.`,
  ];
  const path = pickPhrase(phrases, `${asOf}|solddown|${item.id}`);
  const row = baseRead("solddown", item, path, fell.to);
  if (!row) return null;
  row.receipt = { days: fell.days, sold: fell.sold, fromPrice: fell.fromPrice, toPrice: fell.toPrice, from: fell.from, to: fell.to };
  return finishRead(row, MOVE_CLAUSE);
}

function sameWindow(rows) {
  const from = rows[0]?.window7d?.from;
  const to = rows[0]?.window7d?.to;
  if (!DAY.test(String(from || "")) || !DAY.test(String(to || ""))) return null;
  if (!rows.every((row) => row.window7d?.from === from && row.window7d?.to === to)) return null;
  return { from, to };
}

/** Share of one set's Near Mint 7-day sales that went to its top card. Incomplete sets stay off. */
export function setShareReads(volumeDoc, items) {
  const cards = volumeDoc?.cards || {};
  const byGroup = new Map();
  for (const item of items || []) {
    if (!item || item.kind !== "single" || item.groupId == null) continue;
    const key = String(item.groupId);
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(item);
  }
  const out = [];
  for (const [groupId, members] of byGroup) {
    if (members.length < 2) continue;
    const setName = members[0].set || "";
    if (!setName || members.some((item) => item.set !== setName)) continue;
    const rows = [];
    for (const item of members) {
      const row = cards[item.id];
      if (!row || row.id !== item.id) continue;
      if (Number(row.tcgplayerProductId) !== Number(item.tcgplayerProductId)) continue;
      if (!fullWindow(row, 7) || !Number.isInteger(row.sold7d) || row.sold7d < 0) continue;
      rows.push({ item, row });
    }
    if (rows.length !== members.length) continue;
    const window = sameWindow(rows.map((pair) => pair.row));
    if (!window) continue;
    const total = rows.reduce((sum, pair) => sum + pair.row.sold7d, 0);
    if (total <= 0) continue;
    rows.sort((a, b) => b.row.sold7d - a.row.sold7d || (a.item.id < b.item.id ? -1 : 1));
    const top = rows[0];
    if (top.row.sold7d <= 0) continue;
    const name = displayName(top.item);
    const when = range(window.from, window.to);
    if (!name || !when) continue;
    const phrases = [
      `${name} is ${top.row.sold7d} of ${total} Near Mint copies sold in ${setName} over ${when}.`,
      `${setName}, ${when}: ${name} accounts for ${top.row.sold7d} of ${total} Near Mint copies sold.`,
      `${top.row.sold7d} of ${total} Near Mint copies sold in ${setName} over ${when} are ${name}.`,
    ];
    const path = pickPhrase(phrases, `${window.to}|setshare|${groupId}`);
    if (!path || path.includes(SHARE_CLAUSE) || !path.includes(String(top.row.sold7d)) || !path.includes(String(total))) continue;
    out.push({
      id: `setshare-${groupId}-${window.to}`,
      sku: top.item.id,
      readKind: "setshare",
      kind: "setshare",
      name,
      set: setName,
      path,
      headline: path,
      why: `${path} ${SHARE_CLAUSE}`,
      asOf: window.to,
      href: `/c/${encodeURIComponent(top.item.id)}`,
      lane: "single",
      rank: top.row.sold7d / total,
      receipt: { groupId, top: top.row.sold7d, total, from: window.from, to: window.to, cards: rows.length },
    });
  }
  out.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));
  return out;
}

// Robust range (2026-10-10). The fetch writes askP10/askP90/askMedian after
// dropping asks over 2x or under 0.5x the median; at least SPREAD_MIN asks.
// An older row without those fields ships only when its raw low and high
// already sit inside 0.5x to 2x of the median (the median is shown either way).
export const SPREAD_MIN = 5;
export function spreadRange(product) {
  const p10 = Number(product?.askP10);
  const p90 = Number(product?.askP90);
  const mid = Number(product?.askMedian);
  const n = Number(product?.askRobustCount);
  if (p10 > 0 && p90 > p10 && mid > 0 && n >= SPREAD_MIN) return { low: p10, high: p90, median: mid, count: n, basis: "p10-p90" };
  if (product && "askRobustCount" in product) return null;
  const low = Number(product?.priceLow);
  const high = Number(product?.priceHigh);
  const median = Number(product?.priceMedian);
  const count = Number(product?.listingCount);
  if (!(low > 0) || !(high > low) || !(median > 0) || !(count >= SPREAD_MIN)) return null;
  if (high >= median * 2 || low < median * 0.5) return null;
  return { low, high, median, count, basis: "min-max" };
}

export function spreadRead(product) {
  const range = spreadRange(product);
  const name = String(product?.name || "").trim();
  const day = String(product?.lastSeen || "").slice(0, 10);
  if (product?.dataStatus !== "live" || !name || !range || !DAY.test(day)) return null;
  const { low, high, median, count } = range;
  const a = money(low);
  const b = money(high);
  const m = money(median);
  if (!a || !b || !m) return null;
  const tail = ` Median ask ${m} across ${count} eBay listings on ${day}.`;
  const phrases = [
    `${name}: asking prices in the search run from ${a} to ${b}.${tail}`,
    `The search for ${name} asks from ${a} to ${b}.${tail}`,
    `${name} asks run from ${a} up to ${b}.${tail}`,
  ];
  const path = pickPhrase(phrases, `${day}|spread|${product.id}`);
  if (!path || path.includes(SPREAD_CLAUSE)) return null;
  return {
    id: `spread-${product.id}`,
    sku: product.id,
    readKind: "spread",
    kind: "spread",
    name,
    set: product.set || "",
    path,
    headline: path,
    why: `${path} ${SPREAD_CLAUSE}`,
    asOf: day,
    href: `/p/${encodeURIComponent(product.id)}`,
    lane: "sealed",
    rank: high - low,
    receipt: { low, high, median, count, basis: range.basis },
  };
}

function byDate(rows, id) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row || row.id !== id) continue;
    const day = String(row.date || "").slice(0, 10);
    if (!DAY.test(day)) continue;
    if (map.has(day)) return null;
    map.set(day, row);
  }
  return map;
}

function marketByDate(points) {
  const map = new Map();
  for (const point of points || []) {
    const day = String(point?.date || "").slice(0, 10);
    if (!DAY.test(day)) continue;
    if (map.has(day)) return null;
    const price = Number(point.market);
    if (!(price > 0)) continue;
    map.set(day, price);
  }
  return map;
}

/** Last two shared dates. Ask from heat-history, market from the TCGplayer file, same product id. */
export function gapRead(productId, heatRows, marketDoc, mappingRow) {
  if (!productId || !marketDoc || marketDoc.id !== productId) return null;
  if (!mappingRow || mappingRow.id !== productId) return null;
  if (Number(mappingRow.tcgplayerProductId) !== Number(marketDoc.tcgplayerProductId)) return null;
  const heat = byDate(heatRows, productId);
  const markets = marketByDate(marketDoc.points);
  if (!heat || !markets) return null;
  const shared = [...heat.keys()].filter((day) => markets.has(day)).sort();
  if (shared.length < 2) return null;
  const from = shared[shared.length - 2];
  const to = shared[shared.length - 1];
  const askFrom = Number(heat.get(from).price);
  const askTo = Number(heat.get(to).price);
  const mktFrom = markets.get(from);
  const mktTo = markets.get(to);
  if (!(askFrom > 0) || !(askTo > 0) || !(mktFrom > 0) || !(mktTo > 0)) return null;
  const name = String(marketDoc.name || heat.get(to).name || productId).trim();
  const when = range(from, to);
  if (!name || !when) return null;
  const askMoved = Math.round(askFrom * 100) !== Math.round(askTo * 100);
  const mktMoved = Math.round(mktFrom * 100) !== Math.round(mktTo * 100);
  if (askMoved === mktMoved) return null;
  const askA = money(askFrom);
  const askB = money(askTo);
  const mktA = money(mktFrom);
  const mktB = money(mktTo);
  if (!askA || !askB || !mktA || !mktB) return null;
  if (askMoved && !mktMoved) {
    const phrases = [
      `${name}: the eBay ask went from ${askA} to ${askB} over ${when}. The TCGplayer market price stayed ${mktA}.`,
      `The eBay ask for ${name} went from ${askA} to ${askB} over ${when}. The TCGplayer market price stayed ${mktA}.`,
      `${name} over ${when}: eBay ask ${askA} to ${askB}, TCGplayer market price ${mktA}.`,
    ];
    const path = pickPhrase(phrases, `${to}|askmove|${productId}`);
    if (!path || path.includes(ASK_CLAUSE)) return null;
    return {
      id: `askmove-${productId}`,
      sku: productId,
      readKind: "askmove",
      kind: "askmove",
      name,
      set: "",
      path,
      headline: path,
      why: `${path} ${ASK_CLAUSE}`,
      asOf: to,
      href: `/p/${encodeURIComponent(productId)}`,
      lane: "sealed",
      receipt: { from, to, askFrom, askTo, market: mktFrom },
    };
  }
  const phrases = [
    `${name}: the TCGplayer market price went from ${mktA} to ${mktB} over ${when}. The eBay ask stayed ${askA}.`,
    `The TCGplayer market price for ${name} went from ${mktA} to ${mktB} over ${when}. The eBay ask stayed ${askA}.`,
    `${name} over ${when}: TCGplayer market price ${mktA} to ${mktB}, eBay ask ${askA}.`,
  ];
  const path = pickPhrase(phrases, `${to}|mktmove|${productId}`);
  if (!path || path.includes(MKT_CLAUSE)) return null;
  return {
    id: `mktmove-${productId}`,
    sku: productId,
    readKind: "mktmove",
    kind: "mktmove",
    name,
    set: "",
    path,
    headline: path,
    why: `${path} ${MKT_CLAUSE}`,
    asOf: to,
    href: `/p/${encodeURIComponent(productId)}`,
    lane: "sealed",
    receipt: { from, to, marketFrom: mktFrom, marketTo: mktTo, ask: askFrom },
  };
}

export function stillRead(productId, heatRows, name, setName) {
  const heat = byDate(heatRows, productId);
  if (!heat) return null;
  const days = [...heat.keys()].sort();
  if (days.length < 2) return null;
  const from = days[days.length - 2];
  const to = days[days.length - 1];
  const a = heat.get(from);
  const b = heat.get(to);
  const priceA = Number(a.price);
  const priceB = Number(b.price);
  if (!(priceA > 0) || Math.round(priceA * 100) !== Math.round(priceB * 100)) return null;
  if (!Number.isInteger(a.listingCount) || a.listingCount < 0 || a.listingCount !== b.listingCount) return null;
  const label = String(name || "").trim();
  const price = money(priceA);
  const when = range(from, to);
  if (!label || !price || !when) return null;
  const phrases = [
    `${label}: the ask stayed ${price} and the listing count stayed ${a.listingCount} over ${when}.`,
    `${label} over ${when}: ask ${price}, listing count ${a.listingCount}.`,
    `The ask for ${label} stayed ${price} over ${when}. The listing count stayed ${a.listingCount}.`,
  ];
  const path = pickPhrase(phrases, `${to}|still|${productId}`);
  if (!path || path.includes(STILL_CLAUSE)) return null;
  return {
    id: `still-${productId}`,
    sku: productId,
    readKind: "still",
    kind: "still",
    name: label,
    set: setName || "",
    path,
    headline: path,
    why: `${path} ${STILL_CLAUSE}`,
    asOf: to,
    href: `/p/${encodeURIComponent(productId)}`,
    lane: "sealed",
    receipt: { from, to, price: priceA, listingCount: a.listingCount },
  };
}

export function singleCandidates(facts, items, asOf) {
  const byId = new Map((items || []).filter((item) => item && item.kind === "single").map((item) => [item.id, item]));
  const out = [];
  for (const fact of Object.values(facts || {})) {
    const item = byId.get(fact?.id);
    if (!item || Number(item.tcgplayerProductId) !== Number(fact.tcgplayerProductId)) continue;
    for (const read of [quietRead(fact, item, asOf), mixRead(fact, item, asOf), pairRead(fact, item, asOf), fellRead(fact, item, asOf)]) {
      if (read) out.push(read);
    }
  }
  return out;
}

export function cooledSet(state, asOf) {
  const blocked = new Set();
  if (!DAY.test(String(asOf || ""))) return blocked;
  for (const row of state?.shown || []) {
    const id = String(row?.id || "");
    const on = String(row?.on || "");
    if (!id || !DAY.test(on)) continue;
    if (asOf < shiftDay(on, COOLDOWN_DAYS)) blocked.add(id);
  }
  return blocked;
}

export function rememberShown(state, reads, asOf) {
  const shown = (state?.shown || []).filter((row) => row && DAY.test(String(row.on || "")) && shiftDay(asOf, -14) <= row.on);
  const seen = new Set(shown.map((row) => `${row.id}|${row.on}`));
  for (const read of reads || []) {
    const id = String(read?.sku || read?.id || "");
    if (!id || seen.has(`${id}|${asOf}`)) continue;
    seen.add(`${id}|${asOf}`);
    shown.push({ id, on: asOf, kind: read.readKind || "" });
  }
  shown.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : a.id < b.id ? -1 : 1));
  return { asOf, days: COOLDOWN_DAYS, shown };
}

/**
 * Cap each kind. Ranked kinds keep their incoming order. Others shuffle by date.
 * One sku per night. Cards shown inside the cooldown stay off.
 */
export function pickNight(candidates, state, asOf) {
  const blocked = cooledSet(state, asOf);
  const groups = new Map(KIND_ORDER.map((kind) => [kind, []]));
  for (const row of candidates || []) {
    if (!row || !groups.has(row.readKind) || !row.sku || blocked.has(row.sku)) continue;
    groups.get(row.readKind).push(row);
  }
  for (const [kind, rows] of groups) {
    if (RANKED_KINDS.has(kind)) continue;
    const shuffled = seededShuffle(rows.map((row) => row.id), `${asOf}|${kind}`);
    const order = new Map(shuffled.map((id, i) => [id, i]));
    rows.sort((a, b) => order.get(a.id) - order.get(b.id));
  }
  const picked = [];
  const used = new Set();
  let moved = true;
  while (moved) {
    moved = false;
    for (const kind of KIND_ORDER) {
      const have = picked.filter((row) => row.readKind === kind).length;
      if (have >= TYPE_CAP) continue;
      const rows = groups.get(kind);
      while (rows.length) {
        const row = rows.shift();
        if (used.has(row.sku)) continue;
        used.add(row.sku);
        picked.push(row);
        moved = true;
        break;
      }
    }
  }
  const byKind = {};
  for (const kind of KIND_ORDER) {
    const items = picked.filter((row) => row.readKind === kind);
    if (!items.length) continue;
    byKind[kind] = { order: RANKED_KINDS.has(kind) ? "ranked" : "shuffled", items, empty: EMPTY_COPY[kind] };
  }
  return { reads: picked, byKind, state: rememberShown(state, picked, asOf) };
}

export async function loadRotation(root) {
  try {
    return JSON.parse(await readFile(join(root, ROTATION_FILE), "utf8"));
  } catch {
    return { asOf: "", days: COOLDOWN_DAYS, shown: [] };
  }
}

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

/** Candidates from private facts, the private volume table, and sealed files. Missing files add nothing. */
export async function loadShapeCandidates(root, asOf) {
  const catalog = (await readJson(join(root, "data/catalog/tcgcsv-latest.json"), { items: [] })).items || [];
  const facts = (await readJson(join(root, SHAPE_STATE_FILE), { cards: {} })).cards || {};
  const volume = await readJson(join(root, "ppt-raw-private/tcgplayer-volume.json"), null);
  const out = singleCandidates(facts, catalog, asOf);
  if (volume) out.push(...setShareReads(volume, catalog));
  const products = Object.values((await readJson(join(root, "data/sealed-prices.json"), { products: {} })).products || {});
  const heat = await readJson(join(root, "data/heat-history.json"), []);
  const mapping = (await readJson(join(root, "data/history/tcgplayer-market/mapping.json"), { entries: [] })).entries || [];
  const mapById = new Map(mapping.filter((row) => row && row.id).map((row) => [row.id, row]));
  const heatById = new Map();
  for (const row of Array.isArray(heat) ? heat : []) {
    if (!row?.id) continue;
    if (!heatById.has(row.id)) heatById.set(row.id, []);
    heatById.get(row.id).push(row);
  }
  const spreads = [];
  for (const product of products) {
    const spread = spreadRead(product);
    if (spread) spreads.push(spread);
    const listing = listingChangeRead(product);
    if (listing) out.push(listing);
  }
  spreads.sort((a, b) => b.rank - a.rank || (a.id < b.id ? -1 : 1));
  out.push(...spreads);
  let names = [];
  try {
    names = (await readdir(join(root, "data/history/tcgplayer-market"))).filter((name) => name.endsWith(".json") && name !== "mapping.json" && name !== "coverage.json");
  } catch { /* no market history */ }
  for (const name of names) {
    const doc = await readJson(join(root, "data/history/tcgplayer-market", name), null);
    const read = gapRead(doc?.id, heatById.get(doc?.id) || [], doc, mapById.get(doc?.id));
    if (read) out.push(read);
  }
  return out;
}
