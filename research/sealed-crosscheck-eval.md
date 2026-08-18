# Sealed Cross-Check Eval — pick ONE provider ("The Spread" data source)

Goal: a TCGplayer-derived (sales-based) sealed price per tracked SKU, to
compute daily eBay-ask vs TCG-market divergence. Divergence >15% = signal.

## Candidates (probe in this order)
1. **tcgapi.dev** — sealed supported since Mar 2026; daily-budget rate
   limits; check free tier + sealed coverage of OUR skus.
2. **TCGAPIs (tcgapis.com)** — advertises sales HISTORY + live listings;
   commercial plans; verify sealed coverage + pricing.
3. **PriceCharting API** — sold-based, historically strong vintage sealed;
   paid; verify current API pricing + Pokemon sealed depth.
4. **PokemonPriceTracker** — only if Tyler confirms existing sub.

## Probe protocol (per candidate, ~20 min)
Test set (10 SKUs, mixed): sv9-booster-box, swsh7-booster-box, sv8pt5-etb,
me2pt5 ETB + bundle, me1-booster-box, sv3pt5-etb, sv4pt5-etb, swsh45 ETB
(Shining Fates) if tracked, base1-booster-box.
Record: hit-rate on exact products · fields returned (market? low? sold
history?) · their update timestamp · rate limits · cost · how they source
(ToS posture — counsel housekeeping list). Disqualify: no sealed, no
freshness signal, or scraping-us-directly posture.

## Decision rule
Highest hit-rate with a freshness field wins; ties → cheaper. Winner gets
scripts/fetch-sealed-crosscheck.mjs written against its REAL response
shape (do not pre-build adapters for unseen APIs). Output contract:
data/sealed-crosscheck.json → { updatedAt, source, products: [{ id,
tcgMarket, providerUpdatedAt, dataStatus }] } — divergence engine already
consumes this contract.
