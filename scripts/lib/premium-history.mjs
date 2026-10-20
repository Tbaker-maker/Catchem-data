// Premium history from the tcgcsv daily archive.
// flagFromSeries still sees [day, market] only. A nightly point always wins
// over an archive point on the same day. A missing price stays a gap.
// The unit jump bound stays in the private index guard. This file has no cutoff.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { foldSet, skipBoxName } from "./premium-ratio.mjs";

export const ARCHIVE_SOURCE = "tcgcsv-archive";
export const SCOPE_SUBTYPES = ["booster-box", "booster-pack", "etb", "booster-bundle"];

// H block first, then every other set that has a booster box.
export const H_BLOCK = [
  "temporal forces",
  "twilight masquerade",
  "shrouded fable",
  "stellar crown",
  "surging sparks",
  "prismatic evolutions",
];

export function decideArchiveStop(status) {
  return Number(status) !== 200;
}

export function scopeProducts(products) {
  const rows = (Array.isArray(products) ? products : []).filter((row) => SCOPE_SUBTYPES.includes(row?.subtype) && row.tcgPlayerId);
  const boxSets = new Set(rows.filter((row) => row.subtype === "booster-box").map((row) => foldSet(row.set)));
  const h = new Set(H_BLOCK);
  const ranked = rows.filter((row) => h.has(foldSet(row.set)) || boxSets.has(foldSet(row.set)));
  const rank = (row) => {
    const at = H_BLOCK.indexOf(foldSet(row.set));
    return at === -1 ? H_BLOCK.length : at;
  };
  ranked.sort((a, b) => rank(a) - rank(b) || foldSet(a.set).localeCompare(foldSet(b.set)) || String(a.tcgPlayerId).localeCompare(String(b.tcgPlayerId)));
  return ranked;
}

// Same printing pick as the chart backfill. No market price, or more than one
// printing with no single Normal row, is a gap. Nothing is filled in.
export function pickMarket(rows) {
  const withMarket = (rows || []).filter((row) => Number(row?.marketPrice ?? row?.market) > 0);
  if (!withMarket.length) return null;
  const normal = withMarket.filter((row) => (row.subTypeName || row.printing) === "Normal");
  const row = normal.length === 1 ? normal[0] : (withMarket.length === 1 ? withMarket[0] : null);
  if (!row) return null;
  const market = Number(row.marketPrice ?? row.market);
  const listed = Number(row.midPrice ?? row.listedMedian);
  return {
    market,
    printing: String(row.subTypeName || row.printing || ""),
    ...(listed > 0 ? { listedMedian: listed } : {}),
  };
}

// Pack vs box vs case on the same set and day. A pack at or above the plain
// box, or a box at or under the pack, is the wrong unit and is dropped.
export function crossUnitDropKeys(points) {
  const groups = new Map();
  for (const row of points || []) {
    if (!(Number(row?.market) > 0) || !row?.date) continue;
    const key = `${foldSet(row.set)}|${row.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const drop = new Set();
  const idKey = (row) => `${row.id}|${row.date}`;
  for (const group of groups.values()) {
    const boxes = group.filter((row) => row.subtype === "booster-box" && !skipBoxName(row.name));
    const packs = group.filter((row) => row.subtype === "booster-pack");
    const cases = group.filter((row) => row.subtype === "case");
    const box = boxes.length ? Math.min(...boxes.map((row) => Number(row.market))) : 0;
    const cheapPack = packs.length ? Math.min(...packs.map((row) => Number(row.market))) : 0;
    const casePx = cases.length ? Math.min(...cases.map((row) => Number(row.market))) : 0;
    if (box > 0) {
      for (const row of packs) if (Number(row.market) >= box) drop.add(idKey(row));
      for (const row of boxes) if (cheapPack > 0 && Number(row.market) <= cheapPack) drop.add(idKey(row));
      for (const row of cases) if (Number(row.market) <= box) drop.add(idKey(row));
      if (casePx > box) for (const row of packs) if (Number(row.market) >= casePx) drop.add(idKey(row));
    } else if (cases.length && packs.length) {
      const packPx = Math.max(...packs.map((row) => Number(row.market)));
      for (const row of packs) if (Number(row.market) >= casePx) drop.add(idKey(row));
      for (const row of cases) if (Number(row.market) <= packPx) drop.add(idKey(row));
    }
  }
  return drop;
}

// existing nightly rows are kept as they are. An archive row for an id already
// on that day is ignored. A row with no market is a gap and is not written.
export function applyArchiveDay(existingPrices, incoming, dropKeys = new Set()) {
  const have = new Set((existingPrices || []).map((row) => String(row?.id ?? "")));
  const added = [];
  const keptNightly = [];
  const gaps = [];
  const droppedUnit = [];
  for (const row of incoming || []) {
    const id = String(row?.id ?? "");
    if (!id) continue;
    if (!(Number(row.market) > 0)) { gaps.push(id); continue; }
    if (have.has(id)) { keptNightly.push(id); continue; }
    if (dropKeys.has(`${id}|${row.date}`)) { droppedUnit.push(id); continue; }
    const point = { id: row.id, market: Number(row.market), source: ARCHIVE_SOURCE };
    if (row.printing) point.printing = row.printing;
    if (Number(row.listedMedian) > 0) point.listedMedian = Number(row.listedMedian);
    added.push(point);
    have.add(id);
  }
  return { prices: [...(existingPrices || []), ...added], added, keptNightly, gaps, droppedUnit };
}

// Drop a point that is junk against the middle of its own series, then a point
// that jumps past the private bound against its neighbor. The bound is passed
// in. Gaps are not filled. Returns the kept points in date order.
export function dropOutliers(points, guard) {
  let kept = (points || []).filter((row) => Number(row?.market) > 0 && row?.date).map((row) => ({ ...row })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const dropped = [];
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };
  if (Number(guard?.junkX) > 1 && kept.length >= 3) {
    const mid = median(kept.map((row) => Number(row.market)));
    const next = [];
    for (const row of kept) {
      const market = Number(row.market);
      if (mid > 0 && (market > mid * guard.junkX || market * guard.junkX < mid)) dropped.push({ ...row, why: "junk" });
      else next.push(row);
    }
    kept = next;
  }
  const hi = Number(guard?.stepHi);
  const lo = Number(guard?.stepLo);
  if (hi > 1 && lo > 0 && lo < 1) {
    let changed = true;
    while (changed && kept.length >= 2) {
      changed = false;
      const mid = median(kept.map((row) => Number(row.market))) || 1;
      for (let i = 1; i < kept.length; i += 1) {
        const ratio = Number(kept[i].market) / Number(kept[i - 1].market);
        if (!(ratio > hi || ratio < lo)) continue;
        const left = Math.abs(Math.log(Number(kept[i - 1].market) / mid));
        const right = Math.abs(Math.log(Number(kept[i].market) / mid));
        const idx = right > left ? i : i - 1;
        dropped.push({ ...kept[idx], why: "unit-jump" });
        kept.splice(idx, 1);
        changed = true;
        break;
      }
    }
  }
  return { kept, dropped };
}

// Archive days are applied first. A nightly point replaces an archive point
// for the same id and day. The series value is the nightly price.
export function foldPriceDays(days) {
  const series = new Map();
  const apply = (day, overwrite) => {
    for (const row of day?.prices || []) {
      const id = String(row?.id ?? "");
      const market = Number(row?.market);
      if (!id || !(market > 0) || !day?.date) continue;
      if (!series.has(id)) series.set(id, new Map());
      const map = series.get(id);
      if (map.has(day.date) && !overwrite) continue;
      map.set(day.date, market);
    }
  };
  for (const day of days || []) if (!day?.nightly) apply(day, false);
  for (const day of days || []) if (day?.nightly) apply(day, true);
  return series;
}

export function seriesForPremium(days, wantIds) {
  const folded = foldPriceDays(days);
  const series = new Map();
  let asOf = "";
  for (const day of days || []) if (day?.date && day.date > asOf) asOf = day.date;
  for (const id of wantIds || []) {
    const map = folded.get(String(id));
    if (!map?.size) continue;
    series.set(String(id), [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
  }
  return { series, asOf };
}

// series: Map id -> [{ date, market, archive }]. Only ids that have an archive
// point are judged. A missing bound fails closed when any archive point exists.
export function backfillUnitJumps(series, guard) {
  const jumps = [];
  let any = false;
  for (const [id, rows] of series || []) {
    if (!(rows || []).some((row) => row?.archive)) continue;
    any = true;
    const hi = Number(guard?.stepHi);
    const lo = Number(guard?.stepLo);
    if (!(hi > 1) || !(lo > 0 && lo < 1)) return { failed: true, missingBound: true, jumps: [] };
    const byDate = new Map();
    for (const row of rows || []) {
      if (!(Number(row?.market) > 0) || !row?.date) continue;
      const prev = byDate.get(row.date);
      if (!prev || (prev.archive && !row.archive)) byDate.set(row.date, row);
    }
    const sorted = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (let i = 1; i < sorted.length; i += 1) {
      const ratio = Number(sorted[i].market) / Number(sorted[i - 1].market);
      if (ratio > hi || ratio < lo) jumps.push(String(id));
    }
  }
  return { failed: jumps.length > 0, missingBound: false, jumps: any ? jumps : [] };
}

export async function loadHistoryDays(dir) {
  const out = [];
  const take = async (folder, nightly) => {
    let names = [];
    try { names = (await readdir(folder)).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort(); } catch { return; }
    for (const name of names) {
      let day = null;
      try { day = JSON.parse(await readFile(join(folder, name), "utf8")); } catch { continue; }
      out.push({ date: String(day?.date || name.slice(0, 10)), nightly, prices: Array.isArray(day?.prices) ? day.prices : [] });
    }
  };
  await take(dir, true);
  await take(join(dir, "archive"), false);
  return out;
}

export async function loadSanityBound(root) {
  const readGuard = async (file) => {
    try {
      const doc = JSON.parse(await readFile(file, "utf8"));
      return doc?.guard || null;
    } catch { return null; }
  };
  const local = await readGuard(join(root, "data/private/index-history/config.json"));
  if (local) return local;
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const { openPrivate } = await import("./private-store.mjs");
    const store = await openPrivate({ root, token });
    try { return await readGuard(join(store.dir, "index-history/config.json")); }
    finally { await store.close([], "premium history bound read only"); }
  } catch { return null; }
}
