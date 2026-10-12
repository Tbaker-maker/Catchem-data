// Writes research/assets/public/feed/sealed-rating.json. Runs after the Card Rating file.
// A failed build keeps the last file and does not fail the step.
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sealedShard, SHARDS, buildSealedRatings, sealedReads, waitingFactors, MIN_PEERS, MIN_TREND_DAYS, MIN_LISTING_NIGHTS } from "./lib/sealed-rating.mjs";

try {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  const PUB = join(ROOT, "research/assets/public");
  const J = async (p, d = null) => { try { return JSON.parse(await readFile(p, "utf-8")); } catch { return d; } };
  const rows = [];
  for (const f of (await readdir(join(PUB, "buckets"))).filter((f) => f.endsWith(".json"))) rows.push(...(await J(join(PUB, "buckets", f), [])));
  const rot = await J(join(PUB, "rotation-status.json"));
  const products = (await J(join(ROOT, "data/sealed-products.json"), [])) || [];
  const skuToPid = new Map(products.filter((p) => p.tcgPlayerId).map((p) => [p.id, `tcgcsv-${p.tcgPlayerId}`]));
  const packs = new Map(products.filter((p) => p.tcgPlayerId && Number(p.packs) > 0).map((p) => [`tcgcsv-${p.tcgPlayerId}`, Number(p.packs)]));
  const counted = await J(join(PUB, "listings-counted.json"), {});
  const nights = (await readdir(join(ROOT, "data/raw/ebay-sealed")).catch(() => [])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json\.gz$/.test(f)).length;
  const listings = new Map();
  for (const p of counted?.products || []) { const pid = skuToPid.get(p.id); if (pid && p.listingsCounted?.n != null) listings.set(pid, { ...p.listingsCounted, sku: p.id, nights }); }
  const today = rows.map((r) => r.asOf).filter(Boolean).sort().pop()?.slice(0, 10);
  const list = buildSealedRatings({ rows, rot, listings, packs, today });
  const reads = sealedReads(list, { asOf: today });
  const types = {};
  for (const r of list) types[r.type] = (types[r.type] || 0) + 1;
  const doc = {
    asOf: today,
    note: "Sealed Rating: factual position data for each sealed product against products of the same type. Not advice. Factor values are 0 to 1, the share of same-type products below this one.",
    rules: { minPeers: MIN_PEERS, minTrendNights: MIN_TREND_DAYS, minListingNights: MIN_LISTING_NIGHTS, topCard: "Highest-priced single in the set on the same day, TCGplayer market. Sets with fewer than 10 priced singles are left out.", stage: "Official rotation dates (rotation-status.json) and era release dates. Tins and collections are flagged because they can be made after a set's main print run." },
    waiting: waitingFactors(nights),
    method: "Doc: Catch'em Sealed Rating, research and design (Google Drive).",
    count: list.length, types, reads, shards: `feed/sealed-rating/NN.json, NN = numeric product id mod ${SHARDS}`,
  };
  await mkdir(join(PUB, "feed/sealed-rating"), { recursive: true });
  const shards = new Map();
  for (const r of list) { const k = sealedShard(r.id); if (!shards.has(k)) shards.set(k, {}); shards.get(k)[r.id] = r; }
  for (let i = 0; i < SHARDS; i++) { const k = String(i).padStart(2, "0"); await writeFile(join(PUB, `feed/sealed-rating/${k}.json`), JSON.stringify({ asOf: today, rows: shards.get(k) || {} }) + "\n"); }
  await writeFile(join(PUB, "feed/sealed-rating.json"), JSON.stringify(doc) + "\n");
  console.log(`sealed-rating: ${list.length} rows, ${reads.length} reads as of ${today}`, types);
} catch (err) {
  console.error(`sealed-rating: kept the last file, ${err?.message || err}`);
}
