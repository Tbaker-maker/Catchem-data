# PkmnPrices read pathways

Twelve read pathways on the data PkmnPrices Pro added: eBay sold comps and daily
sales counts, graded population, Cardmarket prices, Japanese prices, a year of
TCGplayer price history, and sold comps against the sourced MSRP file.

Code: `scripts/lib/ppp-reads/`. Tests: `scripts/tests/ppp-reads.suite.mjs`
(made-up rows in the real API shapes, `scripts/fixtures/ppp/`).

## Two outputs, two gates

1. **Fact reads** (`collect.mjs`, flag `ppp.reads`, default **off**). New read
   types stay private and are scored against outcomes until they prove out.
   With the flag off, a fact read is public only when its pathway, item kind and
   direction have a passed scanner gate tonight (`ppp-<pathway>`, any horizon);
   every other hit goes only to the private log. `true` shows every pathway.
   One line of dated numbers per product with its source. No hit rate, no direction word, no take code.
   They join the board like scanner and span reads and then pass the same board
   fit, reads guard (spike, flip, flat step), thin-data drop and copy rules as
   every other read. At most 12 per pathway, 96 a night, one per product.
2. **Scored pathways** (`scanner-patterns.mjs`, patterns `ppp-*`). The nightly
   scanner replays every pathway against later TCGplayer market moves with the
   same gate as every other pattern: n >= 20 on the earlier and on the later part
   of the year and the lower bound of the 90% range above the base rate on both.
   Weights and hit rates go to `catchem-data-private` (`scanner/weights.json`).
   Weight stays 0 and no scored read is written until a pathway passes. A passed
   pathway's read adds its past cases to the fact lines.

Every hit, kept or not, goes to the private store: `ppp-reads/<asOf>.json`.
Graded population snapshots are kept there too (`ppp-reads/pop-history.json`),
because the API only returns the current counts.

## Nightly wiring

`update-sealed-prices.yml` runs `node scripts/ppp-private-sync.mjs pull` (from
the enrich PR) before the first rebuild, so `ppp-raw-private/` holds the private
repo's `ppp/` when both `build-feed.mjs` passes run. The step does nothing until
that script is on main, refuses to pull unless `ppp-raw-private/` is gitignored,
and never fails the run.

## Input contract

The ingest writes one or more JSON files to `data/private/ppp/reads-input/`
in catchem-data-private (or the gitignored local `data/private/ppp/reads-input/`,
or the folder named by `PPP_READS_INPUT_DIR`). Rows are the raw API responses.

```json
{ "kind": "ppp-reads-input", "asOf": "2026-11-12", "items": {
  "tcgcsv-123456": {
    "pppId": 22887, "kind": "single", "printing": "Holofoil", "volumeFrom": "2025-11-12",
    "volume": [/* GET /v1/cards/{id}/sales/volume rows */],
    "comps": [/* GET /v1/{cards|sealed}/{id}/listings/ebay rows */],
    "history": [/* GET /v1/{cards|sealed}/{id}/prices/history rows, USD and EUR */],
    "population": {/* GET /v1/cards/{id}/population */},
    "jp": { "pppId": 1, "history": [/* history rows of the Japanese printing */] }
} } }
```

The key is our id (`tcgcsv-<TCGplayer product id>`) or the bare TCGplayer id.
`volumeFrom` is the first day the volume pull covered, since a day with no sale
has no row. `compsFrom` / `gradedFrom` (optional) is the first day a truncated
comps page covers. Files merge; the newest 14 in the private folder are read.

The enrich store from `scripts/ppp-enrich.mjs` is read as well, with no extra
step from the ingest: `ppp-raw-private/<lane>/<bucket>.json` (or
`PPP_RAW_DIR`, or the private repo's `ppp/`) with lanes `comps`, `volume`,
`pop`, `detail` (current Cardmarket EUR rows) and `history`, plus `id-map.json`.
`raw-shards.mjs` wraps it into one input doc. A comps entry with `more: true`
covers only from the day after its oldest comp.

## Rules every pathway keeps

- Only rows dated on or before the read date. An eBay comp counts only once
  PkmnPrices had ingested it (`ingested_at`), so the replay has no look-ahead.
  Daily sales counts have no ingest date; late comps can raise a past day's count.
- eBay comps: USD only; for cards only `attribution: "exact"` comps; raw means no
  grader and no grade. Comps from two printings are never mixed when the card's
  printing is not known.
- Half-price filter before every median: a comp at half or less of any other
  comp in the window is left out (same rule as the eBay Insights client). If
  the filter drops more than 25% of a window, the window mixes copies (one slab
  or lot among raw cards) and no median is written.
- Title filter for raw medians: a comp whose title names a played or damaged
  copy (damaged, DMG, HP, MP, LP, played, crease, VG), a grade (PSA 10, CGC 9.5,
  graded, slab), another language, or a lot, proxy or custom is left out. The
  count is shown on the read. "190 HP" (hit points) does not count. Graded
  medians keep condition words.
- A truncated comps page never counts a window that starts before it.
- Tracking gaps: a day whose raw sales across every tracked product fall under
  half the median day (judged only with 20 or more products) is a PkmnPrices
  tracking gap. Sales-pace and sell-through windows that touch one are skipped.
- TCGplayer market is our own TCGCSV day for the catalogue printing, within 3
  days of the date the line names.
- "Sold" only for eBay sold comps. Listing totals stay "listings counted".
- Sealed lines carry no condition word.

## Pathways and thresholds (`limits.mjs`)

| Pathway | Fires when | Minimum sample |
|---|---|---|
| `sold-gap` | 14-day eBay sold median is 10% to 60% and $1 or more from the TCGplayer market (over 60% is more often a different printing or condition) | 5 comps after the title and half-price filters |
| `sold-pace` | 7 days of sales (ending 2 days back) are 2x the 8 weeks before, or 0.4x or less | spike: 8 sales and 2 a week before; drop: 5 a week before and at least 1 sale in the week; 9 weeks of coverage; no tracking-gap day |
| `sold-trend` | 14-day sold median moved 8% or more in 28 days and 10 points or more apart from the market | 5 comps in each window |
| `sell-through` | 14-day sales per listing counted rose 1.5x or fell to 0.67x in 28 days | 10 listings counted, 6 sales, level 0.25 per listing |
| `pop-growth` | Graded population up 25 copies and 5% or more, 5 to 9 days apart | two weekly snapshots |
| `gem-rate` | Gem rate moved 2 points or more over 21 to 35 days | 100 newly graded copies |
| `low-pop` | 100 gem-grade copies or fewer, price up 10% while gems up 5% or less; or gems up 25% while price down 10% | two snapshots 21 to 35 days apart, market on both dates |
| `graded-spread` | PSA 10 over raw sold median multiple moved 20% or more in 28 days | 3 PSA 10 comps and 5 raw comps in each window |
| `eu-gap` | Cardmarket (EUR at the ECB rate) is 15% or more from TCGplayer and the gap moved 10 points or more in 28 days | Cardmarket within 3 days, ECB rate within 4 days |
| `jp-en` | Japanese printing and English card 30-day moves are 15 points or more apart | 4 points each, one currency |
| `range52` | Today's market is over every price in the year before (1%+) or under every one | 300 days of cover, 40 points, last 7 days left out |
| `msrp-sold` | 30-day sealed sold median is 1.5x MSRP or more, or 0.9x or less | 5 comps, sourced MSRP (data/msrp-sourced.json) |

A private `ppp-reads/limits.json` may change any number above. Public reads skip
items under $5.

ECB rates: `data/derived/fx/ecb-eur-usd.json`, one GET a night to
`eurofxref-hist-90d.xml`. No rate for a day means no Cardmarket line.

## First real night (2026-11-12, enrich store, 253 products)

Dry run of `collectPppReads` on the enrich store with no network: 3 public
`sold-gap` reads. Before the title filter, the 25% mixed-sample rule, the 60%
cap, truncated-page coverage and tracking-gap days, the same run wrote 15, and
most were wrong: all-condition comps (HP, DMG, Portuguese) against a Near Mint
market, one slab-priced comp dropping 15 of 20 raw comps, a 20-row page read as
"1 sale four weeks earlier", and a PkmnPrices-wide quiet fortnight (weeks of
Oct 5 and Oct 12) read as a sell-through rise.
