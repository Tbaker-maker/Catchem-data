// One Browse call per product. Saves response field `total` beside that
// product's price. Does not call solds. A failed query leaves the day blank.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { browseActiveTotal, getEbayToken, priceBoundsFor } from "./fetch-sealed-prices.mjs";
import { countBottoms, withActiveTotal } from "./lib/active-total.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const today = new Date().toISOString().slice(0, 10);
const CONCURRENCY = 4;
const DELAY_MS = 350;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function oneTotal(token, product) {
  const [floor, ceiling] = priceBoundsFor(product);
  let last = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    last = await browseActiveTotal(token, product.searchQuery, floor, ceiling);
    if (last.total != null) return last;
    if (last.status !== 429 && last.status !== 500 && last.status !== 503) return last;
    await sleep(1500);
  }
  return last;
}

async function mapPool(items, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      await sleep(DELAY_MS);
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

const prices = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
const releaseDoc = JSON.parse(await readFile(join(ROOT, "data/set-release-dates.json"), "utf8"));
let heat = [];
try { heat = JSON.parse(await readFile(join(ROOT, "data/heat-history.json"), "utf8")); } catch { heat = []; }

const token = await getEbayToken();
const products = prices.products || [];
let done = 0;
const results = await mapPool(products, async (product) => {
  try {
    const got = await oneTotal(token, product);
    const failed = got.total == null;
    const recorded = withActiveTotal(product, { date: today, total: got.total, failed });
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${products.length}`);
    return { product: recorded.product, blank: recorded.blank, status: got.status };
  } catch (err) {
    const recorded = withActiveTotal(product, { date: today, total: null, failed: true });
    console.warn(`  ${product.id}: blank (${err.message})`);
    return { product: recorded.product, blank: true, status: 0 };
  }
});

prices.products = results.map((row) => row.product);
prices.updatedAt = new Date().toISOString();
await writeFile(join(ROOT, "data/sealed-prices.json"), JSON.stringify(prices, null, 2) + "\n");

const priorToday = new Map(heat.filter((row) => row.date === today).map((row) => [row.id, row]));
heat = heat.filter((row) => row.date !== today);
for (const row of results) {
  const prev = priorToday.get(row.product.id);
  const entry = prev ? { ...prev, date: today, id: row.product.id } : { date: today, id: row.product.id };
  if (Number.isInteger(row.product.activeTotal)) entry.total = row.product.activeTotal;
  else delete entry.total;
  if (!Number.isInteger(entry.total) && entry.price == null && entry.listingCount == null) continue;
  heat.push(entry);
}
await writeFile(join(ROOT, "data/heat-history.json"), JSON.stringify(heat) + "\n");

const real = results.filter((row) => Number.isInteger(row.product.activeTotal)).length;
const blankToday = results.filter((row) => row.blank).length;
const olderBlank = heat.filter((row) => !Number.isInteger(row.total)).length;
const calls = countBottoms(prices.products, releaseDoc.dates || {});

console.log(`real totals: ${real}`);
console.log(`days left blank: ${blankToday + olderBlank}`);
console.log(`blank today: ${blankToday}`);
console.log(`older rows without a total: ${olderBlank}`);
console.log(calls.length === 0 ? "no bottom called" : `bottoms called: ${calls.length}`);
if (calls.length) process.exit(1);
