// Writes public signal chips. Rules come from catchem-data-private.
// The public file has the chip words and the as-of date only.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import { readSignals } from "./lib/signal-chips.mjs";
import { dropHeldChips, loadHeldIds, mentionsHeld } from "./lib/price-hold-skip.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PUBLIC = join(ROOT, "research/assets/public");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

async function loadRules() {
  const direct = process.env.SIGNAL_RULES || "";
  if (direct) {
    const doc = await readJson(direct);
    if (!doc) throw new Error("signal rules file was not readable");
    const extra = process.env.SIGNAL_STRENGTH ? await readJson(process.env.SIGNAL_STRENGTH) : null;
    if (extra) doc.strength = extra;
    return doc;
  }
  const store = await openPrivate({ root: ROOT, token: process.env.PRIVATE_DATA_TOKEN || "" });
  try {
    const doc = await readJson(join(store.dir, "signal-chips/thresholds.json"));
    if (!doc) {
      console.log("signal chips: rules file is not in the private store, so no chips were written");
      return null;
    }
    const extra = await readJson(join(store.dir, "signal-chips/strength.json"));
    if (extra) doc.strength = extra;
    return doc;
  } finally {
    if (store.remote) await store.close(["signal-chips/thresholds.json", "signal-chips/strength.json"], "signal chip rules");
  }
}

function skuOf(read) {
  const sku = String(read?.sku || "");
  if (/^tcgcsv-\d+$/.test(sku)) return sku;
  const href = String(read?.href || "");
  const fromHref = href.match(/\/(?:c|p)\/(tcgcsv-\d+)/);
  if (fromHref) return fromHref[1];
  const fromId = String(read?.id || "").match(/(tcgcsv-\d+)/);
  return fromId ? fromId[1] : "";
}

function parseSpark(packed, asOf) {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(end) || !packed) return [];
  const out = [];
  for (const bit of String(packed).split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const off = Number(m[1]);
    const price = Number(m[2]);
    if (off < 0 || off > 120 || !(price > 0)) continue;
    out.push([new Date(end - off * 86400000).toISOString().slice(0, 10), price]);
  }
  return out;
}

function parseHist(packed) {
  const epoch = Date.parse("1970-01-01T00:00:00Z");
  const out = [];
  for (const bit of String(packed || "").split(",")) {
    const m = bit.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const price = Number(m[2]);
    if (!(price > 0)) continue;
    out.push([new Date(epoch + Number(m[1]) * 86400000).toISOString().slice(0, 10), price]);
  }
  return out;
}

async function indexPacked(dir, wanted, parse) {
  const hit = new Map();
  let names = [];
  try { names = await readdir(dir); } catch { return hit; }
  for (const name of names) {
    if (!name.endsWith(".json") || name === "summary.json") continue;
    if (hit.size >= wanted.size) break;
    const doc = await readJson(join(dir, name));
    const rows = doc?.rows;
    if (!rows || typeof rows !== "object") continue;
    for (const id of wanted) {
      if (hit.has(id) || rows[id] == null) continue;
      hit.set(id, parse(rows[id]));
    }
  }
  return hit;
}

export const FEED_PARTS = Object.freeze(["today", "up", "down", "watch", "cook", "cool", "heat"]);

// A published dollar still gets tiles. The hold list only blocks a row whose
// page is still "Price being checked", so a priced vintage mover is not left blank.
export function stampSkipped(read, holds) {
  const sku = skuOf(read);
  const blocked = mentionsHeld(read, holds) || (sku && holds.has(sku));
  if (!blocked) return false;
  const price = Number(read?.price);
  const checking = /price being checked/i.test(String(read?.headline || ""));
  return !(price > 0) || checking;
}

async function feedReads(root) {
  const out = [];
  for (const part of FEED_PARTS) {
    const dir = join(root, "research/assets/public/feed", part);
    let names = [];
    try { names = await readdir(dir); } catch { continue; }
    for (const name of names.filter((n) => n.endsWith(".json")).sort()) {
      const doc = await readJson(join(dir, name));
      const rows = Array.isArray(doc) ? doc : (Array.isArray(doc?.reads) ? doc.reads : []);
      for (const row of rows) if (row && row.id) out.push(row);
    }
  }
  return out;
}

// How many prices are on file and since when. Counts only.
function priceCounts(older, spark, asOf) {
  const dates = new Set();
  for (const p of older || []) dates.add(p[0]);
  for (const p of spark || []) dates.add(p[0]);
  if (!dates.size) return null;
  const sorted = [...dates].sort();
  const cut = new Date(Date.parse(`${String(asOf).slice(0, 10)}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  return { prices: sorted.length, recent: sorted.filter((d) => d >= cut).length, since: sorted[0] };
}

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function listingsFor(read, byId, byName) {
  const keys = [read?.sku, skuOf(read), String(read?.href || "").split("/").pop()];
  for (const key of keys) {
    if (key && byId.has(key)) return byId.get(key);
  }
  const name = norm(read?.name);
  return name && byName.has(name) ? byName.get(name) : null;
}

function setFor(read, sets) {
  const slug = String(read?.setSlug || read?.receipt?.slug || "").toLowerCase();
  const name = norm(read?.set || read?.name);
  return sets.find((row) => (slug && row.slug === slug) || (name && norm(row.name) === name)) || null;
}

function monthsUntil(status, asOf) {
  const m = String(status || "").match(/([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
  const idx = months[m[1].toLowerCase()];
  if (idx == null) return null;
  const when = Date.UTC(Number(m[3]), idx, Number(m[2]));
  const now = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(when) || !Number.isFinite(now) || when <= now) return null;
  return (when - now) / (86400000 * 30.44);
}

export async function stampSignalChips({ root = ROOT, rules, writeReads = false } = {}) {
  const readsPath = join(root, "research/assets/public/reads.json");
  const bundle = await readJson(readsPath);
  const reads = Array.isArray(bundle?.reads) ? bundle.reads : [];
  if (!rules || !reads.length) return { count: 0, wrote: false };
  const asOf = String(bundle.asOf || reads.find((row) => row?.asOf)?.asOf || "").slice(0, 10);
  const holdDoc = await readJson(join(root, "research/assets/public/price-hold.json"));
  const holds = new Set(Object.keys(holdDoc?.ids || {}));
  const listed = await readJson(join(root, "research/assets/public/listings-counted.json"));
  const sealed = await readJson(join(root, "data/sealed-prices.json"));
  const byId = new Map();
  const byName = new Map();
  const put = (id, name, item) => {
    if (id) byId.set(id, item);
    const key = norm(name);
    if (key) byName.set(key, item);
  };
  for (const row of listed?.products || []) {
    const box = row?.listingsCounted || {};
    const prev = box.prev || {};
    put(row.id, row.name, { n: box.n, prev: prev.n, prevDate: prev.date || "", date: box.date || listed.asOf || "" });
  }
  // Top 2 seller share of every sealed product on its latest night, grouped by
  // kind and era, so a product is judged against similar products.
  const peerKey = (product) => `${product?.subtype || ""}|${product?.vintage ? "v" : "m"}`;
  const shareOf = (point) => {
    const two = Number(point?.top2Share);
    if (Number.isFinite(two) && two >= 0 && two <= 1) return two;
    const one = Number(point?.topShare);
    return Number.isFinite(one) && one >= 0 && one <= 1 ? one : null;
  };
  const peerShares = new Map();
  for (const product of sealed?.products || []) {
    const hist = product?.priceHistory || [];
    const share = shareOf(hist[hist.length - 1]);
    if (share == null) continue;
    const key = peerKey(product);
    if (!peerShares.has(key)) peerShares.set(key, []);
    peerShares.get(key).push({ id: product.id, share });
  }
  for (const product of sealed?.products || []) {
    const series = [];
    for (const point of product?.priceHistory || []) {
      if (!point || !/^\d{4}-\d{2}-\d{2}$/.test(String(point.date || "").slice(0, 10))) continue;
      if (!Number.isInteger(point.filteredTotal) || point.filteredTotal < 0) continue;
      series.push({ date: String(point.date).slice(0, 10), n: point.filteredTotal });
    }
    if (!series.length) continue;
    const last = series[series.length - 1];
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const night = (product.priceHistory || [])[product.priceHistory.length - 1] || {};
    const item = byId.get(product.id) || { n: last.n, prev: prev ? prev.n : null, prevDate: prev ? prev.date : "", date: last.date };
    item.series = series;
    item.nights = [];
    item.prices = [];
    for (const point of product.priceHistory || []) {
      const date = String(point?.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (Number(point.price) > 0) item.prices.push([date, Number(point.price)]);
      const share = shareOf(point);
      if (share != null && Number.isInteger(point.sellers) && Number.isInteger(point.filteredTotal)) {
        item.nights.push({ date, n: point.filteredTotal, sellers: point.sellers, share });
      }
    }
    item.peers = (peerShares.get(peerKey(product)) || []).filter((row) => row.id !== product.id).map((row) => row.share);
    if (Number.isInteger(night.sellers) && night.sellers >= 0) item.sellers = night.sellers;
    if (Number.isFinite(Number(night.topShare)) && Number(night.topShare) >= 0 && Number(night.topShare) <= 1) item.topShare = Number(night.topShare);
    put(product.id, product.name || "", item);
  }
  const setsDoc = await readJson(join(root, "research/assets/public/sets.json"));
  const sets = Array.isArray(setsDoc?.sets) ? setsDoc.sets : [];
  const rotDoc = await readJson(join(root, "research/assets/public/rotation-status.json"));
  const rotBy = new Map((rotDoc?.sets || []).map((row) => [row.slug, row]));
  const feedRows = await feedReads(root);
  const skus = new Set([...reads, ...feedRows].map(skuOf).filter(Boolean));
  const sparks = await indexPacked(join(root, "research/assets/public/sparks"), skus, (packed) => parseSpark(packed, asOf));
  const hist = await indexPacked(join(root, "research/assets/public/hist-long"), skus, parseHist);

  const byRead = {};
  const bySku = {};
  let count = 0;
  let feedCount = 0;
  const build = (read) => {
    const sku = skuOf(read);
    if (stampSkipped(read, holds)) return null;
    const set = setFor(read, sets);
    const rot = set ? rotBy.get(set.slug) : null;
    const spark = sparks.get(sku);
    const older = hist.get(sku);
    const points = (older && older.length > (spark?.length || 0)) ? older : (spark || older || []);
    const promo = (read.tags || []).includes("Promo") || /promo/i.test(String(read.set || "")) || /promo/i.test(String(set?.name || ""));
    const built = readSignals(read, {
      asOf: read.asOf || asOf,
      points,
      daily: spark || [],
      counts: priceCounts(older, spark, read.asOf || asOf),
      listings: listingsFor(read, byId, byName),
      held: stampSkipped(read, holds),
      release: set?.release || "",
      cardRelease: String(read.release || read.receipt?.release || "").slice(0, 10),
      promo,
      art: read.art || "",
      rotationMonths: monthsUntil(rot?.status, read.asOf || asOf),
    }, rules);
    if (!built.signals.length && !built.tiles) return null;
    const entry = { name: read.name || "", sku, signals: built.signals, blurb: built.blurb || "" };
    if (built.tiles) entry.tiles = built.tiles;
    if (built.strength) entry.strength = built.strength;
    return { sku, entry, built };
  };
  // bySku points at a byId key, so each entry is written once.
  const keep = (read, sku, entry) => {
    byRead[read.id] = entry;
    const lead = entry.signals.some((chip) => chip.kind === "listings");
    for (const key of [sku, String(read.href || "").split("/").pop()]) {
      if (!key || key === read.id) continue;
      const prev = bySku[key] ? byRead[bySku[key]] : null;
      if (!prev || (lead && !(prev.signals || []).some((chip) => chip.kind === "listings"))) bySku[key] = read.id;
    }
  };
  for (const read of reads) {
    if (!read || !read.id) continue;
    const made = build(read);
    if (!made || !made.built.signals.length) {
      delete read.signals;
      delete read.blurb;
      if (made?.built?.tiles) read.tiles = made.built.tiles;
      else delete read.tiles;
      if (made) keep(read, made.sku, made.entry);
      continue;
    }
    const { sku, entry, built } = made;
    keep(read, sku, entry);
    read.signals = built.signals;
    if (built.blurb) read.blurb = built.blurb;
    else delete read.blurb;
    if (built.strength) read.strength = built.strength;
    else delete read.strength;
    if (built.tiles) read.tiles = built.tiles;
    else delete read.tiles;
    count += 1;
  }
  // Feed rows (today, up, down, watch, cook, cool, heat) get the same chips and tiles,
  // keyed by id and sku. The feed files themselves are not rewritten.
  for (const read of feedRows) {
    if (!read || !read.id || byRead[read.id]) continue;
    const made = build(read);
    if (!made) continue;
    keep(read, made.sku, made.entry);
    feedCount += 1;
  }
  const samples = [];
  const take = (pred) => {
    for (const read of reads) {
      const row = byRead[read.id];
      if (!row || samples.some((item) => item.id === read.id)) continue;
      if (!pred(row, read)) continue;
      samples.push({ id: read.id, name: read.name || "", signals: row.signals, blurb: row.blurb || "", ...(row.strength ? { strength: row.strength } : {}) });
      return;
    }
  };
  take((row) => row.signals.some((chip) => chip.kind === "move" && (chip.dir === "up" || chip.dir === "down")));
  take((row, read) => String(read.href || "").startsWith("/p/") && row.signals.some((chip) => chip.kind === "listings"));
  take((row) => row.signals.some((chip) => chip.dir === "dash"));
  const out = {
    asOf,
    source: "TCGplayer market, eBay listings counted",
    count,
    byId: byRead,
    bySku,
    preview: samples[0] || null,
    samples,
  };
  const scored = Object.values(byRead).filter((row) => row.strength).length;
  const cleaned = dropHeldChips(out, await loadHeldIds(root));
  if (cleaned.dropped) console.log(`signal chips: ${cleaned.dropped} held chip(s) left out`);
  await writeFile(join(root, "research/assets/public/signal-chips.json"), `${JSON.stringify(cleaned.doc)}\n`);
  if (writeReads) await writeFile(readsPath, `${JSON.stringify(bundle, null, 1)}\n`);
  console.log(`signal chips: ${count} reads, ${feedCount} feed rows, ${scored} with a score`);
  return { count, wrote: true, asOf };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const rules = await loadRules();
  if (rules) {
    await stampSignalChips({ rules, writeReads: process.env.SIGNAL_STAMP_READS === "1" });
  }
}
