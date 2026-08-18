# Sealed Cross-Check Provider Eval — results (2026-08-18)

Executed under the Cost Gate (free tier must sustain ~70 SKUs/day ≈ 2,100
calls/mo with headroom; free-key signups fine; no payment details; trials of
paid plans don't count). Probed in the order the eval doc specifies.

## Comparison

| Criterion | tcgapi.dev | TCGAPIs (tcgapis.com) | PriceCharting API | PokemonPriceTracker |
|---|---|---|---|---|
| **Cost gate** | ✅ Free: 100 req/day (3,000/mo vs 2,100 need, ~30% headroom) | ❌ **No free tier** — £99/mo min | ❌ **API requires paid sub** | ✅ Free: 100 credits/day, signup only |
| Sealed coverage | ✅ Docs explicit: "booster boxes, tins, ETBs, and cases"; `product_type` field | claimed (cards emphasized) | ✅ strong, esp. vintage | ✅ dedicated `GET /api/v2/sealed-products` |
| Market price | ✅ market/low/median | ✅ market/low/mid/high/direct | ✅ sold-based | ✅ market + low |
| **Listing counts** (first-class) | ✅ `total_listings` + `lowest_with_shipping` | ✅ per-listing detail | ✗ (sold comps, not active) | ✅ **`listings` AND `sellers`** |
| Freshness signal | ⚠ site claims daily refresh; **no timestamp in documented response shape** | ✅ | ✅ | ✅ **`lastUpdated` per record** |
| Sales history | Pro tier only | ✅ (paid) | ✅ (paid) | plan-gated; free = 3-day history |
| Rate limit | 100/day (daily_remaining echoed in responses) | 10k/mo at £99 | n/a | 100 credits/day, 60 req/min |
| Sourcing posture | TCGplayer-derived (unaffiliated) | TCGplayer-derived (disclaimed unaffiliated) | own sold-data marketplace | TCGplayer-derived per docs |
| Hit-rate on 10-SKU test set | **UNTESTED — key required** | not tested (DQ'd) | not tested (DQ'd) | **UNTESTED — key required** |

Disqualifications: TCGAPIs and PriceCharting fail the cost gate outright.
Both are logged as post-revenue candidates — TCGAPIs for listing-level depth,
PriceCharting as the standing favorite for the separate **vintage sold-comps
roadmap item** (sold-based, deep vintage sealed).

## Recommendation (single): **PokemonPriceTracker free tier**

Reasons, in decision-rule order:
1. It is the only candidate with a **verified freshness field** (`lastUpdated`
   per record) in its documented response shape — the decision rule requires
   a freshness signal; tcgapi.dev's is a site-level claim with no timestamp
   in the documented response.
2. **Both supply counts** (`listings` and `sellers`) vs tcgapi.dev's
   `total_listings` only — supply lead-lag is first-class, and seller count
   is a second independent supply signal the divergence engine can use later.
3. Dedicated sealed endpoint (vs unified search where sealed hit-rate is
   less certain).
4. Cost-gate math identical to tcgapi.dev (100/day vs 70 needed), so no
   tiebreaker needed on cost.
5. Already the KB's recommended Phase-1 stack component (Apr 2026 eval).

**Runner-up:** tcgapi.dev — kept warm as the fallback if PPT's hit-rate
probe disappoints; its `total_listings` + bulk endpoints are credible.

## What's blocked on Tyler (STOP — no adapter until approved)

1. **Approve the pick** (or overrule).
2. **Create the free key**: pokemonpricetracker.com signup (no payment) →
   set `POKEMONPRICETRACKER_API_KEY` at User scope, same Read-Host pattern
   as the eBay creds. (If also approving the fallback probe: tcgapi.dev
   free key likewise.)
3. Then, pre-adapter, the deferred probe runs: hit-rate on the 10-SKU test
   set (sv9-booster-box, swsh7-booster-box, sv8pt5-etb, me2pt5-etb,
   me2pt5-bb, me1-booster-box, sv3pt5-etb, sv4pt5-etb, Shining Fates ETB
   [NOT currently tracked — add or substitute], base1-booster-box), credit
   cost per sealed lookup verified ≤1, real raw responses saved to
   research/eval-samples/, and the adapter gets written against the real
   shape per the eval doc's decision rule.

## eval-samples/ status

No authenticated raw responses exist yet (both finalists are key-gated; the
two DQ'd candidates were not probed beyond docs per the cost gate).
`research/eval-samples/` currently holds DOC-DERIVED response shapes, clearly
labeled as such — the adapter must NOT be built from them.
