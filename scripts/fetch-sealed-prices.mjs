// ─────────────────────────────────────────────────────────────────────────────
// Catch'em sealed-price fetcher
// ─────────────────────────────────────────────────────────────────────────────
// Queries eBay Browse API for each product in data/sealed-products.json,
// aggregates active listing prices, and writes data/sealed-prices.json.
//
// Runs via GitHub Actions on a daily schedule. No third-party deps — uses
// Node 20+ built-in fetch. eBay Browse API is free for developers and
// permits commercial use.
//
// Required env vars (set as GitHub repo secrets):
//   EBAY_APP_ID   — your eBay developer App ID (Client ID)
//   EBAY_CERT_ID  — your eBay developer Cert ID (Client Secret)
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const PRODUCTS_FILE = join(DATA_DIR, "sealed-products.json");
const OUTPUT_FILE = join(DATA_DIR, "sealed-prices.json");

// ─── Config ──────────────────────────────────────────────────────────────────
const EBAY_OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_SEARCH_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search";
const EBAY_TCG_CATEGORY = "2536"; // Collectible Card Games & Accessories
const CONDITION_NEW = "1000";
const MARKETPLACE = "EBAY_US";
const HISTORY_DAYS = 90;
const CONCURRENCY = 4;          // Parallel queries (eBay rate-limits aggressive bursts)
const QUERY_DELAY_MS = 300;     // Pacing between queries per worker
const MIN_PRICE = 5;            // Filter out absurd lowballs / parts listings
const MAX_PRICE = 10000;
const TRIM_PCT = 0.10;          // Trim top/bottom 10% as outliers before median

// ─── eBay OAuth (client_credentials grant) ───────────────────────────────────
async function getEbayToken() {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) {
    throw new Error("Missing EBAY_APP_ID or EBAY_CERT_ID env vars");
  }
  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res = await fetch(EBAY_OAUTH_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

// ─── eBay search ─────────────────────────────────────────────────────────────
async function searchEbay(token, query) {
  const params = new URLSearchParams({
    q: query,
    category_ids: EBAY_TCG_CATEGORY,
    filter: `conditionIds:{${CONDITION_NEW}},priceCurrency:USD,price:[${MIN_PRICE}..${MAX_PRICE}]`,
    limit: "50",
    sort: "price",
  });
  const res = await fetch(`${EBAY_SEARCH_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
    },
  });
  if (!res.ok) {
    console.warn(`  search failed (${res.status}) for: ${query}`);
    return [];
  }
  const data = await res.json();
  return data.itemSummaries || [];
}

// ─── Aggregate prices with outlier trimming ──────────────────────────────────
function aggregatePrices(items) {
  const prices = items
    .map(i => parseFloat(i.price?.value))
    .filter(p => !isNaN(p) && p >= MIN_PRICE && p <= MAX_PRICE)
    .sort((a, b) => a - b);
  if (prices.length < 3) return null; // Need a few listings for trust
  const trim = Math.floor(prices.length * TRIM_PCT);
  const trimmed = prices.slice(trim, prices.length - trim);
  const median = trimmed[Math.floor(trimmed.length / 2)];
  const round = n => Math.round(n * 100) / 100;
  return {
    priceUsd: round(median),
    priceMedian: round(median),
    priceLow: round(prices[0]),
    priceHigh: round(prices[prices.length - 1]),
    listingCount: prices.length,
  };
}

// ─── Concurrent runner with pacing ───────────────────────────────────────────
async function mapConcurrent(items, fn, concurrency) {
  const queue = [...items];
  const results = new Array(items.length);
  const indexMap = new Map(items.map((it, i) => [it, i]));
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift();
      await new Promise(r => setTimeout(r, QUERY_DELAY_MS));
      results[indexMap.get(item)] = await fn(item);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("📦 Loading product list...");
  const products = JSON.parse(await readFile(PRODUCTS_FILE, "utf-8"));
  console.log(`   → ${products.length} products to refresh.`);

  console.log("📜 Loading previous prices (for history continuity)...");
  const previous = {};
  try {
    const prev = JSON.parse(await readFile(OUTPUT_FILE, "utf-8"));
    prev.products?.forEach(p => { previous[p.id] = p; });
    console.log(`   → ${Object.keys(previous).length} previous entries loaded.`);
  } catch {
    console.log("   → no previous file (first run).");
  }

  console.log("🔑 Authenticating with eBay...");
  const token = await getEbayToken();
  console.log("   → ✓ token acquired.");

  console.log(`🔍 Fetching prices (concurrency=${CONCURRENCY})...`);
  const today = new Date().toISOString().split("T")[0];
  const startTs = Date.now();

  const updated = await mapConcurrent(products, async (product) => {
    try {
      const items = await searchEbay(token, product.searchQuery);
      const agg = aggregatePrices(items);
      const prev = previous[product.id];
      const history = prev?.priceHistory ? [...prev.priceHistory] : [];

      if (agg) {
        // Replace today's entry if already present (idempotent within a day),
        // otherwise append. Trim to HISTORY_DAYS.
        const lastIdx = history.length - 1;
        if (lastIdx >= 0 && history[lastIdx].date === today) {
          history[lastIdx] = { date: today, price: agg.priceMedian };
        } else {
          history.push({ date: today, price: agg.priceMedian });
        }
        while (history.length > HISTORY_DAYS) history.shift();
      }

      return {
        ...product,
        ...(agg || {
          // fall back to previous known prices if today's fetch returned nothing
          priceUsd: prev?.priceUsd,
          priceMedian: prev?.priceMedian,
          priceLow: prev?.priceLow,
          priceHigh: prev?.priceHigh,
          listingCount: 0,
        }),
        priceHistory: history,
        dataStatus: agg ? "live" : prev?.priceUsd ? "stale" : "unavailable",
        lastSeen: agg ? today : prev?.lastSeen,
      };
    } catch (e) {
      console.error(`   ✗ ${product.name}: ${e.message}`);
      return {
        ...product,
        ...(previous[product.id] || {}),
        dataStatus: "error",
      };
    }
  }, CONCURRENCY);

  const live = updated.filter(p => p.dataStatus === "live").length;
  const stale = updated.filter(p => p.dataStatus === "stale").length;
  const missing = updated.filter(p => p.dataStatus === "unavailable" || p.dataStatus === "error").length;
  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   live:   ${live}`);
  console.log(`   stale:  ${stale}`);
  console.log(`   miss:   ${missing}`);

  const output = {
    updatedAt: new Date().toISOString(),
    source: "ebay-browse-api",
    marketplace: MARKETPLACE,
    productCount: updated.length,
    liveCount: live,
    products: updated,
  };

  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2) + "\n");
  console.log(`💾 Wrote ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
