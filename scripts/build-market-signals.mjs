// Set momentum and listings-counted dry-up. Dated points only.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dryUp, setMomentum } from "./lib/market-signals.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
const asOf = String(catalog.asOf || "").slice(0, 10);
const cards = [];
const bucketDir = join(ROOT, "research/assets/public/buckets");
for (const f of (await readdir(bucketDir)).filter((name) => name.endsWith(".json"))) {
  const rows = JSON.parse(await readFile(join(bucketDir, f), "utf8"));
  for (const row of rows || []) {
    if (row?.kind === "sealed" || !row?.set) continue;
    cards.push({ id: row.id, name: row.name, number: row.num, set: row.set, price: row.price, hist: row.hist });
  }
}
const byId = new Map();
const histDir = join(ROOT, "data/derived/listing-counts/history");
for (const file of (await readdir(histDir).catch(() => [])).filter((name) => name.endsWith(".json") || name.endsWith(".json.gz")).sort()) {
  const buf = await readFile(join(histDir, file));
  const doc = file.endsWith(".gz") ? JSON.parse(gunzipSync(buf).toString("utf8")) : JSON.parse(buf.toString("utf8"));
  for (const row of doc.rows || []) {
    if (!row?.id || !(row.listingsCounted > 0) || !row.date) continue;
    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id).push({ id: row.id, name: row.name || row.id, date: row.date, n: row.listingsCounted });
  }
}
const dry = [];
for (const series of byId.values()) dry.push(...dryUp(series));
const momentum = setMomentum(cards, { asOf }).slice(0, 12);
const doc = {
  asOf,
  setMomentum: momentum,
  listingsDryUp: dry.slice(0, 20),
  note: [
    momentum.length ? `${momentum.length} sets with a 30-day median.` : "No set had 8 or more cards with a dated point 30 days before asOf, so set momentum is empty.",
    dry.length ? "Listings counted down 25% or more across at least 14 days." : "No listings-counted series spans 14 days yet, so the dry-up list is empty.",
  ].join(" "),
};
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, "data/derived/market-signals.json"), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ marketSignals: { asOf, momentum: momentum.length, dryUp: dry.length } }));
