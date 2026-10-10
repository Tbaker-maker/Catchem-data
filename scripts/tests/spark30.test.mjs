import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { packSpark } from "../lib/spark30.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name); }
};

export async function runSparkTests() {
  fail = 0;
  const asOf = "2026-10-09";
  t("one point is not a spark", packSpark([["2026-10-09", 4]], asOf) === "");
  t("a missing day is left out", packSpark([["2026-10-07", 4], ["2026-10-09", 5]], asOf) === "0:5,2:4");
  t("a day outside the 30 is left out", packSpark([["2026-09-01", 9], ["2026-10-08", 4], ["2026-10-09", 5]], asOf) === "0:5,1:4");
  t("a blank price is left out", packSpark([["2026-10-08", 0], ["2026-10-07", 4], ["2026-10-09", 5]], asOf) === "0:5,2:4");

  const counts = JSON.parse(await readFile(join(ROOT, "research/assets/public/counts.json"), "utf8"));
  const bucket = JSON.parse(await readFile(join(ROOT, "research/assets/public/buckets/00.json"), "utf8"));
  const sparks = JSON.parse(await readFile(join(ROOT, "research/assets/public/sparks/00.json"), "utf8"));
  t("spark file uses the catalog day", sparks.asOf === counts.asOf);
  const sample = bucket.find((card) => card && packSpark(card.hist, counts.asOf));
  t("a spark matches that product id", !!sample && sparks.rows[sample.id] === packSpark(sample.hist, counts.asOf));
  const values = Object.values(sparks.rows);
  t("spark values are packed prices", values.length > 0 && values.every((v) => /^\d+:\d+(\.\d+)?(,\d+:\d+(\.\d+)?)+$/.test(v)));
  return fail;
}
