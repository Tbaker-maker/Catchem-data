// Second pass for sealed ids that are still in review.
// Auto-apply only at 0.85 or higher, with a lead of 0.08 or more.
// No network. No prices. No invented ids.

export const AUTO_CONFIDENCE = 0.85;
export const LEAD = 0.08;

const TYPES = [
  ["pc-etb", /pok[eé]mon center/],
  ["etb", /elite trainer|\betb\b/],
  ["booster-box", /booster box/],
  ["booster-bundle", /booster bundle|\bbundle\b/],
  ["collection-box", /collection box|ultra[- ]premium|premium collection/],
  ["blister", /blister/],
  ["tin", /\btin\b/],
  ["booster-pack", /booster pack|\bpack\b/],
];

export function normSet(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/pok[eé]mon/g, " ")
    .replace(/\btcg\b/g, " ")
    .replace(/\b(sv|swsh|xy|sm|bw|me|dp|ex|hgss|neo)\d*\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function productType(name, subtype = "") {
  const text = String(name || "").toLowerCase();
  if (/pok[eé]mon center/.test(text) && /elite trainer|\betb\b/.test(text)) return "pc-etb";
  for (const [type, pattern] of TYPES) {
    if (type === "pc-etb") continue;
    if (pattern.test(text)) return type;
  }
  return subtype || "other";
}

export function languageOf(name) {
  const text = String(name || "").toLowerCase();
  if (/japanese|\bjapan\b|\bjp\b/.test(text)) return "ja";
  if (/korean/.test(text)) return "ko";
  if (/chinese/.test(text)) return "zh";
  return "en";
}

export function editionOf(name) {
  const text = String(name || "").toLowerCase();
  if (/shadowless/.test(text)) return "shadowless";
  if (/revised/.test(text)) return "revised";
  if (/1st|first edition/.test(text)) return "1st";
  if (/unlimited/.test(text)) return "unlimited";
  return "";
}

function artBits(name) {
  return [...String(name || "").matchAll(/\[([^\]]+)\]/g)].map((hit) => hit[1]);
}

function editionArt(name) {
  const bits = artBits(name);
  if (!bits.length) return false;
  return bits.every((bit) => /1st|first|edition|unlimited|revised|shadowless/i.test(bit));
}

const SKIP = /\b(case|display|japanese|korean|chinese|mini|jumbo|lot|empty|damaged|costco|sams|sam's)\b|\band tin\b|\band pokeball\b/i;
const STOP = new Set(["and", "the", "box", "pack", "booster", "elite", "trainer", "bundle", "tin", "collection", "special", "center", "exclusive", "cards", "products", "miscellaneous", "promo", "promos"]);
const EDITION_WORDS = new Set(["1st", "first", "edition", "unlimited", "revised", "shadowless"]);

function tokens(name) {
  return normSet(name).split(" ").filter((word) => word.length > 2 && !STOP.has(word) && !EDITION_WORDS.has(word));
}

function daysApart(a, b) {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.abs(left - right) / 86400000;
}

export function scoreCandidate(product, item, { groupDates = {}, setDate = "" } = {}) {
  if (!item?.tcgplayerProductId) return null;
  const name = String(item.name || "");
  if (languageOf(name) !== "en") return null;
  if (SKIP.test(name)) return null;
  if (product.subtype && item.subtype && product.subtype !== item.subtype) return null;
  const want = product.subtype || productType(product.name);
  const got = productType(name, item.subtype);
  if (want && got && want !== got && !(want === "etb" && got === "pc-etb") && !(want === "pc-etb" && got === "etb")) return null;
  if (want === "pc-etb" && got !== "pc-etb") return null;
  if (want !== "pc-etb" && got === "pc-etb") return null;
  const ours = new Set(tokens(`${product.set || ""} ${product.name || ""}`));
  const need = tokens(`${product.set || ""} ${product.name || ""}`);
  const have = new Set(tokens(`${item.set || ""} ${name}`));
  const missing = need.filter((word) => !have.has(word));
  if (need.length && missing.length) return null;
  let confidence = 0.92;
  let reason = null;
  const wantEd = editionOf(product.name);
  const gotEd = editionOf(name);
  if (wantEd && gotEd && wantEd !== gotEd) return null;
  if (!wantEd && gotEd) {
    confidence = 0.8;
    reason = "catalog row names an edition and ours does not";
  }
  if (/shadowless/.test(name.toLowerCase()) && !/shadowless/.test(String(product.name || "").toLowerCase())) {
    confidence = Math.min(confidence, 0.72);
    reason = reason || "catalog row is shadowless and ours does not say so";
  }
  if (/\b(half|plus|case|display)\b/i.test(name) && !/\b(half|plus|case|display)\b/i.test(String(product.name || ""))) {
    confidence = Math.min(confidence, 0.66);
    reason = reason || "catalog name adds a half, a plus, or a case";
  }
  if (artBits(name).length && !editionArt(name)) {
    const oursName = String(product.name || "").toLowerCase();
    const named = artBits(name).some((bit) => bit.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3).some((word) => oursName.includes(word)));
    if (!named) {
      confidence = Math.min(confidence, 0.66);
      reason = "cover variant: the catalog name names a specific art and ours does not";
    }
  }
  const extra = tokens(`${item.set || ""} ${name}`).filter((word) => !ours.has(word));
  if (extra.length) {
    confidence = Math.min(confidence, 0.66);
    reason = reason || "catalog name is more specific than ours";
  }
  const groupId = item.groupId == null ? null : Number(item.groupId);
  const published = groupId != null ? groupDates[groupId] || "" : "";
  const gap = daysApart(setDate, published);
  return {
    tcgplayerProductId: String(item.tcgplayerProductId),
    name,
    set: item.set || null,
    subtype: got,
    groupId,
    confidence: Math.round(confidence * 100) / 100,
    reason,
    dateGap: gap,
  };
}

function applyDateLead(rows) {
  const dated = rows.filter((row) => row.dateGap != null);
  if (dated.length < 2) return rows;
  const best = Math.min(...dated.map((row) => row.dateGap));
  return rows.map((row) => {
    if (row.dateGap == null || row.reason) return row;
    if (row.dateGap <= best + 30 && row.dateGap + 60 < Math.max(...dated.map((item) => item.dateGap))) {
      return { ...row, confidence: Math.min(1, Math.round((row.confidence + 0.1) * 100) / 100), reason: null };
    }
    return row;
  });
}

export function choosePass2(product, items, context = {}) {
  let scored = [];
  for (const item of items || []) {
    const row = scoreCandidate(product, item, context);
    if (row) scored.push(row);
  }
  scored = applyDateLead(scored);
  scored.sort((a, b) => b.confidence - a.confidence || String(a.tcgplayerProductId).localeCompare(String(b.tcgplayerProductId)));
  const best = scored[0];
  const second = scored[1];
  const candidates = scored.slice(0, 3).map((row) => ({
    tcgplayerProductId: row.tcgplayerProductId,
    name: row.name,
    set: row.set,
    subtype: row.subtype,
    groupId: row.groupId,
    confidence: row.confidence,
  }));
  if (!best) return { status: "unmatched", reason: "no catalog row matched the set and the product type", candidates: [] };
  const margin = second ? Math.round((best.confidence - second.confidence) * 100) / 100 : 1;
  if (best.confidence >= AUTO_CONFIDENCE && !best.reason && margin >= LEAD) {
    return { status: "accepted", confidence: best.confidence, margin, match: candidates[0], candidates };
  }
  return {
    status: best.confidence >= 0.5 ? "review" : "unmatched",
    confidence: best.confidence,
    reason: best.reason || (margin < LEAD ? "two catalog rows score too close" : "below the auto-accept line"),
    candidates,
  };
}

export function catalogRowDecision(item, twinCount) {
  const name = String(item?.name || "");
  if (languageOf(name) !== "en") return { status: "review", confidence: 0.4, reason: "not an English product" };
  const type = productType(name, item.subtype);
  const allowed = new Set(["etb", "pc-etb", "booster-box", "booster-bundle", "booster-pack", "tin", "collection-box", "blister"]);
  if (!allowed.has(type)) return { status: "review", confidence: 0.4, reason: "product type is not one we queue" };
  if (/\b(half|plus|case|display|lot|mini|jumbo)\b/i.test(name)) {
    return { status: "review", confidence: 0.6, reason: "name adds a half, a plus, a case, or a mini" };
  }
  if (artBits(name).length && !editionArt(name)) {
    return { status: "review", confidence: 0.66, reason: "name picks a specific art we did not confirm" };
  }
  if (editionArt(name) || editionOf(name)) {
    return { status: "review", confidence: 0.7, reason: "edition is in the name and was not confirmed" };
  }
  if (twinCount > 1) return { status: "review", confidence: 0.7, reason: "more than one catalog row has this name" };
  return { status: "accepted", confidence: 1, reason: null };
}

export function applySecondPass({ products = [], tracked = [], catalogReview = [], catalog = [], groupDates = {}, setDates = {} }) {
  const rows = products.map((row) => ({ tcgPlayerId: String(row.tcgPlayerId), keys: [...(row.keys || [])] }));
  const byId = new Map(rows.map((row) => [row.tcgPlayerId, row]));
  const accepted = [];
  const review = [];
  const unmatched = [];
  for (const product of tracked) {
    const decision = choosePass2(product, catalog, {
      groupDates,
      setDate: setDates[product.setId] || setDates[normSet(product.set)] || "",
    });
    if (decision.status === "accepted") {
      const id = decision.match.tcgplayerProductId;
      if (!byId.has(id)) rows.push({ tcgPlayerId: id, keys: [product.id] });
      else if (!byId.get(id).keys.includes(product.id)) byId.get(id).keys.push(product.id);
      byId.set(id, byId.get(id) || rows[rows.length - 1]);
      accepted.push({ id: product.id, name: product.name, tcgPlayerId: id, confidence: decision.confidence, matchedName: decision.match.name });
    } else if (decision.status === "review") {
      review.push({ id: product.id, name: product.name, set: product.set, subtype: product.subtype, reason: decision.reason, candidates: decision.candidates });
    } else {
      unmatched.push({ id: product.id, name: product.name, set: product.set, subtype: product.subtype, reason: decision.reason, candidates: decision.candidates });
    }
  }
  const groups = new Map();
  for (const item of catalogReview) {
    const key = `${productType(item.name, item.subtype)}|${normSet(item.set || item.name)}|${normSet(item.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const stillCatalog = [];
  let catalogAccepted = 0;
  for (const group of groups.values()) {
    for (const item of group) {
      const decision = catalogRowDecision(item, group.length);
      if (decision.status === "accepted" && item.tcgplayerProductId && !byId.has(String(item.tcgplayerProductId))) {
        const id = String(item.tcgplayerProductId);
        rows.push({ tcgPlayerId: id, keys: [`catalog-${id}`] });
        byId.set(id, rows[rows.length - 1]);
        catalogAccepted += 1;
        accepted.push({ id: `catalog-${id}`, name: item.name, tcgPlayerId: id, confidence: 1, matchedName: item.name });
      } else if (decision.status !== "accepted") {
        stillCatalog.push({
          tcgplayerProductId: String(item.tcgplayerProductId || ""),
          name: item.name,
          set: item.set || null,
          subtype: item.subtype || productType(item.name),
          reason: decision.reason,
        });
      }
    }
  }
  return { products: rows, accepted, review, unmatched, catalogReview: stillCatalog, catalogAccepted };
}
