// Unique YouTube mention counts. No network. A rundown that tags many products
// counts for none. The z-score stays empty until 30 days exist.

import { zscore } from "./heat-check.mjs";

export const VERIFIED_REASONS = new Set(["product_link", "set_sealed_kind"]);

export const VIEWS_HISTORY_SHAPE = {
  videoId: "string",
  date: "YYYY-MM-DD",
  views: "number, cumulative views on that day",
  source: "YouTube Data API v3",
};

function dayCounts(videos, pick, asOf, days) {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = end - (days - 1) * 86400000;
  const byDay = new Map();
  for (let t = start; t <= end; t += 86400000) byDay.set(new Date(t).toISOString().slice(0, 10), 0);
  for (const video of videos || []) {
    const date = String(video?.date || "").slice(0, 10);
    if (!byDay.has(date)) continue;
    const id = pick(video);
    if (!id) continue;
    byDay.set(date, byDay.get(date) + 1);
  }
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, n]) => ({ date, n }));
}

export function uniqueSealedId(video) {
  const mentions = (video?.mentions || []).filter((m) => m && m.kind === "sealed" && VERIFIED_REASONS.has(m.reason));
  const ids = [...new Set(mentions.map((m) => String(m.id)))];
  if (ids.length !== 1) return null;
  const extra = (video?.mentions || []).filter((m) => m && (m.kind === "sealed" || m.kind === "card") && !ids.includes(String(m.id)));
  if (extra.length) return null;
  return ids[0];
}

export function uniqueSetId(video) {
  if (uniqueSealedId(video) == null && (video?.mentions || []).filter((m) => m && (m.kind === "sealed" || m.kind === "card")).length > 1) return null;
  const sets = [...new Set((video?.mentions || []).filter((m) => m && m.kind === "set").map((m) => String(m.id)))];
  if (sets.length !== 1) return null;
  const products = (video?.mentions || []).filter((m) => m && (m.kind === "sealed" || m.kind === "card"));
  if (products.length > 1) return null;
  return sets[0];
}

export function sealedTrail(videos, sealedId, asOf, days = 90) {
  return dayCounts(videos, (video) => (uniqueSealedId(video) === String(sealedId) ? sealedId : null), asOf, days);
}

export function setTrail(videos, setId, asOf, days = 90) {
  return dayCounts(videos, (video) => (uniqueSetId(video) === String(setId) ? setId : null), asOf, days);
}

export function trailZ(daily) {
  const series = (daily || []).map((d) => d.n);
  if (series.length < 30) return { z: null, partial: true, days: series.length };
  const latest = series[series.length - 1];
  const z = zscore(latest, series);
  return { z: z == null ? null : Math.round(z * 1000) / 1000, partial: false, days: series.length };
}

export function publicLine({ n, product, end, asOf }) {
  return `${n} tracked videos uniquely named ${product} in the 7 days to ${end} (YouTube Data API v3, as of ${asOf}).`;
}

export function zForProduct(trailDoc, id) {
  const row = trailDoc?.products?.[id] || trailDoc?.[id];
  if (!row) return null;
  const scored = trailZ(row.daily || row);
  return scored.days >= 30 ? scored.z : null;
}
