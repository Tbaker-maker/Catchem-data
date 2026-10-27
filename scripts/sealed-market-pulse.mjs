#!/usr/bin/env node
// Build data/sealed-market-pulse.json from our price files.
// Limits: node scripts/sealed-market-pulse.mjs --config path/to/pulse.json
// If that file is missing or incomplete, exit.
// No cutoff numbers live in this file. The written flag stays off.

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import {
  assertLimits, monthEnds, mergePoints, changesFor, parseHistRow, monthSpan,
  median, buildFromSeries, pickRepresentative, joinMirror, archiveAbout,
} from "./lib/sealed-market-pulse.mjs";
import { loadFillMap } from "./lib/fill-history.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ERA_PREFIX = [
  ["swsh", "Sword & Shield"],
  ["hgss", "HeartGold & SoulSilver"],
  ["sv", "Scarlet & Violet"],
  ["sm", "Sun & Moon"],
  ["xy", "XY"],
  ["bw", "Black & White"],
  ["dp", "Diamond & Pearl"],
  ["pl", "Platinum"],
  ["ex", "EX"],
  ["neo", "Neo"],
  ["base", "Original"],
  ["ecard", "Original"],
  ["me", "Mega Evolution"],
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function foldName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameKeys(name) {
  const raw = foldName(name);
  const keys = new Set();
  if (raw) keys.add(raw);
  const stripped = raw.replace(/^(?:swsh|sm|sv|xy|bw|dp|hgss|me|sve|ex|neo|pl)\d*\s+/, "");
  if (stripped) keys.add(stripped);
  const noBase = stripped.replace(/\s+base set$/, "").trim();
  if (noBase) keys.add(noBase);
  if (/\b151$/.test(raw) || /\b151$/.test(stripped)) keys.add("151");
  // SM Base Set is the Sun & Moon set in the sealed file.
  if (raw === "sm base set") keys.add("sun and moon");
  return keys;
}

function eraFor(setId, setName, byName) {
  const named = byName.get(foldName(setName));
  if (named) return named;
  for (const k of nameKeys(setName)) {
    const hit = byName.get(k);
    if (hit) return hit;
  }
  const id = String(setId || "");
  for (const [pre, era] of ERA_PREFIX) {
    if (id === pre || id.startsWith(pre)) return era;
  }
  return null;
}

function configArg() {
  const i = process.argv.indexOf("--config");
  return i >= 0 ? process.argv[i + 1] : "";
}

function loadLimits(path) {
  if (!path || !existsSync(path)) {
    console.error("pulse limits not loaded");
    process.exit(1);
  }
  let cfg;
  try { cfg = readJson(path); }
  catch {
    console.error("pulse limits not loaded");
    process.exit(1);
  }
  try { return assertLimits(cfg); }
  catch {
    console.error("pulse limits not loaded");
    process.exit(1);
  }
}

function loadMarketFiles() {
  const dir = join(ROOT, "data/history/tcgplayer-market");
  const byTcg = new Map();
  if (!existsSync(dir)) return byTcg;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    if (name === "coverage.json" || name === "mapping.json" || name === "unmatched.json") continue;
    const j = readJson(join(dir, name));
    const id = j.tcgplayerProductId != null ? String(j.tcgplayerProductId) : null;
    if (!id || !Array.isArray(j.points)) continue;
    const pts = j.points
      .filter((p) => p && p.date && p.market != null && Number.isFinite(p.market))
      .map((p) => ({ date: p.date, price: p.market, source: "tcgplayer-market" }));
    const prev = byTcg.get(id) || [];
    byTcg.set(id, prev.concat(pts));
  }
  return byTcg;
}

function loadDaily(want) {
  // want: Set of numeric ids, or null for all sealed ids we already know
  const dir = join(ROOT, "data/history/tcgcsv-daily");
  const byTcg = new Map();
  if (!existsSync(dir)) return byTcg;
  const files = readdirSync(dir).filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  for (const name of files) {
    const j = readJson(join(dir, name));
    const date = j.date || name.slice(0, 10);
    const grouped = new Map();
    for (const p of j.prices || []) {
      if (!p || p.id == null || p.market == null || !Number.isFinite(p.market)) continue;
      const id = String(p.id);
      if (want && !want.has(id)) continue;
      const list = grouped.get(id) || [];
      list.push(p);
      grouped.set(id, list);
    }
    for (const [id, list] of grouped) {
      let chosen = null;
      if (list.length === 1) chosen = list[0];
      else {
        const normal = list.filter((x) => x.printing === "Normal");
        if (normal.length === 1) chosen = normal[0];
        else if (new Set(list.map((x) => x.market)).size === 1) chosen = list[0];
      }
      if (!chosen) continue;
      const arr = byTcg.get(id) || [];
      arr.push({ date, price: chosen.market, source: "tcgcsv-daily" });
      byTcg.set(id, arr);
    }
  }
  return byTcg;
}

function loadListings(ids) {
  const dir = join(ROOT, "data/derived/listing-counts/history");
  const byOur = new Map();
  if (!existsSync(dir)) return byOur;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json") && !name.endsWith(".json.gz")) continue;
    const raw = readFileSync(join(dir, name));
    const text = name.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
    let j;
    try { j = JSON.parse(text); } catch { continue; }
    const date = j.date || name.slice(0, 10);
    for (const row of j.rows || []) {
      if (!row || row.listingsCounted == null || !Number.isFinite(row.listingsCounted)) continue;
      const id = String(row.id || "");
      if (!ids.has(id)) continue;
      const arr = byOur.get(id) || [];
      arr.push({ date, count: row.listingsCounted });
      byOur.set(id, arr);
    }
  }
  return byOur;
}

function loadSetValues() {
  const dir = join(ROOT, "research/assets/public/set-value");
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const j = readJson(join(dir, name));
    out.push({ file: name, name: j.name, asOf: j.asOf, source: j.source, top: j.top || [] });
  }
  return out;
}

function loadHist(want) {
  const dir = join(ROOT, "research/assets/public/hist-long");
  const out = new Map();
  if (!existsSync(dir) || !want.size) return out;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const j = readJson(join(dir, name));
    const rows = j.rows || {};
    for (const key of want) {
      if (!rows[key] || out.has(key)) continue;
      out.set(key, parseHistRow(rows[key]));
    }
    if (out.size === want.size) break;
  }
  return out;
}

function seriesFor(tcgId, marketByTcg, dailyByTcg) {
  const id = tcgId != null ? String(tcgId) : "";
  const archive = marketByTcg.get(id) || [];
  const daily = dailyByTcg.get(id) || [];
  return mergePoints([archive, daily]);
}

function main() {
  const limits = loadLimits(configArg());
  const sealed = readJson(join(ROOT, "data/sealed-prices.json"));
  const products = sealed.products || [];
  const setsDoc = existsSync(join(ROOT, "research/assets/public/sets.json"))
    ? readJson(join(ROOT, "research/assets/public/sets.json"))
    : { sets: [] };
  const byName = new Map();
  for (const s of setsDoc.sets || []) {
    for (const k of nameKeys(s.name)) if (!byName.has(k)) byName.set(k, s.era);
  }

  const marketByTcg = loadMarketFiles();
  const tcgIds = new Set();
  for (const p of products) if (p.tcgPlayerId != null) tcgIds.add(String(p.tcgPlayerId));
  const dailyByTcg = loadDaily(tcgIds);
  let fillMap = new Map();
  try { fillMap = loadFillMap(ROOT); } catch { fillMap = new Map(); }

  function joinedFor(product) {
    const own = seriesFor(product.tcgPlayerId, marketByTcg, dailyByTcg);
    const fill = fillMap.get(Number(product.tcgPlayerId));
    return joinMirror(own, fill ? fill.points : [], limits);
  }

  const reps = pickRepresentative(products, limits);
  const listingIds = new Set();
  for (const p of products) if (p.tcgPlayerId != null) listingIds.add(`tcgcsv-${p.tcgPlayerId}`);
  const listings = loadListings(listingIds);

  const allChanges = [];
  const prepared = [];
  const mirrorGaps = [];
  let newest = null;
  for (const p of products) {
    const joined = joinedFor(p);
    if (!joined.points.length) continue;
    const last = joined.points[joined.points.length - 1].date;
    if (!newest || last > newest) newest = last;
    allChanges.push(joined.points);
  }
  if (!newest) {
    console.error("no dated sealed prices");
    process.exit(1);
  }
  const endMonth = newest.slice(0, 7);
  const months = monthSpan(endMonth, limits.heatmapMonths);

  // market median across every tracked sealed product, not only the row we show
  const marketChanges = new Map();
  const allPct = new Map(months.map((m) => [m, []]));
  for (const points of allChanges) {
    const ends = monthEnds(points);
    const changes = changesFor(ends, months, limits.flatAbsPct);
    for (const c of changes) if (c.pct != null) allPct.get(c.month).push(c.pct);
  }
  for (const m of months) marketChanges.set(m, median(allPct.get(m)));

  for (const p of reps) {
    const joined = joinedFor(p);
    const ends = monthEnds(joined.points);
    const changes = changesFor(ends, months, limits.flatAbsPct);
    const listKey = p.tcgPlayerId != null ? `tcgcsv-${p.tcgPlayerId}` : "";
    for (const gap of joined.gaps) mirrorGaps.push({ id: p.id, set: p.set, ...gap });
    prepared.push({
      ...p,
      eraHint: eraFor(p.setId, p.set, byName),
      image: p.representativeImage || p.image || null,
      logo: p.image || null,
      ends,
      changes,
      listings: listings.get(listKey) || [],
      points: joined.points,
      about: joined.about,
      usedMirror: joined.usedMirror,
    });
  }

  const setValues = loadSetValues();
  const setIdByKey = new Map();
  for (const p of products) {
    if (!p.setId) continue;
    for (const k of nameKeys(p.set)) {
      if (!setIdByKey.has(k)) setIdByKey.set(k, p.setId);
    }
  }
  const wantHist = new Set();
  const cards = [];
  for (const sv of setValues) {
    let setId = null;
    for (const k of nameKeys(sv.name)) {
      if (setIdByKey.has(k)) { setId = setIdByKey.get(k); break; }
    }
    if (!setId) continue;
    for (const card of sv.top || []) {
      if (!card || !card.id) continue;
      wantHist.add(card.id);
      cards.push({ ...card, setId, setName: sv.name });
    }
  }
  const hist = loadHist(wantHist);
  const singleIds = new Set([...wantHist].map((k) => String(k).replace(/^tcgcsv-/, "")));
  const singleDaily = loadDaily(singleIds);
  const singlesBySet = new Map();
  for (const card of cards) {
    const numId = String(card.id).replace(/^tcgcsv-/, "");
    const points = mergePoints([
      hist.get(card.id) || [],
      card.price != null && card.date ? [{ date: card.date, price: card.price, source: "set-value" }] : [],
      singleDaily.get(numId) || [],
    ]);
    const ends = monthEnds(points);
    let latest = null;
    for (const pt of points) if (!latest || pt.date > latest.date) latest = pt;
    const row = {
      id: card.id,
      name: card.name,
      number: card.number || null,
      setId: card.setId,
      price: latest ? latest.price : null,
      points,
      ends,
      tcgUrl: `https://www.tcgplayer.com/product/${numId}`,
      ebayUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(`${card.name} ${card.setName} ${card.number || ""} pokemon`)}`,
    };
    const list = singlesBySet.get(card.setId) || [];
    list.push(row);
    singlesBySet.set(card.setId, list);
  }

  const eras = new Map();
  for (const p of prepared) {
    eras.set(p.setId, p.eraHint);
  }

  const built = newest;
  const out = buildFromSeries({
    products: prepared,
    eras,
    months,
    marketChanges,
    limits,
    singlesBySet,
    built,
  });
  out.about = archiveAbout(limits.archiveNoteDate);
  out.mirrorGaps = mirrorGaps;
  out.mirrorGapCount = mirrorGaps.length;
  out.sources = [
    { name: "TCGplayer market archive", path: "data/history/tcgplayer-market" },
    { name: "TCGplayer market daily", path: "data/history/tcgcsv-daily" },
    { name: "listings counted", path: "data/derived/listing-counts/history" },
    { name: "set value", path: "research/assets/public/set-value" },
    { name: "single history", path: "research/assets/public/hist-long" },
    { name: "Mirrored archived TCGplayer market", note: "Days before archiveNoteDate (first Catch'em own day). Own prices from that day on." },
  ];
  out.imageNote = "Sealed cutout branch feature/sealed-cutouts was not on the remote. Rows use the current product image.";
  const dest = join(ROOT, "data/sealed-market-pulse.json");
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(out));
  // Public slim file for the site heatmap. No private limits copied.
  const pubRows = (out.rows || []).map((r) => ({
    id: r.id,
    name: r.name,
    set: r.set,
    setId: r.setId,
    type: r.type,
    era: r.era,
    tcgPlayerId: r.tcgPlayerId,
    logo: r.logo && String(r.logo).includes("images.pokemontcg.io") ? r.logo : null,
    about: r.about,
    usedMirror: r.usedMirror,
    cells: (r.cells || []).map((c) => ({
      month: c.month,
      pct: c.pct,
      direction: c.direction,
      price: c.price,
      priceDate: c.priceDate,
      priceSource: c.priceSource,
      missing: c.missing,
      listingsCount: c.listingsCount,
      listingsDate: c.listingsDate,
    })),
  }));
  const pub = {
    asOf: built,
    source: "TCGplayer market",
    mirror: "archived TCGplayer market (labeled on each cell through the day before archiveNoteDate)",
    about: out.about,
    months: out.months,
    marketMedian: out.marketMedian,
    rows: pubRows,
    note: "Month end is the last dated price in that calendar month. A blank month says No reading. Listings counted, not sold. Mirrored history is labeled on each cell.",
  };
  const pubDest = join(ROOT, "research/assets/public/sealed-market-pulse.json");
  mkdirSync(dirname(pubDest), { recursive: true });
  writeFileSync(pubDest, JSON.stringify(pub) + "\n");
  const sw = (out.breadth || []).find((b) => b.era === "Sword & Shield");
  console.log(`wrote ${dest}`);
  console.log(`wrote ${pubDest}`);
  console.log(`rows ${out.rows.length} missing cells ${out.missingCount} months ${months[0]} to ${months.at(-1)}`);
  if (sw) console.log(`SWSH boxes ${sw.current.total} green ${sw.current.green} of ${sw.current.total} avg ${sw.current.average} median ${sw.current.median}`);

}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

export { main };
