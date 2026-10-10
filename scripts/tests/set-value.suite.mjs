import { buildSetValue, setMove, sumBoth } from "../lib/set-value.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const ids = [1, 2, 3];
const start = new Map([[1, 10], [2, 10]]);
const end = new Map([[1, 12], [2, 10], [3, 99]]);
const sum = sumBoth(ids, start, end);
t("a single priced on only one day stays out of the sum", sum.count === 2 && sum.start === 20 && sum.end === 22);
t("8% is the line", setMove(sum) === 10 && setMove({ count: 2, start: 100, end: 107 }) === null);

const sets = [{ slug: "demo", name: "Demo", ids }];
const off = buildSetValue(sets, {
  "2026-09-09": start,
  "2026-10-09": end,
}, { enabled: false, endDate: "2026-10-09" });
t("flag off keeps the count and hides the sentence", off.wouldQualify === 1 && off.reads.length === 0 && off.exactStartOnFile === true);
const missing = buildSetValue(sets, { "2026-10-09": end }, { enabled: true, endDate: "2026-10-09" });
t("a missing exact day qualifies nothing", missing.exactStart === "2026-09-09" && missing.exactStartOnFile === false && missing.wouldQualify === 0 && missing.reads.length === 0);

if (fail) process.exit(1);
console.log("set value ok");
