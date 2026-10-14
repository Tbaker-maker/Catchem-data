// eBay ask vs TCGplayer market sanity check. Pure functions, no I/O.
// eBay side is ASKING prices, so a ratio a little over 1 is normal.
// Asymmetric lead: older sealed and dear items trade mostly on eBay, so a gap
// there points at a stale or thin TCGplayer price. Ordinary items trade mostly
// on TCGplayer, so a gap there points at a bad eBay match.

export const EBAY_LEAD_USD = 100;
const MODERN = /^(sv|me|zsv|rsv)/;

export function isOlderSealed(setId = "") {
  return !MODERN.test(String(setId));
}

export function band(price) {
  if (!(price > 0)) return "none";
  if (price < 5) return "under-5";
  if (price < 25) return "5-25";
  if (price < 100) return "25-100";
  if (price < 500) return "100-500";
  return "500-plus";
}

// Thresholds on ratio = eBay median ask / TCGplayer market.
// Asks run high, so the upper limit sits higher than the lower one.
export const LIMITS = {
  "under-5": null, // too cheap: shipping and lot noise swamp the ratio
  "5-25": { low: 0.6, high: 2.5 },
  "25-100": { low: 0.65, high: 2.0 },
  "100-500": { low: 0.7, high: 1.8 },
  "500-plus": { low: 0.7, high: 1.6 },
};

export function leadSource({ setId, tcg, ebay }) {
  const ref = Math.max(tcg || 0, ebay || 0);
  return isOlderSealed(setId) || ref >= EBAY_LEAD_USD ? "ebay" : "tcgplayer";
}

// row: { id, setId, ebay, listings, tcg, tcgDate, asOf, tcgFlatDays }
export function checkRow(row) {
  const out = { ...row, ratio: null, band: band(row.tcg), flag: null, why: null, lead: null, action: "none" };
  if (!(row.ebay > 0) || !(row.tcg > 0)) return out;
  out.ratio = Math.round((row.ebay / row.tcg) * 1000) / 1000;
  out.lead = leadSource(row);
  const lim = LIMITS[out.band];
  if (!lim) return out;
  const thin = (row.listings ?? 0) < 8;
  if (out.ratio < lim.low || out.ratio > lim.high) {
    out.flag = out.ratio > lim.high ? "ebay-high" : "ebay-low";
    if (out.lead === "ebay") {
      out.why = row.tcgFlatDays >= 14 ? "TCGplayer price looks stale (flat 14+ days)" : "TCGplayer price looks thin or stale for an item that trades mostly on eBay";
      out.action = thin ? "review" : "mark-tcg";
    } else {
      out.why = out.flag === "ebay-low" ? "eBay asks far under TCGplayer: likely singles, lots, or a different product matched" : "eBay asks far over TCGplayer: likely a bigger or graded product matched";
      out.action = "drop-ebay";
    }
    const far = out.ratio < lim.low * 0.6 || out.ratio > lim.high * 1.5;
    if (far && !thin) out.action = out.lead === "ebay" ? "mark-tcg" : "hide-ebay";
  }
  return out;
}

export function quantiles(nums, qs = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95]) {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return {};
  return Object.fromEntries(qs.map((q) => [`p${Math.round(q * 100)}`, a[Math.min(a.length - 1, Math.floor(q * a.length))]]));
}
