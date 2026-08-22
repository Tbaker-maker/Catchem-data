# Session report — TCG shipping retrievability, fetch audit, image audit (2026-08-22)

Four blocks requested. Block 2 was already done and is skipped. Blocks 1, 3
and 4 each turned up something bigger than the block asked about.

## Assumptions — three held, one was stale, and one framing was wrong

Held: TCG figures are item-only with no shipping component; pack-basis prices
31 of 34 live pack SKUs from TCGplayer with exactly sv4pt5/swsh12pt5/swsh45
lacking mappings; `priceItemMedian` was not in today's rows.

Stale: `house-theses.md` no longer *ends* with the PRICING BASIS LAW — my own
TCG SOURCE VERIFICATION entry follows it, and its "ruling tension — flagged
not resolved" note was overtaken by 8739773 the same day.

Wrong in a way that mattered: `priceItemMedian` was described as landing "from
the next run onward". It would never have landed. The code that writes it
threw a ReferenceError on every SKU (see block 3).

## Block 1 — can we get shipping-inclusive TCG prices? No. Not at any price.

**PokemonPriceTracker**: no shipping, total-cost, or lowest-listing field on
any tier. Their sealed endpoint exposes a single `unopenedPrice`. A
`shippingCost` field DOES exist in their schema but only inside `soldListings`
for **eBay graded sales**, gated to Business ($99/mo) and Enterprise ($300/mo)
— irrelevant to TCG sealed shipping, but see the roadmap note below.
Tiers: Free $0 / API $9.99 / Business $99 / Enterprise $300.

**TCGplayer's own API**: closed. Their docs state they are "no longer granting
new API access at this time." Not a pricing question — the door is shut.

**So the gap cannot be filled from any source we can buy.** "Label rather than
estimate" is not a temporary posture, it is permanent with current sources.

### The estimate was still running, and its constants were wrong
The no-guess law (8739773) forbade inventing shipping, but
`compute-divergence.mjs` was still adding $4.99 to every TCG figure under $40
— 32 of 135 rows published a spread computed off a guessed number while the
regenerated methodology said we never guess. Removed.

Worse, verified against TCGplayer's help centre: their free-shipping tiers are
**$50** on Direct ($3.99 under) and seller-set elsewhere (commonly $5), not
$40 — and free shipping "only applies to small items (normal-sized singles)",
which **excludes sealed product outright**. The old model therefore zeroed
postage on the 103 rows above $40, where it is in fact never zero.

### Recommendation on the fork: retire the Spread as a headline
Keep it as a footnote stat, labelled. Reasoning:
1. Every row is biased in a **known direction** (overstates eBay's premium) by
   an **unknowable amount**. A number we know is wrong but cannot correct is
   not a signal, it is a liability.
2. The bias is worst where prices are smallest — which is now the pack class,
   the exact class we display from TCGplayer.
3. A second asymmetry compounds it the same way: our side is asks, theirs is
   completed sales. Asks sit above solds.
4. Removing the estimate moves signals 29 → 44. Those 15 extra "signals" are
   the artefact of a bias, not market events. Publishing them as signals would
   be the most misleading thing on the site.
Footnote framing keeps the honest part (two marketplaces disagree, here is the
raw pair) without dressing a definitional gap as a finding.

## Block 3 — the fetcher was broken, not just thin

A single-SKU validation run found the fetcher **crashing on every product**.
Four ReferenceErrors, all in code added with the 2026-08-23 diagnostics and
two-medians work: `it.title` where the param is `i` (×5), `kept` inside
`aggregatePrices` (the *same* error the comment three lines below it warns
about), `report` in `shipKnownPct`, and `samples` in the caller. Every SKU
errored, 0 went live, and only the run-level wipe guard stopped a wiped file
from being written. **The next scheduled CI run would have failed outright.**

With diagnostics finally working, the thin-pack answer: of sv10-pack's 79
exclude rejections, `lot` (25) and `packs` (19) are correct, but bare **"art"
killed 15 legitimate single packs** — booster packs ship with several wrapper
artworks, so sellers write "Random Art" / "(1) Random Pack Art". Narrowed to
art card/cards/print/set/display; genuine art sets still caught (`art set`: 2
on the same SKU).

Result across the class: **sv10-pack 13 → 23 kept**, and after the full run
all 35 pack SKUs are live with **none under 10 listings** (mean 38.8).
`priceItemMedian` now writes for 35 of 35 — for the first time ever.

## Block 4 — the image audit found a pricing bug

A full 179-image eyeball ran 2026-08-21 (7 overrides, all still honored, and
**xy12-etb was already fixed** — its URL returns HTTP 200). So this pass
audited the delta: 90 photos changed in the fetch, of which only 12 actually
reach a screen (seller photos are a fallback; most products display the
TCGplayer catalogue shot). All 12 eyeballed. Nine correct. Three written as
overrides: `sv1-bundle` (showed a **Destined Rivals** bundle), `swsh1-bundle`
(showed **Lost Origin**), `swsh12pt5-pc-etb` (Crown Zenith **ETB PLUS**, a
different and pricier product than the plain PC-ETB this SKU prices).

The two wrong-set photos were symptoms. The first set of an era is named after
the era, and every later set carries the era in its branding, so a substring
set-gate made base-set SKUs match their **entire generation**:

| SKU | published | over | reality |
|---|---|---|---|
| sv1-bundle | $72 | 90 listings | top kept: Paldean Fates $224.99, two 151 bundles ~$200. Real product ~$25 |
| swsh1-bundle | $190 | 22 listings | kept Lost Origin $249.98, Crown Zenith $229.98 |
| sm1-booster-box | $2,014.95 | 75 listings | 88 of 150 name another Sun & Moon set |

`me1-*` was already immune because someone hand-wrote 6–10 `excludeExtra`
entries per SKU. Generalised rather than repeated: `eraBaseSet` SKUs reject any
title naming a different tracked set, with `SHORT_SIBLINGS` covering sets under
`SET_NAME_LIST`'s 6-char floor. 10 SKUs flagged; `me1-*` left alone.

## Two guard failures found while cleaning up after the above

**The publication assert was not running.** `rasterize-cards.mjs` called
`process.exit(0)` when `@resvg/resvg-js` was unavailable. `generate-pulse`
imports it as one link in a chain ending voice-lint → jargon-lint →
publish-assert, so that exit ended the whole run **with a success code** and
the last line of defence never executed. Only the linux-x64 resvg binary is
vendored, so every local run took that path — CI was fine, but any human
session could have committed artifacts the assert would have rejected. A
skipped step now skips its own work instead of taking the process with it.

Note for the registry: `guard-audit` asserts publish-assert is LAST in the
chain. That was true and still gave false confidence, because nothing checked
the chain actually *reaches* it.

**The held label had the publishBlock timing hole.** The feed marked held
products from the live flag only, which every fetch rebuilds and wipes, so a
manually quarantined product walked back into the Board feed unlabeled. The
assert caught it the moment I quarantined six SKUs. Now reads the durable file.

Both of my own mistakes this session were caught by the house's own guards —
the assert caught the unlabeled row, and the jargon linter caught me writing
"the set-name gate" into text that ships publicly as `heldReason`.

## Needs Tyler

1. **The Spread fork** — retire to footnote (my recommendation) or keep with a
   permanent label. This is the only block-1 question I did not decide.
2. **Do sv1-bundle and swsh1-bundle have a real market?** Post-fix they keep
   **0 genuine listings** out of 123 and 52. Either the products are barely
   traded or my sibling rule is too strict for them. Until you rule, they sit
   in `query_error`, which **preserves the old contaminated price** — so they
   are quarantined this session rather than left publishing $72 and $190.
   Same question for `sm1-booster-box` (5 kept) and `swsh1-booster-box` (4).
3. **PPT licensing, now urgent.** `ppt-licensing-note.md` sets a publication
   gate: no PPT-derived number ships publicly until licensing is cleared in
   writing. The pack-basis change means **31 pack prices in the public feed
   are PPT-derived right now**, and the docs restrict commercial use to the
   $99 Business tier while we are on $9.99 — their marketing page contradicts
   their own docs on this. The email in that note is still unsent.
4. **`sleeved`** is now the largest remaining exclude term (25 on swsh7-pack,
   11 on sv10-pack). Sleeved boosters are genuine single packs sold at retail,
   usually at a premium. Distinct SKU or should they price in? Your call.
5. **Acrylic-case photos** — `sv1-pc-etb` and `sv3-pc-etb` display correct,
   single-unit, correct-set products sitting inside collector display cases.
   The `sm8-booster-box` precedent overrode that class. I left these alone
   rather than blank two otherwise-good photos on a presentation judgment.

## Roads not taken

- Did **not** retire or de-headline the Spread myself — you asked for a
  recommendation, and it is a product decision.
- Did **not** rip out pack-basis over the licensing gate. It is Tyler's RT-4b
  ruling; I fixed its defects and escalated the conflict instead.
- Did **not** re-audit all 179 images. The delta was the honest surface and
  re-eyeballing unchanged photos proves nothing.
- Did **not** hand-write `excludeExtra` lists per era SKU (the `me1-*`
  approach). It works but does not survive the next set release.

## Surprises

- The diagnostic feature added to explain thin SKUs was itself crashing the
  fetch, and the wipe guard — written for a previous instance of this exact
  bug — is the only reason a wiped file was never committed. It has now paid
  for itself twice.
- `aggregatePrices` broke the same way twice, with a comment in place warning
  about it. A comment is not a guard.
- An image audit found a five-figure pricing error. Looking at pictures turned
  out to be a better data-quality probe than reading numbers.

## Uncommitted / unverified

- The app changes (`basis` chip, null-safe share-card `fmt`) are **committed
  but not deployed** — `wrangler deploy` is blocked by this session's
  permission classifier, so the public site still serves the pre-fix build.
  One command, in the terminal summary.
- The Spread's ask-vs-sold bias is **stated, not quantified**. Quantifying it
  needs sold data we do not have.
- Real TCGplayer postage on sealed remains **unmeasured**, permanently, with
  current sources.
- The six quarantined SKUs are held, **not fixed**. Their correct prices are
  unknown until you rule on whether those products still trade.

Final state: `node scripts/audit.mjs` → **18/18 passed**. Pipeline green end to
end (15 guards wired, jargon 0 blocking, publication assert 8 blocked and none
on any of 6 published surfaces, 10 image overrides all human-verified).
