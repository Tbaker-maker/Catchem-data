import { readFileSync } from "node:fs";
import { dayPublishedBeforeRun } from "../fetch-tcgcsv-catalog.mjs";
let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };
t("a day in the run's start commit is kept", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => {}) === true);
t("a day new in this run can be rewritten", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => { throw new Error("missing"); }) === false);
t("no run sha (local) always writes", dayPublishedBeforeRun("/x", "2026-10-13", "", () => {}) === false);

const wf = readFileSync(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
const early = wf.slice(wf.indexOf("- name: Commit today's TCGCSV day"), wf.indexOf("- name: Preflight patch guard-audit"));
const testsAt = wf.indexOf("- name: Unit tests (fail-fast)");
const earlyAt = wf.indexOf("- name: Commit today's TCGCSV day");
t("the early TCGCSV commit is before unit tests", earlyAt > 0 && testsAt > earlyAt);
t("the early TCGCSV commit stages the catalog with the day", early.includes("git add data/history/tcgcsv-daily/ data/catalog/tcgcsv-latest.json data/catalog/tcgcsv-coverage.json"));
t("the early TCGCSV commit still runs when the day file did not change", early.includes("if: always()"));
if (fail) process.exit(1); else console.log("tcgcsv day guard ok");
