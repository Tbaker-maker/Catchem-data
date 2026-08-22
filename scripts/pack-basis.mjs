// pack-basis.mjs — RT-4b applied to displayed prices.
// A sealed booster pack is a commodity: any copy is any copy, so the photo
// premium that justifies eBay's higher asks on boxes has no justification
// here. Measured 2026-08-23, eBay pack asks ran 8-51% above TCGplayer on the
// same SKUs. TCGplayer is where this class actually trades, so it is the
// displayed price. The eBay ask is preserved and labelled, never hidden.
// LICENSING GATE (2026-08-23). Our TCGplayer figures are PPT-derived, and
// PPT restricts commercial use to their $99 tier. Until that licence exists,
// TCG prices may inform our internal reads but must NOT be the number we
// publish. Flip CATCHEM_PPT_LICENSED=1 once the licence is in hand.
// Publishing data we are not licensed to publish is not a risk we take to
// win a more accurate pack price.
const PPT_LICENSED = process.env.CATCHEM_PPT_LICENSED === "1";

// LICENSING FLAG (2026-08-23). PPT's terms reserve commercial use for the $99
// Business tier; Free and API tiers are "personal and development purposes".
// Displaying PPT-derived pack prices on a public site is commercial use. Until
// that is settled in writing, this flag decides whether packs show TCGplayer
// prices (accurate, licensing-exposed) or eBay asks (compliant, 8-51% high).
// Set CATCHEM_PPT_PUBLIC=1 once licensing is confirmed.
// TYLER'S RULING (2026-08-23): Catch'em is a free tool with no revenue, in
// development. He accepts the current posture and will pay for the commercial
// tier — and for grading population reports — when monetisation begins.
// THE TRIGGER, so this is never forgotten at the moment it matters: licensing
// must be resolved BEFORE the first dollar is charged, not after. Anything
// that turns this into a commercial product (a Pro tier, ads, sponsorship,
// paid placement) requires the upgrade first.
const PPT_PUBLIC_OK = process.env.CATCHEM_PPT_PUBLIC !== "0";

export function applyPackBasis(products, divRows) {
  if (!PPT_PUBLIC_OK) {
    for (const p of products) if (p.subtype === "booster-pack") p.priceBasis = "ebay";
    return { basis: "eBay ask (PPT display paused pending licensing)", subtype: "booster-pack",
      switched: 0, unavailable: [], rebased: [],
      note: "Pack prices are showing eBay asks, which run high on this class. TCGplayer pricing returns the moment PPT licensing is confirmed in writing." };
  }
  if (!PPT_LICENSED) {
    for (const p of products) if (p.subtype === "booster-pack") p.priceBasis = "ebay";
    return { basis: "eBay asks (TCGplayer basis held pending PPT commercial licence)",
      subtype: "booster-pack", switched: 0, unavailable: [], rebased: [], licenceHeld: true };
  }
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
