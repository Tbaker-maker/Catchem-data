import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadMarketHistory } from "../lib/market-history.mjs";
import { readCrosscheck } from "../lib/ppt-paths.mjs";
import { buildRunReport, isRawPublicPath, reportLine, safetyVerdict } from "../lib/run-report.mjs";
import { pushPrivate } from "../push-private-ppt.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export async function runPptPathTests() {
  fail = 0;
  const root = await mkdtemp(join(tmpdir(), "ppt-paths-"));
  const missing = await readCrosscheck(root, "sealed-crosscheck.json");
  t("missing crosscheck is null", missing === null);
  const hist = await loadMarketHistory(root);
  t("missing history does not throw", hist.coverage.pptProducts === 0 && hist.ids.length === 0);
  await mkdir(join(root, "data/history/ppt-sealed-private"), { recursive: true });
  await writeFile(join(root, "data/history/ppt-sealed-private", "box.json"), JSON.stringify({
    id: "box",
    points: [{ date: "2026-09-26", market: 10 }],
  }));
  const mounted = await loadMarketHistory(root);
  t("private mount is read", mounted.coverage.pptProducts === 1 && mounted.priceMap.get("box").get("2026-09-26") === 10);

  const report = buildRunReport({
    startedAt: "2026-09-26T04:00:00.000Z",
    finishedAt: "2026-09-26T04:10:00.000Z",
    usage: { run: { creditsUsed: 12, itemsDone: 3, itemsSkipped: 1, rateLimitCount: 2, retries: 1 }, credits: { remaining: 15988 } },
    mount: { restored: true, files: 4 },
    push: { expected: true, pushed: true, sha: "abc123" },
  });
  t("the run report has no price", !JSON.stringify(report).includes("\"price\"") && report.items.attempted === 4 && report.credits.used === 12 && report.privatePush === "abc123" && report.durationSec === 600);
  t("a skipped push is labeled", buildRunReport({ finishedAt: "2026-09-26T00:00:00.000Z", push: { expected: false, reason: "skipped: PRIVATE_DATA_TOKEN is not set" } }).privatePush.startsWith("skipped:"));
  t("an expected failed push is not ok", safetyVerdict({ push: { expected: true, pushed: false, reason: "clone failed" }, tracked: [] }).ok === false);
  t("a skipped push with a clean tree is ok", safetyVerdict({ push: { expected: false, pushed: false }, tracked: ["data/sealed-prices.json"] }).ok === true);
  t("a raw eval sample is a leak", isRawPublicPath("research/eval-samples/ppt-sealed-RAW.json") && safetyVerdict({ push: { expected: false }, tracked: ["research/eval-samples/ppt-sealed-RAW.json"] }).ok === false);
  t("the private history mount is not a public leak", !isRawPublicPath("data/history/ppt-sealed-private/box.json"));
  t("the summary line names the sha", reportLine(report).includes("abc123") && reportLine(report).includes("history yes"));

  const workflow = await readFile(join(root, "../../.github/workflows/update-sealed-prices.yml"), "utf8").catch(() => "");
  const live = workflow || await readFile(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
  const reportAt = live.indexOf("write-run-report.mjs");
  const commitAt = live.indexOf("Commit price data");
  const safetyAt = live.indexOf("check-ppt-safety.mjs");
  t("the report is written before the price commit", reportAt > 0 && reportAt < commitAt);
  t("the safety check is after the price commit", safetyAt > commitAt);
  const safetyHead = live.slice(live.lastIndexOf("- name: PPT safety check"), safetyAt);
  t("the safety check is not continue-on-error", !safetyHead.includes("continue-on-error"));
  t("both commits add the run report", live.split("data/ppt/run-report.json").length >= 3);

  const pushed = await pushPrivate({
    token: "not-a-real-token-value",
    checkout: root,
    rawDir: root,
    date: "2026-09-26",
    runGit: async (_cmd, args) => {
      if (args.includes("rev-parse")) return { code: 0, err: "", out: "abc123\n" };
      if (args.includes("--quiet")) return { code: 0, err: "", out: "" };
      return { code: 0, err: "", out: "" };
    },
  });
  t("an unchanged private repo still returns its sha", pushed.pushed === true && pushed.sha === "abc123" && !String(pushed.reason).includes("not-a-real-token-value"));

  console.log(fail ? `${fail} failed` : "ppt paths ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runPptPathTests();
  if (n) process.exit(1);
}
