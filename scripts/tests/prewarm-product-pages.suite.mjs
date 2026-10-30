import { readFileSync } from "node:fs";
import {
  BATCH_BUDGET_MS,
  GITHUB_JOB_LIMIT_MS,
  JOB_TIMEOUT_MIN,
  MAX_JOBS,
  batchSizeFor,
  formatBatchReport,
  mergeWarm,
  nextGap,
  parseWarm,
  pendingIds,
  readDataVersion,
  runBatch,
  selectIds,
  sliceFor,
  workBatches,
  worstCaseMs,
} from "../prewarm-product-pages.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => {
    if (ok) console.log("  ok  " + name);
    else { fail += 1; console.error("  FAIL " + name); }
  };

  const rows = [
    ["tcgcsv-1", "A", "Set", "1", "", "single"],
    ["tcgcsv-1", "A dup", "Set", "1", "", "single"],
    ["tcgcsv-2", "Box", "Set", "2", "", "sealed"],
    ["other-1", "nope", "Set", "3", "", "single"],
    ["tcgcsv-3", "ETB", "Set", "4", "", "sealed"],
  ];
  t("ids keep tcgcsv rows and drop duplicates", JSON.stringify(selectIds(rows, { kind: "all" })) === JSON.stringify(["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"]));
  t("sealed kind uses the catalog kind field", JSON.stringify(selectIds(rows, { kind: "sealed" })) === JSON.stringify(["tcgcsv-2", "tcgcsv-3"]));
  t("limit stops early", JSON.stringify(selectIds(rows, { kind: "single", limit: 1 })) === JSON.stringify(["tcgcsv-1"]));
  let threw = false;
  try { selectIds({}); } catch (err) { threw = /search-lite shape/.test(String(err && err.message)); }
  t("a bad catalog is rejected", threw);

  const catalog = 31021;
  const size = batchSizeFor(catalog);
  const batches = Math.ceil(catalog / size);
  const slow = worstCaseMs(size);
  t("one polite pass of the Oct 29 catalog is over six hours", catalog * 1200 > GITHUB_JOB_LIMIT_MS);
  t("the catalog fits in the matrix cap", batches <= MAX_JOBS && batches > 1);
  t("a slow batch fits in 60 minutes", slow <= 60 * 60 * 1000);
  t("each batch is well under the six hour cap", slow < GITHUB_JOB_LIMIT_MS / 4);
  t("the job timeout is under a third of the cap and above the budget", JOB_TIMEOUT_MIN * 60 * 1000 < GITHUB_JOB_LIMIT_MS / 3 && BATCH_BUDGET_MS < JOB_TIMEOUT_MIN * 60 * 1000);

  const ids = Array.from({ length: 10 }, (_, i) => `tcgcsv-${i}`);
  t("slice is stable", JSON.stringify(sliceFor(ids, 1, 4)) === JSON.stringify(["tcgcsv-4", "tcgcsv-5", "tcgcsv-6", "tcgcsv-7"]));
  const covered = [];
  for (let i = 0; i < Math.ceil(ids.length / 4); i += 1) covered.push(...sliceFor(ids, i, 4));
  t("slices cover every id once", JSON.stringify(covered) === JSON.stringify(ids));

  const day = "2026-10-30";
  t("a warm list from another data version is not reused", parseWarm({ version: "2026-10-29", ids: ["tcgcsv-1"] }, day).ids.length === 0);
  t("a warm list with no version is not reused", parseWarm(["tcgcsv-1"], day).ids.length === 0);
  t("a warm list for this data version is kept", JSON.stringify(parseWarm({ version: day, ids: ["tcgcsv-1", "nope", "tcgcsv-1"] }, day).ids) === JSON.stringify(["tcgcsv-1"]));
  t("an unknown version does not skip pages", parseWarm({ version: day, ids: ["tcgcsv-1"] }, "").ids.length === 0);

  const warm = new Set(["tcgcsv-1", "tcgcsv-2"]);
  t("pending ids drop the warm set", JSON.stringify(pendingIds(["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"], warm)) === JSON.stringify(["tcgcsv-3"]));
  const planned = workBatches(ids, warm, 4, 10);
  t("a batch with any cold id stays queued", JSON.stringify(planned.indexes) === JSON.stringify([0, 1, 2]) && planned.remaining === 0);
  const capped = workBatches(ids, new Set(), 1, 3);
  t("the job cap leaves the rest for the next run", JSON.stringify(capped.indexes) === JSON.stringify([0, 1, 2]) && capped.remaining === 7);

  t("a normal gap stays at the floor", nextGap(1200, 1200, 200, "") === 1200);
  t("a 503 doubles from the floor", nextGap(1200, 1200, 503, "") === 2400);
  t("a dead request does not pass 15 seconds", nextGap(10000, 1200, 0, "") === 15000);
  t("an edge hit uses the short gap", nextGap(2400, 1200, 200, "hit") === 400);
  t("a cold page after a hit returns to the floor", nextGap(400, 1200, 200, "") === 1200);

  let clock = 1000;
  const calls = [];
  const slept = [];
  const report = await runBatch({
    ids: ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"],
    batchIndex: 4,
    warm: ["tcgcsv-2"],
    sleepMs: 1200,
    budgetMs: 10000,
    now: () => clock,
    sleepImpl: async (ms) => { slept.push(ms); clock += ms; },
    fetchImpl: async (url) => {
      calls.push(url);
      clock += 100;
      const hit = url.endsWith("/p/tcgcsv-3");
      return {
        status: 200,
        headers: { get: (name) => (name === "x-edge-cache" && hit ? "hit" : "") },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  });
  t("already warm ids are not requested", JSON.stringify(calls) === JSON.stringify(["https://catchemtcg.com/p/tcgcsv-1", "https://catchemtcg.com/p/tcgcsv-3"]));
  t("the request is a plain GET", calls.every((url) => !url.includes("prewarm")));
  t("the batch counts the skip and the hit", report.skippedWarm === 1 && report.requested === 2 && report.ok === 1 && report.skipHeader === 1);
  t("warm ids are the pages that answered 200", JSON.stringify(report.warmIds) === JSON.stringify(["tcgcsv-1", "tcgcsv-3"]));
  t("a hit sleeps less than a cold fill", JSON.stringify(slept) === JSON.stringify([1200, 400]));
  t("runtime includes the request and the gap", report.runtimeMs === 1800);
  t("the batch line names the runtime", formatBatchReport(report) === "BATCH 4 runtime_ms=1800 requested=2 skipped_warm=1 ok=1 skip_header=1 err=0");
  const merged = mergeWarm({ version: day, ids: ["tcgcsv-2"] }, [report], day);
  t("merge keeps this data version", merged.version === day && JSON.stringify(merged.ids) === JSON.stringify(["tcgcsv-2", "tcgcsv-1", "tcgcsv-3"]));

  clock = 0;
  const stopped = await runBatch({
    ids: ["tcgcsv-a", "tcgcsv-b", "tcgcsv-c"],
    warm: [],
    sleepMs: 1200,
    budgetMs: 1000,
    now: () => clock,
    sleepImpl: async (ms) => { clock += ms; },
    fetchImpl: async () => {
      clock += 100;
      return { status: 200, headers: { get: () => "" }, arrayBuffer: async () => new ArrayBuffer(0) };
    },
  });
  t("the budget stops the batch and leaves the rest", stopped.stoppedEarly === true && stopped.requested === 1 && JSON.stringify(stopped.warmIds) === JSON.stringify(["tcgcsv-a"]));

  const version = await readDataVersion("https://catchemtcg.com", async () => ({
    headers: { get: (name) => (name === "x-data-version" ? "2026-10-30" : "") },
    body: { cancel: async () => {} },
  }));
  t("the data version is the header date", version === "2026-10-30");
  const blank = await readDataVersion("https://catchemtcg.com", async () => { throw new Error("down"); });
  t("a failed version check does not invent a day", blank === "");

  const workflow = readFileSync(new URL("../../.github/workflows/prewarm-product-html.yml", import.meta.url), "utf8");
  const script = readFileSync(new URL("../prewarm-product-pages.mjs", import.meta.url), "utf8");
  t("the six hour job timeout is gone", !workflow.includes("timeout-minutes: 360"));
  t("each batch job is 90 minutes", workflow.includes("timeout-minutes: 90"));
  t("batches do not run at the same time", workflow.includes("max-parallel: 1"));
  t("a second run waits instead of overlapping", /group: prewarm-product-html\n {2}cancel-in-progress: false/.test(workflow));
  t("publish still starts a prewarm", workflow.includes('workflows: ["Update sealed prices"]'));
  t("the script records the batch runtime", script.includes("runtime_ms=") && script.includes("x-edge-cache"));
  t("copy has no em or en dash", !/[\u2014\u2013]/.test(workflow + script));

  if (fail) console.error(`prewarm batches ${fail} failed`);
  else console.log("prewarm batches ok");
  return fail;
}
