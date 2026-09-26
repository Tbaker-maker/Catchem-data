import { chainIndex, eraOf, median, quarterKey } from "../lib/index-baskets.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

t("median of two relatives", median([1.1, 0.9]) === 1);
t("black bolt is scarlet and violet", eraOf("zsv10pt5") === "Scarlet & Violet");
t("white flare is scarlet and violet", eraOf("rsv10pt5") === "Scarlet & Violet");
t("pokemon go is sword and shield", eraOf("pgo") === "Sword & Shield");
t("base set is wotc", eraOf("base1") === "WOTC / vintage");
t("heartgold is not dumped in vintage", eraOf("hgss1") === null);
t("quarter", quarterKey("2026-09-25") === "2026-Q3");

const prices = new Map([
  ["a", new Map([["2026-08-22", 100], ["2026-08-23", 110], ["2026-08-25", 110]])],
  ["b", new Map([["2026-08-22", 200], ["2026-08-23", 200], ["2026-08-25", 220]])],
]);
const elig = new Map([
  ["2026-08-22", new Set(["a", "b"])],
  ["2026-08-23", new Set(["a", "b"])],
  ["2026-08-25", new Set(["a", "b"])],
]);
const series = chainIndex(["2026-08-22", "2026-08-23", "2026-08-25"], prices, elig, ["a", "b"]);
t("starts at 100", series.points[0].equal === 100);
t("day move is the median relative, not the average", series.points[1].equalMovePct === 5, String(series.points[1].equalMovePct));
t("the skipped day is a gap, not a filled price", series.gaps.some((g) => g.missingDays === 1 && g.from === "2026-08-23"));
t("no point was invented on the missing day", series.points.every((p) => p.date !== "2026-08-24"));
t("value weight gives the expensive product more say", series.points[1].valueMovePct < series.points[1].equalMovePct);

const thin = new Map([
  ["2026-08-22", new Set(["a"])],
  ["2026-08-23", new Set()],
]);
const thinSeries = chainIndex(["2026-08-22", "2026-08-23"], prices, thin, ["a", "b"]);
t("a day with nobody priced does not print a flat index", thinSeries.points.length === 1);

console.log(fail ? `${fail} failed` : "index baskets ok");
if (fail) process.exit(1);
