// The weekly letter's price movers were built from PPT history, which left the
// public repo on 2026-10-10 (licence). The letter must not carry them, and no
// public move may start before the first public TCGCSV day.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIRST_TCGCSV_DAY = "2026-09-25";

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " — " + detail : ""}`); }
  };
  const weekly = JSON.parse(await readFile(join(ROOT, "research/digests/weekly-news.json"), "utf8"));
  const text = JSON.stringify(weekly.priceMovers || {});
  const early = [...text.matchAll(/"fromDate":"(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]).filter((d) => d < FIRST_TCGCSV_DAY);
  t("the weekly letter carries no move from before the first public TCGCSV day", early.length === 0, early.slice(0, 3).join(", "));
  const src = await readFile(join(ROOT, "scripts/fetch-tcg-news.mjs"), "utf8");
  t("the news fetch does not carry old price movers forward", !/weeklyDoc\.priceMovers\s*=\s*priorWeekly\.priceMovers/.test(src));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("weekly-movers.suite.mjs")) process.exit(await run() ? 1 : 0);
