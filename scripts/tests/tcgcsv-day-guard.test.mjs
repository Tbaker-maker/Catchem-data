import { readFileSync } from "node:fs";
import { dayPublishedBeforeRun, dressCatalogDay } from "../fetch-tcgcsv-catalog.mjs";
let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };
t("a day in the run's start commit is kept", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => {}) === true);
t("a day new in this run can be rewritten", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => { throw new Error("missing"); }) === false);
t("no run sha (local) always writes", dayPublishedBeforeRun("/x", "2026-10-13", "", () => {}) === false);
{
  const prev = process.env.DRESS_REHEARSAL;
  process.env.DRESS_REHEARSAL = "1";
  t("a dress rehearsal does not open a day after the last price file", dressCatalogDay("2026-11-13", ["2026-11-11.json", "2026-11-12.json"]) === "2026-11-12");
  t("a dress rehearsal keeps today when that file is already there", dressCatalogDay("2026-11-12", ["2026-11-12.json"]) === "");
  process.env.DRESS_REHEARSAL = "";
  t("without the rehearsal flag a later day is not pinned", dressCatalogDay("2026-11-13", ["2026-11-12.json"]) === "");
  if (prev == null) delete process.env.DRESS_REHEARSAL;
  else process.env.DRESS_REHEARSAL = prev;
}

const wf = readFileSync(new URL("../../.github/workflows/update-sealed-prices.yml", import.meta.url), "utf8");
const early = wf.slice(wf.indexOf("- name: Commit today's TCGCSV day"), wf.indexOf("- name: Preflight patch guard-audit"));
const testsAt = wf.indexOf("- name: Unit tests (fail-fast)");
const earlyAt = wf.indexOf("- name: Commit today's TCGCSV day");
t("the early TCGCSV commit is before unit tests", earlyAt > 0 && testsAt > earlyAt);
t("the early TCGCSV commit stages the catalog with the day", early.includes("git add data/history/tcgcsv-daily/ data/catalog/tcgcsv-latest.json data/catalog/tcgcsv-coverage.json"));
t("the early TCGCSV commit still runs when the day file did not change", early.includes("if: always()"));
if (fail) process.exit(1); else console.log("tcgcsv day guard ok");
