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
