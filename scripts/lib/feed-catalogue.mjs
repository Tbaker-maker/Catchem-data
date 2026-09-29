// The Feed catalogue. One read per honest window. No 12 cap.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  BANNED, chartSeries, endStreak, feedWindow, isThinSeries, money, pretty, readCopy, slug,
} from "./public-bundle.mjs";
import { appendLearningLog, readCallLog } from "./learning-log.mjs";

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

// Product photos that 403 stay blank. The set logo is not a substitute printing.
export function applyImageGaps(cards, gapPids, logoBySet = new Map()) {
  const gaps = new Set((gapPids || []).map(Number));
  const logoOf = (setName) => (logoBySet && typeof logoBySet.get === "function" ? logoBySet.get(setName) : logoBySet?.[setName]) || "";
  let n = 0;
  for (const card of Object.values(cards || {})) {
    if (!card?.sku || (!("image" in card) && !card.name)) continue;
    const pid = Number(String(card.sku).slice("tcgcsv-".length));
    if (gaps.has(pid)) {
      card.image = "";
      n += 1;
    }
    if (!card.image) {
      const logo = card.logo || logoOf(card.set);
      if (logo) card.logo = logo;
    }
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
  for (const item of items || []) {
    if (!item?.id || !String(item.id).startsWith("tcgcsv-")) continue;
    if (JUNK.test(item.name || "")) continue;
    const raw = item.hist || [];
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
      };
      cards[card.id] = card;
      if (move === strongest && streak.n >= 4 && streak.dir === Math.sign(move.pct)) {
        card.tempo = streak.dir > 0 ? "heat" : "cool";
      }
    }
  }
  const lists = assignSections(cards);
  return { cards, lists };
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

export async function publishFeed({ items, prior, prices, asOf, updatedAt, outDir, logFile, shelf, gapPids = [] }) {
  const { cards, lists } = assembleCatalogue(items, prior);
  applyShelf(cards, shelf);
  let logoByName = new Map();
  try {
    const setsDoc = JSON.parse(await readFile(join(outDir, "sets.json"), "utf8"));
    for (const set of setsDoc.sets || []) {
      if (set?.name && set.logo) logoByName.set(set.name, set.logo);
    }
  } catch { /* a missing set list leaves the logo blank */ }
  applyImageGaps(cards, gapPids, logoByName);
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
    sets: [...sets.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, n]) => {
      const logo = logoByName.get(name) || "";
      return logo ? { name, n, logo } : { name, n };
    }),
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
  for (const card of Object.values(cards)) {
    delete card.pattern;
    delete card.read_type;
    delete card.points;
    delete card.score;
    delete card.tempo;
  }
  const pageSize = 24;
  for (const key of Object.keys(lists)) {
    const ids = lists[key];
    const pages = Math.max(1, Math.ceil(ids.length / pageSize));
    for (let n = 0; n < pages; n += 1) {
      const slice = ids.slice(n * pageSize, (n + 1) * pageSize).map((id) => cards[id]);
      await mkdir(join(outDir, "feed", key), { recursive: true });
      await writeFile(join(outDir, "feed", key, `${n}.json`), JSON.stringify(slice));
    }
  }
  await mkdir(join(outDir, "feed", "tracked"), { recursive: true });
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
  const lead = lists.today.slice(0, 24).map((id) => cards[id]);
  await writeFile(join(outDir, "reads.json"), JSON.stringify({
    asOf: catalogue.asOf,
    updatedAt: catalogue.updatedAt,
    source: "TCGplayer market",
    count: catalogue.count,
    catalogue: "feed/catalogue.json",
    reads: lead,
  }, null, 1) + "\n");
  const logged = logFile ? await appendLearningLog(logFile, { asOf, updatedAt, reads: logReads }) : { added: 0, total: 0, skipped: [] };
  return { count: catalogue.count, sections: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])), tracked: tracked.length, logged };
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
