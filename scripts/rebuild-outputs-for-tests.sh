#!/usr/bin/env bash
# Rebuild derived outputs so tests run against today's builders, not stale
# committed files. Used by pr-tests.yml and update-sealed-prices.yml.
# Does not commit. Nightly triage reads /tmp/rebuild.log after this script.
# Every builder runs even when one fails; each failure is written in the
# test log format. This script itself exits 0 so the caller can triage.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: > /tmp/rebuild.log
echo "── rebuild ──" >> /tmp/rebuild.log
ok=0; bad=0
step() {
  if node "scripts/$1" > /tmp/rebuild-step.log 2>&1; then ok=$((ok+1)); echo "  ✓ rebuild: $1" >> /tmp/rebuild.log
  else bad=$((bad+1)); tail -20 /tmp/rebuild-step.log; grep -E "Error|FAIL" /tmp/rebuild-step.log | head -5 | sed 's/^/    FAIL /' >> /tmp/rebuild.log; echo "  ✗ rebuild: $1" >> /tmp/rebuild.log; fi
}
step build-tcgcsv-catalogue-map.mjs
step build-premium-ratio.mjs
step build-public-bundle.mjs
# Score rip value after the bundle applies price holds. A held card
# stays out. Writing rip only after the tests is why run 42245422004
# failed on a real catalog price.
step build-rip-roi.mjs
# Long index history after the bundle rewrites indexes.json. Guard values
# and the full series stay in catchem-data-private.
step build-index-history.mjs
step build-condition-ladder.mjs
step build-feed.mjs
# The first feed after a new price day still carries the previous board.
# A second pass settles it, which is what the determinism test rebuilds.
step build-feed.mjs
step check-board-sync.mjs
step write-morning-card.mjs
step write-feature-data.mjs
echo "" >> /tmp/rebuild.log
echo "$ok passed · $bad failed" >> /tmp/rebuild.log
cat /tmp/rebuild.log
exit 0
