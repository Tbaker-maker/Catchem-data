// Listing-count planner and filters. Pure functions, no network.
// Public wording is always "listings counted" (eBay listings, same filters
// every night). Never "supply" on its own.

// eBay Browse default allowance per app per day (developer.ebay.com, Buy APIs
// call limits). We plan to 80% of it and keep the rest as reserve.
export const EBAY_BROWSE_DAILY_LIMIT = 5000;
export const SAFE_SHARE = 0.98; // default; config/api-budgets.json wins
// Upper bound for the sealed price step that runs first: up to 3 pages per
// priced sealed product, plus one OAuth call.
export const SEALED_PAGES = 3;

// Refresh intervals in nights. Every tier is refreshed at least weekly.
export const TIERS = [
  { id: "sealed", every: 3 },
  { id: "top", every: 1 },     // top singles by value plus attention
  { id: "single", every: 7 },  // singles priced at $1 or more
  { id: "tail", every: 30 },   // singles under $1 or unpriced, rotated with spare calls
];
export const TOP_SINGLES = 500;
export const MIN_SINGLE_PRICE = 1;

// Same title filters every night. Raw singles drop graded, lots, proxies.
// Sealed drops cases, multi-unit lots, opened or empty items.
const COMMON_EXCLUDE = [/\blots?\b/i, /\bbundle of\b/i, /\bx\s?\d+\b/i, /\b\d+\s?x\b/i, /\bproxy\b/i, /\bcustom\b/i, /\borica\b/i, /\breplica\b/i, /\bfake\b/i];
const SINGLE_EXCLUDE = [/\bpsa\b/i, /\bcgc\b/i, /\bbgs\b/i, /\bsgc\b/i, /\bace\b\s?\d/i, /\bgraded\b/i, /\bslab/i, /\bgem mint\s?10\b/i];
const SEALED_EXCLUDE = [/\bcase\b/i, /\bopened\b/i, /\bempty\b/i, /\bno cards\b/i, /\bpsa\b/i, /\bcgc\b/i, /\bgraded\b/i];
export const QUERY_NEGATIVES = { single: "-lot -psa -cgc -bgs -graded -proxy", sealed: "-lot -case -opened -empty" };

export function keepTitle(kind, title = "") {
  const rules = [...COMMON_EXCLUDE, ...(kind === "sealed" ? SEALED_EXCLUDE : SINGLE_EXCLUDE)];
  return !rules.some((r) => r.test(title));
}

export function buildQuery(item) {
  const clean = (s) => String(s || "").replace(/[()[\]{}"]/g, " ").replace(/\s+/g, " ").trim();
  if (item.kind === "sealed") return `pokemon ${clean(item.searchQuery || item.name)} ${QUERY_NEGATIVES.sealed}`.trim();
  const base = clean(String(item.name || "").split(" - ")[0]);
  const num = clean(item.number).replace(/^0+(?=\d)/, "");
  return `pokemon ${base} ${num} ${QUERY_NEGATIVES.single}`.replace(/\s+/g, " ").trim();
}

export function nightlyBudget({ sealedPriced = 0, limit = EBAY_BROWSE_DAILY_LIMIT, share = SAFE_SHARE } = {}) {
  const safe = Math.floor(limit * share);
  const sealedStep = sealedPriced * SEALED_PAGES + 1;
  return { limit, safe, sealedStep, budget: Math.max(0, safe - sealedStep - 1), reserve: limit - safe };
}

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// items: tcgcsv catalogue rows. skipIds: tcgplayer ids already counted by the
// sealed price step. state.last: { [id]: "YYYY-MM-DD" }. attention: Set of ids.
export function planListingCounts({ items, skipIds = new Set(), state = {}, today, budget, attention = new Set(), topN = TOP_SINGLES }) {
  const last = state.last || {};
  const pool = [];
  const singles = [];
  const tail = [];
  for (const it of items || []) {
    if (!it || !it.id) continue;
    if (it.kind === "sealed") {
      if (skipIds.has(String(it.tcgplayerProductId))) continue;
      pool.push({ ...it, tier: "sealed" });
    } else if ((it.price || 0) >= MIN_SINGLE_PRICE || attention.has(it.id)) {
      singles.push(it);
    } else {
      tail.push(it);
    }
  }
  const score = (it) => (it.price || 0) * (attention.has(it.id) ? 3 : 1);
  singles.sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));
  singles.forEach((it, i) => pool.push({ ...it, tier: i < topN ? "top" : "single" }));
  for (const it of tail) pool.push({ ...it, tier: "tail" });

  const rank = { sealed: 0, top: 1, single: 2, tail: 3 };
  const every = Object.fromEntries(TIERS.map((t) => [t.id, t.every]));
  const rows = pool.map((it) => {
    const age = last[it.id] ? daysBetween(last[it.id], today) : Infinity;
    return { it, age, due: age >= every[it.tier], overdue: age === Infinity ? 1e9 : age / every[it.tier] };
  });
  // Due items first, by tier, then most overdue. Spare budget goes to the
  // not-yet-due tail first (stalest first), so the under-$1 tail rotates.
  rows.sort((a, b) => (b.due - a.due) || (a.due ? rank[a.it.tier] - rank[b.it.tier] : (b.it.tier === "tail") - (a.it.tier === "tail")) || (b.overdue - a.overdue) || String(a.it.id).localeCompare(String(b.it.id)));
  const picked = rows.slice(0, Math.max(0, budget)).map((r) => r.it);
  const dueTotal = rows.filter((r) => r.due).length;
  const tierCounts = Object.fromEntries(TIERS.map((t) => [t.id, pool.filter((p) => p.tier === t.id).length]));
  const perNightNeed = TIERS.reduce((s, t) => s + Math.ceil(pool.filter((p) => p.tier === t.id).length / t.every), 0);
  const fixedNeed = TIERS.filter((t) => t.id !== "tail").reduce((s, t) => s + Math.ceil(tierCounts[t.id] / t.every), 0);
  const spare = Math.max(0, budget - fixedNeed);
  const tailCycleNights = tierCounts.tail ? (spare ? Math.ceil(tierCounts.tail / spare) : null) : 0;
  const cycleNights = tailCycleNights == null ? null : Math.max(7, tailCycleNights);
  return { picked, fixedNeed, spare, tailCycleNights, cycleNights, poolSize: pool.length, dueTotal, perNightNeed, tierCounts };
}

// Count kept listings in the sampled page and scale the eBay total by the
// kept share of the sampled page. listingsCounted = eBay total under our
// server filters x kept share. sampled/sampleKept make the scaling visible.
export function summarize(kind, total, titles) {
  const seen = titles.length;
  const kept = titles.filter((t) => keepTitle(kind, t)).length;
  const est = typeof total === "number" && seen ? Math.round(total * (kept / seen)) : null;
  return { browseTotal: typeof total === "number" ? total : null, sampled: seen, sampleKept: kept, listingsCounted: est };
}
