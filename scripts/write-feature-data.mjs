import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignMarks, buildListings, buildReleases, buildSetValueDoc, datedDay, idsForCatalogSet,
  loadPriceMap, nonEmptyDoc, ROTATION_SOURCES, ROTATION_EXPECTED, shouldWrite,
} from "./lib/feature-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(ROOT, "research/assets/public");

const index = JSON.parse(await readFile(join(pub, "sets.json"), "utf8"));
const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
const items = catalog.items || [];
const { date, map, days } = await loadPriceMap(ROOT);
const valueDir = join(pub, "set-value");
const wrote = { setValue: false, rotation: false, releases: false, listings: false };

let pricedCards = 0;
let unpricedCards = 0;
let baseValue = null;
let shadowValue = null;
if (shouldWrite("set-value", { date, prices: map.size })) {
  await mkdir(valueDir, { recursive: true });
  const baseIds = idsForCatalogSet(items, "Base Set");
  const shadowIds = idsForCatalogSet(items, "Base Set (Shadowless)");
  for (const row of index.sets || []) {
    const setDoc = JSON.parse(await readFile(join(pub, "sets", `${row.slug}.json`), "utf8"));
    const opts = row.slug === "base-set" ? { onlyIds: baseIds, catalogSet: "Base Set" } : {};
    const doc = buildSetValueDoc(setDoc, map, date, opts);
    if (!datedDay(doc.asOf) || !nonEmptyDoc(doc)) continue;
    await writeFile(join(valueDir, `${row.slug}.json`), JSON.stringify(doc) + "\n");
    pricedCards += doc.master.priced;
    unpricedCards += doc.master.unpriced;
    if (row.slug === "base-set") baseValue = doc;
    wrote.setValue = true;
  }
  const baseDoc = JSON.parse(await readFile(join(pub, "sets", "base-set.json"), "utf8"));
  const shadow = buildSetValueDoc(baseDoc, map, date, {
    onlyIds: shadowIds,
    catalogSet: "Base Set (Shadowless)",
    slug: "base-set-shadowless",
    name: "Base Set (Shadowless)",
  });
  if (datedDay(shadow.asOf) && nonEmptyDoc(shadow) && shadow.master.inSet > 0) {
    await writeFile(join(valueDir, "base-set-shadowless.json"), JSON.stringify(shadow) + "\n");
    shadowValue = shadow;
    wrote.setValue = true;
  }
}

const logos = JSON.parse(await readFile(join(pub, "set-logos.json"), "utf8")).logos || {};
const official = JSON.parse(await readFile(join(ROOT, "data/set-logos.json"), "utf8")).sets || {};
const attrs = JSON.parse(await readFile(join(ROOT, "data/card-attrs.json"), "utf8"));
const marks = assignMarks(index.sets || [], logos, official, attrs.cards || {});
const rotationAsOf = datedDay(attrs.generatedAt);
if (shouldWrite("rotation", { asOf: rotationAsOf, sets: marks.length })) {
  const rotation = {
    asOf: rotationAsOf,
    marksFile: "data/card-attrs.json",
    sources: ROTATION_SOURCES,
    expected: ROTATION_EXPECTED,
    sets: marks,
  };
  if (nonEmptyDoc(rotation)) {
    await writeFile(join(pub, "rotation-status.json"), JSON.stringify(rotation) + "\n");
    wrote.rotation = true;
  }
}

const radar = JSON.parse(await readFile(join(ROOT, "data/release-radar.json"), "utf8"));
const releases = buildReleases(radar, items, days);
if (shouldWrite("releases", { checked: releases.checked, releases: releases.releases.length }) && nonEmptyDoc(releases)) {
  await writeFile(join(pub, "releases.json"), JSON.stringify(releases) + "\n");
  wrote.releases = true;
}

const sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
const parents = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
const listings = buildListings(sealed.products || [], parents);
const listingsAsOf = datedDay(sealed.updatedAt);
const listingsDoc = {
  asOf: listingsAsOf,
  source: "data/sealed-prices.json",
  parentsFile: "data/sealed-products.json",
  skippedParents: listings.skipped,
  products: listings.products,
};
if (shouldWrite("listings", { asOf: listingsAsOf, products: listings.products.length, parents: listings.skipped.length }) && nonEmptyDoc(listingsDoc)) {
  await writeFile(join(pub, "listings-counted.json"), JSON.stringify(listingsDoc) + "\n");
  wrote.listings = true;
}

const letters = {};
for (const row of marks) letters[row.mark || "(none)"] = (letters[row.mark || "(none)"] || 0) + 1;
const files = (await readdir(valueDir)).filter((name) => name.endsWith(".json"));
console.log(JSON.stringify({
  wrote,
  priceDate: date,
  priceRows: map.size,
  setValueFiles: files.length,
  pricedCards,
  unpricedCards,
  baseSet: baseValue && { total: baseValue.master.total, priced: baseValue.master.priced, unpriced: baseValue.master.unpriced, inSet: baseValue.master.inSet, top: baseValue.top[0] },
  shadowless: shadowValue && { total: shadowValue.master.total, priced: shadowValue.master.priced, unpriced: shadowValue.master.unpriced, inSet: shadowValue.master.inSet, top: shadowValue.top[0] },
  marks: letters,
  rotated: marks.filter((row) => row.status && row.status.startsWith("Rotated")).map((row) => [row.slug, row.mark, row.status]),
  releases: releases.releases.map((row) => ({ name: row.name, date: row.date, source: row.source, market: row.market || null })),
  listings: listings.products.length,
  skippedParents: listings.skipped.length,
}, null, 2));

// IR cycle file (feed/ir-cycle.json). Runs after rotation-status.json is written.
// A failed build keeps the last file and does not fail this step.
await import("./build-ir-cycle.mjs");
// Card Rating (feed/card-rating.json and feed/rating/NN.json). Same keep-last rule.
// Self-check tuner weights (data/derived/rating-weights.json) apply first when valid.
try { const [{ applyTunedWeights }, { RATING_WEIGHTS }] = await Promise.all([import("./lib/rating-weights.mjs"), import("./lib/card-rating.mjs")]); console.log(JSON.stringify({ ratingWeights: await applyTunedWeights(ROOT, RATING_WEIGHTS) })); } catch (err) { console.error(`rating weights skipped: ${err.message}`); }
await import("./build-card-rating.mjs");
// Sealed Rating (feed/sealed-rating.json). Same keep-last rule.
await import("./build-sealed-rating.mjs");
