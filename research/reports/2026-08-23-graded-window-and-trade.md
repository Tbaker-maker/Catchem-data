# The graded window settled, and the sell refusal defeated by three letters (2026-08-23)

`audit.mjs` **20/20** · `negative-tests.mjs` **59/59** · `verify-work.mjs` 4 (none new) · `slop-guard.mjs` clean · `designer.mjs` runs

## Assumptions
1 and 2 hold — the editor parses, the emit-guard is wired, and `centering-math.mjs`
is pure (zero fetch/image references; it takes four margins and returns ratios).
3 holds. **Block 3 was not done — see the end.**

## BLOCK 1 — settled. There is no window, and your read was right.

**PPT documents no window for `ebaySold` and accepts no period parameter.**
Three independent lines of evidence:

**The provider's own API says so.** Sending `period`, `from`, `to` and `window`
returns a 400 that lists what it will accept:

```json
{ "error": "Invalid parameter(s)",
  "message": "Unsupported query parameter(s): id, period, from, to, window",
  "allowedParameters": ["tcgPlayerId","cardId","setId","setName","set","search",
    "rarity","cardType","artist","minPrice","maxPrice","sortBy","sortOrder",
    "limit","offset","includeHistory","includeEbay","includeBoth","days",
    "limitDays","fetchAllInSet","language","lightweight","printing","condition",
    "maxDataPoints","includeCardmarket"] }
```

The only time parameters are `days`, `limitDays` and `maxDataPoints`.

**`days` provably drives price history only.** Same card, four requests:

| request | `metadata.historyWindow` | psa10 count | psa10 median | eBay range |
|---|---|---|---|---|
| `days=7` | **7d** | 40 | $168.50 | 2026-05-27 → 2026-08-18 |
| `days=90` | **90d** | 40 | $168.50 | 2026-05-27 → 2026-08-18 |
| `days=180` | **180d** | 40 | $168.50 | 2026-05-27 → 2026-08-18 |
| none | **30d** | 40 | $168.50 | 2026-05-27 → 2026-08-18 |

The history window moves; **the graded aggregate does not move at all.** Nothing
we can send reaches it. (`days=730` also caps to 180 — the 6-month tier ceiling,
confirmed in passing.)

**The date spans rule out a rolling window.** Across 309 graded cards the
`dateRangeStart`/`dateRangeEnd` span runs **0 to 513 days**, only 13% near 90,
earliest start **2025-03-15**. No rolling 90-day window can contain a 513-day
span.

**The probe re-snapshot** at +4h resolved 5 of 12 cards, zero drops — too short
to be decisive, which is exactly why it is a probe.
`scripts/graded-window-probe.mjs` now runs it repeatably and **compares by card
id, never by position**, which is the mistake the doc warns about. Re-run after
2026-08-30; a single dropped count reverses everything above.

**Consequence: raw `ebaySold.medianPrice` stays withdrawn.** Recorded in
`data/knowledge.json` as `ebaysold-has-no-window`, VERIFIED, with the probe as
its falsifier.

**The narrow unblock stands.** `smartMarketPrice` *does* carry `daysUsed`
(median 90) and a `confidence`, on 582 of 2,669 grade rows at medium or high.
That is a different number from `medianPrice` and the only defensible graded
figure available. Sessions 3 and 4 should be built on it or on nothing.

## BLOCK 5 — the singles-sell refusal was defeated by the letters t-i-n

The refusal decided whether a card was a single by testing its **name**:

```js
!/booster|elite trainer|bundle|collection|tin|box/i.test(c.n)
```

`tin` matches inside **Dra-tin-i**, **Figh-tin-g Energy**, **Man-tin-e**,
**Vic-tin-i**. **174 real singles read as sealed.** A tray of three of them
produced a finished 2535×1390 sell image of stock art — the exact
misrepresentation the refusal exists to prevent, with no warning shown.

**Fixed at the root rather than the regex.** Every card in the tray *is* a
single: `card-index.json` is generated from the singles catalogue and contains
no sealed products at all, so classifying by name was unnecessary as well as
wrong. Classification now reads a `kind` flag, and absence of a flag means
single — it fails toward refusing.

**A second hole in the same attack:** the refusal lived only in
`el("make").disabled`. A disabled attribute is an affordance, not a guard —
re-enabling it in the console produced the image. The handler now re-checks at
the point of action. Verified: force-enabling and clicking is refused, no image.

| attack | result |
|---|---|
| singles sell image | **BROKE IT** — fixed twice over, both verified |
| want list, 9 cards, 3 unpriced | **HOLDS** — declares "+3 unpriced" in the tally *and* in the rendered image; per-card prices render for the priced ones and unpriced cards carry no price rather than a guess |
| trade mode at 390px | **HOLDS** — a media query stacks the four steps to one 342px column, select full width, chips wrap, no horizontal scroll |

## BLOCK 2 — measuring well, but I am not claiming the ±2 bar

`scripts/centering.mjs` finds the four border margins and hands them to the pure
math. Every result carries its detected edge coordinates, because verify-work's
rule applies to a ratio exactly as it does to a price.

**Ten cards: 7 measure at high confidence** (0–1px median absolute deviation
across nine sample lines per side). **3 correctly refuse** — they are full-art
cards with no border, so a border ratio does not exist and the tool returns
nothing rather than something.

My first confidence metric was wrong and would have buried the good results.
Max-minus-min called almost everything low confidence: Base Set Charizard scored
26px on samples of `[45,19,22,19,19,19,21,20,19]` — one line of nine hit the
1st-edition stamp and ran deep while the other eight agreed within 3px. Median
absolute deviation ignores it.

**The bar is not formally met and I am not going to say it is.**

- internal precision **0–1px**, which on a 19–29px margin is **0.85–1.3 points**
- accuracy verified by **overlay on 2 of 10** cards, one vintage and one modern —
  the detected box sits on the border's inner edge to the pixel in both
- the doc asks for **ten hand-measured** cards. I did two. Provisionally inside
  ±2, formally unproven.

**The caveat that matters more than the error margin:** this measures
**publisher scans, not photographs**. A scan is already cropped to the card, so
there is no outer-edge detection problem — the image edge *is* the card edge. A
phone photo has background, glare, perspective and a card that is not
axis-aligned, and this code attempts none of it. **The two queued questions —
foil under a phone flash, bad light at a show — are not edge cases of this
implementation. They are a different problem it does not yet touch**, and
session 5's card-show mode depends on that problem, not this one.

## BLOCK 4 — the trap is respected, and now guarded

`pokemon-sets-database.json` lives in `research/archive/2026-08-19-outputs-rescue/`,
not in live data, so I verified against what actually ships.

**Zero of 9 specialty sets carry a booster-box SKU. 47 mainline sets do**, so the
rule is not vacuous. `schema-guard` now fails the build if a specialty set ever
gains one, with a negative test that plants one deliberately.

I produced **8 false positives on the first pass** by matching booster-**pack**
alongside booster-**box**. Specialty sets genuinely have loose packs — 151,
Prismatic Evolutions, Crown Zenith and the rest all do — and conflating the two
is its own version of the mistake I was checking for.

## BLOCK 3 — not done, and I would rather say so

Sealed listing images with net proceeds were not built. Blocks 1, 2, 4 and 5 each
turned up a defect that needed fixing rather than noting — a defeated refusal, a
wrong confidence metric, eight false positives of my own making — and I would
rather hand back four blocks verified than five with one unexamined. The fee
maths already exists in the divergence work; this is a surfacing job, not a
computation one, and it is the cleanest thing to pick up next.

## Needs Tyler
1. **Re-run the probe after 2026-08-30.** One dropped count reverses Block 1.
2. **Decide whether `smartMarketPrice` is enough** to build the submission decision on. It is the only windowed graded figure that exists.
3. **Ten hand-measured cards** would settle the ±2 bar. I can measure them, but the ground truth has to come from somewhere other than the same detector.
4. **Block 3** is unstarted.

## Uncommitted / unverified
- The ±2 point error margin is **provisional**, from 2 overlays and internal precision, not 10 hand measurements.
- `centering.mjs` is unwired to the editor and runs from the CLI only.
- The 3 full-art refusals are correct behaviour but mean the tool covers bordered cards only — which is most of the catalogue, not all of it.
- `verify-work`'s 4 findings are pre-existing: card-composite out-of-pipeline (deliberate, pending the storage decision), a single-pack price, the unviewed-image counter, and 8 facts on secondary sources.
