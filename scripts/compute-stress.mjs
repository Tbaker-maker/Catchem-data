// Build data/indexes/stress/sealed-stress.json and singles-stress.json.
// Reads prices we already store. Does not fetch, does not remove products.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WRONG_MATCH_IDS, eraOf, typeKey } from "./lib/index-baskets.mjs";
import { buildStressReport } from "./lib/stress.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/indexes/stress");

async function load(path) {
  return JSON.parse(await readFile(join(ROOT, path), "utf8"));
}

function dayOf(iso) {
  return typeof iso === "string" ? iso.slice(0, 10) : null;
}

export function sealedType(subtype) {
  return typeKey(subtype);
}

export function collectionType(subtype) {
  if (subtype === "special-collection" || subtype === "upc" || subtype === "tin") return "collection";
  return null;
}

function member(id, name, type, prices, outsideHeadline = false) {
  return { id, name, type, prices, outsideHeadline };
}

export async function computeStress(today = new Date().toISOString().slice(0, 10)) {
  await mkdir(OUT, { recursive: true });
  const sealed = await stressSealed(today);
  const singles = await stressSingles(today);
  await writeFile(join(OUT, "sealed-stress.json"), JSON.stringify(sealed, null, 2));
  await writeFile(join(OUT, "singles-stress.json"), JSON.stringify(singles, null, 2));
  console.log(`stress sealed sufficient=${sealed.sufficient} median=${sealed.lines?.median ?? "n/a"} items=${sealed.universe?.items ?? 0}`);
  console.log(`stress singles sufficient=${singles.sufficient} median=${singles.lines?.median ?? "n/a"} items=${singles.universe?.items ?? 0}`);
  return { sealed, singles };
}

async function stressSealed(today) {
  const prices = await load("data/sealed-prices.json");
  const products = await load("data/sealed-products.json");
  const heat = await load("data/heat-history.json");
  const quarantine = new Set((await load("data/quarantine.json")).entries.map((e) => e.id));
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const p of prices.products || []) if (!byId.has(p.id)) byId.set(p.id, p);

  const headline = new Map();
  const collection = new Map();
  const dates = new Set();
  for (const row of heat) {
    if (!row?.id || !row.date || !(row.price > 0)) continue;
    if (quarantine.has(row.id) || WRONG_MATCH_IDS.has(row.id)) continue;
    if ((row.listingCount ?? 0) < 8) continue;
    const meta = byId.get(row.id);
    if (!meta || !eraOf(meta.setId)) continue;
    const type = sealedType(meta.subtype);
    const coll = collectionType(meta.subtype);
    if (!type && !coll) continue;
    const bucket = type ? headline : collection;
    if (!bucket.has(row.id)) {
      bucket.set(row.id, member(row.id, meta.name || row.id, type || coll, {}, !type));
    }
    bucket.get(row.id).prices[row.date] = row.price;
    dates.add(row.date);
  }
  const members = [...headline.values()];
  const extraMembers = [...collection.values()];
  const asOf = [...dates].sort().at(-1) || dayOf(prices.updatedAt);
  return buildStressReport({
    kind: "sealed",
    source: "eBay asking prices",
    sourceFile: "data/heat-history.json",
    asOf,
    today,
    dates: [...dates],
    members,
    extraMembers,
  });
}

async function stressSingles(today) {
  let file;
  try {
    file = await load("data/singles-prices.json");
  } catch (err) {
    return {
      kind: "single",
      sufficient: false,
      removalsApplied: 0,
      source: "TCGplayer market price",
      sourceFile: "data/singles-prices.json",
      insufficientReason: `singles-prices.json could not be read (${err.message}). No band was invented.`,
      trustBand: null,
      lines: null,
      weedOut: [],
      note: "Singles stress did not run. No price was invented.",
    };
  }
  const dates = new Set();
  const members = [];
  for (const card of file.cards || []) {
    const id = card.cardId || card.id;
    if (!id) continue;
    const prices = {};
    for (const row of card.priceHistory || []) {
      if (!row?.date || !(row.price > 0)) continue;
      prices[row.date] = row.price;
      dates.add(row.date);
    }
    if (!Object.keys(prices).length) continue;
    members.push(member(id, card.name || id, card.rarity || null, prices));
  }
  const asOf = [...dates].sort().at(-1) || dayOf(file.updatedAt);
  const report = buildStressReport({
    kind: "single",
    source: "TCGplayer market price",
    sourceFile: "data/singles-prices.json",
    asOf,
    today,
    dates: [...dates],
    members,
  });
  report.fileUpdatedAt = dayOf(file.updatedAt);
  report.note = [report.note, report.thin ? "Thin history: most cards have one or two observations, and the days between them are a gap." : null]
    .filter(Boolean)
    .join(" ");
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  computeStress().catch((err) => {
    console.error(`stress failed: ${err.message}`);
    process.exitCode = 1;
  });
}
