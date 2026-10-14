export function scannerWeekly({ asOf, summary, weights }) {
  const rows = (weights?.rows || []).filter((row) => row.passed);
  rows.sort((a, b) => (b.weight || 0) - (a.weight || 0) || (a.pattern < b.pattern ? -1 : 1));
  return {
    asOf,
    passed: rows.length,
    scored: (weights?.rows || []).length,
    top: rows.slice(0, 10).map((row) => ({
      pattern: row.pattern, stage: row.stage, kind: row.kind, dir: row.dir, horizon: row.horizon,
      n: row.n, rate: row.rate, weight: row.weight, eraFactor: row.eraFactor ?? null,
    })),
    listingsProgress: summary?.listingsProgress || [],
    note: rows.length ? "Patterns that already passed the public gate, ordered by era-weighted score." : "No scanner weight file was mounted, so this report has no passed rows.",
  };
}
