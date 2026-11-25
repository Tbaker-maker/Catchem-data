// Chips must follow the read's own lines. A read dated before the board day
// is dropped. Fixture numbers only.
import { readSignals } from "../lib/signal-chips.mjs";
import { beforeBoard, fixChips, guardReads } from "../lib/reads-guard.mjs";
import { ripReads } from "../lib/rich-reads.mjs";
import { turnedReads } from "../lib/read-quality.mjs";
import { synthesizeReads } from "../lib/read-synthesis.mjs";
import { whatWeSee } from "../lib/what-we-see.mjs";

const RULES = {
  max: 4,
  move: { flatAbs: 10, preferDays: [7], slackDays: 0, minDays: 2 },
  supply: { minAbsPct: 5, windowDays: 7, slackDays: 0 },
  momentum: { risingMin: 4, coolingMax: -4, recentDays: 7 },
};

function daysFrom(start, n, priceAt) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const iso = new Date(Date.parse(`${start}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    out.push([iso, priceAt(i, iso)]);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const asOf = "2026-11-25";
  const mewPoints = daysFrom("2026-11-11", 15, (i) => {
    if (i === 12) return 16;
    if (i === 13) return 18;
    if (i === 14) return 20;
    return 40 - i;
  });
  const beforeMomentum = {
    id: "turned-fake-1",
    sku: "tcgcsv-1",
    readKind: "turned",
    kind: "turned",
    asOf,
    price: 14,
    changePct: -26,
    windowDays: 7,
    headline: "Down 26% in a week: Sample Card went from $20.00 on Nov 18 to $14.00 on Nov 25.",
    lines: ["Down 26% in one week, from $20.00 on Nov 18 to $14.00 on Nov 25."],
  };
  const mom = readSignals(beforeMomentum, { asOf, points: mewPoints }, { ...RULES, max: 6 });
  const cooling = (mom.signals || []).find((chip) => chip.kind === "momentum" && chip.word === "Cooling");
  t("two up nights do not get a Cooling chip", !cooling);
  console.log("BEFORE momentum " + JSON.stringify({ word: "Cooling", sparkTail: mewPoints.slice(-3) }));
  console.log("AFTER momentum " + JSON.stringify({ signals: (mom.signals || []).filter((chip) => chip.kind === "momentum") }));

  const series = new Map([[7, new Map([
    ["2026-11-18", 40],
    ["2026-11-23", 20],
    ["2026-11-24", 22],
    ["2026-11-25", 24],
  ])]]);
  const names = new Map([["tcgcsv-7", { name: "Sample Card", set: "Example Set" }]]);
  const turned = turnedReads({
    series,
    asOf,
    names,
    dailyFiles: new Set(["2026-11-18", "2026-11-23", "2026-11-24", "2026-11-25"]),
  });
  t("two up nights stay in the turned line", turned.length === 1 && /last two nights/i.test(turned[0].headline) && /turned up/.test(turned[0].why));
  const kept = synthesizeReads(turned, {}, null);
  t("synthesis does not replace a turned line", kept.reads[0].headline === turned[0].headline && kept.reads[0].why === turned[0].why);
  const cooled = fixChips({
    ...turned[0],
    signals: [{ kind: "momentum", word: "Cooling", label: "Momentum Cooling" }],
    blurb: "Momentum is Cooling.",
  });
  t("a Cooling chip is dropped when the line says the nights turned up", !cooled.read.signals.some((chip) => chip.word === "Cooling") && cooled.read.blurb === "");

  const listingsSeries = [];
  for (let i = 0; i <= 7; i += 1) {
    const iso = new Date(Date.parse("2026-11-18T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    listingsSeries.push({ date: iso, n: i === 0 ? 13 : 9 });
  }
  const box = {
    id: "rip-fake-box",
    name: "Example Booster Box",
    kind: "sealed",
    readKind: "rip",
    href: "/p/example-box",
    asOf,
    lines: ["Listings counted 10 on Nov 24 to 9 on Nov 25. A listing is not a sale."],
    receipt: { n: 9, prev: 10, date: asOf, prevDate: "2026-11-24" },
  };
  const listed = readSignals(box, {
    asOf,
    listings: { n: 9, prev: 10, date: asOf, prevDate: "2026-11-24", series: listingsSeries },
  }, { ...RULES, max: 4 });
  const listChip = (listed.signals || []).find((chip) => chip.kind === "listings");
  t("the listings chip uses the line's 10 to 9, not the other window", listChip && listChip.dir === "down" && /^-?10%| -10%|Listings -10%/.test(listChip.text) && !/31/.test(listChip.text));
  const mismatched = fixChips({
    ...box,
    signals: [{ kind: "listings", dir: "down", text: "Listings -31% 7d", label: "Listings counted down 31 percent over 7 days" }],
    blurb: "Listings counted are down 31% over 7 days, as of Nov 25.",
  });
  console.log("BEFORE listings " + JSON.stringify({ text: "Listings -31% 7d", line: "10 to 9" }));
  console.log("AFTER listings " + JSON.stringify({ signals: mismatched.read.signals, blurb: mismatched.read.blurb, built: listChip || null }));
  t("a chip percent that is not in the line is dropped", mismatched.read.signals.length === 0 && mismatched.read.blurb === "");

  const oldRip = ripReads({
    asOf,
    rows: [
      { id: "old-box", name: "Old Box", setId: "old", price: 100, contentsEV: 40, priceAsOf: "2026-11-24", packs: 36 },
      { id: "new-box", name: "New Box", setId: "new", price: 80, contentsEV: 20, priceAsOf: asOf, packs: 36 },
    ],
  });
  t("a rip row dated before the board day is not built as current", oldRip.length === 1 && oldRip[0].id === "rip-new-box" && oldRip[0].endDate === asOf);
  const monthOld = ripReads({
    asOf,
    rows: [{ id: "old-pack", name: "Old Pack", setId: "oldpack", price: 4, contentsEV: 1, priceAsOf: "2026-10-23", packs: 1 }],
  });
  t("a month-old rip price is not a current read", monthOld.length === 0);
  const guarded = await guardReads([
    { id: "rip-old-box", readKind: "rip", asOf: "2026-11-24", endDate: "2026-11-24", headline: "Old box on Nov 24.", name: "Old Box" },
    { id: "news-old", readKind: "newsline", asOf: "2026-11-20", endDate: "2026-11-20", headline: "A dated news line." },
  ], { boardDay: asOf, cfg: null, daily: null, heatRows: [], head: null });
  t("guard drops a read dated before the board day", beforeBoard({ readKind: "rip", endDate: "2026-11-24" }, asOf) && guarded.keep.length === 1 && guarded.keep[0].id === "news-old" && guarded.flags.some((row) => row.rule === "before-board"));

  const seen = new Set();
  const facts = {
    item: { id: "tcgcsv-704191", kind: "sealed", name: "Example Ultra-Premium Collection" },
    change: { d30: { pct: -41.7, from: "2026-10-26", to: "2026-11-25", p0: 200, p1: 116.6 } },
    setMomentum: { pct: -25.2, from: "2026-10-26", to: "2026-11-25", set: "Example Set", kind: "sealed" },
    range: { from: "2026-09-26", now: { date: asOf, price: 116.6 }, high: { price: 200, date: "2026-10-03" }, low: { price: 110, date: "2026-11-22" }, daysSinceHigh: 50, fromHighPct: -41.7 },
  };
  for (let i = 0; i < 40; i += 1) seen.add(whatWeSee({ ...facts, item: { ...facts.item, id: `tcgcsv-${700000 + i}` } }));
  const lines = [...seen].filter(Boolean);
  t("the set comparison never says the product printed a percent", lines.length > 0 && lines.every((line) => !/\bprinted\b/i.test(line)) && lines.some((line) => /market price moved/.test(line)));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-line-guards.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
