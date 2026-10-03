// Point the public Updated line at the price file. Does not rebuild cards.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { priceFileStamp, stampCountsText } from "./lib/price-stamp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pricesPath = process.env.PRICE_FILE || join(ROOT, "data/sealed-prices.json");
const countsPath = process.env.COUNTS_FILE || join(ROOT, "research/assets/public/counts.json");

const prices = JSON.parse(await readFile(pricesPath, "utf8"));
const stamp = priceFileStamp(prices);
if (!stamp) {
  console.log("Price file has no updatedAt. Updated line left as it is.");
  process.exit(0);
}
let raw;
try {
  raw = await readFile(countsPath, "utf8");
} catch {
  console.log("No counts file. Updated line left as it is.");
  process.exit(0);
}
const next = stampCountsText(raw, stamp);
if (next == null) {
  console.log("Counts file has no updatedAt field. Updated line left as it is.");
  process.exit(0);
}
if (next === raw) {
  console.log("Updated line already matches the price file.");
  process.exit(0);
}
await writeFile(countsPath, next);
console.log("Updated line set from the price file: " + stamp);
