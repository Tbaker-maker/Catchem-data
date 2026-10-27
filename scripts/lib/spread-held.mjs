// The Spread compared eBay asks to TCGplayer market.
// Sealed prices are TCGplayer market (Tyler, 2026-10-27); eBay is listings
// counted only. When that is true, The Spread is held: no ask rows, and
// yesterday's ask-based report must not be kept as if it were current.

export const SPREAD_HELD_STATUS = "held";

export function isSpreadHeld(sealed) {
  if ((sealed?.priceSource || "") === "TCGplayer market") return true;
  return (sealed?.products || []).some((p) => p.priceSource === "TCGplayer market");
}

export function heldDivergenceReport(sealed, nowIso = new Date().toISOString()) {
  const skipped = (sealed?.products || []).map((p) => ({
    id: p.id,
    reason: "eBay is listings counted, not a price",
  }));
  return {
    generatedAt: nowIso,
    dataStatus: SPREAD_HELD_STATUS,
    heldReason:
      "Sealed prices are TCGplayer market. eBay is listings counted only, so there is no eBay ask to compare and The Spread stays held.",
    method:
      "Held. The Spread compared eBay asks to TCGplayer market. Sealed prices are TCGplayer market (2026-10-27); eBay listing counts stay, eBay asks do not. No cross-market ask row is produced.",
    counts: { compared: 0, signals: 0, skipped: skipped.length },
    rows: [],
    skipped,
  };
}
