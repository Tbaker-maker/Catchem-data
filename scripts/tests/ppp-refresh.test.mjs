import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { callsFor, executePlan, loadQueue, runDeadline, writeComparison, COMPARE_LOOKBACK_DAYS } from "../ppp-refresh.mjs";
import { estimateNightly, loadIdMap, mergeIdMaps, MAIN_BUDGET, orderRefreshCalls, resumeIds, spentEarlierToday, usageSkeleton } from "../lib/ppp-plan.mjs";
import { checkBudget, currentRunBudget, loadBudget, plannedSpend } from "../lib/ppp-budget.mjs";
import { redact } from "../lib/ppp-client.mjs";

export async function runPppRefreshTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };

  t("a missing key leaves the budget unspent", spentEarlierToday({ asOf: "2026-11-12", credits: { usedToday: 12 } }, "2026-11-13") === 0);
  t("the same UTC day reuses the spend", spentEarlierToday({ asOf: "2026-11-12", credits: { usedToday: 12 } }, "2026-11-12") === 12);
  t("a ledger snapshot is preferred over all-lane usedToday", spentEarlierToday({ asOf: "2026-11-12", credits: { usedToday: 9000, lanes: { current: 12, map: 2500 } } }, "2026-11-12") === 12);
  t("resume clears when yesterday finished the queue", resumeIds({ asOf: "2026-11-11", done: ["a", "b"] }, ["a", "b"], "2026-11-12").length === 0);
  t("resume keeps ids already done today", resumeIds({ asOf: "2026-11-12", done: ["a"] }, ["a", "b"], "2026-11-12").join() === "a");
  t("redact strips the key", redact("boom secret-key-value", ["secret-key-value"]).includes("[redacted]") && !redact("boom secret-key-value", ["secret-key-value"]).includes("secret-key-value"));

  const estimate = estimateNightly({ sealedCount: 389, singlesCount: 1000, mappedSealed: 389, mappedSingles: 1000 });
  t("mapped sealed plus singles stay inside the current-price cap", estimate.sealedCredits === 389 && estimate.singlesCredits === 1000 && estimate.total === 1389);
  t("the current-price cap is 10,000 credits from the shared plan", MAIN_BUDGET === 10000);
  const firstNight = estimateNightly({ sealedCount: 389, singlesCount: 20000, mappedSealed: 0, mappedSingles: 0 });
  t("an unmapped first night estimates lookup plus detail and stops at the 10k cap", firstNight.sealedCredits === 778 && firstNight.total === 10000 && firstNight.singlesThisNight === 4611, JSON.stringify({ total: firstNight.total, singles: firstNight.singlesThisNight }));
  const usage = usageSkeleton(estimate, { asOf: "2026-11-12", status: "skipped", reason: "PKMNPRICES_API_KEY is not set. No request was sent." });
  t("the public usage skeleton has no price and no key", !JSON.stringify(usage).includes("market_price") && usage.credits.used.total === 0 && usage.status === "skipped");

  const idMap = loadIdMap({ sealed: { "644298": 1946 }, cards: { "42382": 12927 } });
  const calls = callsFor({
    sealed: [{ tcgPlayerId: "644298" }, { tcgPlayerId: "593355" }],
    singles: [{ tcgPlayerId: "42382", price: 100 }, { tcgPlayerId: "1", price: 5 }],
    idMap,
    dates: {},
  });
  const ordered = orderRefreshCalls(calls);
  const ids = ordered.map((call) => call.id);
  t("a mapped sealed product has no lookup", !ids.includes("sealed-lookup-644298") && ids.includes("sealed-644298"));
  t("an unmapped sealed lookup sits immediately before its detail", ids.indexOf("sealed-lookup-593355") >= 0 && ids.indexOf("sealed-lookup-593355") === ids.indexOf("sealed-593355") - 1);
  t("mapped singles are detailed before unmapped pairs", ids.indexOf("card-42382") < ids.indexOf("card-lookup-1"));
  t("an unmapped card lookup sits immediately before its detail", ids.indexOf("card-lookup-1") === ids.indexOf("card-1") - 1);

  const rawDir = await mkdtemp(join(tmpdir(), "ppp-raw-"));
  const seen = [];
  const ran = await executePlan({
    key: "secret-key-value",
    calls: ordered,
    alreadyDone: [],
    budget: 16,
    idMap,
    rawDir,
    secrets: ["other-token-value"],
    reserve: async () => {},
    fetchImpl: async (url, key) => {
      seen.push({ url, key });
      if (url.includes("/v1/sealed?tcg_player_id=593355") || url.includes("tcg_player_id=593355")) {
        return { status: 200, charged: 1, body: { data: [{ id: 572, tcg_player_id: 593355 }] } };
      }
      if (url.includes("/v1/sealed/1946") || url.includes("/v1/sealed/572")) {
        return { status: 200, charged: 1, body: { id: 1, prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 10 }] } };
      }
      if (url.includes("tcg_player_id=1")) {
        return { status: 200, charged: 1, body: { data: [{ id: 99, tcg_player_id: 1 }] } };
      }
      if (url.includes("/v1/cards/12927") || url.includes("/v1/cards/99")) {
        return { status: 200, charged: 1, body: { id: 2, prices: [{ source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Holofoil", market_price: 8 }] } };
      }
      return { status: 200, charged: 1, body: { data: [] } };
    },
  });
  t("the fetch helper received the key but errors redact it", seen[0].key === "secret-key-value" && ran.errors.every((row) => !String(row).includes("secret-key-value")));
  t("credits come from x-credits-charged", ran.used.total === 6 && ran.items.sealed === 2 && ran.items.singles === 2);
  t("a lookup fills the id map used by the next detail", ran.idMap.sealed["593355"] === 572 && ran.idMap.cards["1"] === 99);
  t("raw files stay under the private day folder", (await readFile(join(rawDir, "sealed-644298.json"), "utf8")).includes("market_price"));
  {
    let clock = 0;
    let sent = 0;
    const capped = await executePlan({
      key: "k",
      calls: ordered,
      fetchImpl: async () => { sent += 1; clock += 60000; return { status: 200, charged: 1, body: { data: [{ id: 7 }] } }; },
      reserve: async () => {},
      idMap,
      deadline: 60000,
      now: () => clock,
    });
    t("the time cap stops sending once the deadline passes and holds the rest", sent === 1 && capped.callsSent === 1 && capped.callsNotSent === ordered.length - 1 && capped.errors.some((e) => e.includes("time cap")), JSON.stringify({ sent, notSent: capped.callsNotSent, n: ordered.length }));
  }
  t("an unset or zero time cap means no deadline", runDeadline(undefined) === Infinity && runDeadline("0") === Infinity && runDeadline("junk") === Infinity);
  t("a 45 minute cap lands 45 minutes after the start", runDeadline("45", 1000) === 1000 + 45 * 60000);
  t("a run with no key sends no request and spends nothing", (await executePlan({ key: "", calls: ordered, fetchImpl: async () => { throw new Error("should not fetch"); }, reserve: async () => {} })).used.total === 0);

  const budgeted = await executePlan({
    key: "k",
    calls: orderRefreshCalls(callsFor({
      sealed: [{ tcgPlayerId: "10" }, { tcgPlayerId: "11" }],
      singles: [],
      idMap: { sealed: { 10: 1, 11: 2 }, cards: {} },
    })),
    budget: 1,
    idMap: { sealed: { 10: 1, 11: 2 }, cards: {} },
    reserve: async () => {},
    fetchImpl: async () => ({ status: 200, charged: 1, body: { prices: [] } }),
  });
  t("the budget cap skips later calls", budgeted.used.total === 1 && budgeted.callsSent === 1 && budgeted.callsNotSent === 1);

  const root = await mkdtemp(join(tmpdir(), "ppp-queue-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "data/catalog"), { recursive: true });
  await writeFile(join(root, "scripts/ppt-history-backfill-ids.json"), JSON.stringify({ products: [{ tcgPlayerId: "644298", keys: ["me1-booster-box"] }] }));
  await writeFile(join(root, "data/catalog/tcgcsv-latest.json"), JSON.stringify({
    items: [
      { kind: "single", tcgplayerProductId: 42382, name: "Charizard", price: 10 },
      { kind: "sealed", tcgplayerProductId: 644298, name: "Box", price: 20 },
      { kind: "sealed", id: "other-box", tcgplayerProductId: 999001, name: "Other box", price: 5 },
      { kind: "sealed", id: "no-id", name: "Missing id" },
    ],
  }));
  const queue = await loadQueue(root);
  const sealedIds = queue.sealed.map((row) => row.tcgPlayerId).sort();
  t("the sealed queue is every catalog sealed product with a TCGplayer id", sealedIds.join() === "644298,999001" && queue.singles.length === 1 && queue.singles[0].tcgPlayerId === "42382", sealedIds.join());
  t("the 45 minute cap is still the run bound", COMPARE_LOOKBACK_DAYS === 7 && runDeadline("45", 0) === 45 * 60000);

  const cmp = await mkdtemp(join(tmpdir(), "ppp-cmp-"));
  await mkdir(join(cmp, "raw/ppp/2026-11-13"), { recursive: true });
  await mkdir(join(cmp, "raw/2026-11-12/2026-11-12"), { recursive: true });
  await mkdir(join(cmp, "raw/2026-11-13/2026-11-13"), { recursive: true });
  await writeFile(join(cmp, "raw/ppp/2026-11-13/sealed-98562.json"), JSON.stringify({
    tcgPlayerId: "98562",
    body: { name: "Deoxys Booster Pack", prices: [{ source: "tcgplayer", currency: "USD", condition: "Unopened", market_price: 100 }] },
  }));
  await writeFile(join(cmp, "raw/ppp/2026-11-13/card-84856.json"), JSON.stringify({
    tcgPlayerId: "84856",
    body: { name: "Dodrio", prices: [{ source: "tcgplayer", currency: "USD", condition: "Near Mint", variant: "Normal", market_price: 0.4 }] },
  }));
  await writeFile(join(cmp, "raw/2026-11-12/2026-11-12/sealed-98562.json"), JSON.stringify({ data: [{ tcgPlayerId: 98562, unopenedPrice: 110 }] }));
  await writeFile(join(cmp, "raw/2026-11-13/2026-11-13/set-xy1.json"), JSON.stringify({
    data: [{
      tcgPlayerId: 84856,
      prices: { variants: { Normal: { "Near Mint": { price: 0.32 } } }, primaryPrinting: "Normal" },
      variants: { Normal: { marketPrice: 0.32, conditionUsed: "Near Mint" } },
    }],
  }));
  const compared = await writeComparison({
    root: cmp,
    today: "2026-11-13",
    tcgcsv: { items: [
      { tcgplayerProductId: 98562, kind: "sealed", price: 100 },
      { tcgplayerProductId: 84856, kind: "single", printings: [{ name: "Normal", price: 0.32 }] },
    ] },
  });
  t("a previous-day sealed file and a real card body are not 0 rows", compared.privateReport.sealedVsPpt.nCompared > 0 && compared.privateReport.singlesVsPpt.nCompared > 0, JSON.stringify(compared.privateReport.counts));
  await rm(cmp, { recursive: true, force: true });
  await rm(root, { recursive: true, force: true });
  await rm(rawDir, { recursive: true, force: true });

  const workflow = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows/update-sealed-prices.yml"), "utf8");
  t("the workflow reads secrets.PKMNPRICES_API_KEY", workflow.includes("PKMNPRICES_API_KEY: ${{ secrets.PKMNPRICES_API_KEY }}"));
  t("the PPP refresh is continue-on-error", /name: PPP budgeted refresh[\s\S]*?continue-on-error: true[\s\S]*?ppp-refresh\.mjs/.test(workflow));
  t("nightly commits include the public PPP counts and id map", workflow.includes("data/meta/ppp-usage.json") && workflow.includes("data/meta/ppp-cursor.json") && workflow.includes("data/ppp-id-map.json"));
  t("nightly commits do not add raw PPP", !workflow.includes("ppp-raw-private") && !workflow.includes("data/history/ppp-sealed-private"));
  const ignore = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../.gitignore"), "utf8");
  t("raw PPP paths are gitignored", ignore.includes("ppp-raw-private/") && ignore.includes("data/history/ppp-sealed-private/") && ignore.includes("data/ppp/push-status.json"));

  const plan = loadBudget();
  const planned = plannedSpend(plan);
  t("combined planned spend is at most 20,000", planned.total <= 20000 && planned.dailyCredits === 20000 && planned.lanes.current === 10000 && checkBudget(plan).length === 0, JSON.stringify(planned));
  t("lane caps plus reserve equal the daily plan", planned.laneSum + planned.reserve === planned.dailyCredits);

  const fresh = currentRunBudget(plan, null, "2026-11-12");
  t("a fresh ledger leaves the full 10,000 current-price cap", fresh.budget === 10000 && fresh.already === 0);
  const midDay = currentRunBudget(plan, { day: "2026-11-12", lanes: { current: 4000 } }, "2026-11-12");
  t("a same-day rerun only spends the leftover current-lane room", midDay.budget === 6000 && midDay.already === 4000);
  const tight = currentRunBudget(plan, { day: "2026-11-12", lanes: { current: 0, map: 2500, comps: 3500, volume: 1500, pop: 1000, history: 1500 } }, "2026-11-12");
  t("other lanes plus the reserve shrink the current-price room so the day stays at 20,000", tight.budget === 9000 && tight.total === 10000, JSON.stringify(tight));
  const capHit = await executePlan({
    key: "k",
    calls: orderRefreshCalls(callsFor({
      sealed: Array.from({ length: 5 }, (_, i) => ({ tcgPlayerId: String(i + 1) })),
      singles: [],
      idMap: { sealed: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }, cards: {} },
    })),
    budget: currentRunBudget(plan, { day: "2026-11-12", lanes: { current: 9999 } }, "2026-11-12").budget,
    idMap: { sealed: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }, cards: {} },
    reserve: async () => {},
    fetchImpl: async () => ({ status: 200, charged: 1, body: { prices: [] } }),
  });
  t("ppp-refresh stops at the current-price cap leftover", capHit.used.total === 1 && capHit.callsSent === 1 && capHit.callsNotSent === 4, JSON.stringify({ used: capHit.used.total, sent: capHit.callsSent, skip: capHit.callsNotSent }));

  const merged = mergeIdMaps(
    { sealed: { "644298": 1946 }, cards: { "42382": 12927 } },
    { sealed: { "593355": 572 }, single: { "1": 99 } },
  );
  const reused = callsFor({
    sealed: [{ tcgPlayerId: "644298" }, { tcgPlayerId: "593355" }],
    singles: [{ tcgPlayerId: "42382", price: 100 }, { tcgPlayerId: "1", price: 5 }],
    idMap: merged,
  });
  const reusedIds = reused.map((call) => call.id);
  t("an enrich id map removes lookups the refresh would otherwise pay for", !reusedIds.includes("sealed-lookup-593355") && !reusedIds.includes("card-lookup-1") && reusedIds.includes("sealed-593355") && reusedIds.includes("card-1"));

  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPppRefreshTests();
  if (fail) process.exit(1);
}
