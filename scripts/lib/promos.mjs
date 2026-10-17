// Priced promo singles and sealed promo packs, grouped for /promos.
// Art type comes from the shared classifier. Source type comes from the set
// name and the card name, then a hand-checked row in data/promo-sources.json
// can name the sealed product. A trend uses the real dates on the history.
// It is labeled 30d only when those dates are at least 28 days apart.

import { artType } from "./art-type.mjs";

export const SOURCE_TYPES = [
  "Premium Collection",
  "UPC",
  "ETB",
  "Tin",
  "Box",
  "League",
  "Prerelease",
  "McDonald's",
  "Pokemon Center",
];

export const ERA_ORDER = ["Mega", "Scarlet & Violet", "Sword & Shield", "Older"];

function hasWord(text, word) {
  const raw = String(text || "").toLowerCase();
  const want = String(word || "").toLowerCase();
  if (!want) return false;
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && !isLetter(raw.charAt(i))) i++;
    let j = i;
    while (j < raw.length && isLetter(raw.charAt(j))) j++;
    if (raw.slice(i, j) === want) return true;
    i = j;
  }
  return false;
}

function isLetter(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
}

function daySpan(from, to) {
  const a = Date.parse(from + "T00:00:00Z");
  const b = Date.parse(to + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function eraGroup(era, slug) {
  const e = String(era || "").toLowerCase();
  const s = String(slug || "");
  if (e.indexOf("mega") >= 0 || s.slice(0, 3) === "me-") return "Mega";
  if (e.indexOf("scarlet") >= 0) return "Scarlet & Violet";
  if (e.indexOf("sword") >= 0) return "Sword & Shield";
  return "Older";
}

export function sourceType(setName, name) {
  const blob = (String(setName || "") + " " + String(name || "")).toLowerCase();
  if (blob.indexOf("mcdonald") >= 0) return "McDonald's";
  if (blob.indexOf("pokemon center") >= 0 || blob.indexOf("pokémon center") >= 0) return "Pokemon Center";
  if (blob.indexOf("prerelease") >= 0 || blob.indexOf("pre-release") >= 0) return "Prerelease";
  if (hasWord(blob, "league")) return "League";
  if (blob.indexOf("ultra-premium") >= 0 || blob.indexOf("ultra premium") >= 0) return "UPC";
  if (blob.indexOf("elite trainer") >= 0 || hasWord(blob, "etb")) return "ETB";
  if (blob.indexOf("premium collection") >= 0) return "Premium Collection";
  if (hasWord(blob, "tin")) return "Tin";
  if (hasWord(blob, "box")) return "Box";
  return "";
}

export function isPromoSet(doc) {
  const blob = (String(doc && doc.slug || "") + " " + String(doc && doc.name || "")).toLowerCase();
  return blob.indexOf("promo") >= 0;
}

// Two stored prices, at least 7 days apart, ending on the newest point on or
// before asOf. Prefer a point on or before asOf minus 30 days. Hide a shorter
// gap than 7 days. Call it 30d only when the gap is at least 28 days.
export function trendSpan(hist, asOf) {
  const rows = (Array.isArray(hist) ? hist : []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0 && String(p[0]) <= String(asOf || ""));
  if (!asOf || rows.length < 2) return null;
  const end = rows[rows.length - 1];
  const target = new Date(String(asOf) + "T00:00:00Z");
  target.setUTCDate(target.getUTCDate() - 30);
  const want = target.toISOString().slice(0, 10);
  let prior = null;
  for (const row of rows) if (row[0] <= want) prior = row;
  if (!prior) prior = rows[0];
  if (!prior || prior[0] === end[0]) return null;
  const days = daySpan(prior[0], end[0]);
  if (days < 7) return null;
  const pct = Math.round(((Number(end[1]) - Number(prior[1])) / Number(prior[1])) * 1000) / 10;
  const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return { pct, dir, from: prior[0], to: end[0], days, label: days >= 28 ? "30d" : days + "d" };
}

function isSealedPromo(set, item) {
  if (item.kind !== "sealed" || !(Number(item.price) > 0)) return false;
  const name = String(item.name || "");
  const blob = (name + " " + String(item.subtype || "")).toLowerCase();
  const promoish = blob.indexOf("promo") >= 0 || isPromoSet(set);
  const packish = blob.indexOf("pack") >= 0 || blob.indexOf("blister") >= 0;
  return promoish && packish;
}

export function buildPromos(sets, { links = [] } = {}) {
  const byCard = new Map();
  for (const row of links) {
    if (row && row.cardId) byCard.set(row.cardId, row);
  }
  const cards = [];
  const sealed = [];
  let asOf = "";
  for (const set of sets) {
    if (set && set.asOf) asOf = set.asOf;
    for (const item of (set && set.items) || []) {
      const day = set.asOf || asOf;
      if (item.kind === "single" && isPromoSet(set) && Number(item.price) > 0) {
        const link = byCard.get(item.id);
        const mapped = link && SOURCE_TYPES.indexOf(link.sourceType) >= 0 ? link.sourceType : "";
        cards.push({
          id: item.id,
          name: item.name,
          num: item.num || "",
          set: set.name,
          slug: set.slug,
          era: eraGroup(set.era, set.slug),
          art: artType(item),
          price: item.price,
          trend: trendSpan(item.hist, day),
          source: mapped || sourceType(set.name, item.name),
          productId: link && link.productId ? link.productId : "",
          productName: link && link.productId && link.productName ? link.productName : "",
        });
      } else if (isSealedPromo(set, item)) {
        sealed.push({
          id: item.id,
          name: item.name,
          set: set.name,
          slug: set.slug,
          era: eraGroup(set.era, set.slug),
          price: item.price,
          trend: trendSpan(item.hist, day),
        });
      }
    }
  }
  cards.sort((a, b) => ERA_ORDER.indexOf(a.era) - ERA_ORDER.indexOf(b.era) || String(a.set).localeCompare(String(b.set)) || String(a.num).localeCompare(String(b.num), undefined, { numeric: true }));
  sealed.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const linked = cards.filter((row) => row.productId).length;
  return {
    asOf,
    source: "TCGplayer market",
    count: cards.length,
    sealedCount: sealed.length,
    linked,
    cards,
    sealed,
  };
}
