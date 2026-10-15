// Weekly pattern lab. A pattern is promoted only when each card is counted once
// per episode, the false-discovery check passes, and the edge is at least 5 points.

export const MIN_EDGE = 5;
export const FDR_Q = 0.05;

export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z >= 0 ? 1 - p : p;
}

export function oneCount(rows) {
  const seen = new Set();
  const kept = [];
  let duplicates = 0;
  for (const row of rows || []) {
    const key = `${row.episode || ""}|${row.cardId || ""}|${row.pattern || ""}`;
    if (seen.has(key)) { duplicates += 1; continue; }
    seen.add(key);
    kept.push(row);
  }
  return { kept, duplicates };
}

export function patternStats(rows) {
  const { kept, duplicates } = oneCount(rows);
  const baseHits = kept.filter((row) => row.hit === true).length;
  const baseN = kept.length;
  const baseRate = baseN ? baseHits / baseN : 0;
  const byPattern = new Map();
  for (const row of kept) {
    if (!byPattern.has(row.pattern)) byPattern.set(row.pattern, []);
    byPattern.get(row.pattern).push(row);
  }
  const patterns = [];
  for (const [pattern, group] of byPattern) {
    const hits = group.filter((row) => row.hit === true).length;
    const n = group.length;
    const rate = n ? hits / n : 0;
    const edge = (rate - baseRate) * 100;
    let p = 1;
    if (n > 0 && baseRate > 0 && baseRate < 1) {
      const z = (rate - baseRate) / Math.sqrt(baseRate * (1 - baseRate) / n);
      p = 1 - normalCdf(z);
    } else if (n > 0 && rate > baseRate) p = 0;
    patterns.push({
      pattern,
      n,
      hits,
      rate: Math.round(rate * 1000) / 1000,
      edge: Math.round(edge * 10) / 10,
      p: Math.round(p * 10000) / 10000,
    });
  }
  return { kept, duplicates, baseN, baseRate, patterns };
}

export function falseDiscovery(patterns, q = FDR_Q) {
  const ranked = [...patterns].sort((a, b) => a.p - b.p || a.pattern.localeCompare(b.pattern));
  const m = ranked.length || 1;
  let cutoff = -1;
  ranked.forEach((row, index) => {
    const limit = ((index + 1) / m) * q;
    if (row.p <= limit) cutoff = index;
  });
  const passed = new Set(ranked.slice(0, cutoff + 1).map((row) => row.pattern));
  return ranked.map((row) => ({ ...row, fdr: passed.has(row.pattern) }));
}

export function promotePatterns(rows, { q = FDR_Q, minEdge = MIN_EDGE } = {}) {
  const stats = patternStats(rows);
  const tested = falseDiscovery(stats.patterns, q);
  const promoted = tested.filter((row) => row.fdr && row.edge >= minEdge && row.n >= 1);
  return { ...stats, tested, promoted };
}
