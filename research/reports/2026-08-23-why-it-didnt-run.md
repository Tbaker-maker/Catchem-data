# It fired and failed — and the graded withdrawal is what killed it (2026-08-23)

`audit.mjs` **18/20** · `negative-tests.mjs` **61/61** · `verify-work.mjs` 4 (none new) ·
`slop-guard.mjs` clean · `designer.mjs` runs · `pre-mortem.mjs` **22/22 declared** ·
`heartbeat.mjs` **red, correctly**

## One assumption is wrong, and it matters

**"Chat can't reach the Actions API without auth, which is itself the finding."**
`gh` is installed on this machine and authenticated as `Tbaker-maker`. The run
history was one command away. Everything below came from it.

The other three assumptions hold.

## BLOCK 0 — it FIRED AND FAILED. Not a missed trigger.

```
2026-08-23 04:38 · schedule · completed · failure · 32618362607
```

```
 5. success   Guard audit
 6. failure   Unit tests (fail-fast)   <<<
 7. skipped   Fetch sealed prices from eBay
    …all 15 remaining steps skipped
```

The assertion that failed:

```
✗ latest-graded.svg exists nonzero — missing
```

**The chain, and every link was correct on its own.** We withdrew graded figures
because the source carries no window → `dailyThree.graded` went falsy →
`mint-cards.mjs`, which mints that card *only when the data exists*, stopped
producing it → the stale committed copy was deleted (`5c9d52d`, 02:11) →
`run-tests.mjs`, which asserted all four cards **unconditionally**, failed → and
it runs in the **fail-fast gate, before the fetch**.

**A correct editorial decision took the whole pipeline down through a test that
asserted a FILE rather than a BEHAVIOUR.**

Compounding it: **`mint-cards.mjs` was in no workflow at all.** The tests were
asserting committed fossils that nothing regenerated — the same class as
`rasterize-cards` yesterday. Now wired as step 16, and a card is required exactly
when the `dailyThree` entry that drives it is present. Tests: **36 passed, 0 failed.**

*Not mine.* My verify-work attack created and removed an **untracked** file of
that name; the tracked one was already gone.

### The retry is built, and deliberately not trusted

Per the doc: cause first. **This failure is deterministic — a retry would have
failed identically at the same assertion.** So the mechanism exists for transient
causes, and `data/recovery-log.json` records the attempt so the *next* watchdog
escalates instead of looping.

## BLOCK 1 — the notice DID reach Discord. It just said nothing useful.

The secret exists and the step ran: **`Failure reported: unknown step`**.

It asks the API for its own job's steps *while that job is still running*, so
nothing carries a `failure` conclusion yet. A failure skips every later step, so
it now names **the last step to complete**.

**And a bug I nearly shipped while fixing it:** putting `continue-on-error` on
the heartbeat (needed so the retry can branch on it) means the **job stays
green**, so the existing `if: failure()` alarm would never fire again. Branching
on the step outcome instead. *An alarm wired to a condition that cannot occur
reports silence as health* — which is this morning, one layer along.

Also found: the digest delivery step is **newer than the last successful run**,
so it has never actually executed. It will on the next green run.

## BLOCK 6 — the declarations, judged

Mostly good: specific, each citing a real incident. Four criticisms:

- **`heartbeat.mjs`** says it detects *missed* runs. Today's run was **not
  missed** — it fired and died at step 6, and the heartbeat still reports
  "MISSED A SCHEDULED RUN … the run did not happen." The **alarm is right and the
  diagnosis is wrong**, and those demand opposite responses: retry vs fix.
  Undeclared, and it is the most consequential gap in the file.
- **`guard-audit.mjs`** declares it cannot tell whether a wired guard asks the
  right question. The larger gap is undeclared: it reports "pipeline steps
  present" and **cannot see a step that should exist and does not**.
- **`verify-work.mjs`** declares "cannot: Reasoning." True, and the comfortable
  answer. Its real misses are **scope**: sub-dollar figures under a `v > 1`
  threshold, anything outside `dailyThree`, a venue mismatch with the fields
  absent. Concrete, fixable, hidden behind an admirably humble word.
- **`card-guard.mjs`** cannot tell that the PNG a reader receives is not the SVG
  it validated — every card PNG was stale and imageless for exactly that reason.

**Four new shapes added**, all from failures that shipped today: *assertion with
no producer* · *verdict from an empty sample* · *alarm on an unreachable
condition* · *enforcement only in the presentation*.

**And two faults in my own additions, both caught by running it.** `pre-mortem`
read **its own source**, so the shape table matched every shape it hunts —
fourth instance of a checker whose search space includes the checker. And the
empty-sample shape flagged **`falsifier.mjs`**, the one guard whose entire design
is to answer INSUFFICIENT rather than guess. Shapes now carry an `unless` clause:
a shape present alongside its mitigation is not a finding.

## BLOCK 4 — VOID, not negative

**11 of 12 cards returned HTTP 429** — rate-limited by the daily run I had just
dispatched — so **zero were compared**, and my probe still printed *"NO DROP,
consistent with an all-time aggregate."* My bug from yesterday: **a conclusion
drawn from no data reads exactly like one drawn from data.** It now returns VOID
and retries a 429 twice. The parameter evidence from yesterday is unaffected.

## BLOCK 2 — the card wrote the joke

`ingest-catalogue.mjs` now keeps `attacks`, `attackNames` and `flavorText`.
Names are parsed out of the source's concatenated form:

```
'[2] Gatling Peck (10x) Flip 5 coins…'  ->  'Gatling Peck'
'[1] Take It Easy (20)'                  ->  'Take It Easy'
'The Pokemon this card is attached to…'  ->  dropped, not guessed
```

**Measured, not assumed:** on the 861 cards we hold, **attacks 75%, flavour text
24%** — against the 82% and 40% claimed. Probably sample skew (these are the
found sample, heavy on old bulk), but the verifiable numbers are the lower ones.

pokemontcg.io is returning **HTTP 500**, so the fields were backfilled from the
provider payload we already hold — which needed `ppt-set-map.json`, because
joining on raw set names matched 198 of 861 and through the map, 481.

New theme kind **`card text`**: membership is *read* from `attackNames` rather
than declared as a list of Pokémon somebody thought looked tired. **Honest state:
the late-night theme currently finds nothing** — 383 cards carry attack names and
none are sleepy, because the enriched sample is old bulk. The mechanism works;
the corpus does not yet. Index cost 1.70MB, unchanged to two decimals; flavour
text deliberately excluded from the browser index (~470KB for prose no search needs).

## BLOCK 5 — three hold, one broke

| attack | result |
|---|---|
| singles sell via substring | **HOLDS** — refuses, disables, and refuses the console bypass |
| want list, 9 cards, 3 unpriced | **HOLDS** — "+3 unpriced" in the tally *and* the image |
| trade mode at 390px | **HOLDS** — one 342px column, no horizontal scroll |
| **long label on a 9-card grid** | **BROKE IT** |

The footer band is not a fixed height: a post reserves 110px, want/trade/sell
reserve **190** for the intent label and total. The caption was drawn at `H-150`
regardless, so a two-line label printed **straight through "Looking for"**. Now
measured from the band. My own fix then failed to parse — a `const` inside a
brace-less `for` — which **the emit-guard caught immediately**. That guard has
paid for itself twice in two days.

## BLOCK 3 — not done

The submission decision on `smartMarketPrice` was not built. Blocks 0, 1, 2, 4, 5
and 6 each turned up a defect that needed fixing rather than noting — a dead
pipeline, an alarm that could not fire, a probe that ruled on nothing, a caption
through a label. I would rather hand back six blocks verified than seven with one
unexamined.

## Needs Tyler
1. **The dispatched run was still in flight at write-up** (past the eBay fetch, on the PPT crosscheck). The two audit failures are the freshness guard correctly refusing to ship today's date over yesterday's market; they clear when it commits.
2. **The heartbeat's diagnosis needs splitting** — "did not fire" and "fired and failed" need different responses.
3. **Block 3 is unstarted.**
4. The graded probe needs a re-run **when nothing else is calling the provider**.

## Uncommitted / unverified
- The retry-once-then-escalate path has **never fired**. It is validated by YAML parse and reading, not by a real red heartbeat at watchdog time.
- The digest delivery step has still never run on a green run.
- `attackNames` covers 383 of 16,468 cards until an ingest succeeds.
- The late-night theme returns nothing today, by data rather than by defect.
