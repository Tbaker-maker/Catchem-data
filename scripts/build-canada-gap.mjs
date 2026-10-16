// Hand-kept CAD retail versus our own dated US market price.
// One free Bank of Canada rate call. No price calls. An empty config writes
// an empty file and exits 0.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canadaGapDoc, latestMarket, parseValetRate } from "./lib/canada-gap.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VALET = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=5";

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

const config = await readJson(join(ROOT, "config/cad-retail.json"), { products: [] });
const products = Array.isArray(config.products) ? config.products : [];
const asOf = new Date().toISOString().slice(0, 10);
let rate = null;
if (products.length) {
  try {
    const res = await fetch(VALET, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Catch'em canada gap" } });
    if (res.ok) rate = parseValetRate(await res.json());
  } catch { rate = null; }
}
const markets = new Map();
if (products.length && rate) {
  const dir = join(ROOT, "data/history/tcgplayer-market");
  const wanted = new Set(products.map((row) => String(row.id || "")));
  for (const name of await readdir(dir).catch(() => [])) {
    if (!name.endsWith(".json")) continue;
    const doc = await readJson(join(dir, name), null);
    const id = String(doc?.id || name.replace(/\.json$/, ""));
    if (!wanted.has(id)) continue;
    const point = latestMarket(doc?.points);
    if (point) markets.set(id, point);
  }
}
const doc = canadaGapDoc({ products, markets, rate, asOf });
const dir = join(ROOT, "data/derived/canada-gap");
await mkdir(dir, { recursive: true });
await writeFile(join(dir, `${asOf}.json`), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ canadaGap: { asOf, products: doc.products.length, rate: doc.rate?.date || null } }));
