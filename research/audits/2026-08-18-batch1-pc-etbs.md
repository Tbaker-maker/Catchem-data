# Batch 1 Audit — PC-ETB import (24 SKUs) — 2026-08-18

Imported the 24 non-Mega PC-ETBs from data/catchem-pc-etb-skus.js (Mega six
already live since 47ce405). setIds verified against set-ids-verified.json;
set names normalized to title-matchable short forms; _confidence/_notes/
hasBoosterBox stripped; May-2026 grail ceilings carried (swsh7/sv2/sv3/
sv8pt5 = 1500, sv3pt5 = 2000). Catalog: 70 → 94 SKUs.

## Live validation (5 representative)

| SKU | median | n | verdict |
|---|---|---|---|
| swsh6-pc-etb (first-ever PC variant) | $299 | 14 | clean after tuning |
| swsh7-pc-etb (grail) | $1,200 | 19 | **comps-trap confirmed**: high $1,441 pressed the May $1500 cap → ceiling 2000 |
| sv3pt5-pc-etb (grail) | $1,556.21 | 10 | **comps-trap confirmed**: high hit $1,999.99 exactly at cap → ceiling 3000 (PriceCharting 8/15: market $1,339, listings to $3,000) |
| sv8pt5-pc-etb | $550 | 105 | clean; consistent with $615 PriceCharting comp |
| zsv10pt5-bb-pc-etb | $304.97 | 51 | clean after tuning |

## Filter tuning from validation evidence (dated inline comments in code)

New EXCLUDE_COMMON terms: "set of" ((Set of 2) pairs $394–399 in swsh6),
"sealed set" (BB+WF combo $540 in zsv10pt5-bb), "error" (misprint-variant
boxes $210–240 — a distinct collectible market).

## Day-one safety accounting

All 24 enter with no priceHistory → the query_error guard cannot misfire on
them (requires prev n≥10); a thin first fetch simply publishes
dataStatus "unavailable" until listings support ≥3 keeps. 19 of 24 were NOT
individually validated this batch (5-sample protocol per mission spec);
their first production filter reports get reviewed in the next daily audit.
