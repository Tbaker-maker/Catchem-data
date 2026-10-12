import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignMarks, listingsFromHistory, mainSetName, officialSource, releaseMatchesItem, rotationStatus,
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
  const valueNames = (await readdir(join(PUB, "set-value"))).filter((name) => name.endsWith(".json")).sort();
  t("one set-value file per published set", valueNames.length === slugs.length && slugs.every((slug) => valueNames.includes(`${slug}.json`)));

  let badPrice = 0;
  let badCount = 0;
  let badDate = 0;
  let invented = 0;
  for (const slug of slugs) {
    const doc = JSON.parse(await readFile(join(PUB, "set-value", `${slug}.json`), "utf8"));
    const setDoc = JSON.parse(await readFile(join(PUB, "sets", `${slug}.json`), "utf8"));
    const singles = (setDoc.items || []).filter((item) => item && item.kind !== "sealed");
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
  const days = [];
  for (const name of (await readdir(join(ROOT, "data/history/tcgcsv-daily"))).filter((name) => name.endsWith(".json")).sort()) {
    const doc = JSON.parse(await readFile(join(ROOT, "data/history/tcgcsv-daily", name), "utf8"));
    const have = new Set();
    for (const row of doc.prices || []) if (Number(row.market) > 0) have.add(Number(row.id));
    days.push({ date: doc.date, prices: new Map((doc.prices || []).filter((row) => Number(row.market) > 0).map((row) => [Number(row.id), Number(row.market)])), ids: have });
  }
  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  let marketBad = 0;
  for (const row of releases.releases) {
    if (!row.market) continue;
    const id = Number(String(row.market.id).replace(/\D/g, ""));
    const onDay = days.find((dayRow) => dayRow.date === row.market.date);
    if (!onDay || onDay.prices.get(id) !== row.market.price) marketBad += 1;
    const earlier = days.filter((dayRow) => dayRow.date < row.market.date);
    const src = verified.find((item) => item.name === row.name);
    const ids = new Set();
    const setName = mainSetName(src, catalog.items || []);
    for (const item of catalog.items || []) {
      const hit = setName ? item.set === setName : releaseMatchesItem(src, item);
      if (!hit) continue;
      const n = Number(String(item.id).replace(/\D/g, ""));
      if (n) ids.add(n);
    }
    if ([...earlier].some((dayRow) => [...ids].some((n) => dayRow.ids.has(n)))) marketBad += 1;
  }
  t("release markets are the first daily price, or absent", marketBad === 0 && releases.releases.filter((row) => row.market).every((row) => row.market.date && row.market.price > 0));

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
