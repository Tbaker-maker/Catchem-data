// pack-basis.mjs — RT-4b applied to displayed prices.
// A sealed booster pack is a commodity: any copy is any copy, so the photo
// premium that justifies eBay's higher asks on boxes has no justification
// here. Measured 2026-08-23, eBay pack asks ran 8-51% above TCGplayer on the
// same SKUs. TCGplayer is where this class actually trades, so it is the
// displayed price. The eBay ask is preserved and labelled, never hidden.
export function applyPackBasis(products, divRows) {
  const tcg = new Map((divRows || []).map(r => [r.id, r.tcgMarket]));
  const report = { basis: "TCGplayer market", subtype: "booster-pack", switched: 0, unavailable: [] };
  for (const p of products) {
    if (p.subtype !== "booster-pack" || p.dataStatus !== "live") continue;
    const t = tcg.get(p.id);
    if (t) {
      p.ebayAskMedian = p.ebayAskMedian ?? p.priceMedian;
      p.priceMedian = t;
      p.priceBasis = "tcgplayer";
      report.switched++;
    } else {
      p.priceBasis = "ebay";
      report.unavailable.push(p.id);
    }
  }
  return report;
}
