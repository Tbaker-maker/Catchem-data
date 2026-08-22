# Session report — TCGplayer figure provenance verification (2026-08-22)

**Task:** verify region + filter behind our tcgMarket figures (US marketplace?
standard shipping?), and whether TCGplayer market price includes shipping at
all, since our eBay figures are delivered totals.

## Verdict — every question answered, none ambiguous

**1. Region/currency: CONFIRMED US marketplace, USD.**
- PPT scrapes tcgplayer.com directly: raw response carries `lastScrapedAt`
  and `tcgPlayerUrl` → `www.tcgplayer.com/product/...` (the US site; the UK
  marketplace is a separate domain).
- Empirical to-the-cent match against the US site's displayed Market Price:
  swsh7-booster-box **$2,460.46 exact**, swsh5-pack **$9.23 exact**,
  swsh7-pack 42.04 vs 42.15 one refresh apart.
- PPT's API docs denominate min/maxPrice filters in **USD**; their EUR lane
  is a separate opt-in Cardmarket beta we never request.
- **No region, currency, or filter parameters exist on the endpoint** — there
  is nothing set wrong because there is nothing to set. No change needed.

**2. What the figure IS: TCGplayer Market Price = recent completed SALES.**
TCGplayer's help center defines it as an outlier-trimmed average of actual
recent transactions. This **corrects our Aug-18 internal note** claiming PPT
sealed prices are "ASK-derived" — base1 flat 35 days meant *no recent sales*
freezing the average, not a stale ask. Flat TCG line = illiquidity.

**3. Shipping: item-only, confirmed.** TCGplayer's own CSV price-point
taxonomy keeps "TCG Low **w/ Shipping**" as a separately labeled point —
Market Price and every unlabeled point exclude separately-charged shipping.
This lands on a topic the fleet moved on mid-session (see below).

**4. The routed API question (a1251fc "routed for API investigation"):**
a shipping-inclusive TCG figure is **not retrievable** through PPT — the
sealed endpoint exposes only `unopenedPrice`. TCGplayer's own API is
partner-gated. "Label rather than estimate" stands for displays.

## Concurrency note — chat session landed first, merged cleanly
While this audit ran, commits 8b35152/abb4123/a1251fc landed the wrong-sign
fix, the delivered-vs-delivered Spread model (est. $4.99 under $40), and the
pricing-basis law. This session's findings were merged ON TOP, not over:
their paragraphs kept verbatim, my sold-derived + US/USD facts folded in.

## Changes shipped
- `scripts/compute-divergence.mjs` — header + `method` string rewritten:
  source-verified provenance, sold-derived correction, delivered-vs-delivered
  basis acknowledged; negative-spread read string now says "TCG sales average
  trailing a falling market" instead of "stale TCG-side price".
- `scripts/mint-cards.mjs` — #the-spread second paragraph rewritten: names
  Market Price as recent-completed-sales, US-verified, no hidden regional
  variant; negative gaps fight the definition; flat line = no recent sales.
- `scripts/generate-pulse.mjs` — Spread signals header: "recent sales + est.
  shipping".
- `research/house-theses.md` — new entry: TCG SOURCE VERIFICATION, answering
  the routed question, with falsifier (PPT shipping new fields).
- All artifacts regenerated on current code: 135 compared, **29 signals**
  (matches the corrected count), pipeline green through publish-assert.

## Flagged for Tyler (not resolved by me)
Mild ruling tension, documented in house-theses: the comparability law added
est. shipping to the Spread's *math*; the pricing-basis law says
label-rather-than-estimate for *surfaces*. Current state is defensible
(instrument estimates and says so; displays label), but if you want the
Spread de-estimated too it's a one-constant revert in compute-divergence.
