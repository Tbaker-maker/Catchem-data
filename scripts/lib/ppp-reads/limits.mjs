// Cutoffs for the PkmnPrices read pathways. Every pathway has a minimum sample.
// A private override at <private store>/ppp-reads/limits.json may tighten or
// loosen a number; a key it does not name keeps the value here.
// Nothing here is a weight. Weights come only from the scanner gate
// (n >= 20 on both halves of the year, lower bound above the base rate).

export const LIMITS = {
  // Shared
  minPrice: 5, // public reads skip items under $5 on TCGplayer market
  marketSlackDays: 3, // TCGplayer market point must sit within 3 days of the read date
  soldWindowDays: 14, // eBay sold comps window for a median
  compareGapDays: 28, // "four weeks earlier" window for every change
  maxHalfDropShare: 0.25, // a comp window where the half-price filter drops more than this share is a mixed sample: no read
  thinDayRatio: 0.5, // a day whose sales across all tracked products fall under half the median day is a tracking gap
  coverageMinItems: 20, // tracking gaps are judged only with this many products carrying daily sales
  // 1. Sold median vs TCGplayer market
  soldGap: { minComps: 5, minGapPct: 10, minGapUsd: 1, maxGapPct: 60 },
  // 2. Sales pace: last 7 days vs the 8 weeks before
  soldPace: { lagDays: 2, recentDays: 7, baseDays: 56, spikeRatio: 2, spikeMinSales: 8, spikeMinBaseWeekly: 2, dropRatio: 0.4, dropMinBaseWeekly: 5, dropMinRecent: 1 },
  // 3. Sold median trend vs TCGplayer market trend over 28 days
  soldTrend: { minComps: 5, minSoldMovePct: 8, minDivergencePts: 10 },
  // 4. Sell-through: eBay sold in 14 days vs listings counted
  sellThrough: { lagDays: 2, minListings: 10, minSold: 6, riseRatio: 1.5, fallRatio: 0.67, minLevel: 0.25 },
  // 5. Graded population growth week over week (all four graders summed)
  popGrowth: { minNew: 25, minPct: 5, minGapDays: 5, maxGapDays: 9 },
  // 6. Gem rate shift over at least four weeks
  gemShift: { minGapDays: 21, maxGapDays: 35, minNewGraded: 100, minShiftPts: 2 },
  // 7. Low gem pop vs price
  lowPop: { maxGems: 100, minGapDays: 21, maxGapDays: 35, priceUpPct: 10, gemsFlatPct: 5, gemsUpPct: 25, priceDownPct: -10 },
  // 8. PSA 10 vs raw eBay sold spread change
  gradedSpread: { grader: "PSA", grade: "10", minGraded: 3, minRaw: 5, minChangePct: 20 },
  // 9. Cardmarket (EUR, ECB rate) vs TCGplayer gap that moved
  euGap: { minGapPct: 15, minGapMovePts: 10, euSlackDays: 3, fxSlackDays: 4 },
  // 10. Japanese vs English 30-day move
  jpEn: { windowDays: 30, minPoints: 4, minDivergencePts: 15 },
  // 11. 52-week high or low from a year of TCGplayer market history
  range52: { minCoverDays: 300, excludeRecentDays: 7, minPoints: 40 },
  // 12. Sealed eBay sold median vs sourced MSRP
  msrpSold: { minComps: 5, windowDays: 30, highRatio: 1.5, lowRatio: 0.9, minRatioMovePct: 10 },
};

export function mergeLimits(base, over) {
  if (!over || typeof over !== "object") return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    if (!(k in base)) continue;
    if (base[k] && typeof base[k] === "object" && v && typeof v === "object") out[k] = { ...base[k], ...pickNumbers(base[k], v) };
    else if (typeof base[k] === typeof v) out[k] = v;
  }
  return out;
}

function pickNumbers(base, over) {
  const out = {};
  for (const [k, v] of Object.entries(over)) if (k in base && typeof v === typeof base[k]) out[k] = v;
  return out;
}
