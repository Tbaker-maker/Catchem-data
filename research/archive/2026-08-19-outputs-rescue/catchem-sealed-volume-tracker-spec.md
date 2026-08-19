# Catch'em Sealed Volume Tracker — V1 Spec

**Status**: Designed Apr 24, 2026. Build phase post-V1-launch (target V1.5 or V2).
**Owner**: Tyler / Catch'em Intelligence
**Architecture**: Extension of Catchem-data bot (existing eBay API integration)
**Tier**: Free at launch (Pro hooks latent in data model)

---

## 1. What it is (one paragraph)

A dual-signal heat-map for every English Pokemon TCG sealed product. For each SKU, track **supply** (active listings count, daily snapshot) and **inferred volume** (estimated dollar value of listings that disappeared between snapshots) week-over-week. Combine the two signals into a four-state indicator that tells collectors whether a product is heating up, cooling down, distributing, or stagnating. Built on the eBay Browse API the Catchem-data bot already uses — no new API approvals required. Free at launch, drives traffic to Catch'em Intelligence, becomes the differentiator versus Collectrics' singles-focused tooling.

**Architectural choice (Apr 24, 2026)**: Volume is INFERRED from daily snapshot diffs (listings that disappeared = inferred sales) rather than measured directly from eBay's sold-listings data. eBay's Marketplace Insights API exists for precise sold data but requires Business approval and lead time. Daily-snapshot inference is 70-80% accurate for trend detection (which is what heat states measure) and uses 100% existing infrastructure. Marketplace Insights upgrade path preserved for Phase 3 if precision becomes valuable.

---

## 2. The four states

The product surfaces ONE of four labels per SKU per week:

| State | $ Volume WoW | Supply WoW | Label | Meaning |
|---|---|---|---|---|
| 🔥 **Squeeze** | ↑ | ↓ | "Heating up" | Money chasing fewer copies. Price likely moves up. |
| 📈 **Distribution** | ↑ | ↑ | "Active market" | Money flowing but supply meeting demand. Healthy. |
| ❄️ **Capitulation** | ↓ | ↑ | "Cooling off" | Sellers dumping. Price likely drops. |
| 😴 **Stagnation** | ↓ | ↓ | "Quiet" | Nobody trading. Forgotten or held tight. |

**Threshold for "↑" vs "↓"**: ±10% WoW change. Anything within ±10% is "stable" — render as the dimmer version of the same state.

**Edge cases**:
- New listing with no prior week → mark "New tracking" for first 2 weeks
- Fewer than 5 sales in the week → mark "Thin data" and don't issue a state
- Discontinued/sealed product unavailable for years → still tracked, but tagged "Vintage hold" not states

---

## 3. Data model

### Per-SKU tracked attributes

```
sealed_products
├── sku_id (primary key, e.g. "PHF-BB", "PHF-ETB")
├── set_id (FK to sets table)
├── product_type (Booster Box | ETB | Bundle | Collection | Premium Collection | Tin | UPC | Build & Battle | Pokemon Center Exclusive)
├── name (display name)
├── release_date
├── retired_at (null if still in print)
├── ebay_search_query (tuned per SKU — see Journey Together bug note)
├── ebay_filters (NEW listings only, condition, etc.)
├── price_floor (per-SKU minimum reasonable price, e.g. $80 for booster box)
├── price_ceiling (per-SKU maximum reasonable price, rejects outlier inflation)
└── primary_image_url
```

### Daily snapshots (foundation for everything)

```
sealed_daily_snapshots
├── snapshot_id (primary key)
├── sku_id (FK)
├── snapshot_date (date, daily)
├── active_listings_count (total matching the SKU's tuned search query)
├── min_price (cheapest active listing)
├── median_price (median of all active listings)
├── max_price (most expensive, useful for ceiling outlier detection)
├── listing_ids (array of eBay item IDs seen in this snapshot)
└── snapshot_taken_at (timestamp)
```

This is the **foundation table**. Every other aggregate is derived from these daily snapshots. Without daily snapshots, the inferred-volume approach doesn't work.

### Inferred sales (the volume layer)

```
sealed_inferred_sales
├── inferred_sale_id (primary key)
├── sku_id (FK)
├── ebay_listing_id (the listing that disappeared)
├── disappeared_between (date range — snapshot N to snapshot N+1)
├── last_seen_price (price from the snapshot before it disappeared)
├── confidence_score (high | medium | low — see inference logic below)
└── inferred_at (timestamp)
```

**Inference logic**:
- **High confidence**: Listing disappeared AND was Buy It Now AND last-seen price was within ±15% of SKU median → likely a real sale at listed price
- **Medium confidence**: Listing disappeared but was auction-style → could be sold or could be ended early. Use last-seen price as estimate.
- **Low confidence**: Listing disappeared AND price was outlier (>2x median, <0.5x median) → could be a typo listing, scam pull, or wrong category. Flag for review, exclude from volume aggregates.

### Per-SKU weekly aggregates (time-series)

```
sealed_volume_weekly
├── sku_id (FK)
├── week_start (Monday date)
├── inferred_sales_count (count of high+medium confidence disappearances)
├── inferred_dollar_volume (sum of confidence-weighted prices)
├── average_price (inferred_dollar_volume / inferred_sales_count)
├── median_price (more robust than average for outliers)
├── active_listings_end (snapshot Sunday 11:59pm)
├── active_listings_avg (mean across the 7 daily snapshots)
├── state (squeeze | distribution | capitulation | stagnation | thin_data | new_tracking | vintage_hold)
├── volume_wow_pct (vs previous week)
├── supply_wow_pct (vs previous week)
├── data_quality (high | medium | low — based on confidence scores of underlying sales)
└── computed_at (timestamp)
```

This time-series structure means historical heat-map view comes free — Pro tier hook #1.

### Storage estimates

~1,000 SKUs × 365 daily snapshots/year = 365,000 snapshot rows/year. ~50 listing_ids per snapshot = ~18M row-references. Still trivial for Postgres/Supabase. Indexing on (sku_id, snapshot_date) keeps queries fast.

---

## 4. eBay API integration (using what we have)

### Current state of Catchem-data bot

- Uses eBay Browse API with keyword `searchQuery`
- Pulls "trimmed median of cheapest new listings"
- **🐛 KNOWN BUG**: Journey Together Booster Box pricing wildly wrong ($18 vs real $200+). Root cause: keyword collision — search "Journey Together booster box" pulls loose packs into the booster box bucket. **THIS BUG MUST BE FIXED BEFORE EXTENDING TO VOLUME TRACKING.** If the bot can't accurately identify a booster box, it can't accurately count anything about one.

### Why we DON'T need a new API

The original spec assumed we'd need eBay's Marketplace Insights API for sold-listing data. After research, the daily-snapshot inference approach gets us 70-80% of the way using the Browse API we already have. Trade-offs documented honestly below.

**What Browse API gives us natively**:
- Active listings (count + details) → SUPPLY signal ✅
- Price snapshots → average/median calculations ✅
- Listing IDs → can track which specific listings appear/disappear ✅

**What Browse API does NOT give us**:
- Sold/completed transactions directly ❌
- Sale prices for completed listings ❌
- Buyer behavior data ❌

### How daily snapshots replace direct sold-listing data

**Daily snapshot cycle** (runs every day at 6am UTC):
1. For each SKU, run tuned Browse API query
2. Record all active listing IDs + prices into `sealed_daily_snapshots` table
3. Compare today's listing IDs to yesterday's
4. Listings that **disappeared** = inferred sales (with confidence scoring)
5. Store inferred sales in `sealed_inferred_sales` table

**Weekly aggregation** (runs every Monday at 1am UTC):
1. Roll up the past 7 days of daily snapshots
2. Compute supply metrics (avg active listings, end-of-week count)
3. Roll up inferred sales into volume metrics (with confidence weighting)
4. Compute WoW deltas vs previous week
5. Assign state (Squeeze/Distribution/Capitulation/Stagnation)
6. Store in `sealed_volume_weekly`

### Required changes to bot (V1 — using only Browse API)

1. **Tighter `searchQuery` per SKU** — Stored in `sealed-products.json` per SKU, not derived from name. Example: instead of "Journey Together booster box", use `("journey together" OR "JT") AND "booster box" AND ("36 packs" OR "factory sealed") -("single pack" OR "loose pack" OR "blister")`.

2. **Per-subtype price floors AND ceilings** — Reject listings outside reasonable bounds. Booster Box: $80-$2,000. ETB: $30-$500. Booster Bundle: $15-$200. Listings outside bounds get logged for review, not used in aggregates.

3. **Daily snapshot job** — New cron job. Pulls active listings for every tracked SKU once per day. Stores complete snapshot.

4. **Inference job** — Runs after daily snapshot completes. Diffs against previous day's snapshot. Generates inferred-sales rows with confidence scoring.

5. **Weekly aggregation job** — Existing pattern (the bot already does weekly aggregation for singles). Just adapt for the new sealed-volume schema.

6. **State computation** — New module that reads weekly aggregates and assigns heat states based on the ±10% threshold matrix.

### Inference accuracy disclosures (honest user-facing)

The heat-map UI should include a help icon explaining how volume is calculated:

> "Volume is INFERRED from daily listing disappearances on eBay, not measured from direct sales data. Heat states (🔥/📈/❄️/😴) measure trends, not exact dollar amounts. Confidence varies by SKU — current sets with high listing turnover are most accurate; vintage sealed with low turnover is noisier."

This isn't a weakness to hide. It's a transparency choice that builds trust. Collectrics and PokeOz don't disclose their data methodology either — Catch'em being upfront about how the signal is constructed is a moat.

### Data volume / API rate limits

eBay Browse API allows 5,000 calls/day per app. We need:
- ~1,000 SKUs × 1 daily snapshot = 1,000 calls/day
- Well within rate limits, with headroom for retries and ad-hoc queries
- No partner approval, no costs

### Future upgrade path (Phase 3 — IF precision becomes valuable)

If user feedback indicates exact volume numbers matter more than directional signals, apply for **eBay Marketplace Insights API**:
- Requires eBay Business approval (lead time: weeks to months)
- Returns actual sold-listing data (last 90 days)
- Would replace inference layer with direct measurement
- Schema is forward-compatible — `sealed_inferred_sales` becomes `sealed_sales` (with a `source` column = 'inferred' or 'marketplace_insights')

Don't apply for this at V1. Build with what we have. Apply later if it's worth the effort.

---

## 5. Frontend treatment

### Main view: Sealed Heat-Map

A sortable/filterable table at `intelligence.catchemtcg.com/sealed`:

| 🔥 | Set | Product | Type | $ Volume (WoW%) | Supply (WoW%) | Avg Price |
|---|---|---|---|---|---|---|
| 🔥 Squeeze | Ascended Heroes | Booster Box | BB | $42,500 (+38%) | 87 (-22%) | $310 |
| ❄️ Capitulation | Surging Sparks | ETB | ETB | $8,200 (-31%) | 245 (+18%) | $48 |
| 📈 Distribution | Phantasmal Flames | Booster Box | BB | $58,000 (+15%) | 142 (+8%) | $185 |
| 😴 Stagnation | Crimson Invasion | ETB | ETB | $1,100 (-15%) | 38 (-12%) | $42 |

**Default sort**: State priority (🔥 first, then 📈, then ❄️, then 😴). Within state, by dollar volume descending.

**Filters**:
- Era (Mega, S&V, S&S, S&M, XY, BW, vintage)
- Product type (BB, ETB, Bundle, Collection, etc.)
- State filter (show only Squeeze, only Capitulation, etc.)
- Set search

**Card detail view** (click row):
- 12-week heat history (mini chart of $ volume + supply)
- Recent sale snapshots
- Pull-rate context (link to curated chase list for what's INSIDE the product)
- Catch'em-voice flavor: "Phantasmal Flames is in distribution. Money flowing, supply healthy. Charizard X is doing the work."

### Newsletter integration

Cold Issue (Flipper/Grader) every Tuesday includes:
- "🔥 Squeeze watch" — top 3 SKUs heating
- "❄️ Cooling off" — top 3 SKUs capitulating
- "📈 Healthy distribution" — top 3 SKUs flowing well

This makes the newsletter and the tool feed each other. Newsletter drives traffic to the tool; tool data writes the newsletter.

---

## 6. Phased rollout (so it doesn't blow up V1 timeline)

### Phase 0 (PREREQUISITE): Fix Journey Together booster box bug
Before any volume work. Otherwise data is garbage. **This is now the ONLY prerequisite** — no API approval lead time, no third-party service signups. Tyler shares bot scripts on PC, fix takes ~3-6 hours of focused work.

### Phase 1 (V1 — newsletter only, no tool yet)
- Don't build the tool infrastructure yet
- Manually compute heat scores for top 20 sealed SKUs each newsletter using bot's existing data
- Tyler does this in ~30 min/issue: bot tells him supply + average price, he eyeballs WoW changes
- Tests whether readers care about the signal before infrastructure investment
- **Cost**: zero engineering, ~30 min/issue ongoing

### Phase 2 (V1.5 — daily snapshot infrastructure + top 30 SKUs)
- Build the `sealed_daily_snapshots` table and daily cron job
- Build the `sealed_inferred_sales` table and inference logic
- Build the `sealed_volume_weekly` table and weekly aggregation
- Manually tune `searchQuery` for top 30 hottest SKUs (Mega Era + popular S&V)
- Launch heat-map page with sorting + filtering
- **Cost**: 20-30 hours of work (slightly more than original estimate because of inference logic, but fully buildable on existing infrastructure)

### Phase 3 (V2 — full coverage + UI polish)
- Expand SKU coverage to all ~1,000 sealed products (need `searchQuery` tuned for each — ~10-15 hours of curation work)
- Add 12-week historical charts per SKU
- Add Catch'em-voice flavor text on card detail pages
- Add data-quality indicators (confidence scoring exposed in UI)
- **Cost**: 25-35 hours additional work + ongoing SKU curation

### Phase 4 (Pro tier hooks — when monetization starts)
- Alerts: "Notify me when Surging Sparks Booster Box enters Squeeze"
- Portfolio tracking: "How is my collection's heat changing?"
- Historical: "Full multi-year heat history per SKU"
- Custom watchlists
- **Cost**: 30-40 hours, gated by monetization timing

### Phase 5 (OPTIONAL — Marketplace Insights API upgrade)
- Only if Phase 2-3 prove valuable AND users complain about volume accuracy
- Apply for eBay Marketplace Insights API (weeks to months lead time)
- Replace inference layer with direct sold-listing data
- Schema is forward-compatible — no breaking changes
- **Cost**: API application lead time + ~10 hours integration work

---

## 7. Latent Pro-tier hooks (build into data model now, expose later)

Even though everything is free at V1, the data model supports these future paid features without re-architecture:

1. **Alerts table** — Empty at launch, schema ready for "notify user when SKU enters state X"
2. **User watchlists** — Empty at launch, schema ready for "user marks SKUs they care about"
3. **Historical depth** — Time-series goes back as far as we have data; Pro tier could expose full history while Free shows last 12 weeks
4. **Portfolio integration** — Schema connects sealed SKUs to user's collection (when Backpack feature exists)

Don't build the UI for these now. Just make sure the database tables exist and are populated.

---

## 8. Risks and honest flags

### Risk 1: Inference accuracy (NEW — replaces old API access risk)
Daily-snapshot inference is 70-80% accurate for trend detection but has known failure modes:
- Sellers ending listings without selling (relisting, price changes) get miscounted as sales
- Auction-style listings get miscounted at start price
- "Best Offer" sales below ask don't get captured accurately
- Listings with multiple quantities (e.g., "10 boxes available") create ambiguity when partial quantity sells

**Mitigation**: Confidence scoring in `sealed_inferred_sales`. Only high+medium confidence inferred sales contribute to volume aggregates. Honest disclosure in UI ("Volume is inferred from listing turnover"). For SKUs where accuracy matters most, manual review of top inferred sales per week catches obvious errors.

**Acceptance criteria**: Even at 70% accuracy on individual sale prices, the directional signal (heating up vs cooling down) is reliable. The product surfaces TRENDS, not exact dollar values. That's what users actually need.

### Risk 2: SKU disambiguation
Sealed products have weird naming. "Journey Together Booster Box" vs "Journey Together ETB" vs "Journey Together Booster Bundle" — eBay listings don't always make this clear.
**Mitigation**: Hand-tune `searchQuery` per SKU in `sealed-products.json`. This is curation work, ~10 hours for top 100 SKUs. Tyler or Claude can do it.

### Risk 3: Thin data on older/vintage sealed
A 2017 Burning Shadows Booster Box may have 1-3 sales/week. Daily snapshots show fewer disappearances; weekly aggregates are noisy with low N.
**Mitigation**: Flag "thin data" state for SKUs with <5 weekly inferred sales. Don't issue heat states on noisy data. Maybe roll up to monthly windows for vintage SKUs.

### Risk 4: Scope creep
Tyler proposed this mid-curation session for V1 launch. The honest read: this is V1.5/V2 territory. Don't let it delay newsletter + database + bot fix for V1.
**Mitigation**: Phase 1 = newsletter-only manual heat scoring. Build infrastructure (Phase 2+) only if newsletter readers engage with the heat signal.

### Risk 5: Bot's existing data quality
Journey Together booster box bug exists. Other SKUs probably have similar keyword-collision issues we haven't caught.
**Mitigation**: Audit ALL sealed pricing during bug fix phase. Add price floor/ceiling validation to bot. Log outliers for review.

### Risk 6: Daily snapshot reliability
Daily cron jobs fail. eBay API throttles. Snapshots get missed. If a daily snapshot is missing, the inference layer can't compute disappearances for that window.
**Mitigation**: Health-check dashboard for snapshot completeness. If snapshot fails, retry up to 3x with backoff. If still failing, alert Tyler. Inferred-sales rows include `disappeared_between` date range — multi-day gaps are still usable, just lower confidence.

### Risk 7: eBay ToS changes
eBay has historically restricted developer access to sales data (Finding API deprecated 2020, decommissioned 2025). The Browse API could face similar restrictions someday. Daily-snapshot inference depends on Browse API remaining accessible.
**Mitigation**: This is a long-tail risk, not actionable today. Monitor eBay developer announcements. If Browse API access changes, the spec's Phase 5 (Marketplace Insights upgrade) becomes the contingency plan.

### Risk 8: Whale listings flip the signal
A single distributor, LGS, or large reseller listing dozens of copies overnight can flip a SKU's state from Squeeze to Distribution (or Distribution to Capitulation) in 24 hours. The model has no way to predict this — supply data only shows current state, not whether someone is about to dump.

**Real example**: Phantasmal Flames Booster Box shows 🔥 Squeeze with supply down 22% WoW. Distributor lists 80 cases Monday morning. Supply goes 87 → 167 overnight. State flips to Distribution. Anyone who acted on the Squeeze signal looks bad.

**Mitigations**:
- Use hedging language EVERYWHERE prediction appears ("possible breakout imminent" not "breakout imminent")
- Confidence scoring on rapid state transitions — flag SKUs with >50% supply change in 24 hours as "Volatile (sudden supply shift)" rather than a clean state call
- The 7-week mini chart contextualizes the current week against history — collectors can see whether this is a real trend or noise
- Methodology disclosure trains users that the tool measures trends, not certainties

**Acceptance**: This is unavoidable noise in any inferred-data system. Catch'em's job is to surface signal honestly, not to predict whale behavior. Honesty about uncertainty is a moat against tools that overclaim.

---

## 9. What's needed before building

1. ✅ **Spec written** (this doc, updated Apr 24 with daily-snapshot architecture)
2. ⏳ **Journey Together bug fix** — blocks everything (Tyler shares scripts on PC)
3. ⏳ **Per-SKU searchQuery tuning** for top 30 SKUs (Phase 2 launch set)
4. ⏳ **Price floor/ceiling values** defined per SKU type (Booster Box, ETB, Bundle, etc.)
5. ⏳ **Database setup** — `sealed_products`, `sealed_daily_snapshots`, `sealed_inferred_sales`, `sealed_volume_weekly` tables in Supabase
6. ⏳ **Daily snapshot cron job** in Catchem-data bot infrastructure
7. ⏳ **Weekly aggregation + state computation cron** in bot
8. ⏳ **Heat-map page frontend** (Vite/React, extends catchem-app)

**NOT required**:
- ❌ ~~eBay Marketplace Insights API application~~ — deferred to optional Phase 5
- ❌ ~~Third-party paid services~~ — not needed for V1
- ❌ ~~New API approvals or partner accounts~~ — Browse API is enough

---

## 10. Connection to other Catch'em pillars

This tool fits into Catch'em Intelligence as one of three intelligence layers:

1. **Curation layer** — The chase list (singles, what to collect)
2. **Heat layer** — This sealed volume tracker (sealed, what's moving)
3. **Cultural layer** — The newsletter (story, why it matters)

All three feed each other. The chase list tells you what's inside a hot sealed product. The heat tracker tells you when to enter. The newsletter tells you the story collectors are living through.

That's the moat — three layers nobody else has integrated.

---

## 11. Decision log

- **Apr 24, 2026 (initial)**: Tyler proposed the tool mid-curation session. Scoped to all sealed products, free at launch, extending Catchem-data bot. Spec drafted with Marketplace Insights API path.
- **Apr 24, 2026 (revision)**: Tyler pushed back on whether the existing eBay API was enough. Research showed Browse API gives supply data natively but no sold-listing data. Pivot to daily-snapshot inference architecture — uses existing Browse API, no new approvals, accepts 70-80% accuracy as worthwhile tradeoff for trend detection. Marketplace Insights API moves to optional Phase 5 upgrade.
- **Pending**: Tyler shares bot scripts to begin Journey Together bug fix work.
- **Pending**: Decision on whether to build at V1.5 or hold to V2.

---

## Final thought

This is a genuinely good product instinct. Sealed-product heat tracking is underserved in the Pokemon TCG tooling landscape. Collectrics has demand pressure indicators but they're singles-focused. PokeOz/Alex/Nostalgianomics talk supply/demand qualitatively, but nobody has a quantitative weekly heat-map.

**The architecture pivot to daily-snapshot inference makes this dramatically lower risk.** Original spec assumed eBay Marketplace Insights API approval (weeks-to-months lead time, may be denied). Revised spec uses Browse API the bot already has — Tyler can start building once the Journey Together bug is fixed, with no external dependencies.

The big remaining risk isn't whether the product is good. It's whether building it now delays V1 launch when newsletter + database + bot fix are already sufficient differentiators. The Phase 0/1 approach — newsletter-only proof of concept first, build infrastructure when readers prove they care — protects the launch.

If readers shrug at "🔥 squeeze watch" sections in the newsletter, the tool isn't worth building. If they engage, the tool is V1.5's hero feature.

**Honest credit**: Tyler caught that the original spec was overengineered. The daily-snapshot approach should've been the V1 recommendation from the start. Sharp founder pushback saved weeks of unnecessary build complexity.
