// Builds data/derived/rip-roi.json (dated Rip value estimates) and a private ranking.
// Uses data/pull-rates.json when present; skips sets with no citable rate source.
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openPrivate } from "./lib/private-store.mjs";
import {
  buildSetMaps, resolveSetSlug, buildSlots, bulkFloorForSet, rareSlotAvg,
  packsFor, productPacksOk, scoreProduct, bannedCopy, SIMS, BULK_CARDS_PER_PACK,
} from "./lib/rip-roi.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const J = async (p, d = null) => { try { return JSON.parse(await readFile(join(ROOT, p), "utf8")); } catch { return d; } };

const ALLOWED = new Set(["booster-pack", "booster-box", "booster-bundle", "etb", "pc-etb"]);

async function loadSinglesFromBuckets() {
  const dir = join(ROOT, "research/assets/public/buckets");
  const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith(".json"));
  const singles = [];
  let asOf = "";
  for (const f of files) {
    const rows = await J(`research/assets/public/buckets/${f}`, []);
    for (const r of rows || []) {
      if (r.kind === "sealed") continue;
      if (!(r.price > 0) || !r.setSlug) continue;
      if (r.asOf && r.asOf > asOf) asOf = String(r.asOf).slice(0, 10);
      singles.push({
        id: r.id,
        name: r.name || "",
        setSlug: r.setSlug,
        rarity: r.rarity || "",
        tags: r.tags || [],
        price: r.price,
        printing: r.printing || "",
      });
    }
  }
  return { singles, asOf };
}

function productPrice(catalogByPid, sealedPrices, product) {
  const pid = Number(product.tcgPlayerId);
  if (pid > 0) {
    const cat = catalogByPid.get(pid);
    if (cat && cat.price > 0) return { price: cat.price, asOf: String(cat.asOf || "").slice(0, 10), source: "TCGplayer market" };
  }
  const sp = (sealedPrices.products || []).find((p) => p.id === product.id);
  if (sp?.priceMedian > 0) return { price: sp.priceMedian, asOf: String(sp.asOf || sealedPrices.asOf || "").slice(0, 10), source: "sealed-prices median" };
  return null;
}

const pull = await J("data/pull-rates.json", null);
if (!pull?.rows?.length) {
  console.error("rip-roi: data/pull-rates.json missing or empty");
  process.exit(1);
}

const setsPub = await J("research/assets/public/sets.json", { sets: [] });
const products = await J("data/sealed-products.json", []);
const sealedPrices = await J("data/sealed-prices.json", { products: [] });
const catalog = await J("data/catalog/tcgcsv-latest.json", { items: [] });
const catalogByPid = new Map();
for (const item of catalog.items || []) {
  const pid = Number(item.tcgplayerProductId);
  if (pid > 0) catalogByPid.set(pid, item);
}

const { singles, asOf: bucketAsOf } = await loadSinglesFromBuckets();
const maps = buildSetMaps(setsPub, pull.rows);
const ratesBySlug = new Map();
for (const r of pull.rows) {
  if (!ratesBySlug.has(r.setSlug)) ratesBySlug.set(r.setSlug, []);
  ratesBySlug.get(r.setSlug).push(r);
}

const skippedSets = [...(pull.noSource || [])];
const skippedNoMatch = [];
const skippedNoPacks = [];
const skippedNoPrice = [];
const skippedNoSlots = [];
const rows = [];
const sourceSet = new Map();

for (const product of products) {
  if (!ALLOWED.has(product.subtype)) continue;
  if (!productPacksOk(product)) continue;
  const setSlug = resolveSetSlug(product, maps);
  if (!setSlug || !ratesBySlug.has(setSlug)) {
    if (setSlug && maps.pullSlugs && !ratesBySlug.has(setSlug)) {
      // set known but no rates — already in noSource or not filled
    }
    if (!setSlug) skippedNoMatch.push({ id: product.id, set: product.set, setId: product.setId, note: "could not map to a pull-rate setSlug" });
    continue;
  }
  const packs = packsFor(product);
  if (!packs) {
    skippedNoPacks.push({ id: product.id, name: product.name, subtype: product.subtype, note: "no fixed pack count" });
    continue;
  }
  const priced = productPrice(catalogByPid, sealedPrices, product);
  if (!priced) {
    skippedNoPrice.push({ id: product.id, name: product.name, note: "no market price" });
    continue;
  }
  const { slots, sources } = buildSlots(ratesBySlug.get(setSlug), singles, setSlug);
  if (!slots.length) {
    skippedNoSlots.push({ id: product.id, setSlug, note: "pull rows present but no priced rarity pool" });
    continue;
  }
  for (const s of sources) sourceSet.set(s.url, s);
  const bulk = bulkFloorForSet(singles, setSlug);
  if (!(bulk.perCard > 0)) {
    skippedNoSlots.push({ id: product.id, setSlug, note: "no Common/Uncommon prices for bulk floor" });
    continue;
  }
  const rare = rareSlotAvg(singles, setSlug);
  const scored = scoreProduct({
    product: { ...product, setSlug },
    price: priced.price,
    packs,
    slots,
    bulk,
    rare,
    promo: 0,
    seed: (product.id || "").split("").reduce((h, c) => ((h * 33) ^ c.charCodeAt(0)) >>> 0, 2166136261),
  });
  scored.priceAsOf = priced.asOf || bucketAsOf;
  scored.priceSource = priced.source;
  scored.label = "Rip value";
  scored.note = "History-based estimate from dated pull rates and TCGplayer market singles. Not a forecast.";
  if (bannedCopy(scored.note) || bannedCopy(scored.label)) throw new Error("banned copy in rip-roi row");
  rows.push(scored);
}

rows.sort((a, b) => (b.roiPct ?? -9999) - (a.roiPct ?? -9999) || (a.id < b.id ? -1 : 1));

const asOf = bucketAsOf || pull.updated || pull.sourceDate || new Date().toISOString().slice(0, 10);
const doc = {
  asOf,
  label: "Rip value",
  note: "Expected contents of opening a pack or sealed product, minus the product price. History-based estimates from dated pull rates and our singles prices. Not advice.",
  method: {
    pullRates: "data/pull-rates.json — a row is written only when the source states the rate, with its link and date.",
    singles: "research/assets/public/buckets — TCGplayer market on asOf.",
    bulkFloor: `Median Common and Uncommon in the set × ${BULK_CARDS_PER_PACK} cards per pack.`,
    rareSlot: "Median Rare / Holo Rare / Double Rare in the set × 1 rare slot per pack.",
    packs: "booster-pack=1, booster-bundle=6, booster-box=36, ETB=9 (SWSH=8), PC-ETB same as ETB.",
    monteCarlo: `${SIMS} sims; each published rarity rate is an independent draw at that slot's average price.`,
    promo: "Fixed promo/contents not yet in the sealed products file; promo=0 for this build.",
    copy: "Public label is Rip value. EV and ROI % are history-based estimates.",
  },
  pullRatesUpdated: pull.updated || pull.sourceDate,
  count: rows.length,
  skipped: {
    noSourceCount: pull.noSourceCount ?? skippedSets.length,
    noSource: skippedSets,
    noSetMap: skippedNoMatch.slice(0, 200),
    noPacks: skippedNoPacks.slice(0, 100),
    noPrice: skippedNoPrice.slice(0, 100),
    noSlots: skippedNoSlots.slice(0, 100),
  },
  sources: [...sourceSet.values()],
  ranking: rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    set: r.set,
    subtype: r.subtype,
    price: r.price,
    packs: r.packs,
    contentsEV: r.contentsEV,
    ev: r.ev,
    roiPct: r.roiPct,
    beatChance: r.beatChance,
    median: r.median,
  })),
  rows,
};

await mkdir(join(ROOT, "data/derived"), { recursive: true });
await writeFile(join(ROOT, "data/derived/rip-roi.json"), JSON.stringify(doc, null, 1) + "\n");

// Private ranking (full detail) — local data/private or catchem-data-private when token set.
const token = process.env.PRIVATE_DATA_TOKEN || "";
const store = await openPrivate({ root: ROOT, token });
await mkdir(join(store.dir, "rip-roi"), { recursive: true });
const privateDoc = {
  asOf,
  label: "Rip value (private ranking)",
  note: doc.note,
  top15: rows.slice(0, 15),
  bottom10: rows.slice(-10).reverse(),
  all: rows,
  skipped: doc.skipped,
  sources: doc.sources,
};
await writeFile(join(store.dir, "rip-roi", `${asOf}.json`), JSON.stringify(privateDoc, null, 1) + "\n");
await writeFile(join(store.dir, "rip-roi", "latest.json"), JSON.stringify(privateDoc, null, 1) + "\n");
const pushed = await store.close([`rip-roi/${asOf}.json`, "rip-roi/latest.json"], `rip-roi ${asOf}: ${rows.length} products`);

const top15 = rows.slice(0, 15).map((r) => `${r.id} roi=${r.roiPct}% ev=${r.ev}`);
const bottom10 = rows.slice(-10).reverse().map((r) => `${r.id} roi=${r.roiPct}% ev=${r.ev}`);
console.log(JSON.stringify({
  ripRoi: {
    asOf,
    count: rows.length,
    skippedNoSource: pull.noSourceCount,
    privatePushed: Boolean(pushed?.pushed),
    privateReason: pushed?.reason || null,
    top15,
    bottom10,
  },
}, null, 1));
