// Rip value: expected contents of opening a sealed product vs its market price.
// History-based estimates from dated pull rates and our singles prices.
// Copy label: "Rip value". No buy/sell/invest/play/target wording.

export const SIMS = 10000;
export const BULK_CARDS_PER_PACK = 9; // 10-card modern pack minus the rare slot
export const RARE_SLOT = 1;

export function productPacksOk(product) {
  if (/\bhalf\b|\bdisplay\b|\bset of \d|\(set of|enhanced booster box/i.test(product.name || "")) return false;
  return true;
}

export function packsFor(product) {
  if (!productPacksOk(product)) return null;

  const setId = String(product.setId || "");
  const era = /^me/.test(setId) ? "me" : /^sv/.test(setId) ? "sv" : /^swsh/.test(setId) ? "swsh" : null;
  if (setId === "cel25") return null;
  if (product.subtype === "booster-pack") return 1;
  if (product.subtype === "booster-box") return 36;
  if (product.subtype === "booster-bundle") return 6;
  if (product.subtype === "etb" || product.subtype === "pc-etb") return era === "swsh" ? 8 : era ? 9 : null;
  if (Number(product.packs) > 0) return Number(product.packs);
  return null;
}

export function median(xs) {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash32(text) {
  let h = 2166136261;
  for (const ch of String(text || "")) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function fold(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Map sealed setId / set name → pull-rates setSlug via public sets list.
export function buildSetMaps(setsPub, pullRows) {
  const bySlug = new Map((setsPub.sets || []).map((s) => [s.slug, s]));
  const byFold = new Map();
  for (const s of setsPub.sets || []) {
    byFold.set(fold(s.name), s);
    const bare = fold(String(s.name || "").replace(/^[a-z0-9]+:\s*/i, ""));
    if (bare) byFold.set(bare, s);
    // logo /img/sv8/logo.png → setId sv8
    const m = String(s.logo || "").match(/\/img\/([^/]+)\//);
    if (m) byFold.set(fold(m[1]), s);
  }
  const pullSlugs = new Set(pullRows.map((r) => r.setSlug));
  return { bySlug, byFold, pullSlugs };
}

export function resolveSetSlug(product, maps) {
  if (product.setSlug && maps.bySlug.has(product.setSlug)) return product.setSlug;
  const hit = maps.byFold.get(fold(product.set))
    || maps.byFold.get(fold(String(product.set || "").replace(/^[a-z0-9]+:\s*/i, "")))
    || maps.byFold.get(fold(product.setId));
  return hit?.slug || "";
}

export function rarityPool(singles, setSlug, rarity, tag) {
  const out = [];
  for (const c of singles) {
    if (c.setSlug !== setSlug) continue;
    if (c.rarity !== rarity) continue;
    if (tag) {
      const tags = c.tags || [];
      const name = String(c.name || "");
      const ok = tags.includes(tag) || name.toLowerCase().includes(String(tag).toLowerCase());
      if (!ok) continue;
    }
    if (!(c.price > 0)) continue;
    out.push(c.price);
  }
  return out;
}

export function trimmedMean(xs, trim = 0.1) {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  if (s.length < 20) return median(s);
  const k = Math.floor(s.length * trim);
  const mid = s.slice(k, s.length - k);
  if (!mid.length) return median(s);
  return mid.reduce((sum, n) => sum + n, 0) / mid.length;
}

export function bulkFloorForSet(singles, setSlug) {
  const prices = [];
  for (const c of singles) {
    if (c.setSlug !== setSlug) continue;
    if (c.rarity !== "Common" && c.rarity !== "Uncommon") continue;
    if (!(c.price > 0)) continue;
    prices.push(c.price);
  }
  const med = median(prices);
  const mean = trimmedMean(prices);
  const perCard = mean;
  const raised = med != null && mean != null && prices.length >= 20 && mean >= med * 1.25;
  const round = (n) => (n == null ? null : Math.round(n * 100) / 100);
  return {
    perCard: round(perCard),
    median: round(med),
    n: prices.length,
    cardsPerPack: BULK_CARDS_PER_PACK,
    raised,
    basis: prices.length >= 20
      ? "Trimmed mean of Common and Uncommon TCGplayer market prices on asOf (lowest and highest 10% set aside). The median is kept beside it. When the median sits well under that mean, the mean is the bulk value."
      : "Median of Common and Uncommon TCGplayer market prices on asOf. Fewer than 20 prices, so the trimmed mean is not used.",
  };
}

export function rareSlotAvg(singles, setSlug) {
  const prices = [];
  for (const c of singles) {
    if (c.setSlug !== setSlug) continue;
    if (c.rarity !== "Rare" && c.rarity !== "Holo Rare" && c.rarity !== "Double Rare") continue;
    if (c.price > 0) prices.push(c.price);
  }
  return { avg: median(prices), n: prices.length };
}

export function buildSlots(pullRows, singles, setSlug) {
  const slots = [];
  const sources = new Map();
  for (const r of pullRows.filter((row) => row.setSlug === setSlug)) {
    const pool = rarityPool(singles, setSlug, r.rarity, r.tag || null);
    const avg = median(pool);
    if (!(avg > 0) || !(r.pct > 0)) continue;
    const rate = r.pct / 100;
    slots.push({
      rarity: r.rarity,
      tag: r.tag || null,
      articleRarity: r.articleRarity || r.rarity,
      rate,
      avgPrice: Math.round(avg * 100) / 100,
      nCards: pool.length,
      ev: Math.round(rate * avg * 10000) / 10000,
      sourceUrl: r.sourceUrl,
      published: r.published || r.dataAsOf || null,
    });
    if (r.sourceUrl) sources.set(r.sourceUrl, { url: r.sourceUrl, published: r.published || r.dataAsOf || null });
  }
  return { slots, sources: [...sources.values()] };
}

export function packEV(slots, bulk, rare) {
  const hits = slots.reduce((s, x) => s + x.ev, 0);
  const bulkEV = (bulk.perCard > 0 ? bulk.perCard * bulk.cardsPerPack : 0);
  const rareEV = rare.avg > 0 ? rare.avg * RARE_SLOT : 0;
  return {
    hits: Math.round(hits * 100) / 100,
    bulk: Math.round(bulkEV * 100) / 100,
    rare: Math.round(rareEV * 100) / 100,
    total: Math.round((hits + bulkEV + rareEV) * 100) / 100,
  };
}

// Monte Carlo over independent Bernoulli draws per published rarity rate.
// Each sim draws whether each slot hits, then uses that slot's average price (not a random card).
export function monteCarlo({ slots, bulk, rare, packs, productPrice, sims = SIMS, seed }) {
  const rnd = mulberry32(seed >>> 0);
  const packBulk = (bulk.perCard > 0 ? bulk.perCard * bulk.cardsPerPack : 0) + (rare.avg > 0 ? rare.avg : 0);
  const outcomes = new Float64Array(sims);
  let beats = 0;
  for (let i = 0; i < sims; i += 1) {
    let one = packBulk;
    for (const s of slots) {
      if (rnd() < s.rate) one += s.avgPrice;
    }
    const total = one * packs;
    outcomes[i] = total;
    if (total > productPrice) beats += 1;
  }
  const sorted = Float64Array.from(outcomes).sort();
  const mid = sims >> 1;
  const med = sims % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return {
    sims,
    beatChance: Math.round((beats / sims) * 1000) / 10,
    median: Math.round(med * 100) / 100,
  };
}

export function scoreProduct({ product, price, packs, slots, bulk, rare, promo = 0, seed }) {
  const pev = packEV(slots, bulk, rare);
  const contentsEV = Math.round((pev.total * packs + promo) * 100) / 100;
  const ev = Math.round((contentsEV - price) * 100) / 100;
  const roiPct = price > 0 ? Math.round(((contentsEV / price) - 1) * 1000) / 10 : null;
  const mc = monteCarlo({ slots, bulk, rare, packs, productPrice: price, seed });
  return {
    id: product.id,
    name: product.name,
    set: product.set,
    setId: product.setId || "",
    setSlug: product.setSlug || "",
    subtype: product.subtype,
    price,
    packs,
    promo,
    packEV: pev,
    contentsEV,
    ev,
    roiPct,
    beatChance: mc.beatChance,
    median: mc.median,
    sims: mc.sims,
    bulk,
    rareSlot: rare,
    slots: slots.map((s) => ({
      rarity: s.rarity, tag: s.tag, rate: s.rate, avgPrice: s.avgPrice, nCards: s.nCards, ev: s.ev,
      sourceUrl: s.sourceUrl, published: s.published,
    })),
  };
}

export function bannedCopy(text) {
  return /\b(buy|buys|buying|sell|sells|selling|invest\w*|play|plays|target|targets)\b/i.test(String(text || ""));
}
