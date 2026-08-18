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
Record: hit-rate on exact products · **LISTING/SELLER COUNTS exposed? (now a first-class criterion — supply lead-lag needs it; a provider with counts beats a cheaper one without)** · fields returned (market? low? sold
history?) · their update timestamp · rate limits · cost · how they source
(ToS posture — counsel housekeeping list). Disqualify: no sealed, no
freshness signal, or scraping-us-directly posture.

## Cost gate (Tyler directive, Aug 18 — overrides everything below)
Pre-revenue rule: $0 or it doesn't ship. A candidate qualifies ONLY if its
FREE tier sustainably covers ~70 SKUs/day (≈2,100 calls/mo) with headroom.
Free trials of paid plans don't count — we won't build on a meter that
starts running. A paid source can be revisited AFTER revenue exists, and
only if decisively better than the free winner.

## Decision rule
Highest hit-rate with a freshness field wins; ties → cheaper. Winner gets
scripts/fetch-sealed-crosscheck.mjs written against its REAL response
shape (do not pre-build adapters for unseen APIs). Output contract (EXTENDED for supply):
data/sealed-crosscheck.json → { updatedAt, source, products: [{ id,
tcgMarket, tcgListings (if available), providerUpdatedAt, dataStatus }] } — fetch also appends {date,id,tcgListings} rows to data/crosscheck-history.json — divergence engine already
consumes this contract.
