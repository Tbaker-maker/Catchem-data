# The namespace fix works; the writer that was meant to keep the data did not (2026-08-23)

`audit.mjs` → **20/20** · `negative-tests.mjs` → **51/51** · `verify-work.mjs` → **3 findings, none introduced this session**

## Assumption 1 is wrong, and in the good direction

**The set map exists and is verified against the full `/sets` response**, not
against five sets we happened to hold. Tyler ran the resolver between sessions.
It returned **218 provider sets**, and the join now matches **118 of our 130**,
reaching **5,959 of the top 6,000 cards by value** — up from 78/130 and 3,201
after four naming disagreements and one collision bug were fixed. The 12
unmatched are McDonald's collections, trainer kits and Best of Game: 41 top-6000
cards in total. That work is in the previous report; this session did not repeat it.

Assumptions 2 and 4 hold. Assumption 3 is **wrong in a way that matters** — see
Block 2.

## BLOCK 1 — the delivered set IDs are the requested ones. Proven.

This was the whole question, and the answer is yes:

```
  ex8         →696e3c9fbb2a772e0d05683f  108 cards ·  billed  324
  ecard1      →696e3c9dbb2a772e0d056823  165 cards ·  billed  495
  ecard2      →696e3c9ebb2a772e0d056838  186 cards ·  billed  558
  … 21 sets, every one returning the set that was asked for …
```

Twenty-one consecutive sets, each returning its own cards, non-zero, at the
requested id. The failure that cost 9,114 credits — a run that looked successful
while delivering a catalogue nobody chose — is fixed and demonstrated.

**Then it hit a 429 at 5,637 credits and lost every card.** Not to the provider:
to my own writer. Three defects, stacked, all mine:

1. **The output could never have been written.** The writer built the entire
   payload in memory for a single `JSON.stringify`. Node's maximum string length
   is 512 MB; these cards measure **197 KB each**, so any run past **~2,650
   cards** throws `RangeError` at the write. The plan targets 5,981. The run was
   unwritable before it started — it would have spent the full ceiling and died
   at the last step.
2. **Nothing was flushed between sets.** Twenty-one paid-for sets sat only in
   memory, so the 429 took all of them.
3. **A 22-hour sleep.** The 429 arrived with `limitType: "unknown"` and
   `Retry-After: 79,704s`. My retry logic branched on the *label*, saw it wasn't
   "daily", and went to sleep for 22.1 hours. I killed it there.

Fixed: cards append to `data/enrichment-raw.ndjson` one JSON object per line,
flushed **before the next call**, so the file on disk is always as complete as
the credits spent; no giant string ever exists; only card **ids** are held in
memory, not payloads. Any wait over 600s is now treated as a daily cap whatever
the label says. The 861 surviving cards were migrated into the new format and
the state file records which sets are held, so nothing is re-bought.

### The credit accounting understates what we are charged

Our ledger says 9,114 + 5,637 = **14,751** of a 20,000 daily pool. The provider
returned a daily-reset 429 at that point. The gap is the first run's 26
billed-but-empty calls, charged at full set size. **Treat our credit counter as a
floor, not a figure** — the dashboard is the only truth.

### `/sets` cost: still not confirmed

I could not test it. One `/sets?limit=1` call authenticated successfully during
setup, but isolating its cost needs a before/after balance read, and the daily
pool was exhausted before I could take one. Unchanged from last session:
"probably free" is still not "free."

## BLOCK 2 — a window EXISTS, and it is not the one you would reach for

**Assumption 3 is wrong.** The sold aggregates *do* carry dates. Every graded
card has `dateRangeStart` and `dateRangeEnd` on its eBay block, and 99% of
per-grade rows carry `lastSaleDate`. Real response:

```json
"ebay": {
  "dateRangeStart": "2026-05-24T00:00:00.000Z",
  "dateRangeEnd":   "2026-08-20T00:00:00.000Z",
  "totalSales": 84,
  "salesByGrade": { "cgc9": {
      "count": 2, "medianPrice": 700,
      "marketPrice7Day": null, "dailyVolume7Day": 0,
      "lastSaleDate": "2025-12-31T00:00:00.000Z",
      "smartMarketPrice": { "price": 595, "confidence": "low",
                            "method": "all_filtered_weighted", "daysUsed": 234 } } }
}
```

**Read that carefully.** The block claims a window of 24 May – 20 Aug 2026. The
`cgc9` median of $700 rests on two sales whose most recent is **31 December
2025** — eight months outside the window printed above it. The block-level range
describes the card's sales in aggregate and **does not describe any individual
grade**. Measured across all 309 graded cards and 2,669 grade rows:

| | |
|---|---|
| cards with a block date range | 309 / 309 — **100%** |
| grade rows with `lastSaleDate` | 2,653 / 2,669 — **99%** |
| **grade rows whose last sale falls OUTSIDE the block range** | **573 — 21%** |
| grade rows with `smartMarketPrice` | 2,669 — 100% (median `daysUsed` **90**) |
| `smartMarketPrice` confidence | low 2,087 · medium 418 · **high 164** |
| age of last sale | median **55 days** · p90 **186 days** |

So the honest answer is neither "no window" nor "we're unblocked":

- **Using `dateRangeStart/End` to label a graded price would mislabel one in
  five.** It is the window that looks right and is wrong. Publishing against it
  would have been error 18 committed a second time, with a date attached to make
  it look defended.
- **A defensible per-grade window does exist**, in `lastSaleDate` plus
  `smartMarketPrice.daysUsed` and its `confidence`. On the **582 rows (22%)** at
  medium or high confidence, a graded claim can carry a real window.

**Recommendation:** the withdrawal was right and should stay for the raw
`medianPrice`. RT-5 becomes testable on the high/medium-confidence subset with a
`lastSaleDate` inside the claimed window — a much smaller, defensible sample.
That is a change to the `2026-08-23-graded-withdrawn` decision's premise, so it
is Tyler's call, not mine.

## BLOCK 3 — not started, and deliberately

`/sealed-products` enumeration needs live calls and the daily pool is exhausted
until 00:00 UTC. Starting it would have produced a partial enumeration of unknown
completeness, which is worse than none. It follows the map rather than racing it,
as agreed.

## BLOCK 4 — I got four of seven attacks past the verifier

Seven attacks, staged against a clean baseline and restored afterwards.

| attack | result |
|---|---|
| chipped price, no date, in `dailyThree` | **CAUGHT** |
| same figure priced at **$0.49** | **MISSED** |
| same figure in `supplyShifts` instead of `dailyThree` | **MISSED** |
| hand-minted `latest-graded.svg` | caught — but see below |
| hand-minted `latest-sealed.svg` claiming **$99,999** | **MISSED** |
| venue mismatch with `priceVenue`/`listingVenue` set | **CAUGHT** |
| same false comparison with the venue fields **absent** | **MISSED** |

Two clean catches. The third is worse than a miss:

**The hand-minted check does not detect hand-minting.** It fires when a file
named `latest-(graded|artist|liquidity).svg` *exists*. It caught my attack
because the attack created `latest-graded.svg`, which is normally absent — and
it went on firing for the next two attacks after the file was left behind,
producing two false "catches" I nearly reported as real. A card minted by hand
as `latest-sealed.svg`, claiming $99,999, passes clean. When the pipeline
legitimately produces `latest-graded.svg`, this check will fire forever.

### Blind spots beyond the declared one

The declared blind spot is that it cannot check reasoning. These are additional:

1. **`v > 1`** — sub-dollar figures are never examined. Our median enriched card
   is **$0.49**. The entire bulk market is invisible to the windowless-figure check.
2. **It walks `dailyThree` and one `dealZone` sample.** `supplyShifts`,
   `watchOutcomes`, `products` and the index are never traversed. Most of the
   feed is unchecked.
3. **`hasWhen` accepts any key matching `/at$|date|updated|asOf|window|days/` in
   the same object** — an unrelated `days` field satisfies it. Presence of a
   date-shaped key is not evidence the date describes the figure. This is
   precisely the Block 2 trap, and the verifier would wave it through.
4. **Error 15 requires both venue fields to exist.** Omitting them defeats it,
   and omission is the normal state of our data.
5. **`rows > cases + 8`** grants eight unverified guards of slack before it
   complains.
6. **`const selfAware = true`** is a hardcoded constant that no code reads. It is
   a comment wearing a variable's clothes — the file's one self-check asserts
   nothing.

### It caught me, on the merged version, and it was right

The version I attacked was the one in my working tree; rebasing brought Tyler's
expanded verifier, which immediately flagged something I had done **this
session**:

```
[error 0 · coverage overclaim] demand reports 857 rows from an enrichment
sample of 12 chosen cards
```

Earlier I merged `enrichment-distilled.json` into `compute-demand`, taking
liquidity from 12 rows to 857. It looked like a large improvement. It is exactly
the thing assumption 2 forbids: those 861 cards are a **found** sample — whatever
came back while our set ids were being ignored, median price $0.49 — and
publishing liquidity across them reads as a market-wide figure. **Reverted.** The
distilled file goes back in when the run targets sets we chose.

That is the verifier doing precisely its job, on its author's behalf, against me,
within minutes of being merged. Whatever its blind spots, it earned its place today.

Is it strict enough? Not yet — but its *shape* is right, and that matters more.
Every rule is a real incident rather than a generic lint, and it runs on output
rather than intent. The fixes are narrow: drop the `> 1` floor, walk the whole
feed, require the date field to be adjacent to the figure it dates, and detect
hand-minting by comparing against pipeline output rather than by filename.

## BLOCK 5 — one prediction cannot fail, and one is true by construction

**`spread-retire` — cannot fail.** "No instrument built on the Spread will be
missed. If within 60 days we find ourselves wanting it back…" The falsifier is
*us noticing we want it back*. Nobody goes looking for a retired metric; absence
of demand is the default state, so this grades PASS by inertia on 22 October
whatever happens. **Rewrite before the check date.** Make it observable: name the
questions that would need it — "if any newsletter or reader question in 60 days
is answered by reconstructing a shipping-inclusive vs item-only comparison by
hand, the retirement was wrong" — so the grade turns on an event in the log
rather than on a feeling.

**`agents-advise` — the design it relies on is not the behaviour we have.** The
prediction reads as true by construction: agents advise and never block, so they
cannot cost a publication day. Except they do. `generate-pulse.mjs` exits **1**
right now, on a bias-agent finding:

```js
// generate-pulse.mjs:655
try { await import("./bias-guard.mjs"); } catch (e) { console.warn(`  ⚠ bias guard: ${e.message} — advisory`); }
```

The intent is clear and the mechanism defeats it. `bias-guard.mjs:100` sets
`process.exitCode = 1`, which is **not a thrown exception**, so the `catch` never
runs and the exit code survives the "advisory" wrapper untouched. Verified:
setting `process.exitCode` inside a `try` leaves it at 1 on the way out.

So the decision's central claim — only guards block — is false in the code as
it stands, and the prediction cannot be graded until that is settled. Either the
wrapper must reset `process.exitCode = 0` after an advisory import, or the
decision should record that agents do block. **Rewrite either way,** and the
falsifier should name the real exposure: "no security-agent finding will block a
run that a human then judges a false positive."

**`graded-withdrawn` — weak, and now overtaken.** Its falsifier ("if we find a
defensible way to publish without a window") depends on someone looking, and
nobody will while it is withdrawn. It also needs revisiting on the merits: Block
2 shows a per-grade window does exist on 22% of rows. Assign the search — name
the sources to test and the date — or it grades PASS by neglect.

**`everything-daily` — genuinely falsifiable, and worth watching.** Breach of
the allowance below ~18,000 items is observable and dated. Note that **we
breached the daily pool today** at a universe of ~16,675 items. The breach came
from one-off enrichment backfill rather than the daily refresh, so the prediction
is not falsified — but the headroom is thinner than the arithmetic assumed, and
that is exactly what its check date is for.

## Needs Tyler
1. **Re-run enrichment after 00:00 UTC.** `node scripts/enrich-by-set.mjs` — it
   resumes from the four held sets and now survives a 429 with its data intact.
2. **Block 2 changes the graded question.** Withdraw the raw `medianPrice`
   permanently; decide whether the 582 medium/high-confidence rows are worth
   building RT-5 on.
3. **Two predictions need rewriting** before their check dates.
4. **Read the dashboard balance** — our counter is a floor.

## Roads not taken
- Did not enumerate `/sealed-products` on an exhausted pool.
- Did not fix `verify-work.mjs`. Tyler wrote it and asked me to judge it; six
  blind spots reported rather than silently patched.
- Did not rewrite the two predictions myself — grading one's own falsifiers
  is how a prediction stops being one.

## Uncommitted / unverified
- **The 5,637 credits are gone with nothing to show.** Those 21 sets must be
  re-fetched.
- `/sets` cost remains unmeasured.
- The 861 cards on disk are still a **found sample, not a chosen one**. Nothing
  published may describe them as catalogue coverage.
- The six promo aliases in the set map are still my reading, unconfirmed.
