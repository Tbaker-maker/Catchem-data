# Expansion Waves — filling 20k/day capacity without breaking the machine

Rule: capacity is not obligation. Every tracked item enters through the
wave process that produced Aug 18's 23-for-23 record: propose → bounds →
validate against live data → id-map row → commit. Unvalidated items never
touch production. Unused credits cost $0; poisoned data costs trust.

## Wave A — Singles chase ladder (12 → ~60-80) — THIS WEEK
The community-defined chases per era, on the locked taxonomy
(grail/flagship/key/notable). Candidates come from DATA, not memory:
**build `scripts/propose-watchlist-candidates.mjs`** — for each modern set
(swsh1→me5), pull top-N cards by TCGplayer market via pokemontcg.io,
emit research/watchlist-candidates.md grouped by set with prices.
Tyler curates with collector judgment (slang names, cultural weight —
the data proposes, Tyler disposes). Confirmed picks enter with the same
needsReview flow as the first 12. Cost: $0 (pokemontcg.io).

## Wave B — Graded layer (NEW dimension) — DESIGN FIRST
If PPT exposes graded prices (Tyler eyeballed raw+graded in dashboard —
CC probe must confirm endpoint + shape):
- Track PSA 10 + PSA 9 (min viable) for confirmed chases only.
- New provenance class "graded" — never mixed with raw (Trust Standard).
- THE METRIC: **Grading Premium** = (PSA10 − raw − $79.99 grading floor)
  per card — "worth slabbing?" answered daily. Grader's Corner data spine.
- Design questions for CC probe: grades available? population data?
  freshness field? credits per call?

## Wave C — Sealed depth (70 → ~150-200) — AFTER A+B STABLE
Fill era gaps (SWSH/SV sets not yet tracked, UPCs, premium collections,
tins per set). Same per-SKU bounds discipline; batches of ~25 max per
wave, each with its own audit file. Vintage additions wait for the
sold-comps layer — no more active-ask vintage.

## Capacity math (sanity)
200 sealed (eBay: 600 calls/day of 5k free) + 200 sealed crosscheck +
80 singles raw + 160 graded rows ≈ well under 1k PPT credits of 20k.
The constraint is validation bandwidth, never API capacity.

## Sequence gates
1. NOW: id-map review (CC's STOP) → workflow v2 live
2. Wave A candidate generator + Tyler curation pass
3. Wave B probe results → design sign-off → graded fetch
4. Wave C batches, 25 at a time, audit each
