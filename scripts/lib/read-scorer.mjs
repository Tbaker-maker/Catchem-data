// Hit rate and sample size. A row is published only when the sample is at least 20.

export const MIN_SAMPLE = 20;

export function scoreRead({ id, hits, n }) {
  const sample = Number(n);
  const hitN = Number(hits);
  const sized = Number.isFinite(sample) && sample > 0;
  const counted = Number.isFinite(hitN) && hitN >= 0 && hitN <= sample ? hitN : null;
  const hitRate = sized && counted != null ? Math.round((counted / sample) * 1000) / 1000 : null;
  return {
    id: String(id || ""),
    hits: counted,
    n: sized ? sample : 0,
    hitRate,
    published: sized && counted != null && sample >= MIN_SAMPLE,
  };
}

export function publishScores(rows) {
  return (rows || []).map(scoreRead).filter((row) => row.published);
}
