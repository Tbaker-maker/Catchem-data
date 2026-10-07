// Order the daily PPT refresh. Ids and dates only. No prices.

export const BAND_RANK = { sealed: 0, ir: 1, sir: 2, gallery: 3, volume: 4, other: 5 };

export function setBand(set, volume = 0) {
  const tiers = set?.tiers || {};
  if ((tiers.ir || 0) > 0) return "ir";
  if ((tiers.sir || 0) > 0) return "sir";
  if ((tiers.gallery || 0) > 0) return "gallery";
  if (volume > 0) return "volume";
  return "other";
}

export function sanitizeDates(input) {
  const src = input && typeof input === "object" && input.dates && typeof input.dates === "object" ? input.dates : input;
  const out = {};
  if (!src || typeof src !== "object") return out;
  for (const [id, value] of Object.entries(src)) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) out[id] = value.slice(0, 10);
  }
  return out;
}

export function orderRefreshCalls(calls) {
  return [...(calls || [])].sort((a, b) => {
    const rank = (BAND_RANK[a.priority] ?? 5) - (BAND_RANK[b.priority] ?? 5);
    if (rank) return rank;
    if (a.priority === "volume" && (b.volume || 0) !== (a.volume || 0)) return (b.volume || 0) - (a.volume || 0);
    const left = a.refreshed || "";
    const right = b.refreshed || "";
    if (left !== right) {
      if (!left) return -1;
      if (!right) return 1;
      return left < right ? -1 : 1;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}

// ── Empty sealed lookups ───────────────────────────────────────────────────
// Some sealed tcgPlayerIds come back from PPT with data: [] yet are still
// billed (2 credits each on 2026-10-06, 75 of 389). We remember the day an id
// came back empty and skip it until EMPTY_RECHECK_DAYS have passed, then ask
// once more. Any non-empty answer clears the mark. Ids only; no prices.
export const EMPTY_RECHECK_DAYS = 7;

export function sanitizeEmpty(input) {
  const src = input && typeof input === "object" && input.emptySealed && typeof input.emptySealed === "object" ? input.emptySealed : {};
  const out = {};
  for (const [id, value] of Object.entries(src)) {
    if (/^sealed-/.test(id) && typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) out[id] = value.slice(0, 10);
  }
  return out;
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** Drops sealed calls whose id came back empty less than EMPTY_RECHECK_DAYS ago. */
export function skipRecentEmpty(calls, empty, today, days = EMPTY_RECHECK_DAYS) {
  const kept = [];
  const skipped = [];
  for (const call of calls || []) {
    const seen = call?.bucket === "sealed" ? empty?.[call.id] : null;
    if (seen && daysBetween(seen, today) >= 0 && daysBetween(seen, today) < days) skipped.push(call.id);
    else kept.push(call);
  }
  return { calls: kept, skipped };
}

/** Next empty map: today's empties marked, today's non-empty answers cleared. */
export function nextEmptySealed(prev, { done = [], empty = [], today }) {
  const out = { ...(prev || {}) };
  const emptySet = new Set(empty);
  for (const id of done) {
    if (!/^sealed-/.test(id)) continue;
    if (emptySet.has(id)) out[id] = today;
    else delete out[id];
  }
  return Object.fromEntries(Object.keys(out).sort().map((id) => [id, out[id]]));
}
