import { pathToFileURL } from "node:url";
import { buildTrackRecord, scoreRead } from "../lib/track-record.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const read = { id: "r1", sku: "tcgcsv-1", name: "Example", asOf: "2026-10-01", price: 99, direction: "down", headline: "Example is down: $20 → $4.", readKind: "mover" };
const ship = { market: 10, source: "TCGplayer market price" };
t("under 14 days is too early", scoreRead(read, { "2026-10-15": 8 }, "2026-10-10", ship).status === "too-early");
t("no later price is not a miss", scoreRead(read, {}, "2026-11-20", ship).status === "no-later-price");
t("ship price comes from the file, not the headline", scoreRead(read, {}, "2026-11-20", ship).price === 10);
t("a missing file price is not a score", scoreRead(read, { "2026-10-15": 8 }, "2026-12-01", null).status === "no-score" && scoreRead(read, { "2026-10-15": 8 }, "2026-12-01", null).price === null);
const hit = scoreRead(read, { "2026-10-15": 8, "2026-10-29": 12, "2026-11-26": 9 }, "2026-12-01", ship);
t("exact days 14, 28, and 56 score", hit.marks["14"].sameDirection === true && hit.marks["28"].sameDirection === false && hit.marks["56"].sameDirection === true);
t("a missing exact day is not filled", scoreRead(read, { "2026-10-16": 8 }, "2026-12-01", ship).marks["14"].price === null);
const early = buildTrackRecord([read], {}, "2026-10-02", { "tcgcsv-1": { "2026-10-01": ship } });
t("a young read has no percent", early.tooEarly === 1 && early.scored14 === 0 && early.types[0].percent14 == null && early.types[0].line14 === "0 scored so far");
const book = buildTrackRecord([
  read,
  { id: "r2", sku: "tcgcsv-2", name: "Other", asOf: "2026-09-01", price: 1, direction: "up", headline: "Other is up $9.", readKind: "streak" },
], { "tcgcsv-1": { "2026-10-15": 9 } }, "2026-10-20", {
  "tcgcsv-1": { "2026-10-01": ship },
  "tcgcsv-2": { "2026-09-01": { market: 5, source: "TCGplayer market price" } },
});
t("newest row is first", book.rows[0].id === "r1" && book.rows[1].id === "r2");
t("only the priced later day scores", book.scored14 === 1 && book.types.find((row) => row.type === "streak").noLaterPrice === 1);
t("under 20 of a label stays a count", book.types.every((row) => row.percent14 == null && row.line.includes("scored so far")));

if (fail) console.log(fail + " failed");
else console.log("track record ok");
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);
