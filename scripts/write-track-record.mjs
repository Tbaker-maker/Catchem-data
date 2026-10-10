import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTrackRecord } from "./lib/track-record.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
const today = String(reads.asOf || "").slice(0, 10);
const doc = buildTrackRecord(reads.reads || [], {}, today);
const out = join(ROOT, "research/assets/public/track-record.json");
await writeFile(out, JSON.stringify(doc, null, 2) + "\n");
console.log(JSON.stringify({
  asOf: doc.asOf,
  count: doc.count,
  oldest: doc.oldest,
  tooEarly: doc.tooEarly,
  noLaterPrice: doc.noLaterPrice,
  scored7: doc.scored7,
  scored30: doc.scored30,
  types: doc.types,
}, null, 2));
