// The Feed catalogue. One read per honest window. No 12 cap.
import { appendFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  BANNED, BAD_DATE, chartSeries, composeLead, directionAgrees, endStreak, feedWindow, FILLER_BAN, fourGrams, isThinSeries, money, pathAlt, pathSentence, pickLead, pretty, readCopy, separateHalfCopies, slug, statesBothMoves, windowBounds,
} from "./public-bundle.mjs";
import { appendLearningLog, readCallLog } from "./learning-log.mjs";
import { interleavePokemonFacts, loadPokemonIndex } from "./fact-reads.mjs";

const JUNK = /set of \d|costco|sam'?s club|dollar general|walmart|walgreens|\(lgs\)/i;

function spark(points, max = 20) {
  const pts = chartSeries(points);
  if (pts.length <= max) return pts;
  const out = [];
  const step = (pts.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) out.push(pts[Math.round(i * step)]);
  const last = pts[pts.length - 1];
  if (out[out.length - 1][0] !== last[0]) out[out.length - 1] = last;
  return out;
}

function orderLead(rows) {
  const ranked = [...rows].sort((a, b) => Number(a.thin) - Number(b.thin) || (b.score || 0) - (a.score || 0) || String(a.name).localeCompare(String(b.name)));
  const lead = [];
  const held = [];
  const sets = new Map();
  for (const row of ranked) {
    const setName = row.set || "";
    if (lead.length < 10 && (sets.get(setName) || 0) >= 2) {
      held.push(row);
      continue;
    }
    if (lead.length < 10) {
      lead.push(row);
      sets.set(setName, (sets.get(setName) || 0) + 1);
    } else held.push(row);
  }
  held.sort((a, b) => Number(a.thin) - Number(b.thin) || (b.score || 0) - (a.score || 0) || String(a.name).localeCompare(String(b.name)));
  return lead.concat(held);
}

const SHAPE_MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

export function sentenceShape(text, card) {
  let s = String(text || "");
  if (card && typeof card === "object") {
    for (const part of [card.name, card.set]) {
      const name = String(part || "").trim();
      if (name.length >= 3) s = s.split(name).join(" ");
    }
  }
  return s
    .replace(/\$[0-9,.]+/g, "$")
    .replace(new RegExp(`\\b(?:${SHAPE_MONTHS})\\s+\\d{1,2}\\b`, "g"), "DATE")
    .replace(/\b\d+(?:\.\d+)?\s*%/g, "PCT")
    .replace(/\b\d+(?:\.\d+)?\b/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

export function sealedKindOf(card) {
  const sub = String(card?.subtype || card?.sealedKind || "").toLowerCase();
  const name = String(card?.name || "").toLowerCase();
  if (sub === "box" || sub === "booster-box" || /\bbooster box\b/.test(name)) return "box";
  if (sub === "etb" || sub === "pc-etb" || /elite trainer/.test(name) || /\betb\b/.test(name)) return "etb";
  if (sub === "bundle" || sub === "booster-bundle" || /\bbundle\b/.test(name)) return "bundle";
  if (sub === "pack" || sub === "booster-pack" || /\bpacks?\b/.test(name)) return "pack";
  return card?.kind === "sealed" ? "other" : "";
}

function rankInWindow(a, b) {
  return Number(a.thin) - Number(b.thin)
    || Math.abs(Number(b.changePct) || 0) - Math.abs(Number(a.changePct) || 0)
    || String(a.name).localeCompare(String(b.name));
}

function orderPool(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const w = Number(row.windowDays);
    if (!groups.has(w)) groups.set(w, []);
    groups.get(w).push(row);
  }
  for (const list of groups.values()) list.sort(rankInWindow);
  const windows = [...groups.keys()].sort((a, b) => rankInWindow(groups.get(a)[0], groups.get(b)[0]));
  const out = [];
  for (const w of windows) out.push(...groups.get(w));
  return out;
}

function orderSealed(rows) {
  const pool = orderPool(rows);
  const buckets = new Map();
  for (const row of pool) {
    const kind = sealedKindOf(row);
    if (!buckets.has(kind)) buckets.set(kind, []);
    buckets.get(kind).push(row);
  }
  const seeded = [];
  for (const kind of ["box", "etb", "bundle", "pack"]) {
    const list = buckets.get(kind);
    if (list?.length) seeded.push(list.shift());
  }
  const rest = [];
  for (const list of buckets.values()) rest.push(...list);
  return seeded.concat(rest);
}

// One window per product, the largest absolute move. Sealed and singles are
// ranked in their own pools, then interleaved. A window can take at most 12
// of the 24. A shared shape is dropped for the next qualifier.
export function selectLead(cards, limit = 24) {
  const bySku = new Map();
  for (const card of cards || []) {
    if (!card?.sku || !String(card.sku).startsWith("tcgcsv-")) continue;
    if (card.kind !== "sealed" && card.kind !== "single") continue;
    if (card.ambiguousCopy) continue;
    const abs = Math.abs(Number(card.changePct) || 0);
    const prev = bySku.get(card.sku);
    const prevAbs = prev ? Math.abs(Number(prev.changePct) || 0) : -1;
    if (!prev || abs > prevAbs || (abs === prevAbs && Number(card.windowDays) > Number(prev.windowDays))) bySku.set(card.sku, card);
  }
  const rows = [...bySku.values()];
  const sealedRows = rows.filter((row) => row.kind === "sealed");
  const singleRows = rows.filter((row) => row.kind !== "sealed");
  const sealedOrder = orderSealed(sealedRows);
  const singleOrder = orderPool(singleRows);
  const kindCount = new Set(sealedOrder.map((row) => sealedKindOf(row)).filter((kind) => kind && kind !== "other")).size;
  const sealedTarget = sealedOrder.length >= 6 ? Math.max(6, kindCount) : sealedOrder.length;
  const chosen = [];
  const shapes = new Set();
  const grams = new Map();
  const rewrites = [];
  const windows = { 7: 0, 30: 0, 90: 0 };
  const sets = new Map();
  const pointers = { sealed: 0, single: 0 };
  const queues = { sealed: sealedOrder, single: singleOrder };
  const waiting = { sealed: [], single: [] };
  let sealedKept = 0;

  function runOf(kind) {
    let n = 0;
    for (let i = chosen.length - 1; i >= 0; i -= 1) {
      if (chosen[i].kind !== kind) break;
      n += 1;
    }
    return n;
  }
  function leadShape(text, card) {
    return sentenceShape(text, card)
      .replace(/,?\s*while the n-day window\b.*/i, "")
      .replace(/moved less on the latest step than on the step before it\b.*/i, "moved less on the latest step than on the step before it")
      .replace(/\bthat price\b/gi, "$")
      .replace(/\bthat day\b/gi, "DATE")
      .replace(/\b(rose|fell|eased|above|higher|lower|highs|lows|high|low)\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/[.]+$/g, "")
      .trim();
  }
  function gramBag(text, card) {
    const local = new Map();
    for (const gram of fourGrams(sentenceShape(text, card))) local.set(gram, (local.get(gram) || 0) + 1);
    return local;
  }
  function shapeIndex(text, card) {
    const key = leadShape(text, card);
    if (!key) return -1;
    return chosen.findIndex((row) => leadShape(row.path, row) === key);
  }
  function gramsOk(card, text, ignore) {
    const local = gramBag(text, card);
    const drop = ignore ? gramBag(ignore.path, ignore) : new Map();
    for (const [gram, n] of local) {
      if ((grams.get(gram) || 0) - (drop.get(gram) || 0) + n > 2) return false;
    }
    return true;
  }
  function usable(card, text) {
    if (!text || BANNED.test(text) || BAD_DATE.test(text)) return false;
    const index = shapeIndex(text, card);
    const replace = index >= 0 && statesBothMoves(text) && !statesBothMoves(chosen[index].path);
    if (index >= 0 && !replace) return false;
    return gramsOk(card, text, replace ? chosen[index] : null);
  }
  function resolve(card) {
    const failed = String(card.path || "").trim();
    const altOpts = { ...(card._pathOpts || {}), name: card.name, set: card.set, listings: card.listings, listingsAsOf: card.listingsAsOf, sold: card._sold || null, sealedKind: card.sealedKind || sealedKindOf(card) };
    const accept = (text, factId) => {
      if (!text || FILLER_BAN.test(text) || !directionAgrees(text)) return false;
      return usable(card, text);
    };
    let made = "";
    if ((card._raw || []).length >= 2) {
      const picked = pickLead(card._raw, altOpts, accept);
      if (picked) {
        made = picked.line;
        card.secondFact = picked.id;
      }
    } else if (accept(failed)) {
      made = failed;
    }
    if (failed && failed !== made) rewrites.push({ id: card.id || "", failed, next: made });
    if (!made) return "";
    card.path = made;
    return made;
  }
  function addCounts(card, index) {
    const w = Number(card.windowDays);
    windows[w] = (windows[w] || 0) + 1;
    shapes.add(leadShape(card.path, card));
    for (const gram of fourGrams(sentenceShape(card.path, card))) grams.set(gram, (grams.get(gram) || 0) + 1);
    if (index < 10) sets.set(card.set || "", (sets.get(card.set || "") || 0) + 1);
    if (card.kind === "sealed") sealedKept += 1;
  }
  function dropCounts(card, index) {
    const w = Number(card.windowDays);
    windows[w] = Math.max(0, (windows[w] || 0) - 1);
    for (const gram of fourGrams(sentenceShape(card.path, card))) {
      const next = (grams.get(gram) || 0) - 1;
      if (next > 0) grams.set(gram, next);
      else grams.delete(gram);
    }
    if (index < 10) sets.set(card.set || "", Math.max(0, (sets.get(card.set || "") || 0) - 1));
    if (card.kind === "sealed") sealedKept = Math.max(0, sealedKept - 1);
  }
  function remember(card) {
    addCounts(card, chosen.length);
    chosen.push(card);
  }
  function place(card) {
    const index = shapeIndex(card.path, card);
    if (index >= 0) {
      if (!(statesBothMoves(card.path) && !statesBothMoves(chosen[index].path))) return false;
      dropCounts(chosen[index], index);
      chosen[index] = card;
      addCounts(card, index);
      return true;
    }
    remember(card);
    return true;
  }
  function take(kind) {
    const queue = queues[kind];
    const hold = waiting[kind];
    if (kind === "sealed") {
      const have = new Set(chosen.filter((row) => row.kind === "sealed").map((row) => sealedKindOf(row)));
      const missing = ["box", "etb", "bundle", "pack"].find((name) => !have.has(name) && queue.some((row) => sealedKindOf(row) === name));
      if (missing) {
        let i = pointers[kind];
        while (i < queue.length) {
          if (sealedKindOf(queue[i]) !== missing) { i += 1; continue; }
          const w = Number(queue[i].windowDays);
          if ((windows[w] || 0) >= 12) { i += 1; continue; }
          const [card] = queue.splice(i, 1);
          const text = resolve(card);
          if (!text) continue;
          if (!place(card)) continue;
          return true;
        }
      }
    }
    const pending = [];
    if (chosen.length >= 10) pending.push(...hold.splice(0, hold.length));
    while (pointers[kind] < queue.length || pending.length) {
      const fromQueue = !pending.length;
      const card = pending.length ? pending.shift() : queue[pointers[kind]++];
      const w = Number(card.windowDays);
      if ((windows[w] || 0) >= 12) continue;
      if (kind === "single") {
        const need = Math.max(0, sealedTarget - sealedKept);
        const left = queues.sealed.slice(pointers.sealed).filter((row) => Number(row.windowDays) === w).length;
        if (need > 0 && left > 0 && (windows[w] || 0) + 1 > 12 - Math.min(need, left)) continue;
      }
      if (chosen.length < 10 && (sets.get(card.set || "") || 0) >= 2) {
        if (fromQueue) hold.push(card);
        else pending.push(card);
        if (!fromQueue && pending.length > hold.length + queue.length) break;
        continue;
      }
      const text = resolve(card);
      if (!text) continue;
      if (!place(card)) continue;
      return true;
    }
    return false;
  }
  function remaining(kind) {
    if (pointers[kind] < queues[kind].length) return true;
    if (chosen.length >= 10 && waiting[kind].length) return true;
    if (chosen.length < 10 && waiting[kind].some((card) => (windows[Number(card.windowDays)] || 0) < 12 && (sets.get(card.set || "") || 0) < 2)) return true;
    return false;
  }

  function takeDays(days) {
    for (const kind of ["single", "sealed"]) {
      const queue = queues[kind];
      let i = 0;
      while (i < queue.length) {
        if (Number(queue[i].windowDays) !== days) { i += 1; continue; }
        if ((windows[days] || 0) >= 12) return false;
        const [card] = queue.splice(i, 1);
        const text = resolve(card);
        if (!text) continue;
        if (!place(card)) continue;
        return true;
      }
    }
    return false;
  }
  let reserved = 0;
  while (reserved < 4 && chosen.length < limit) {
    if (!takeDays(7)) break;
    reserved += 1;
  }
  for (let seeded = 0; seeded < 4 && chosen.length < limit; seeded += 1) {
    if (!take("sealed")) break;
  }

  while (sealedKept < sealedTarget - 1 && chosen.length < limit) {
    if (!take("sealed")) break;
  }

  let guard = 0;
  while (chosen.length < limit && guard < 4000) {
    guard += 1;
    const slots = limit - chosen.length;
    const sealedLeft = Math.max(0, sealedTarget - sealedKept);
    const mustSealed = sealedLeft > 0 && slots <= sealedLeft;
    const last = chosen[chosen.length - 1];
    let want = "single";
    if (mustSealed) want = "sealed";
    else if (last && runOf(last.kind) >= 5 && remaining(last.kind === "sealed" ? "single" : "sealed")) want = last.kind === "sealed" ? "single" : "sealed";
    else if (sealedLeft > 0 && remaining("sealed") && (chosen.length === 0 || (chosen.length + 1) % 4 === 0)) want = "sealed";
    else if (!remaining("single") && remaining("sealed")) want = "sealed";
    if (!take(want)) {
      if (!take(want === "sealed" ? "single" : "sealed")) break;
    }
  }
  return { lead: chosen, rewrites };
}


async function appendPathRewrites(dir, day, rows) {
  if (!dir || !rows?.length) return;
  const name = /^\d{4}-\d{2}-\d{2}$/.test(String(day || "")) ? day : "undated";
  await mkdir(dir, { recursive: true });
  const file = join(dir, `${name}.jsonl`);
  let have = "";
  try { have = await readFile(file, "utf8"); } catch { have = ""; }
  const lines = [];
  for (const row of rows) {
    const line = JSON.stringify({ id: row.id, failed: row.failed, next: row.next });
    if (!have.includes(line)) lines.push(line);
  }
  if (lines.length) await appendFile(file, lines.join("\n") + "\n");
}

function readTypeFor(days) {
  if (days === 7) return "daily";
  if (days === 30) return "watch";
  return "cook";
}

// A 7-day move of 8% or more is a mover. A smaller 7-day move stays in Today.
// A 90-day move is a cook. The same read is never in two of those lists.
export const MOVER_PCT = 8;

export function assignSections(cards) {
  const lists = { today: [], watch: [], cook: [], up: [], down: [], heat: [], cool: [] };
  for (const card of Object.values(cards || {})) {
    if (!card?.id) continue;
    if (card.score == null) card.score = Math.abs(Number(card.changePct) || 0);
    const days = Number(card.windowDays);
    const abs = Math.abs(Number(card.changePct) || 0);
    if (days === 90) lists.cook.push(card);
    else if (days === 30) lists.watch.push(card);
    else if (days === 7 && abs >= MOVER_PCT) lists[card.direction === "down" ? "down" : "up"].push(card);
    else if (days === 7) lists.today.push(card);
    if (card.tempo === "heat" || card.tempo === "cool") lists[card.tempo].push(card);
  }
  const out = {};
  for (const [key, rows] of Object.entries(lists)) out[key] = orderLead(rows).map((row) => row.id);
  return out;
}

export function applyShelf(cards, shelfRows) {
  const latest = new Map();
  for (const row of shelfRows || []) {
    const sku = String(row?.sku_id || "");
    const n = Number(row?.listing_count);
    const date = String(row?.date || "");
    if (!sku.startsWith("tcgcsv-") || !(n >= 20) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const prev = latest.get(sku);
    if (!prev || date > prev.date) latest.set(sku, { n, date });
  }
  for (const card of Object.values(cards || {})) {
    const hit = latest.get(card?.sku);
    if (!hit) continue;
    card.listings = hit.n;
    card.listingsAsOf = hit.date;
  }
  return latest.size;
}

// A foreign host is not the catalogue. A set name is not an id.
export function applyImageGaps(cards, gapPids) {
  const gaps = new Set((gapPids || []).map(Number));
  const foreign = /tcgplayer-cdn\.tcgplayer\.com|images\.pokemontcg\.io|ebayimg|i\.ebayimg/i;
  let n = 0;
  for (const card of Object.values(cards || {})) {
    if (!card || typeof card !== "object") continue;
    const pid = Number(String(card.sku || "").replace(/^tcgcsv-/, ""));
    if ((gaps.has(pid) || foreign.test(String(card.image || ""))) && card.image) {
      card.image = "";
      n += 1;
    }
    if (foreign.test(String(card.logo || ""))) card.logo = "";
  }
  return n;
}

export function assembleCatalogue(items, prior = []) {
  const priorBySku = new Map();
  for (const row of prior || []) {
    if (!row?.sku_id) continue;
    if (!priorBySku.has(row.sku_id)) priorBySku.set(row.sku_id, row);
  }
  const headlines = new Set();
  const cards = {};
  const halfDropped = [];
  for (const item of items || []) {
    if (!item?.id || !String(item.id).startsWith("tcgcsv-")) continue;
    if (JUNK.test(item.name || "")) continue;
    const split = separateHalfCopies(item.hist || []);
    if (split.ambiguous) {
      halfDropped.push({ id: item.id, name: pretty(item.name), set: pretty(item.set), low: split.low, high: split.high, reason: "ambiguous" });
      continue;
    }
    if (split.dropped.length) {
      halfDropped.push({ id: item.id, name: pretty(item.name), set: pretty(item.set), low: split.low, high: split.high, reason: "cheap-copy", dropped: split.dropped.length });
    }
    const raw = split.keep;
    const windows = [7, 30, 90].map((days) => feedWindow(raw, days)).filter(Boolean);
    if (!windows.length) continue;
    const kind = item.kind === "sealed" ? "sealed" : "single";
    const thin = isThinSeries(raw, windows[0].toDate);
    const streak = endStreak(chartSeries(raw));
    const strongest = [...windows].sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || b.window - a.window)[0];
    const priorCall = priorBySku.get(item.id) || null;
    for (const move of windows) {
      const direction = move.pct > 0 ? "up" : "down";
      const draft = {
        id: `move-${item.id}-${move.window}`,
        type: "mover",
        kind,
        set: pretty(item.set),
        setSlug: item.setSlug || slug(item.set || ""),
        name: pretty(item.name),
        year: item.year || null,
        release: item.release || "",
        number: item.number || "",
        price: move.to,
        fromPrice: move.from,
        changePct: move.pct,
        windowDays: move.window,
        fromDate: move.fromDate,
        toDate: move.toDate,
        asOf: move.toDate,
        hist: raw,
        source: `TCGplayer market, ${move.toDate}`,
      };
      const copy = readCopy(draft, new Set());
      if (!copy.headline || !copy.why || BANNED.test(copy.headline) || BANNED.test(copy.why)) continue;
      if (headlines.has(copy.headline)) continue;
      headlines.add(copy.headline);
      const changes = { 7: null, 30: null, 90: null };
      for (const other of windows) changes[other.window] = other.pct;
      let flagged = null;
      if (priorCall && priorCall.printed_on && priorCall.printed_on < move.toDate && priorCall.price_source === "tcgplayer_market" && Number(priorCall.price_at_flag) > 0) {
        const at = Number(priorCall.price_at_flag);
        const now = move.to;
        const pct = Math.round(((now - at) / at) * 1000) / 10;
        flagged = { on: priorCall.printed_on, at, now, pct };
      } else {
        flagged = { on: move.toDate, at: move.to, first: true };
      }
      const card = {
        id: draft.id,
        sku: item.id,
        kind,
        set: draft.set,
        setSlug: draft.setSlug,
        name: draft.name,
        price: move.to,
        change7: changes[7],
        change30: changes[30],
        change90: changes[90],
        changePct: move.pct,
        windowDays: move.window,
        direction,
        thin,
        score: Math.round(Math.abs(move.pct) * 10) / 10,
        headline: copy.headline,
        why: copy.why,
        source: draft.source,
        asOf: move.toDate,
        href: item.href || (kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`),
        image: item.image && !/ebayimg|i\.ebayimg/i.test(item.image) ? item.image : "",
        hist: spark(raw),
        points: raw.length,
        flagged,
        pattern: `mover_${direction}_${move.window}d`,
        read_type: readTypeFor(move.window),
        path: "",
        subtype: item.subtype || "",
        sealedKind: sealedKindOf({ name: item.name, subtype: item.subtype, kind }),
        _bounds: windowBounds(raw, move.toDate),
        _raw: raw,
        _pathOpts: {
          direction,
          fromDate: move.fromDate,
          toDate: move.toDate,
          fromPrice: move.from,
          windowDays: move.window,
        },
      };
      const sentence = pathSentence(raw, {
        direction,
        fromDate: move.fromDate,
        toDate: move.toDate,
        fromPrice: move.from,
        windowDays: move.window,
        name: draft.name,
        sealedKind: card.sealedKind,
      });
      if (sentence && !BANNED.test(sentence)) card.path = sentence;
      cards[card.id] = card;
      if (move === strongest && streak.n >= 4 && streak.dir === Math.sign(move.pct)) {
        card.tempo = streak.dir > 0 ? "heat" : "cool";
      }
    }
  }
  disambiguatePaths(cards);
  const lists = assignSections(cards);
  return { cards, lists, halfDropped };
}

function disambiguatePaths(cards) {
  const groups = new Map();
  for (const card of Object.values(cards)) {
    const text = card.path || "";
    if (!text) continue;
    if (!groups.has(text)) groups.set(text, []);
    groups.get(text).push(card);
  }
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    for (const card of rows) {
      const tag = `${card.windowDays}-day ${card.sku}`;
      const withSet = `${card.path.replace(/\.$/, "")} (${card.set}, ${tag}).`;
      card.path = BANNED.test(withSet) ? `${card.path.replace(/\.$/, "")} (${tag}).` : withSet;
    }
  }
}

export function trackedRows(prior, priceBySku) {
  const out = [];
  for (const row of prior || []) {
    if (!row?.call_id || !String(row.sku_id || "").startsWith("tcgcsv-")) continue;
    if (row.price_source !== "tcgplayer_market") continue;
    const now = priceBySku.get(row.sku_id);
    const at = Number(row.price_at_flag);
    if (!(at > 0) || !(now > 0)) continue;
    const pct = Math.round(((now - at) / at) * 1000) / 10;
    out.push({
      call_id: row.call_id,
      sku: row.sku_id,
      claim: row.claim,
      printed_on: row.printed_on,
      direction: row.direction,
      price_at_flag: at,
      price_now: now,
      pct,
      price_source: "tcgplayer_market",
      price_as_of: row.price_as_of,
      gradeable: row.gradeable === true,
    });
  }
  return out;
}

export async function publishFeed({ items, prior, prices, asOf, updatedAt, outDir, logFile, shelf, gapPids = [], rewriteDir = "", soldBySku = null, root = "" }) {
  const { cards, lists, halfDropped = [] } = assembleCatalogue(items, prior);
  applyShelf(cards, shelf);
  const soldMap = soldBySku instanceof Map ? soldBySku : new Map();
  for (const card of Object.values(cards)) {
    const sold = soldMap.get(card.sku) || null;
    card._sold = sold && Number.isInteger(sold.count) ? sold : null;
    const listings = Number.isInteger(card.listings) && card.listings >= 20 ? card.listings : null;
    const sentence = pathSentence(card._raw || [], {
      ...(card._pathOpts || {}),
      name: card.name,
      sealedKind: card.sealedKind,
      listings,
      listingsAsOf: card.listingsAsOf || "",
      sold: card._sold,
    });
    if (sentence && !BANNED.test(sentence)) card.path = sentence;
  }
  disambiguatePaths(cards);
  applyImageGaps(cards, gapPids);
  const facts = {};
  for (const card of Object.values(cards)) {
    const bounds = card._bounds || {};
    delete card._bounds;
    const row = {
      price: card.price,
      asOf: card.asOf,
      change7: card.change7,
      change30: card.change30,
      change90: card.change90,
      high: bounds.high ?? null,
      highOn: bounds.highOn || "",
      low: bounds.low ?? null,
      lowOn: bounds.lowOn || "",
      daysSinceHigh: Number.isFinite(bounds.daysSinceHigh) ? bounds.daysSinceHigh : null,
      listings: card.listings ?? null,
      listingsAsOf: card.listingsAsOf || "",
      flagged: card.flagged || null,
    };
    const prev = facts[card.sku];
    if (!prev || card.windowDays === 30) {
      if (prev?.listings >= 20 && !(row.listings >= 20)) {
        row.listings = prev.listings;
        row.listingsAsOf = prev.listingsAsOf;
      }
      if (prev?.flagged && !prev.flagged.first && row.flagged?.first) row.flagged = prev.flagged;
      facts[card.sku] = row;
    } else if (row.listings >= 20) {
      prev.listings = row.listings;
      prev.listingsAsOf = row.listingsAsOf;
    }
  }
  const priceBySku = prices || new Map(items.map((item) => [item.id, Number(item.price)]));
  const freshIds = new Set(Object.values(cards).map((card) => `${card.asOf}_${card.sku}_${card.pattern}`));
  const tracked = trackedRows(prior, priceBySku).filter((row) => !freshIds.has(row.call_id));
  const sets = new Map();
  for (const card of Object.values(cards)) sets.set(card.set, (sets.get(card.set) || 0) + 1);
  const catalogue = {
    asOf: asOf || "",
    updatedAt: updatedAt || null,
    source: "TCGplayer market",
    count: Object.keys(cards).length,
    sets: [...sets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, n })),
    cards,
    today: lists.today,
    watch: lists.watch,
    cook: lists.cook,
    up: lists.up,
    down: lists.down,
    heat: lists.heat,
    cool: lists.cool,
    tracked,
  };
  const logReads = Object.values(cards).map((card) => ({
    id: card.id,
    href: card.href,
    type: "mover",
    kind: card.kind,
    headline: card.headline,
    claim: card.headline,
    pattern: card.pattern,
    read_type: card.read_type,
    direction: card.direction,
    price: card.price,
    source: "TCGplayer market",
    asOf: card.asOf,
    changePct: card.changePct,
    hist: Array.from({ length: card.points || 0 }, () => ["x", 1]),
  }));
  const picked = selectLead(Object.values(cards));
  if (rewriteDir) {
    await appendPathRewrites(rewriteDir, asOf, picked.rewrites);
    const halfDir = join(dirname(rewriteDir), "half-copies");
    await mkdir(halfDir, { recursive: true });
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) ? asOf : "undated";
    const excluded = halfDropped.filter((row) => row.reason === "ambiguous");
    const cheap = halfDropped.filter((row) => row.reason === "cheap-copy");
    await writeFile(join(halfDir, `${day}.json`), JSON.stringify({ excluded: excluded.length, cheapCopies: cheap.length, rows: halfDropped }, null, 1) + "\n");
  }
  for (const card of Object.values(cards)) {
    delete card.pattern;
    delete card.read_type;
    delete card.points;
    delete card.score;
    delete card.tempo;
    delete card.subtype;
    delete card.sealedKind;
    delete card._sold;
    delete card._raw;
    delete card._pathOpts;
  }
  const pageSize = 24;
  async function clearJson(dir) {
    try {
      const names = await readdir(dir);
      await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => unlink(join(dir, name))));
    } catch { /* first publish */ }
  }
  for (const key of Object.keys(lists)) {
    const ids = lists[key];
    const pages = Math.max(1, Math.ceil(ids.length / pageSize));
    await mkdir(join(outDir, "feed", key), { recursive: true });
    await clearJson(join(outDir, "feed", key));
    for (let n = 0; n < pages; n += 1) {
      const slice = ids.slice(n * pageSize, (n + 1) * pageSize).map((id) => cards[id]);
      await writeFile(join(outDir, "feed", key, `${n}.json`), JSON.stringify(slice));
    }
  }
  await mkdir(join(outDir, "feed", "tracked"), { recursive: true });
  await clearJson(join(outDir, "feed", "tracked"));
  const trackedPages = Math.max(1, Math.ceil(tracked.length / pageSize));
  for (let n = 0; n < trackedPages; n += 1) {
    await writeFile(join(outDir, "feed", "tracked", `${n}.json`), JSON.stringify(tracked.slice(n * pageSize, (n + 1) * pageSize)));
  }
  await writeFile(join(outDir, "feed", "meta.json"), JSON.stringify({
    asOf: catalogue.asOf,
    updatedAt: catalogue.updatedAt,
    source: catalogue.source,
    count: catalogue.count,
    pageSize,
    sections: {
      today: lists.today.length,
      watch: lists.watch.length,
      cook: lists.cook.length,
      up: lists.up.length,
      down: lists.down.length,
      heat: lists.heat.length,
      cool: lists.cool.length,
      tracked: tracked.length,
    },
    sets: catalogue.sets,
  }));
  await writeFile(join(outDir, "feed", "catalogue.json"), JSON.stringify(catalogue));
  const lookup = {};
  for (const part of ["today", "watch", "cook", "up", "down", "heat", "cool"]) {
    (lists[part] || []).forEach((id, index) => {
      if (!lookup[id]) lookup[id] = [part, Math.floor(index / pageSize)];
    });
  }
  tracked.forEach((row, index) => {
    if (row?.call_id && !lookup[row.call_id]) lookup[row.call_id] = ["tracked", Math.floor(index / pageSize)];
  });
  await writeFile(join(outDir, "feed", "lookup.json"), JSON.stringify(lookup));
  await writeFile(join(outDir, "feed", "facts.json"), JSON.stringify(facts));
  const priceLead = picked.lead.map((row) => ({ ...row, readKind: "price" }));
  let pokemonIndex = null;
  if (root) {
    try { pokemonIndex = await loadPokemonIndex(root); } catch { pokemonIndex = null; }
  }
  const lead = pokemonIndex ? interleavePokemonFacts(priceLead, pokemonIndex) : priceLead;
  await writeFile(join(outDir, "reads.json"), JSON.stringify({
    asOf: catalogue.asOf,
    updatedAt: catalogue.updatedAt,
    source: "TCGplayer market",
    count: catalogue.count,
    catalogue: "feed/catalogue.json",
    filterField: "readKind",
    reads: lead,
  }, null, 1) + "\n");
  const logged = logFile ? await appendLearningLog(logFile, { asOf, updatedAt, reads: logReads }) : { added: 0, total: 0, skipped: [] };
  return { count: catalogue.count, sections: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])), tracked: tracked.length, logged, halfExcluded: halfDropped.filter((row) => row.reason === "ambiguous").length, halfCheap: halfDropped.filter((row) => row.reason === "cheap-copy").length, lead: lead.length, pullLines: lead.filter((row) => row.readKind === "pull").length, pokemonLines: lead.filter((row) => row.readKind === "pokemon").length };
}

export async function readShelfFile(file) {
  if (!file) return [];
  try {
    const text = await readFile(file, "utf8");
    const rows = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      rows.push(JSON.parse(line));
    }
    return rows;
  } catch {
    return [];
  }
}

export { orderLead, readCallLog };
