// pack-basis.mjs — RT-4b applied to displayed prices.
// A sealed booster pack is a commodity: any copy is any copy, so the photo
// premium that justifies eBay's higher asks on boxes has no justification
// here. Measured 2026-08-23, eBay pack asks ran 8-51% above TCGplayer on the
// same SKUs. TCGplayer is where this class actually trades, so it is the
// displayed price. The eBay ask is preserved and labelled, never hidden.
export function applyPackBasis(products, divRows) {
  const tcg = new Map((divRows || []).map(r => [r.id, r.tcgMarket]));
  const report = { basis: "TCGplayer market", subtype: "booster-pack", switched: 0, unavailable: [], rebased: [] };
  for (const p of products) {
    if (p.subtype !== "booster-pack" || p.dataStatus !== "live") continue;
    const t = tcg.get(p.id);
    if (t) {
      const wasEbay = p.priceBasis !== "tcgplayer";
      p.ebayAskMedian = p.ebayAskMedian ?? p.priceMedian;
      p.priceMedian = t;
      p.priceBasis = "tcgplayer";
      // REBASE ON A BASIS CHANGE (2026-08-23): switching a product from eBay
      // asks to TCGplayer prices lowers its number without the market moving.
      // Left alone that lands in the index as a crash — the sealed index fell
      // 3.9% the day packs switched, which measured our own decision, not the
      // market. Same principle as chain-linking the baseline: a methodology
      // change must never print as price movement.
      if (wasEbay) { p.basisChangedOn = new Date().toISOString().slice(0, 10); report.rebased.push(p.id); }
      report.switched++;
    } else {
      p.priceBasis = "ebay";
      report.unavailable.push(p.id);
    }
  }
  return report;
}
