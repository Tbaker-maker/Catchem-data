import { readFile } from "node:fs/promises";
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
  coveredInWeek, gradeDetection, replayItems, rotationMembership, splitScan,
} from "../lib/scanner/engine.mjs";
import { buildScannerReads, scannerCopyOk } from "../lib/scanner/reads.mjs";

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

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("scanner.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
