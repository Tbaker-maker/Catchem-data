// Supply Watch compares eBay listing counts to a TCG listing history.
// When that history is not read (PPT_OFF, or the private file is missing),
// there is nothing to compare. Do not keep yesterday's rows, and do not invent counts.

export function heldSupplyWatch(nowIso = new Date().toISOString()) {
  return {
    generatedAt: nowIso,
    dataStatus: "held",
    heldReason: "TCG listing history was not read, so no cross-market supply row was produced. Listing counts were not invented.",
    method: "Held. Supply Watch compares 7-day listing-count deltas, eBay vs TCG-side. With no TCG history there is nothing to compare.",
    counts: { read: 0, maturing: 0, signals: 0 },
    rows: [],
    maturing: [],
  };
}
