# Sealed Expansion Campaign Map — 2026-08-18 (STOP: one review, then batches auto-execute)

Derived programmatically (pokemontcg.io sets index × data/sealed-products.json
tracked subtypes × KB critical-SKU rule/error #6). 48 gap sets, 82 raw missing
SKUs; below is the curated proposal in ≤25-SKU batches. Rules carried: every
SKU validates live before commit; ⚠comps = set >3yrs old, current-comps check
with dated evidence REQUIRED before bounds finalize (Hidden Fates lesson);
new SKUs enter with day-one safety (no prev history → no query_error trap;
thin first fetch publishes "unavailable", never a junk price).

Batch 1 (DONE, 96e5aec): 24 PC-ETBs → catalog at 94.

## Batch 2 — modern bundles + SWSH gap sets (~24 SKUs)

Bundles, hot-headroom bounds [20–250] (151/PF/AH precedent), existence
verified at validation:
| id | set | note |
|---|---|---|
| me1-bb | Mega Evolution | |
| sv10-bb | Destined Rivals | |
| sv9-bb | Journey Together | |
| sv8-bb | Surging Sparks | |
| sv7-bb | Stellar Crown | |
| sv6-bb | Twilight Masquerade | |
| sv5-bb | Temporal Forces | |

SWSH sets (all ⚠comps — bounds finalize at execution with dated evidence;
prelim windows below are placeholders from era heuristics):
| id | subtype | prelim bounds | note |
|---|---|---|---|
| swsh1-booster-box | booster-box | [150–1500]⚠ | SwSh base |
| swsh2-booster-box / swsh2-etb | bb / etb | [150–1500]⚠ / [50–400]⚠ | Rebel Clash |
| swsh3-booster-box / swsh3-etb | bb / etb | [200–2000]⚠ / [50–500]⚠ | Darkness Ablaze (Zard halo) |
| swsh4-booster-box / swsh4-etb | bb / etb | [150–1500]⚠ / [50–500]⚠ | Vivid Voltage |
| swsh5-booster-box / swsh5-etb | bb / etb | [150–1500]⚠ / [50–400]⚠ | Battle Styles (set-name safety: "battle" excl auto-dropped) |
| swsh6-booster-box / swsh6-etb | bb / etb | [200–2000]⚠ / [80–600]⚠ | Chilling Reign |
| swsh8-booster-box | booster-box | [150–1500]⚠ | Fusion Strike (ETB tracked) |
| swsh45-etb | etb | [150–1200]⚠ | Shining Fates (products-only ✓) |
| swsh35-etb | etb | [150–1200]⚠ | Champion's Path (products-only ✓) |

## Batch 3 — SM mainline (24 SKUs, ALL ⚠comps, thin-market expected)

sm1–sm12 (Sun & Moon → Cosmic Eclipse), BB + ETB each. **Expectation set
honestly:** SM booster boxes trade $800–$5,000+ and several will land
no-active-market-thin like vintage — proposal is to enter them ANYWAY with
comps-set floors, and flag `activeMarketThin: true` on any SKU whose
validation shows <5 genuine listings (extends the vintage ruling's logic to
near-vintage; needs your explicit OK — see flag J5). Bounds all TBD at
execution from PriceCharting/eBay comps with dated notes.

## Batch 4 — specials, Evolutions, product-line sweep (~12 + judgment items)

| id | subtype | prelim | note |
|---|---|---|---|
| sm35-etb | etb | ⚠comps | Shining Legends (products-only ✓) |
| sm75-etb | etb | ⚠comps | Dragon Majesty (products-only ✓) |
| det1-etb | etb | ⚠comps | Detective Pikachu (products-only ✓) |
| xy12-booster-box | booster-box | ⚠comps, likely [2000–10000] | Evolutions — near-vintage; activeMarketThin candidate |
| xy12-etb | etb | ⚠comps | Evolutions ETB |
| zsv10pt5-etb / zsv10pt5-bundle | etb / bb | [50–400] / [20–250] | Black Bolt |
| rsv10pt5-etb / rsv10pt5-bundle | etb / bb | [50–400] / [20–250] | White Flare |
| pgo-etb | etb | ⚠comps | Pokémon GO — see flag J2 |
| me2pt5 + me-era tins | tin | [15–150] | AH Tins + Mega Forces Tins land Aug 28 — add release week (radar item) |

## Judgment flags — rulings requested (the only decisions in this review)

- **J1 — 151 booster box (sv3pt5-booster-box): DO NOT ADD (recommended).**
  KB line 181 lists 151 among BB sets, but the English product line is
  bundle/ETB/UPC only — no 36-pack BB (our sv3pt5-bb IS the bundle). If you
  confirm, KB line 181 gets a loud dated correction and this becomes
  known-error #8. If I'm wrong and an English 151 BB exists, say so and it
  enters Batch 2 with comps.
- **J2 — Pokémon GO: products-only?** Not in the KB's products-only list, but
  no standard BB existed to my knowledge. Proposed: add pgo to the
  products-only list (dated note) + track pgo-etb only.
- **J3 — SV Energies (sve): EXCLUDE entirely** — not a collector sealed line.
- **J4 — 2021-era bundles (swsh5–8, cel25, swsh12pt5):** bundle products may
  not exist for these sets (bundles standardized ~2022). Proposed: probe at
  validation; nonexistent → dropped silently with a note, no SKU created.
- **J5 — near-vintage thin-market handling (SM era + xy12):** extend the
  activeMarketThin/no-active-market mechanism to any new SKU validating at
  <5 genuine listings? (Vintage ruling currently covers only the 6 WOTC/HGSS
  boxes.) Recommended: yes.
- **J6 — UPC/premium/tin sweep beyond the table above:** deliberately NOT
  proposed this campaign except the Aug 28 tins — one wave at a time
  (capacity is not obligation). Confirm or expand.

## Post-approval mechanics (auto-execute, no further stops)

Per batch: comps checks (dated) → bounds → live validation with titles →
audit file → commit → crosscheck-map extension under the same auto-approve
rule (HOLDs accumulate to ONE consolidated list at campaign end). Singles
Mode B runs after sealed batches: top-3 per set auto-added needsReview:true,
enrichment parameterized to all confirmed entries.

## Capacity math at full build-out (~156 sealed SKUs)

- eBay: 156 × 3 pages ≈ 468 calls/day — under 10% of the 5k/day budget.
- PPT: ~95 crosscheck + ~60 singles-enrichment ≈ 155 credits/day of 20k.
- Runtime: ~9–10 min/run at current pacing — within Actions defaults; NO
  workflow change required (if pacing ever needs it, a v2.2 patch gets
  PRINTED, not written).
