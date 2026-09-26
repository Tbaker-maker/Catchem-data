# Heat Check

Heat Check is a score for one sealed Pokémon product. It is not a price, and it is not a promise about what happens next.

## What goes in

Each input is compared with that same product's own last 90 days. The comparison is a z-score: how unusual today's reading is next to that product's recent readings.

- **Listings (40%)**. The change in how many eBay listings are up. Fewer listings scores hotter. More listings scores colder. This is a count of listings, not a count of copies that changed hands.
- **TCGplayer market price (30%)**. The last 7 days of TCGplayer market price, compared with the last 30. This is only used when we have 30 days of that price. We do not fill in days we do not have.
- **Google Trends (20%)**. Interest in the set or the Pokémon. If the lookup fails, this input is left empty.
- **YouTube (10%)**. How many new videos mention the set. This needs its own 90-day trail before it can be a z-score. We do not have that trail, and no API key is set, so this input is left empty.

A product gets a score when at least one input has 30 days behind it: 30 one-day changes in listings, or 30 days of TCGplayer market price (with 30 momentum readings to compare against). An input that is short is left empty and the score is marked partial. A product with neither is left out.

Listing changes are only counted between two days in a row. Our eBay history has a gap from 2026-08-26 to 2026-09-21, and the jump across it is not treated as one day's change.

TCGplayer market price history comes from two labelled sources: PokemonPriceTracker daily history (TCGplayer-derived) from 2026-03-31, and TCGCSV live days from 2026-09-25. On a day both have, the TCGCSV price is used. A series whose newest price is more than 3 days old is not used.

## The number

The weights of the inputs we actually have are applied to their z-scores. The result is turned into a score from 0 to 100. 50 means the inputs we have are sitting where they usually sit.

| Score | Label |
| --- | --- |
| 0–20 | Cold |
| 21–40 | Cool |
| 41–60 | Steady |
| 61–80 | Warm |
| 81–100 | Hot |

If an input is missing, the score is marked partial and that input is shown as empty. We do not pretend it was measured.

Products on the quarantine list, and products whose eBay titles are the wrong item, are not scored.
