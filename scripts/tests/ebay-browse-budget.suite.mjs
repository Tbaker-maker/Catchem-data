// Per-day eBay Browse call budget. The reserve is private; tests use a fake budget of 10.
// No network. A missing budget fails closed: no client calls, last-good rows stay.
import { readFile } from "node:fs/promises";
import { pickRun } from "../lib/listing-counts.mjs";
import { browseBudgetAlert, mergeAlerts } from "../lib/limits-watch.mjs";
import { browseCallsLeft, countWithinBudget, loadBrowseReserve, readBrowseReserve } from "../lib/ebay-browse-budget.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail += 1; console.error("  FAIL", name); } };

  const now = new Date("2026-11-27T18:00:00Z");
  const today = "2026-11-27";
  const oldDate = "2026-11-26";
  const daily = [];
  const last = {};
  const rows = {};
  for (let i = 0; i < 15; i++) {
    const id = `p${String(i).padStart(2, "0")}`;
    daily.push({ id, kind: "single", price: 100 - i, tier: "daily" });
    last[id] = new Date(now.getTime() - (15 - i) * 86400000).toISOString();
    rows[id] = { id, date: oldDate, listingsCounted: 100 + i };
  }
  const ordered = pickRun({ daily, tail: [], last, now, slice: 15, role: "full" });
  t("existing priority order is stalest first", ordered[0].id === "p00" && ordered[14].id === "p14" && ordered.length === 15);

  const originalFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = async () => { network += 1; throw new Error("no network in the browse budget test"); };
  const seen = [];
  const client = async (it) => {
    seen.push(it.id);
    return { listingsCounted: 8 };
  };
  let result;
  try {
    result = await countWithinBudget({
      ordered,
      budget: 10,
      client,
      rows,
      today,
      previousAsOf: oldDate,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  t("a fake budget of 10 stops at 10 calls", seen.length === 10 && result.calls === 10);
  t("no eBay HTTP", network === 0);
  t("highest priority products are spent first", seen.join(",") === ordered.slice(0, 10).map((it) => it.id).join(","));
  const refreshedOk = ordered.slice(0, 10).every((it) => result.rows[it.id].date === today && result.rows[it.id].listingsCounted === 8);
  t("rows this run refreshed take today and the new listings counted", refreshedOk);
  const keptOk = ordered.slice(10).every((it) => {
    const row = result.rows[it.id];
    return row.date === oldDate && row.listingsCounted === rows[it.id].listingsCounted && rows[it.id].date === oldDate;
  });
  t("last-good rows keep their old date and old listings counted", keptOk);
  t("the file day stays the last real morning when the budget cuts the run", result.asOf === oldDate);
  t("one alert line when the budget is used up", result.alert === browseBudgetAlert("held") && !result.alert.includes("\n") && result.alert.includes("listings counted") && !/sold/i.test(result.alert));
  const merged = mergeAlerts(["Price day is behind."], [result.alert]);
  t("the alert joins the existing status alerts", merged.length === 2 && merged[1] === result.alert);

  let blockedCalls = 0;
  const blocked = await countWithinBudget({
    ordered,
    budget: null,
    client: async () => { blockedCalls += 1; return { listingsCounted: 1 }; },
    rows,
    today,
    previousAsOf: oldDate,
  });
  const untouched = ordered.every((it) => blocked.rows[it.id].date === oldDate && blocked.rows[it.id].listingsCounted === rows[it.id].listingsCounted);
  t("a missing budget makes no calls and keeps last-good rows", blockedCalls === 0 && blocked.calls === 0 && untouched && blocked.asOf === oldDate);
  t("a missing budget raises one alert line", blocked.alert === browseBudgetAlert("missing") && blocked.alert !== result.alert);

  t("the reader accepts only the fake budget of 10", readBrowseReserve({ dailyCallReserve: 10 }) === 10 && readBrowseReserve(null) == null && readBrowseReserve({}) == null && readBrowseReserve({ dailyCallReserve: 0 }) == null);
  t("calls left fail closed without a budget", browseCallsLeft({ reserve: null, used: 0 }) === 0 && browseCallsLeft({ reserve: 10, used: 4 }) === 6 && browseCallsLeft({ reserve: 10, used: 10 }) === 0);

  const spent = await countWithinBudget({
    ordered: ordered.slice(0, 4),
    budget: 0,
    client: async () => { blockedCalls += 1; return { listingsCounted: 1 }; },
    rows,
    today,
    previousAsOf: oldDate,
  });
  t("a used-up budget makes no calls and keeps last-good rows", spent.calls === 0 && blockedCalls === 0 && spent.rows[ordered[0].id].date === oldDate && spent.rows[ordered[0].id].listingsCounted === rows[ordered[0].id].listingsCounted && spent.alert === browseBudgetAlert("held") && spent.asOf === oldDate);

  const loaded = await loadBrowseReserve({
    root: "/tmp/ops011-ebay-budget-test",
    token: "",
    openPrivate: async () => ({ dir: "/tmp/ops011-ebay-budget-test", remote: false, close: async () => ({}) }),
    readFile: async () => JSON.stringify({ dailyCallReserve: 10 }),
  });
  const missing = await loadBrowseReserve({
    root: "/tmp/ops011-ebay-budget-test",
    token: "",
    openPrivate: async () => ({ dir: "/tmp/ops011-ebay-budget-test", remote: false, close: async () => ({}) }),
    readFile: async () => { throw new Error("missing"); },
  });
  t("load reads a fake budget of 10 and fails closed when the file is missing", loaded === 10 && missing == null);

  const src = await readFile(new URL("../fetch-listing-counts.mjs", import.meta.url), "utf8");
  const lib = await readFile(new URL("../lib/ebay-browse-budget.mjs", import.meta.url), "utf8");
  t("listing counts load the private budget and stop inside countWithinBudget", src.includes("loadBrowseReserve") && src.includes("countWithinBudget") && src.includes('browseBudgetAlert("missing")') && src.includes("ebay-browse/limits.json"));
  t("the private path and key live in the budget module", lib.includes("ebay-browse/limits.json") && lib.includes("dailyCallReserve"));
  const copy = [lib, result.alert, blocked.alert, spent.alert].join("\n");
  t("new budget copy has no banned dash and does not say sold", !copy.includes("\u2014") && !copy.includes("\u2013") && !/sold/i.test(copy));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("ebay-browse-budget.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("ebay browse budget ok");
}
