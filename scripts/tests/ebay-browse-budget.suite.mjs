// Per-day eBay Browse call budget. The reserve is private; tests use a fake budget of 10.
// No network. A missing reserve keeps the public call ceiling. It does not mean zero client calls.
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pickRun } from "../lib/listing-counts.mjs";
import { browseBudgetAlert, mergeAlerts, warningLine, LISTING_CALL_BUDGET } from "../lib/limits-watch.mjs";
import { EBAY_BROWSE_DAILY_LIMIT } from "../lib/listing-counts.mjs";
import { browseCallsLeft, countWithinBudget, loadBrowseReserve, publicBrowseCeiling, readBrowseReserve } from "../lib/ebay-browse-budget.mjs";
import { statusAlerts } from "../lib/ops-bots.mjs";

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

  let unsetCalls = 0;
  const unsetRun = await countWithinBudget({
    ordered,
    budget: null,
    client: async () => { unsetCalls += 1; return { listingsCounted: 1 }; },
    rows,
    today,
    previousAsOf: oldDate,
  });
  const unsetTouched = ordered.every((it) => unsetRun.rows[it.id].date === today && unsetRun.rows[it.id].listingsCounted === 1);
  t("a missing budget uses the public ceiling instead of a zero-call freeze", unsetCalls === ordered.length && unsetRun.calls === ordered.length && unsetTouched && unsetRun.asOf === today);
  t("a missing budget raises one alert that the reserve is not set", unsetRun.alert === browseBudgetAlert("unset") && unsetRun.alert === browseBudgetAlert("missing") && !/\d/.test(unsetRun.alert) && unsetRun.alert !== result.alert);

  const ceiling = publicBrowseCeiling();
  t("the public ceiling is the listing budget and the daily limit, unchanged", LISTING_CALL_BUDGET === 4277 && EBAY_BROWSE_DAILY_LIMIT === 5000 && ceiling === 4277);
  t("calls left stay on the public ceiling when the reserve key is absent", browseCallsLeft({ reserve: null, used: 0 }) === 4277 && browseCallsLeft({ reserve: null, used: 100 }) === 4177 && browseCallsLeft({ reserve: null, used: 4277 }) === 0 && browseCallsLeft({ reserve: null, used: 0, dailyLimit: 4000, listingBudget: 4277 }) === 4000);
  t("a private reserve stops earlier than the public ceiling by that reserve", browseCallsLeft({ reserve: 10, used: 0 }) === 4277 - 10 && browseCallsLeft({ reserve: 10, used: 4 }) === 4277 - 10 - 4 && browseCallsLeft({ reserve: 10, used: 0, listingBudget: 100, dailyLimit: 5000 }) === 90 && browseCallsLeft({ reserve: 5000, used: 0 }) === 0);
  const reserveAlert = [browseBudgetAlert("unset"), browseBudgetAlert("held")].join(" ");
  t("the reserve number is not in the alert", !reserveAlert.includes("10") && !reserveAlert.includes("4277") && !reserveAlert.includes("5000"));

  let tightCalls = 0;
  const tight = await countWithinBudget({
    ordered,
    budget: null,
    listingBudget: 10,
    dailyLimit: 5000,
    client: async () => { tightCalls += 1; return { listingsCounted: 4 }; },
    rows,
    today,
    previousAsOf: oldDate,
  });
  const tightKept = ordered.slice(10).every((it) => tight.rows[it.id].date === oldDate && tight.rows[it.id].listingsCounted === rows[it.id].listingsCounted);
  t("a missing reserve still stops at a supplied public ceiling and keeps last-good rows", tightCalls === 10 && tight.calls === 10 && tight.rows[ordered[9].id].date === today && tightKept && tight.asOf === oldDate && tight.alert.includes(browseBudgetAlert("unset")) && tight.alert.includes(browseBudgetAlert("held")));

  t("the reader accepts only the fake budget of 10", readBrowseReserve({ dailyCallReserve: 10 }) === 10 && readBrowseReserve(null) == null && readBrowseReserve({}) == null && readBrowseReserve({ dailyCallReserve: 0 }) == null);

  let spentCalls = 0;
  const spent = await countWithinBudget({
    ordered: ordered.slice(0, 4),
    budget: 0,
    client: async () => { spentCalls += 1; return { listingsCounted: 1 }; },
    rows,
    today,
    previousAsOf: oldDate,
  });
  t("a used-up budget makes no calls and keeps last-good rows", spent.calls === 0 && spentCalls === 0 && spent.rows[ordered[0].id].date === oldDate && spent.rows[ordered[0].id].listingsCounted === rows[ordered[0].id].listingsCounted && spent.alert === browseBudgetAlert("held") && spent.asOf === oldDate);

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

  const budgetLine = browseBudgetAlert("unset");
  const shareLine = warningLine({ id: "ebay-browse", share: 0.9, limit: LISTING_CALL_BUDGET, asOf: "2026-11-27" });
  const oldPrice = "price day 2020-01-01 is 9 days behind 2020-01-10";
  const lateLine = "price day 2026-11-26 is 2 days behind 2026-11-28";
  const keptAlerts = statusAlerts([budgetLine, shareLine, oldPrice, { id: "old-object" }], { alert: lateLine });
  t("statusAlerts keeps the budget line and replaces only the price-day line", keptAlerts.length === 3 && keptAlerts[0] === budgetLine && keptAlerts[1] === shareLine && keptAlerts[2] === lateLine);
  t("a resolved price day drops the old price line and keeps the budget line", statusAlerts([budgetLine, oldPrice], null).join("|") === budgetLine);

  const clock = new Date();
  const calendar = clock.toISOString().slice(0, 10);
  const late = new Date(clock.getTime());
  late.setUTCHours(12, 0, 0, 0);
  late.setUTCDate(late.getUTCDate() - 2);
  const lateDay = late.toISOString().slice(0, 10);
  const root = await mkdtemp(join(tmpdir(), "fresh-budget-"));
  try {
    await mkdir(join(root, "data/history/tcgcsv-daily"), { recursive: true });
    await mkdir(join(root, "data/derived"), { recursive: true });
    await writeFile(join(root, "data/history/tcgcsv-daily", `${lateDay}.json`), "{}\n");
    await writeFile(join(root, "data/derived/status.json"), JSON.stringify({
      alerts: [budgetLine, shareLine, oldPrice],
    }, null, 1) + "\n");
    const bot = join(dirname(fileURLToPath(import.meta.url)), "../freshness-bot.mjs");
    const ran = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [bot], {
        env: { ...process.env, FRESHNESS_ROOT: root },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let err = "";
      child.stderr.on("data", (buf) => { err += buf; });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, err }));
    });
    const written = JSON.parse(await readFile(join(root, "data/derived/status.json"), "utf8"));
    const expectedLate = `price day ${lateDay} is 2 days behind ${calendar}`;
    t("freshness-bot exits 0", ran.code === 0);
    t("the budget alert is still in status.json after freshness-bot runs", Array.isArray(written.alerts) && written.alerts.includes(budgetLine) && written.alerts.includes(shareLine) && !written.alerts.includes(oldPrice) && written.alerts.includes(expectedLate));
  } finally {
    await rm(root, { recursive: true, force: true });
  }

  const yml = await readFile(new URL("../../.github/workflows/listing-counts.yml", import.meta.url), "utf8");
  const slice = (yml.split("- name: Listing counts (eBay slice)")[1] || "").split("\n      - name:")[0];
  t("the eBay slice names PRIVATE_DATA_TOKEN and waits for Tyler", /PRIVATE_DATA_TOKEN: \$\{\{ secrets\.PRIVATE_DATA_TOKEN \}\}/.test(slice) && /Tyler must say yes/.test(slice) && /LISTING_RUN_ROLE:/.test(slice));

  const src = await readFile(new URL("../fetch-listing-counts.mjs", import.meta.url), "utf8");
  const lib = await readFile(new URL("../lib/ebay-browse-budget.mjs", import.meta.url), "utf8");
  t("listing counts load the private budget and stop inside countWithinBudget", src.includes("loadBrowseReserve") && src.includes("countWithinBudget") && src.includes('browseBudgetAlert("unset")') && src.includes("LISTING_CALL_BUDGET") && src.includes("EBAY_BROWSE_DAILY_LIMIT") && src.includes("ebay-browse/limits.json") && !src.includes('callBudget: "missing"'));
  t("the private path and key live in the budget module", lib.includes("ebay-browse/limits.json") && lib.includes("dailyCallReserve"));
  const copy = [lib, result.alert, unsetRun.alert, spent.alert, tight.alert].join("\n");
  t("new budget copy has no banned dash and does not say sold", !copy.includes("\u2014") && !copy.includes("\u2013") && !/sold/i.test(copy));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("ebay-browse-budget.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("ebay browse budget ok");
}
