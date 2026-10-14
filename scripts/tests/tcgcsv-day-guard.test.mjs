import { dayPublishedBeforeRun } from "../fetch-tcgcsv-catalog.mjs";
let fail = 0;
const t = (n, c) => { if (c) console.log("  ok ", n); else { fail++; console.error("  FAIL", n); } };
t("a day in the run's start commit is kept", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => {}) === true);
t("a day new in this run can be rewritten", dayPublishedBeforeRun("/x", "2026-10-13", "abc", () => { throw new Error("missing"); }) === false);
t("no run sha (local) always writes", dayPublishedBeforeRun("/x", "2026-10-13", "", () => {}) === false);
if (fail) process.exit(1); else console.log("tcgcsv day guard ok");
