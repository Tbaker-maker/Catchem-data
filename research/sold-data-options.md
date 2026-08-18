# Sold-Listing Data — Options & Architecture (Aug 18, 2026)

**Why:** active listings = ask; sold = truth. Vintage boxes have no active
market (validated Aug 18), and every median we publish gets stronger with a
sold-side anchor. Sold and ask are DIFFERENT provenance classes — never mixed
silently. Heat engine stays ask-based (it measures listing behavior); sold
becomes the truth-anchor layer.

## Door 1 — Official API: closed (for now)
eBay Marketplace Insights = the sanctioned sold API (90-day window), but
Limited Release; docs state restricted/not open to new users; small devs
report denials (community threads, Dec 2025–Aug 2026). ACTION: file the
application anyway (free lottery ticket, documents good-faith intent),
plan around denial.

## Door 2 — Manual sold verification: OPEN TODAY, zero build
Approved evidence sources for human verification + Reported citations:
- **eBay sold/completed filter** (browser) — primary comps check.
- **130point.com** — community-standard sold lookups, reveals accepted
  best-offer amounts BIN listings hide. Manual only.
- **Terapeak / Product Research** (inside eBay Seller Hub) — eBay's own
  sold analytics, free WITH a seller account. [TYLER: do you have an eBay
  seller account? If yes this is our best manual tool.]
USE NOW FOR: verifying vintage floors CC just set; spot-auditing any
suspicious median; a monthly manual sold-comp line for no-active-market
SKUs in the newsletter ("Base Set Unlimited boxes: last verified sales
$X–$Y, eBay sold comps via 130point, <date>" — Reported class).

## Door 3 — Paid sold-data source: EVALUATE (pick one, ~2 weeks)
Shortlist for programmatic vintage + sold-cross-checks:
1. **PriceCharting API** — sold-based prices, historically strong on
   vintage sealed + graded; paid tier w/ API. (Pricing/coverage: verify.)
2. **PokemonPriceTracker** — KB's paid fallback ($9.99/mo Pro). [TYLER:
   are you already subscribed?] Verify whether it exposes SOLD data + API.
3. **SoldComps-class vendors** — keyed-in-minutes sold JSON, ~90-day
   window (vendor claims — Reported). Diligence required: they exist by
   scraping; vendor ToS posture is a counsel question (add to IP brief
   consult as housekeeping item).
Eval criteria: covers OUR vintage box SKUs · handles best-offers · cost ·
compliance posture · update cadence. One small eval script per finalist,
then commit to one.

## Decision now
Tier 1 (manual) activates immediately. Tier 3 application filed. Tier 2
evaluation opens after the 70-SKU production run stabilizes. No scraping,
ever, per Trust Standard.
