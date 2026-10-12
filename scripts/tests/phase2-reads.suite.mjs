import { readFile } from "node:fs/promises";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReadLibrary, writeReadLibrary } from "../lib/read-library.mjs";
import { runRegistry } from "../lib/detectors/registry.mjs";
import { TAKE_CODES } from "../lib/takes.mjs";
import { sealedVsChase } from "../lib/detectors/sealed-vs-chase.mjs";
import { groupLag } from "../lib/detectors/group-lag.mjs";
import { setHeat } from "../lib/detectors/set-heat.mjs";
import { COMBINED_ART_PARENTS, listingTrend } from "../lib/detectors/listing-trend.mjs";
import { attachRotation } from "../lib/detectors/rotation-note.mjs";
import { firstWeek } from "../lib/detectors/first-week.mjs";
import { sevenNightGaps } from "../lib/detectors/coverage.mjs";
import { shuffleDay } from "../lib/detectors/browse.mjs";
import { learningNight } from "../lib/detectors/score-flag.mjs";
import { clearSeriesCache, loadSeriesOnce } from "../lib/series-cache.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
const times = [];

function t(name, ok, detail = "") {
  if (ok) return;
  failed += 1;
  console.log(`FAIL ${name}${detail ? `: ${detail}` : ""}`);
}

function codesOk(row) {
  return !row || row.take == null || TAKE_CODES.includes(row.take);
}

const pair = {
  set: "Obsidian Flames",
  sealed: { from: 10, to: 12, start: "2026-10-04", end: "2026-10-11" },
  chase: { from: 10, to: 10.2, start: "2026-10-04", end: "2026-10-11" },
};

export async function run() {
  const hit = sealedVsChase(pair);
  t("sealed vs chase publishes the side that cleared", hit && hit.headline.startsWith("$12") && hit.receipt.moved === "sealed" && hit.receipt.sealedFrom === 10 && hit.receipt.chaseTo === 10.2);
  t("sealed vs chase take is one of the five or none", codesOk(hit));
  t("both sides clearing publishes nothing", sealedVsChase({
    set: "Obsidian Flames",
    sealed: { from: 10, to: 12, start: "2026-10-04", end: "2026-10-11" },
    chase: { from: 4, to: 5, start: "2026-10-04", end: "2026-10-11" },
  }) == null);
  t("a 6-day pair publishes nothing", sealedVsChase({
    set: "Obsidian Flames",
    sealed: { from: 10, to: 12, start: "2026-10-05", end: "2026-10-11" },
    chase: { from: 10, to: 10.2, start: "2026-10-05", end: "2026-10-11" },
  }) == null);
  t("a missing price publishes nothing", sealedVsChase({ set: "X", sealed: { from: 10, to: 12, start: "2026-10-04", end: "2026-10-11" }, chase: { start: "2026-10-04", end: "2026-10-11" } }) == null);

  const members = [];
  for (let i = 0; i < 5; i += 1) members.push({ id: `up-${i}`, era: "Sword & Shield", kind: "V", from: 10, to: 12 });
  for (let i = 0; i < 9; i += 1) members.push({ id: `flat-${i}`, era: "Sword & Shield", kind: "V", from: 10, to: 10.1 });
  members.push({ id: "other-kind", era: "Sword & Shield", kind: "VMAX", from: 10, to: 12 });
  const lag = groupLag(members, { era: "Sword & Shield", kind: "V", start: "2026-10-04", end: "2026-10-11" });
  t("group lag needs 5 ups", groupLag(members.slice(1), { era: "Sword & Shield", kind: "V", start: "2026-10-04", end: "2026-10-11" }) == null);
  t("group lag names at most 8 flats", lag && lag.receipt.up.length === 5 && lag.receipt.flat.length === 8 && lag.headline.startsWith("$"));
  t("group lag ignores a different kind", lag && lag.receipt.up.every((row) => row.id.startsWith("up-")));
  t("group lag take is one of the five or none", codesOk(lag));
  t("an unknown kind publishes nothing", groupLag(members, { era: "Sword & Shield", kind: "ex", start: "2026-10-04", end: "2026-10-11" }) == null);

  const cards = [];
  for (let i = 0; i < 5; i += 1) cards.push({ id: `m-${i}`, from: 10, to: 12 });
  cards.push({ id: "quiet", from: 10, to: 10.1 });
  const heat = setHeat(cards, { set: "Obsidian Flames", priced: 6, start: "2026-10-04", end: "2026-10-11" });
  t("set heat sentence", heat && heat.headline === "5 of 6 priced cards in Obsidian Flames moved at least 8% and at least $1 from Oct 4 to Oct 11.");
  t("set heat under 5 publishes nothing", setHeat(cards.slice(1), { set: "Obsidian Flames", priced: 5, start: "2026-10-04", end: "2026-10-11" }) == null);
  t("set heat receipt has each counted card", heat && heat.receipt.cards.length === 5 && heat.take == null);

  const listing = listingTrend({
    id: "sv9-etb",
    start: { date: "2026-10-04", filteredTotal: 40 },
    end: { date: "2026-10-11", filteredTotal: 55 },
    price: { from: 20, to: 22 },
  });
  t("listing sentence", listing && listing.headline.startsWith("$22") && listing.headline.includes("eBay listings 40 to 55 (Oct 4 to Oct 11)."));
  t("listing under the minimum publishes nothing", listingTrend({
    id: "sv9-etb",
    start: { date: "2026-10-04", filteredTotal: 40 },
    end: { date: "2026-10-11", filteredTotal: 50 },
  }) == null);
  t("17 combined-art parents", COMBINED_ART_PARENTS.size === 17);
  t("a combined-art parent publishes nothing", [...COMBINED_ART_PARENTS].every((id) => listingTrend({
    id,
    start: { date: "2026-10-04", filteredTotal: 40 },
    end: { date: "2026-10-11", filteredTotal: 55 },
  }) == null));
  t("listing take is one of the five or none", codesOk(listing));

  const status = { sets: [{ name: "Brilliant Stars", mark: "F" }, { name: "Stellar Crown", mark: "H" }] };
  const rotated = attachRotation({ headline: "$12 from $10.", set: "Brilliant Stars", qualified: true }, status);
  t("rotation line only on F or G", rotated && rotated.rotation === "Marked F on the rotation list.");
  t("a mark that is not F or G adds no line", !attachRotation({ headline: "$12 from $10.", set: "Stellar Crown", qualified: true }, status).rotation);
  t("an unqualified read gets no rotation line", attachRotation({ set: "Brilliant Stars", qualified: false }, status) == null);
  t("a missing rotation file adds nothing", attachRotation({ headline: "$12 from $10.", set: "Brilliant Stars" }, null).rotation == null);

  const week = firstWeek(
    { id: "me2", name: "Phantasmal Flames", date: "2026-10-04", verified: true },
    [{ date: "2026-10-04", market: 5 }, { date: "2026-10-05", market: 6 }],
    new Set(["2026-10-04", "2026-10-05"]),
  );
  t("first week uses the first two prices", week && week.headline.startsWith("$6") && week.receipt.firstPrice === 5 && week.receipt.secondPrice === 6);
  t("an unverified release publishes nothing", firstWeek({ name: "Phantasmal Flames", date: "2026-10-04", verified: false }, [{ date: "2026-10-04", market: 5 }, { date: "2026-10-05", market: 6 }]) == null);
  t("one daily price publishes nothing", firstWeek({ name: "Phantasmal Flames", date: "2026-10-04", verified: true }, [{ date: "2026-10-04", market: 5 }]) == null);
  t("a missing day file publishes nothing", firstWeek(
    { name: "Phantasmal Flames", date: "2026-10-04", verified: true },
    [{ date: "2026-10-04", market: 5 }, { date: "2026-10-05", market: 6 }],
    new Set(["2026-10-04"]),
  ) == null);

  const rows = [{ headline: "a" }, { headline: "b" }, { headline: "c" }];
  t("browse shuffle is stable for a day", JSON.stringify(shuffleDay(rows, "2026-10-11")) === JSON.stringify(shuffleDay(rows, "2026-10-11")));
  t("browse drops a row with no headline", shuffleDay([{ headline: "" }, { headline: "a" }], "2026-10-11").length === 1);

  const minimums = { dollars: 1, pct: 3 };
  const report = learningNight([{ id: "set-heat", produced: 10, boarded: 2, scored: 20, hits: 7, scored14: 8, scored28: 7, scored56: 5, averageLaterMove: -1.2, minimums }]);
  t("under 40% after 20 scores is flagged", report.public === false && report.rows[0].review === true && report.rows[0].hitRate === 35);
  t("learning does not loosen a minimum", minimums.dollars === 1 && minimums.pct === 3);
  t("19 scores stay unflagged", learningNight([{ id: "x", scored: 19, hits: 0, minimums }]).rows[0].review === false);

  const gaps = sevenNightGaps({
    nights: [
      { skus: ["tcgcsv-1"], eras: ["Sword & Shield"], sealed: ["sv9-etb"] },
      { skus: [], eras: [], sealed: [] },
    ],
    sets: [
      { slug: "base-set", name: "Base Set", skus: ["tcgcsv-9"], prices: true },
      { slug: "jungle", name: "Jungle", skus: ["tcgcsv-1"], prices: true },
    ],
    eras: [{ name: "Sword & Shield", kinds: true }, { name: "Scarlet & Violet", kinds: true }],
    sealed: [
      { id: "sv9-etb", name: "Surging Sparks ETB", prices: true, chase: true },
      { id: "sv8-etb", name: "Surging box", prices: true, listings: true },
    ],
  });
  t("gap report lists only the zero-read set", gaps.sets.length === 1 && gaps.sets[0].slug === "base-set" && gaps.sets[0].could === "set-heat");
  t("gap report keeps an era that had a read off the list", gaps.eras.length === 1 && gaps.eras[0].name === "Scarlet & Violet");
  t("gap report keeps a sealed product that had a read off the list", gaps.sealed.length === 1 && gaps.sealed[0].id === "sv8-etb");

  const dir = await mkdtemp(join(tmpdir(), "series-"));
  await mkdir(join(dir, "days"), { recursive: true });
  const blob = JSON.stringify({ prices: Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, market: 1.25 })) });
  await writeFile(join(dir, "days", "2026-10-11.json"), blob);
  clearSeriesCache();
  const cold = loadSeriesOnce(dir, () => JSON.parse(blob));
  const warm = loadSeriesOnce(dir, () => { throw new Error("read again"); });
  times.push({ coldMs: cold.ms, warmMs: warm.ms, cached: warm.cached });
  t("series cache does not read twice", warm.cached === true && warm.series.prices.length === 2000);
  console.log(JSON.stringify({ seriesCache: times[0] }));

  const extraPath = join(ROOT, "research/assets/public/feed/extra-reads.json");
  const libPath = join(ROOT, "research/assets/public/feed/read-library.json");
  const cataloguePath = join(ROOT, "research/assets/public/feed/catalogue.json");
  const extra = JSON.parse(await readFile(extraPath, "utf8"));
  const committed = JSON.parse(await readFile(libPath, "utf8"));
  const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
  const ctx = { catalogue, extra, series: new Map(), dailyFiles: null, sealedPairs: [pair] };
  const direct = buildReadLibrary({ ...ctx, library: false, pptPublic: false, volumeReads: false });
  const via = runRegistry(ctx, { switchOn: false });
  t("registry matches buildReadLibrary", JSON.stringify(direct) === JSON.stringify(via.lib));
  const committedIds = new Set((committed.board || []).map((row) => row.id));
  t("extra rows are on the committed board", (via.lib.board || []).every((row) => committedIds.has(row.id)));
  t("new detectors stay off the board", via.browse.length === 0 && via.byId["sealed-vs-chase"].length === 0);
  const opened = runRegistry(ctx, { switchOn: true });
  t("switch on leaves the same library", JSON.stringify(opened.lib) === JSON.stringify(via.lib));
  t("switch on can browse a qualified read without padding the board", opened.browse.length === 1 && opened.lib.board.length === via.lib.board.length);

  const stampDir = await mkdtemp(join(tmpdir(), "stamp-"));
  const stampFiles = new Set();
  const stampCtx = { catalogue, extra, series: new Map(), dailyFiles: stampFiles };
  const stampReg = runRegistry(stampCtx, { switchOn: false });
  const stamped = await writeReadLibrary({
    root: stampDir,
    catalogue,
    extra,
    series: new Map(),
    dailyFiles: stampFiles,
    library: false,
    pptPublic: false,
    volumeReads: false,
  });
  const stampReads = JSON.parse(await readFile(join(stampDir, "research/assets/public/reads.json"), "utf8"));
  const stampLib = JSON.parse(await readFile(join(stampDir, "research/assets/public/feed/read-library.json"), "utf8"));
  t("picture stamp does not change the library", JSON.stringify(stamped) === JSON.stringify(stampReg.lib) && JSON.stringify(stampLib) === JSON.stringify(stampReg.lib));
  t("reads.json still gets a picture", (stampReads.reads || []).length > 0 && (stampReads.reads || []).every((row) => typeof row.image === "string" && row.image !== ""));
  t("the library file keeps the picture it was built with", JSON.stringify(stampLib.board) === JSON.stringify(stampReg.lib.board));

  return failed;
}

if (process.argv[1] && process.argv[1].endsWith("phase2-reads.suite.mjs")) {
  const fail = await run();
  if (fail) process.exit(1);
}
