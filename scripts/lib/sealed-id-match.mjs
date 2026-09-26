// Match a sealed product that has no TCGplayer id to a TCGCSV catalog row.
// High confidence is queued. Anything else is review-only and is not used.
// This file never reads a price and never invents an id.

import { rejectReason, words } from "./tcgcsv-match.mjs";

export const AUTO_CONFIDENCE = 0.85;
export const REVIEW_CONFIDENCE = 0.5;
export const CLEAR_SUBTYPES = new Set(["booster-box", "etb", "pc-etb", "booster-bundle", "booster-pack"]);

const GENERIC = new Set(["elite", "trainer", "box", "booster", "pack", "bundle", "center", "tin", "upc", "collection", "special"]);
const EDITION = new Set(["1st", "first", "edition", "unlimited", "revised", "shadowless", "holo", "holofoil"]);
const SKIP = /\b(case|display|japanese|korean|chinese|mini|jumbo|gravity|lot|empty|damaged|code card|set of|sleeved|repack|costco|sam's|sams)\b|\band tin\b|\band pokeball\b/;
const EXTRA = /\b(plus|costco|sam's|sams|half|blister)\b|\band\b/;

export function contentWords(name) {
  return words(name).filter((word) => !GENERIC.has(word));
}

function requiredWords(name) {
  return words(name).filter((word) => !GENERIC.has(word) && word.length > 1);
}

function bracketBits(name) {
  return [...String(name || "").matchAll(/\[([^\]]+)\]/g)].map((hit) => hit[1]);
}

function editionOnly(name) {
  const bits = bracketBits(name);
  if (!bits.length) return false;
  return bits.every((bit) => bit.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).every((word) => EDITION.has(word)));
}

export function scoreTracked(product, item) {
  if (!item || item.kind !== "sealed") return null;
  if (!product?.subtype || item.subtype !== product.subtype) return null;
  const name = String(item.name || "");
  if (SKIP.test(name.toLowerCase())) return null;
  const printing = editionOnly(name);
  const blockedOriginal = rejectReason(product, name);
  const blocked = printing && blockedOriginal && /cover variant/.test(blockedOriginal) ? null : blockedOriginal;
  const row = {
    id: item.tcgplayerProductId,
    name: item.name,
    set: item.set,
    subtype: item.subtype,
  };
  if (blocked && !/cover variant/.test(blocked)) return { ...row, confidence: 0, reason: blocked };
  const need = requiredWords(`${product.set || ""} ${product.name || ""}`);
  const distinctive = need.filter((word) => !EDITION.has(word));
  const have = new Set([...words(name), ...words(item.set || "")]);
  const missing = (distinctive.length ? distinctive : need).filter((word) => !have.has(word));
  const editionMissing = need.filter((word) => EDITION.has(word) && !have.has(word));
  const wordsNeeded = distinctive.length ? distinctive : need;
  if (!wordsNeeded.length) return { ...row, confidence: 0, reason: "no distinctive words" };
  if (missing.length) return { ...row, confidence: 0, reason: `missing words: ${missing.join(", ")}` };
  let confidence = 1;
  let reason = null;
  if (!missing.length && blocked && /cover variant/.test(blocked)) {
    return { ...row, confidence: 0.66, reason: blocked };
  }
  if (editionMissing.length) {
    confidence = Math.min(confidence, 0.7);
    reason = reason || `printing words not in the catalog name: ${editionMissing.join(", ")}`;
  }
  if (printing && !need.some((word) => EDITION.has(word))) {
    confidence = Math.min(confidence, 0.8);
    reason = reason || "catalog row is one printing and our name does not say which";
  }
  if (EXTRA.test(name.toLowerCase()) && !EXTRA.test(String(product.name || "").toLowerCase())) {
    confidence = Math.min(confidence, 0.66);
    reason = reason || "catalog name adds a bundle, a plus, or a store exclusive";
  }
  return { ...row, confidence: Math.round(confidence * 100) / 100, reason };
}

function publicCandidate(row) {
  return {
    tcgplayerProductId: String(row.id),
    name: row.name,
    set: row.set || null,
    subtype: row.subtype,
    confidence: row.confidence,
  };
}

export function chooseMatch(product, items) {
  const scored = [];
  for (const item of items) {
    const row = scoreTracked(product, item);
    if (!row || !(row.confidence > 0)) continue;
    scored.push(row);
  }
  scored.sort((a, b) => b.confidence - a.confidence || String(a.id).localeCompare(String(b.id)));
  const best = scored[0];
  const second = scored[1];
  if (!best) return { status: "unmatched", candidates: [] };
  const margin = second ? Math.round((best.confidence - second.confidence) * 100) / 100 : 1;
  const candidates = scored.slice(0, 3).map(publicCandidate);
  if (best.confidence >= AUTO_CONFIDENCE && !best.reason && margin >= 0.08) {
    return { status: "accepted", confidence: best.confidence, match: candidates[0], candidates };
  }
  if (best.confidence >= REVIEW_CONFIDENCE) {
    return { status: "review", confidence: best.confidence, reason: best.reason || (margin < 0.08 ? "two catalog rows score too close" : "below the auto-accept line"), candidates };
  }
  return { status: "unmatched", candidates };
}

export function queueDecision(item) {
  if (!item || item.kind !== "sealed" || !CLEAR_SUBTYPES.has(item.subtype)) return { status: "skip" };
  const name = String(item.name || "");
  const lower = name.toLowerCase();
  if (SKIP.test(lower)) return { status: "skip", reason: "not one English sealed product" };
  if (EXTRA.test(lower)) return { status: "review", reason: "name adds a bundle, a plus, or a store exclusive" };
  const brackets = bracketBits(name);
  for (const bracket of brackets) {
    const odd = bracket.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word && !EDITION.has(word));
    if (odd.length) return { status: "review", reason: "name picks a specific art we did not confirm" };
  }
  if (!item.tcgplayerProductId) return { status: "skip", reason: "catalog row has no product id" };
  return { status: "accepted", confidence: 1 };
}

export function applyQueue({ products = [], tracked = [], catalog = [] }) {
  const rows = products.map((row) => ({
    tcgPlayerId: String(row.tcgPlayerId),
    keys: [...(row.keys || [])],
  }));
  const byId = new Map(rows.map((row) => [row.tcgPlayerId, row]));
  const knownKeys = new Set(rows.flatMap((row) => row.keys));
  const accepted = [];
  const review = [];
  const unmatched = [];

  for (const product of tracked) {
    if (knownKeys.has(product.id)) continue;
    const decision = chooseMatch(product, catalog);
    if (decision.status === "accepted") {
      const id = String(decision.match.tcgplayerProductId);
      if (!byId.has(id)) {
        const row = { tcgPlayerId: id, keys: [product.id] };
        rows.push(row);
        byId.set(id, row);
      } else if (!byId.get(id).keys.includes(product.id)) {
        byId.get(id).keys.push(product.id);
      }
      knownKeys.add(product.id);
      accepted.push({
        id: product.id,
        name: product.name,
        set: product.set,
        subtype: product.subtype,
        tcgPlayerId: id,
        confidence: decision.confidence,
        matchedName: decision.match.name,
      });
    } else if (decision.status === "review") {
      review.push({
        id: product.id,
        name: product.name,
        set: product.set,
        subtype: product.subtype,
        reason: decision.reason,
        candidates: decision.candidates,
      });
    } else {
      unmatched.push({ id: product.id, name: product.name, set: product.set, subtype: product.subtype });
    }
  }

  const catalogReview = [];
  const pending = [];
  for (const item of catalog) {
    const id = String(item.tcgplayerProductId || "");
    if (!id || byId.has(id)) continue;
    const decision = queueDecision(item);
    if (decision.status === "review") {
      catalogReview.push({
        tcgplayerProductId: id,
        name: item.name,
        set: item.set || null,
        subtype: item.subtype,
        reason: decision.reason,
      });
    } else if (decision.status === "accepted") {
      pending.push(item);
    }
  }
  const groups = new Map();
  for (const item of pending) {
    const key = `${item.subtype}|${String(item.set || "").toLowerCase()}|${String(item.name || "").toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  let catalogAccepted = 0;
  for (const group of groups.values()) {
    if (group.length > 1) {
      for (const item of group) {
        catalogReview.push({
          tcgplayerProductId: String(item.tcgplayerProductId),
          name: item.name,
          set: item.set || null,
          subtype: item.subtype,
          reason: "more than one catalog row has this exact name",
        });
      }
      continue;
    }
    const item = group[0];
    const id = String(item.tcgplayerProductId);
    rows.push({ tcgPlayerId: id, keys: [`catalog-${id}`] });
    byId.set(id, rows[rows.length - 1]);
    catalogAccepted += 1;
    accepted.push({
      id: `catalog-${id}`,
      name: item.name,
      set: item.set || null,
      subtype: item.subtype,
      tcgPlayerId: id,
      confidence: 1,
      matchedName: item.name,
      source: "TCGCSV catalog product id",
    });
  }

  return {
    products: rows,
    accepted,
    review,
    catalogReview,
    unmatched,
    catalogAccepted,
  };
}
