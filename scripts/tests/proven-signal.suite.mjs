import { patternPasses, MIN_N } from "../lib/proven-signal.mjs";
import { matchPattern } from "../lib/read-facts.mjs";

export async function run() {
  let fail = 0;
  const t = (n, ok) => { if (ok) console.log("  ok  " + n); else { fail++; console.error("  FAIL " + n); } };
  t("minimum is the tracker floor", MIN_N === 20);
  t("lift and cases pass", patternPasses({ rate: 29.1, base: 20.8, n: 2962 }));
  t("short case list fails", patternPasses({ rate: 29.1, base: 20.8, n: 19 }) === false);
  t("no lift fails", patternPasses({ rate: 20.8, base: 20.8, n: 100 }) === false);
  t("a failed study stays hidden", patternPasses({ rate: 40, base: 20, n: 100, pass: false }) === false);
  t("match drops a short pattern", matchPattern([{ id: "short", keys: ["set_age=under_1y"], testRate: 0.4, baseRate: 0.2, testN: 10, horizon: 7 }], ["set_age=under_1y"]) === null);
  t("match drops a pattern with no lift", matchPattern([{ id: "flat", keys: ["set_age=under_1y"], testRate: 0.2, baseRate: 0.2, testN: 40, horizon: 7 }], ["set_age=under_1y"]) === null);
  const hit = matchPattern([{ id: "ok", keys: ["rotation_stage=rotated"], testRate: 0.291, baseRate: 0.208, testN: 2962, horizon: 7 }], ["rotation_stage=rotated"]);
  t("match keeps a proven pattern", hit && hit.rate === 29.1 && hit.base === 20.8 && hit.n === 2962 && hit.pass === true && hit.line.startsWith("1.4x more likely") && !hit.line.startsWith("right"));
  return fail;
}
