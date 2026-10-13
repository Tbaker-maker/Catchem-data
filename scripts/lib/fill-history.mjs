// Earlier chart history from approved fill sources (config/fill-sources.json).
// Our own data always wins: a fill point is used only for dates BEFORE the
// product's first own day. Fill points feed the chart line only, never the
// movers, reads or signals, which stay on our own days.
// Turning a source off is one flag: "chartFill": false on its entry.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

function readDoc(file) {
  const buf = readFileSync(file);
  return JSON.parse((file.endsWith(".gz") ? gunzipSync(buf) : buf).toString("utf8"));
}

export function enabledFills(root) {
  try {
    const cfg = JSON.parse(readFileSync(join(root, "config/fill-sources.json"), "utf8"));
    return (cfg.allowed || []).filter((s) => s.chartFill === true && s.robotsBlocked !== true && s.rawFile);
  } catch { return []; }
}

// Map<pid, { key, points: [[date, price]] }> from every enabled source. First source wins per product.
export function loadFillMap(root) {
  const map = new Map();
  for (const src of enabledFills(root)) {
    let doc;
    try { doc = readDoc(join(root, src.rawFile)); } catch { continue; }
    for (const item of doc.items || []) {
      const pid = Number(item.pid);
      if (!pid || map.has(pid)) continue;
      map.set(pid, { key: src.key, points: item.points || [] });
    }
  }
  return map;
}

// own: sorted [[date, price]]. Returns { points, fillTo } where fillTo is our first own day
// when any fill point was added, else null.
export function withFill(own, fill) {
  const mine = (own || []).filter((p) => Array.isArray(p));
  if (!fill || !mine.length) return { points: mine, fillTo: null, fillKey: null };
  const first = mine[0][0];
  const early = (fill.points || [])
    .filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(p[0]) && Number(p[1]) > 0 && p[0] < first)
    .map((p) => [p[0], Math.round(Number(p[1]) * 100) / 100])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  if (!early.length) return { points: mine, fillTo: null, fillKey: null };
  return { points: [...early, ...mine], fillTo: first, fillKey: fill.key };
}
