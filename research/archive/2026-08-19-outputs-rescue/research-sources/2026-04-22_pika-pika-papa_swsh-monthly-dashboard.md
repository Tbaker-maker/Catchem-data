# Pika Pika Papa — Sword & Shield Monthly Dashboard (April 2026)

## Metadata

- **Source type:** YouTube video (free, public)
- **Creator:** Ryan / "Pika Pika Papa"
- **Channel:** Pika Pika Papa (Pokemon TCG analysis)
- **Video topic:** Sword & Shield era month-over-month performance + new dashboard launch
- **Approx duration:** ~23 minutes
- **Date observed:** 2026-04-22
- **Filed by:** Claude, at Tyler's direction
- **File basis:** Transcript provided by Tyler

---

## Executive summary

Ryan runs a Pokemon TCG analysis YouTube channel backed by a Patreon with a premium "Data Lovers" tier. He's been aggregating Sword & Shield era data (top 20 singles per set + 12 booster boxes) since **September 2023** — 31 months of continuous data at time of video. In this episode he launches a new subscriber dashboard featuring **streak tracking, normalized product indexing, chase card signals, price history, and set-level recommendations.** The dashboard refreshes on the 15th of each month. His core analytical POV is that **chase cards lead booster boxes** — when chase card prices move first, booster box prices usually follow. He uses the ratio between top-20-singles and booster-box prices to identify value opportunities. Evolving Skies specifically has underperformed the era in month-over-month singles growth despite being the most iconic set.

**Position in the market:** Directly adjacent to Catch'em — YouTube-first, Patreon-monetized data creator. Not a standalone app, but occupying part of the same conceptual space. Worth studying carefully.

---

## Key insights

### On methodology (what works for him)

- **Monthly cadence + fixed update date.** Refreshes dashboard on the 15th of every month. Creates audience rhythm, predictability, anticipation.
- **Long time-series beats fancy methodology.** 31 months of monthly data > any single clever metric. He's played the compounding game and has an unfair advantage because of it.
- **Normalized indexing.** Started all product categories at value of 100 in Sep 2023 and tracks growth rate relative to baseline. Lets him compare category-to-category (PC ETBs vs regular ETBs vs booster boxes vs singles) on same visual axis.
- **Narrative built around data.** He doesn't dump numbers — he tells monthly stories. "May-June-July were red, August was the first green signal, then September-October exploded."

### On the market (his observations)

- **Sword & Shield sold off May-July 2025**, turned positive August 2025, exploded September-October 2025, sold off Nov-Jan, turned positive February 2026, strong through April 2026. Cyclical pattern.
- **Pokemon Center ETBs broke out March 2025** and have outperformed regular booster boxes in growth rate ever since. Before March 2025 all categories moved in lockstep.
- **Evolving Skies singles have underperformed peers** — only 3 green months in the last 12, and 1 in the most recent streak (vs 3-4 for most other sets). Massive latent upside thesis.
- **Astral Radiance booster boxes** have been down 5 consecutive months. "Sealed typically doesn't go down" — so this is a dip-buy signal if you like the set.
- **Chilling Reign dichotomy:** Blaziken chase card up 4 months positive momentum, but booster box down 2 consecutive months. Classic chase-leads-box divergence → box-buy opportunity.
- **Fusion Strike booster box flat around $1,000 for extended period** while top 20 singles moving up. Similar pattern to Chilling Reign.

### On what his "Chase leads Box" thesis actually claims

> "Chase cards is the leading indicator. Once Chase cards start to make the move, the booster boxes almost always follow."

Implications if true:
- Track chase card velocity as an early warning signal for upcoming booster box moves
- Chase card momentum + flat/declining box price = potential box entry point
- Conversely: flat chase card + declining box = probably not a bottom yet

**⚠️ This is his claim, not verified by Catch'em data yet. Good benchmarking candidate.**

### On his business model

- Free YouTube content for reach + credibility
- Patreon "Data Lovers" tier unlocks the dashboard access
- Launched Discord ~March 2026 (one month before this video)
- Dashboard explicitly pitched as Patreon conversion tool

---

## Verbatim quotes worth preserving

Used sparingly. These are phrases with particular weight or strategic clarity.

On philosophy:

> "Data doesn't tell you what to do, but it certainly tells you where to look."

He says this multiple times across the video — clearly a core mantra. Philosophically aligned with Catch'em's "Signals, not advice" positioning. The exact phrase is his; the philosophy is universal.

On his thesis:

> "Chase cards is the leading indicator. Once Chase cards start to make the move, the booster boxes almost always follow."

On market reading:

> "Look at the line graph there on the left, look how cyclical the market is in terms of price acceleration and then deceleration and then periods of support."

Plain-spoken observation about modern sealed market cyclicality. Worth remembering as a frame.

---

## Implications for Catch'em

### Build opportunities (things we could create, inspired by but not copied from his work)

**1. Streak Score**
A per-product metric counting consecutive days/weeks of positive or negative price movement. Display in the app as a visual indicator next to each product: "🟢 12 days green" or "🔴 5 weeks red." The computation is trivial once we have enough daily history from our bot. Ryan computes this monthly; Catch'em's daily data cadence gives us higher resolution.

**Differentiation:** Ryan's is monthly, ours would be daily/weekly. Same concept, different granularity.

**2. Ratio tracking**
Compute `top_singles_value / sealed_product_value` ratios per set. Flag when ratio moves outside a rolling band. This is a published signal we could feature in newsletters.

**Differentiation:** Ryan uses this as a visual/intuitive heuristic. Catch'em could make it a formalized, quantified alert.

**3. Normalized category indices**
Start index values at 100 on a chosen baseline date. Track Catch'em index for PC ETBs, regular ETBs, booster boxes, singles, etc. Lets us answer "how has sealed appreciated vs singles this year?" with one chart.

**Differentiation:** Ryan indexed in Sep 2023. We could index from our bot's start date, or retroactively to a standard historical baseline if we source historical price data.

**4. Monthly "State of the Market" Signals**
On top of the 3-day Signals cadence, a once-a-month longer Signals Report that does set-by-set state-of-the-market analysis. Predictable rhythm on a fixed date (probably 1st of the month rather than 15th to differentiate from Ryan).

**Differentiation:** Ryan's is dashboard-first (data, then commentary). Catch'em's would be editorial-first (analysis, with data embedded).

**5. Chase-to-Box divergence alerts**
Programmatically detect when a set's chase card has N consecutive positive months while its booster box has M consecutive negative months. Flag as a potential box-buying opportunity. Test Ryan's thesis on our data before publishing.

**Differentiation:** Explicitly test the thesis rather than assert it. Publish the test results either way.

**6. Chase leading indicator study**
Run a retroactive analysis on our price history (once we have 90+ days) to test how often chase card movements actually precede booster box movements. If the correlation holds, publish a research-backed post. If it doesn't, publish a contrarian finding. Either outcome is credibility-building content.

### Differentiation vectors (things we do, he doesn't)

- **Focus on newsletter + signals, not dashboards.** Ryan sells dashboard access. Catch'em can sell editorial intelligence that happens to be data-informed.
- **Three-pillar user segmentation (Collector, Flipper, Grader).** Ryan speaks to a general audience. Catch'em segments.
- **Gamified engagement loop (daily pack system).** Ryan has Discord community. Catch'em could have daily-return ritual.
- **Original Catch'em card collection.** Pure IP differentiation.
- **Intrinsic value model with named, documented methodology.** Ryan has informal heuristics. Catch'em can publish transparent, reproducible models.
- **Free core tier.** Ryan gates insights behind Patreon. Catch'em can make core intelligence free and monetize other layers (premium tiers, API access, affiliate, etc.).

### Things to avoid / anti-patterns

- **Don't copy his voice.** "Pika Pika Papa," "big beautiful brain," "Dr. Frankenstein has to talk about his monster" — folksy, personable, Ryan-specific. Catch'em voice is editorial, clean, less first-person.
- **Don't copy his dashboard layout.** His 8-tab sidebar pattern is his work product. Catch'em's UX should emerge from our user needs, not his template.
- **Don't imitate his specific color coding / visual conventions.** Streaks in yellow boxes, call-outs in purple — those are visual signatures of his product.
- **Don't quote his specific numbers without attribution.** His monthly price data is the output of his labor. Referencing general patterns: fine. Quoting specific "Evolving Skies was up X%": not without credit.

---

## Counter-observations / where Catch'em can go deeper

### 1. His methodology is informal, not formalized

He says "top 20 singles" but doesn't document exactly which 20 per set, how they were selected, whether the list changes over time, or what pricing source. Catch'em's methodology should be **publicly documented and reproducible.**

### 2. He relies on visual pattern recognition

His insights come from eyeballing color-coded matrices ("look at those green boxes"). Catch'em can do the same work with **explicit statistical tests** and publish the rigor. E.g., instead of "evolving skies has lagged," we compute a percentile rank and say "Evolving Skies singles are in the 8th percentile for month-over-month growth among SWSH sets over the past 12 months."

### 3. His data is monthly; we're daily

Monthly cadence limits his resolution. He can't see intra-month movement patterns. Catch'em's daily data lets us:
- Detect anomalies within days, not months
- Catch supply-change events as they happen
- Build intraweek patterns
- Alert within 24 hours of meaningful moves

### 4. His focus is entirely Sword & Shield era

He doesn't cover Scarlet & Violet or Mega Evolution monthly the same way. **Catch'em can cover every era** with the same rigor, uniformly — better coverage, younger sets included.

### 5. His outputs are gated behind Patreon

His Patreon "Data Lovers" tier is presumably $5-15/month. That's a conversion funnel, not a free public good. **Catch'em can be freely accessible at the core tier** and still have revenue vectors (affiliate, premium, sponsorships, merch, API).

### 6. He doesn't have a price-alert infrastructure

Everything is monthly batch analysis. He doesn't have push alerts for "Moonbreon moved 10% today." Catch'em can. Real-time intelligence is a differentiator.

---

## Benchmarking opportunities (how to use his work to audit ours)

Now that Ryan has a monthly dashboard, Catch'em can periodically audit:

1. **Our booster box prices vs his.** Monthly spot-check on 3-5 products. If our bot's median materially differs from his dashboard, investigate why. Catch'em's data is authoritative by default, but benchmarking keeps us honest.

2. **Our rank orderings vs his.** He ranks SWSH booster boxes top-to-bottom. When we have enough data for our own rankings, do they agree? Disagreements are features — we publish the reasoning.

3. **Our trend detection vs his.** He says April 2026 is strong month-over-month for SWSH. Do we see the same in our daily data aggregated monthly? If yes, good cross-validation. If no, who's right and why?

**Important principle (per memory):** Our data wins by default. We only defer to his numbers if ours are materially wrong (major discrepancy, not minor variance). Benchmark externally, publish internally.

---

## Action items

- [ ] **Add Streak Score computation to Catch'em bot** — once we have 30+ days of daily history
- [ ] **Add normalized index tracking to sealed-prices.json** — baseline everything to 100 at bot launch date
- [ ] **Test the "chase leads box" thesis on our data** — 90+ days in, do a retroactive study
- [ ] **Design monthly "State of the Market" Signals report** — editorial complement to the 3-day cadence
- [ ] **Add competitor intelligence doc entry** — Ryan as entry #1 (done in same session)
- [ ] **Consider set-level ratios in the app** — top singles / booster box, as a default display
- [ ] **Update pokemon-sets-database.json** — add market_notes field for Evolving Skies singles underperformance observation

---

## Licensing / legal notes

- Source is a **free, publicly accessible YouTube video**. Fair game for analysis and learning.
- His **dashboard itself** is behind Patreon paywall. We did not access that content. Analysis here is based solely on what he showed/said in the free video.
- Specific price numbers he cited (e.g. "Moonbreon at $1,900") are his data output. We can reference patterns and directional claims ("Moonbreon has appreciated significantly since release") without quoting his exact numbers, because exact numbers are his work product.
- Methodology concepts (streak counts, ratio analysis, normalized indexing) are **general analytical techniques**, not his proprietary IP. Fair to implement our own versions.
- His specific visual design, branding ("Pika Pika Papa"), and voice are his IP. Do not imitate.

---

## Video 2 follow-up notes (April 2026 — SWSH singles upside analysis)

**Observed:** 2026-04-22 (same day, follow-up episode)
**Video topic:** Ryan applies his dashboards to recommend specific Sword & Shield singles he thinks have upside.

Most of this video is card-picking editorial (his content, not signal for Catch'em). Two genuinely new concepts emerged that **are** worth capturing as potential Catch'em features:

### New concept 1: Persistence-of-demand metric ("appearances count")

Ryan tracks, for each card on his demand dashboards, **how many months out of the dashboard's lifespan that card has appeared on the top-demand list**. A card that appears 12 out of 19 months has a fundamentally different signal than a card with one huge spike and no persistence.

**Why this matters:** This is a **stickiness signal** that's distinct from magnitude of demand. A card that "sticks" near the top of demand for many months is a different buy-case than a card that flashes demand once.

**Catch'em implementation opportunity:**
- Once Catchem-data bot has 60+ days of history, compute a "persistence score" per tracked product: (periods on top-N-movers list) / (total periods tracked)
- Surface persistence as a filter alongside magnitude: "Cards that have been in the top 20 movers 80%+ of the time"
- Distinct from Streak Score (consecutive months green) — persistence = how often over total time, streak = how many in a row

**Differentiation:** Ryan's metric is monthly. Catch'em's can be daily or weekly for higher resolution. Catch'em can also segment persistence by the three pillars (what's persistently in demand for Collectors vs Flippers vs Graders).

### New concept 2: Composite letter grades (A/B/C/D rankings)

Ryan has an "Elite Rankings" tab on his demand dashboards that assigns each card an A/B/C/D grade based on composite signals (appearances count, magnitude of demand, recency of demand, etc. — exact formula not disclosed).

**Why this matters:** Letter grades are **dramatically more user-friendly** than multi-number dashboards. A user who sees "A" vs "B" understands instantly. A user who sees "persistence 73%, magnitude +14%, recency 3 weeks" has to do the work themselves.

**Catch'em implementation opportunity:**
- Composite "Catch'em Grade" per product: A/B/C/D or star system (3-star, 4-star, 5-star)
- Input signals: intrinsic value vs market price delta, persistence score, streak direction, demand magnitude, chase-status changes
- Surface the grade prominently; link to the underlying math for users who want depth
- Three-pillar grades: a card could be "Collector A / Flipper C / Grader B" — same card, different POVs

**Differentiation:** Ryan's is one grade per card for a generic investor audience. Catch'em's three-pillar grades is a real UX innovation if executed. A card gets multiple grades for multiple user types.

### What this video did NOT add

Most of the content was card-specific picks (Moonbreon, Brilliant Stars Charizard, Silver Tempest Lugia, Evolving Skies V alt arts, etc.). These are Ryan's editorial output, not Catch'em data signal. Not captured. If any of these picks become directionally relevant to a future Catch'em newsletter issue, we'd cite Ryan's analysis at that point — not document every pick here.

### Action items added

- [ ] **Persistence-of-demand metric** — implement on Catchem-data bot once 60+ days of history
- [ ] **Composite grading system design** — decide input signals, weights, output format (letters vs stars vs numeric), three-pillar structure
- [ ] **Letter-grade UX component** for the React app — high prominence display with drill-down capability

---

## Filed

**Filed by:** Claude  
**Filed date:** 2026-04-22 (original) + 2026-04-22 (Video 2 append)
**Reviewed by Tyler:** pending (suggest: read once, correct anything we got wrong)

---

*Next action: add competitor intelligence doc (`/outputs/competitor-intelligence.md`) with Ryan as entry #1.*
