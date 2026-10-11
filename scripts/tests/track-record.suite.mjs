import { pathToFileURL } from "node:url";
import { learningReport } from "../lib/detectors/learning.mjs";
import { buildTrackRecord, percentFor, scoreRead } from "../lib/track-record.mjs";

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
t("public is false", book.public === false);

const up = scoreRead({ id: "u", sku: "tcgcsv-3", name: "Up", asOf: "2026-09-01", take: "up", readKind: "mover" }, { "2026-09-15": 12, "2026-09-29": 9 }, "2026-11-01", ship);
t("up hits when the later price is higher", up.status === "scored" && up.take === "up" && up.marks["14"].sameDirection === true && up.marks["28"].sameDirection === false);
const dip = scoreRead({ id: "d", sku: "tcgcsv-4", name: "Dip", asOf: "2026-09-01", take: "dip" }, { "2026-09-15": 8 }, "2026-11-01", ship);
const stretched = scoreRead({ id: "s", sku: "tcgcsv-5", name: "Stretched", asOf: "2026-09-01", take: "stretched" }, { "2026-09-15": 8 }, "2026-11-01", ship);
const avoid = scoreRead({ id: "a", sku: "tcgcsv-6", name: "Avoid", asOf: "2026-09-01", take: "avoid" }, { "2026-09-15": 8 }, "2026-11-01", ship);
const avoidMiss = scoreRead({ id: "am", sku: "tcgcsv-6", name: "Avoid", asOf: "2026-09-01", take: "avoid" }, { "2026-09-15": 11 }, "2026-11-01", ship);
t("dip, stretched, and avoid hit when the later price is lower", dip.marks["14"].sameDirection === true && stretched.marks["14"].sameDirection === true && avoid.marks["14"].sameDirection === true && avoidMiss.marks["14"].sameDirection === false);
const watch = scoreRead({ id: "w", sku: "tcgcsv-7", name: "Flat", asOf: "2026-09-01", take: "watch", direction: "up" }, { "2026-09-15": 12, "2026-09-29": 12, "2026-10-27": 12 }, "2026-11-01", ship);
t("watch is not scored", watch.status === "no-score" && watch.take === "watch" && watch.marks == null);
t("a missing later price is not a score", scoreRead({ id: "m", sku: "tcgcsv-8", name: "Missing", asOf: "2026-09-01", take: "up" }, {}, "2026-11-01", ship).status === "no-later-price");
const labeled = scoreRead({ id: "l", sku: "tcgcsv-4", name: "Label", asOf: "2026-09-01", take: "Looks like a buy", direction: "up" }, { "2026-09-15": 12 }, "2026-11-01", ship);
t("a label word is not stored", labeled.take === "" && !JSON.stringify(labeled).includes("Looks like a buy") && !JSON.stringify(labeled).includes("Wait for a dip"));

const many = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, sku: "tcgcsv-20", name: "Batch", asOf: "2026-08-01", take: "up", readKind: "mover" }));
const batch = buildTrackRecord(many, { "tcgcsv-20": { "2026-08-15": 11 } }, "2026-10-01", { "tcgcsv-20": { "2026-08-01": ship } });
t("twenty scored reads still have no public percent", batch.public === false && batch.types[0].scored14 === 20 && batch.types[0].hit14 === 20 && batch.types[0].percent14 == null && !Object.hasOwn(batch.types[0], "percent14"));
t("a percent still waits for 20, and stays hidden while public is false", percentFor(20, 19, true) === null && percentFor(20, 20, true) === 100 && percentFor(20, 20, false) === null);
const shown = learningReport(batch);
t("the public track record hides the hit rate", shown.public === false && shown.detectors[0].hitRate14 === null && !JSON.stringify(batch).includes("Looks like a buy"));

if (fail) console.log(fail + " failed");
else console.log("track record ok");
export async function run() { return fail; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && fail) process.exit(1);
