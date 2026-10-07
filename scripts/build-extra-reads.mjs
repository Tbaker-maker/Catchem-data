// Builds lag, group, and browse files from prices already on disk.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleCatalog, buildBrowse, supplyNotes } from "./lib/extra-reads.mjs";
import {
  diveTeaserReads,
  interleaveExtraKinds,
  loadDiveDocsForTeasers,
  loadOutlierDoc,
  outlierReads,
} from "./lib/outlier-dive-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (rel) => JSON.parse(await readFile(join(ROOT, rel), "utf8"));

function addPoint(map, pid, date, market) {
  const id = Number(pid);
  const value = Number(market);
  const day = String(date || "");
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(value > 0)) return;
  if (!map.has(id)) map.set(id, new Map());
  map.get(id).set(day, Math.round(value * 100) / 100);
}

export async function loadSeries(root = ROOT) {
  const series = new Map();
  for (const file of (await readdir(join(root, "data/history/market-backfill"))).sort()) {
    if (!file.endsWith(".json")) continue;
    const doc = JSON.parse(await readFile(join(root, "data/history/market-backfill", file), "utf8"));
    for (const [pid, pts] of Object.entries(doc.series || {})) {
      for (const pt of pts || []) addPoint(series, pid, pt?.[0], pt?.[1]);
    }
  }
  try {
    for (const file of await readdir(join(root, "data/history/tcgplayer-market"))) {
      if (!file.endsWith(".json")) continue;
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgplayer-market", file), "utf8"));
      for (const pt of doc.points || []) {
        if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
        addPoint(series, doc.tcgplayerProductId, pt.date, pt.market);
      }
    }
  } catch { /* optional */ }
  for (const file of (await readdir(join(root, "data/history/tcgcsv-daily"))).sort()) {
    if (!file.endsWith(".json")) continue;
    const day = file.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", file), "utf8"));
    for (const row of doc.prices || []) addPoint(series, row.id, day, row.market);
  }
  return series;
}

export function supplyMap(docs) {
  const map = new Map();
  for (const note of supplyNotes(docs)) {
    const key = note.set || "";
    if (key && !map.has(key)) map.set(key, note.text);
  }
  return map;
}

export function publicRead(row) {
  const out = {
    id: row.id,
    sku: row.sku,
    readKind: row.readKind,
    kind: row.kind,
    name: row.name,
    set: row.set || "",
    path: row.path,
    headline: row.headline,
    why: row.why,
    fullFile: "feed/extra-reads.json",
  };
  if (row.diveId) out.diveId = row.diveId;
  if (row.href) out.href = row.href;
  if (Number(row.price) > 0) out.price = Number(row.price);
  if (row.asOf) out.asOf = row.asOf;
  if (row.flagged) out.flagged = row.flagged;
  if (row.severity) out.severity = row.severity;
  if (row.pctGap != null) out.pctGap = row.pctGap;
  if (row.direction) out.direction = row.direction;
  if (row.sources) out.sources = row.sources;
  return out;
}

export async function writeExtra(root, extra, browse) {
  const outDir = join(root, "research/assets/public/feed");
  await writeFile(join(outDir, "extra-reads.json"), JSON.stringify(extra, null, 1) + "\n");
  await writeFile(join(outDir, "browse.json"), JSON.stringify(browse) + "\n");
  const readsPath = join(root, "research/assets/public/reads.json");
  const doc = JSON.parse(await readFile(readsPath, "utf8"));
  const drop = new Set(["lag", "group", "supply", "outlier", "dive"]);
  const kept = (doc.reads || []).filter((row) => !drop.has(row.readKind));
  const extras = (extra.reads || []).map(publicRead);
  const frontExtras = extras.filter((r) => r.readKind === "outlier")
    .concat(extras.filter((r) => r.readKind === "dive").slice(0, 4));
  // Sprinkle a few flagged and dive teasers into the short front. Prices stay.
  doc.reads = interleaveExtraKinds(kept, frontExtras, { every: 2 });
  doc.filterField = "readKind";
  await writeFile(readsPath, JSON.stringify(doc, null, 1) + "\n");
  return {
    lag: extra.lag?.reads?.length || 0,
    missingPrice: extra.lag?.missingPrice?.length || 0,
    omitted: extra.lag?.omitted?.length || 0,
    group: extra.group?.reads?.length || 0,
    outliers: (extra.reads || []).filter((r) => r.readKind === "outlier").length,
    dives: (extra.reads || []).filter((r) => r.readKind === "dive").length,
    volume: Array.isArray(extra.volume) ? extra.volume.length : 0,
    browse: browse.unfiltered.length,
  };
}

// ── ONE PATH FOR FLAGGED AND DIVE READS ─────────────────────────────────────
// The nightly rebuild (build-feed.mjs) called writeExtra with only the catalog
// reads. writeExtra drops every outlier/dive row from reads.json and adds back
// only what it is handed, so each night stripped the flagged-price and dive
// teasers that build-extra-reads had shipped, and emptied the Flagged and Dive
// browse filters. Both callers now go through here, which reads the rows from
// the files on disk — data/derived/sealed-price-outliers.json and
// research/pulse/dive/ — and ships none when those files have none.
export async function flaggedAndDiveReads(root = ROOT) {
  const flagged = outlierReads(await loadOutlierDoc(root));
  const dives = diveTeaserReads(await loadDiveDocsForTeasers(root, { max: 12 }));
  return { flagged, dives };
}

export async function writeFeedExtras(root, extra, { asOf, cardIds, rankedIds, news, waves }) {
  const { flagged, dives } = await flaggedAndDiveReads(root);
  const fresh = new Set(["outlier", "dive"]);
  extra.reads = [...(extra.reads || []).filter((r) => !fresh.has(r.readKind)), ...flagged, ...dives];
  extra.flagged = { count: flagged.length, source: "data/derived/sealed-price-outliers.json" };
  extra.dives = { count: dives.length, source: "research/pulse/dive/" };
  const browse = buildBrowse({
    asOf,
    cardIds,
    rankedIds,
    news,
    waves,
    flagged: flagged.map(publicRead),
    dives: dives.map(publicRead),
  });
  return writeExtra(root, extra, browse);
}

async function main() {
  const catalog = await read("data/catalog/tcgcsv-latest.json");
  const series = await loadSeries(ROOT);
  const divergence = await read("data/divergence-report.json").catch(() => ({ rows: [] }));
  const supplyWatch = await read("data/supply-watch.json").catch(() => ({ rows: [] }));
  const notes = [...(divergence.rows || []), ...(supplyWatch.rows || [])];
  const extra = assembleCatalog(catalog.items || [], series, { asOf: catalog.asOf, supplyBySet: supplyMap(notes) });
  extra.supplyNotes = supplyNotes(notes);
  const catalogue = await read("research/assets/public/feed/catalogue.json");
  const cardIds = Object.keys(catalogue.cards || {});
  const ranked = [];
  const seen = new Set();
  for (const part of ["up", "down", "today", "watch", "cook"]) {
    for (const id of catalogue[part] || []) {
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
  } catch { /* news file is optional for the browse shell */ }
  // Volume stays empty until Insights solds exist. Do not invent.
  extra.volume = [];
  extra.volumeNote = extra.volumeNote || "No sold count is on file, so no volume read ships.";
  const summary = await writeFeedExtras(ROOT, extra, {
    asOf: catalog.asOf,
    cardIds,
    rankedIds: ranked,
    news: new Array(newsCount),
    waves,
  });
  console.log(JSON.stringify(summary));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
