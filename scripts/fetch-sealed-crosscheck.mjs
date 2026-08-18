// scripts/fetch-sealed-crosscheck.mjs — "The Spread" data source
// Fetches TCGplayer-derived sealed prices from PokemonPriceTracker for every
// SKU in data/crosscheck-id-map.json (reviewed entries only) and writes the
// divergence-engine contract:
//   data/sealed-crosscheck.json    { updatedAt, source, products: [{ id,
//       tcgMarket, tcgListings, providerUpdatedAt, dataStatus }] }
//   data/crosscheck-history.json   append { date, id, tcgListings, tcgMarket }
//
// Built 2026-08-18 against REAL response shapes (research/eval-samples/
// ppt-sealed-RAW.json) per the eval decision rule — not from docs.
// Provider facts that shaped this code (probe 2026-08-18):
//  - sealed products expose a single `unopenedPrice` (no market/low split)
//    → contract's tcgMarket = unopenedPrice.
//  - sealed products expose NO listings/sellers counts (cards-only fields)
//    → tcgListings is null, honestly; Supply Watch's TCG side stays empty
//    until a provider with sealed counts exists.
//  - credits bill per PRODUCT RETURNED (metadata.apiCallsConsumed) → fetch
//    by tcgPlayerId, 1 credit/SKU/day (~70/day vs 20k/day tier budget).
//  - `updatedAt` per product is the freshness signal (STALE_DAYS gate).
// Requires: POKEMONPRICETRACKER_API_KEY env (GitHub secret in Actions; local
// runs receive it via Tyler's shell — never committed, never logged).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const DATA = join(dirname(dirname(fileURLToPath(import.meta.url))), "data");
const BASE = "https://www.pokemonpricetracker.com/api/v2";
const KEY = process.env.POKEMONPRICETRACKER_API_KEY;
if (!KEY) { console.error("Missing POKEMONPRICETRACKER_API_KEY"); process.exit(1); }
const H = { Authorization: `Bearer ${KEY}` };
const STALE_DAYS = 3;
const HISTORY_DAYS = 120;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = new Date().toISOString().split("T")[0];

async function getJSON(url) {
  let lastErr;
  for (let a = 0; a <= 3; a++) {
    if (a > 0) await sleep([2000, 8000, 20000][a - 1]);
    try {
      const res = await fetch(url, { headers: H });
      if (res.ok) return res.json();
      lastErr = new Error(`${res.status}`);
      if (res.status < 500 && res.status !== 429) throw lastErr;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// Fetch one mapped product. Primary: tcgPlayerId param (mirrors the /cards
// pattern; UNVERIFIED on /sealed-products until first real run — falls back
// to a name search filtered client-side by tcgPlayerId, which the probe DID
// verify).
async function fetchProduct(entry) {
  try {
    const d = await getJSON(`${BASE}/sealed-products?tcgPlayerId=${encodeURIComponent(entry.tcgPlayerId)}&limit=2`);
    const hit = (d.data || []).find(p => String(p.tcgPlayerId) === String(entry.tcgPlayerId));
    if (hit) return hit;
  } catch { /* fall through to search */ }
  const d = await getJSON(`${BASE}/sealed-products?search=${encodeURIComponent(entry.matchedName)}&limit=5`);
  return (d.data || []).find(p => String(p.tcgPlayerId) === String(entry.tcgPlayerId)) || null;
}

async function main() {
  const map = JSON.parse(await readFile(join(DATA, "crosscheck-id-map.json"), "utf-8"));
  // Reviewed gate: only rows Tyler has not excluded. Low-confidence rows must
  // carry reviewed:true (set during map review) before the fetch touches them.
  const entries = map.entries.filter(e =>
    e.tcgPlayerId && (e.matchConfidence !== "low" || e.reviewed === true) && e.exclude !== true);
  console.log(`crosscheck: ${entries.length} mapped SKUs (of ${map.entries.length} in map)`);

  let history = [];
  try { history = JSON.parse(await readFile(join(DATA, "crosscheck-history.json"), "utf-8")); } catch {}

  const products = [];
  for (const e of entries) {
    await sleep(1100); // 60/min limit
    try {
      const p = await fetchProduct(e);
      if (!p || p.unopenedPrice == null) {
        products.push({ id: e.id, tcgMarket: null, tcgListings: null, providerUpdatedAt: p?.updatedAt || null, dataStatus: "unavailable" });
        continue;
      }
      const ageDays = p.updatedAt ? (Date.now() - new Date(p.updatedAt)) / 86400000 : Infinity;
      const dataStatus = ageDays <= STALE_DAYS ? "live" : "stale";
      products.push({ id: e.id, tcgMarket: p.unopenedPrice, tcgListings: null, providerUpdatedAt: p.updatedAt || null, dataStatus });
      if (dataStatus === "live") {
        history = history.filter(h => !(h.date === today && h.id === e.id));
        history.push({ date: today, id: e.id, tcgListings: null, tcgMarket: p.unopenedPrice });
      }
      console.log(`  ${e.id.padEnd(26)} $${String(p.unopenedPrice).padStart(9)}  ${dataStatus}`);
    } catch (err) {
      products.push({ id: e.id, tcgMarket: null, tcgListings: null, providerUpdatedAt: null, dataStatus: "error" });
      console.warn(`  ${e.id}: ${err.message}`);
    }
  }

  const cutoff = new Date(Date.now() - HISTORY_DAYS * 86400000).toISOString().split("T")[0];
  history = history.filter(h => h.date >= cutoff);

  await writeFile(join(DATA, "sealed-crosscheck.json"), JSON.stringify({
    updatedAt: new Date().toISOString(),
    source: "pokemonpricetracker.com v2 sealed-products (TCGplayer-derived unopenedPrice)",
    note: "tcgListings is null by provider limitation (sealed endpoint has no supply counts); The Spread consumes tcgMarket.",
    products,
  }, null, 2) + "\n");
  await writeFile(join(DATA, "crosscheck-history.json"), JSON.stringify(history) + "\n");
  const live = products.filter(p => p.dataStatus === "live").length;
  console.log(`✓ sealed-crosscheck.json: ${live} live / ${products.length}; history rows: ${history.length}`);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
