# The creator editor — build your own combo (CC scope)

Tyler, 2026-08-23: *"Make it so content creators can edit and make their own
card/visual combos. This is a great way of getting people back every day."*

He is right about the mechanism, and it is the one thing the current page does
not do. Today a creator picks from ten pairings we chose. That is a menu, and a
menu is something you read once. **An editor is something you come back to,
because the next idea is yours rather than ours.**

## WHAT IT NEEDS

**Search across all 16,468 cards.** By Pokémon name, by illustrator, by set,
by year. The catalogue is already client-loadable as JSON — filter in the
browser, no backend.

**A tray.** Click to add, click to remove, drag to reorder. The layout table
picks the frame from the count automatically — 1, 2, 3, 4, 6, 8 or 9 — and
tells them when a count has no layout and what the nearest one is.

**Their own label.** One line of text, theirs, not ours. Every angle we offer
is a starting point and this is the same principle: the words have to be
theirs or fifty accounts post the same sentence.

**Live preview + the three transfer paths** already built in
`card-composite.mjs`: Download PNG, Copy image, Share.

## WHAT MUST NOT BE EDITABLE
- **The watermark.** Three points: footer wordmark plus two faint diagonals set
  into the artwork at 16% opacity. Cropping past the second one means cropping
  into the cards themselves. Deliberately faint, because a watermark that ruins
  the image protects nothing — nobody posts it in the first place.
- **The illustrator credit.** It renders from the card data and cannot be
  cleared. An uncredited art post already refuses to build.

## THE BACKFILL WORTH DOING FIRST
`data/knowledge.json` → `artist-credit-backfill-gap`, VERIFIED today:

Missing illustrator credits are a **dataset lag, not a Pokémon decision**. 1–4%
of cards are missing artist data every year from 2002 to 2023 — then **43.7% of
2024**, 29.3% of 2025, 23.8% of 2026. Every physical card prints "Illus. name"
on its face, so the credit exists and the community dataset has not caught up.

The gap sits in exactly the sets people are opening right now: Surging Sparks
252, Mega Evolution 188, Prismatic Evolutions 180, Stellar Crown 175.

**If we backfill those, we hold better artist data than the source everyone
else uses** — in the one content lane we have already proved works. Worth
contributing back upstream too; it costs nothing and it is the right thing.
