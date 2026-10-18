// Listing-count planner and filters. Pure functions, no network.
// Public wording is always "listings counted" (eBay listings, same filters
// every night). Never "supply" on its own.
//
// Two tiers. "daily": every top sealed product (has a current price, or has
// creator attention) and the top singles by value x attention, counted every
// day. "tail": everything else, rotated stalest-first with the leftover.
import { applyTotalCaps } from "./ebay-total.mjs";

export { applyTotalCaps };

export const EBAY_BROWSE_DAILY_LIMIT = 5000;
export const SAFE_SHARE = 0.98; // default; config/api-budgets.json wins
export const SEALED_PAGES = 3;  // sealed price step: up to 3 pages per priced product
export const TAIL_FLOOR = 500;  // calls a day kept for the tail rotation
export const RUNS_PER_DAY = 3; // 2 full runs + 1 midday top-tier run
export const TOP_RUN_SHARE = 0.15; // midday run cap, share of the daily listing budget
export const VINTAGE_SAMPLE_CALLS = 300; // left for the WOTC listing sample until it logs today
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

// Calendar day in Pacific time. Top items must be counted once per PT day.
export function ptDate(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

// The file day is the Pacific calendar day of the run, never the catalog asOf.
// A stuck catalog was filing an Oct 14 morning run under Oct 13.
export function listingFileDay(now = new Date()) {
  return ptDate(now);
}

// Hold the vintage sample's calls until a vintage-sample log exists for this Pacific day.
// Listing-count runs subtract this. The sample itself does not.
export function vintageHeldBack(log = [], now = new Date(), calls = VINTAGE_SAMPLE_CALLS) {
  const today = ptDate(now);
  const done = (log || []).some((entry) => entry && entry.source === "vintage-sample" && entry.at && ptDate(entry.at) === today);
  return done ? 0 : Math.max(0, Number(calls) || 0);
}

// A later run on the same day adds rows. It does not drop rows already filed that day.
export function mergeDayRows(prev = [], next = []) {
  const byId = new Map();
  for (const row of prev || []) if (row?.id) byId.set(row.id, row);
  for (const row of next || []) if (row?.id) byId.set(row.id, { ...row });
  return [...byId.values()];
}


// Calls a run may spend under the shared rolling 24-hour counter.
// full: up to its share, plus catch-up for a missed run (never past 2 shares),
//   always leaving room for the nightly sealed step if it is not in the window yet.
// top: daily-tier retries only, capped at TOP_RUN_SHARE of the day.
export function roleSlice({ role = "full", safe, used, dailyBudget, sealedStep = 0, sealedInWindow = true, topShare = TOP_RUN_SHARE, holdBack = 0 }) {
  const room = Math.max(0, safe - used - (sealedInWindow ? 0 : sealedStep) - Math.max(0, Number(holdBack) || 0));
  const topCap = Math.ceil(dailyBudget * topShare);
  if (role === "top") return Math.min(room, topCap);
  // Count guardian: late-day catch-up for daily-tier items still missing a
  // count. Uses whatever room is left in the rolling 24h counter, never more
  // than one day's listing budget.
  if (role === "guardian") return Math.min(room, dailyBudget);
  const fullShare = Math.ceil((dailyBudget - topCap) / 2);
  return Math.min(room, fullShare * 2);
}

// Pick this run's items: daily-tier items not yet counted today (PT) first,
// stalest first, then (full runs only) the stalest tail items. A run that
// failed or hit a 429 leaves its tops uncounted, so the next run retries them
// before any tail work.
export function pickRun({ daily, tail, last = {}, now = new Date(), slice, role = "full" }) {
  const ageH = (id) => (last[id] ? (now.getTime() - Date.parse(last[id])) / 3600000 : Infinity);
  const today = ptDate(now);
  const dueDaily = daily.filter((it) => !last[it.id] || ptDate(last[it.id]) !== today).sort((a, b) => ageH(b.id) - ageH(a.id) || String(a.id).localeCompare(String(b.id)));
  if (role === "top") return dueDaily.slice(0, Math.max(0, slice));
  if (role === "guardian") return guardianOrder(dueDaily).slice(0, Math.max(0, slice));
  const tailSorted = [...tail].sort((a, b) => ageH(b.id) - ageH(a.id) || String(a.id).localeCompare(String(b.id)));
  return [...dueDaily, ...tailSorted].slice(0, Math.max(0, slice));
}

// Guardian priority: chase cards first (SIR, hyper, secret and other top
// rarities), then modern illustration rares, then the rest of the daily tier.
// Higher price first inside each group; id breaks ties so runs are stable.
const CHASE = /special illustration|hyper|secret|gold|rainbow|mega attack/i;
export function guardianRank(it) {
  if (it.kind === "sealed") return 2;
  const r = String(it.rarity || "");
  if (CHASE.test(r)) return 0;
  if (/illustration rare/i.test(r)) return 1;
  return 2;
}
export function guardianOrder(items = []) {
  return [...items].sort((a, b) => guardianRank(a) - guardianRank(b) || (b.price || 0) - (a.price || 0) || String(a.id).localeCompare(String(b.id)));
}

// Daily check: top items with no count on a PT day.
export function missingTop(daily, last = {}, now = new Date()) {
  const today = ptDate(now);
  return daily.filter((it) => !last[it.id] || ptDate(last[it.id]) !== today).map((it) => it.id);
}

export function summarize(kind, total, titles) {
  const seen = titles.length;
  const kept = titles.filter((t) => keepTitle(kind, t)).length;
  const est = typeof total === "number" && seen ? Math.round(total * (kept / seen)) : null;
  return { browseTotal: typeof total === "number" ? total : null, sampled: seen, sampleKept: kept, listingsCounted: est };
}
