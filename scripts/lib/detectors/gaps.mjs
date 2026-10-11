// Sets with no boarded sku. Does not invent a read for the gap.

export function gapReport({ sets = [], covered = [] } = {}) {
  const have = new Set(covered);
  const rows = [];
  for (const set of sets) {
    const skus = Array.isArray(set?.skus) ? set.skus : [];
    const hits = skus.filter((sku) => have.has(sku)).length;
    if (hits > 0) continue;
    rows.push({
      slug: String(set?.slug || ""),
      name: String(set?.name || ""),
      products: skus.length,
      reads: 0,
    });
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    sets: sets.length,
    uncovered: rows.length,
    rows,
  };
}
