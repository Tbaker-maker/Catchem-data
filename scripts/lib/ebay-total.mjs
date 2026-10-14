// eBay Browse result-set size. 10,000 is the documented hard cap. 713 is a
// stuck total when the same number comes back on many unrelated searches.

export const EBAY_HARD_CAP = 10000;
export const EBAY_STUCK_TOTAL = 713;
export const EBAY_STUCK_MIN = 5;

export function applyTotalCaps(rows) {
  const list = rows || [];
  let stuckN = 0;
  for (const row of list) if (row?.browseTotal === EBAY_STUCK_TOTAL) stuckN += 1;
  const stuck = stuckN >= EBAY_STUCK_MIN;
  return list.map((row) => {
    const hard = row?.browseTotal === EBAY_HARD_CAP;
    const repeat = stuck && row?.browseTotal === EBAY_STUCK_TOTAL;
    if (!hard && !repeat) return row;
    return {
      ...row,
      listingsCounted: null,
      totalCapped: true,
      cap: hard ? EBAY_HARD_CAP : EBAY_STUCK_TOTAL,
    };
  });
}
