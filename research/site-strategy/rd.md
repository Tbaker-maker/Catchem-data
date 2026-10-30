# RD notes

Flag off on every branch. Nothing here is published. `scripts/publish-public-data.mjs` is not edited. Open PR files for pulse, cutouts, reads, and the proof engine are not edited.

## Flags

| Branch | Flag | Where |
| --- | --- | --- |
| feature/receipts | RECEIPTS off | `research/assets/public/number-receipts.json` |
| feature/supply-runway | SUPPLY_RUNWAY off | `research/assets/public/supply-runway.json` |
| feature/lifecycle-curves | LIFECYCLE off | `research/assets/public/sealed-era-paths.json` |
| feature/read-ledger | READ_LEDGER off | `research/assets/public/read-ledger.json` |
| feature/explore-index | EXPLORE off | `research/assets/public/explore/*.json` |

`data/flags.json` is already on other open branches, so these flags live on the output, not in that file.

## Receipts

A receipt is source, date, method, listings counted, and filled. Filled is true only for archived TCGplayer market prices before Sep 25 2026. A missing count is null, never 0. A measured 0 stays 0.

Sealed prices are the median of delivered eBay asks (`priceUsd` on `data/sealed-prices.json`). Singles are the TCGplayer market print on the set value file. Pulse rows are receipted only when `data/sealed-market-pulse.json` is present. That file belongs to the open pulse branch, so it is not copied here.

## Supply runway

Each week keeps the last listings counted in that ISO week. The runway, in weeks, is the current count divided by the average weekly drop. Cutoffs (`minWeeks`, `minListings`, `lookbackWeeks`, `flatAbsPerWeek`) live only in catchem-data-private `data/private/supply-runway.json`. The script refuses to run without that file. With listings counted history from Oct 13 to Oct 24, only two weeks are on file, so the runway is null.

## Lifecycle

`research/assets/public/sealed-era-paths.json` is the price since release for each sealed product, plus the era median path by product type. It is not `lifecycle-curves.json` (that path is the open proof branch).

Sourced retail is not on file (`data/msrp.json` filled count is 0, and `data/sealed-msrp.json` has no USD amount). Price versus retail is null. Points before Sep 25 2026 are marked filled. A shared day keeps our own TCGplayer market print. The archive is not named as a site.

## Read ledger

Every read in `research/assets/public/reads.json` is kept, including any that miss. Outcome is hit or miss only when our own price files have both ends of the claim. Otherwise later price and outcome are null. Older scored calls in `receipts.json` are copied in so their misses stay. Creator names are not added.

## Explore

One index per tab: sets, sealed, singles, news, reads. Each row has id, name, image, set, price, change, listings counted, source, date, and links. Links point at ids in these indexes. Interesting right now is the largest moves already on the movers file, and only when that id is in an index. No advice line. Each file is under 300 KB gzip.

## Gaps

- RECEIPTS stays off until this branch is the one we turn on. Pulse receipts need the pulse file, which is still an open PR.
- Runway needs four weeks. Two are on file.
- Retail is null until a page states the amount for that exact id.
- Most reads are dated the latest day, so they have no later price yet.
