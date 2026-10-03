// Writes the Feed catalogue and appends new call rows. Does not rebuild the rest of the site.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropTiledCycles, pretty, slug } from "./lib/public-bundle.mjs";
import { publishFeed, readCallLog, readShelfFile } from "./lib/feed-catalogue.mjs";
import { assembleCatalog, buildBrowse, supplyNotes } from "./lib/extra-reads.mjs";
import { supplyMap, writeExtra } from "./build-extra-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public");
const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

function addPoint(map, pid, date, market) {
  const id = Number(pid);
  const v = Number(market);
  const day = String(date || "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(v > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  map.get(id).set(day, Math.round(v * 100) / 100);
}

const catalog = await read("data/catalog/tcgcsv-latest.json");
// A later daily file is not a new catalog day. 2026-09-29 prices 1,695 products,
// not the catalog. addPoint keeps a later print only for a product that has it.
const series = new Map();
for (const file of (await readdir(join(ROOT, "data/history/market-backfill"))).sort()) {
  if (!file.endsWith(".json")) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "data/history/market-backfill", file), "utf8"));
  for (const [pid, pts] of Object.entries(doc.series || {})) {
    for (const pt of pts || []) addPoint(series, pid, pt?.[0], pt?.[1]);
  }
}
try {
  for (const file of await readdir(join(ROOT, "data/history/tcgplayer-market"))) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgplayer-market", file), "utf8"));
    for (const pt of doc.points || []) {
      if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
      addPoint(series, doc.tcgplayerProductId, pt.date, pt.market);
    }
  }
} catch { /* optional */ }
for (const file of (await readdir(join(ROOT, "data/history/tcgcsv-daily"))).sort()) {
  if (!file.endsWith(".json")) continue;
  const day = file.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
  const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", file), "utf8"));
  for (const row of doc.prices || []) addPoint(series, row.id, day, row.market);
}

const groupDates = await read("data/tcgcsv-group-dates.json").catch(() => ({}));
const catalogue = await read("data/card-catalogue.json").catch(() => ({ cards: {} }));
const releaseBySet = new Map();
for (const card of Object.values(catalogue.cards || {})) {
  if (!card.releaseDate || !card.setName) continue;
  const day = String(card.releaseDate).replaceAll("/", "-").slice(0, 10);
  const key = String(card.setName).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (key && day && !releaseBySet.has(key)) releaseBySet.set(key, day);
}
function releaseFor(item) {
  const published = groupDates[String(item.groupId)];
  if (published) return published;
  const key = String(item.set || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return releaseBySet.get(key) || "";
}

const BAD_IMAGE = new Set([232881, 532629]);
const GAP_IMAGE = new Set(((await read("data/image-gaps.json").catch(() => ({ pids: [] }))).pids || []).map(Number));
const items = [];
for (const item of catalog.items || []) {
  const days = series.get(Number(item.tcgplayerProductId));
  if (!days || days.size < 30) continue;
  const hist = dropTiledCycles([...days.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1));
  const pid = Number(item.tcgplayerProductId);
  const kind = item.kind === "sealed" ? "sealed" : "single";
  items.push({
    id: item.id,
    name: pretty(item.name),
    set: pretty(item.set),
    setSlug: slug(item.set || ""),
    kind,
    subtype: item.subtype || "",
    number: item.number || "",
    price: Number(item.price) || hist.at(-1)?.[1] || 0,
    release: releaseFor(item),
    hist,
    href: kind === "sealed" ? `/p/${item.id}` : `/c/${item.id}`,
    image: pid && !BAD_IMAGE.has(pid) && !GAP_IMAGE.has(pid) ? `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_400x400.jpg` : "",
  });
}

let updatedAt = null;
try { updatedAt = (await read("data/ppt/run-report.json")).finishedAt || null; } catch { /* clock stays null */ }
const prices = new Map();
for (const item of catalog.items || []) {
  const hist = series.get(Number(item.tcgplayerProductId));
  let price = Number(item.price);
  let lastDate = "";
  if (hist) {
    for (const [date, value] of hist) {
      if (date > lastDate && value > 0) {
        lastDate = date;
        price = value;
      }
    }
  }
  if (price > 0 && item.id) prices.set(item.id, price);
}
const logFile = process.env.LEARNING_LOG || "";
const prior = logFile ? await readCallLog(logFile) : [];
let soldBySku = new Map();
try {
  const trending = await read("trending.json");
  for (const play of trending.plays || []) {
    const pid = Number(play.tcgplayerProductId);
    if (!pid || !Number.isInteger(play.sold3m)) continue;
    const dated = /2026-10-01|10-01/.test(String(play.why || "")) || play.sku === "surging-sparks-box";
    soldBySku.set(`tcgcsv-${pid}`, {
      count: play.sold3m,
      asOf: dated ? "2026-10-01" : String(trending.asOf || "").slice(0, 10),
    });
  }
} catch { /* snapshot is optional until it is on this branch */ }
const result = await publishFeed({
  items,
  prior,
  prices,
  asOf: catalog.asOf || "",
  rewriteDir: join(ROOT, "data/learning/path-rewrites"),
  updatedAt,
  outDir: OUT,
  logFile: logFile || null,
  shelf: await readShelfFile(process.env.SHELF_LOG || join(ROOT, "data/learning/shelf.jsonl")),
  gapPids: [...GAP_IMAGE],
  soldBySku,
  root: ROOT,
});
console.log(JSON.stringify({ count: result.count, sections: result.sections, tracked: result.tracked, added: result.logged.added, skipped: result.logged.skipped.length, lead: result.lead, halfExcluded: result.halfExcluded, halfCheap: result.halfCheap, soldFacts: soldBySku.size }));

const divergence = await read("data/divergence-report.json").catch(() => ({ rows: [] }));
const supplyWatch = await read("data/supply-watch.json").catch(() => ({ rows: [] }));
const supplyRows = [...(divergence.rows || []), ...(supplyWatch.rows || [])];
const extra = assembleCatalog(catalog.items || [], series, {
  asOf: catalog.asOf || "",
  supplyBySet: supplyMap(supplyRows),
});
extra.supplyNotes = supplyNotes(supplyRows);
const catalogueDoc = JSON.parse(await readFile(join(OUT, "feed/catalogue.json"), "utf8"));
const cardIds = Object.keys(catalogueDoc.cards || {});
const ranked = [];
const seen = new Set();
for (const part of ["up", "down", "today", "watch", "cook"]) {
  for (const id of catalogueDoc[part] || []) {
    if (seen.has(id)) continue;
    seen.add(id);
    ranked.push(id);
  }
}
let waves = [];
let newsCount = 0;
try {
  const news = await read("research/digests/news.json");
  newsCount = (news.filters?.news?.items || []).length;
  waves = (news.catalog || []).filter((row) => row && (row.wave || row.reprint));
} catch { /* news stays in its own file */ }
const browse = buildBrowse({ asOf: catalog.asOf || "", cardIds, rankedIds: ranked, news: new Array(newsCount), waves });
const extraSummary = await writeExtra(ROOT, extra, browse);
console.log(JSON.stringify({ extra: extraSummary }));
