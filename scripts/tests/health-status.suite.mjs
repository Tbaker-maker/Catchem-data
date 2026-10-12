import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStatus, daysBetween, flagOff, formatPt, freshnessFailures, missingDays, priceBannerLine, STALE_HOURS,
} from "../lib/health-status.mjs";
import { READERS } from "../lib/public-sources.mjs";
import { imageGapReport, losesRealPicture } from "../lib/image-gap.mjs";
import { liteShardId, queryShardIds } from "../lib/public-search-shards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  t("missing days are the dates with no file", JSON.stringify(missingDays(["2026-10-01", "2026-10-03", "2026-10-04"])) === JSON.stringify(["2026-10-02"]));
  t("one day has no gap", missingDays(["2026-10-10"]).length === 0);
  const stamp = "2026-10-10T10:32:00.413Z";
  t("the clock is Pacific Time", formatPt(stamp) === "2026-10-10 03:32 PT");
  const at = Date.parse(stamp);
  t("36 hours is not stale", priceBannerLine(stamp, at + STALE_HOURS * 3600 * 1000) === "");
  t("past 36 hours uses the price date", priceBannerLine(stamp, at + STALE_HOURS * 3600 * 1000 + 1) === "Prices last updated 2026-10-10.");
  t("a missing time does not invent a banner", priceBannerLine("", at) === "");

  const status = buildStatus({
    nowMs: at,
    tcgcsvDays: ["2026-10-01", "2026-10-03"],
    counts: { items: 3, single: 2 },
    sealedUpdatedAt: stamp,
  });
  t("a count that was not in the file stays off", status.counts.items === 3 && status.counts.sealed == null);
  t("a missing reads file is not marked present", status.steps.find((row) => row.name === "Reads").result === "not in the files");
  t("the gap list is the missing date", JSON.stringify(status.missingDays) === JSON.stringify(["2026-10-02"]));

  t("three days behind fails", freshnessFailures([{ file: "reads.json", live: true, dateRequired: true, asOf: "2026-10-07" }], "2026-10-10").length === 1);
  t("two days behind does not fail", freshnessFailures([{ file: "reads.json", live: true, dateRequired: true, asOf: "2026-10-08" }], "2026-10-10").length === 0);
  t("a file with no date fails when a date is required", freshnessFailures([{ file: "reads.json", live: true, dateRequired: true, asOf: "" }], "2026-10-10")[0].includes("no date"));
  t("an undated reference file is not a failure", freshnessFailures([{ file: "redirects.json", live: false, asOf: "" }], "2026-10-10").length === 0);
  t("day gap", daysBetween("2026-10-08", "2026-10-10") === 2);

  const images = { "base1-1": "/img/base1/1", "tcgcsv-9": "/cards/pattern/tcgcsv-9.jpg" };
  t("catalogue id does not lose its picture", losesRealPicture(["base1-1", "Alakazam", "", "", "", "single"], images).loses === false);
  t("tcgcsv id with no catalogue loses the picture when the flag is off", losesRealPicture(["tcgcsv-42", "Mystery Booster Box", "", "", "", "sealed"], images).loses === true);
  t("a row with no picture is not counted as a loss", losesRealPicture(["nope", "Tin", "", "", "", "sealed"], {}).loses === false);
  const report = imageGapReport([
    ["base1-1", "Alakazam", "", "", "", "single"],
    ["tcgcsv-42", "Mystery Elite Trainer Box", "", "", "", "sealed"],
    ["tcgcsv-7", "Loose Case", "", "", "", "sealed"],
    ["nope", "Plain", "", "", "", "single"],
  ], images);
  t("the loss count is by type", report.lose === 2 && report.byType.find((row) => row.type === "ETB").lose === 1 && report.byType.find((row) => row.type === "Case").lose === 1);

  t("a name lands in one shard", liteShardId(["tcgcsv-1", "Aegislash EX", "", "", "", "single"]) === "single-ae");
  t("a short query loads no shard", queryShardIds("m").length === 0);
  t("two letters load every kind", JSON.stringify(queryShardIds("Mo")) === JSON.stringify(["sealed-mo", "single-mo", "slab-mo"]));

  const counts = JSON.parse(await readFile(join(ROOT, "research/assets/public/counts.json"), "utf8"));
  const nightly = String(counts.asOf || "");
  const flagsDoc = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8"));
  const off = { "set.valueReads": { value: false } };
  const on = { "set.valueReads": { value: true } };
  const old = [{ file: "feed/set-value.json", flag: "set.valueReads", live: true, dateRequired: true, asOf: "2026-10-09" }];
  t("a disabled-flag file 3 days behind does not fail", freshnessFailures(old, "2026-10-12", undefined, off).length === 0);
  t("the same file fails when its flag is on", freshnessFailures(old, "2026-10-12", undefined, on).length === 1);
  t("a flag missing from flags.json counts as on", freshnessFailures(old, "2026-10-12", undefined, {}).length === 1);
  t("a live file with no flag still fails at 3 days", freshnessFailures([{ file: "reads.json", live: true, dateRequired: true, asOf: "2026-10-09" }], "2026-10-12", undefined, off).length === 1);
  t("a live file 2 days behind still passes", freshnessFailures([{ file: "reads.json", live: true, dateRequired: true, asOf: "2026-10-10" }], "2026-10-12", undefined, off).length === 0);
  for (const row of READERS.filter((r) => r.flag)) {
    t(`${row.flag} exists in data/flags.json`, Boolean(flagsDoc.flags[row.flag]));
  }
  const live = [];
  for (const row of READERS) {
    if (!row.live || !row.dateRequired || row.file.endsWith("/")) continue;
    if (flagOff(row, flagsDoc.flags)) continue;
    let doc = null;
    try { doc = JSON.parse(await readFile(join(ROOT, row.file), "utf8")); } catch { doc = null; }
    const asOf = doc && (doc.asOf || doc.updatedAt || doc.generatedAt || doc.finishedAt || doc.date) || "";
    live.push({ file: row.file, live: true, dateRequired: true, asOf });
  }
  t("a file one day ahead of counts.json (written earlier in the same run) is not a failure",
    freshnessFailures([{ file: "x.json", live: true, dateRequired: true, asOf: "2026-10-11" }], "2026-10-10").length === 0);
  t("a file two days ahead of counts.json is a failure",
    freshnessFailures([{ file: "x.json", live: true, dateRequired: true, asOf: "2026-10-12" }], "2026-10-10").length === 1);
  const failures = freshnessFailures(live, nightly);
  t("reader files are within 2 days of the nightly date on counts.json", failures.length === 0, );
  if (failures.length) console.error(failures.join("\n"));
  const flags = JSON.parse(await readFile(join(ROOT, "data/flags.json"), "utf8"));
  t("images.tcgplayer defaults on", flags.flags["images.tcgplayer"].value === true);
  t("the library switch is untouched", flags.flags["reads.library"].value === false);

  return fail;
}
