import { artType } from "./art-type.mjs";
import { eraOf } from "./public-bundle.mjs";

// Why a card has no price. Only "gap" is a build bug: today's TCGplayer file has a
// market price for it and nothing held it back. "held" is a price the price check
// keeps off the site (vintage, unverified). "no-market" is a card TCGplayer has no
// market price for today. Those two stay unpriced and are never filled in.
export const UNPRICED_WHY = ["held", "no-market", "gap"];

export function unpricedWhy(id, { marketIds = null, heldIds = null } = {}) {
  const key = String(id || "");
  if (heldIds && heldIds.has(key)) return "held";
  if (marketIds && !marketIds.has(key)) return "no-market";
  return "gap";
}

export function normName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function releasedOn(set, asOf) {
  return Boolean(set && set.release && asOf && set.release <= asOf);
}

export function cardPrice(value) {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return null;
  return Math.round(price * 100) / 100;
}

export function cardRows(items) {
  const rows = [];
  for (const item of items || []) {
    if (item.kind && item.kind !== "single") continue;
    const number = item.num || item.number || "";
    const name = String(item.name || "").replace(/\s+/g, " ").trim();
    const rarity = String(item.rarity || "");
    const printing = String(item.printing || "");
    const row = {
      id: item.id,
      number,
      price: cardPrice(item.price),
    };
    if (name) row.name = name;
    if (rarity) row.rarity = rarity;
    if (printing) row.printing = printing;
    const art = item.art || artType({ name, rarity, num: number, number, printing, kind: "single", tags: item.tags });
    if (art) row.art = art;
    rows.push(row);
  }
  return rows;
}

export function buildPostOfficeCatalogue({ sets = [], groups = [], cardsBySlug = {}, asOf = "", marketIds = null, heldIds = null } = {}) {
  const groupByName = new Map();
  for (const group of groups) groupByName.set(normName(group.name), group);
  const outSets = [];
  for (const set of sets) {
    const cards = cardRows(cardsBySlug[set.slug] || []);
    const priced = cards.filter((card) => card.price != null).length;
    const group = groupByName.get(normName(set.name));
    const why = { held: 0, "no-market": 0, gap: 0 };
    for (const card of cards) {
      if (card.price != null) continue;
      const w = unpricedWhy(card.id, { marketIds, heldIds });
      card.why = w;
      why[w] += 1;
    }
    outSets.push({
      slug: set.slug,
      name: set.name,
      release: set.release || "",
      released: releasedOn(set, asOf),
      groupId: group ? group.groupId : null,
      era: set.era || eraOf(set.name || ""),
      cards: cards.length,
      priced,
      unpriced: cards.length - priced,
      unpricedWhy: why,
      prices: cards,
    });
  }
  outSets.sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    asOf,
    source: "TCGplayer market",
    rule: "A released set is a sets.json row whose release day is on or before the catalog day. Each card price is the TCGplayer market price already stored on that set. A card with no price is counted and given a reason: held by the price check, no TCGplayer market price today, or a gap (a market price exists and nothing held it). The guard fails when a released set is absent or when gaps pass the private limit. Held and no market cards stay unpriced and are never filled in.",
    sets: outSets,
  };
}

export function catalogueGuard(doc, { expected = [], limits = null } = {}) {
  const asOf = doc?.asOf || "";
  const have = new Map((doc?.sets || []).map((set) => [set.slug, set]));
  const problems = [];
  const source = expected.length ? expected : (doc?.sets || []);
  const released = source.filter((set) => releasedOn(set, asOf));
  for (const set of released) {
    const row = have.get(set.slug);
    if (!row) problems.push({ code: "missing-set", slug: set.slug, name: set.name || "" });
    else if ((set.single > 0 || set.cards > 0) && !row.cards) problems.push({ code: "missing-set", slug: set.slug, name: set.name || "" });
  }
  let cards = 0;
  let unpriced = 0;
  const why = { held: 0, "no-market": 0, gap: 0 };
  for (const row of doc?.sets || []) {
    if (!releasedOn(row, asOf)) continue;
    cards += row.cards || 0;
    unpriced += row.unpriced || 0;
    // A set built before reasons existed counts every unpriced card as a gap.
    const w = row.unpricedWhy || { gap: row.unpriced || 0 };
    for (const k of UNPRICED_WHY) why[k] += Number(w[k]) || 0;
  }
  const share = cards ? unpriced / cards : 0;
  const gapShare = cards ? why.gap / cards : 0;
  // The limit comes from catchem-data-private. Without it any gap fails.
  const max = Number(limits?.maxGapShare);
  const over = Number.isFinite(max) ? gapShare > max : why.gap > 0;
  if (cards > 0 && over) {
    problems.push({
      code: "unpriced-gap",
      gapShare: Math.round(gapShare * 10000) / 10000,
      cards,
      gap: why.gap,
    });
  }
  return {
    ok: problems.length === 0,
    problems,
    cards,
    unpriced,
    why,
    share: Math.round(share * 10000) / 10000,
    gapShare: Math.round(gapShare * 10000) / 10000,
  };
}

export async function loadCatalogueLimits(root) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const ok = (d) => (d && Number.isFinite(Number(d.maxGapShare)) ? { maxGapShare: Number(d.maxGapShare) } : null);
  for (const path of [process.env.CATALOGUE_CHECKS_FILE, join(root, "..", "catchem-data-private", "config", "catalogue-checks.json")].filter(Boolean)) {
    try { const got = ok(JSON.parse(await readFile(path, "utf8"))); if (got) return got; } catch { /* next */ }
  }
  const token = process.env.PRIVATE_DATA_TOKEN || "";
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/repos/Tbaker-maker/catchem-data-private/contents/config/catalogue-checks.json", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.raw", "User-Agent": "catchem-catalogue" },
      signal: AbortSignal.timeout(20000),
    });
    return res.ok ? ok(await res.json()) : null;
  } catch { return null; }
}
