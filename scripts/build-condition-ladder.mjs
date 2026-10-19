// Writes research/assets/public/condition-prices.json from TCGplayer rows that
// already name a condition and a printing. A market price is not copied in as
// NM. Set JSON is not rewritten. The listing band is not written out.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { publishConditionCards } from "./lib/condition-prices.mjs";
import { loadPriceTrustConfig } from "./lib/price-trust.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "research/assets/public");

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

const catalog = await readJson(join(ROOT, "data/catalog/tcgcsv-latest.json"));
const setsDoc = await readJson(join(PUB, "sets.json"));
const releaseByName = new Map((setsDoc?.sets || []).map((row) => [row.name, String(row.release || "").slice(0, 10)]));
const asOf = String(catalog?.asOf || setsDoc?.asOf || "").slice(0, 10);

const unverified = new Set();
const ratingDir = join(PUB, "feed/rating");
try {
  const { readdir } = await import("node:fs/promises");
  for (const name of await readdir(ratingDir)) {
    if (!name.endsWith(".json")) continue;
    const doc = await readJson(join(ratingDir, name));
    for (const row of doc?.rows || []) if (row?.check && row.id) unverified.add(row.id);
  }
} catch { /* no rating file */ }

const items = (catalog?.items || []).map((item) => ({
  id: item.id,
  kind: item.kind,
  printing: item.printing || "",
  release: releaseByName.get(item.set) || "",
  conditions: item.conditions || null,
  unverified: unverified.has(item.id),
}));

let cfg = null;
try { cfg = await loadPriceTrustConfig(ROOT); } catch { cfg = null; }

const { doc, sweep } = publishConditionCards(items, { unverified, asks: {}, cfg, asOf });
// Keep the vintage sample's published condition prices. That job writes them into
// this same file, and a rebuild must not wipe them (run 39190694919, 2026-10-18).
const prior = await readJson(join(PUB, "condition-prices.json"));
const sample = await readJson(join(ROOT, "data/derived/vintage-sample.json"));
const publishedIds = new Set((sample?.rows || []).filter((row) => row && row.published).map((row) => row.id));
for (const [id, body] of Object.entries(prior?.cards || {})) {
  if (publishedIds.has(id) && !doc.cards[id]) doc.cards[id] = body;
}
await writeFile(join(PUB, "condition-prices.json"), JSON.stringify(doc));
const sweepDoc = {
  asOf,
  ...sweep,
  note: "TCGplayer daily rows name a printing and a market price. They do not name a condition. No market price was copied in as NM. A card with no condition price shows Price being checked on every chip.",
};
await writeFile(join(ROOT, "data/derived/condition-ladder-sweep.json"), JSON.stringify(sweepDoc, null, 1) + "\n");
console.log(JSON.stringify({
  cards: Object.keys(doc.cards).length,
  vintage: sweep.vintage,
  modern: sweep.modern,
  undated: sweep.undated,
}));
