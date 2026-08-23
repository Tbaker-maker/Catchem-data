# The streak gave two creators the same series, and the daily cap killed the run (2026-08-23)

`audit.mjs` **18/20** · `negative-tests.mjs` **62/62** · `verify-work.mjs` 4 (none new) ·
`slop-guard.mjs` clean · `designer.mjs` runs · `pre-mortem.mjs` **23/23 declared** ·
`editor-smoke.mjs` **loads clean** · `heartbeat.mjs` **red, correctly**

All four assumptions hold. Block 3's *capture* was already built last session —
what was missing was the filter, which is now in.

## BLOCK 1 — closed, and the cause was worth the dig

The guard called `distil()` against `data/enrichment-raw.ndjson`, **which is
gitignored**. So it passed on the one machine that had run the enrichment and
failed on every other one: **green for me, permanently red for you, same
commit.** A test whose answer depends on the laptop is not a test.

Fixed by making the round-trip prove itself — the guard writes a one-card NDJSON
fixture to a temp dir and reads it back through a new `distilFrom(dir)` export.
**Verified by hiding both raw files** so this desk looked like yours: **62/62
with them gone.**

## BLOCK 2 — the run got further, then died on a starved dependency

My dispatched run cleared the unit tests (this morning's fix held) and died at
**step 14, Generate Morning Pulse**:

```
✗ SCHEMA GUARD — data/divergence-report.json.rows: 0 rows, expected at least 67
  — this is the shape of a run that silently lost most of its data
```

The guard was right and **named the victim, not the cause**. Two steps earlier:

```
✓ sealed-crosscheck.json: 0 live / 137
```

Every SKU returned 429. The provider is explicit:

```json
{"error":"Daily rate limit exceeded","limitType":"daily",
 "resolution":"Daily credits exhausted","resetsAt":"2026-08-24T00:00:00.000Z"}
```

**That is my doing.** The enrichment runs at 00:39 and 01:48 UTC *today* spent
the pool, and everything PPT-dependent since has been rate-limited. The
crosscheck is `continue-on-error`, so it reported success while returning
nothing, and the failure surfaced two steps later attached to the wrong file.

**Three fixes, all the same principle — a provider outage must degrade, not kill:**

1. **The Spread keeps yesterday's rows** when the crosscheck returns nothing
   comparable, marked `dataStatus: "stale-upstream"` with the reason. This is
   the zero-result safety sealed prices have had since August, applied to the
   second dataset that needed it. Proved by simulation: emptied the crosscheck,
   **135 prior rows kept and marked stale** rather than overwritten. New guard
   covers it.
2. **A daily cap is not retryable.** The crosscheck was retrying all 137 SKUs
   four times each with up to 30s backoff — **over two hours of grinding** while
   the real answer arrived in the first response. It now stops on the first
   `limitType: "daily"`.
3. The failure notice now names the last step to complete rather than
   "unknown step" (fixed earlier today).

**Honest status: the run was still in flight at write-up**, stuck in exactly the
crosscheck grind that fix 2 addresses — the fix is committed but that run started
before it. The two audit failures are the freshness guard correctly refusing to
publish today's date over yesterday's market; they clear when a run commits.

## BLOCK 5 — two creators got the same series

| attack | result |
|---|---|
| 20 days, no repeats | **HOLDS** — 60 served, 60 unique, zero repeats |
| ordered walks in sequence | **HOLDS** — 1999 Base into Fossil, never backwards |
| **two creators diverge** | **BROKE IT** |

The seed was `streak.started + streak.day`, and the comment above it claimed two
creators on the same filter *"diverge immediately."* They did not diverge at
all — same filter and same start date is the same seed. Two fresh streaks
started on the same day returned **byte-identical picks for five consecutive
days**:

```
A day1: zsv10pt5-111,rsv10pt5-129,me1-139
B day1: zsv10pt5-111,rsv10pt5-129,me1-139   ← identical, and so were days 2-5
```

Fixed with a salt drawn once per streak and stored with it, so a series stays
stable across reloads for its owner and differs from everyone else's. **Verified:
three creators, same filter, same day, three different series** — and re-verified
that 20 days still serves 60 unique cards.

*The comment had been sitting above code that could not deliver what it claimed.*
That is what `pre-mortem` calls a guard aimed slightly beside the thing it
guards, in prose form.

One observation, not a defect: the chronological streak orders by card **name**
within a set rather than collector number. Arbitrary, harmless, worth knowing.

## BLOCK 4 — the queue, and two judgements

**9 of 9 questions addressed to cc are answered.** Five remain for you. The
designer's threshold moved from a flat 2px to **12%** since I last answered these
— the right change, and it altered none of the answers, because every flagged
pair is under 8%.

**Does the streak bar read as the hero?** **Neither hero nor notification —
because of position, not treatment.** Measured live with a streak running, the
bar sits at **top: 2063px**: two thousand pixels down, below the funnel, the
ideas list and the binder. A hero is decided by position first and treatment
second, and no accent makes something the hero of a page you scroll past
everything to reach. The treatment itself is fine — a 38px day number in the live
green, wash genuinely faint at `rgba(54,211,153,.05)` — but **the accent is not
exclusive: six other elements carry the same green**, so the bar competes rather
than commands. Two cheap changes settle it: move it above the funnel while a
streak is active, and take the green off the other six while it is. Otherwise
stop calling it the hero; it is a good status strip.

**Do the slab colourways look like a product?** **No — they read as four accent
variants of one dark chip.** Measured relative luminance:

| | case | edge | label | accent |
|---|---|---|---|---|
| green | 0.007 | 0.035 | 0.019 | 0.497 |
| gold | 0.006 | 0.032 | 0.011 | 0.417 |
| black | 0.003 | 0.017 | 0.007 | 0.291 |
| ice | 0.005 | 0.029 | 0.011 | 0.430 |

Every case is near-black and opaque; **the label is darker than the edge in all
four**. A real slab is the opposite — a *clear* case showing the card, with a
*bright opaque label band* as the brightest element. Only the accent differs
between colourways, so they are one design in four hues. Making the label the
brightest element would do more than any further hue work.

**Caveat, and it matters:** screenshots are unavailable in this session, so both
answers are measurement plus CSS, **not eyes on the rendered page**. On whether
the wash reads tasteful or muddy against the panel I cannot answer honestly and
did not guess.

**Paging holds.** Jump to page 400 of 458 in **70ms**; subsequent pages **6–8ms**;
36 results each.

## BLOCK 3 — the filter, which was the missing half

The capture landed last session: 383 cards carry `attackNames`, parsed out of the
source's concatenated form (`'[1] Take It Easy (20)'` → `'Take It Easy'`). What
was missing was a filter that reads them. Two, with the word lists in the open
where they can be argued with:

- **`says-hit`** — "Cards that just hit things", pool **71**, verified driving a
  real streak: *Timburr «Knock Back/Low Kick»*, *Litleo «Combustion/Headbutt»*.
- **`says-rest`** — "Cards that tell you to rest", pool **0 today**. That is data,
  not defect: only 383 of 16,468 cards have attack names until an ingest
  succeeds, and the enriched sample is old bulk. Slakoth is not in it yet.

## Needs Tyler
1. **PPT resets 00:00 UTC.** Until then every PPT-dependent step degrades rather than fails, which is the intended behaviour now but means The Spread will be `stale-upstream` on the next run.
2. **The streak bar's position** is the decision — hero above the funnel, or accept it as a status strip.
3. **Slab labels should be the brightest element**, not the darkest.
4. Five questions remain in the queue.

## Uncommitted / unverified
- **The dispatched run had not finished at write-up**, and started before the daily-cap short circuit landed — so it is still grinding the crosscheck it now knows to skip.
- The retry-once-then-escalate path has still never fired for real.
- `says-rest` returns nothing until an ingest fills `attackNames` beyond the enriched sample.
- Both Block 4 judgements are measurement, not eyes.
