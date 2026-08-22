# Condition-level prices — what is actually retrievable (verified 2026-08-22)

Tyler wants a raw-NM index and possibly an LP index. Whether the LP one is
buildable at all depends on whether any source we can reach returns prices
split by condition. It does. This file records the evidence, because the
answer decides an instrument and "I think the docs said" is not good enough.

## Answer: YES — PokemonPriceTracker returns the full NM/LP/MP/HP/DMG ladder

Not inferred from documentation. This is a real stored response
(`research/eval-samples/ppt-cards-history-RAW.json`, Umbreon VMAX swsh7-215),
at `prices.variants.<Printing>.<Condition>`:

```json
"Holofoil": {
  "Near Mint":         { "price": 112.64, "listings": null, "lastUpdated": "2026-08-17" },
  "Lightly Played":    { "price": 89.91,  "listings": null, "lastUpdated": "2026-08-17" },
  "Moderately Played": { "price": 67.14,  "listings": null, "lastUpdated": "2026-08-17" },
  "Heavily Played":    { "price": 50.74,  "listings": null, "lastUpdated": "2026-08-03" },
  "Damaged":           { "price": 39.38,  "listings": null, "lastUpdated": "2026-08-13" }
}
```

Cross-keyed by printing AND condition, so a Reverse Holofoil LP is a different
figure from a Holofoil LP. Both indexes are buildable.

### The catch, and it is a cost catch, not a capability one
The ladder only appears when `includeHistory=true`. Compare the two stored
samples — same card, same endpoint:

| request | `prices.variants.Holofoil` contains | cost/card |
|---|---|---|
| `includeHistory=false` | one key: `"Near Mint Holofoil"` — NM only | 2 credits (1 card + 1 eBay in that sample) |
| `includeHistory=true` | all five conditions | 2 credits (1 card + 1 history) |

So: an **NM-only index costs 1 credit/card** (base query, no add-ons). Any
index that needs LP or below costs **2 credits/card**, because the ladder rides
along with the history add-on.

`listings` is null for every condition — we get condition PRICES but no
condition-level supply counts. A depth read cannot be split by condition.

## Everything else we can reach returns NO condition split

**pokemontcg.io** (our singles source, free) — real response for the same card:

```json
"tcgplayer": { "updatedAt": "2026/08/22", "prices": {
  "holofoil": { "low": 1800, "mid": 2200, "high": 6000, "market": 2410.66, "directLow": 2149.99 } } }
```

Keyed by FINISH (`holofoil`), never by condition. low/mid/high/market/directLow
are points on one blended distribution. There is no NM figure in here and no
way to derive one — a "market" price is not a condition.

**Cardmarket** (bundled in the same pokemontcg.io response) has
`lowPriceExPlus`, which IS condition-thresholded — Cardmarket grades cards
MT/NM/EX/GD/LP/PL/PO and "Ex+" means Excellent-or-better. But it is a single
threshold rather than a ladder, and it is the European market in EUR. Our
entire basis is US/USD. Not usable for either index without changing venue.

## Cost, against real headroom

PPT API tier ($9.99): **20,000 credits/day, 60 calls/minute** (docs, verified
2026-08-22). Credits bill on the REQUESTED `limit`, not results returned — a
default request costs 50 credits because `limit` defaults to 50.

Our only daily PPT caller is `fetch-sealed-crosscheck.mjs`: 136 reviewed
entries, each at `limit=2`, so **272 credits/day — 1.4% of the allowance.**
The other four PPT scripts (build-crosscheck-map, extend-crosscheck-map,
fetch-singles-enrichment, verify-watchlist-prices) are manual tools and do not
run on the schedule.

Roughly 19,700 credits/day spare, so:
- NM index at 1 credit/card → ~19,700 cards/day
- Full-ladder index at 2 credits/card → ~9,800 cards/day

**Credits are not the binding constraint; the 60 calls/minute is.** At
`limit=1` per card, 9,800 cards is 163 minutes of wall clock. Batching
(`limit=N` returns N cards for N credits in ONE call) is what makes this cheap
in time as well as credits — the same spend, two orders of magnitude fewer
calls. Any index built here should batch.

## What is NOT verified
The live account dashboard. These limits are the published tier limits; whether
this specific account carries prepaid credits, a different plan, or a custom
cap can only be read from the dashboard behind Tyler's login. The API returns
`X-RateLimit-Daily-Remaining` and `metadata.apiCallsConsumed` on every call, so
one authenticated request would confirm the real balance — the key is
Read-Host only and never persisted, so that check needs Tyler.
