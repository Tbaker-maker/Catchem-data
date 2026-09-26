// Write data/search/manifest.json and data/search/shards/*.json from the search index.
// Does not fetch. Does not add a price that was not already on the row.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShardMap, staleShardNames } from "./lib/search-shards.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "data", "search", "search-index.json");
const DIR = join(ROOT, "data", "search", "shards");
const MANIFEST = join(ROOT, "data", "search", "manifest.json");

const doc = JSON.parse(readFileSync(INDEX, "utf8"));
const shards = buildShardMap(doc.items || []);
mkdirSync(DIR, { recursive: true });
const listed = {};
for (const [id, rows] of [...shards.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const file = `shards/${id}.json`;
  const body = JSON.stringify(rows);
  writeFileSync(join(ROOT, "data", "search", file), body);
  listed[id] = { file, count: rows.length, bytes: Buffer.byteLength(body) };
}
const manifest = {
  asOf: doc.asOf || null,
  note: "Load this file first, then only the shards a query needs. A shard is a kind plus the first two letters of a name or an alias. Prices are the ones already on the search index.",
  shards: listed,
};
writeFileSync(MANIFEST, JSON.stringify(manifest));
let removed = 0;
if (existsSync(DIR)) {
  for (const name of staleShardNames(readdirSync(DIR), Object.keys(listed))) {
    unlinkSync(join(DIR, name));
    removed += 1;
  }
}
const biggest = Object.values(listed).reduce((max, row) => Math.max(max, row.bytes), 0);
console.log(`search shards ${Object.keys(listed).length} removed=${removed} biggest=${biggest}`);
