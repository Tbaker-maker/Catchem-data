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

// ─── Per-subtype price bounds (Aug 2026 fix) ─────────────────────────────────
// Replaces reliance on the global $5 floor, which let single packs poison
// booster-box medians (the Journey Together bug). Per-SKU overrides in
// sealed-products.json (priceFloor / priceCeiling fields) WIN over these.
const SUBTYPE_PRICE_BOUNDS = {
  "booster-box":        [80, 800],
  "etb":                [30, 400],
  "pc-etb":             [50, 800],
  "booster-bundle":     [15, 100],
  "premium-collection": [25, 300],
  "upc":                [80, 1500],
  "tin":                [15, 150],
  "collection-box":     [20, 200],
  // pricing v2 (2026-08-18, Tyler-caught): class had NO bounds — failPrice was
  // structurally 0. Evidence: real BIN cluster $85-120 on sv8pt5-sc.
  "special-collection": [50, 600], // widened Aug-20: Eevee Evolutions Premium (~$275+ USD) joined the class
  "build-and-battle":   [15, 100],
  // loose-pack lane (research/loose-pack-skus-spec.md, 2026-08-18): powers
  // sealedPremiumPct — productPerPack vs the street price of one loose pack
  "booster-pack":       [2.5, 75],
};

function priceBoundsFor(product) {
  // Vintage SKUs (WOTC/early-era boxes) trade far above modern subtype
  // ceilings — an $800 booster-box cap excludes every genuine Base Set box
  // before fetch. They get the global window unless per-SKU overrides say more.
  const def = product.vintage
    ? [MIN_PRICE, MAX_PRICE]
    : SUBTYPE_PRICE_BOUNDS[product.subtype] || [MIN_PRICE, MAX_PRICE];
  return [
    product.priceFloor  != null ? product.priceFloor  : def[0],
    product.priceCeiling != null ? product.priceCeiling : def[1],
  ];
}

// ─── Post-fetch title filtering (Aug 2026 fix) ───────────────────────────────
// eBay Browse API does not reliably support -keyword exclusions in `q`
// (that syntax was only documented for the decommissioned Finding API), so
// ALL disambiguation happens here, on item titles, after fetch.
//
// REQUIRE: title must contain the set name AND a product-type phrase.
// REJECT:  title contains an exclusion term for the subtype.
// SAFETY:  never apply an exclusion whose words appear in the set name itself
//          (prevents the "Battle Styles" vs -battle self-contradiction).
// Single-word terms use word-boundary matching so e.g. "tin" cannot match
// the "tin" inside "Destined Rivals". Multi-word phrases use substring match.

const REQUIRE_PHRASES = {
  "booster-box":        ["booster box"],
  "etb":                ["elite trainer box", "etb"],
  "pc-etb":             ["elite trainer box", "etb"],
  // "booster bundle" only — bare "bundle" let weighed-pack lots and multi-set
  // pack bundles satisfy the type gate (151 spot check, 2026-08-18)
  "booster-bundle":     ["booster bundle"],
  "premium-collection": ["premium collection"],
  "upc":                ["ultra premium", "ultra-premium"],
  "tin":                ["tin"],
  "collection-box":     ["collection"],
  "build-and-battle":   ["build & battle", "build and battle"],
  "booster-pack":       ["booster pack"],
};

// Per-subtype UN-exclusions (2026-08-18, loose-pack lane): terms that are
// junk-markers everywhere else but legitimate here. "single" tags a lone
// sealed pack honestly — the whole point of this subtype.
const SUBTYPE_UNEXCLUDE = {
  "booster-pack": ["single", "1 pack", "single pack"],
};

const EXCLUDE_COMMON = [
  "single", "loose", "lot", "empty", "opened", "damaged", "custom",
  "repack", "proxy", "no packs", "resale", "read description",
  // damaged-but-listed-sealed (spot check 2026-08-18: "2 Tears", "Sealed
  // Ripped", "SMALL PUNCTURE" all passed and dragged priceLow)
  "ripped", "torn", "tear", "tears", "puncture", "punctured", "crushed",
  "dented", "dent", "see description",
  // resealed-box fraud — endemic in vintage listings; "resale" (already
  // excluded) does not word-boundary-match "resealed" (added 2026-08-18
  // with vintage SKU bounds work)
  "resealed", "reseal",
  // weighed packs + accessory-only listings sold under product names
  "heavy", "3d printed", "case only", "no cards",
  // 2026-08-18 first 70-SKU production audit:
  // multi-lot tokens generalized from booster-box-only — "Bundle x2. 12 Packs"
  // $142.99 kept in me2-bb, "2x Factory Sealed" $229.99 kept in me3-pc-etb
  "2x", "3x", "4x", "6x", "x2", "x3", "x4", "x6",
  // larger lot tokens (2026-08-18 loose-pack validation: "x20 Unsearched" $50 passed)
  "x10", "x12", "x20", "x36", "10x", "12x", "20x", "36x",
  // damage variants the singular terms missed — "Small rips or dents" (me5-etb),
  // "Box Damage" (me4-pc-etb), "Box is Worn" (me2pt5-etb), "(Distressed Box)" (me5-bb)
  "dents", "rips", "worn", "damage", "distressed",
  // mystery-box gambles and accessory sleeves sold under set names —
  // sv3pt5-etb kept ONLY junk: 3x "Mystery ETB ... 151 Or More", outer sleeves
  "mystery", "outer sleeve", "card sleeves",
  // Batch 1 PC-ETB validation 2026-08-18: "(Set of 2)" pairs at \$394-399 in
  // swsh6-pc-etb, "SEALED SET" BB+WF combo at \$540 in zsv10pt5-bb-pc-etb,
  // and misprint-"Error" variant boxes at \$210-240 (distinct collectible
  // product, different market)
  "set of", "sealed set", "error",
];

// Non-English printings. JP/KR/CN boxes are a DIFFERENT product at a different
// price point — e.g. Japanese "Battle Partners" is the SV9 counterpart to
// English Journey Together and runs ~$100 vs ~$150-200 for the English box.
// Set "allowImports": true on a SKU in sealed-products.json to track them anyway.
// Subject to the same set-name safety rule as every other exclusion.
const EXCLUDE_NON_ENGLISH = [
  "japanese", "japan", "jpn", "korean", "korea", "chinese", "china",
  "taiwanese", "traditional chinese", "simplified chinese",
  // European printings (2026-08-18 Mega-era validation: "(Spanish)" AH ETB at
  // $148 and a $49.99 Spanish bundle passed and dragged priceLow — English-only
  // policy covers ALL non-English printings, not just Asian ones)
  "spanish", "german", "french", "italian", "portuguese",
  // bare "jp" (2026-08-18 loose-pack validation: "JP Sealed Random Pack x20" passed — jpn/japanese did not match)
  "jp",
];

const EXCLUDE_BY_SUBTYPE = {
  "booster-box": [
    "etb", "elite trainer", "bundle", "blister", "mini tin",
    "build & battle", "build and battle", "1 pack", "single pack",
    "2 pack", "3 pack", "collection box", "sleeved booster",
    // multi-box lots masquerading as one box ("6 Booster Boxes", "2 Box Lot").
    // NOT "case": legit singles ship "with plastic case".
    "booster boxes", "box lot", "2 box", "3 box", "4 box", "6 box",
    // "18x Packs 1/2 Half Booster Box" $175 passed 2026-08-18 Mega validation
    // (2x/3x/4x/6x multi-lot tokens moved to EXCLUDE_COMMON same day)
    "half booster", "1/2",
    // NOT excluded: "enhanced" — the Enhanced Booster Box is a variant of the
    // same JT booster box (box-topper promo; only ME-01 and JT have this in
    // modern — Tyler, 2026-08-17). Both variants price into the same SKU.
    // pre-release kits & connector-less "Build Battle" phrasing that slips the
    // "build & battle"/"build and battle" exclusions
    "build battle", "pre-release", "pre release", "prerelease",
  ],
  // "pokemon center": PC-exclusive listings kept polluting regular-ETB medians
  // (2026-08-18 audit: $127.99 "ETB Pokemon Center Exclusive" kept in me5-etb,
  // keyword-stuffed PC listing kept in sv3pt5-etb). The pc-etb subtype REQUIRES
  // the phrase, so the two SKU families are now disjoint.
  "etb":            ["booster box", "bundle", "blister", "36 pack", "mini tin", "pokemon center"],
  // loose-pack spec vocab (2026-08-18): weighed-pack scams + multi-pack and
  // container terms; "packs" PLURAL is the load-bearing one (a single pack
  // listing says "pack"); "art" excludes display/pack-art collectible sets
  "booster-pack":   ["weighed", "packs", "bundle", "box", "art", "etb", "elite trainer", "blister", "sleeved",
    // graded slabbed packs are a collectible market, not street price (2026-08-18: "PSA 8 NM-MINT ... SEALED Booster Pack" $49.99 passed)
    "psa", "cgc", "bgs", "graded", "unsearched",
    // promo-blister leakage (2026-08-19 swsh5 investigation): blister products
    // titled without "blister" — "Charmander Promo English" $50, "3 Booster
    // Pack Jolteon SWSH094 Black Star Promo" $49.99, "Arrokuda Promo Card &
    // Coin" $19.97 all KEPT in swsh5-pack; swsh6's median item was a
    // Moltres/Reshiram-promos+coin blister. Promo/coin/album mark a bundled
    // collectible product, never a loose street pack. Digit multi-pack forms
    // ("3 booster pack") slip the x2/2x lot tokens.
    "promo", "promos", "coin", "coins", "album",
    "2 booster", "3 booster", "4 booster", "6 booster", "10 booster"],
  "pc-etb":         ["booster box", "bundle", "blister", "36 pack", "mini tin"],
  "booster-bundle": ["booster box", "etb", "elite trainer", "36 pack"],
  "premium-collection": ["booster box", "etb", "elite trainer"],
  "upc":            ["booster box"],
  // tin extras 2026-08-18 (Aug-28 tin validation): mini-tins are a distinct
  // product; multi-tin lots ("5-Pack", "1 of each", "x 3") masqueraded as one
  "tin":            ["booster box", "etb", "elite trainer", "mini tin", "mini tins", "1 of each", "of each", "all 3", "all three", "x 3", "5-pack", "5 pack"],
  "collection-box": ["booster box", "etb", "elite trainer"],
  "build-and-battle": ["booster box", "etb", "elite trainer"],
};

function wordBoundaryTest(term, titleLower) {
  if (term.includes(" ") || term.includes("&") || term.includes("-")) {
    return titleLower.includes(term); // phrase → substring
  }
  return new RegExp(`\\b${term}\\b`, "i").test(titleLower); // word → boundary
}

// Delivered price — pricing v2 (2026-08-18): item price + cheapest shipping
// option, so free-ship and +ship listings are comparable (median = landed
// cost). Missing shipping data → item price alone, counted in shipUnknownCount
// (transparency, not silent).
function deliveredPriceOf(item) {
  if (item?.price?.currency && item.price.currency !== "USD") return null; // currency guard (RT: USD-native law)
  const base = parseFloat(item.price?.value);
  if (isNaN(base)) return { delivered: NaN, shipKnown: false };
  const costs = (item.shippingOptions || [])
    .map(o => parseFloat(o.shippingCost?.value))
    .filter(v => !isNaN(v));
  if (!costs.length) return { delivered: base, shipKnown: false };
  return { delivered: base + Math.min(...costs), shipKnown: true };
}

function filterItemsForProduct(product, items) {
  const titleLowerOf = i => (i.title || "").toLowerCase();
  const setLower = (product.set || "").toLowerCase();
  const setWords = new Set(setLower.split(/\s+/).filter(Boolean));
  const requires = REQUIRE_PHRASES[product.subtype] || [];
  // set-name safety: drop exclusions sharing a word with the set name
  const setSafe = term =>
    !term.split(/[\s&-]+/).some(w => w && setWords.has(w));
  const excludes = [
    ...EXCLUDE_COMMON,
    ...(EXCLUDE_BY_SUBTYPE[product.subtype] || []),
    // Per-SKU extras (2026-08-18, Mega-era import): excludeExtra disambiguates
    // SKUs the subtype lists can't — me1's set name "Mega Evolution" appears in
    // sibling-set titles, Unlimited vintage SKUs must reject "1st edition",
    // and me1-booster-box must reject its Enhanced variant (own SKU per Tyler).
    ...(product.excludeExtra || []),
  ].filter(setSafe)
   .filter(t => !(SUBTYPE_UNEXCLUDE[product.subtype] || []).includes(t));
  // requireExtra: ALL listed phrases must appear in the title (e.g. the
  // me1-enhanced-booster-box SKU requires "enhanced"). Counted as failType.
  const requireExtra = product.requireExtra || [];
  const langExcludes = (product.allowImports ? [] : EXCLUDE_NON_ENGLISH).filter(setSafe);

  const report = { fetched: items.length, failSet: 0, failType: 0, failExclude: 0, failLang: 0, failPrice: 0, shipUnknown: 0, kept: 0 };
  const [floor, ceiling] = priceBoundsFor(product);

  const kept = items.filter(i => {
    const t = titleLowerOf(i);
    if (setLower && !t.includes(setLower)) { report.failSet++; return false; }
    if (requires.length && !requires.some(r => t.includes(r))) { report.failType++; return false; }
    if (requireExtra.length && !requireExtra.every(r => t.includes(r.toLowerCase()))) { report.failType++; return false; }
    if (product.subtype === "pc-etb" && !t.includes("pokemon center")) { report.failType++; return false; }
    if (excludes.some(term => wordBoundaryTest(term, t))) { report.failExclude++; return false; }
    if (langExcludes.some(term => wordBoundaryTest(term, t))) { report.failLang++; return false; }
    // pricing v2: gate + aggregate on DELIVERED price (landed cost)
    const dp = deliveredPriceOf(i);
    if (!dp.shipKnown) report.shipUnknown++;
    if (isNaN(dp.delivered) || dp.delivered < floor || dp.delivered > ceiling) { report.failPrice++; return false; }
    i._delivered = dp.delivered;
    return true;
  });
  report.kept = kept.length;
  return { kept, report, floor, ceiling };
}


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
// Paginated: up to SEARCH_PAGES pages of 50. One page under-samples strict
// SKUs — e.g. excluding the "Enhanced" JT variant left ~6 regular boxes in a
// single page, tripping the low-result guard. ~3x call volume (≤144/day for
// 48 SKUs) is well inside Browse API free-tier limits.
const SEARCH_PAGES = 3;

async function searchEbay(token, query, floor = MIN_PRICE, ceiling = MAX_PRICE) {
  const all = [];
  for (let page = 0; page < SEARCH_PAGES; page++) {
    const params = new URLSearchParams({
      q: query,
      category_ids: EBAY_TCG_CATEGORY,
      // buyingOptions:{FIXED_PRICE} — pricing v2 (2026-08-18): auctions were
      // polluting an ASK median (sv8pt5-sc priceLow $7 was a live bid).
      filter: `buyingOptions:{FIXED_PRICE},conditionIds:{${CONDITION_NEW}},priceCurrency:USD,price:[${floor}..${ceiling}]`,
      limit: "50",
      offset: String(page * 50),
      // NOTE: deliberately NOT sorted by price. With sort=price the API returns
      // the 50 CHEAPEST matches above the floor, so real English booster boxes
      // ($150-200) fell outside the window entirely and only cheap imports were
      // ever fetched. Default relevance ordering surfaces actual matches.
    });
    const res = await fetch(`${EBAY_SEARCH_URL}?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": MARKETPLACE,
      },
    });
    if (!res.ok) {
      console.warn(`  search failed (${res.status}) page ${page + 1} for: ${query}`);
      break;
    }
    const data = await res.json();
    const batch = data.itemSummaries || [];
    all.push(...batch);
    if (batch.length < 50) break; // last page
    await new Promise(r => setTimeout(r, QUERY_DELAY_MS));
  }
  return all;
}

// ─── Aggregate prices with outlier trimming ──────────────────────────────────
function aggregatePrices(items, floor = MIN_PRICE, ceiling = MAX_PRICE) {
  // pricing v2: delivered BIN prices (stamped by the filter); fall back to
  // item price only for direct calls that skipped filtering.
  const prices = items
    .map(i => i._delivered ?? parseFloat(i.price?.value))
    .filter(p => !isNaN(p) && p >= floor && p <= ceiling)
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
    // v2 user-facing pair: "median $X · cheapest clean $Y" — explicit name so
    // consumers never conflate median with floor (Tyler-caught gotcha)
    priceFloorClean: round(prices[0]),
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
      const [floor, ceiling] = priceBoundsFor(product);
      const items = await searchEbay(token, product.searchQuery, floor, ceiling);
      const { kept, report } = filterItemsForProduct(product, items);
      console.log(
        `   ${product.id}: fetched=${report.fetched} kept=${report.kept} ` +
        `(set:${report.failSet} type:${report.failType} excl:${report.failExclude} lang:${report.failLang} price:${report.failPrice})`
      );

      const prev = previous[product.id];

      // No-active-market (Tyler ruling 2026-08-18, option b): SKUs flagged
      // activeMarketThin (vintage boxes) publish honest nulls when <3 genuine
      // listings survive filtering — validated 2026-08-18: zero genuine
      // Unlimited boxes were live; the window held only $1-4k single packs,
      // decks, and graded items. Checked BEFORE the query_error guard, which
      // would otherwise re-publish contaminated pre-fix prices forever.
      // priceHistory is preserved untouched.
      if (product.activeMarketThin && kept.length < 3) {
        console.log(`   ○ ${product.id}: no-active-market (kept ${kept.length})`);
        return {
          ...product,
          priceUsd: null, priceMedian: null, priceLow: null, priceHigh: null,
          listingCount: kept.length,
          priceHistory: prev?.priceHistory || [],
          dataStatus: "no-active-market",
          lastSeen: prev?.lastSeen,
          filterReport: report,
        };
      }

      // Zero/low-result safety: if this SKU previously had healthy listings
      // but filtering now leaves almost nothing, treat it as a QUERY problem,
      // not a market signal. Keep previous prices; do not write history.
      // Threshold 8, not 3: aggregatePrices publishes at exactly 3 kept, and a
      // bad query can leave exactly 3 wrong-product survivors (observed Aug 17:
      // 3 JP/CN import boxes would have published $110 as a clean "live" price).
      // A healthy SKU dropping below 8 kept is a query problem until proven otherwise.
      if ((prev?.listingCount ?? 0) >= 10 && kept.length < 8) {
        console.warn(`   ⚠ ${product.id}: query_error (had ${prev.listingCount}, kept ${kept.length})`);
        return {
          ...product,
          priceUsd: prev?.priceUsd,
          priceMedian: prev?.priceMedian,
          priceLow: prev?.priceLow,
          priceHigh: prev?.priceHigh,
          listingCount: prev?.listingCount ?? 0,
          priceHistory: prev?.priceHistory || [],
          dataStatus: "query_error",
          lastSeen: prev?.lastSeen,
          filterReport: report,
        };
      }

      const agg = aggregatePrices(kept, floor, ceiling);
      // representativeImage (research/fetch-images-spec.md, 2026-08-18): the
      // kept BIN closest to the median — a photo of what the median actually
      // buys. Zero extra API calls; refreshed every run; omitted when absent
      // (consumers already fall back to the set logo). s-lXXX → s-l1600 swap
      // requests eBay's higher-res variant of the same asset.
      let representativeImage;
      if (agg && kept.length) {
        const nearest = kept.reduce((best, i) =>
          Math.abs((i._delivered ?? Infinity) - agg.priceMedian) <
          Math.abs((best._delivered ?? Infinity) - agg.priceMedian) ? i : best);
        const url = nearest.image?.imageUrl;
        if (url) representativeImage = url.replace(/s-l\d+/, "s-l1600");
      }
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
        ...(representativeImage ? { representativeImage } : {}),
        dataStatus: agg ? "live" : prev?.priceUsd ? "stale" : "unavailable",
        lastSeen: agg ? today : prev?.lastSeen,
        filterReport: report,
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
  const queryErr = updated.filter(p => p.dataStatus === "query_error").length;
  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);

  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`   live:   ${live}`);
  console.log(`   stale:  ${stale}`);
  console.log(`   miss:   ${missing}`);
  if (queryErr) console.log(`   ⚠ query_error: ${queryErr} (filtering wiped a previously-healthy SKU — inspect filterReport)`);

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
