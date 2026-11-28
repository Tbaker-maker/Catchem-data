// Private per-day eBay Browse reserve.
// File: ebay-browse/limits.json in catchem-data-private (under data/private/).
// Key: dailyCallReserve. When that key is a positive integer, the run stops
// earlier than the public ceiling by that many calls. The number is not logged.
// When the file or key is missing, the public ceilings already in this repo
// stay the hard stop: LISTING_CALL_BUDGET (4277) and EBAY_BROWSE_DAILY_LIMIT
// (5000). Fail closed means do not spend past those ceilings. It does not mean
// a zero-call freeze. This module never stores a production reserve.
import { join } from "node:path";
import { EBAY_BROWSE_DAILY_LIMIT } from "./listing-counts.mjs";
import { LISTING_CALL_BUDGET, browseBudgetAlert } from "./limits-watch.mjs";

export const EBAY_BROWSE_RESERVE_PATH = "ebay-browse/limits.json";
export const EBAY_BROWSE_RESERVE_KEY = "dailyCallReserve";

export function readBrowseReserve(limits) {
  const n = Number(limits?.[EBAY_BROWSE_RESERVE_KEY]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Tighter of the two public ceilings. Never a made-up reserve.
export function publicBrowseCeiling({
  listingBudget = LISTING_CALL_BUDGET,
  dailyLimit = EBAY_BROWSE_DAILY_LIMIT,
} = {}) {
  const listing = Number.isInteger(listingBudget) && listingBudget > 0 ? listingBudget : LISTING_CALL_BUDGET;
  const daily = Number.isInteger(dailyLimit) && dailyLimit > 0 ? dailyLimit : EBAY_BROWSE_DAILY_LIMIT;
  return Math.min(listing, daily);
}

// Calls still allowed today.
// Missing reserve: the public ceiling, minus calls already used.
// Supplied reserve: that ceiling minus the reserve, then minus calls already used.
// Never above the public ceiling. Never logs the reserve.
export function browseCallsLeft({
  reserve,
  used = 0,
  listingBudget = LISTING_CALL_BUDGET,
  dailyLimit = EBAY_BROWSE_DAILY_LIMIT,
} = {}) {
  const ceiling = publicBrowseCeiling({ listingBudget, dailyLimit });
  const reserveSet = Number.isInteger(reserve) && reserve > 0;
  const stop = reserveSet ? Math.max(0, ceiling - reserve) : ceiling;
  const spent = Number.isFinite(Number(used)) ? Math.max(0, Math.floor(Number(used))) : 0;
  return Math.max(0, Math.min(ceiling, stop) - spent);
}

export function normalizeBudget(budget, ceilings = {}) {
  const ceiling = publicBrowseCeiling(ceilings);
  if (budget == null) return { limit: ceiling, kind: "unset" };
  const n = Number(budget);
  if (!Number.isInteger(n) || n < 0) return { limit: ceiling, kind: "unset" };
  if (n === 0) return { limit: 0, kind: "held" };
  return { limit: Math.min(n, ceiling), kind: "ok" };
}

// Walk `ordered` from the front. The caller already applied pickRun or
// guardian order, so the front is the highest priority. Stop at `budget`
// client calls. A null budget uses the public ceiling, not zero calls.
// Rows that are not refreshed keep their date and listings counted.
export async function countWithinBudget({
  ordered = [],
  budget,
  client,
  rows = {},
  today,
  previousAsOf,
  concurrency = 1,
  listingBudget = LISTING_CALL_BUDGET,
  dailyLimit = EBAY_BROWSE_DAILY_LIMIT,
} = {}) {
  const ceilings = { listingBudget, dailyLimit };
  const norm = normalizeBudget(budget, ceilings);
  const limit = norm.limit;
  const next = { ...rows };
  let calls = 0;
  let rateLimited = false;
  const refreshed = [];
  const worker = async () => {
    while (!rateLimited) {
      if (calls >= limit) return;
      const it = ordered[calls];
      if (!it) return;
      calls += 1;
      let result = null;
      try { result = await client(it); } catch { result = null; }
      if (result?.stop) { rateLimited = true; continue; }
      const row = result?.row;
      const counted = row ? row.listingsCounted : result?.listingsCounted;
      if (row && result.fail !== true) {
        const saved = { ...row, id: it.id, date: today };
        next[it.id] = saved;
        refreshed.push(saved);
      } else if (Number.isFinite(Number(counted)) && result?.fail !== true) {
        const saved = { ...(next[it.id] || { id: it.id }), id: it.id, date: today, listingsCounted: Number(counted) };
        if (it.kind) saved.kind = it.kind;
        if (it.tier) saved.tier = it.tier;
        next[it.id] = saved;
        refreshed.push(saved);
      }
    }
  };
  if (limit > 0 && ordered.length && typeof client === "function") {
    const width = Math.max(1, Math.min(concurrency, limit));
    await Promise.all(Array.from({ length: width }, () => worker()));
  }
  const unfinished = norm.kind === "held" || ordered.length > limit;
  const reserveUnset = norm.kind === "unset";
  const kind = unfinished ? "held" : (reserveUnset ? "unset" : "ok");
  const alerts = [];
  if (reserveUnset) alerts.push(browseBudgetAlert("unset"));
  if (kind === "held") alerts.push(browseBudgetAlert("held"));
  const alert = alerts.filter(Boolean).join(" ");
  return {
    rows: next,
    calls,
    refreshed,
    alert,
    asOf: kind === "held" ? previousAsOf : today,
    rateLimited,
    kind,
  };
}

export async function loadBrowseReserve({ root, token = "", openPrivate = null, readFile = null } = {}) {
  let open = openPrivate;
  let read = readFile;
  try {
    if (!open) ({ openPrivate: open } = await import("./private-store.mjs"));
    if (!read) ({ readFile: read } = await import("node:fs/promises"));
    const store = await open({ root, token });
    try {
      const text = await read(join(store.dir, EBAY_BROWSE_RESERVE_PATH), "utf8");
      return readBrowseReserve(JSON.parse(text));
    } catch {
      return null;
    } finally {
      if (store?.remote && store.close) await store.close([EBAY_BROWSE_RESERVE_PATH], "ebay browse call budget");
    }
  } catch {
    return null;
  }
}