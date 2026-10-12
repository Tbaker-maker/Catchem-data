import { mkdir, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignMarks, buildListings, buildReleases, buildSetValueDoc, loadPriceMap, ROTATION_SOURCES,
} from "./lib/feature-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(ROOT, "research/assets/public");

const index = JSON.parse(await readFile(join(pub, "sets.json"), "utf8"));
const { date, map, days } = await loadPriceMap(ROOT);
const valueDir = join(pub, "set-value");
await rm(valueDir, { recursive: true, force: true });
await mkdir(valueDir, { recursive: true });
let pricedCards = 0;
let unpricedCards = 0;
for (const row of index.sets || []) {
  const setDoc = JSON.parse(await readFile(join(pub, "sets", `${row.slug}.json`), "utf8"));
  const doc = buildSetValueDoc(setDoc, map, date);
  pricedCards += doc.master.priced;
  unpricedCards += doc.master.unpriced;
  await writeFile(join(valueDir, `${row.slug}.json`), JSON.stringify(doc) + "\n");
}

const logos = JSON.parse(await readFile(join(pub, "set-logos.json"), "utf8")).logos || {};
const official = JSON.parse(await readFile(join(ROOT, "data/set-logos.json"), "utf8")).sets || {};
const attrs = JSON.parse(await readFile(join(ROOT, "data/card-attrs.json"), "utf8"));
const marks = assignMarks(index.sets || [], logos, official, attrs.cards || {});
const rotation = {
  asOf: String(attrs.generatedAt || "").slice(0, 10),
  marksFile: "data/card-attrs.json",
  sources: ROTATION_SOURCES,
  sets: marks,
};
await writeFile(join(pub, "rotation-status.json"), JSON.stringify(rotation) + "\n");

const radar = JSON.parse(await readFile(join(ROOT, "data/release-radar.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
const releases = buildReleases(radar, catalog.items || [], days);
await writeFile(join(pub, "releases.json"), JSON.stringify(releases) + "\n");

const sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
const parents = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
const listings = buildListings(sealed.products || [], parents);
const listingsDoc = {
  asOf: String(sealed.updatedAt || "").slice(0, 10),
  source: "data/sealed-prices.json",
  parentsFile: "data/sealed-products.json",
  skippedParents: listings.skipped,
  products: listings.products,
};
await writeFile(join(pub, "listings-counted.json"), JSON.stringify(listingsDoc) + "\n");

const letters = {};
for (const row of marks) letters[row.mark || "(none)"] = (letters[row.mark || "(none)"] || 0) + 1;
const files = (await readdir(valueDir)).filter((name) => name.endsWith(".json"));
console.log(JSON.stringify({
  priceDate: date,
  setValueFiles: files.length,
  pricedCards,
  unpricedCards,
  marks: letters,
  rotated: marks.filter((row) => row.status && row.status.startsWith("Rotated")).map((row) => [row.slug, row.mark, row.status]),
  releases: releases.releases.map((row) => ({ name: row.name, date: row.date, source: row.source, market: row.market || null })),
  listings: listings.products.length,
  skippedParents: listings.skipped.length,
}, null, 2));
