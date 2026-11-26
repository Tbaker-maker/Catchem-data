// Writes data/tcgcsv-group-dates.json from the public TCGCSV groups list.
// No prices are fetched. On any fetch error the file is left as it was.
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatGroupDates, groupDatesFrom } from "./lib/group-dates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL_GROUPS = "https://tcgcsv.com/tcgplayer/3/groups";

let doc = null;
try {
  const res = await fetch(URL_GROUPS, { headers: { "user-agent": "CatchEm/1.0 (catchemtcg.com)" }, signal: AbortSignal.timeout(30000) });
  if (res.ok) doc = await res.json();
} catch (err) {
  console.error(`group dates: fetch failed, file left as it was: ${String(err.message || err).slice(0, 200)}`);
}
const results = doc && Array.isArray(doc.results) ? doc.results : [];
if (!results.length) {
  console.log("group dates: no groups returned, file left as it was");
} else {
  const dates = groupDatesFrom(results);
  await writeFile(join(ROOT, "data/tcgcsv-group-dates.json"), formatGroupDates(dates));
  console.log(JSON.stringify({ groupDates: { groups: results.length, dated: Object.keys(dates).length, unknown: results.length - Object.keys(dates).length } }));
}
