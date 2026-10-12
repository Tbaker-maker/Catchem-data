// Sets, eras, and sealed products with zero reads across the nights given.
// A row is listed only when none of its ids appear. Nothing is filled in.

export function sevenNightGaps({ nights = [], sets = [], eras = [], sealed = [] } = {}) {
  const skus = new Set();
  const eraHits = new Set();
  const sealedHits = new Set();
  for (const night of nights) {
    for (const sku of night?.skus || []) skus.add(sku);
    for (const era of night?.eras || []) eraHits.add(era);
    for (const id of night?.sealed || []) sealedHits.add(id);
  }
  const setRows = [];
  for (const set of sets) {
    const ids = Array.isArray(set?.skus) ? set.skus : [];
    if (ids.some((id) => skus.has(id))) continue;
    setRows.push({
      slug: String(set.slug || ""),
      name: String(set.name || ""),
      reads: 0,
      could: set.prices === true ? "set-heat" : "",
    });
  }
  const eraRows = [];
  for (const era of eras) {
    if (eraHits.has(era.name)) continue;
    eraRows.push({
      name: String(era.name || ""),
      reads: 0,
      could: era.kinds === true ? "group-lag" : "",
    });
  }
  const sealedRows = [];
  for (const product of sealed) {
    if (sealedHits.has(product.id)) continue;
    let could = "";
    if (product.prices === true && product.chase === true) could = "sealed-vs-chase";
    else if (product.listings === true && product.combinedArts !== true) could = "listing";
    sealedRows.push({ id: String(product.id || ""), name: String(product.name || ""), reads: 0, could });
  }
  setRows.sort((a, b) => a.slug.localeCompare(b.slug));
  eraRows.sort((a, b) => a.name.localeCompare(b.name));
  sealedRows.sort((a, b) => a.id.localeCompare(b.id));
  return {
    nights: nights.length,
    sets: setRows,
    eras: eraRows,
    sealed: sealedRows,
  };
}
