// Pulse math. Run: node scripts/tests/sealed-market-pulse.test.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  median, mean, pctChange, monthEnds, changesFor, zScores, streakFrom, breadthBlock,
  whatChanged, buildFromSeries, assertLimits, limitsOk, dayNumberToIso, parseHistRow,
  directionOf, proseHasBanned, pickRepresentative, highBelow, joinMirror, archiveAbout, ownOnlyAbout, priceBasket, ownMonthSpan, yearAgo,
} from "../lib/sealed-market-pulse.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let failed = 0;
function t(name, cond) {
  if (cond) console.log(`  ok ${name}`);
  else { failed++; console.error(`  FAIL ${name}`); }
}

const fake = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/pulse-limits.json"), "utf8"));
t("fake limits load", limitsOk(fake));
t("missing limits refused", limitsOk(null) === false && limitsOk({}) === false);
let threw = false;
try { assertLimits({ flatAbsPct: 1 }); } catch (e) { threw = e.message === "pulse limits not loaded"; }
t("partial limits refused", threw);

t("median odd", median([1, 3, 2]) === 2);
t("median even", median([1, 2, 3, 4]) === 2.5);
t("median skips gaps", median([1, null, 3]) === 2);
t("mean", mean([1, 2, 3]) === 2);
t("empty median is missing", median([]) === null);
t("no divide by zero", pctChange(0, 10) === null);
t("pct", pctChange(100, 110) === 10);

t("day number", dayNumberToIso(19761) === "2024-02-08");
const parsed = parseHistRow("19761:10,19768:12");
t("hist row", parsed.length === 2 && parsed[0].date === "2024-02-08" && parsed[1].price === 12);

// Missing month stays missing. October has a price, September does not. Not 0%.
const ends = monthEnds([
  { date: "2026-10-24", price: 110, source: "tcgcsv-daily" },
  { date: "2026-08-31", price: 100, source: "tcgcsv-daily" },
]);
const months = ["2026-08", "2026-09", "2026-10"];
const changes = changesFor(ends, months, fake.flatAbsPct);
t("august has no prior so missing", changes[0].pct === null && changes[0].missing === "no prior month");
t("september missing is not zero", changes[1].pct === null && changes[1].price === null);
t("october missing because september is missing", changes[2].pct === null && changes[2].price === 110);
t("october is not stored as 0", changes[2].pct !== 0);

const full = monthEnds([
  { date: "2026-07-31", price: 100, source: "a" },
  { date: "2026-08-31", price: 110, source: "a" },
  { date: "2026-09-30", price: 121, source: "a" },
  { date: "2026-10-24", price: 133.1, source: "a" },
]);
const ch = changesFor(full, ["2026-08", "2026-09", "2026-10"], 40);
t("hand pct aug", Math.abs(ch[0].pct - 10) < 1e-6);
t("hand pct sep", Math.abs(ch[1].pct - 10) < 1e-6);
t("flat band from fixture treats 10 as flat", ch[0].direction === "flat");
t("tighter band would be up", directionOf(10, 1) === "up");
t("down", directionOf(-2, 1) === "down");

const zs = zScores(ch, 3);
t("z missing when every move is the same", zs.every((z) => z == null));
const variedEnds = monthEnds([
  { date: "2026-07-31", price: 100, source: "a" },
  { date: "2026-08-31", price: 110, source: "a" },
  { date: "2026-09-30", price: 100, source: "a" },
  { date: "2026-10-24", price: 130, source: "a" },
]);
const varied = changesFor(variedEnds, ["2026-08", "2026-09", "2026-10"], 1);
t("z exists when months clear the bar", zScores(varied, 3).every((z) => z != null));
t("z missing under a higher bar", zScores(ch, 9).every((z) => z == null));

const st = streakFrom(ch, full, 40);
t("streak counts the flat run", st && st.months === 3 && st.direction === "flat");

const rows = [
  { id: "a", set: "A", cells: [{ month: "2026-10", pct: 5, direction: "up" }] },
  { id: "b", set: "B", cells: [{ month: "2026-10", pct: -3, direction: "down" }] },
  { id: "c", set: "C", cells: [{ month: "2026-10", pct: null, direction: null }] },
];
const b = breadthBlock(rows, "2026-10", "2026-09");
t("breadth green matches cells", b.green === 1 && b.up === 1 && b.down === 1 && b.flat === 0 && b.total === 3 && b.missing === 1);
t("breadth average hand check", b.average === 1);
t("breadth median hand check", b.median === 1);
t("green pct", b.greenPct === Math.round((1 / 3) * 100 * 10000) / 10000);
const none = breadthBlock([
  { id: "a", set: "A", cells: [{ month: "2026-09", pct: null, direction: null }] },
  { id: "b", set: "B", cells: [{ month: "2026-09", pct: null, direction: null }] },
], "2026-09", "2026-08");
t("all missing is not 0 percent", none.green === 0 && none.greenPct === null && none.average === null && none.missing === 2);

const prev = { greenPct: 10, average: 2 };
const cur = { greenPct: 40, average: -1 };
t("split line", whatChanged(cur, prev) === "More products are up than last month, but the average move is weaker.");
t("missing compare", whatChanged({ greenPct: null, average: null }, prev).includes("missing"));

const endsA = monthEnds([{ date: "2026-09-30", price: 100, source: "a" }, { date: "2026-10-24", price: 80, source: "a" }]);
const endsB = monthEnds([{ date: "2026-09-30", price: 50, source: "a" }, { date: "2026-10-24", price: 70, source: "a" }]);
const built = buildFromSeries({
  products: [
    { id: "box-a", name: "A Box", set: "Alpha", setId: "swsh1", subtype: "booster-box", tcgPlayerId: "1", searchQuery: "A Box", image: "a.png", ends: endsA, changes: changesFor(endsA, ["2026-10"], 40), listings: [] },
    { id: "box-b", name: "B Box", set: "Beta", setId: "swsh2", subtype: "booster-box", tcgPlayerId: "2", searchQuery: "B Box", image: "b.png", ends: endsB, changes: changesFor(endsB, ["2026-10"], 40), listings: [] },
  ],
  eras: new Map([["swsh1", "Sword & Shield"], ["swsh2", "Sword & Shield"]]),
  months: ["2026-10"],
  marketChanges: new Map([["2026-10", median([-20, 40])]]),
  limits: { ...fake, heatmapMonths: 1, minMonthsForZ: 3 },
  singlesBySet: new Map([["swsh1", [
    { id: "tcgcsv-9", name: "Low", number: "1", price: 5, ends: monthEnds([{ date: "2026-10-01", price: 5, source: "set-value" }]), points: [{ date: "2026-10-01", price: 5, source: "set-value" }], tcgUrl: "https://www.tcgplayer.com/product/9", ebayUrl: "https://www.ebay.com/sch/i.html?_nkw=Low" },
    { id: "tcgcsv-8", name: "Chase", number: "2", price: 20, ends: monthEnds([{ date: "2026-10-14", price: 20, source: "tcgcsv-daily" }]), points: [{ date: "2026-10-14", price: 20, source: "tcgcsv-daily" }], tcgUrl: "https://www.tcgplayer.com/product/8", ebayUrl: "https://www.ebay.com/sch/i.html?_nkw=Chase" },
  ]]]),
  built: "2026-10-24",
});
t("flag off", built.flag === "off" && built.private === true);
t("chase is highest", built.pairs.find((p) => p.setId === "swsh1").chase.name === "Chase");
t("NM only on the chase card", built.pairs.every((p) => !p.chase || p.chase.condition === "NM"));
t("sealed rows have no condition", built.rows.every((r) => r.condition == null));
t("limits number not copied", built.limits === "loaded" && !JSON.stringify(built).includes("flatAbsPct"));
const blob = JSON.stringify(built);
t("no banned wording", !proseHasBanned(built.label) && built.breadth.every((x) => !proseHasBanned(x.whatChanged)) && built.pairs.every((p) => !proseHasBanned(p.singlesLead) && !proseHasBanned(p.chaseLead)));
t("no em dash in output", !blob.includes("\u2014") && !blob.includes("\u2013"));
t("listings word not sold", !/\bsold\b|\bsales?\b/i.test(blob));

const picked = pickRepresentative([
  { id: "b-etb", setId: "s", subtype: "etb" },
  { id: "a-box", setId: "s", subtype: "booster-box" },
  { id: "c-pc", setId: "s", subtype: "pc-etb" },
], fake);
t("box wins over etb", picked.length === 1 && picked[0].id === "a-box");

const hi = highBelow([{ date: "2026-06-07", price: 200, source: "a" }, { date: "2026-10-24", price: 150, source: "a" }]);
t("below high", hi.belowUsd === 50 && hi.highDate === "2026-06-07" && Math.abs(hi.belowPct - (-25)) < 1e-9);

t("script has no live cutoff numbers", (() => {
  const src = readFileSync(join(ROOT, "scripts/sealed-market-pulse.mjs"), "utf8") + readFileSync(join(ROOT, "scripts/lib/sealed-market-pulse.mjs"), "utf8");
  return !src.includes("flatAbsPct: 0.05") && !src.includes("0.05") && src.includes("pulse limits not loaded") && !src.includes("pokeviz");
})());

{
  const own = [
    { date: "2098-12-20", price: 99, source: "own" },
    { date: "2099-01-02", price: 100, source: "own" },
    { date: "2099-01-15", price: 100, source: "own" },
    { date: "2099-01-20", price: 110, source: "own" },
    { date: "2099-03-02", price: 90, source: "own" },
  ];
  const mirror = [["2098-12-01", 80], ["2098-12-20", 70], ["2099-01-01", 85], ["2099-01-02", 1], ["2099-01-16", 1], ["2099-02-01", 50]];
  const joined = joinMirror(own, mirror, fake);
  t("mirror day before cutover is kept", joined.points.some((p) => p.date === "2098-12-01" && p.price === 80 && p.source === "archived-market"));
  t("mirror day on cutover is not filled", !joined.points.some((p) => p.date === "2099-01-02" && p.source === "archived-market"));
  t("own day on cutover is kept", joined.points.find((p) => p.date === "2099-01-02").price === 100 && joined.points.find((p) => p.date === "2099-01-02").source === "own");
  t("own day before cutover is not mixed into mirror window", !joined.points.some((p) => p.date === "2098-12-20" && p.source === "own"));
  t("mirror fills the day before cutover", joined.points.some((p) => p.date === "2099-01-01" && p.price === 85));
  t("mirror day after cutover is not filled", !joined.points.some((p) => p.date === "2099-02-01" || p.date === "2099-01-16"));
  t("gap over the private limit is logged on overlap before cutover", joined.gaps.length === 1 && joined.gaps[0].date === "2098-12-20" && joined.gaps[0].ours === 99);
  t("own month span after cutover", ownMonthSpan(own.filter((p) => p.date >= fake.archiveNoteDate)) === 2);
  t("archive note has no site name", archiveAbout(fake.archiveNoteDate) === "History before Jan 2 2099 comes from archived TCGplayer market prices." && !/pokeviz/i.test(joined.about));
  // Sep 30 month end stays on mirror when own started earlier in September
  const live = { ...fake, archiveNoteDate: "2026-10-14", ownMonthsBeforeCutover: 12 };
  const esOwn = [
    { date: "2026-09-25", price: 2356.15, source: "own" },
    { date: "2026-09-27", price: 2322.75, source: "own" },
    { date: "2026-10-14", price: 2226.06, source: "own" },
    { date: "2026-10-24", price: 2214.94, source: "own" },
  ];
  const esMirror = [
    ["2026-06-30", 2670.58], ["2026-07-31", 2510.64], ["2026-08-31", 2453.92],
    ["2026-09-29", 2310.75], ["2026-09-30", 2296.51], ["2026-10-13", 2263.87], ["2026-10-14", 9999],
  ];
  const es = joinMirror(esOwn, esMirror, live);
  const esEnds = monthEnds(es.points);
  t("ES Jul month end is mirror", esEnds.get("2026-07").price === 2510.64 && esEnds.get("2026-07").date === "2026-07-31");
  t("ES Sep month end is Sep 30 mirror not mid-month own", esEnds.get("2026-09").price === 2296.51 && esEnds.get("2026-09").date === "2026-09-30");
  t("ES Oct uses own on or after cutover", esEnds.get("2026-10").price === 2214.94 && esEnds.get("2026-10").source === "own");
  const esCh = changesFor(esEnds, ["2026-07", "2026-08", "2026-09", "2026-10"], live.flatAbsPct);
  t("ES Jul pct vs June mirror", Math.abs(esCh[0].pct - ((2510.64 - 2670.58) / 2670.58 * 100)) < 1e-4);
  t("ES Sep pct vs Aug mirror", Math.abs(esCh[2].pct - ((2296.51 - 2453.92) / 2453.92 * 100)) < 1e-4);
  t("ES Oct pct vs Sep 30 mirror", Math.abs(esCh[3].pct - ((2214.94 - 2296.51) / 2296.51 * 100)) < 1e-4);
  const longOwn = [
    { date: "2099-01-15", price: 10, source: "own" },
    { date: "2099-04-02", price: 12, source: "own" },
  ];
  const cut = joinMirror(longOwn, mirror, fake);
  t("cutover uses our own prices only", cut.usedMirror === false && cut.points.length === 2 && cut.about === ownOnlyAbout());
  const basket = priceBasket([
    { set: "A", cells: [{ month: "2099-01", price: 100 }, { month: "2099-05", price: 80 }] },
    { set: "B", cells: [{ month: "2099-01", price: 50 }, { month: "2099-05", price: 40 }] },
    { set: "C", cells: [{ month: "2099-05", price: 10 }] },
  ], "2099-01", "2099-05");
  t("basket is the sum and a missing month stays out", basket.products === 2 && basket.excluded.length === 1 && Math.abs(basket.pct - ((120 - 150) / 150 * 100)) < 1e-9);
  const ago = yearAgo([{ date: "2025-10-24", price: 200 }, { date: "2026-10-24", price: 150 }]);
  t("same day one year earlier", ago.pct === -25 && ago.priorDate === "2025-10-24");
  t("a missing year stays missing", yearAgo([{ date: "2026-10-24", price: 150 }]).pct === null);
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("sealed market pulse tests passed");
