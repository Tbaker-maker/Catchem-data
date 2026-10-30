// Generator regressions fail this suite. The published board is last night's
// file: the same checks count those reads and print the totals. Failing the
// nightly on that file would block the job that rewrites it, and this pass
// does not republish.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alignToWindow, findings, compose, validSynth } from "../lib/read-synthesis.mjs";
import { priceRange, qualifyChips, readSignals } from "../lib/signal-chips.mjs";
import { changeOver } from "../lib/read-facts.mjs";
import { mixedReads } from "../lib/rich-reads.mjs";
import { speakDates } from "../lib/read-quality.mjs";
import { auditReads, mixedWindows, rawDate } from "../lib/read-consistency.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CFG = validSynth(JSON.parse(readFileSync(new URL("./fixtures/read-synthesis-limits.json", import.meta.url), "utf8")));
const RULES = {
  max: 4,
  move: { flatAbs: 1, preferDays: [7], slackDays: 1, minDays: 2 },
  supply: { minAbsPct: 5 },
  gone: { cuts: [3, 10], minDrop: 5 },
  range: { minDays: 1 },
  momentum: { risingMin: 99, coolingMax: -99, recentDays: 7 },
  confidence: { cuts: [99, 99] },
};

function day(iso, price) { return [iso, price]; }

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const asOf = "2026-10-30";
  const pts = [];
  for (let i = 0; i <= 365; i += 1) {
    const iso = new Date(Date.parse("2025-10-30T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    const price = iso < "2026-10-23" ? 10 : iso < asOf ? 11 : 12;
    pts.push([iso, price]);
  }
  const item = { id: "x", pts, title: "Rayquaza (Test) 14/146", asOf, set: "Test", setSlug: "ts", release: "2024-01-01", sealed: false };
  const found = findings(item, { peers: new Map(), listings: new Map(), asks: new Map(), rotation: new Map(), setValue: new Map() }, CFG);
  const got = compose(item, found, CFG, null);
  const head = got?.text || "";
  t("one window in a synthesized headline", got && !mixedWindows({ headline: head, windowDays: got.lead.window }) && !/over 7 days[\s\S]*over 30 days|over 30 days[\s\S]*on the year|in a week[\s\S]*on the year/i.test(head));
  t("a synthesized headline does not print a raw date", !rawDate({ headline: head }));

  const chips = readSignals(
    { id: "ray", name: "Rayquaza", kind: "single", asOf, price: 12, windowDays: 365, changePct: 20 },
    { asOf, points: pts, daily: pts.filter((p) => p[0] >= "2026-10-01") },
    RULES,
  );
  const move = (chips.signals || []).find((chip) => chip.kind === "move");
  t("a year read does not wear a 7 day move chip", !move || !/\b7D\b|7 days/i.test(`${move.text || ""} ${move.label || ""}`));
  t("a year read does not wear a 7 day price tile", !chips.tiles?.price || Number(chips.tiles.price.days) === 365);

  const highPts = [day("2026-10-24", 9), day("2026-10-26", 10), day("2026-10-28", 10.5), day(asOf, 11.1)];
  const range = priceRange(highPts, asOf, { minDays: 1, windowDays: 7 });
  t("a price at the high is the upper part of that window", range && range.place === "upper part" && Math.round(range.high * 100) === 1110);
  const lowChip = qualifyChips(
    { id: "char", name: "Charmander", kind: "single", asOf, price: 11.1, windowDays: 7 },
    { asOf, points: highPts },
    RULES,
  ).find((chip) => chip.kind === "range");
  t("the range chip does not say lower part at the high", lowChip && /upper part/.test(lowChip.label));

  t("change over 7 days rejects an 8 day span", changeOver([day("2026-10-22", 3.33), day(asOf, 11.1)], 7, asOf) === null);
  const night = [];
  for (let i = 0; i <= 7; i += 1) {
    const iso = new Date(Date.parse("2026-10-23T00:00:00Z") + i * 86400000).toISOString().slice(0, 10);
    night.push([iso, i === 7 ? 11.1 : 3.33]);
  }
  t("one night is not returned as a 7 day change", changeOver(night, 7, asOf) === null);
  const nightChip = qualifyChips(
    { id: "night", name: "Card", kind: "single", asOf, price: 11.1, windowDays: 7, changePct: 200 },
    { asOf, points: night },
    RULES,
  ).find((chip) => chip.kind === "move");
  t("one night is not a 7 day move chip", !nightChip);

  const gone = qualifyChips(
    { id: "box", name: "Celestial Storm Booster Box", kind: "sealed", href: "/p/box", asOf },
    { asOf, listings: { n: 8, prev: 10, date: asOf, prevDate: "2026-10-29" } },
    RULES,
  ).find((chip) => chip.kind === "gone");
  t("10 listings to 8 is not listings gone", !gone);
  const closed = qualifyChips(
    { id: "box2", name: "Box", kind: "sealed", href: "/p/box2", asOf },
    { asOf, listings: { n: 8, prev: 40, date: asOf } },
    { ...RULES, gone: { cuts: [3, 10] } },
  ).find((chip) => chip.kind === "gone");
  t("gone fails closed without a private minimum", !closed);

  const mixed = mixedReads({
    cards: [{ id: "tcgcsv-1", name: "Pikachu", pts: [["2025-10-30", 4], ["2026-10-23", 10], [asOf, 12]] }],
    asOf,
  });
  t("a mixed card read keeps a single window", mixed.every((row) => !mixedWindows(row) && !rawDate(row)));
  t("spoken dates have no raw day", !/\b20\d{2}-\d{2}-\d{2}\b/.test(speakDates("From TCGplayer market, 2025-10-30 and 2026-10-30.", asOf)));

  const planted = [
    { id: "mix", headline: "Up 17% over 30 days and up 497% on the year.", signals: [{ kind: "move", text: "10% 7D", label: "Price down 10 percent over 7 days", days: 7 }] },
    { id: "iso", headline: "From TCGplayer market, 2026-10-30.", source: "TCGplayer market, 2026-10-29 and 2026-10-30" },
    { id: "range", price: 11.1, signals: [{ kind: "range", high: 11.1, low: 3, label: "Today sits in the lower part of the 7 day range." }] },
    { id: "span", windowDays: 7, startDate: "2026-10-22", endDate: "2026-10-30", headline: "Up 10% over 7 days." },
    { id: "night", windowDays: 7, startDate: "2026-10-29", endDate: "2026-10-30", headline: "Up 20% in a week." },
    { id: "gone", signals: [{ kind: "gone", label: "Listings gone, fast" }], lines: ["Listings counted 10 on Oct 29 to 8 on Oct 30."] },
  ];
  const plantedHits = auditReads(planted, { minDrop: 5 }).counts;
  t("the auditor catches each planted class", plantedHits.mixed >= 1 && plantedHits.rawDate >= 1 && plantedHits.rangePlace >= 1 && plantedHits.weekSpan >= 1 && plantedHits.oneNight >= 1 && plantedHits.gone >= 1);

  const ray = alignToWindow({
    id: "span-year-ago-tcgcsv-88627",
    headline: "Ahead of its set: Rayquaza is up 17% over 30 days.",
    lines: ["$53.13 on 2026-10-30. $317.57 on 2026-10-30. +497.7% across 365 days.", "Down over 7 days."],
    signals: [
      { kind: "move", text: "10% 7D", label: "Price down 10 percent over 7 days", days: 7 },
      { kind: "range", days: 69, label: "Today sits in the upper part of the 69 day range." },
      { kind: "era", label: "Classic" },
    ],
    tiles: { price: { days: 7, dir: "down", pct: 10 } },
    source: "TCGplayer market, 2025-10-30 and 2026-10-30",
  }, 30);
  t("a 30 day read drops the 7 day chip, the year line and the 7 day tile", ray.windowDays === 30 && !(ray.signals || []).some((chip) => chip.kind === "move" || chip.kind === "range") && (ray.signals || []).some((chip) => chip.kind === "era") && !ray.tiles?.price && !(ray.lines || []).some((line) => /365|7 day/i.test(line)));

  let live = { counts: { total: 0, mixed: 0, rawDate: 0, rangePlace: 0, weekSpan: 0, oneNight: 0, gone: 0 }, ids: {} };
  try {
    const doc = JSON.parse(readFileSync(join(ROOT, "research/assets/public/reads.json"), "utf8"));
    live = auditReads(doc.reads || [], {});
  } catch { /* the published file is optional in a bare checkout */ }
  console.log(`  live reads ${live.counts.total}: mixed ${live.counts.mixed}, raw dates ${live.counts.rawDate}, range place ${live.counts.rangePlace}, 7 day span ${live.counts.weekSpan}, one night as a week ${live.counts.oneNight}, listings gone ${live.counts.gone}`);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("read-consistency.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
