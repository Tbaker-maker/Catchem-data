# RD notes

Flag off on every branch. Nothing here is published. `scripts/publish-public-data.mjs` is not edited. Open PR files for pulse, cutouts, reads accuracy, synthesis, creator talk, X accounts, the eBay insights pull, and the proof engine are not edited.

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

Already open. A receipt is source, date, method, listings counted, and filled. Filled is true for archived market prices and for any print before Sep 25 2026. A missing count is null, never 0. A measured 0 stays 0.

Sealed prices on that branch are `priceUsd` on `data/sealed-prices.json`. Singles are the market print on the set value file. Pulse rows are included only when `data/sealed-market-pulse.json` is present. That file belongs to the open pulse branch, so it is not copied here.

## Supply runway

Already open. Each week keeps the last listings counted in that ISO week. The runway, in weeks, is the current count divided by the average weekly drop. Cutoffs live only in catchem-data-private `data/private/supply-runway.json`. The script refuses to run without that file. With the history on file, a product that has only one week has a null runway.

## Lifecycle

`research/assets/public/sealed-era-paths.json` is the price since release for each sealed product, plus the era median path by product type. It is not `lifecycle-curves.json` (that path is the open proof branch).

Our own daily market print wins on a shared day. Earlier days come from archived TCGplayer market prices. The archive is not named as a site. Points before Sep 25 2026 are filled. Sourced retail is not on file (`data/msrp.json` filled count is 0, and `data/sealed-msrp.json` has no USD amount), so price versus retail is null.

## Read ledger

Every read in `research/assets/public/reads.json` is kept. Outcome is hit or miss only when `data/sealed-prices.json` has the written price and a later price. Otherwise later price and outcome are null. Older scored calls are kept too. Two single calls have no product id on the sealed file, so their prices stay null.

One older miss does not survive the check. Evolutions Booster Box was scored a miss off a later day that is not in the price file. The next price on file moved the same way, so the outcome is a hit. The seven misses that the price file still supports are kept.

## Explore

One index per tab: sets, sealed, singles, news, reads. Each row has id, name, image, set, price, change, listings counted, source, date, and links. Links point at ids in these indexes. Interesting is the largest moves already on our files, and only when that id is in the index. No advice line. Each file is under 300 KB gzip.

Sealed price here is the latest ask median on the price history, not `priceUsd`. Those two fields differ for some products, so `priceUsd` is not copied. Singles are included only when the daily market file has the print. A card that is only on the movers file is left out.

## Gaps

- RECEIPTS and SUPPLY_RUNWAY stay off. Pulse receipts need the pulse file, which is still an open PR.
- Runway needs the private cutoff file, and most products do not have enough weeks.
- Retail is null until a page states the amount for that exact id.
- Most reads are dated the latest day, so they have no later price yet.
- `priceUsd` and the last history ask median are not the same number. Each branch says which one it used.
- Set totals are the total field on the set value file. They are not a fresh sum of every card.
- Listing history does not cover every sealed id. Those rows use the count on the sealed price file, and the receipt says so.
