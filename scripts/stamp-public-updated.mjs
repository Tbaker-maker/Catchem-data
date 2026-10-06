// Point the public Updated line at the price file. Does not rebuild cards.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { newestCommittedDay, priceFileStamp, stampCountsText } from "./lib/price-stamp.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pricesPath = process.env.PRICE_FILE || join(ROOT, "data/sealed-prices.json");
const countsPath = process.env.COUNTS_FILE || join(ROOT, "research/assets/public/counts.json");
const cataloguePath = process.env.CATALOGUE_FILE || join(ROOT, "research/assets/public/feed/catalogue.json");
const catalogPath = process.env.CATALOG_FILE || join(ROOT, "data/catalog/tcgcsv-latest.json");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const prices = await readJson(pricesPath);
const catalogue = await readJson(cataloguePath);
const catalog = await readJson(catalogPath);
const stamp = priceFileStamp(prices);
const day = newestCommittedDay(prices, catalogue, catalog);
if (!stamp && !day) {
  console.log("No committed price or catalogue day. Updated line left as it is.");
  process.exit(0);
}
let raw;
try {
  raw = await readFile(countsPath, "utf8");
} catch {
  console.log("No counts file. Updated line left as it is.");
  process.exit(0);
}
const next = stampCountsText(raw, stamp, day);
if (next == null) {
  console.log("Counts file has no stamp fields. Updated line left as it is.");
  process.exit(0);
}
if (next === raw) {
  console.log("Updated line already matches the committed files.");
  process.exit(0);
}
await writeFile(countsPath, next);
console.log("Updated line set from committed files: " + [stamp, day].filter(Boolean).join(" / "));
