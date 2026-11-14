import { readFile } from "node:fs/promises";
import { comparableCounts, readFloor, shiftPct, wholeCount } from "../lib/supply-shifts.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name, detail); }
  };

  // The real shape from data/sealed-prices.json, mega-forces-tin, Nov 12 and 13 2026.
  // Both nights read 150 rows (3 pages of 50). Nov 12 kept 7 (142 failed the set
  // filter, Browse total 327). Nov 13 kept 86 (Browse total 45). Neither night
  // read the whole result, so neither point has filteredTotal.
  const nov12 = { date: "2026-11-12", sellers: 3, topShare: 0.43, top2Share: 0.86, total: 327 };
  const nov13 = { date: "2026-11-13", sellers: 20, topShare: 0.1, top2Share: 0.21, total: 45 };
  const floor = 20;

  t("the old math really was +1128.6%", shiftPct(7, 86) === 1128.6);
  t("7 to 86 on two capped nights is not a supply shift",
    comparableCounts({ prevPoint: nov12, nowPoint: nov13, floor }).skip === "capped-or-partial");
  t("Browse total alone is not a whole count", wholeCount(nov12) == null && wholeCount(nov13) == null);
  t("one capped night is enough to skip",
    comparableCounts({ prevPoint: { ...nov12, filteredTotal: 7 }, nowPoint: nov13, floor }).skip === "capped-or-partial");
  t("7 to 86 as whole counts still fails the floor on the 7 side",
    comparableCounts({ prevPoint: { date: "2026-11-12", filteredTotal: 7 }, nowPoint: { date: "2026-11-13", filteredTotal: 86 }, floor }).skip === "below-floor");
  t("both counts must clear the floor, not just the larger one",
    comparableCounts({ prevPoint: { filteredTotal: 19 }, nowPoint: { filteredTotal: 40 }, floor }).skip === "below-floor");
  const ok = comparableCounts({ prevPoint: { filteredTotal: 30 }, nowPoint: { filteredTotal: 40 }, floor });
  t("two whole counts above the floor compare", ok.prev === 30 && ok.now === 40 && shiftPct(ok.prev, ok.now) === 33.3);
  t("a missing floor means no shift (fail closed)",
    comparableCounts({ prevPoint: { filteredTotal: 30 }, nowPoint: { filteredTotal: 40 }, floor: null }).skip === "no-floor");
  t("readFloor rejects a missing or bad key", readFloor(null) == null && readFloor({}) == null && readFloor({ minListingsEachNight: "x" }) == null && readFloor({ minListingsEachNight: 0 }) == null);
  t("readFloor reads the private key", readFloor({ minListingsEachNight: 20 }) === 20);
  t("a missing point is not a count", comparableCounts({ prevPoint: undefined, nowPoint: { filteredTotal: 40 }, floor }).skip === "capped-or-partial");

  // compute-derived keeps no public floor number and reads the private file.
  const src = await readFile(new URL("../compute-derived.mjs", import.meta.url), "utf8");
  t("compute-derived compares supply only through comparableCounts", /comparableCounts\(/.test(src) && !/Math\.max\(ln\[0\], ln\[1\]\) < 20/.test(src));
  t("compute-derived reads the floor from supply-shifts/limits.json", src.includes("supply-shifts/limits.json"));
  return fail;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await run();
  console.log(n ? `${n} failed` : "all passed");
  process.exit(n ? 1 : 0);
}
