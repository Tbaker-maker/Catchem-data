// Same-printing, same-condition eBay asks for a WOTC single.
// A listing that does not name both is dropped. The price band stays in
// catchem-data-private. This file does not store those numbers.

import { keepTitle, buildQuery } from "./listing-counts.mjs";
import { firstBelowUnlimited, isVintageRelease, listingsAgree, printingOk } from "./price-trust.mjs";

const COND_ORDER = ["NM", "LP", "MP", "HP", "DMG"];

export function normPrinting(value) {
  let text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  text = text.replace(/\b(1st|first)\s+ed(ition)?\b/g, "1st edition");
  text = text.replace(/\breverse\s+holo(foil|graphic)?\b/g, "reverse holofoil");
  text = text.replace(/\bholo(foil|graphic)?\b/g, "holofoil");
  return text.replace(/\s+/g, " ").trim();
}

export function readPrinting(text) {
  const raw = String(text || "");
  const first = /\b(1st|first)\s+ed(ition)?\b/i.test(raw);
  const shadow = /\bshadowless\b/i.test(raw);
  const unlimited = /\bunlimited\b/i.test(raw);
  if ([first, shadow, unlimited].filter(Boolean).length > 1) return "";
  const reverse = /\breverse\s+holo/i.test(raw);
  const holo = !reverse && /\bholo(foil|graphic)?\b/i.test(raw);
  let edition = "";
  if (first) edition = "1st Edition";
  else if (shadow) edition = "Shadowless";
  else if (unlimited) edition = "Unlimited";
  let finish = "";
  if (reverse) finish = "Reverse Holofoil";
  else if (holo) finish = "Holofoil";
  if (edition && finish) return `${edition} ${finish}`;
  return edition || finish;
}

const COND_RULES = [
  ["DMG", /\b(damaged|dmg)\b/i],
  ["HP", /\bheavily\s+played\b/i],
  ["MP", /\b(moderately\s+played|\bmp\b)/i],
  ["LP", /\b(lightly\s+played|\blp\b)/i],
  ["NM", /\b(near\s+mint(?:\s+or\s+better)?|\bnm\b)/i],
];

export function readCondition(text) {
  const hits = [];
  for (const [key, rule] of COND_RULES) if (rule.test(String(text || ""))) hits.push(key);
  const uniq = [...new Set(hits)];
  return uniq.length === 1 ? uniq[0] : "";
}

export function listingText(item) {
  const bits = [item?.title, item?.condition];
  for (const row of item?.conditionDescriptors || []) {
    bits.push(row?.name);
    for (const value of row?.values || []) bits.push(value?.content || value);
  }
  return bits.filter(Boolean).join(" ");
}

export function parseListing(item) {
  if (!item || !keepTitle("single", String(item.title || ""))) return null;
  const ask = Number(item.price?.value ?? item.ask ?? item.price);
  if (!(ask > 0)) return null;
  const printing = readPrinting(listingText(item));
  const condition = readCondition(listingText(item));
  if (!printing || !condition) return null;
  return { printing, condition, ask };
}

export function samePrinting(left, right) {
  const a = normPrinting(left);
  const b = normPrinting(right);
  return !!a && a === b;
}

export function sampleQuery(card) {
  return buildQuery({ kind: "single", name: card?.name, number: card?.number || card?.num });
}

export function sampleRoom({ used = 0, safe = 4900, reserve = 700, cap = 300 } = {}) {
  const room = Number(safe) - Number(reserve) - Number(used);
  return Math.max(0, Math.min(Number(cap) || 0, room));
}

export function topVintage(cards, limit = 300) {
  return (cards || [])
    .filter((card) => card && card.kind !== "sealed" && isVintageRelease(card.release) && Number(card.price) > 0 && card.id)
    .sort((a, b) => Number(b.price) - Number(a.price) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
}

export function passingConditions(card, listings, cfg) {
  if (!card || card.kind === "sealed" || !cfg) return [];
  if (card.unverified || firstBelowUnlimited(card) || !printingOk(card)) return [];
  if (!isVintageRelease(card.release)) return [];
  const buckets = {};
  for (const item of listings || []) {
    const row = item && item.ask && item.printing && item.condition ? item : parseListing(item);
    if (!row) continue;
    const key = `${normPrinting(row.printing)}|${row.condition}`;
    (buckets[key] ||= []).push(row.ask);
  }
  const out = [];
  for (const printing of card.printings || []) {
    const amount = Number(printing?.price);
    if (!printing?.name || !(amount > 0)) continue;
    for (const condition of COND_ORDER) {
      const asks = buckets[`${normPrinting(printing.name)}|${condition}`] || [];
      if (!listingsAgree(amount, asks, cfg)) continue;
      out.push({ printing: printing.name, condition, amount, listings: asks.length });
    }
  }
  return out;
}

export function headlinePass(card, passes) {
  const name = String(card?.printing || "");
  const rows = (passes || []).filter((row) => row && row.printing === name);
  rows.sort((a, b) => COND_ORDER.indexOf(a.condition) - COND_ORDER.indexOf(b.condition));
  return rows[0] || null;
}

export function publicSampleDoc(asOf, rows) {
  const list = rows || [];
  return {
    asOf: String(asOf || "").slice(0, 10),
    note: "Same printing and same condition, listings counted. No thresholds.",
    checked: list.length,
    published: list.filter((row) => row && row.published).length,
    rows: list,
  };
}

export function publicSampleRow(card, passes) {
  const head = headlinePass(card, passes);
  return {
    id: String(card?.id || ""),
    printing: head ? head.printing : String(card?.printing || ""),
    condition: head ? head.condition : "",
    listings: head ? head.listings : 0,
    published: !!head,
  };
}
