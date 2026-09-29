// Writes the Feed catalogue and appends new call rows. Does not rebuild the rest of the site.
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropTiledCycles, pretty, slug } from "./lib/public-bundle.mjs";
import { publishFeed, readCallLog, readShelfFile } from "./lib/feed-catalogue.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "research/assets/public");
const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

function addPoint(map, pid, date, market) {
  const id = Number(pid);
  const v = Number(market);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !(v > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  map.get(id).set(String(date), Math.round(v * 100) / 100);
}

const catalog = await read("data/catalog/tcgcsv-latest.json");
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
  const price = Number(item.price);
  if (price > 0 && item.id) prices.set(item.id, price);
}
const logFile = process.env.LEARNING_LOG || "";
const prior = logFile ? await readCallLog(logFile) : [];
const result = await publishFeed({
  items,
  prior,
  prices,
  asOf: catalog.asOf,
  updatedAt,
  outDir: OUT,
  logFile: logFile || null,
  shelf: await readShelfFile(process.env.SHELF_LOG || join(ROOT, "data/learning/shelf.jsonl")),
  gapPids: [...GAP_IMAGE],
});
console.log(JSON.stringify({ count: result.count, sections: result.sections, tracked: result.tracked, added: result.logged.added, skipped: result.logged.skipped.length }));
