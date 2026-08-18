# Pathogen Sweep Audit — the overwrite class — 2026-08-18

Trigger: three independent hits in one day (singles resolver, enrichment
v1-v3, verify gate 8-vs-329). Every writer of accumulating state audited.

## Verdicts (22 writer scripts examined)
| Writer | Target | Verdict |
|---|---|---|
| compute-heat-states | heat-history.json | SAFE — dedupe-today + append + 120d trim |
| fetch-sealed-crosscheck | crosscheck-history.json | SAFE — dedupe day+id + append + trim |
| verify-watchlist-prices | watchlist-price-verify.json | FIXED 991f2c3 — merge-by-id |
| fetch-singles-prices | singles-prices.json | FIXED earlier — carry-forward on error |
| **fetch-singles-enrichment** | singles-enrichment.json | **PATHOGEN — FIXED tonight**: merge-by-cardId; error rows demote prior good rows to stale, never destroy |
| **build-crosscheck-map** | crosscheck-id-map.json | **TRAP — GUARDED**: wholesale regenerator now refuses when a map exists unless FORCE_REBUILD=yes (extend-crosscheck-map is the daily path) |
| send-discord-alerts | alerts-state.json | SAFE BY DESIGN — last-run state, wholesale is correct semantics |
| pop-velocity | pop-snapshots.json | SAFE — read-only (human-entered snapshots) |
| fetch-sealed-prices | sealed-prices.json | ACCEPTED — daily rebuild with per-product prev-carry; not append-class |
| generate-pulse | research/pulse/<date>.* | SAFE — per-date files |
| board/derived/divergence/supply-watch/content/post-ideas/weekly/arc-kit | various | SAFE — stateless rebuilds of daily views |
| extend/rescue map scripts | crosscheck-id-map.json | SAFE — incremental merge, review states preserved |

## Unit tests — 8-row-run-vs-329-row-dataset scenario
7/7 PASS (logic-replica tests, scratchpad/test-pathogen.mjs): verify
(334 survive, fresh wins collision) · enrichment (error demotes not
destroys; good replaces good) · heat-history append · crosscheck-history
dedupe-append. Plus one live-fire proof: the verify dataset itself was
restored 8→337 from git during the incident.

## Class verdict: KILLED. Every accumulating writer now merges; the one
wholesale regenerator requires explicit intent; doctrine in CLAUDE.md.
