// Drop backfill points that contradict the TCGCSV files. See scripts/lib/backfill-prune.mjs.
// Usage: node scripts/prune-market-backfill.mjs          (writes)
//        node scripts/prune-market-backfill.mjs --check  (exit 1 if anything would be dropped)
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pruneBackfill } from "./lib/backfill-prune.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const t = await pruneBackfill(ROOT, { write: !check });
const busy = t.droppedProducts || t.droppedPoints || t.overlapPoints;
console.log(`${check ? "would drop" : "dropped"}: ${t.droppedProducts} products (${t.droppedPoints} points of a different printing), ${t.overlapPoints} points on days a TCGCSV file already has, in ${t.changedFiles} of ${t.files} files.`);
if (check && busy) process.exit(1);
