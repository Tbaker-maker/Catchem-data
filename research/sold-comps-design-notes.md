# Sold-Comps Design Notes (2026-08-18) — shapes found, pipeline NOT built

Per Tyler's instruction: sold data was found during the PPT capability probe,
so this documents shapes and a proposed integration — no code this session.

## What the probe established

**Sealed sold comps DO NOT exist at PPT.** All sold-endpoint guesses 404;
sealed `priceHistory` is daily snapshots of the listing-derived
`unopenedPrice`. Evidence: base1 "Base Set Booster Box [Revised Unlimited
Edition]" flat at $499.99 for 35 consecutive days — that is a stale ask, not
sales. **The vintage no-active-market suspension stays.** PPT does not open
the vintage roadmap item; PriceCharting (sold-based) remains the candidate,
and is a separate purchase decision (out of scope under current fences).

**Singles sold/supply data DOES exist**, on `/api/v2/cards`:

1. `prices` object (per card): `market`, `low`, **`sellers`** (75 in sample),
   **`listings`** (80), **`recentSales`**, `primaryPrinting`, `lastUpdated`,
   and per-condition `variants` (Near Mint / Lightly Played / … each with
   price + lastUpdated).
2. `priceHistory` with `includeHistory=true&days=N`: per-condition daily rows
   `{date, market, volume, marketRaw}` — **`volume` is daily sales count**,
   a real demand-side signal (sample: NM volume 1–4/day on Umbreon VMAX BRS).
3. `includeEbay=true` adds an `ebay` object: `salesByGrade` —
   **eBay SOLD stats per PSA grade** `{count, totalValue, averagePrice,
   medianPrice, minPrice, maxPrice, marketPrice7Day…}` (sample: psa8 count 11,
   median $76), plus its own freshness stamps (`lastEbayCheck`).

Raw shapes: research/eval-samples/ppt-cards-history-RAW.json,
ppt-cards-ebay-RAW.json, ppt-vintage-history-RAW.json.

## Proposed integration (future session, Tyler-gated)

**Lane A — singles watchlist enrichment (cheap, high value):**
Extend fetch-singles-prices.mjs (or a sibling) to pull PPT `/cards` for the
confirmed watchlist printings only (~12 cards/day ≈ 12–36 credits):
- store `sellers`/`listings` → singles supply series (Supply Watch for
  singles becomes possible even though sealed counts aren't available);
- store `volume` from history → measured demand, not inferred;
- store `salesByGrade` medians → "what a PSA 9 actually sells for" — direct
  Grader-mode content, sold-anchored per the Trust Standard.
Provenance framing: "TCGplayer market via PPT" vs "eBay sold via PPT" are
DIFFERENT claims and must carry distinct provenance strings. needsReview
gate applies unchanged.

**Lane B — vintage sealed sold comps: still unsolved.**
Options, in order: eBay Marketplace Insights (application drafted,
lottery odds), PriceCharting API (paid; revisit under the sign-off
exception when Tyler chooses), manual monthly comps entry with
`source:"tyler-manual"` provenance (zero cost, Trust-Standard-legal since
rule 2 already allows Tyler-verified prices).

**Guardrails carried over:** singles sold data is card-level — never imply
sealed conclusions from singles volume; eBay-sourced fields (salesByGrade)
must not be double-counted against our own eBay active-listing aggregates
in the same read.
