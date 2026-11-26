// Set release dates from TCGCSV groups. A file build stamp is not a release date.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGroupDates, groupDatesFrom, releaseDayOf } from "../lib/group-dates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("a midnight publishedOn is a release day", releaseDayOf("2025-09-26T00:00:00") === "2025-09-26");
  t("a file build stamp is not a release day", releaseDayOf("2026-11-25T20:00:07.3733511Z") === null);
  const dates = groupDatesFrom([
    { groupId: 24380, publishedOn: "2025-09-26T00:00:00" },
    { groupId: 1414, publishedOn: "2026-11-25T20:00:07.3733511Z" },
  ]);
  t("a group with only a build stamp has no release date", dates["24380"] === "2025-09-26" && !("1414" in dates));
  t("the file layout stays one line", formatGroupDates({ 1: "2025-01-01", 2: "2025-02-02" }) === '{"1": "2025-01-01", "2": "2025-02-02"}');

  const file = JSON.parse(await readFile(join(ROOT, "data/tcgcsv-group-dates.json"), "utf8"));
  const byDay = new Map();
  for (const day of Object.values(file)) byDay.set(day, (byDay.get(day) || 0) + 1);
  const crowded = [...byDay].filter(([, n]) => n >= 10);
  t("no single day is the release date of 10 or more groups", crowded.length === 0);
  return fail;
}
