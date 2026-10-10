import { pathToFileURL } from "node:url";
import { buildTrackRecord, scoreRead } from "../lib/track-record.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail += 1; console.log("  FAIL", name); }
};

const read = { id: "r1", sku: "tcgcsv-1", asOf: "2026-10-01", price: 10, direction: "down", headline: "Example is down.", readKind: "mover" };
t("under 7 days is too early", scoreRead(read, { "2026-10-08": 8 }, "2026-10-05").status === "too-early");
t("no later price is not a miss", scoreRead(read, {}, "2026-10-20").status === "no-later-price");
const hit = scoreRead(read, { "2026-10-08": 8, "2026-10-31": 12 }, "2026-11-05");
t("the exact later day scores the direction", hit.marks["7"].sameDirection === true && hit.marks["30"].sameDirection === false);
const early = buildTrackRecord([read], {}, "2026-10-02");
t("a book of one young read has no hit rate", early.tooEarly === 1 && early.scored7 === 0 && early.oldest === "2026-10-01");
const book = buildTrackRecord([
  read,
  { id: "r2", sku: "tcgcsv-2", asOf: "2026-09-01", price: 5, direction: "up", headline: "Other is up.", readKind: "streak" },
], { "tcgcsv-1": { "2026-10-08": 9 }, "tcgcsv-2": {} }, "2026-10-10");
t("every read is kept and only the priced one scores", book.count === 2 && book.scored7 === 1 && book.types.find((row) => row.type === "streak").noLaterPrice === 1);

if (fail) console.log(fail + " failed");
else console.log("track record ok");
// run-tests.mjs imports every *.suite.mjs and counts a missing run() as a
// failure, which stopped the nightly. The checks above run on import; run()
// reports their count. Run directly, a failure still exits non-zero.
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);

