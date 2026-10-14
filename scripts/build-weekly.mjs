// data/derived/weekly.json: biggest movers, scanner patterns, listings counted changes.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { biggestMovers, listingChanges, newPatterns, weeklyDoc } from "./lib/weekly-changes.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return null; } };

const catalog = await read("data/catalog/tcgcsv-latest.json");
const asOf = String(catalog?.asOf || new Date().toISOString()).slice(0, 10);
const cards = [];
const bucketDir = join(ROOT, "research/assets/public/buckets");
for (const f of (await readdir(bucketDir).catch(() => [])).filter((name) => name.endsWith(".json"))) {
  const rows = JSON.parse(await readFile(join(bucketDir, f), "utf8"));
  for (const row of rows || []) if (row?.kind !== "sealed") cards.push(row);
}
const latest = await read("data/derived/listing-counts/latest.json");
const histDir = join(ROOT, "data/derived/listing-counts/history");
const days = (await readdir(histDir).catch(() => [])).filter((name) => name.endsWith(".json.gz") || name.endsWith(".json")).sort();
let older = [];
if (days.length >= 2) {
  const file = days[days.length - 2];
  const buf = await readFile(join(histDir, file));
  const doc = file.endsWith(".gz") ? JSON.parse(gunzipSync(buf).toString("utf8")) : JSON.parse(buf.toString("utf8"));
  older = doc.rows || [];
} else if (days.length === 1) {
  const file = days[0];
  const buf = await readFile(join(histDir, file));
  const doc = file.endsWith(".gz") ? JSON.parse(gunzipSync(buf).toString("utf8")) : JSON.parse(buf.toString("utf8"));
  older = (doc.rows || []).filter((row) => row.date && latest?.asOf && row.date < latest.asOf);
}
const summary = await read("data/private/scanner/summary.json");
const doc = weeklyDoc({
  asOf,
  movers: biggestMovers(cards),
  patterns: newPatterns(summary),
  listings: listingChanges(latest?.rows || {}, older),
  listingDays: new Set([latest?.asOf, ...older.map((row) => row.date)].filter(Boolean)).size,
});
if (summary?.asOf) doc.patternsAsOf = String(summary.asOf).slice(0, 10);
await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, "data/derived/weekly.json"), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify({ weekly: { asOf, movers: doc.movers.length, patterns: doc.patterns.length, listings: doc.listingsCounted.changes.length, days: doc.listingsCounted.daysOnFile } }));
