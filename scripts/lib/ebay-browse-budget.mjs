// Private per-day eBay Browse call budget.
// File: ebay-browse/limits.json in catchem-data-private (under data/private/).
// Key: dailyCallReserve. A positive integer is the earlier stop so a run does
// not spend the public listing ceiling. Missing file or key: no calls.
// This module never stores a production reserve. Callers pass a budget.
import { join } from "node:path";
import { browseBudgetAlert } from "./limits-watch.mjs";

export const EBAY_BROWSE_RESERVE_PATH = "ebay-browse/limits.json";
export const EBAY_BROWSE_RESERVE_KEY = "dailyCallReserve";

export function readBrowseReserve(limits) {
  const n = Number(limits?.[EBAY_BROWSE_RESERVE_KEY]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Calls still allowed today. A missing reserve fails closed (zero calls).
export function browseCallsLeft({ reserve, used = 0 } = {}) {
  if (!(Number.isInteger(reserve) && reserve > 0)) return 0;
  const spent = Number.isFinite(Number(used)) ? Math.max(0, Math.floor(Number(used))) : 0;
  return Math.max(0, reserve - spent);
}

export function normalizeBudget(budget) {
  if (budget == null) return { limit: 0, kind: "missing" };
  const n = Number(budget);
  if (!Number.isInteger(n) || n < 0) return { limit: 0, kind: "missing" };
  if (n === 0) return { limit: 0, kind: "held" };
  return { limit: n, kind: "ok" };
}

// Walk `ordered` from the front. The caller already applied pickRun or
// guardian order, so the front is the highest priority. Stop at `budget`
// client calls. Rows that are not refreshed keep their date and listings counted.
export async function countWithinBudget({ ordered = [], budget, client, rows = {}, today, previousAsOf, concurrency = 1 } = {}) {
  const norm = normalizeBudget(budget);
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
  const cut = norm.kind === "missing" || limit < ordered.length || (norm.kind === "held" && ordered.length > 0);
  const kind = norm.kind === "missing" ? "missing" : (cut ? "held" : "ok");
  const alert = kind === "missing" ? browseBudgetAlert("missing") : (kind === "held" ? browseBudgetAlert("held") : "");
  return {
    rows: next,
    calls,
    refreshed,
    alert,
    asOf: kind === "ok" ? today : previousAsOf,
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
