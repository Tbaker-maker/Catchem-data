// Post Office catalogue from TCGplayer set rows. Prices come from the set
// files already on disk. Nothing here invents a price or a release day.

export const UNPRICED_MAX = 0.02;

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
    rows.push({
      id: item.id,
      number: item.num || item.number || "",
      price: cardPrice(item.price),
    });
  }
  return rows;
}

export function buildPostOfficeCatalogue({ sets = [], groups = [], cardsBySlug = {}, asOf = "" } = {}) {
  const groupByName = new Map();
  for (const group of groups) groupByName.set(normName(group.name), group);
  const outSets = [];
  for (const set of sets) {
    const cards = cardRows(cardsBySlug[set.slug] || []);
    const priced = cards.filter((card) => card.price != null).length;
    const group = groupByName.get(normName(set.name));
    outSets.push({
      slug: set.slug,
      name: set.name,
      release: set.release || "",
      released: releasedOn(set, asOf),
      groupId: group ? group.groupId : null,
      cards: cards.length,
      priced,
      unpriced: cards.length - priced,
      prices: cards,
    });
  }
  outSets.sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    asOf,
    source: "TCGplayer market",
    rule: "A released set is a sets.json row whose release day is on or before the catalog day. Each card price is the TCGplayer market price already stored on that set. A card with no price is counted. The guard fails when a released set is absent or when more than 2 percent of cards in released sets have no price.",
    sets: outSets,
  };
}

export function catalogueGuard(doc, { expected = [] } = {}) {
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
  for (const row of doc?.sets || []) {
    if (!releasedOn(row, asOf)) continue;
    cards += row.cards || 0;
    unpriced += row.unpriced || 0;
  }
  const share = cards ? unpriced / cards : 0;
  if (cards > 0 && share > UNPRICED_MAX) {
    problems.push({
      code: "unpriced",
      share: Math.round(share * 10000) / 10000,
      cards,
      unpriced,
    });
  }
  return {
    ok: problems.length === 0,
    problems,
    cards,
    unpriced,
    share: Math.round(share * 10000) / 10000,
  };
}
