// Sealed history queue, lane room, and the overlap gate. No network, no key.
import { pathToFileURL } from "node:url";
import { queueSealed, pullLimit, verifyOverlap, chartPoints, watchRank, progressDoc } from "../lib/ppp-sealed-history.mjs";
import { laneMeter } from "../lib/ppp-budget.mjs";

const budget = { lanes: { history: { cap: 500 } }, reserve: 0 };

function meter(spent, cap = 500) {
  return laneMeter("history", { lanes: { history: { cap } }, reserve: 0 }, spent);
}

export async function runPppSealedHistoryTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail++; console.error("  FAIL", name, detail); }
  };

  const products = [
    { pid: 1, kind: "sealed", pppId: 11, tier: "tail", listingsCounted: 100, market: 50 },
    { pid: 2, kind: "sealed", pppId: 12, tier: "daily", listingsCounted: 4, market: 10 },
    { pid: 3, kind: "sealed", pppId: 13, tier: "daily", listingsCounted: 40, market: 9 },
    { pid: 4, kind: "single", pppId: 14, tier: "daily", listingsCounted: 999, market: 999 },
    { pid: 5, kind: "sealed", pppId: null, tier: "daily", listingsCounted: 80, market: 80 },
    { pid: 6, kind: "sealed", pppId: 16, tier: "daily", listingsCounted: 70, market: 70 },
  ];
  const q = queueSealed(products, { filled: new Set([6]), ownDays: new Map([[1, 10], [2, 200], [3, 12]]) });
  t("singles, unmapped, filled, and long own series stay off the queue", q.map((p) => p.pid).join(",") === "3,1", q.map((p) => p.pid).join(","));
  const watched = [products[0], products[1], products[2]].slice().sort(watchRank).map((p) => p.pid);
  t("daily listings counted outrank a tail product", watched.join(",") === "3,2,1", watched.join(","));

  t("a full cap leaves no room for a 365 row pull", pullLimit(meter(500)) === 0);
  t("155 spent leaves room for one 345 row pull", pullLimit(meter(155)) === 345);
  t("a stopped lane spends nothing", pullLimit(laneMeter("history", budget, 10, { stopped: { charged: 1, expected: 0 } })) === 0);

  const own = [["2026-11-01", 100], ["2026-11-02", 100], ["2026-11-03", 110]];
  const good = [
    { date: "2026-10-01", source: "tcgplayer", currency: "USD", condition: "Unopened", avg: 90 },
    { date: "2026-11-01", source: "tcgplayer", currency: "USD", condition: "Unopened", avg: 100 },
    { date: "2026-11-02", source: "tcgplayer", currency: "USD", condition: "Unopened", avg: 100.04 },
    { date: "2026-11-03", source: "tcgplayer", currency: "USD", condition: "Unopened", avg: 110 },
    { date: "2026-11-03", source: "cardmarket", currency: "EUR", condition: "Unopened", avg: 50 },
  ];
  const gate = chartPoints(good, own);
  t("a matching overlap can show only the days before our first day", gate.show && gate.points.length === 1 && gate.points[0][0] === "2026-10-01", JSON.stringify(gate.points));
  const bad = good.map((r) => r.date === "2026-11-02" ? { ...r, avg: 80 } : r);
  const held = verifyOverlap(bad, own);
  t("a mismatch holds the series", !held.passed && held.mismatches === 1, JSON.stringify(held));
  const thin = verifyOverlap(good.slice(0, 2), own);
  t("fewer than 3 shared days does not pass", !thin.passed && thin.overlap === 1);

  const doc = progressDoc({ asOf: "2026-11-12", cap: 500, spentBefore: 155, spentThisRun: 0, queued: 3, status: "skipped" });
  t("the progress counter stays inside the history cap", doc.cap === 500 && doc.spentToday === 155 && doc.shown === 0 && doc.chartFill === false);
  t("the progress counter has no price field", !JSON.stringify(doc).includes("avg") && doc.lane === "history");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runPppSealedHistoryTests();
  if (n) { console.error(`${n} failed`); process.exit(1); }
}
