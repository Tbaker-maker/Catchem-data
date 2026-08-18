**STATUS Aug 18: blessed-by-default (Tyler veto anytime).** V1 trio KEEP; screens 4–8 KEEP per sketches. CC kickoff prompt at bottom.

# App Build Specs — V1 trio deep, rest sketched (from the 8-screen suite)

**Sequencing truth:** Ticker needs NO auth/db → ships first as the app's
opening live screen. Supabase (auth+db) unblocks Backpack, then Feels.
Order: **Ticker → Backpack → Feels**; screens 4–8 slot behind.

**Licensing map (binding):** singles prices = TCGplayer-via-pokemontcg.io →
app-safe today. Anything Spread/enrichment-derived (screen 4's spread badge,
Slab Math PSA data) = PPT-derived → gated until licensing clears. Build the
components; ship behind a flag.

## 1 · THE TICKER (S — ships first)
- **Feed:** `research/assets/pulse-feed.json` (now emitted every run; the
  app NEVER scrapes HTML). Refresh: fetch on open + pull-to-refresh; feed
  regenerates daily 04:00 via v2.2.
- **Components:** panel strip (skus/signals/calibration bar) · signal cards
  (both markets + both supplies + read line) · quiet-mover cards · pack-math
  mini · radar rows. Every number renders its `class` as a chip; chip tap →
  receipts drawer showing `provenance` + `disclosure`.
- **States:** calibrating (bar + honesty line, already in feed) · stale feed
  (>36h old → banner "machine hiccup — showing yesterday") · empty-signals
  ("markets agree today" is a feature, render it proudly).
- **No auth. No db. No writes.** Static JSON + fetch.

## 2 · BACKPACK MARK-TO-MARKET (M — needs Supabase)
- **Data contract:** user_cards(user_id, cardId, qty, score?) joined daily
  against `data/singles-prices.json` (only dataStatus:live +
  needsReview:false rows are valuable; others show "tracking pending").
- **Header:** Σ(qty×priceMarket) + 7d Δ from per-card priceHistory (clean
  rows only). Sparkline = last 7 history points.
- **Unmatched cards:** value "—", chip "not yet tracked — request it" →
  writes to a wishlist table (feeds Wave A curation!).
- **Trust rule:** header Δ hides until ≥2 history days exist per card.

## 3 · LIVE-PRICED FEELS (M — needs Supabase + pack engine)
- **Pull values:** intrinsic-value model (catchem.jsx) prices the pack's
  slots; any pull matching a CONFIRMED watchlist printing shows the real
  market chip instead. "Street value pulled" = Σ, mixed-provenance allowed
  but chips must differ (model = READ chip; market = VERIFIED chip).
- **Rip moment:** total counts up AFTER last card flip. Streak/cosmetics
  per locked Pro-tier rules (base free, ×1.50 ceiling).
- **Db:** pulls(user_id, date, cardIds, valueAt) — valueAt frozen at rip
  (provenance-stamped) so "you pulled $47" never silently rewrites.

## 4–8 sketches
**4 Pull Pressure:** set page composes existing feeds (heat state, spread
[gated], pack-math, chase strip). S once Ticker components exist.
**5 Provenance chips:** not a screen — a design-system primitive; build in
Ticker, reuse everywhere. **6 Slab Math:** UI ready; wires to enrichment
salesByGrade (gated + wakes with tonight's table). **7 Drop Day:** countdown
+ dial from radar/heat; shelf check-ins need db + moderation rules (write
spec before build — crowd data gets its own trust tier). **8 Share-card:**
render feed's top signal to canvas→PNG; S-M; instant distribution.

## Open flags
- Supabase project = the V1 gate for 2&3 (home decision, ~1hr setup).
- Screen-7 check-ins: define abuse/verification rules BEFORE building.
- All PPT-gated components ship dark behind `LICENSING_CLEAR` flag.


## CC APP-KICKOFF PROMPT (paste when app-time begins — works via /rc from phone)
> New target: catchem-app repo. Pull both repos. Build THE TICKER as the
> app's opening screen per research/app-specs-v1.md §1: fetch
> pulse-feed.json (raw.githubusercontent URL from Catchem-data main),
> render panel strip + signal cards + quiet movers + pack-math mini +
> radar, provenance chips on every number with tap-to-receipts drawer,
> the three states (calibrating / stale-feed / markets-agree). Match the
> mockup suite's visual language (research/assets/app-mockups.html) but
> production-grade per the frontend-design skill. No auth, no db, no
> writes. Ship to a preview branch, screenshot in your report, STOP
> before any deploy. Fences standard.
