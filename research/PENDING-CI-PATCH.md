# PENDING: guard-audit CI step (needs workflow scope — CC applies)
My token cannot modify .github/workflows/. This is the exact change.

## What to add
In `.github/workflows/update-sealed-prices.yml`, immediately BEFORE the
`- name: Unit tests (fail-fast)` step, insert:

```yaml
      - name: Guard audit (fails the run if any safeguard is disconnected)
        run: node scripts/guard-audit.mjs
```

## Why it matters
guard-audit.mjs already runs inside the pipeline (generate-pulse imports
it first), so protection exists today. The CI step makes it fail-fast —
before eBay fetches and PPT credits are spent — and surfaces the failure
as a red step instead of a late error.

## Validation ritual (required before push)
1. yaml parses · exactly one top-level `name:` key
2. step list printed in the commit message
3. run the workflow once and confirm green

## Standing rule this establishes
Adding a new guard REQUIRES adding its wire assertion to the MANIFEST in
scripts/guard-audit.mjs. A guard is not considered real until a negative
test proves that breaking it fails the audit.
