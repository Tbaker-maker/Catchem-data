// Sealed rows flagged browse:false in data/sealed-products.json (cases,
// displays of several products, sets of several, code cards, accessories,
// empty boxes) stay in the data files and history but are left out of the
// public browse and search lists. Joined by TCGplayer productId only.
export function hiddenSealedPids(rows) {
  const out = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.browse !== false) continue;
    const pid = Number(row.tcgPlayerId);
    if (Number.isInteger(pid) && pid > 0) out.add(pid);
  }
  return out;
}

export function isBrowseHidden(item, pids) {
  return item?.kind === "sealed" && pids.has(Number(item.tcgplayerProductId));
}
