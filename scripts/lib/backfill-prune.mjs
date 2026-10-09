// Keep data/history/market-backfill from contradicting the TCGCSV files.
// 1. A product listed in data/history/market-backfill-removed.json has a backfill
//    series for a different printing than the daily file prices. Its whole
//    backfill series is dropped.
// 2. On any day where data/history/tcgcsv-daily or data/history/tcgplayer-market
//    already has a TCGCSV price for that product, the backfill point is dropped,
//    so the TCGCSV point is the only one for that day.
// Nothing is added, moved, or filled in. Points are only removed.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function jsonFiles(dir) {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  } catch (err) {
    if (err?.code === "ENOENT") return [];
    throw err;
  }
}

export async function tcgcsvDays(root) {
  const days = new Map();
  const mark = (pid, day) => {
    const id = Number(pid);
    if (!Number.isInteger(id) || id <= 0 || !isDay(day)) return;
    if (!days.has(id)) days.set(id, new Set());
    days.get(id).add(day);
  };
  const dailyDir = join(root, "data/history/tcgcsv-daily");
  for (const file of await jsonFiles(dailyDir)) {
    const day = file.slice(0, 10);
    if (!isDay(day)) continue;
    const doc = JSON.parse(await readFile(join(dailyDir, file), "utf8"));
    for (const row of doc.prices || []) if (row?.market > 0) mark(row.id, day);
  }
  const watchDir = join(root, "data/history/tcgplayer-market");
  for (const file of await jsonFiles(watchDir)) {
    const doc = JSON.parse(await readFile(join(watchDir, file), "utf8"));
    for (const pt of doc.points || []) {
      if (pt?.source && !/tcgcsv|tcgplayer market/i.test(String(pt.source))) continue;
      if (pt?.market > 0) mark(doc.tcgplayerProductId, pt.date);
    }
  }
  return days;
}

export async function removedIds(root) {
  try {
    const doc = JSON.parse(await readFile(join(root, "data/history/market-backfill-removed.json"), "utf8"));
    return new Set((doc.products || []).map((p) => Number(p.id)).filter((n) => Number.isInteger(n) && n > 0));
  } catch (err) {
    if (err?.code === "ENOENT") return new Set();
    throw err;
  }
}

// Pure: returns the kept series and what was dropped.
export function pruneSeries(series, { removed, tcgcsv }) {
  const kept = {};
  let droppedProducts = 0;
  let droppedPoints = 0;
  let overlapPoints = 0;
  for (const [pid, pts] of Object.entries(series || {})) {
    const id = Number(pid);
    if (removed.has(id)) { droppedProducts += 1; droppedPoints += (pts || []).length; continue; }
    const taken = tcgcsv.get(id);
    const keep = (pts || []).filter((pt) => !(taken && taken.has(pt?.[0])));
    overlapPoints += (pts || []).length - keep.length;
    if (keep.length) kept[pid] = keep;
    else if ((pts || []).length) droppedProducts += 1;
  }
  return { kept, droppedProducts, droppedPoints, overlapPoints };
}

export async function pruneBackfill(root, { write = false } = {}) {
  const dir = join(root, "data/history/market-backfill");
  const removed = await removedIds(root);
  const tcgcsv = await tcgcsvDays(root);
  const totals = { files: 0, changedFiles: 0, droppedProducts: 0, droppedPoints: 0, overlapPoints: 0 };
  for (const file of await jsonFiles(dir)) {
    totals.files += 1;
    const path = join(dir, file);
    const doc = JSON.parse(await readFile(path, "utf8"));
    const r = pruneSeries(doc.series, { removed, tcgcsv });
    totals.droppedProducts += r.droppedProducts;
    totals.droppedPoints += r.droppedPoints;
    totals.overlapPoints += r.overlapPoints;
    if (r.droppedProducts || r.droppedPoints || r.overlapPoints) {
      totals.changedFiles += 1;
      if (write) await writeFile(path, JSON.stringify({ ...doc, series: r.kept }) + "\n", "utf8");
    }
  }
  return totals;
}
