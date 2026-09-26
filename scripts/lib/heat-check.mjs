// Heat Check. A score only where we have the inputs. Missing inputs stay null.

export const WRONG_MATCH_IDS = new Set(["xy12-etb", "sm9-booster-box", "sm1-booster-box"]);

export function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function zscore(latest, series) {
  if (!series || series.length < 30) return null;
  const m = mean(series);
  const sd = Math.sqrt(mean(series.map((x) => (x - m) ** 2)));
  if (sd === 0) return 0;
  return (latest - m) / sd;
}

export function labelFor(score) {
  if (score == null || Number.isNaN(score)) return null;
  if (score <= 20) return "Cold";
  if (score <= 40) return "Cool";
  if (score <= 60) return "Steady";
  if (score <= 80) return "Warm";
  return "Hot";
}

export function scoreFrom(parts) {
  const used = parts.filter((p) => p.z != null && p.weight > 0);
  if (!used.length) return null;
  const w = used.reduce((a, p) => a + p.weight, 0);
  const combined = used.reduce((a, p) => a + p.weight * p.z, 0) / w;
  const score = Math.round(100 / (1 + Math.exp(-combined)));
  return { score, combined: Math.round(combined * 1000) / 1000, partial: used.length !== parts.length, weightsUsed: used.map((p) => p.key) };
}

// rows: [{date, listingCount}] sorted. Window is trailing 90 days ending at asOf.
export function listingHeat(rows, asOf) {
  const end = Date.parse(asOf);
  const start = end - 90 * 86400000;
  const window = rows.filter((r) => {
    const t = Date.parse(r.date);
    return t >= start && t <= end && r.listingCount != null;
  });
  const deltas = [];
  for (let i = 1; i < window.length; i++) {
    deltas.push(window[i].listingCount - window[i - 1].listingCount);
  }
  if (deltas.length < 30) return { z: null, latest: deltas.at(-1) ?? null, days: deltas.length };
  const latest = deltas[deltas.length - 1];
  const z = zscore(latest, deltas);
  return { z: z == null ? null : -z, latest, days: deltas.length, note: "Fewer listings for sale scores hotter. This counts listings, not copies that changed hands." };
}

export function momentum(points) {
  // points: [{date, market}] sorted. Needs 30 market prices. Compares the last 7 to the last 30.
  const priced = points.filter((p) => p.market > 0);
  if (priced.length < 30) return { z: null, latest: null, days: priced.length };
  const last30 = priced.slice(-30).map((p) => p.market);
  const last7 = priced.slice(-7).map((p) => p.market);
  if (last7.length < 7) return { z: null, latest: null, days: priced.length };
  const latest = mean(last7) / mean(last30) - 1;
  const ratios = [];
  for (let i = 30; i <= priced.length; i++) {
    const w = priced.slice(i - 30, i).map((p) => p.market);
    const s = w.slice(-7);
    if (s.length === 7) ratios.push(mean(s) / mean(w) - 1);
  }
  return { z: zscore(latest, ratios), latest, days: priced.length };
}
