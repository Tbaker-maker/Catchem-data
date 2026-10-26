#!/usr/bin/env node
// One light index per tab. Flag EXPLORE stays off. This does not publish.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  banned, newsId, links, exploreRow, interestingIds, priceField, countField, pctChange, GZIP_LIMIT, cleanImage,
} from "./lib/explore-index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function releaseIndex(sets) {
  const byCode = new Map();
  for (const set of sets || []) {
    const m = String(set.logo || "").match(/\/img\/([^/]+)\//);
    if (!m) continue;
    const list = byCode.get(m[1]) || [];
    list.push(set);
    byCode.set(m[1], list);
  }
  return byCode;
}

function matchSet(product, byCode) {
  const list = byCode.get(product.setId) || [];
  if (!list.length) return null;
  if (list.length === 1) return list[0];
  const needle = String(product.set || "").toLowerCase();
  return list.find((set) => {
    const tail = String(set.name || "").split(":").pop().trim().toLowerCase();
    return needle && (String(set.name || "").toLowerCase().includes(needle) || (tail && needle.includes(tail)));
  }) || list.find((set) => !/promo/i.test(set.slug || "")) || list[0];
}

function loadListings(root) {
  const dir = join(root, "data/derived/listing-counts/history");
  const out = new Map();
  if (!existsSync(dir)) return out;
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json(\.gz)?$/.test(n)).sort();
  if (!files.length) return out;
  const name = files[files.length - 1];
  const raw = readFileSync(join(dir, name));
  const json = JSON.parse(name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8"));
  for (const row of json.rows || []) {
    if (!row || row.id == null || row.listingsCounted == null || !Number.isFinite(Number(row.listingsCounted))) continue;
    out.set(String(row.id), { n: Number(row.listingsCounted), date: row.date || json.date || name.slice(0, 10) });
  }
  return out;
}

function loadSetValues(root) {
  const dir = join(root, "research/assets/public/set-value");
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const doc = readJson(join(dir, name));
    out.push(doc);
  }
  return out;
}

function loadDaily(root, ids) {
  const dir = join(root, "data/history/tcgcsv-daily");
  const files = existsSync(dir) ? readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort() : [];
  const maps = [];
  for (const name of files.slice(-2)) {
    const doc = readJson(join(dir, name));
    const date = doc.date || name.slice(0, 10);
    const map = new Map();
    for (const row of doc.prices || []) {
      const id = String(row.id);
      if (!ids.has(id) || !(row.market > 0)) continue;
      map.set(id, { date, price: Number(row.market) });
    }
    maps.push({ date, map });
  }
  return maps;
}

function cap(list, n) {
  return (list || []).filter(Boolean).slice(0, n);
}

export function buildExplore(root = ROOT) {
  const setsDoc = readJson(join(root, "research/assets/public/sets.json"));
  const sets = setsDoc.sets || [];
  const bySlug = new Map(sets.map((s) => [s.slug, s]));
  const byCode = releaseIndex(sets);
  const byName = new Map();
  for (const set of sets) {
    const tail = String(set.name || "").split(":").pop().trim().toLowerCase();
    if (tail) byName.set(tail, set.slug);
    byName.set(String(set.name || "").toLowerCase(), set.slug);
  }
  const sealedDoc = readJson(join(root, "data/sealed-prices.json"));
  const products = sealedDoc.products || [];
  const values = loadSetValues(root);
  const valueBySlug = new Map(values.map((v) => [v.slug, v]));
  const movers = existsSync(join(root, "research/assets/public/movers.json"))
    ? readJson(join(root, "research/assets/public/movers.json"))
    : { singles: [] };
  const readsDoc = readJson(join(root, "research/assets/public/reads.json"));
  const reads = readsDoc.reads || [];
  const newsDoc = existsSync(join(root, "data/derived/news-deduped.json"))
    ? readJson(join(root, "data/derived/news-deduped.json"))
    : { rows: [] };
  const listings = loadListings(root);

  const wanted = new Set();
  const chaseBySlug = new Map();
  for (const file of values) {
    const top = (file.top || []).find((c) => c && c.id);
    if (!top) continue;
    chaseBySlug.set(file.slug, top);
    const m = String(top.id).match(/^tcgcsv-(\d+)$/);
    if (m) wanted.add(m[1]);
  }
  for (const row of movers.singles || []) {
    const m = String(row.id || "").match(/^tcgcsv-(\d+)$/);
    if (m) wanted.add(m[1]);
  }
  const days = loadDaily(root, wanted);
  const latest = days[days.length - 1] || { date: null, map: new Map() };
  const prior = days.length > 1 ? days[days.length - 2] : { date: null, map: new Map() };

  function singlePrice(id) {
    const m = String(id || "").match(/^tcgcsv-(\d+)$/);
    if (!m) return { price: null, change: null, date: null };
    const now = latest.map.get(m[1]);
    const prev = prior.map.get(m[1]);
    const change = now && prev && prev.date !== now.date ? pctChange(prev.price, now.price) : null;
    return { price: now ? now.price : null, change, date: now ? now.date : null, prevDate: prev?.date || null };
  }

  const singleIds = new Set();
  const singles = [];
  function addSingle(id, name, setName, setSlug) {
    if (!id || singleIds.has(id)) return;
    const got = singlePrice(id);
    if (got.price == null) return;
    singleIds.add(id);
    const listed = listings.get(id);
    const set = setSlug && bySlug.has(setSlug) ? setSlug : (byName.get(String(setName || "").toLowerCase()) || null);
    singles.push(exploreRow({
      id,
      name,
      image: null,
      set: setName || null,
      price: priceField(got.price, "TCGplayer market", got.date, "market print on file"),
      change: got.change == null ? priceField(null, null, null, null) : priceField(got.change, "TCGplayer market", got.date, `percent change from the prior market print on ${got.prevDate}`),
      listingsCounted: listed ? countField(listed.n, "listings counted", listed.date, "count of listings on file") : countField(null, null, null, null),
      source: "TCGplayer market",
      date: got.date,
      rowLinks: links({ set }),
    }));
  }
  for (const [slug, top] of chaseBySlug) {
    const set = bySlug.get(slug);
    addSingle(top.id, top.name, set?.name || null, slug);
  }
  for (const row of movers.singles || []) addSingle(row.id, row.name, row.set, null);

  const newsRows = [];
  const seenNews = new Set();
  const newsSorted = (newsDoc.rows || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const row of newsSorted) {
    if (newsRows.length >= 160) break;
    const title = String(row.title || "").trim();
    if (!title || banned(title) || banned(row.source || "")) continue;
    let id = newsId(row.url, title);
    while (seenNews.has(id)) id += "x";
    seenNews.add(id);
    newsRows.push(exploreRow({
      id,
      name: title,
      image: null,
      set: null,
      price: priceField(null, null, null, null),
      change: priceField(null, null, null, null),
      listingsCounted: countField(null, null, null, null),
      source: row.source || null,
      date: row.date || null,
      rowLinks: links(),
    }));
  }

  const readRows = [];
  for (const read of reads) {
    const claim = String(read.headline || read.name || "").replace(/[–—]/g, "-");
    if (banned(claim) || banned(read.name || "")) continue;
    const sku = String(read.sku || "");
    const got = sku ? singlePrice(sku) : { price: null, change: null, date: null };
    const setSlug = byName.get(String(read.set || "").toLowerCase()) || byName.get(String(read.set || "").split(":").pop().trim().toLowerCase()) || null;
    readRows.push(exploreRow({
      id: read.id,
      name: read.name || read.headline,
      image: cleanImage(read.image),
      set: read.set || null,
      price: got.price == null ? priceField(null, null, null, null) : priceField(got.price, "TCGplayer market", got.date, "market print on file"),
      change: priceField(null, null, null, null),
      listingsCounted: countField(null, null, null, null),
      source: got.price == null ? null : "TCGplayer market",
      date: read.asOf || null,
      rowLinks: links({ set: setSlug }),
    }));
  }

  const sealedRows = [];
  for (const p of products) {
    const set = matchSet(p, byCode);
    const hist = (p.priceHistory || [])
      .filter((h) => h && h.date && h.price != null && Number.isFinite(Number(h.price)))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const last = hist.length ? hist[hist.length - 1] : null;
    const prev = hist.length > 1 ? hist[hist.length - 2] : null;
    const change = last && prev ? pctChange(prev.price, last.price) : null;
    const listedKey = p.tcgPlayerId != null ? `tcgcsv-${p.tcgPlayerId}` : "";
    const listed = listedKey ? listings.get(listedKey) : null;
    const count = listed ? listed.n : (p.listingCount != null && Number.isFinite(Number(p.listingCount)) ? Number(p.listingCount) : null);
    const countDate = listed ? listed.date : (count == null ? null : last?.date || p.lastSeen || null);
    const countSource = listed ? "listings counted" : (count == null ? null : "eBay asks");
    const countMethod = listed ? "count of listings on file" : (count == null ? null : "count of asks kept on the sealed price file");
    sealedRows.push(exploreRow({
      id: p.id,
      name: p.name,
      image: cleanImage(p.image) || cleanImage(p.representativeImage),
      set: p.set || null,
      price: priceField(last ? last.price : null, last ? "eBay asks" : null, last?.date || null, last ? "latest ask median on the sealed price file" : null),
      change: change == null ? priceField(null, null, null, null) : priceField(change, "eBay asks", last.date, "percent change from the prior ask median on file"),
      listingsCounted: countField(count, countSource, countDate, countMethod),
      source: last ? "eBay asks" : null,
      date: last?.date || null,
      rowLinks: links({ set: set?.slug || null }),
    }));
  }

  const setRows = [];
  for (const set of sets) {
    const file = valueBySlug.get(set.slug);
    const total = file && file.master && file.master.total != null && Number.isFinite(Number(file.master.total)) ? Number(file.master.total) : null;
    setRows.push(exploreRow({
      id: set.slug,
      name: set.name,
      image: cleanImage(set.logo),
      set: set.era || null,
      price: priceField(total, total == null ? null : "TCGplayer market", total == null ? null : (file.asOf || null), total == null ? null : "total on the set value file"),
      change: priceField(null, null, null, null),
      listingsCounted: countField(null, null, null, null),
      source: total == null ? null : "TCGplayer market",
      date: total == null ? null : (file.asOf || null),
      rowLinks: links(),
    }));
  }

  const setIds = new Set(setRows.map((r) => r.id));
  const sealedIds = new Set(sealedRows.map((r) => r.id));
  const newsIds = new Set(newsRows.map((r) => r.id));
  const readIds = new Set(readRows.map((r) => r.id));

  const sealedBySet = new Map();
  for (let i = 0; i < products.length; i += 1) {
    const slug = sealedRows[i].links.set;
    if (!slug) continue;
    const list = sealedBySet.get(slug) || [];
    list.push(sealedRows[i].id);
    sealedBySet.set(slug, list);
  }
  const singlesBySet = new Map();
  for (const row of singles) {
    if (!row.links.set) continue;
    const list = singlesBySet.get(row.links.set) || [];
    list.push(row.id);
    singlesBySet.set(row.links.set, list);
  }
  const readsBySet = new Map();
  const readsBySku = new Map();
  for (const read of reads) {
    if (!readIds.has(read.id)) continue;
    const slug = byName.get(String(read.set || "").toLowerCase()) || null;
    if (slug) {
      const list = readsBySet.get(slug) || [];
      list.push(read.id);
      readsBySet.set(slug, list);
    }
    if (read.sku) {
      const list = readsBySku.get(read.sku) || [];
      list.push(read.id);
      readsBySku.set(read.sku, list);
    }
  }
  const newsBySet = new Map();
  for (const set of sets) {
    const tail = String(set.name || "").split(":").pop().trim();
    if (tail.length < 6) continue;
    const hits = [];
    const low = tail.toLowerCase();
    for (const row of newsRows) {
      if (String(row.name || "").toLowerCase().includes(low)) hits.push(row.id);
      if (hits.length >= 4) break;
    }
    if (hits.length) newsBySet.set(set.slug, hits);
  }

  for (const row of setRows) {
    const set = bySlug.get(row.id);
    const era = set?.era;
    const siblings = sets
      .filter((s) => s.slug !== row.id && s.era === era)
      .sort((a, b) => String(b.release || "").localeCompare(String(a.release || "")))
      .map((s) => s.slug);
    const chase = chaseBySlug.get(row.id);
    row.links = links({
      siblings: cap(siblings, 6),
      chaseCards: chase && singleIds.has(chase.id) ? [chase.id] : [],
      mentions: cap(newsBySet.get(row.id) || [], 4),
      reads: cap(readsBySet.get(row.id) || [], 4),
    });
  }
  for (let i = 0; i < sealedRows.length; i += 1) {
    const row = sealedRows[i];
    const slug = row.links.set;
    const chase = slug ? chaseBySlug.get(slug) : null;
    const sku = products[i].tcgPlayerId != null ? `tcgcsv-${products[i].tcgPlayerId}` : "";
    row.links = links({
      set: slug && setIds.has(slug) ? slug : null,
      siblings: cap((sealedBySet.get(slug) || []).filter((id) => id !== row.id), 6),
      chaseCards: chase && singleIds.has(chase.id) ? [chase.id] : [],
      mentions: cap(newsBySet.get(slug) || [], 4),
      reads: cap([...(sku ? readsBySku.get(sku) || [] : []), ...(readsBySet.get(slug) || [])], 4),
    });
  }
  for (const row of singles) {
    const slug = row.links.set;
    const chase = slug ? chaseBySlug.get(slug) : null;
    row.links = links({
      set: slug && setIds.has(slug) ? slug : null,
      siblings: cap((singlesBySet.get(slug) || []).filter((id) => id !== row.id), 6),
      chaseCards: chase && singleIds.has(chase.id) && chase.id !== row.id ? [chase.id] : [],
      mentions: cap(newsBySet.get(slug) || [], 4),
      reads: cap(readsBySku.get(row.id) || [], 4),
    });
  }
  for (const row of readRows) {
    const slug = row.links.set;
    row.links = links({
      set: slug && setIds.has(slug) ? slug : null,
      siblings: cap((readsBySet.get(slug) || []).filter((id) => id !== row.id), 4),
      reads: [],
    });
  }

  const sealInteresting = interestingIds(sealedRows, 12);
  const singleInteresting = interestingIds(singles, 12);
  const setInteresting = [];
  for (const id of [...sealInteresting, ...singleInteresting]) {
    const row = sealedRows.find((r) => r.id === id) || singles.find((r) => r.id === id);
    const slug = row?.links?.set;
    if (slug && setIds.has(slug) && !setInteresting.includes(slug)) setInteresting.push(slug);
    if (setInteresting.length >= 12) break;
  }
  const readInteresting = [];
  for (const id of [...sealInteresting, ...singleInteresting]) {
    const row = sealedRows.find((r) => r.id === id) || singles.find((r) => r.id === id);
    for (const rid of row?.links?.reads || []) {
      if (!readInteresting.includes(rid)) readInteresting.push(rid);
      if (readInteresting.length >= 8) break;
    }
  }
  if (!readInteresting.length) {
    for (const row of readRows) {
      readInteresting.push(row.id);
      if (readInteresting.length >= 8) break;
    }
  }

  function pack(tab, about, rows, interesting) {
    return {
      EXPLORE: "off",
      enabled: false,
      flag: "EXPLORE",
      tab,
      asOf: latest.date || readsDoc.asOf || null,
      about,
      interesting,
      rows,
    };
  }

  const docs = {
    sets: pack("sets", "Sets on file. Interesting lists sets that hold a large move already in the sealed or singles index. A missing number is null.", setRows, setInteresting),
    sealed: pack("sealed", "Sealed products on file. Price is the ask median. Interesting is the largest move already on the sealed file. A missing number is null.", sealedRows, sealInteresting),
    singles: pack("singles", "Singles that are a set chase card or already on the movers file, and only when the market print is on our daily file. Interesting is the largest move. A missing number is null.", singles, singleInteresting),
    news: pack("news", "Newest rows from our news file. Interesting is the newest rows in this index. No number is invented.", newsRows, newsRows.slice(0, 8).map((r) => r.id)),
    reads: pack("reads", "Reads on file. Interesting lists reads tied to a large move in the sealed or singles index. A missing number is null.", readRows, readInteresting),
  };

  for (const doc of Object.values(docs)) {
    const blob = JSON.stringify(doc);
    if (banned(blob)) {
      const err = new Error(`explore ${doc.tab} failed the copy check`);
      err.code = "BANNED";
      throw err;
    }
    if (gzipSync(blob).length >= GZIP_LIMIT) {
      const err = new Error(`explore ${doc.tab} is over 300 KB gzip`);
      err.code = "GZIP";
      throw err;
    }
  }

  const dest = join(root, "research/assets/public/explore");
  mkdirSync(dest, { recursive: true });
  const written = {};
  for (const [tab, doc] of Object.entries(docs)) {
    const path = join(dest, `${tab}.json`);
    const blob = JSON.stringify(doc);
    writeFileSync(path, blob);
    written[tab] = { path, bytes: Buffer.byteLength(blob), gzip: gzipSync(blob).length, rows: doc.rows.length };
  }
  return { docs, written };
}

function main() {
  const { written } = buildExplore(ROOT);
  for (const [tab, info] of Object.entries(written)) {
    console.log(`${tab} rows ${info.rows} gzip ${info.gzip} ${info.path}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
