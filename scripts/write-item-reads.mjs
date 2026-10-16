// Per-item read lookups for the site's item pages (/c/* and /p/*).
// One small file per id bucket (id number % 100), so an item page never loads
// the whole reads.json. Each read carries the section of the item page it
// belongs to, so a read's Open data can land on the right spot.
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SECTION = {
  listings: "supply", breadth: "supply",
  "rarity-band": "rank", "artist-band": "rank", set: "rank",
  rotation: "stats", release: "stats", "release-cycle": "stats", season: "stats", rip: "stats", sealed: "stats",
};
export function sectionFor(read) {
  const kind = String(read?.readKind || read?.kind || "");
  return SECTION[kind] || "price";
}
export function itemIdOf(read, products = {}) {
  const sku = String(read?.sku || "");
  if (/^tcgcsv-\d+$/.test(sku)) return sku;
  const m = String(read?.href || "").match(/^\/(?:c|p)\/([a-z0-9-]+)$/i);
  if (!m) return "";
  if (/^tcgcsv-\d+$/.test(m[1])) return m[1];
  const dest = String(products[m[1]] || "").match(/(tcgcsv-\d+)$/);
  return dest ? dest[1] : "";
}
export const bucketOf = (id) => String((Number((String(id).match(/(\d+)/) || [])[1]) || 0) % 100).padStart(2, "0");

export function buildItemReads(bundle, products = {}) {
  const out = {};
  for (const read of bundle?.reads || []) {
    const id = itemIdOf(read, products);
    if (!id || !read.id || !(read.headline || read.path)) continue;
    const b = bucketOf(id);
    out[b] ||= {};
    (out[b][id] ||= []).push({
      id: read.id,
      kind: String(read.readKind || read.kind || ""),
      section: sectionFor(read),
      headline: String(read.headline || read.path || ""),
      lines: Array.isArray(read.lines) ? read.lines.slice(0, 6).map(String) : [],
      asOf: String(read.asOf || "").slice(0, 10),
      source: String(read.source || ""),
    });
  }
  for (const b of Object.keys(out)) for (const id of Object.keys(out[b])) out[b][id].sort((x, y) => y.asOf.localeCompare(x.asOf));
  return out;
}

export async function writeItemReads(root = ROOT) {
  const bundle = JSON.parse(await readFile(join(root, "research/assets/public/reads.json"), "utf8"));
  const dir = join(root, "research/assets/public/feed/item-reads");
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  let products = {};
  try { products = JSON.parse(await readFile(join(root, "research/assets/public/redirects.json"), "utf8")).products || {}; } catch { products = {}; }
  const byBucket = buildItemReads(bundle, products);
  for (const [b, items] of Object.entries(byBucket)) await writeFile(join(dir, `${b}.json`), JSON.stringify({ asOf: bundle.asOf || "", items }));
  return Object.keys(byBucket).length;
}

if (process.argv[1] && process.argv[1].endsWith("write-item-reads.mjs")) {
  console.log(`item-reads: ${await writeItemReads()} bucket files`);
}
