# THE BIG DATABASE EXPANSION — free, one run
*Tyler, Aug 23: "our database needs to be as large as we can make it
without costing a crazy amount."*

## WHAT IT COSTS: nothing
pokemontcg.io is free. An API key (free, instant, no card) raises the rate
limit from 1,000/day to 20,000/day. Every card object bundles TCGplayer
price data — the same venue our sealed pack basis already uses — so this
is not a second opinion, it is the same source at a much larger scale.

## WHAT IT BUYS
- **Metadata for every card in every set we touch.** Artist, name, number,
  rarity, release date. Roughly 60 sets.
- **Prices on thousands of cards** instead of the 137 we track by hand.
- **Artist counts become defensible.** With complete set coverage, "three
  cards, total" stops being a claim we cannot support and becomes a fact
  we can source — which is exactly what the Artist Claim Law requires
  before an "ever" statement.
- **Cohorts become real.** RT-7 needs three priced cards per illustrator
  to say anything. Today almost nobody clears that bar. After this, most
  working illustrators will.

## THE COMMANDS
```
export POKEMONTCG_API_KEY=...        # free from pokemontcg.io/api, optional but faster
node scripts/ingest-catalogue.mjs     # every set we track; resumable, skips what it has
node scripts/artist-instruments.mjs   # cohorts, attribution, underrated
node scripts/artist-angles.mjs        # the content drafts
```

## WHAT TO WATCH FOR
1. **Rate limiting.** Without a key it is 1,000 requests/day. The script
   paces itself at ~150ms and pages 250 cards at a time, so a full run is
   roughly 60-120 requests. It should fit either way, but get the key.
2. **Set id mismatches.** Our internal ids mostly match pokemontcg.io, but
   not always — anything in the failures list needs a manual mapping.
3. **Price provenance.** Catalogue prices are marked `catalogue`; our own
   tracked feed is marked `tracked` and always wins. Never let a mixed
   figure appear without saying which source it came from.
4. **Do not delete singles-prices.json.** The tracked feed stays the
   verified spine; the catalogue is breadth around it.

## THE HONEST LIMIT
Catalogue prices are a daily snapshot, not our own measurement. They are
good enough for cohort analysis and content, and NOT good enough to
headline as a verified price without saying where they came from. The
chip rules apply exactly as they do everywhere else.
