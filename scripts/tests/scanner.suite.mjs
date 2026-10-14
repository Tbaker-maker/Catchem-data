import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays } from "../lib/tracker.mjs";
import { detect as climb } from "../lib/scanner/patterns/slow-climb.mjs";
import { detect as slide } from "../lib/scanner/patterns/slow-slide.mjs";
import { detect as breakout } from "../lib/scanner/patterns/breakout.mjs";
import { detect as spike } from "../lib/scanner/patterns/sharp-spike.mjs";
import { detect as revert } from "../lib/scanner/patterns/spike-revert.mjs";
import { detect as recovery } from "../lib/scanner/patterns/recovery.mjs";
import { detect as flat } from "../lib/scanner/patterns/flat-range.mjs";
import { detect as listDown } from "../lib/scanner/patterns/listings-down-flat.mjs";
import { detect as listUp } from "../lib/scanner/patterns/listings-up-flat.mjs";
import { detect as bothUp } from "../lib/scanner/patterns/price-up-listings-up.mjs";
import { detect as bothDown } from "../lib/scanner/patterns/price-down-listings-down.mjs";
import { detect as thin } from "../lib/scanner/patterns/thin-jump.mjs";
import { detect as group } from "../lib/scanner/patterns/group-together.mjs";
import { detect as away } from "../lib/scanner/patterns/breakaway.mjs";
import { detect as release } from "../lib/scanner/patterns/release-window.mjs";
import { detect as yearAgo } from "../lib/scanner/patterns/year-ago.mjs";
import { privateOnly as thinPrivate } from "../lib/scanner/patterns/thin-jump.mjs";
import {
  coveredInWeek, expectedDir, gradeDetection, isDirHit, priceBand, replayItems, replayStep, rotationMembership, scoreGates, splitOf, splitScan, wilson90,
} from "../lib/scanner/engine.mjs";
import { buildScannerReads, scannerCopyOk } from "../lib/scanner/reads.mjs";
import { writePrivate } from "../lib/scanner/load.mjs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function pts(start, values, step = 7) {
  return values.map((price, i) => ({ date: addDays(start, i * step), price, src: "own" }));
}
function series(points, extra = {}) {
  return { id: "tcgcsv-1", name: "Pikachu", kind: "single", set: "SV01: Base", points, asOf: points.at(-1).date, href: "/c/tcgcsv-1", ...extra };
}

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const up = series(pts("2026-01-01", [100, 104, 108, 112, 116]));
  const forming = series(pts("2026-01-01", [100, 102, 104, 106]));
  const ending = series(pts("2026-01-01", [100, 104, 108, 112, 116, 112]));
  t("slow climb confirms", climb(up)?.stage === "confirmed");
  t("slow climb forms", climb(forming)?.stage === "forming");
  t("slow climb ends", climb(ending)?.stage === "ending");
  const down = series(pts("2026-01-01", [100, 96, 92, 88, 84]));
  t("slow slide confirms", slide(down)?.stage === "confirmed");
  const downEnd = series(pts("2026-01-01", [100, 96, 92, 88, 84, 88]));
  t("slow slide ends", slide(downEnd)?.stage === "ending");

  const range = [];
  for (let i = 0; i < 8; i += 1) range.push({ date: addDays("2026-01-01", i * 4), price: 10 + (i % 2 ? 0.2 : 0), src: "own" });
  range.push({ date: addDays(range.at(-1).date, 6), price: 11.2, src: "own" });
  t("breakout confirms", breakout(series(range))?.stage === "confirmed");

  const spikePts = pts("2026-03-01", [10, 10.2, 12.2], 2);
  t("sharp rise confirms", spike(series(spikePts))?.stage === "confirmed");
  const spikeForm = pts("2026-03-01", [10, 10.2, 11], 2);
  t("sharp rise forms", spike(series(spikeForm))?.stage === "forming");
  const revertPts = [
    { date: "2026-03-01", price: 10, src: "own" },
    { date: "2026-03-03", price: 13, src: "own" },
    { date: "2026-03-06", price: 11, src: "own" },
    { date: "2026-03-09", price: 11.1, src: "own" },
  ];
  t("spike revert confirms or ends", ["confirmed", "ending"].includes(revert(series(revertPts))?.stage));

  const rec = pts("2026-01-01", [20, 18, 14, 12, 13.5, 14.5]);
  t("recovery confirms", recovery(series(rec))?.stage === "confirmed");

  const flatPts = pts("2026-01-01", [10, 10.1, 9.95, 10.05, 10.02]);
  t("flat range confirms", flat(series(flatPts))?.stage === "confirmed");

  const listed = series(pts("2026-09-01", [10, 10.05, 10.1], 10), {
    listings: [{ date: "2026-09-01", n: 40 }, { date: "2026-09-21", n: 30 }],
  });
  t("listings counted down, price flat", listDown(listed)?.stage === "confirmed");
  const listedUp = series(pts("2026-09-01", [10, 10.05, 10.1], 10), {
    listings: [{ date: "2026-09-01", n: 20 }, { date: "2026-09-21", n: 30 }],
  });
  t("listings counted up, price flat", listUp(listedUp)?.stage === "confirmed");
  const both = series(pts("2026-09-01", [10, 11, 12], 10), {
    listings: [{ date: "2026-09-01", n: 20 }, { date: "2026-09-21", n: 26 }],
  });
  t("price and listings counted both rise", bothUp(both)?.stage === "confirmed");
  const bothFall = series(pts("2026-09-01", [12, 11, 10], 10), {
    listings: [{ date: "2026-09-01", n: 30 }, { date: "2026-09-21", n: 22 }],
  });
  t("price and listings counted both fall", bothDown(bothFall)?.stage === "confirmed");
  const thinPts = pts("2026-09-01", [10, 12], 10);
  const thinRow = series(thinPts, {
    asOf: "2026-09-12",
    listings: [{ date: "2026-09-01", n: 18 }, { date: "2026-09-12", n: 8 }],
  });
  t("thin jump is private and confirms", thinPrivate === true && thin(thinRow)?.stage === "confirmed");

  t("group confirms at 20", group({ group: { type: "set", name: "SV", n: 20, up: 14, down: 2, medianPct: 6, start: "2026-09-01", end: "2026-09-29" } })?.stage === "confirmed");
  t("group under 20 is skipped", group({ group: { type: "set", name: "SV", n: 19, up: 14, down: 2, medianPct: 6, start: "2026-09-01", end: "2026-09-29" } }) == null);
  t("group ends when the share falls", group({ group: { type: "set", name: "SV", n: 20, up: 6, down: 4, medianPct: 1, start: "2026-09-22", end: "2026-09-29", priorShare: 0.7, priorStart: "2026-09-01" } })?.stage === "ending");
  t("breakaway confirms", away({ breakaway: { change: 20, median: 2, n: 20, start: "2026-09-01", end: "2026-09-29" } })?.stage === "confirmed");
  t("breakaway ends", away({ breakaway: { change: 2, median: 1, n: 20, start: "2026-09-01", end: "2026-09-29", priorAbs: 12 } })?.stage === "ending");

  const ago = series([
    { date: "2025-10-13", price: 10, src: "own" },
    { date: "2026-10-13", price: 14, src: "own" },
  ]);
  t("year ago confirms on the exact date", yearAgo(ago)?.stage === "confirmed");
  const relPts = [
    { date: "2025-09-26", price: 20, src: "own" },
    { date: "2025-10-26", price: 12, src: "own" },
    { date: "2026-10-13", price: 11, src: "own" },
  ];
  t("release window uses last year's 30 days", release(series(relPts, { release: "2025-09-26", asOf: "2026-10-13" }))?.stage === "confirmed");

  const items = [];
  for (let i = 0; i < 24; i += 1) {
    const values = [];
    for (let d = 0; d < 10; d += 1) values.push(10 + d * 0.4 + (i % 5) * 0.05);
    items.push({
      id: `tcgcsv-${i}`, name: `Card ${i}`, kind: "single", set: "SV01: Test", price: 14,
      points: pts("2025-06-01", values, 14), href: `/c/tcgcsv-${i}`,
    });
  }
  const asOf = items[0].points.at(-1).date;
  const a = replayItems(items, asOf);
  const b = replayItems(items, asOf);
  t("same date replays the same grades", JSON.stringify(a.detections) === JSON.stringify(b.detections));
  const sample = a.detections.find((row) => row.grades && row.grades["30d"]);
  t("replay grade matches a fresh grade", !!sample && JSON.stringify(sample.grades) === JSON.stringify(gradeDetection(sample, items.find((item) => item.id === sample.id).points, a.medians, asOf)));

  const ids = items.map((item) => item.id);
  t("a week of nights covers every id", coveredInWeek(ids, "2026-10-13"));
  const seen = new Set();
  for (let i = 0; i < 7; i += 1) {
    const day = addDays("2026-10-13", i);
    for (const item of rotationMembership(items, day).tonight) seen.add(item.id);
  }
  t("rotation visits every catalogued id in 7 nights", seen.size === ids.length);

  const tail = Array.from({ length: 200 }, (_, i) => ({ id: `id-${i}`, kind: "single", price: 1 }));
  const split = splitScan(tail, new Set(), "2026-10-13");
  t("explore is about 30% when nothing is forced", split.tailExploreShare > 0.2 && split.tailExploreShare < 0.4);

  const present = [{
    id: "tcgcsv-9", name: "Pikachu", kind: "single", pattern: "slow-climb", stage: "confirmed",
    date: asOf, strength: 80, start: "2026-09-01", end: asOf, p0: 10, p1: 12,
    startSrc: "own", endSrc: "own", metrics: { pct: 20 }, privateOnly: false, explore: false, candidate: "",
    href: "/c/tcgcsv-9", set: "SV01: Test",
  }];
  const weak = [{ pattern: "slow-climb", stage: "confirmed", kind: "single", horizon: 30, n: 19, hits: 10, rate: 50, baseRate: 10, passed: false, decayedRate: 0.5, medianPct: 4, from: "2026-01-01", to: "2026-09-01", examples: [] }];
  t("an unproven pattern never goes public", buildScannerReads(present, weak, asOf).length === 0);
  const passed = [{ ...weak[0], n: 24, passed: true, from: "2026-01-01", to: "2026-09-01", examples: [{ id: "a", name: "A", from: "2026-01-01", to: "2026-02-01", p0: 10, p1: 11, pct: 10 }] }];
  const pub = buildScannerReads(present, passed, asOf);
  t("a proven pattern can go public", pub.length >= 1 && pub.every((row) => scannerCopyOk(row.headline) && scannerCopyOk(row.why)));
  const filled = [{ ...present[0], startSrc: "fill" }];
  t("fill is not a public read", buildScannerReads(filled, passed, asOf).every((row) => row.readKind === "past-cases"));
  const artist = [{
    ...present[0], id: "artist|x", kind: "group", pattern: "group-together", name: "A Person",
    metrics: { groupType: "artist", noun: "single", up: 1, down: 10, n: 12, pct: -9 }, p0: null, p1: null,
  }];
  const artistGate = [{ ...passed[0], pattern: "group-together", kind: "group", stage: "confirmed" }];
  t("an artist name is not a public read", buildScannerReads(artist, artistGate, asOf).every((row) => !/A Person/.test(row.headline)));
  const priv = [{ ...present[0], privateOnly: true, pattern: "thin-jump" }];
  t("thin jump stays private", buildScannerReads(priv, [{ ...passed[0], pattern: "thin-jump" }], asOf).every((row) => row.pattern !== "thin-jump" && row.readKind === "past-cases" || row.readKind !== "listings-vs-price"));
  const cfg = JSON.parse(await readFile(join(ROOT, "config/scanner.json"), "utf8"));
  t("alerts stay off", cfg.alerts === false);
  t("a daily replay walks every point and the rest keep the long step", replayStep({ dailyReplay: true }, 40) === 1 && replayStep({}, 40) === 14 && replayStep({}, 10) === 1);

  t("up hit needs a rise over the median", isDirHit("up", 4, 2) === true && isDirHit("up", 4, 5) === false && isDirHit("up", 2, 0) === false);
  t("down hit is a fall under the median", isDirHit("down", -4, -1) === true && isDirHit("down", -4, -5) === false && isDirHit("down", -2, 0) === false && isDirHit("down", -4, null) === false);
  t("flat hit stays inside a 3 point band", isDirHit("flat", 3, null) === true && isDirHit("flat", -3, 9) === true && isDirHit("flat", 3.1, 0) === false);
  t("old up grade stays separate", isDirHit("down", -4, -1) === true && !(isDirHit("up", -4, -1)));
  t("direction follows the pattern", expectedDir({ pattern: "slow-slide", stage: "forming" }) === "down" && expectedDir({ pattern: "spike-revert", stage: "ending" }) === "down" && expectedDir({ pattern: "recovery", stage: "ending" }) === "down" && expectedDir({ pattern: "recovery", stage: "confirmed" }) === "up" && expectedDir({ pattern: "flat-range", stage: "confirmed" }) === "flat" && expectedDir({ pattern: "slow-climb", stage: "forming" }) === "up");
  t("a signed group move picks its own direction", expectedDir({ pattern: "group-together", stage: "confirmed", metrics: { pct: 6 } }) === "up" && expectedDir({ pattern: "year-ago", stage: "ending", metrics: { pct: -8 } }) === "down" && expectedDir({ pattern: "release-window", stage: "confirmed", metrics: { pct: 1 } }) === "flat");
  t("price bands split under 5, 5 to 20, 20 to 100, and 100 plus", priceBand(4.99) === "under-5" && priceBand(5) === "5-20" && priceBand(19.99) === "5-20" && priceBand(20) === "20-100" && priceBand(100) === "100-plus");
  const cut = addDays("2026-10-13", -122);
  t("the last 4 months are the test split", splitOf(cut, "2026-10-13") === "test" && splitOf(addDays(cut, -1), "2026-10-13") === "train");
  const wilson = wilson90(12, 20);
  t("a 12 of 20 rate has a lower bound under 50%", wilson.lo < 0.5 && wilson.lo > 0.4 && wilson.hi > 0.6);

  const asOfGate = "2026-10-13";
  const baseOf = (rate) => ({ n: 40, hits: rate * 40, w: 40, wh: rate * 40, w2: 40, values: [] });
  const det = (i, date, hit, pattern, dir) => ({
    id: `gate-${pattern}-${dir}-${i}`, name: `Card ${i}`, pattern, stage: "confirmed", kind: "single", date, dir,
    startSrc: "own", endSrc: "own", privateOnly: false, explore: false, candidate: "", metrics: {},
    grades: { "30d": { scored: true, hit, upHit: dir === "up" ? hit : false, dir, pct: dir === "down" ? -6 : dir === "flat" ? 1 : 6, from: date, to: addDays(date, 30), fromSrc: "own", toSrc: "own", p0: 12, p1: dir === "down" ? 11 : 13 } },
  });
  const fillBase = (dir, rate) => {
    const base = new Map();
    for (const split of ["train", "test", "all"]) base.set(`single|30d|${dir}|${split}`, baseOf(rate));
    return base;
  };
  const many = (n, date, hit, pattern, dir) => Array.from({ length: n }, (_, i) => det(i, date, hit, pattern, dir));
  const bothPass = scoreGates([...many(22, "2026-02-01", true, "slow-slide", "down"), ...many(22, "2026-08-01", true, "slow-slide", "down")], fillBase("down", 0.2), asOfGate);
  const bothGate = bothPass.find((row) => row.pattern === "slow-slide" && row.horizon === 30);
  t("both splits must pass before a pattern is public", bothGate?.passed === true && bothGate.train.passed === true && bothGate.test.passed === true && bothGate.train.n === 22 && bothGate.test.n === 22);
  t("a down pattern keeps the old up-only column at zero", bothGate?.rate > 50 && bothGate.upRate === 0 && bothGate.dir === "down");
  const splitFail = scoreGates([...many(22, "2026-02-01", true, "slow-slide", "down"), ...many(22, "2026-08-01", false, "slow-slide", "down")], fillBase("down", 0.2), asOfGate);
  const splitGate = splitFail.find((row) => row.pattern === "slow-slide" && row.horizon === 30);
  t("a pass on the first 8 months and a miss on the last 4 stays private", splitGate?.train.passed === true && splitGate.test.passed === false && splitGate.passed === false);
  const low = scoreGates([...many(12, "2026-02-01", true, "slow-climb", "up"), ...many(8, "2026-02-01", false, "slow-climb", "up"), ...many(22, "2026-08-01", true, "slow-climb", "up")], fillBase("up", 0.5), asOfGate);
  const lowGate = low.find((row) => row.pattern === "slow-climb" && row.horizon === 30);
  t("the lower bound has to beat the base rate", lowGate?.train.passed === false && lowGate.train.rateLo < 50 && lowGate.passed === false);

  const groupRow = {
    id: "set|SV01: Test", name: "SV01: Test", kind: "group", pattern: "group-together", stage: "confirmed", dir: "up",
    date: asOf, strength: 40, start: "2026-09-01", end: "2026-09-29", p0: null, p1: null, startSrc: "own", endSrc: "own",
    metrics: { groupType: "set", noun: "single", up: 40, down: 8, n: 60, pct: 6 }, privateOnly: false, explore: false, candidate: "", href: "", set: "SV01: Test",
  };
  const groupExamples = [{ id: "a", name: "Pikachu", from: "2026-01-15", to: "2026-04-15", p0: 10, p1: 11, pct: 10 }];
  const groupGate = {
    pattern: "group-together", stage: "confirmed", kind: "group", dir: "up", horizon: 90, n: 93, hits: 52,
    rate: 56, decayedRate: 0.56, baseRate: 49, baseDecayed: 0.49, passed: true, medianPct: 4.2,
    from: "2026-01-15", to: "2026-08-01", examples: groupExamples,
    train: { n: 60, rate: 55, from: "2026-01-15", to: "2026-05-01" },
    test: { n: 33, rate: 58, from: "2026-06-20", to: "2026-08-01" },
  };
  const groupReads = buildScannerReads([groupRow], [groupGate], asOf);
  const groupText = groupReads.map((row) => [row.headline, ...row.lines, row.why].join(" ")).join(" ");
  t("a group line needs n of 50 and a 5 point gap", groupReads.length >= 1 && /was followed by a median/.test(groupText) && /In 93 past cases since Jan 2026/.test(groupText) && groupReads.every((row) => scannerCopyOk(row.headline) && row.lines.every((line) => scannerCopyOk(line))));
  t("a group line does not use a future word or the filler word", !/\b(will|within|future)\b/i.test(groupText));
  const thinGroup = buildScannerReads([groupRow], [{ ...groupGate, n: 49, decayedRate: 0.6, baseDecayed: 0.49 }], asOf);
  const closeGroup = buildScannerReads([groupRow], [{ ...groupGate, decayedRate: 0.53, baseDecayed: 0.49, rate: 53 }], asOf);
  t("a short or close group line stays private", thinGroup.length === 0 && closeGroup.length === 0);
  const flatPresent = [{ ...present[0], pattern: "flat-range", p0: 10, p1: 10.2, metrics: { pct: 1 }, dir: "flat" }];
  const flatGate = [{ ...passed[0], pattern: "flat-range", dir: "flat", rate: 40, baseRate: 20 }];
  const flatReads = buildScannerReads(flatPresent, flatGate, asOf);
  t("a flat public line says the band without the filler word", flatReads.some((row) => /no bigger than 3% either way/.test(row.why)) && flatReads.every((row) => !/\bwithin\b/i.test(row.why)));
  const downPresent = [{ ...present[0], pattern: "slow-slide", p0: 20, p1: 16, metrics: { pct: -20 }, dir: "down" }];
  const downGate = [{ ...passed[0], pattern: "slow-slide", dir: "down" }];
  const downReads = buildScannerReads(downPresent, downGate, asOf);
  t("a down public line names a fall", downReads.some((row) => /later fall of at least 3%/.test(row.why)));
  const wideFlat = buildScannerReads([{ ...present[0], pattern: "flat-range", p0: 10, p1: 14.2, metrics: { pct: 42 }, dir: "flat" }], flatGate, asOf);
  t("a flat line whose own prices moved more than 3% stays off the item read", wideFlat.every((row) => row.readKind !== "pattern-forming"));
  const flatOpenWide = [{ ...present[0], pattern: "flat-range", stage: "forming", p0: 20, p1: 24, metrics: { pct: 20 }, dir: "flat" }];
  const flatPastGate = [{
    ...passed[0], pattern: "flat-range", stage: "forming", dir: "flat", medianPct: 0, rate: 60, baseRate: 40,
    examples: [
      { id: "a", name: "Kirlia", from: "2026-01-01", to: "2026-01-08", p0: 10, p1: 10, pct: 0 },
      { id: "b", name: "Lugia", from: "2026-02-01", to: "2026-02-08", p0: 11, p1: 11, pct: 0 },
      { id: "c", name: "Lysandre", from: "2026-03-01", to: "2026-03-08", p0: 12, p1: 12, pct: 0 },
    ],
  }];
  const flatPast = buildScannerReads(flatOpenWide, flatPastGate, asOf);
  const pastText = flatPast.filter((row) => row.readKind === "past-cases").map((row) => row.lines.join(" ")).join(" ");
  t("a flat past line does not show an open move over 3%", flatPast.some((row) => row.readKind === "past-cases") && !/Open now/.test(pastText));
  const bare = buildScannerReads([], [{ ...groupGate, examples: [{ id: "g", name: "SV", from: "2026-01-15", to: "2026-04-15", pct: 4.2, date: "2026-01-15" }] }], asOf);
  t("a group past line can stand without a card price", bare.some((row) => /In 93 past cases since Jan 2026/.test(row.headline) && /was followed by a median/.test(row.headline)));

  const skip = await writePrivate(ROOT, "", "", { summary: {}, gates: [], present: [], detections: [] });
  t("private write skips a blank asOf", skip.pushed === false && /asOf is missing/.test(skip.reason || ""));
  const tmp = await mkdtemp(join(tmpdir(), "scanner-private-"));
  try {
    const open = async () => ({
      dir: tmp,
      remote: true,
      close: async (paths, message) => ({ pushed: true, sha: "abc123", reason: null, paths, message }),
    });
    const payload = {
      summary: { asOf: "2026-10-13", passed: 1 },
      gates: [{
        pattern: "breakout", stage: "confirmed", kind: "single", horizon: 30, dir: "up",
        n: 20, hits: 12, rate: 60, rateLo: 45, rateHi: 74, upRate: 60, baseRate: 40,
        passed: true, weight: 0.6, medianPct: 4, train: { n: 10, rate: 60 }, test: { n: 10, rate: 60 },
        from: "2026-01-01", to: "2026-09-01", examples: [],
      }],
      present: [{ id: "tcgcsv-1", name: "Pikachu", kind: "single", pattern: "breakout", stage: "confirmed", date: "2026-10-13", strength: 70, start: "2026-09-01", end: "2026-10-13", p0: 10, p1: 12, startSrc: "own", endSrc: "own", metrics: {}, grades: {} }],
      detections: [],
    };
    const pushed = await writePrivate(ROOT, "token", "2026-10-13", payload, { open });
    const summary = JSON.parse(await readFile(join(tmp, "scanner/summary.json"), "utf8"));
    const weights = JSON.parse(await readFile(join(tmp, "scanner/weights.json"), "utf8"));
    const day = JSON.parse(await readFile(join(tmp, "scanner/2026-10-13.json"), "utf8"));
    t("private write pushes weights summary and the day file", pushed.pushed === true && pushed.sha === "abc123" && summary.passed === 1 && weights.rows.length === 1 && day.present.length === 1 && day.forward[0].dir === "up");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }

  const forms = ["slow-climb", "breakout", "sharp-spike", "flat-range"].map((pattern, i) => {
    const dir = pattern === "flat-range" ? "flat" : "up";
    const rate = pattern === "flat-range" ? 10 : 80 - i * 10;
    return {
      row: { ...present[0], id: `id-${pattern}`, pattern, stage: "confirmed", dir, p0: 10, p1: dir === "flat" ? 10 : 12, metrics: { pct: dir === "flat" ? 0 : 20 } },
      gate: { ...passed[0], pattern, stage: "confirmed", kind: "single", dir, horizon: 7, rate, n: 30, passed: true },
    };
  });
  const durableBoard = buildScannerReads(forms.map((f) => f.row), forms.map((f) => f.gate), asOf);
  const durableForming = durableBoard.filter((r) => r.readKind === "pattern-forming");
  t("a durable pattern keeps a board slot ahead of a higher raw rate", durableForming.some((r) => r.receipt.pattern === "flat-range") && !durableForming.some((r) => r.receipt.pattern === "sharp-spike"));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("scanner.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
