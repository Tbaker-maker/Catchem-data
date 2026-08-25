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

// Node's fetch has NO default timeout: a host that accepts the connection
// and never answers hangs this script until the CI runner kills the job.
// A hung job is worse than a failed one — nothing goes red, the whole
// allowance burns and no guard reports. Every call below is bounded.
const FETCH_TIMEOUT_MS = 30000;

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


// ── MULTI-ITEM GUARD (Tyler QA, Aug 21) — "lot" alone missed the family.
// Multi-quantity listings inflate a single-item median hard: PGO ETB read
// $240 median against a real ~$205 market with a $488 high. Any title
// implying more than one unit is rejected. Word-boundary safe; "case"
// only when it reads as a shipping case of boxes, not "carrying case"
// products we don't track anyway.
const MULTI_ITEM_RX = [
  /\blot\s*(of)?\s*\d+/i,
  /\b([2-9]|[1-9]\d+)\s*x\b/i, /\bx\s*([2-9]|[1-9]\d+)\b/i,   // x2+ only — x1 means ONE
  /\bcase\s*(of)?\s*\d+/i, /\bsealed\s+case\b/i, /\bfull\s+case\b/i,
  /\b(two|three|four|five|six|ten|twelve)\s+(boxes|etbs?|bundles?|packs?|tins?)\b/i,
  /\bpair\s+of\b/i, /\bset\s+of\s+\d+/i, /\bbundle\s+of\s+\d+/i,
  /\(([2-9]|[1-9]\d+)\s*(pack|boxes|count|ct)\)/i, /\b\d+\s*(pack|box)\s+bundle\b/i,
];
const isMultiItem = t => MULTI_ITEM_RX.some(rx => rx.test(t));

// ── MENU-LISTING GUARD (swsh45-pack validation, 2026-08-22) ──────────────
// Variation listings that menu MANY sets in one title ("… Phantasmal
// Flames Booster Pack | Shining Fates Battle Styles …") pass the set +
// type filters and anchor the wrong set's price into the median. A title
// naming 3+ distinct tracked sets is a menu, not a product. Threshold 3
// (not 2) because era prefixes legitimately add one: "Pokemon Mega
// Evolution Phantasmal Flames Booster Pack" names two sets and is real.
// SET_NAME_LIST is built from the catalog in main(); names <6 chars are
// skipped ("151" would substring-match card numbers).
let SET_NAME_LIST = [];
const isMultiSetMenu = (t) => {
  const lc = t.toLowerCase();
  let hits = 0;
  for (const n of SET_NAME_LIST) if (lc.includes(n) && ++hits >= 3) return true;
  return false;
};
// ERA-BASE SETS (2026-08-22). The first set of an era is named after the era
// itself — "Scarlet & Violet", "Sword & Shield", "Sun & Moon", "Mega
// Evolution" — and every later set in that era carries the era in its
// branding ("Pokemon TCG Scarlet & Violet 151 Booster Bundle"). The set-name
// gate is a substring test, so these SKUs match their ENTIRE era and price
// the whole generation into one median. Found by eye: sv1-bundle displayed a
// Destined Rivals box and published $72 against a real ~$25 product, its
// three priciest "kept" listings being Paldean Fates and two 151 bundles;
// swsh1-bundle displayed Lost Origin and published $190, kept Lost Origin and
// Crown Zenith. me1-* was already hand-immunised with 6-10 excludeExtra
// entries each — the same bug, solved one SKU at a time. This generalises it:
// a listing for an era-base product may name its era and nothing else.
// SHORT_SIBLINGS covers sets whose names are too short for SET_NAME_LIST's
// 6-char floor (it skips "151" so card numbers don't match) but which still
// appear as distinct products.
const SHORT_SIBLINGS = ["151", "black bolt", "white flare"];
// "Base Set" is how sellers DISAMBIGUATE an era-base product — "Scarlet &
// Violet Base Set Booster Bundle" is precisely the sv1 listing we want — but
// it is also the name of a tracked vintage set, so the sibling rule threw the
// only genuine listings away and made a live market look dead. Caught
// 2026-08-22 during the retirement pass, one step before retiring sv1-bundle
// as a product that no longer trades. This function is only ever called for
// eraBaseSet products, so the phrase can never mean a different set here;
// base1 itself is not era-base and never reaches this code.
const NOT_A_SIBLING = new Set(["base set", "base"]);
const namesAnotherSet = (t, ownSet) => {
  const lc = t.toLowerCase(), own = (ownSet || "").toLowerCase();
  for (const n of SET_NAME_LIST) if (n !== own && !NOT_A_SIBLING.has(n) && lc.includes(n)) return n;
  for (const n of SHORT_SIBLINGS) if (n !== own && !NOT_A_SIBLING.has(n) && wordBoundaryTest(n, lc)) return n;
  return null;
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
  // autographed novelties price as memorabilia, not product (swsh45-pack
  // validation 2026-08-22: "Signed by Chumlee")
  "signed", "autograph", "autographed",
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
    "2 pack", "3 pack", "collection box",
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
  // listing says "pack").
  // "art" was BARE until 2026-08-22 and was the biggest false-positive source
  // in the class: booster packs ship with several wrapper artworks, so sellers
  // write "Random Art" / "(1) Random Pack Art" on perfectly ordinary single
  // packs. Measured on sv10-pack: 15 of 79 exclude-rejections (19%) were
  // legitimate single packs killed by that one word, on a SKU already thin at
  // 15 kept. Narrowed to the phrases it was actually meant to catch — art
  // cards, art prints and display/collectible art sets, none of which collide
  // with "random art". Anything genuinely multi-item is still caught by
  // "packs"/"lot"/the multi-item guard.
  // "sticker": swsh45-pack validation 2026-08-22 — a $4.99 "Booster Pack
  // Sticker" (a sticker, not a pack) was the SKU's clean floor.
  // code-card class (special-set sweep 2026-08-22): online-code listings
  // titled "<set> Booster Pack Code Card" pass set+type and sit at $2-6 —
  // they were the $4.49/$5.95 "floors" on sv8pt5/swsh12pt5 packs.
  "booster-pack":   ["weighed", "bundle", "box", "art card", "art cards", "art print", "art set", "art display", "etb", "elite trainer", "blister", "sleeved", "sticker",
    "code card", "code cards", "online code", "digital", "ptcgo", "tcg live",
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
// cost). No stated shipping → postage is baked into the price; the item
// price is the delivered price. Never estimated, never guessed.
// (transparency, not silent).
function deliveredPriceOf(item) {
  if (item?.price?.currency && item.price.currency !== "USD") return null; // currency guard (RT: USD-native law)
  const base = parseFloat(item.price?.value);
  if (isNaN(base)) return { delivered: NaN, shipKnown: false };
  const costs = (item.shippingOptions || [])
    .map(o => parseFloat(o.shippingCost?.value))
    .filter(v => !isNaN(v));
  // NO STATED SHIPPING = BAKED IN (Tyler, 2026-08-23). A listing that returns
  // no shipping cost is a free-shipping listing: the seller has folded postage
  // into the asking price. The item price IS the delivered price. This is not
  // missing data and must never be treated as a gap to estimate — we never
  // guess a shipping number. Counted separately only so the mix is visible.
  if (!costs.length) return { delivered: base, shipKnown: false, shippingBakedIn: true };
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

  const report = { fetched: items.length, failSet: 0, failType: 0, failExclude: 0, failLang: 0, failMulti: 0, failPrice: 0, shipUnknown: 0, kept: 0 };
  // REJECTION SAMPLES (2026-08-23): counts alone are undiagnosable. When
  // Destined Rivals packs showed 13 listings for an in-print, freshly
  // reprinted set, the report said 74 failed the exclude list and could not
  // say which word did it. Now every rejection reason keeps a few examples
  // and, where relevant, the exact term that triggered it.
  const samples = { set: [], sibling: [], type: [], exclude: [], lang: [], multi: [], menu: [], price: [] };
  const sample = (bucket, title, term) => { if (samples[bucket].length < 5) samples[bucket].push(term ? `[${term}] ${String(title).slice(0, 80)}` : String(title).slice(0, 80)); };
  const [floor, ceiling] = priceBoundsFor(product);

  // Tag which kind of single pack each listing is, so a future session can ask
  // whether sleeved and loose price differently instead of guessing.
  const packOrigin = (t) => /\bsleeved\b/i.test(t) ? "sleeved" : /\bloose\b/i.test(t) ? "loose" : "unstated";
  const kept = items.filter(i => {
    const t = titleLowerOf(i);
    // The sample() calls below said `it.title` where the parameter is `i` —
    // a ReferenceError that threw on the FIRST rejected listing of every SKU,
    // so every product errored, 0 went live and the wipe guard stopped the
    // run. Caught 2026-08-22 by a single-SKU validation fetch; the diagnostic
    // feature added to explain thin results was itself breaking the fetch.
    // Sampling now covers every bucket — set/lang/price/menu recorded nothing,
    // which is how "74 died on the exclude list" stayed unexplained.
    if (setLower && !t.includes(setLower)) { report.failSet++; sample("set", i.title, setLower); return false; }
    if (product.eraBaseSet) {
      const other = namesAnotherSet(t, product.set);
      if (other) { report.failSibling = (report.failSibling || 0) + 1; sample("sibling", i.title, other); return false; }
    }
    if (requires.length && !requires.some(r => t.includes(r))) { report.failType++; sample("type", i.title, requires.join("|")); return false; }
    if (requireExtra.length && !requireExtra.every(r => t.includes(r.toLowerCase()))) { report.failType++; sample("type", i.title, requireExtra.join("&")); return false; }
    if (product.subtype === "pc-etb" && !t.includes("pokemon center")) { report.failType++; sample("type", i.title, "pokemon center"); return false; }
    const hitTerm = excludes.find(term => wordBoundaryTest(term, t));
    // Per-term tally, not just a total: "74 died on the exclude list" is not a
    // diagnosis, and five samples cannot prove which term is over-broad. The
    // histogram names the culprit outright.
    if (hitTerm) { report.failExclude++; (report.excludeTerms ||= {})[hitTerm] = (report.excludeTerms?.[hitTerm] || 0) + 1; sample("exclude", i.title, hitTerm); return false; }
    if (isMultiItem(t)) { report.failMulti = (report.failMulti || 0) + 1; sample("multi", i.title); return false; }
    if (isMultiSetMenu(t)) { report.failMenu = (report.failMenu || 0) + 1; sample("menu", i.title); return false; }
    const langHit = langExcludes.find(term => wordBoundaryTest(term, t));
    if (langHit) { report.failLang++; sample("lang", i.title, langHit); return false; }
    // pricing v2: gate + aggregate on DELIVERED price (landed cost)
    const dp = deliveredPriceOf(i);
    if (!dp.shipKnown) report.shipUnknown++;
    if (isNaN(dp.delivered) || dp.delivered < floor || dp.delivered > ceiling) { report.failPrice++; sample("price", i.title, `$${dp.delivered} vs $${floor}-$${ceiling}`); return false; }
    i._delivered = dp.delivered;
    return true;
  });
  report.kept = kept.length;
  // samples travels with the report — the caller stores it as rejectionSamples
  // and was reaching for this local by name, which threw for every SKU.
  return { kept, report, samples, floor, ceiling };
}


// ─── eBay OAuth (client_credentials grant) ───────────────────────────────────
async function getEbayToken() {
  const appId = process.env.EBAY_APP_ID;
  const certId = process.env.EBAY_CERT_ID;
  if (!appId || !certId) {
    throw new Error("Missing EBAY_APP_ID or EBAY_CERT_ID env vars");
  }
  const basic = Buffer.from(`${appId}:${certId}`).toString("base64");
  const res = await fetch(EBAY_OAUTH_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
  let lastTotal = null;      // what eBay says the full result set is
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
    const res = await fetch(`${EBAY_SEARCH_URL}?${params}`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
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
    // EBAY TELLS US HOW MANY THERE ARE AND WE WERE NOT LISTENING. SEARCH_PAGES
    // is 3, so this reads at most 150 of a result set that regularly runs to
    // hundreds - and the median was computed from that slice with nothing
    // recorded about what was left behind. That is the same shape as the
    // truncated radar: the provider stated the size of the thing, the code took
    // a prefix, and the output claimed to describe the whole.
    //
    // Not raising the page count here: sampling 150 is a deliberate rate-limit
    // choice. Making it VISIBLE is the fix, so a thin or skewed median can be
    // traced to a cap rather than to the market.
    if (typeof data.total === "number") lastTotal = data.total;
    if (batch.length < 50) break; // last page
    await new Promise(r => setTimeout(r, QUERY_DELAY_MS));
  }
  if (lastTotal != null && lastTotal > all.length) {
    console.log(`    read ${all.length} of ${lastTotal} eBay results (capped at ${SEARCH_PAGES} pages)`);
  }
  return all;
}

// ─── Aggregate prices with outlier trimming ──────────────────────────────────
// `report` is threaded in rather than reached for: shipKnownPct needs the
// filter tally, and referencing the call-site name from in here is the exact
// ReferenceError class that broke this function twice (see notes below).
function aggregatePrices(items, floor = MIN_PRICE, ceiling = MAX_PRICE, report = { shipUnknown: 0 }) {
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
    // TWO MEDIANS (2026-08-23): our delivered figure mixes item+shipping with
    // item-only rows, while TCGplayer market price is ALWAYS item-only. Comparing
    // them inflates every spread, worst on cheap items where postage is a large
    // share. priceItemMedian is the like-for-like number; priceMedian stays the
    // delivered truth a buyer actually pays.
    // (this block referenced the call-site name `kept` inside a function whose
    // param is `items` — the same ReferenceError the note below already warns
    // about, repeated verbatim. It threw for every SKU, so priceItemMedian has
    // never actually been written. Local renamed to avoid shadowing `items`.)
    priceItemMedian: (() => {
      const itemOnly = items.map(i => parseFloat(i.price?.value)).filter(v => !isNaN(v)).sort((a, b) => a - b);
      return itemOnly.length ? round(itemOnly[Math.floor(itemOnly.length / 2)]) : null;
    })(),
    shipKnownPct: prices.length ? Math.round((1 - (report.shipUnknown / prices.length)) * 100) : null,
    // DIAGNOSTIC TRAIL (slop defense): the three priciest kept listings are
    // where pollution hides. Stored so any suspicious median can be audited
    // in seconds instead of guessed at.
    // (param is `items` — referencing call-site `kept` here threw for every
    // SKU on 2026-08-22 CI: 192 misses, 0 live, and the run still exited 0)
    topPricedTitles: [...items].sort((x, y) => (y._delivered ?? 0) - (x._delivered ?? 0)).slice(0, 3)
      .map(i => ({ t: (i.title || "").slice(0, 90), p: round(i._delivered) })),
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
  const catalog = JSON.parse(await readFile(PRODUCTS_FILE, "utf-8"));
  // menu-listing guard corpus: distinct catalog set names, ≥6 chars —
  // built from the FULL catalog even when ONLY narrows the run.
  SET_NAME_LIST = [...new Set(catalog.map(p => (p.set || "").toLowerCase()).filter(n => n.length >= 6))];
  // ONLY=id[,id2] — single-SKU validation mode (the protocol's "test runs
  // hit ONE SKU"). Full catalog still loads (guards need it); only the
  // fetch set narrows. Pair with a scratchpad copy for a temp OUTPUT_FILE.
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
  const products = only ? catalog.filter(p => only.has(p.id)) : catalog;
  console.log(`   → ${products.length} products to refresh${only ? ` (ONLY=${process.env.ONLY})` : ""}.`);

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

  await (await import("./heartbeat.mjs")).beat("fetch");
console.log(`🔍 Fetching prices (concurrency=${CONCURRENCY})...`);
  const today = new Date().toISOString().split("T")[0];
  const startTs = Date.now();

  const updated = await mapConcurrent(products, async (product) => {
    try {
      const [floor, ceiling] = priceBoundsFor(product);
      const items = await searchEbay(token, product.searchQuery, floor, ceiling);
      const { kept, report, samples } = filterItemsForProduct(product, items);
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
          // Carry the samples on this path too. query_error is exactly when a
          // human needs to see WHICH titles were thrown away — a SKU that
          // lands here is either a dead market or an over-tight filter, and
          // the counts alone cannot tell those apart (2026-08-22 retirement
          // pass: sv1-bundle and swsh1-bundle both arrived here with no
          // evidence attached).
          rejectionSamples: samples,
        };
      }

      const agg = aggregatePrices(kept, floor, ceiling, report);
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
        rejectionSamples: samples,
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

  // VALIDATION DUMP (2026-08-22). The validation protocol says to run one SKU
  // to a temp file and inspect the filter report before trusting a change, but
  // there was no way to get the per-SKU report out: rejectionSamples live on
  // the returned object and an ONLY run trips the wipe guard below (correctly)
  // before anything is written, so the diagnosis died with the process. Set
  // DEBUG_DUMP=<path> to write the run's objects somewhere harmless. Never
  // point it at data/ — this is the temp file the protocol asks for.
  if (process.env.DEBUG_DUMP) {
    await writeFile(process.env.DEBUG_DUMP, JSON.stringify(updated, null, 2) + "\n");
    console.log(`   🔍 validation dump → ${process.env.DEBUG_DUMP}`);
  }

  // RUN-LEVEL WIPE GUARD (2026-08-22): the per-SKU safety nets all passed
  // while a ReferenceError zeroed every SKU — 0 live written, exit 0, and
  // only a downstream crash stopped the wiped file from committing. A run
  // that loses (nearly) every live price is a broken run, not a market event:
  // refuse to overwrite the good file and fail loudly instead.
  const prevLive = Object.values(previous).filter(p => p?.dataStatus === "live").length;
  if (prevLive >= 50 && live < prevLive * 0.2) {
    console.error(`💥 WIPE GUARD: previous run had ${prevLive} live, this run has ${live}. Refusing to overwrite ${OUTPUT_FILE} — inspect the errors above.`);
    process.exit(1);
  }

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
