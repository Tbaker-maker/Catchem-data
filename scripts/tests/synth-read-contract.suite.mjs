// Synthesis runs after the test gate. It may not publish a read the gate's
// contract would refuse (scripts/lib/read-synthesis.mjs keepContract).
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { keepContract, readContractOk } from "../lib/read-synthesis.mjs";
import { sourceNamesDay } from "../lib/read-quality.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log("  ok  " + name); else { fail += 1; console.error("  FAIL " + name); } };
  const deep = { id: "deep-card-tcgcsv-1", readKind: "deep", kind: "deep", board: "v3", source: "TCGplayer market, Oct 1 to Nov 11", asOf: "2026-11-11", lines: ["a", "b", "c"] };
  const thin = { ...deep, lines: ["a", "b"] };
  t("a deep read with 3 lines keeps its shape", readContractOk(deep));
  t("a deep read with 2 lines breaks it", !readContractOk(thin));
  t("a deep read with 7 lines breaks it", !readContractOk({ ...deep, lines: ["1", "2", "3", "4", "5", "6", "7"] }));
  t("a rewrite down to 2 lines falls back to the original", keepContract(thin, deep) === deep);
  t("a good rewrite is kept", keepContract({ ...deep, lines: ["x", "y", "z", "w"] }, deep).lines.length === 4);
  t("an original that was already off is not used to replace a rewrite", keepContract(thin, { ...deep, lines: ["only"] }) === thin);

  const hist = { id: "backto-tcgcsv-2", readKind: "backto", kind: "backto", board: "hist", startDate: "2025-04-03", endDate: "2026-11-11", asOf: "2026-11-11", source: "TCGplayer market (tcgcsv daily archive and our nightly days), 2025-04-03 and 2026-11-11" };
  t("a history read whose source names its start date keeps its shape", readContractOk(hist));
  const moved = { ...hist, startDate: "2026-08-13", source: "TCGplayer market (tcgcsv daily archive and our nightly days), Apr 3, 2025 and Nov 11" };
  t("a history read whose start date left its source breaks it", !readContractOk(moved));
  t("that rewrite falls back to the original", keepContract(moved, hist) === hist);
  const spokenOk = { ...hist, startDate: "2026-08-13", source: "TCGplayer market (tcgcsv daily archive and our nightly days), Aug 13 and Nov 11" };
  t("a spoken start date in the source keeps the shape", readContractOk(spokenOk));
  t("a spoken date from another year does not count", !readContractOk({ ...spokenOk, source: "TCGplayer market, Aug 13, 2025 and Nov 11" }));
  t("a different day of the same month does not count", !readContractOk({ ...spokenOk, source: "TCGplayer market, Aug 130 and Nov 11" }) && !readContractOk({ ...spokenOk, source: "TCGplayer market, Aug 1 and Nov 11" }));
  t("a history read must end on its own day", !readContractOk({ ...hist, endDate: "2026-11-10" }));
  t("a read that is neither deep nor history is not touched", readContractOk({ id: "x", readKind: "rotation", board: "v3" }));

  t("an older day is spoken with its year", sourceNamesDay("from Apr 3, 2025 to Nov 11", "2025-04-03", "2026-11-11"));
  // Same rules as the gate suites, read from the source so the two cannot drift.
  const deepSuite = await readFile(join(ROOT, "scripts/tests/deep-reads.suite.mjs"), "utf8");
  const bundleSuite = await readFile(join(ROOT, "scripts/tests/public-bundle.suite.mjs"), "utf8");
  t("the gate still asks deep reads for 3 to 6 lines", /r\.lines\.length >= 3 && r\.lines\.length <= 6/.test(deepSuite));
  t("the gate still lists the same history kinds", bundleSuite.includes('const histKinds = new Set(["high", "low", "year", "plain", "backto", "set"]);'));
  t("the gate still asks a history source to name its start date", bundleSuite.includes("sourceNamesDay(row.source, row.startDate, row.asOf)"));
  return fail;
}
