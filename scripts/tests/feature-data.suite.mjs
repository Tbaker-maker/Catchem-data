import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignMarks, dailyRows, listingsFromHistory, loadPriceMap, nonEmptyDoc, officialSource,
  releaseMarketItem, rotationStatus, shouldWrite,
} from "../lib/feature-data.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PUB = join(ROOT, "research/assets/public");

const ROTATED = {
  "pokemon-go": ["F", "Rotated April 11, 2025"],
  "swsh09-brilliant-stars": ["F", "Rotated April 11, 2025"],
  "swsh10-astral-radiance": ["F", "Rotated April 11, 2025"],
  "swsh11-lost-origin": ["F", "Rotated April 11, 2025"],
  "swsh12-silver-tempest": ["F", "Rotated April 11, 2025"],
  "sv-paldean-fates": ["G", "Rotated April 10, 2026"],
  "sv-scarlet-and-violet-151": ["G", "Rotated April 10, 2026"],
  "sv01-scarlet-and-violet-base-set": ["G", "Rotated April 10, 2026"],
  "sv02-paldea-evolved": ["G", "Rotated April 10, 2026"],
  "sv03-obsidian-flames": ["G", "Rotated April 10, 2026"],
  "sv04-paradox-rift": ["G", "Rotated April 10, 2026"],
};

function pidOf(item) {
  const raw = String(item?.id || "");
  const n = Number(item?.pid || (raw.startsWith("tcgcsv-") ? raw.slice(7) : ""));
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const dayName = (await readdir(join(ROOT, "data/history/tcgcsv-daily"))).filter((name) => name.endsWith(".json")).sort().at(-1);
  const day = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", dayName), "utf8"));
  const prices = new Map();
  for (const row of day.prices || []) if (Number(row.market) > 0) prices.set(Number(row.id), Number(row.market));
  const index = JSON.parse(await readFile(join(PUB, "sets.json"), "utf8"));
  const slugs = (index.sets || []).map((row) => row.slug);
  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const catalogSetById = new Map();
  for (const item of catalog.items || []) if (item?.id) catalogSetById.set(String(item.id), item.set || "");
  const valueNames = (await readdir(join(PUB, "set-value"))).filter((name) => name.endsWith(".json")).sort();
  t("published sets stay at 205", slugs.length === 205);
  t("one set-value file per published set plus shadowless", valueNames.length === slugs.length + 1 && slugs.every((slug) => valueNames.includes(`${slug}.json`)) && valueNames.includes("base-set-shadowless.json"));

  let badPrice = 0;
  let badCount = 0;
  let badDate = 0;
  let invented = 0;
  for (const slug of slugs) {
    const doc = JSON.parse(await readFile(join(PUB, "set-value", `${slug}.json`), "utf8"));
    const setDoc = JSON.parse(await readFile(join(PUB, "sets", `${slug}.json`), "utf8"));
    let singles = (setDoc.items || []).filter((item) => item && item.kind !== "sealed");
    if (slug === "base-set") singles = singles.filter((item) => catalogSetById.get(String(item.id)) === "Base Set");
    if (doc.asOf !== day.date || doc.top.some((row) => row.date !== day.date)) badDate += 1;
    let priced = 0;
    let unpriced = 0;
    let total = 0;
    const rows = [];
    for (const item of singles) {
      const market = prices.get(pidOf(item));
      if (!(market > 0)) { unpriced += 1; continue; }
      priced += 1;
      total += Math.round(market * 100);
      rows.push({ id: String(item.id), price: market });
    }
    rows.sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
    const top = rows.slice(0, 10);
    if (doc.master.priced !== priced || doc.master.unpriced !== unpriced || doc.master.inSet !== singles.length) badCount += 1;
    if (doc.master.total !== total / 100) badCount += 1;
    if (doc.master.priced + doc.master.unpriced !== doc.master.inSet) badCount += 1;
    if (doc.top.length !== top.length || doc.top.some((row, i) => row.id !== top[i].id || row.price !== top[i].price)) badPrice += 1;
    if (doc.top.some((row) => !(row.price > 0) || prices.get(pidOf(row)) !== row.price)) invented += 1;
  }
  t("set value dates are the daily file date", badDate === 0);
  t("set value counts match priced singles", badCount === 0);
  t("top 10 prices are today's market and nothing is invented", badPrice === 0 && invented === 0);

  const baseValue = JSON.parse(await readFile(join(PUB, "set-value", "base-set.json"), "utf8"));
  const shadow = JSON.parse(await readFile(join(PUB, "set-value", "base-set-shadowless.json"), "utf8"));
  const shadowSet = JSON.parse(await readFile(join(PUB, "sets", "base-set.json"), "utf8"));
  const shadowSingles = (shadowSet.items || []).filter((item) => item && item.kind !== "sealed" && catalogSetById.get(String(item.id)) === "Base Set (Shadowless)");
  let shadowCents = 0;
  let shadowPriced = 0;
  let shadowUnpriced = 0;
  let shadowTop = null;
  for (const item of shadowSingles) {
    const market = prices.get(pidOf(item));
    if (!(market > 0)) { shadowUnpriced += 1; continue; }
    shadowPriced += 1;
    shadowCents += Math.round(market * 100);
    if (!shadowTop || market > shadowTop.price || (market === shadowTop.price && String(item.id) < shadowTop.id)) shadowTop = { id: String(item.id), price: market };
  }
  t("base-set value is regular Base Set only", baseValue.catalogSet === "Base Set" && baseValue.master.inSet === 102 && baseValue.top[0]?.id === "tcgcsv-42382" && baseValue.top.every((row) => catalogSetById.get(row.id) === "Base Set") && !baseValue.top.some((row) => String(row.id) === "tcgcsv-106999"));
  t("shadowless has its own total from the same daily file", shadow.slug === "base-set-shadowless" && shadow.catalogSet === "Base Set (Shadowless)" && shadow.asOf === day.date && shadow.master.inSet === shadowSingles.length && shadow.master.priced === shadowPriced && shadow.master.unpriced === shadowUnpriced && shadow.master.total === shadowCents / 100 && shadow.top[0]?.id === shadowTop?.id && shadow.top[0]?.price === shadowTop?.price && shadow.top.every((row) => catalogSetById.get(row.id) === "Base Set (Shadowless)"));

  const rotation = JSON.parse(await readFile(join(PUB, "rotation-status.json"), "utf8"));
  const news = await readFile(join(ROOT, "research/digests/news.json"), "utf8");
  t("rotation sources are the two announcement links in the news file", rotation.sources.length === 2 && rotation.sources.every((row) => news.includes(row.href)));
  t("F and G statuses use only those two dates", rotationStatus("F") === "Rotated April 11, 2025" && rotationStatus("G") === "Rotated April 10, 2026" && rotationStatus("D") === null && rotationStatus("H") === "Standard");
  const bySlug = new Map(rotation.sets.map((row) => [row.slug, row]));
  const rotated = rotation.sets.filter((row) => row.status && String(row.status).startsWith("Rotated"));
  t("the 11 rotated sets match the site", rotated.length === 11 && Object.entries(ROTATED).every(([slug, pair]) => bySlug.get(slug)?.mark === pair[0] && bySlug.get(slug)?.status === pair[1]));
  t("Crown Zenith, Prismatic Evolutions, and Journey Together have no letter", ["swsh-crown-zenith", "sv-prismatic-evolutions", "sv09-journey-together"].every((slug) => bySlug.get(slug)?.mark == null && bySlug.get(slug)?.status == null));
  const logos = JSON.parse(await readFile(join(PUB, "set-logos.json"), "utf8")).logos;
  const official = JSON.parse(await readFile(join(ROOT, "data/set-logos.json"), "utf8")).sets;
  const attrs = JSON.parse(await readFile(join(ROOT, "data/card-attrs.json"), "utf8"));
  const again = assignMarks(index.sets, logos, official, attrs.cards);
  t("rotation marks are the 80 percent card-attrs rule", JSON.stringify(again) === JSON.stringify(rotation.sets));
  t("no rotated date other than the two announcements", rotated.every((row) => row.status === "Rotated April 11, 2025" || row.status === "Rotated April 10, 2026"));

  const radar = JSON.parse(await readFile(join(ROOT, "data/release-radar.json"), "utf8"));
  const releases = JSON.parse(await readFile(join(PUB, "releases.json"), "utf8"));
  const verified = (radar.upcoming || []).filter((row) => row.confidence === "verified");
  const blob = JSON.stringify(releases);
  t("releases are the verified radar rows only", releases.releases.length === verified.length && verified.every((row, i) => releases.releases[i].name === row.name && releases.releases[i].date === row.date && releases.releases[i].type === row.type));
  t("release links and the checked date are copied from the radar file", releases.checked === radar.updated && releases.releases.every((row) => row.checked === radar.updated && row.source && verified.find((src) => src.name === row.name).note.includes(row.source) && officialSource(verified.find((src) => src.name === row.name).note) === row.source));
  t("releases carry no msrp", !/msrp/i.test(blob) && !blob.includes("$"));
  const priceDocs = [];
  for (const name of (await readdir(join(ROOT, "data/history/tcgcsv-daily"))).filter((name) => name.endsWith(".json")).sort()) {
    priceDocs.push(JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", name), "utf8")));
  }
  const priceDays = dailyRows(priceDocs);
  const loaded = await loadPriceMap(ROOT);
  t("a daily file with no date field is not used", dailyRows([{ date: "" }, { prices: [{ id: 1, market: 1 }] }]).length === 0 && loaded.date === day.date);
  t("the writer skips undated inputs and empty docs", shouldWrite("set-value", { date: "", prices: loaded.map.size }) === false && shouldWrite("set-value", { date: day.date, prices: 0 }) === false && shouldWrite("rotation", { asOf: "", sets: 205 }) === false && shouldWrite("releases", { checked: radar.updated, releases: 0 }) === false && shouldWrite("listings", { asOf: "not-a-date", products: 4, parents: 17 }) === false && nonEmptyDoc({}) === false && nonEmptyDoc({ slug: "base-set" }) === false && nonEmptyDoc({ asOf: day.date, slug: "base-set" }) === true);
  const writerSrc = await readFile(join(ROOT, "scripts/write-feature-data.mjs"), "utf8");
  t("the nightly writer does not delete set-value before it writes", !/\brm\s*\(/.test(writerSrc) && writerSrc.includes("shouldWrite(") && writerSrc.includes("nonEmptyDoc("));
  let marketBad = 0;
  for (const row of releases.releases) {
    const src = verified.find((item) => item.name === row.name);
    const hit = releaseMarketItem(src, catalog.items || [], priceDays);
    if (!hit && row.market) marketBad += 1;
    if (hit && (!row.market || row.market.id !== hit.item.id || row.market.price !== hit.price || row.market.date !== hit.date)) marketBad += 1;
    if (row.market && /blister/i.test(row.market.name || "")) marketBad += 1;
    if (row.market) {
      const id = Number(String(row.market.id).replace(/\D/g, ""));
      const onDay = priceDays.find((dayRow) => dayRow.date === row.market.date);
      const price = (onDay?.prices || []).find((item) => Number(item.id) === id && Number(item.market) > 0);
      if (!price || Number(price.market) !== row.market.price) marketBad += 1;
    }
  }
  const delta = releases.releases.find((row) => String(row.name || "").startsWith("Delta Reign"));
  const upc = releases.releases.find((row) => row.type === "wave");
  const fixtureItems = [
    { id: "tcgcsv-1", tcgplayerProductId: 1, groupId: 9, name: "Delta Reign 3 Pack Blister [Seel]", kind: "sealed", subtype: null, set: "ME06: Delta Reign" },
    { id: "tcgcsv-50", tcgplayerProductId: 50, groupId: 9, name: "Delta Reign Booster Box", kind: "sealed", subtype: "booster-box", set: "ME06: Delta Reign" },
  ];
  const fixtureDays = [
    { date: "2026-09-01", prices: [{ id: 1, market: 12 }] },
    { date: "2026-09-02", prices: [{ id: 1, market: 12 }, { id: 50, market: 40 }] },
  ];
  const fixtureRelease = { name: "Delta Reign (ME06)", type: "main-set" };
  const picked = releaseMarketItem(fixtureRelease, fixtureItems, fixtureDays);
  t("release markets follow the type order and the daily file", marketBad === 0 && releases.releases.filter((row) => row.market).every((row) => row.market.date && row.market.price > 0));
  t("Delta Reign never returns a blister", Boolean(delta && delta.market && delta.market.id === "tcgcsv-712094" && !/blister/i.test(delta.market.name) && picked && picked.item.id === "tcgcsv-50" && picked.date === "2026-09-02" && releaseMarketItem(fixtureRelease, [fixtureItems[0]], fixtureDays) == null));
  t("an unmatched row returns no market", releaseMarketItem({ name: "Nothing In The Catalogue", type: "product" }, fixtureItems, fixtureDays) == null);
  t("the UPC row is not the Ditto collection", Boolean(upc && upc.market && upc.market.id === "tcgcsv-704190" && /ultra-premium/i.test(upc.market.name) && !/ditto/i.test(upc.market.name)));

  const gap = listingsFromHistory([
    { date: "2026-10-01", filteredTotal: 10 },
    { date: "2026-10-02", price: 4 },
    { date: "2026-10-03", filteredTotal: 12 },
  ]);
  t("a night without filteredTotal is not a listings line", gap && gap.n === 12 && gap.date === "2026-10-03" && gap.prev.n === 10 && gap.prev.date === "2026-10-01" && !JSON.stringify(gap).includes("2026-10-02"));
  const sealed = JSON.parse(await readFile(join(ROOT, "data/sealed-prices.json"), "utf8"));
  const parents = JSON.parse(await readFile(join(ROOT, "data/sealed-products.json"), "utf8"));
  const listed = JSON.parse(await readFile(join(PUB, "listings-counted.json"), "utf8"));
  const parentIds = new Set(parents.filter((row) => row.combinedArts === true).map((row) => row.id));
  t("shared-art parents are omitted", parentIds.size > 0 && listed.products.every((row) => !parentIds.has(row.id)) && listed.skippedParents.length === parentIds.size);
  let listBad = 0;
  for (const row of listed.products) {
    const product = (sealed.products || []).find((item) => item.id === row.id);
    const points = (product?.priceHistory || []).filter((point) => Number.isInteger(point.filteredTotal)).sort((a, b) => a.date.localeCompare(b.date));
    const last = points[points.length - 1];
    const prev = points.length > 1 ? points[points.length - 2] : null;
    if (!last || row.listingsCounted.n !== last.filteredTotal || row.listingsCounted.date !== last.date) listBad += 1;
    if (prev && (row.listingsCounted.prev?.n !== prev.filteredTotal || row.listingsCounted.prev?.date !== prev.date)) listBad += 1;
    if (!prev && row.listingsCounted.prev) listBad += 1;
  }
  const builtCount = (sealed.products || []).filter((product) => !parentIds.has(product.id) && (product.priceHistory || []).some((point) => Number.isInteger(point.filteredTotal))).length;
  t("listing counts match filteredTotal and skip empty nights", listBad === 0 && listed.products.length === builtCount);

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("feature-data.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
