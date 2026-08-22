# SAFEGUARD REGISTRY
*The canonical list. If a safeguard isn't here, it doesn't exist as far as
the company is concerned. Adding one requires: a manifest entry in
scripts/guard-audit.mjs, a negative test that proves breaking it fails,
and a row in this table.*

**Standing law:** a guard is not real until breaking it fails the build.
Reading the code proves nothing — three of our four worst bugs passed a
code read and were caught by a human or a simulation.

## THE LAYERS

**Layer 0 — WIRING.** `guard-audit.mjs`. Holds a manifest of every guard
and the exact code paths that must consume it. Runs first in the pipeline;
fails before any data is fetched if a guard is defined but disconnected.
*Exists because: a quarantine flag was set correctly and read by nothing.*

**Layer 1 — INTAKE.** Filters at fetch time: scam vocabulary, damage
words, language, per-class price bounds, currency (USD-only), and the
multi-item guard (lots / cases / x2 / bundles). Anything that fails never
enters the dataset.

**Layer 2 — MEASUREMENT.** `qa-gate.mjs`. Blocks a product from every
editorial surface when its number looks corrupted: >30% overnight median
move (filter drift, not market), >60% from TCGplayer on a both-venues
product, fewer than 5 listings, measured 2+ days ago, or manually
quarantined. Blocked ≠ hidden: it stays on the Board, labelled.

**Layer 3 — DURABILITY.** `data/quarantine.json`. Founder-QA holds survive
regeneration. *Exists because a hand-edit quarantine was wiped by a rebuild.*

**Layer 4 — LANGUAGE.** `voice-lint.mjs` blocks prediction language and
warns on flat-voiced READs. `jargon-lint.mjs` blocks unexplained hobby
terms and named constructs the piece never defines.

**Layer 5 — ARTIFACT PROOF.** `publish-assert.mjs`. Runs LAST. Greps the
actual published output for anything blocked or quarantined, and breaks
the edition entirely if the catalogue is stale or the fetch was partial.
*Exists because flags are not proof.*

**Layer 6 — AUDIT.** `audit.mjs`. The repeatable checklist, including live
failure simulations. Restores every file it touches.

## THE REGISTER

| # | Safeguard | Layer | Blocks or warns | Negative test | Last proven |
|---|---|---|---|---|---|
| 1 | Guard wiring manifest | 0 | blocks run | delete the blockedIds filter → audit fails | 2026-08-22 |
| 2 | Multi-item listings (lots/x2/cases) | 1 | rejects listing | title fixtures reject, singles keep | 2026-08-21 |
| 3 | Currency guard (USD-native) | 1 | rejects listing | manifest-checked | 2026-08-22 |
| 4 | Price bounds per class | 1 | rejects listing | in unit tests | 2026-08-19 |
| 5 | Venue boundary (RT-4a) | 2 | strips signal | manifest-checked | 2026-08-22 |
| 6 | Seasoning (90-day) | 2 | excludes from index | manifest-checked | 2026-08-22 |
| 7 | Thin-sample premium gate | 2 | flags ⚠ | me1 shows n=7 | 2026-08-21 |
| 8 | QA gate (drift / cross-source / thin / stale) | 2 | blocks publication | stale simulation | 2026-08-22 |
| 9 | Manual quarantine durability | 3 | blocks publication | survives a full rebuild | 2026-08-22 |
| 10 | Voice lint (prediction language) | 4 | blocks | certainty fixtures | 2026-08-21 |
| 11 | Jargon lint (unexplained terms, named constructs) | 4 | blocks | caught "the fastest identification test" | 2026-08-21 |
| 12 | Publication assert (artifact grep) | 5 | blocks edition | caught 4 real leaks on first run | 2026-08-22 |
| 13 | Stale-edition breaker | 5 | blocks edition | 4-day outage simulation | 2026-08-22 |
| 14 | Partial-fetch breaker | 5 | blocks edition | half-fetch simulation | 2026-08-22 |
| 15 | Run-level wipe guard (fetch) | 1 | refuses overwrite | CI run 32546016295 caught live | 2026-08-22 |
| 16 | Content sanity (silent empty run) | 5 | blocks edition | empty-feed + no-headline simulations | 2026-08-22 |
| 19 | Referee Doctrine (adversarial framing) | 4 | blocks | "outsmart vendors" / "beat the dealer" fixtures block; neutral copy passes | 2026-08-22 |
| 18 | Daily Three freshness rotation | 2 | excludes repeats | 7-day simulation: 7/7 unique picks | 2026-08-22 |
| 17 | Merge-by-date guards (all histories) | 1 | prevents overwrite | 8-vs-329 unit test | 2026-08-19 |
| 19 | Deal Zone model contract (§19 — app rates come from the feed) | 0 | blocks run | rename feeTiers in compute-derived → audit fails | 2026-08-22 |

## AUDIT CADENCE
- **Every run:** layers 0, 2, 4, 5 execute inside the pipeline.
- **On demand / weekly:** `node scripts/audit.mjs` — the full checklist
  with simulations, writes a dated report to research/audits/.
- **When a bug escapes:** log it in RESEARCH-GATE.md's error ledger with
  its CLASS, build the guard for the class, add it here, prove it by
  negative test. Fixing the instance is not the lesson.

## KNOWN UNGUARDED (honest list)
- Research facts rely on the four-part gate (source / second look / date /
  chip) enforced by discipline, not code. A fact linter is not built.
- Binder-page card art availability is unverified from this environment.
- Newsletter copy is linted manually before each send, not in CI.
