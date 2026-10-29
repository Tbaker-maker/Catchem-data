// Proof engine rules. Limits in this test are fixtures, not the live cutoff file.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertLimits, joinSeries, isHit, summarize, publicReceipts, curveFor,
  placeOnCurve, whyLine, runwayDays, publicTextOk, limitsOk,
} from "../lib/proof-engine.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  let missing = false;
  try { assertLimits({}); } catch (err) { missing = err.message === "proof limits not loaded"; }
  t("empty limits are refused", missing);
  const fixture = JSON.parse(readFileSync(join(ROOT, "scripts/tests/fixtures/proof-limits.json"), "utf8"));
  t("fixture limits load", limitsOk(fixture));

  const refused = spawnSync(process.execPath, [join(ROOT, "scripts/proof-engine.mjs")], { encoding: "utf8" });
  t("runner exits when no limits file is passed", refused.status === 1 && /proof limits not loaded/.test(refused.stderr));

  const src = [
    readFileSync(join(ROOT, "scripts/lib/proof-engine.mjs"), "utf8"),
    readFileSync(join(ROOT, "scripts/proof-engine.mjs"), "utf8"),
  ].join("\n");
  t("script source has no min sample cutoff", !/minSample\s*[:=]\s*\d+/.test(src));
  t("script source has no horizon cutoff list", !/\[\s*7\s*,\s*30\s*,\s*90\s*\]/.test(src));
  t("script source has no held out fraction cutoff", !/heldOutFraction\s*[:=]\s*0\.\d+/.test(src));
  t("script source has no listings jump cutoff", !/listingsJumpPct\s*[:=]\s*\d+/.test(src));

  const joined = joinSeries(
    [{ date: "2026-10-01", price: 10, source: "own" }],
    [["2026-09-01", 8], ["2026-10-01", 99], ["2026-10-02", 50], ["2026-09-02", 0], ["2026-09-03", null]],
  );
  const byDate = new Map(joined.points.map((p) => [p.date, p]));
  t("shared day keeps our price", byDate.get("2026-10-01")?.price === 10 && byDate.get("2026-10-01")?.source === "own");
  t("archive after our first day is not copied", !byDate.has("2026-10-02"));
  t("archive before our first day is kept", byDate.get("2026-09-01")?.price === 8 && byDate.get("2026-09-01")?.source === "archived-market");
  t("a missing or zero archive price is not stored as 0", !byDate.has("2026-09-02") && !byDate.has("2026-09-03"));
  const onlyArchive = joinSeries([], [["2026-01-01", 4]]);
  t("archive is kept when we have no own price", onlyArchive.points.length === 1 && onlyArchive.points[0].source === "archived-market");

  t("a small up inside the normal swing is not a hit", isHit("up", 1, 5, 0) === false);
  t("an up that loses to the sealed market is not a hit", isHit("up", 8, 5, 10) === false);
  t("an up past the swing and the market is a hit", isHit("up", 12, 5, 3) === true);
  t("a flat call hits when the move stays inside the swing", isHit("flat", 2, 5, 0) === true);

  const quiet = { hit: null, productPct: null, marketPct: null };
  const up = (date) => ({
    type: "move-up", direction: "up", date, swing: 1,
    marks: { 7: { hit: true, productPct: 10, marketPct: 0 } },
  });
  const down = (date) => ({
    type: "move-down", direction: "down", date, swing: 1,
    marks: { 7: { hit: true, productPct: -10, marketPct: 0 } },
  });
  const scored = [
    { type: "move-up", direction: "up", date: "2026-01-01", swing: 1, marks: { 7: quiet } },
    { type: "move-up", direction: "up", date: "2026-02-01", swing: 1, marks: { 7: quiet } },
    up("2026-03-01"),
    up("2026-04-01"),
    down("2026-03-01"),
    down("2026-04-01"),
    { type: "chip-up", direction: "up", date: "2026-03-01", swing: 1, marks: { 7: { hit: true, productPct: 10, marketPct: 0 } } },
    { type: "chip-down", direction: "down", date: "2026-03-01", swing: 1, marks: { 7: { hit: true, productPct: -10, marketPct: 0 } } },
  ];
  const summary = summarize(scored, { heldOutFraction: 0.5, minSample: 2, horizons: [7] });
  const moveUp = summary.types.find((row) => row.type === "move-up");
  const chipUp = summary.types.find((row) => row.type === "chip-up");
  t("held out lift uses the family base rate", moveUp.horizons["7"].hitRate === 100 && moveUp.horizons["7"].baseRate === 50 && moveUp.horizons["7"].lift === 50);
  t("a type with lift and enough rows is public", moveUp.public === true);
  t("a type under the sample floor stays private", chipUp.public === false && chipUp.horizons["7"].n === 1);
  const faded = summarize([
    { type: "move-up", direction: "up", date: "2026-01-01", swing: 1, marks: { 7: quiet, 30: quiet } },
    { type: "move-up", direction: "up", date: "2026-02-01", swing: 1, marks: { 7: quiet, 30: quiet } },
    { type: "move-up", direction: "up", date: "2026-03-01", swing: 1, marks: { 7: { hit: true, productPct: 10, marketPct: 0 }, 30: { hit: false, productPct: -10, marketPct: 0 } } },
    { type: "move-up", direction: "up", date: "2026-04-01", swing: 1, marks: { 7: { hit: true, productPct: 10, marketPct: 0 }, 30: { hit: false, productPct: -10, marketPct: 0 } } },
    { type: "move-down", direction: "down", date: "2026-03-01", swing: 1, marks: { 7: { hit: true, productPct: -10, marketPct: 0 }, 30: { hit: true, productPct: -10, marketPct: 0 } } },
    { type: "move-down", direction: "down", date: "2026-04-01", swing: 1, marks: { 7: { hit: true, productPct: -10, marketPct: 0 }, 30: { hit: true, productPct: -10, marketPct: 0 } } },
  ], { heldOutFraction: 0.5, minSample: 2, horizons: [7, 30] });
  t("a later window that misses the base rate keeps the type private", faded.types.find((row) => row.type === "move-up").public === false);
  const lines = publicReceipts(summary);
  t("public line is count of count since a date", lines.lines.some((row) => row.line === "2 of 2 called right since Mar 1 2026"));
  t("public lines do not carry scores", !JSON.stringify(lines).includes("lift") && !JSON.stringify(lines).includes("hitRate"));
  const none = publicReceipts(summarize(scored, { heldOutFraction: 0.5, minSample: 100, horizons: [7] }));
  t("nothing public gets the empty note", none.note === "No signal type is public yet." && none.lines.length === 0);

  const curve = curveFor([
    { release: "2026-09-16", retail: null, points: [{ date: "2026-08-05", price: 500 }, { date: "2026-09-16", price: 260 }] },
    { release: "2026-09-16", retail: 0, points: [{ date: "2026-08-05", price: 480 }, { date: "2026-09-16", price: 250 }] },
  ], { curveWeeksBefore: 8, curveWeeksAfter: 12, bandLow: 0.25, bandHigh: 0.75 });
  const early = curve.find((row) => row.week < 0);
  const usual = curve.find((row) => row.week === 0);
  t("missing retail stays null on the curve", early && early.multipleMedian == null && early.multipleN === 0);
  t("weeks before release are flagged and not the usual curve", early.early === true && usual.early === false);
  t("a price before release is not placed on the usual curve", placeOnCurve(500, early) === "before release");

  t("no dated cause uses the exact empty line", whyLine([]) === "no clear cause on file");
  const short = runwayDays([{ date: "2026-10-01", count: 10 }, { date: "2026-10-02", count: 8 }], 14);
  t("runway stays empty when the listing nights are short", short.days == null);
  const rising = [];
  for (let i = 0; i < 14; i += 1) {
    const day = String(i + 1).padStart(2, "0");
    rising.push({ date: `2026-10-${day}`, count: 100 + i });
  }
  t("runway stays empty when listings counted are not falling", runwayDays(rising, 14).days == null);

  t("a clean receipt line passes", publicTextOk("2 of 2 called right since Mar 1 2026"));
  t("sold, NM, Collectr, supply, and an em dash fail", !publicTextOk("units sold") && !publicTextOk("NM box") && !publicTextOk("See Collectr") && !publicTextOk("days of supply") && !publicTextOk("up \u2014 down"));

  return fail;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().then((n) => process.exit(n === 0 ? 0 : 1));
}
