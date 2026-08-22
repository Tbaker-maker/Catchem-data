# Session report — condition prices, catalogue ingest, artist layer (2026-08-22)

`node scripts/audit.mjs` → **20/20 passed · report: research/audits/2026-08-22-audit.md**

## Wrong assumptions

**All three were wrong in some part, none fatally.**

1. *"PPT is used only by fetch-singles-enrichment"* — it is used by **five**
   scripts: build-crosscheck-map, extend-crosscheck-map, fetch-sealed-crosscheck,
   fetch-singles-enrichment, verify-watchlist-prices. This matters for block 1a,
   because usage is spread across five callers. Only **one** runs daily. The
   provenance half was right: singles are "TCGplayer market via pokemontcg.io".
2. *"ingest-catalogue writes metadata only, no prices"* — it captures
   pokemontcg.io's bundled TCGplayer price blocks too. Its own header note still
   says "NOT prices" and is stale. This is good news and reshapes block 3.
3. *"universe-advisor, artist-instruments and artist-angles all produce nothing"*
   — artist-angles produces 5 angles. It reads `data/artists.json`, not the
   catalogue, so it was never blocked. Only the other two were.

## Block 1a — real limits vs real usage

Docs, verified: API tier ($9.99) = **20,000 credits/day, 60 calls/minute**. No
monthly cap; credits reset daily. Billed on the **requested `limit`**, not
results returned — a default request costs 50 credits because `limit` defaults
to 50.

Our actual daily usage: **272 credits — 1.4% of the allowance.** One daily
caller (`fetch-sealed-crosscheck`), 136 reviewed entries at `limit=2`. The other
four PPT scripts are manual tools and are not on the schedule.

**Not verified: the live dashboard**, which is behind Tyler's login. Prepaid
credits or a custom cap would only show there. Every response carries
`X-RateLimit-Daily-Remaining`, so one authenticated call would confirm the real
balance — the key is Read-Host only and never persisted, so that needs Tyler.

## Block 1b — condition prices exist, and the LP index is buildable

**Yes, from PPT.** Not inferred — a real stored response
(`research/eval-samples/ppt-cards-history-RAW.json`, Umbreon VMAX) carries the
whole ladder at `prices.variants.<Printing>.<Condition>`: NM $112.64, LP $89.91,
MP $67.14, HP $50.74, DMG $39.38. Cross-keyed by printing, so a Reverse Holo LP
is its own figure.

The catch is cost, not capability: the ladder only appears with
`includeHistory=true`. Without it the same field holds a single
`"Near Mint Holofoil"` key. **NM index = 1 credit/card. Anything needing LP or
below = 2.** `listings` is null per condition, so depth cannot be split by
condition — prices only.

Nothing else has it. pokemontcg.io's TCGplayer block is keyed by **finish**
(`holofoil`: low/mid/high/market/directLow) with no condition anywhere. Its
Cardmarket block has `lowPriceExPlus`, which *is* condition-thresholded, but it
is one Excellent-or-better cut, in EUR, on the European market — wrong venue.

Full detail and the cost arithmetic: `research/condition-price-availability.md`.

## Block 2 — ingest

Four resume passes, keyless: 8,825 → 14,235 → 15,611 → **16,468 cards** across
174 sets, 15,241 with an artist credit, 15,727 with a price, **6.4 MB**, ~25 min
total. **126 sets complete.**

**48 sets are entirely missing.** neo2, si1, base6 (Legendary Collection),
ecard3 (Skyridge) and others return persistent 500s. Not our pacing, not fixable
by a key — a direct single-card request for each still 500s after four passes.

Fixed before running: the ingest slept a flat 150ms (400/min) against
pokemontcg.io's keyless ceiling of **30/min** (1,000/day; 20,000/day with a key,
both verified). A keyless run would have walked into 429s and reported the
catalogue as failed sets rather than as a throttle we chose to ignore.

## Block 3 — the tranche table, and why it understates

```
+25  cards → 8 artist cohorts → 1,047 catalogue cards analysable
+50  cards → 17 cohorts       → 2,018
+100 cards → 32 cohorts       → 3,452
+200 cards → 70 cohorts       → 5,791
```

**The advisor and the instruments disagree about what "priced" means.** The
advisor counts only `singles-prices.json` (137) and reports 4 of 342 artists
analysable. `artist-instruments` also reads catalogue prices and sees **15,736
priced cards and 295 artists with cohorts**. The expansion the advisor is
budgeting for has already happened, free, as a side effect of the ingest.

So the 500/1,000/2,000 costing the block asks for is **zero new calls** — those
prices are already on disk. The only real cost is *refresh*, and it is
set-shaped, not card-shaped: re-ingesting the whole catalogue is ~250–350 calls
regardless of how many cards it covers, which fits inside the keyless 1,000/day.

I verified the two sources are the same instrument before saying so: on 48
overlapping cards, 30 agree within 2% and the rest differ 2–4%, explained by
date (singles 08/18, catalogue 08/22), not by venue.

**Not implemented, deliberately:** I did not promote catalogue cards into the
tracked singles universe. It is free and available, so the number is purely
Tyler's call, and the advisor's ranking should be re-scored first because it is
currently ranking against the wrong denominator.

## Block 4 — artist layer

**380 illustrators. 295 with a real cohort of 3+ priced cards.**

**Zero attributions**, and that is correct rather than broken: attribution needs
returns, and the catalogue is a single snapshot. It needs a second day.

**No artist qualifies for an unscoped "ever" claim.** With 48 sets absent, any
of them could hold more of a given artist's work. Every count stays scoped.

### The underrated instrument is not publishable, and it took three tries to admit it
| control added | what it still produced |
|---|---|
| rarity only | 23 of 25 finds compared across mixed rarities; 7 commons under $2. Brute Bonnet, an Uncommon at $0.24, held against a $287.82 median — printed as "sits at $0" |
| + finish | Aya Kusube's "Rare Holo" cohort put a 2001 unlimitedHolofoil at $1,051 beside a 2022 reverseHolofoil at $0.24 |
| + era (±5y) | 5ban Graphics' Rare/holofoil peers near 2021 are two Celebrations bulk cards and two 2025 Victini chase cards, so $0.26 is measured against $565 |

The premise is the defect, not the thresholds. Price is driven by which Pokémon
is on the card, chase status and set scarcity — none of which we model — and
"Rare" is not a consistent tier across sets. It now carries `publishable:false`
with the reason. Tuning until the visible examples stopped looking embarrassing
would have been the same error as scoping a count but not the sentence built on
it.

## Needs Tyler
1. **How far to expand the priced universe.** It is free and already ingested;
   the table is above and the number is yours.
2. **A free `POKEMONTCG_API_KEY`** — 1,000/day → 20,000/day. Getting one needs
   an account, which I cannot create. It would not fix the 48 dead sets.
3. **One authenticated PPT call** to confirm the live credit balance against
   the published tier limits.
4. **Whether to build the LP index at all**, now that it is confirmed possible
   at 2 credits/card.

## Roads not taken
- Did not promote catalogue cards into tracked singles (Tyler's number).
- Did not re-score the universe advisor to count catalogue prices — it is the
  right fix, but it changes what the tranche table means and I would rather
  report the discrepancy than quietly redefine his decision inputs.
- Did not keep tuning the underrated instrument. Three controls in, the pattern
  was the answer.
- Did not wire `universe-advisor` or `artist-instruments` into the pipeline.
  Both still call `process.exit(0)` when data is missing — harmless as CLI
  tools, fatal the moment anyone imports them, which is precisely how
  rasterize-cards skipped publish-assert this morning.

## Surprises, including my own
- **I nearly reported the catalogue as 100% complete.** "15,718 of 15,719
  expected" looks total until you notice a set whose count call failed
  contributes zero to *both* sides. Failed sets are invisible to their own
  completeness metric.
- The audit read **19/20** and blamed the guards: "9/18 guards proved real". All
  nine failures were `/tmp` hardcoded in the negative-test harness, plus one
  Windows `file://` import. The guards were fine the whole time. **Fifth**
  instance of this gotcha here. Fixed → 18/18 → **20/20**.
- pokemontcg.io returns 200-with-empty-body as well as 500s under load. `r.ok`
  is true for those, so a naive read files a real card as missing data.

## Uncommitted / unverified
- The 48 missing sets are **not** recoverable by retrying; they are upstream 500s.
- Attribution has never produced a verdict on real data — it needs tomorrow's
  catalogue to compare against.
- The condition ladder is verified on **one** card. That it is populated for
  every card, and how far back the history goes on our tier, is unconfirmed.
- `data/card-catalogue.json` is 6.4 MB and now committed; nothing has assessed
  what that does to clone size or CI checkout time over months of daily commits.
