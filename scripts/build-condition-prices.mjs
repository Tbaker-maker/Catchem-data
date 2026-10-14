// Writes data/derived/condition-prices.json. NM is the default. LP, MP, and
// DMG are copied only from a dated file that already has them.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rowsFromDistilled } from "./lib/condition-prices.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/derived/condition-prices.json");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const catalog = await readJson(join(ROOT, "data/catalog/tcgcsv-latest.json"));
const distilled = await readJson(join(ROOT, "data/enrichment-distilled.json"));
const pulled = distilled ? rowsFromDistilled(distilled) : { asOf: "", rows: [] };
const asOf = pulled.asOf || String(catalog?.asOf || "").slice(0, 10);
const doc = {
  asOf,
  source: pulled.rows.length ? "data/enrichment-distilled.json" : "TCGplayer market daily file is Near Mint. No dated LP, MP, or DMG rows were in the files on disk.",
  nmDefault: true,
  note: "Graded and damaged copies can price very differently, and our prices are Near Mint unless labeled.",
  count: pulled.rows.length,
  cards: pulled.rows,
};
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ conditionPrices: { asOf, count: doc.count, path: "data/derived/condition-prices.json" } }));
