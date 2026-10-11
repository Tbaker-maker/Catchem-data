// Writes the public health, source list, image-gap count, and search shards.
// Run from the nightly feed build. Does not fetch. Does not invent a number.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStatus, dayOf, freshnessFailures } from "./lib/health-status.mjs";
import { READERS } from "./lib/public-sources.mjs";
import { imageGapReport } from "./lib/image-gap.mjs";
import { buildLiteShards } from "./lib/public-search-shards.mjs";
import { flag } from "./flags.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(root, rel) {
  try {
    return JSON.parse(await readFile(join(root, rel), "utf8"));
  } catch {
    return null;
  }
}

function dated(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "";
  return dayOf(doc.asOf || doc.updatedAt || doc.generatedAt || doc.finishedAt || doc.date || "");
}

export async function writeHealth(root = ROOT, nowMs = Date.now()) {
  const days = [];
  try {
    for (const name of await readdir(join(root, "data/history/tcgcsv-daily"))) {
      if (/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) days.push(name.slice(0, 10));
    }
  } catch { /* the day folder is missing */ }
  const counts = await readJson(root, "research/assets/public/counts.json");
  const sealed = await readJson(root, "data/sealed-prices.json");
  const reads = await readJson(root, "research/assets/public/reads.json");
  const movers = await readJson(root, "research/assets/public/movers.json");
  const accuracy = await readJson(root, "research/assets/public/accuracy.json");
  const track = await readJson(root, "research/assets/public/track-record.json");
  const today = await readJson(root, "research/assets/public/today.json");
  const ppt = await readJson(root, "data/ppt/run-report.json");
  const heartbeat = await readJson(root, "data/heartbeat.json");
  const beatRows = [];
  if (heartbeat && typeof heartbeat === "object") {
    for (const [name, row] of Object.entries(heartbeat)) {
      if (row && row.at) beatRows.push({ name, file: "data/heartbeat.json", at: row.at });
    }
  }
  const imagesOn = flag("images.tcgplayer");
  const status = buildStatus({
    nowMs,
    tcgcsvDays: days,
    sealedUpdatedAt: sealed?.updatedAt || "",
    counts: counts || {},
    readsAsOf: dated(reads),
    moversAsOf: dated(movers),
    accuracyAsOf: dated(accuracy),
    trackAsOf: dated(track),
    todayAsOf: dated(today),
    ppt: ppt ? { callsFailed: ppt.calls?.failed, finishedAt: ppt.finishedAt || "" } : null,
    heartbeat: beatRows,
    imagesTcgplayer: imagesOn,
  });
  const nightlyDay = dated(counts) || status.newestPriceDay || "";
  const listed = [];
  for (const row of READERS) {
    const doc = row.file.endsWith("/") ? null : await readJson(root, row.file);
    const asOf = dated(doc);
    const item = {
      file: row.file,
      readers: row.readers,
      writer: row.writer,
      live: row.live,
      dateRequired: row.dateRequired,
    };
    if (row.note) item.note = row.note;
    if (asOf) item.asOf = asOf;
    else if (row.live && row.dateRequired) item.asOf = "";
    listed.push(item);
  }
  const failures = freshnessFailures(listed, nightlyDay);
  const images = await readJson(root, "research/assets/public/catalogue-images.json");
  const lite = await readJson(root, "research/assets/public/search-lite.json");
  const gap = Array.isArray(lite) ? imageGapReport(lite, images?.images || {}) : { note: "search-lite.json is not an array in this checkout", rows: 0, lose: 0, byType: [] };
  gap.flag = "images.tcgplayer";
  gap.tcgplayer = imagesOn === true;
  const feed = join(root, "research/assets/public/feed");
  await mkdir(feed, { recursive: true });
  await writeFile(join(feed, "status.json"), JSON.stringify(status, null, 1) + "\n");
  await writeFile(join(feed, "sources.json"), JSON.stringify({
    nightlyDay,
    note: "A live file with a date more than 2 days behind nightlyDay fails the nightly check. Files with no date say so in note.",
    files: listed,
  }, null, 1) + "\n");
  await writeFile(join(feed, "image-gap.json"), JSON.stringify(gap, null, 1) + "\n");
  let shards = 0;
  let shardBytes = 0;
  let biggest = 0;
  if (Array.isArray(lite)) {
    const built = buildLiteShards(lite);
    const dir = join(feed, "search/shards");
    await mkdir(dir, { recursive: true });
    const listedShards = {};
    for (const [id, rows] of [...built.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const body = JSON.stringify(rows);
      const bytes = Buffer.byteLength(body);
      await writeFile(join(dir, `${id}.json`), body);
      listedShards[id] = { file: `shards/${id}.json`, count: rows.length, bytes };
      shards += 1;
      shardBytes += bytes;
      if (bytes > biggest) biggest = bytes;
    }
    await writeFile(join(feed, "search/manifest.json"), JSON.stringify({
      asOf: nightlyDay,
      note: "Load this file on the first 2 letters, then only the shards that prefix needs. A shard is a kind plus the first two letters of the name. Prices are the ones already on search-lite.",
      liteBytes: Buffer.byteLength(JSON.stringify(lite)),
      shardBytes,
      biggest,
      shards: listedShards,
    }));
  }
  return { nightlyDay, failures, missingDays: status.missingDays, steps: status.steps.length, shards, shardBytes, biggest, lose: gap.lose || 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const summary = await writeHealth(ROOT);
  console.log(JSON.stringify(summary));
  if (summary.failures.length) {
    console.error(summary.failures.join("\n"));
    process.exit(1);
  }
}
