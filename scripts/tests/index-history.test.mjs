// Long index history: same chain-linked method, earlier sources, private guard values.
import { archiveCadence, cardSeries, chartSeries, indexDays, longIndexLine, splice } from "../lib/index-history.mjs";
import { aboutLines, gapLines, publicHistory } from "../build-index-history.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};
// Test values only. The live guard values are kept in catchem-data-private.
const guard = { junkX: 20, stepHi: 3, stepLo: 0.3, minLinks: 2 };
const weekly = ["2024-01-04", "2024-01-11", "2024-01-18"];
const cad = archiveCadence([...weekly, "2024-01-25", "2024-01-26", "2024-01-27", "2024-01-30"]);
t("cadence: weekly until the first back-to-back days", cad.dailyFrom === "2024-01-25" && cad.weeklyDays.join() === weekly.join() && cad.archiveEnd === "2024-01-30");
const days = indexDays({ weeklyDays: cad.weeklyDays, dailyFrom: cad.dailyFrom, end: "2024-02-12" });
t("grid is weekly then daily", days[0] === "2024-01-04" && days[3] === "2024-01-25" && days.includes("2024-02-12") && !days.includes("2024-01-05"));
const opts = { days, dailyFrom: cad.dailyFrom, archiveEnd: cad.archiveEnd, guard };

{
  const r = cardSeries({ long: [["2024-01-04", 10], ["2024-01-25", 11]] }, opts).map;
  t("a weekly-era day with no point is not carried", !r.has("2024-01-11"));
  t("a daily-era day holds the last archive price up to 7 days", r.get("2024-01-28")?.[0] === 11 && r.get("2024-01-28")?.[1] === "a" && r.has("2024-01-30"));
  t("never past the archive's last day", !r.has("2024-01-31"));
}
{
  const r = cardSeries({ own: [["2024-02-10", 5]], long: [["2024-01-25", 9], ["2024-02-10", 99]], fan: [["2024-02-05", 4], ["2024-02-11", 77]] }, opts).map;
  t("our own day wins", r.get("2024-02-10")?.[0] === 5 && r.get("2024-02-10")?.[1] === "n");
  t("fan days only before our first own day", r.get("2024-02-05")?.[1] === "f" && !r.has("2024-02-11"));
}
{
  const r = cardSeries({ long: [["2024-01-04", 20], ["2024-01-11", 99999], ["2024-01-18", 21]] }, opts);
  t("a junk high far above the card's middle price is dropped", !r.map.has("2024-01-11") && r.dropped === 1);
}
{
  const base = [["2024-01-04", 10], ["2024-01-11", 10], ["2024-01-18", 11], ["2024-01-25", 11]];
  const cards = [{ long: base }, { long: base.map(([d, v]) => [d, v * 2]) }, { long: [["2024-01-18", 500], ["2024-01-25", 500]] }];
  const line = longIndexLine(cards, opts).points;
  const at = (d) => line.find((p) => p.d === d);
  t("line starts at 100", line[0].d === "2024-01-04" && line[0].v === 100);
  t("same cards' sum ratio", at("2024-01-18").v === 110);
  t("a dear card entering later does not jump the line", at("2024-01-25").v === 110, JSON.stringify(at("2024-01-25")));
  t("too few links is a gap, not a carried value", at("2024-02-01").v === null);
  const spike = [{ long: base }, { long: [["2024-01-04", 10], ["2024-01-11", 50], ["2024-01-18", 10]] }];
  const sp = longIndexLine(spike, opts);
  t("a one-step jump past the guard is left out of that link", sp.diag.stepOut >= 1);
  let threw = false;
  try { longIndexLine(cards, { ...opts, guard: null }); } catch { threw = true; }
  t("no private guard values, no line", threw);
}
{
  const long = [{ d: "2024-01-04", v: 100, s: "a" }, { d: "2024-01-11", v: 120, s: "f" }, { d: "2024-01-18", v: 150, s: "f" }];
  const own = [{ d: "2024-01-18", v: 100, n: 0 }, { d: "2024-01-19", v: null, n: 0 }, { d: "2024-01-20", v: 101.5, n: 9 }];
  const j = splice(long, own);
  t("splice keeps tonight's line exactly", j.points.slice(-3).map((p) => p.v).join() === "100,,101.5");
  t("earlier days are scaled to meet it", j.points[0].v === 66.7 && j.points[1].v === 80);
  t("no meeting day leaves tonight's line alone", splice([{ d: "2024-01-04", v: 100 }], own).joined === false);
  const chart = chartSeries(j.points);
  t("chart series is real points only, day level source", chart.length === 4 && chart.every((p) => p.length === 3) && chart[2][2] === "n");
  const built = { cadence: { dailyFrom: "2024-01-25", archiveEnd: "2024-01-30" }, sides: { singles: { diag: { joined: true }, chart }, sealed: { diag: { joined: false }, chart: [] } } };
  const pub = publicHistory(built);
  const text = JSON.stringify(pub);
  t("public history has the chart and About lines only", Array.isArray(pub.singles) && !pub.sealed && !/junkX|stepHi|stepLo|minLinks|fShare|"n":/.test(text));
  t("About lines name the sources and the gap", pub.singlesAbout.some((l) => /tcgcsv daily archive/.test(l)) && pub.singlesAbout.some((l) => /fan-site/.test(l)) && pub.singlesAbout.some((l) => /1 day with no price file/.test(l)));
  t("copy rules: no dashes, no sold or sales", !/[\u2013\u2014]|\bsold\b|\bsales?\b/i.test(text));
  t("weekly steps are not gaps", gapLines([["2024-01-04", 1, "a"], ["2024-01-11", 1, "a"]], { dailyFrom: "2024-01-25" }).length === 0 && aboutLines([], {}).length === 0);
}

if (fail) { console.error(`index history: ${fail} failed`); process.exit(1); }
console.log("index history ok");
