import { buildVariantFile, tagReadsFile } from "./lib/read-tags.mjs";
// Writes the Feed catalogue and appends new call rows. Does not rebuild the rest of the site.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropTiledCycles, pretty, slug } from "./lib/public-bundle.mjs";
import { publishFeed, readCallLog, readShelfFile } from "./lib/feed-catalogue.mjs";
import { assembleCatalog, supplyNotes } from "./lib/extra-reads.mjs";
import { supplyMap, writeFeedExtras } from "./build-extra-reads.mjs";
import { writeSealedPriceOutliers } from "./flag-sealed-price-outliers.mjs";
import { writeReadLibrary, dailyFileSet } from "./lib/read-library.mjs";
import { runRegistry } from "./lib/detectors/registry.mjs";
import { libraryOn } from "./lib/second-library.mjs";
import { buildBoardV3 } from "./lib/board-mix.mjs";
import { loadSeriesOnce } from "./lib/series-cache.mjs";
import { writeHealth } from "./write-health.mjs";
import { cooledSet, loadRotation } from "./lib/night-reads.mjs";

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
const seriesStarted = Date.now();
const series = new Map();
// PPT Near Mint history (data/history/market-backfill) moved to the private repo on 2026-10-10.
// Public builds use TCGCSV days only. A day TCGCSV does not have stays a gap.
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
loadSeriesOnce("public-tcgcsv", () => series);
console.log(JSON.stringify({ seriesMs: Date.now() - seriesStarted, seriesProducts: series.size }));

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
  if (!days || days.size < 2) continue; // windows below decide what qualifies
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
const cooled = cooledSet(await loadRotation(ROOT), catalog.asOf || "");
const result = await publishFeed({
  cooled,
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
// Flagged-price (outlier) and dive-teaser reads are rebuilt here from the files
// on disk, the same way build-extra-reads does — writeExtra alone strips them.
await writeSealedPriceOutliers({ root: ROOT });
const extraSummary = await writeFeedExtras(ROOT, extra, { asOf: catalog.asOf || "", cardIds, rankedIds: ranked, news: new Array(newsCount), waves });
const extraDoc = JSON.parse(await readFile(join(OUT, "feed/extra-reads.json"), "utf8"));
const dailyFiles = await dailyFileSet(ROOT);
const regStarted = Date.now();
const reg = runRegistry({
  catalogue: catalogueDoc,
  extra: extraDoc,
  series,
  dailyFiles,
}, { switchOn: false });
const registryMs = Date.now() - regStarted;
const library = await writeReadLibrary({ root: ROOT, catalogue: catalogueDoc, extra: extraDoc, series, dailyFiles });
// The picture is stamped on a copy of each board row. The library object itself
// must still match the registry. A real difference throws. The nightly stops.
if (libraryOn() !== true && JSON.stringify(reg.lib) !== JSON.stringify(library)) {
  throw new Error("registry library does not match the written read library");
}
console.log(JSON.stringify({ registryMs, registryLogs: reg.logs.length, browse: reg.browse.length }));
let spanReads = [];
try {
  const { collectSpanReads } = await import("./lib/span-reads.mjs");
  const span = await collectSpanReads({ root: ROOT, asOf: catalog.asOf || "", series });
  spanReads = span.reads || [];
  console.log(JSON.stringify({ span: span.counts }));
} catch (err) {
  console.error(`span reads skipped: ${err.message}`);
}
let scannerReads = [];
try {
  const { collectScannerReads } = await import("./lib/scanner/load.mjs");
  const scan = await collectScannerReads({ root: ROOT, asOf: catalog.asOf || "", series, catalog });
  scannerReads = scan.reads || [];
  console.log(JSON.stringify({ scanner: scan.summary }));
} catch (err) {
  console.error(`scanner skipped: ${err.message}`);
}
const boardV3 = await buildBoardV3(ROOT, { on: libraryOn() === true, spanReads, scannerReads });
console.log(JSON.stringify({ boardV3 }));
// Variant tags: rebuilt nightly here, then stamped on reads that point at one card.
let variantSummary = null;
try {
  const variants = await buildVariantFile(ROOT);
  variantSummary = await tagReadsFile(ROOT, variants.cards);
} catch (err) { console.error(`variant tags skipped: ${err.message}`); }
console.log(JSON.stringify({ variantSummary }));
// Factual trend line on each read, from own tcgcsv days only. Fill days stay out.
// A miss is logged and never stops the nightly. slow_climb stays in the private store.
try {
  const { stampTrendContext } = await import("./lib/trend-context.mjs");
  const trend = await stampTrendContext({ root: ROOT });
  console.log(JSON.stringify({ trend }));
} catch (err) {
  console.error(`trend context skipped: ${err.message}`);
}
try {
  const { stampReadsFile } = await import("./lib/card-face-stamp.mjs");
  const cardFace = await stampReadsFile(ROOT);
  console.log(JSON.stringify({ cardFace }));
} catch (err) {
  console.error(`card face skipped: ${err.message}`);
  throw err;
}
try {
  const { stampStale } = await import("./lib/read-stale.mjs");
  const readsPath = join(ROOT, "research/assets/public/reads.json");
  const readsDoc = JSON.parse(await readFile(readsPath, "utf8"));
  const stale = stampStale(readsDoc);
  await writeFile(readsPath, JSON.stringify(readsDoc, null, 1) + "\n");
  console.log(JSON.stringify({ stale }));
} catch (err) {
  console.error(`stale flag skipped: ${err.message}`);
  throw err;
}
const health = await writeHealth(ROOT);
// YouTube learning loop (official API, private store). Before the flagger so
// tonight's leads become flags. A missing key or any failure never stops the nightly.
try {
  const { runYoutubeLearn } = await import("./youtube-learn.mjs");
  const yt = await runYoutubeLearn({ root: ROOT });
  console.log(JSON.stringify({ youtube: { status: yt.status, unitsUsed: yt.unitsUsed, videosNew: yt.videosNew, leads: yt.leads.length } }));
} catch (err) {
  console.error(`youtube skipped: ${err.message}`);
  try { await writeFile(join(ROOT, "data/derived/youtube-leads.json"), JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), keyPresent: Boolean(process.env.YOUTUBE_API_KEY), status: "error", errors: [String(err.message).slice(0, 200)], leads: [] }) + "\n"); } catch {}
}
// TCG Card Investor public ledger (one polite GET). Private store only; counts
// go to data/derived/tcgci-status.json. A block or failure never stops the nightly.
try {
  const { runTcgciLearn } = await import("./tcgci-learn.mjs");
  const tcgci = await runTcgciLearn({ root: ROOT });
  console.log(JSON.stringify({ tcgci: { status: tcgci.status, calls: tcgci.calls, scored: tcgci.scored, crossMatched: tcgci.crossMatched, crossAgreePct: tcgci.crossAgreePct } }));
} catch (err) {
  console.error(`tcgci skipped: ${err.message}`);
  try { await writeFile(join(ROOT, "data/derived/tcgci-status.json"), JSON.stringify({ asOf: new Date().toISOString().slice(0, 10), status: "error", errors: [String(err.message).slice(0, 200)], calls: 0, note: "Counts only." }) + "\n"); } catch {}
}
// Call-pattern + crowd-angle mining (script only). Private first; public
// crowd-attention.json only gets angles that passed n≥20 holdout.
try {
  const { runMineCallPatterns } = await import("./mine-call-patterns.mjs");
  const cp = await runMineCallPatterns({ root: ROOT });
  console.log(JSON.stringify({ callPatterns: { status: cp.status, scored: cp.scored, patternsPassed: cp.patternsPassed, crowdPassed: cp.crowdPassed, publicLines: cp.publicLines } }));
} catch (err) {
  console.error(`call-patterns skipped: ${err.message}`);
}
// Hype-effect reads + crowded-call flags at set / single / sealed (n≥20 holdout each).
try {
  const { runMineHypeCrowd } = await import("./mine-hype-crowd.mjs");
  const hc = await runMineHypeCrowd({ root: ROOT });
  console.log(JSON.stringify({ hypeCrowd: { status: hc.status, levelsPassed: hc.levelsPassed, publicCounts: hc.publicCounts } }));
} catch (err) {
  console.error(`hype-crowd skipped: ${err.message}`);
}
// Year-pattern study (script only). Private store first. The public file lists
// only patterns that also passed on own tcgcsv days. Fill days stay out of it.
// A missing file or any failure never stops the nightly.
try {
  const { runYearPatterns } = await import("./run-year-patterns.mjs");
  const yp = await runYearPatterns({ root: ROOT });
  console.log(JSON.stringify({ yearPatterns: { status: yp.status, passed: yp.passed, failed: yp.failed, publicPatterns: yp.publicPatterns, present: yp.present, forming: yp.forming, warningsPassed: yp.warningsPassed } }));
} catch (err) {
  console.error(`year-patterns skipped: ${err.message}`);
}
// Flags and the script research scan (data/derived/flags.json, research-scan.*).
// Script only, no network. A failure here is logged and never stops the nightly.
try {
  const { runFlagger } = await import("./flagger.mjs");
  const { doc, scan } = await runFlagger({ root: ROOT });
  console.log(JSON.stringify({ flags: doc.flags.length, newFlags: doc.newTonight, flagTypes: doc.summary.byType, newsLeads: scan.newsLeads.length, radarLeads: scan.radarLeads.length }));
} catch (err) { console.error(`flagger skipped: ${err.message}`); }
// Per-read facts for /feed/r/* (feed/facts/<id>.json). Never stops the nightly.
try {
  const { writeReadFacts } = await import("./build-read-facts.mjs");
  console.log(JSON.stringify({ readFacts: await writeReadFacts(ROOT) }));
} catch (err) { console.error(`read facts skipped: ${err.message}`); }
console.log(JSON.stringify({ extra: extraSummary, library: library.counts, health: { nightlyDay: health.nightlyDay, shards: health.shards, lose: health.lose, failures: health.failures } }));
if (health.failures.length) {
  console.error(health.failures.join("\n"));
  process.exit(1);
}
