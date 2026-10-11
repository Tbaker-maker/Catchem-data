import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTrackRecord } from "./lib/track-record.mjs";
import { shipPriceMap } from "./lib/second-library.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const today = String(reads.asOf || "").slice(0, 10);
const prices = await shipPriceMap(ROOT, reads.reads || []);
const doc = buildTrackRecord(reads.reads || [], prices.later, today, prices.ship);
const out = join(ROOT, "research/assets/public/track-record.json");
await writeFile(out, JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify({
  asOf: doc.asOf,
  count: doc.count,
  oldest: doc.oldest,
  newest: doc.newest,
  tooEarly: doc.tooEarly,
  noLaterPrice: doc.noLaterPrice,
  scored14: doc.scored14,
  scored28: doc.scored28,
  scored56: doc.scored56,
  types: doc.types?.map((row) => ({ type: row.type, line: row.line, scored14: row.scored14 })),
}, null, 2));
