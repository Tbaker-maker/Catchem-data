import { chainIndex, enterIndex, eraOf, median, quarterKey } from "../lib/index-baskets.mjs";

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
t("april is Q2, not Q1", quarterKey("2026-04-01") === "2026-Q2");
t("december is Q4", quarterKey("2026-12-31") === "2026-Q4");

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

// A move is never taken across two sources: pairPrice returns null for "a" here.
const mixed = chainIndex(["2026-08-22", "2026-08-23"], prices, elig, ["a", "b"], (id, x, y) => id === "a" ? null : [prices.get(id).get(x), prices.get(id).get(y)]);
t("pairPrice null keeps that product out of the move", mixed.points[1].matched === 1 && mixed.points[1].equalMovePct === 0, JSON.stringify(mixed.points[1]));

const enterPrices = new Map([
  ["a", new Map([["2026-03-31", 100], ["2026-04-01", 110], ["2026-04-02", 110]])],
  ["b", new Map([["2026-04-01", 50], ["2026-04-02", 50]])],
]);
const enterElig = new Map([
  ["2026-03-31", new Set(["a"])],
  ["2026-04-01", new Set(["a", "b"])],
  ["2026-04-02", new Set(["a", "b"])],
]);
const entered = enterIndex(["2026-03-31", "2026-04-01", "2026-04-02"], enterPrices, enterElig, ["a", "b"]);
t("enter index starts at 100", entered.points[0].equal === 100 && entered.points[0].date === "2026-03-31");
t("a new name does not jump the level", entered.points[1].equal === 110 && entered.points[1].entered === 1, JSON.stringify(entered.points[1]));
t("the new name's first return is the next day", entered.points[2].equal === 110 && entered.points[2].matched === 2);
t("enter index does not invent a missing day", enterIndex(["2026-04-01", "2026-04-03"], enterPrices, enterElig, ["a", "b"]).points.every((p) => p.date !== "2026-04-02"));

console.log(fail ? `${fail} failed` : "index baskets ok");
if (fail) process.exit(1);
