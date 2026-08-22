# PENDING FOR CC — what the Breaker found that chat cannot fix
Chat cleared everything in its lane: HIGH 25 → 2, and the remaining
findings all need a browser, a network chat does not have, or the app repo.

## HIGH — both live in catchem-app
1. **Deploy smoke test** (blank-page class, rendered DOM). Registered in
   the safeguard registry; nothing deliberately breaks it. Break it — ship
   a deliberately blank render to a preview — and confirm the smoke test
   fails. If it passes, the guard does not exist.
2. **Mode Honesty Law** (§20 — the displayed-figure multiset must be
   identical across modes). Same: make one mode drop a figure on purpose,
   prove `mode-diff-test.mjs` fails, restore. Note it currently cannot run
   at all without a browser (`no Chrome/Edge found`), so this is doubly
   urgent — a guard that cannot run is decoration.

## MEDIUM — hosts chat cannot reach
Simulate three failure modes for each, and note that the THIRD is the one
nothing tends to handle:
- **down** (connection refused)
- **slow** (hangs past any timeout we set)
- **200 with plausible garbage** — valid JSON, right shape, wrong numbers
Hosts: `catchemtcg.com`, `app.catchemtcg.com`, `tcgplayer-cdn.tcgplayer.com`,
`images.pokemontcg.io`.
Chat already covered the in-pipeline version of the garbage case and our
gates caught it; this is the network-facing half.

## THE STANDING RULE
Every fix gets a row in `scripts/negative-tests.mjs`, not a promise. A
guard is not real until breaking it fails the build — and `guard-audit`
now fails if the harness has fewer cases than the registry has guards.
