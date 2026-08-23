# API allocation — stopped on the spend, answered the verification (2026-08-23)

`node scripts/audit.mjs` → **20/20** · `node scripts/negative-tests.mjs` → **39/39**

## STOPPED: the assumption is wrong in the direction that breaks the run

**"20,000 calls/day confirmed" — it is 20,000 CREDITS/day, and credits are not
calls.** The docs give the formula explicitly:

```
limit × (1 + includeHistory + includeEbay + includeCardmarket + premiumGranularity)
```

`fetch-singles-enrichment.mjs` currently calls
`/cards?…&limit=20&includeEbay=true&includeHistory=true`, so **each call costs
20 × 3 = 60 credits**, not 1.

| Block 1 as written | reality |
|---|---|
| 6,000 calls | **360,000 credits — 18× the daily ceiling** |
| "six minutes" at 60ms | 60ms = 1,000 calls/min = **16.7× the 60/min cap** — 429s within seconds |
| — | at the real 60/min, 6,000 calls is **100 minutes** |

Block 4 has the same problem: **18,000 calls/day × 3 credits = 54,000 credits,
2.7× the ceiling.**

I did not run either. Executing Block 1 would have rate-limited within seconds
and, had it somehow completed, spent eighteen days of budget in one morning.

**And the premise of Block 4 does not hold as stated.** "The mitigation for rate
limits is pacing, not underspending" is true of the *per-minute* limit and false
of the *daily credit* limit. Credits are consumed regardless of how slowly you
spend them. The docs are explicit that you cannot buy your way past the burst
cap either: *"prepaid credits raise your daily quota only, not your burst
limit."* Pacing fixes one of the two limits. Only scope or prepaid credits fix
the other.

### The corrected Block 1 — and it does fit, in one day
Drop `limit=20` to `limit=1` (we search per card anyway, so 19 of every 20 paid
slots were being thrown away):

- **6,000 cards × 3 credits = 18,000 credits** — fits inside one 19,728-credit
  day, with the existing 272-credit crosscheck still running.
- **6,000 calls at 60/min = ~100 minutes**, paced at **1,000ms**, not 60ms.
- One pass gets **both** payloads — history and graded sold — because they are
  surcharges on the same call.

Cheaper alternative if calls matter more than credits: `fetchAllInSet=true`
bills once per set at set-size × per-card cost. The top 6,000 by value live
across **120 sets covering 15,843 cards** — 47,529 credits (2.4 days) but only
**120 calls**. Better if we ever want the whole catalogue; worse for a targeted
6,000.

## BLOCK 3 — YES, AND IT IS THE BIGGEST THING ON THE BOARD

Not inferred. From the stored response, a `days=30` request returned **29 daily
points per condition**, each with market price and often volume:

```json
"Near Mint": { "history": [
  { "date": "2026-07-20T00:00:00.000Z", "market": 122.2,  "volume": null },
  { "date": "2026-07-21T00:00:00.000Z", "market": 122.1,  "volume": 4, "marketRaw": 122.14 },
  … 29 points …
  { "date": "2026-08-17T00:00:00.000Z", "market": 112.64, "volume": 4 } ] }
```

Tracked for **all five conditions** and cross-keyed by variant. And the tier
table gives our plan a **6-month history window** (Free 3 days, API 6 months,
Business unlimited).

So: **we can backfill six months of daily per-condition prices, with volume, at
+1 credit per card, today.** Every thesis currently reporting INSUFFICIENT for
want of tape becomes testable in one pass instead of in six months. RT-1, RT-3
and RT-7 are unblocked. This is the single highest-value item in the allocation
and it was ranked fourth because nobody had checked.

## BLOCK 4 — the real limits

- **Per-minute: 60 calls** on our tier (Business 500, Enterprise 1,000).
- **Per-second: not documented.** The burst control is the per-minute cap.
- **Daily: 20,000 credits**, reset **00:00 UTC**. One shared pool, not
  per-endpoint.
- **429 carries `Retry-After`**, and the body says `limitType: "daily"` or
  `"per_minute"` — the two clear on completely different clocks, so the retry
  strategy has to read which one it hit.
- **Concurrency caveat, verbatim risk:** rate-limit headers "do not account for
  your other in-flight requests." Treat the budget as `remaining − inFlight` or
  a `Promise.all` will read the same "2 remaining" three times and 429.

**Correct pacing at full allocation: 1,000ms between calls.** Not 60ms.

## Blocks 1 and 2 — not run
Block 1 stopped on the arithmetic above; the corrected version is ready and
needs one word from Tyler. **Block 2 (enumerate `/sealed-products`) was not
started** — it is cheap on its own, but I stopped the session at the point the
allocation proved wrong rather than half-spending against a budget nobody had
checked. Enumeration costs `limit` credits per page; at limit=200 that is 200
credits per page, so counting the whole sealed catalogue is likely 1–3k credits,
not 858 "calls".

## Wrong assumptions
1. **"20,000 calls/day"** — 20,000 *credits*; billing is on the requested
   `limit` × data surcharges. This is the whole report.
2. **"enrichment covers 12 of 16,468"** — true, and the 12 are richer than
   assumed: `vol30` is populated on all twelve (10, 4, 19, 19, 105, 20, 27, 56,
   22, 26, 234, 276) and `gradingPremium` on all twelve.
3. **`/sealed-products` never enumerated** — confirmed, only ever queried by
   name.
4. **`compute-demand.mjs` is new** — confirmed present and unrun at scale.

## Surprises
- **The tier table says API tier gets NO eBay sold listings — but our twelve
  cards have full PSA sold aggregates** (psa8/psa9/psa10 counts and medians).
  The row means per-listing auction/BIN *detail*; the graded sold *aggregates*
  arrive under "Graded prices: Yes (+1 credit)", which all tiers have. Block 1
  is not tier-blocked. Worth knowing before anyone reads that row and gives up.
- **`recentSales` is 0 on all twelve cards.** The strategy file flags it
  "critical — arrives on every card and is never read". It does arrive, and it
  is zero. Wiring it through today would publish twelve zeros.
- The strategy file's own blindSpots say it "cannot see rate limits, quotas or
  tier boundaries." It was right to say so, and the allocation was then written
  in a unit it had no way to check.

## Needs Tyler
1. **Approve the corrected Block 1** — limit=1, 1,000ms pacing, 18,000 credits,
   ~100 minutes, one pass for both history and graded sold.
2. **Or reorder: history first.** 6,000 cards × 2 credits = 12,000 — cheaper,
   fits with room to spare, and unblocks three theses.
3. **One authenticated call** to confirm the live balance and any prepaid
   credits, since the dashboard is the only place tier truth lives.

## Uncommitted / unverified
- No enrichment run happened; coverage is still 12 cards.
- `/sealed-products` still un-enumerated; its true size is unknown.
- `compute-demand.mjs` still has no sample — it needs 25 cards and has 12.
- The 6-month window is the published tier figure; I verified 30 days of real
  points because that is what the stored call requested.
