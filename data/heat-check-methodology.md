# Heat Check

Heat Check is a score for one sealed Pokémon product. It is not a price, and it is not a promise about what happens next.

## What goes in

Each input is compared with that same product's own last 90 days. The comparison is a z-score: how unusual today's reading is next to that product's recent readings.

- **Listings (40%)**. The change in how many eBay listings are up. Fewer listings scores hotter. More listings scores colder. This is a count of listings, not a count of copies that changed hands.
- **TCGplayer market price (30%)**. The last 7 days of TCGplayer market price, compared with the last 30. This is only used when we have 30 days of that price. We do not fill in days we do not have.
- **Google Trends (20%)**. Interest in the set or the Pokémon. If the lookup fails, this input is left empty.
- **YouTube (10%)**. How many new videos mention the set. This needs its own 90-day trail before it can be a z-score. We do not have that trail, and no API key is set, so this input is left empty.

A product needs 30 days of listing changes before it gets a score. Anything short of that is left out.

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
