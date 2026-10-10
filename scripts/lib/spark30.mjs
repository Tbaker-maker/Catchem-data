// Last 30 calendar days of a stored TCGplayer market series.
// A day that is not on file is left out. Nothing is filled in.
// Offset 0 is the catalog day. Offset 29 is 29 days earlier.

export function packSpark(hist, asOf) {
  const end = String(asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return "";
  const endMs = Date.parse(`${end}T00:00:00Z`);
  const startMs = endMs - 29 * 86400000;
  const pts = [];
  for (const point of hist || []) {
    if (!Array.isArray(point)) continue;
    const day = String(point[0] || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const t = Date.parse(`${day}T00:00:00Z`);
    const v = Number(point[1]);
    if (!(v > 0) || t < startMs || t > endMs) continue;
    const off = Math.round((endMs - t) / 86400000);
    if (off < 0 || off > 29) continue;
    pts.push([off, v]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const dedup = [];
  for (const point of pts) {
    if (dedup.length && dedup[dedup.length - 1][0] === point[0]) dedup[dedup.length - 1] = point;
    else dedup.push(point);
  }
  if (dedup.length < 2) return "";
  return dedup.map(([off, v]) => `${off}:${v}`).join(",");
}
