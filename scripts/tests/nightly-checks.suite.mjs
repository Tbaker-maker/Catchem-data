import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkHalfPrice } from "../check-half-price.mjs";
import { checkStale } from "../check-stale.mjs";
import { checkCoverage } from "../check-coverage.mjs";
import { writeLearningLog } from "../write-learning-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

function days(start, n, priceAt) {
  const out = [];
  const t0 = Date.parse(`${start}T00:00:00Z`);
  for (let i = 0; i < n; i += 1) {
    out.push([new Date(t0 + i * 86400000).toISOString().slice(0, 10), priceAt(i)]);
  }
  return out;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  for (const name of ["check-half-price.mjs", "check-stale.mjs", "check-coverage.mjs", "write-learning-log.mjs"]) {
    const src = await readFile(join(ROOT, "scripts", name), "utf8");
    t(`${name} does not fetch`, !/\bfetch\s*\(|\bhttps?:\/\/|ebay|net\.connect/i.test(src));
  }

  const root = await mkdtemp(join(tmpdir(), "nightly-"));
  const missing = await checkHalfPrice({ root, date: "2026-01-02" });
  const missingBody = JSON.parse(await readFile(missing.path, "utf8"));
  t("a missing series exits 0 and says source missing", missing.exitCode === 0 && missing.sentence === "Source missing." && missingBody.source === "missing" && missingBody.note === "source missing" && !("halfPriceCount" in missingBody));

  const seriesRoot = await mkdtemp(join(tmpdir(), "nightly-series-"));
  const backfill = join(seriesRoot, "data/history/market-backfill");
  await mkdir(backfill, { recursive: true });
  const half = days("2026-08-01", 24, (i) => (i === 4 ? 4 : 12));
  const even = days("2026-08-01", 16, (i) => (i < 8 ? 5 : 12));
  const flat = days("2026-08-01", 12, () => 10);
  await writeFile(join(backfill, "00.json"), JSON.stringify({
    source: "TCGplayer market",
    note: "fixture",
    series: { "11": half, "22": even, "33": flat },
  }));
  await mkdir(join(seriesRoot, "data/catalog"), { recursive: true });
  await writeFile(join(seriesRoot, "data/catalog/tcgcsv-latest.json"), JSON.stringify({
    asOf: "2026-08-24",
    items: [
      { id: "tcgcsv-11", tcgplayerProductId: 11, kind: "single" },
      { id: "tcgcsv-22", tcgplayerProductId: 22, kind: "single" },
      { id: "tcgcsv-33", tcgplayerProductId: 33, kind: "sealed" },
    ],
  }));
  const found = await checkHalfPrice({ root: seriesRoot, date: "2026-01-02" });
  const foundBody = JSON.parse(await readFile(found.path, "utf8"));
  t("half-price file uses the series day", found.exitCode === 0 && found.path.endsWith("half-price-2026-08-24.json") && foundBody.asOf === "2026-08-24");
  t("one cheap copy and one even split are counted", foundBody.halfPriceCount === 1 && foundBody.halfPriceIds.length === 1 && foundBody.halfPriceIds[0] === "tcgcsv-11" && foundBody.tooEvenCount === 1 && foundBody.tooEvenIds[0] === "tcgcsv-22");
  t("a flat series is not called a drop", !foundBody.halfPriceIds.includes("tcgcsv-33") && !foundBody.tooEvenIds.includes("tcgcsv-33"));
  t("an agreed series keeps the day and does not store a price", foundBody.asOf === "2026-08-24" && foundBody.sourceDays.length === 1 && !("market" in foundBody) && !foundBody.unresolved && foundBody.halfPriceCount === foundBody.halfPriceIds.length);

  const clashRoot = await mkdtemp(join(tmpdir(), "nightly-clash-"));
  await mkdir(join(clashRoot, "data/history/market-backfill"), { recursive: true });
  await mkdir(join(clashRoot, "data/history/tcgcsv-daily"), { recursive: true });
  await mkdir(join(clashRoot, "data/catalog"), { recursive: true });
  await writeFile(join(clashRoot, "data/history/market-backfill/00.json"), JSON.stringify({
    series: { "11": half, "44": half },
  }));
  await writeFile(join(clashRoot, "data/history/tcgcsv-daily/2026-08-05.json"), JSON.stringify({
    prices: [{ id: 11, market: 99 }],
  }));
  await writeFile(join(clashRoot, "data/catalog/tcgcsv-latest.json"), JSON.stringify({
    items: [{ id: "tcgcsv-11", tcgplayerProductId: 11, kind: "single" }],
  }));
  const clash = await checkHalfPrice({ root: clashRoot, date: "2026-10-02" });
  const clashBody = JSON.parse(await readFile(clash.path, "utf8"));
  const row = clashBody.unresolved.find((item) => item.id === "tcgcsv-11");
  const values = row && row.days.flatMap((day) => day.readings.map((reading) => reading.value)).sort((a, b) => a - b);
  t("disagreeing files are both kept and not counted", clash.exitCode === 0 && !clashBody.asOf && clash.path.endsWith("half-price-2026-10-02.json") && clashBody.halfPriceIds.includes("44") && !clashBody.halfPriceIds.includes("tcgcsv-11") && clashBody.tooEvenIds.length === 0 && values && values[0] === 4 && values[1] === 99);
  t("an id that is not in the catalog stays the series key", clashBody.halfPriceIds.includes("44") && !clashBody.halfPriceIds.includes("tcgcsv-44"));

  const dir = await mkdtemp(join(tmpdir(), "nightly-stale-"));
  const catalog = join(dir, "catalog.json");
  const feed = join(dir, "reads.json");
  const coverage = join(dir, "coverage.json");
  await writeFile(catalog, JSON.stringify({
    asOf: "2026-09-27",
    items: [{ kind: "single" }, { kind: "single" }, { kind: "sealed" }],
  }));
  await writeFile(coverage, JSON.stringify({ asOf: "2026-09-27", counts: { single: 2, sealed: 1 } }));
  const before = await readFile(coverage, "utf8");
  await writeFile(feed, JSON.stringify({ asOf: "2026-09-27", reads: [] }));
  const same = await checkStale({ catalog, feed });
  t("matching days exit 0", same.exitCode === 0 && same.sentence === "The feed file asOf 2026-09-27 matches the catalog day 2026-09-27.");
  await writeFile(feed, JSON.stringify({ asOf: "2026-09-29", reads: [] }));
  const newer = await checkStale({ catalog, feed });
  t("a newer feed exits 0", newer.exitCode === 0 && newer.sentence === "The feed file asOf 2026-09-29 is newer than the catalog day 2026-09-27.");
  await writeFile(feed, JSON.stringify({ asOf: "2026-09-26", reads: [] }));
  const older = await checkStale({ catalog, feed });
  t("an older feed exits 1", older.exitCode === 1 && older.sentence === "The feed file asOf 2026-09-26 is older than the catalog day 2026-09-27.");
  await writeFile(catalog, JSON.stringify({ asOf: "2026-09-27T00:00:00.000Z", items: [] }));
  const stamped = await checkStale({ catalog, feed });
  t("a timestamp is not used as a day", stamped.exitCode === 1 && stamped.sentence === "The catalog asOf is not a calendar day.");
  await writeFile(catalog, JSON.stringify({
    asOf: "2026-09-27",
    items: [{ kind: "single" }, { kind: "single" }, { kind: "sealed" }],
  }));

  const coverOk = await checkCoverage({ catalog, coverage });
  t("matching kind counts exit 0", coverOk.exitCode === 0 && coverOk.sentence === "Catalog single 2 and sealed 1 match the coverage file.");
  t("coverage check does not rewrite the file", (await readFile(coverage, "utf8")) === before);
  await writeFile(coverage, JSON.stringify({ counts: { single: 9, sealed: 1 } }));
  const coverBad = await checkCoverage({ catalog, coverage });
  const after = await readFile(coverage, "utf8");
  t("differing kind counts exit 1 and leave the file", coverBad.exitCode === 1 && coverBad.sentence.includes("differ") && after === JSON.stringify({ counts: { single: 9, sealed: 1 } }));

  await writeFile(feed, JSON.stringify({
    asOf: "2026-09-27",
    reads: [
      { kind: "single", name: "Duraludon", headline: "DO NOT COPY THIS HEADLINE", why: "DO NOT COPY WHY", price: 1.56 },
      { kind: "sealed", name: "Elite Trainer Box", headline: "ALSO NOT COPY", price: 40 },
    ],
  }));
  const logPath = join(dir, "notes.jsonl");
  const first = await writeLearningLog({ reads: feed, out: logPath, date: "2026-10-02" });
  const second = await writeLearningLog({ reads: feed, out: logPath, date: "2026-10-02" });
  const lines = (await readFile(logPath, "utf8")).trim().split("\n").map((line) => JSON.parse(line));
  const feedAfter = await readFile(feed, "utf8");
  t("the log appends one fact line", first.exitCode === 0 && second.exitCode === 0 && lines.length === 2 && lines[0].lead === 2 && lines[0].singles === 1 && lines[0].sealed === 1 && lines[0].names[0] === "Duraludon" && lines[0].names[1] === "Elite Trainer Box");
  t("the log does not rewrite copy", !JSON.stringify(lines).includes("DO NOT COPY") && !JSON.stringify(lines).includes("ALSO NOT COPY") && !JSON.stringify(lines).includes("1.56") && feedAfter.includes("DO NOT COPY THIS HEADLINE"));
  const bothPath = join(dir, "both.jsonl");
  const bothFeed = join(dir, "both-reads.json");
  const bothCat = join(dir, "both-catalogue.json");
  await writeFile(bothFeed, JSON.stringify({ count: 10, reads: [{ kind: "single", name: "A" }, { kind: "sealed", name: "B" }] }));
  await writeFile(bothCat, JSON.stringify({ count: 4 }));
  const both = await writeLearningLog({ reads: bothFeed, catalogue: bothCat, out: bothPath, date: "2026-10-02" });
  const bothNote = JSON.parse(await readFile(bothPath, "utf8"));
  t("two disagreeing counts are both kept", both.exitCode === 0 && bothNote.lead === 2 && bothNote.count === 10 && bothNote.catalogueCount === 4 && bothNote.singles === 1 && bothNote.sealed === 1);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("nightly-checks.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("nightly checks ok");
}
