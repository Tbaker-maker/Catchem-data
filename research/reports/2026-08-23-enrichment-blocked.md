# Enrichment: allocation rebuilt in credits, spend blocked on the key (2026-08-23)

`node scripts/audit.mjs` → **20/20** · `node scripts/negative-tests.mjs` → **40/40**

## Wrong assumption — and it was mine

**Assumption 2 is wrong: dropping `limit=20` → `limit=1` does not save credits,
it breaks the lookup.** I wrote that recommendation in yesterday's report and it
was incorrect.

`fetch-singles-enrichment.mjs` queries `/cards?setId=…&search=<name>&limit=20`
and then does this:

```js
const hit = (d.data || []).find(p => cardNumber matches c.number);
```

The 20 results are not waste — the endpoint is searched **by name**, and the
**card number** is what disambiguates variants (a name like "Umbreon VMAX"
returns the regular, the alt art and the secret). At `limit=1` we get the single
top-ranked name match, which for most cards is the wrong variant, and the code
would emit `no-match` instead of data. It would have looked like a 20× saving
and been an outage.

Assumptions 1 and 3 hold: the budget is credits with cost
`limit × (1 + includeHistory + includeEbay + …)`, and `compute-demand.mjs`
exists and consumes vol30/sellers/psa.

## The correct plan, measured

The cheap path is not a smaller `limit` on the same query — it is a **different
query**. `fetchAllInSet=true` bills once per set at set-size × per-card cost,
the per-request caps do not apply, and it needs no name matching at all because
every card in the set arrives with its number.

| approach | credits | calls | covers |
|---|---|---|---|
| name-search, limit=20 (current) | 6,000 × 60 = **360,000** | 6,000 | 6,000 cards — **18× the ceiling** |
| name-search, limit=1 | 18,000 | 6,000 | **returns wrong cards** |
| **fetchAllInSet, densest sets** | **17,979** | **130** | **5,993 cards, incl. 4,027 of the top 6,000** |
| fetchAllInSet, whole catalogue | 49,404 | 130 | all 16,468 — 2.5 days |

At 3 credits/card (basic + history + eBay) one pass carries **both** payloads.
Paced at 1,000ms, 130 calls is about two minutes, and the per-minute cap of 60
is never approached.

**The compounding benefit:** every card fetched this way returns its
`tcgPlayerId`. We currently hold ids for **12 of 16,468** cards, which is
exactly why enrichment has to search by name at 60 credits a card. Once the ids
are held, every future refresh is a precise lookup at 3 credits — the first pass
is what makes all later passes cheap.

## BLOCKED: there is no API key on this machine

Blocks 1, 3 and 4 all require live calls. `POKEMONPRICETRACKER_API_KEY` is:
- not in the process environment
- **not set at Windows User scope**
- **not set at Machine scope**

It has never been set locally, which is the likely reason enrichment has only
ever covered 12 cards. The eBay credentials *are* present at User scope and work
fine, so the mechanism is right — this one variable was simply never added.

I am not going to ask for the key in chat: a credential pasted into a
conversation is a credential in a transcript. The documented pattern
(`research/crosscheck-eval-results.md`) is a User-scope variable set by
Read-Host, the same as the eBay creds. In an interactive PowerShell:

```
$k = Read-Host -AsSecureString "PPT API key"
[Environment]::SetEnvironmentVariable('POKEMONPRICETRACKER_API_KEY',
  [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($k)), 'User')
```

Then a **fresh** Claude Code session inherits it — this one will not, because a
process cannot pick up an environment variable created after it started.

## What was done: Block 2, complete

`api-strategist.mjs` priced everything in calls, so every recommendation it made
was wrong by the size of the `limit`. It now carries the real formula, and two
of its own stated principles are corrected in place:

- *"the mitigation is PACING, not underspending"* — true of the per-minute cap,
  false of the daily pool. Credits are spent regardless of speed, and the docs
  say prepaid credits *"raise your daily quota only, not your burst limit."*
  Neither limit is the other's remedy.
- *"20,000 calls at 60ms apart is twenty minutes"* — 60ms is 1,000 calls/minute,
  sixteen times the cap. The real pace is 1,000ms.

**New limit-waste detector.** Credits bill on the requested `limit`, and nothing
in the codebase read requests as a cost. It finds the real case:
`fetch-singles-enrichment` at limit=20 with two surcharges — 60 credits a
lookup, one card kept.

It deliberately **does not say "lower the limit."** It says use a cheaper query,
because lowering the limit is the trap I fell into yesterday. A flag that
recommended it would have caused the outage described above.

Scoped to `/cards` and `/sealed-products`: every documented cost is per card or
per product, and `/sets` appears nowhere in the cost list. My first pass flagged
its `limit=500` as a 500-credit waste — a false positive that would have sent
somebody optimising a call that is probably free.

Corrected allocation, now in credits:

```
 1.  9,058 credits/day  ENRICHMENT on the top few thousand cards
 2.      0 credits/day  ENUMERATE and add sealed products
 3.    700 credits/day  Twice-daily refresh on the top 500 cards and boxes
 4.  3,000 credits/day  Historical backfill where the provider has it
```

## Block 4 — partial answer, no key needed for this half
History **does** arrive: a stored `days=30` response carries 29 daily points per
condition with market and volume, for all five conditions, cross-keyed by
variant. Our tier's window is **6 months** (Free 3 days, API 6 months, Business
unlimited). What I cannot confirm without a key is whether a `days=180` request
actually returns 180 days per card, or whether `maxDataPoints` caps it lower —
the stored sample notes "Data points limited to 180."

## Needs Tyler
1. **Set the key** (command above), then a fresh session runs Block 1.
2. **Confirm the fetchAllInSet plan** — 17,979 credits, 130 calls, ~2 minutes.
3. Blocks 3 and 4 follow with whatever the day's remaining credits allow.

## Roads not taken
- Did not run enrichment at `limit=1` despite it being the stated assumption —
  it would have written `no-match` over working data.
- Did not ask for the key in conversation.
- Did not enumerate `/sealed-products` — needs the same key.

## Uncommitted / unverified
- No credits were spent this session; enrichment coverage is still 12 cards.
- `compute-demand.mjs` still has 12 of the 25 cards it needs, so it was not
  re-run — it would report the same insufficiency.
- The fetchAllInSet cost model is arithmetic from the documented formula and our
  own set sizes; no live call has confirmed the actual `apiCallsConsumed` for a
  set-level request.
