import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { callsFor, executePlan, loadQueue } from "../ppp-refresh.mjs";
import { estimateNightly, loadIdMap, orderRefreshCalls, resumeIds, spentEarlierToday, usageSkeleton } from "../lib/ppp-plan.mjs";
import { redact } from "../lib/ppp-client.mjs";

export async function runPppRefreshTests() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };

  t("a missing key leaves the budget unspent", spentEarlierToday({ asOf: "2026-11-12", credits: { usedToday: 12 } }, "2026-11-13") === 0);
  t("the same UTC day reuses the spend", spentEarlierToday({ asOf: "2026-11-12", credits: { usedToday: 12 } }, "2026-11-12") === 12);
  t("resume clears when yesterday finished the queue", resumeIds({ asOf: "2026-11-11", done: ["a", "b"] }, ["a", "b"], "2026-11-12").length === 0);
  t("resume keeps ids already done today", resumeIds({ asOf: "2026-11-12", done: ["a"] }, ["a", "b"], "2026-11-12").join() === "a");
  t("redact strips the key", redact("boom secret-key-value", ["secret-key-value"]).includes("[redacted]") && !redact("boom secret-key-value", ["secret-key-value"]).includes("secret-key-value"));

  const estimate = estimateNightly({ sealedCount: 389, singlesCount: 1000, mappedSealed: 389, mappedSingles: 1000 });
  t("mapped sealed plus singles stay inside the 16k main budget", estimate.sealedCredits === 389 && estimate.singlesCredits === 1000 && estimate.total === 1389);
  const firstNight = estimateNightly({ sealedCount: 389, singlesCount: 20000, mappedSealed: 0, mappedSingles: 0 });
  t("an unmapped first night estimates lookup plus detail and keeps a reserve", firstNight.sealedCredits === 778 && firstNight.total === 16000 && firstNight.singlesThisNight === 7611);
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
    ],
  }));
  const queue = await loadQueue(root);
  t("the queue uses the 389-id sealed list and TCGCSV singles only", queue.sealed.length === 1 && queue.singles.length === 1 && queue.singles[0].tcgPlayerId === "42382");
  await rm(root, { recursive: true, force: true });
  await rm(rawDir, { recursive: true, force: true });

  const workflow = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows/update-sealed-prices.yml"), "utf8");
  t("the workflow reads secrets.PKMNPRICES_API_KEY", workflow.includes("PKMNPRICES_API_KEY: ${{ secrets.PKMNPRICES_API_KEY }}"));
  t("the PPP refresh is continue-on-error", /name: PPP budgeted refresh[\s\S]*?continue-on-error: true[\s\S]*?ppp-refresh\.mjs/.test(workflow));
  t("nightly commits include the public PPP counts and id map", workflow.includes("data/meta/ppp-usage.json") && workflow.includes("data/meta/ppp-cursor.json") && workflow.includes("data/ppp-id-map.json"));
  t("nightly commits do not add raw PPP", !workflow.includes("ppp-raw-private") && !workflow.includes("data/history/ppp-sealed-private"));
  const ignore = await readFile(join(dirname(fileURLToPath(import.meta.url)), "../../.gitignore"), "utf8");
  t("raw PPP paths are gitignored", ignore.includes("ppp-raw-private/") && ignore.includes("data/history/ppp-sealed-private/") && ignore.includes("data/ppp/push-status.json"));

  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fail = await runPppRefreshTests();
  if (fail) process.exit(1);
}
