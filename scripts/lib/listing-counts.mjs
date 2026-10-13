// Listing-count planner and filters. Pure functions, no network.
// Public wording is always "listings counted" (eBay listings, same filters
// every night). Never "supply" on its own.
//
// Two tiers. "daily": every top sealed product (has a current price, or has
// creator attention) and the top singles by value x attention, counted every
// day. "tail": everything else, rotated stalest-first with the leftover.

export const EBAY_BROWSE_DAILY_LIMIT = 5000;
export const SAFE_SHARE = 0.98; // default; config/api-budgets.json wins
export const SEALED_PAGES = 3;  // sealed price step: up to 3 pages per priced product
export const TAIL_FLOOR = 500;  // calls a day kept for the tail rotation
export const RUNS_PER_DAY = 6;
const DAY = 86400000;

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

// Daily calls: limit x share, minus the nightly sealed price step.
export function nightlyBudget({ sealedPriced = 0, limit = EBAY_BROWSE_DAILY_LIMIT, share = SAFE_SHARE } = {}) {
  const safe = Math.floor(limit * share);
  const sealedStep = sealedPriced * SEALED_PAGES + 1;
  return { limit, safe, sealedStep, budget: Math.max(0, safe - sealedStep - 1), reserve: limit - safe };
}

// Split the catalogue into the daily tier and the tail.
export function tiers({ items, skipIds = new Set(), attention = new Set(), dailyBudget, tailFloor = TAIL_FLOOR }) {
  const sealedTop = [], sealedTail = [], singles = [];
  for (const it of items || []) {
    if (!it || !it.id) continue;
    if (it.kind === "sealed") {
      if (skipIds.has(String(it.tcgplayerProductId))) continue;
      ((it.price || 0) > 0 || attention.has(it.id) ? sealedTop : sealedTail).push(it);
    } else singles.push(it);
  }
  const score = (it) => (it.price || 0) * (attention.has(it.id) ? 3 : 1);
  singles.sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));
  const singleSlots = Math.max(0, Math.min(singles.length, dailyBudget - sealedTop.length - tailFloor));
  const singlesTop = singles.slice(0, singleSlots);
  const daily = [...sealedTop, ...singlesTop].map((it) => ({ ...it, tier: "daily" }));
  const tail = [...sealedTail, ...singles.slice(singleSlots)].map((it) => ({ ...it, tier: "tail" }));
  const cutoff = singlesTop.length ? singlesTop[singlesTop.length - 1].price || 0 : null;
  const leftover = Math.max(0, dailyBudget - daily.length);
  return { daily, tail, counts: { sealedTop: sealedTop.length, sealedTail: sealedTail.length, singlesTop: singlesTop.length, singlesTail: singles.length - singleSlots }, singleCutoff: cutoff, leftover, tailCycleDays: tail.length ? (leftover ? Math.ceil(tail.length / leftover) : null) : 0 };
}

// Rolling 24-hour counter shared by every run. log: [{ at: ISO, n }]
export function used24(log = [], now = new Date()) {
  const from = now.getTime() - DAY;
  return log.filter((e) => Date.parse(e.at) > from).reduce((s, e) => s + (e.n || 0), 0);
}

// Calls this run may spend: an even share of the day's listing budget, never
// past the rolling 24-hour cap.
export function runSlice({ safe, used, dailyBudget, runsPerDay = RUNS_PER_DAY }) {
  return Math.max(0, Math.min(safe - used, Math.ceil(dailyBudget / runsPerDay)));
}

// Pick this run's items: daily-tier items not counted in the last 20 hours
// first, then the stalest tail items.
export function pickRun({ daily, tail, last = {}, now = new Date(), slice }) {
  const ageH = (id) => (last[id] ? (now.getTime() - Date.parse(last[id])) / 3600000 : Infinity);
  const dueDaily = daily.filter((it) => ageH(it.id) >= 20).sort((a, b) => ageH(b.id) - ageH(a.id) || String(a.id).localeCompare(String(b.id)));
  const tailSorted = [...tail].sort((a, b) => ageH(b.id) - ageH(a.id) || String(a.id).localeCompare(String(b.id)));
  return [...dueDaily, ...tailSorted].slice(0, Math.max(0, slice));
}

export function summarize(kind, total, titles) {
  const seen = titles.length;
  const kept = titles.filter((t) => keepTitle(kind, t)).length;
  const est = typeof total === "number" && seen ? Math.round(total * (kept / seen)) : null;
  return { browseTotal: typeof total === "number" ? total : null, sampled: seen, sampleKept: kept, listingsCounted: est };
}
