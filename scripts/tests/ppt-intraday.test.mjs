import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { changeStats, intradayResult, selectSample, PER_RUN_CAP, INTRADAY_DAY_CAP } from "../lib/ppt-intraday.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

export async function runIntradayTests() {
  fail = 0;
  const sample = selectSample([
    { id: "b", name: "B", score: 10 },
    { id: "a", name: "A", score: 90 },
    { id: "c", name: "C", score: 90 },
    { id: "d", name: "D" },
  ], 2);
  t("sample keeps the hotter name and breaks ties by id", sample.map((row) => row.id).join(",") === "a,c");
  t("a row with no score is left out", sample.length === 2);

  const quiet = changeStats(
    [{ id: "a", price: 10 }, { id: "b", price: 10 }],
    [{ id: "a", price: 10 }, { id: "b", price: 10 }],
  );
  t("unchanged prices are not meaningful", quiet.changedPct === 0 && quiet.meaningfulChange === false);
  const moved = changeStats(
    [{ id: "a", price: 10 }, { id: "b", price: 10 }, { id: "c", price: 10 }, { id: "d", price: 10 }],
    [{ id: "a", price: 12 }, { id: "b", price: 10 }, { id: "c", price: 9 }, { id: "d", price: 10 }],
  );
  t("two of four is above 15 percent", moved.changedPct === 50 && moved.meaningfulChange === true);
  t("a missing later price is not a change", changeStats([{ id: "a", price: 10 }], [{ id: "a" }]).compared === 0);

  const skipped = intradayResult({ sample, asOf: "2026-09-26", keySet: false });
  t("no key does not invent a percent", skipped.status === "not-run" && skipped.changedPct === null && skipped.creditsUsed === 0 && skipped.workflow === "disabled");
  t("the reserve stays under 4000", INTRADAY_DAY_CAP < 4000 && PER_RUN_CAP * 6 <= INTRADAY_DAY_CAP);

  const file = JSON.parse(await readFile(join(ROOT, "data/ppt/intraday-test.json"), "utf8"));
  const workflow = await readFile(join(ROOT, ".github/workflows/ppt-intraday.yml"), "utf8");
  t("the saved test was not run", file.status === "not-run" && file.changedPct === null && file.meaningfulChange === null && file.creditsUsed === 0);
  t("the saved sample is about 50 sealed names", file.sample.length === 50 && file.sample.every((row) => row.kind === "sealed" && row.id && row.name));
  t("the workflow is gated off", workflow.includes("vars.PPT_INTRADAY_ENABLED == 'true'") && workflow.includes("continue-on-error: true"));
  t("the saved file has no price", !JSON.stringify(file).includes("\"price\""));

  console.log(fail ? `${fail} failed` : "intraday ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runIntradayTests();
  if (n) process.exit(1);
}
