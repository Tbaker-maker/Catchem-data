# Competitor Intelligence — Pokemon TCG Market Analysis Space

> **Purpose:** Map of who else occupies part of the Pokemon TCG market intelligence / data / signals space. For each, we document what they offer, how they monetize, and where Catch'em differentiates.

> **Philosophy:** Study and differentiate. Benchmark our data against theirs. Respect their work. Carve our own path. **Never copy voice, visual design, or specific IP.** General analytical techniques are fair game to implement independently.

**Maintained by:** Claude (with Tyler's review)
**Last updated:** 2026-04-22
**Version:** 0.2.0 — major revision after PokeDataDadGuy / Collectrics emerged as direct competitor

---

## Current competitive stance

As of 2026-04-22, the Pokemon TCG market-intelligence landscape looks like this:

**Directly competitive (shipped live product in Catch'em's space):**
- **PokeDataDadGuy / mycollectrics.com** — live market dynamics dashboard, movers leaderboard, pricing model. 2 weeks of rapid iteration. Single-creator operation using AI-assisted coding.

**Adjacent (different product category, overlapping audience):**
- **Pika Pika Papa (Ryan)** — YouTube-first analytical channel with Patreon-backed monthly dashboard.
- **JBTCG (Jack)** — YouTube market-commentary channel, historical context, qualitative analysis.
- **Cardrake** — website with per-set master-guides and chase card rankings.
- **CardChill** — article-based market analysis site.
- **PokemonPriceTracker** — price-tracking utility with API.

**Reference sources (not competitors — Catch'em uses them for verification):**
- **Beckett, PokéBeach, Bulbapedia, Bulbanews** — primary journalism/reference sources.

**The situation:** Catch'em is pre-launch. One direct competitor (Collectrics) is live. Several adjacent players have existed longer with different approaches. The "full platform with editorial + app + community + gamification" position Catch'em is building toward is **still unclaimed** — but the "shipped dashboard" category has its first occupant, and Catch'em needs to ship to compete on that dimension.

---

## How to read this doc

Each entry has the same structure:

- **What they are** — 1-2 sentence identity
- **What they offer** — free and paid tiers
- **Their strengths**
- **Their gaps / where Catch'em can differentiate**
- **Competitive posture** — direct, adjacent, inspiration, partner potential
- **Monitoring cadence** — how often we check in
- **Last reviewed** — when this entry was updated

---

## Entry 1: PokeDataDadGuy / Collectrics (DIRECT COMPETITOR)

### What they are
Solo-founder Pokemon TCG analytics website (mycollectrics.com) paired with YouTube channel (@Pokedatadadguy). Creator is a professional data engineer moonlighting on the project. Currently iterating rapidly with AI-assisted front-end development. Live and accepting public traffic. No announced product name beyond the site URL.

### What they offer

**Live website features (mycollectrics.com):**
- Pricing model / intrinsic value calculations
- Market dynamics dashboard per card (demand pressure, supply saturation shift)
- Biggest market movers leaderboard (ranked by supply dynamics, not price)
- Daily eBay listing data aggregation (30+ days of history)
- Reverse-engineered sold-price estimates with statistical outlier removal

**YouTube channel content:**
- Video walkthroughs of site features
- Methodology explanations
- Market analysis using the tool
- Viral hit: ~2 weeks ago a multiple-regression / intrinsic value video "popped off"

**Announced monetization roadmap:**
- Free core features forever
- Small one-time purchases for themes (dark mode)
- "Expansion packs" for additional card coverage (pay-per-set-coverage)
- **Explicitly not subscription-based**
- Stated goal: offset running costs, not profit

### Their strengths

1. **Live, shipping product.** Not a prototype. Real site, real data, real features.
2. **Fast iteration.** Pricing model → market dynamics tool → movers leaderboard in roughly 2 weeks.
3. **Named, intuitive metrics.** "Demand pressure" and "supply saturation shift" — clear, visualizable, remembered.
4. **Strong editorial framing on leading vs lagging.** "Price tells you what's already happened. Real market movement is the exchange of goods."
5. **Transparent methodology.** Honest about data limitations (no true eBay sold data, reverse-engineered from listing-end behavior). Acknowledges AI-assisted coding.
6. **Professional technical chops.** Day job in data pipelines. Backend is hand-built, not vibes.
7. **Early mover narrative.** First viable "live dashboard" product in the hobby.
8. **Low-stakes monetization.** Free-first approach earns trust; cost-offset-only framing disarms "they're in it for the money" skepticism.
9. **R² = 0.88 published model.** Catch'em's intrinsic value model is derived from his framework — credit where due.

### Their gaps / where Catch'em can differentiate

1. **No newsletter / no editorial voice.** No Signals. No recurring written content. No brand voice beyond "enthusiastic dad explaining data."
2. **No user segmentation.** Generic "Pokemon investors/collectors." Doesn't distinguish Collector / Flipper / Grader needs.
3. **No original IP.** No branded cards, no community rituals, no gamification, no identity markers beyond the site URL.
4. **No daily engagement loop.** Users visit when curious, not daily by design.
5. **No community infrastructure.** No Discord mentioned, no forum, no user-to-user connection.
6. **No watchlist / custom dashboards / alerts.** Read-only analytics, no personalization.
7. **Solo operation with self-stated revenue ceiling.** Explicit "not trying to get rich" positions naturally as hobby-scale project.
8. **No mobile-first consideration visible yet.** Web dashboard experience.
9. **Coverage scope unclear and possibly narrow.** "Modern Pokemon sets" without explicit list. Catch'em's 130-set database is broader.
10. **No set-level or era-level synthesis.** Card-by-card analysis, but not "here's the state of Prismatic Evolutions as a set."
11. **No pull-rate sourcing visible.** Uses pull rates in model but doesn't publish the sourced-and-dated table.
12. **Metrics are one-size-fits-all.** Same demand pressure gauge for every user, every card, every context.

### Competitive posture

**Direct competitor in the "live market intelligence dashboard" category.**

**Not a competitor in:**
- Newsletter / editorial content
- Community building
- Three-pillar user segmentation
- Gamification / daily engagement
- Original IP development

**Critical shipping gap to address:**
As of 2026-04-22, Collectrics is live and iterating weekly. Catch'em has a landing page, an undeployed React app, an unsent newsletter, and a running-but-unscheduled bot. The product gap is real and will widen if Catch'em doesn't ship something public soon.

### Monitoring cadence

- **Weekly for the next 2-3 months.** He's iterating fast enough that monthly is too slow.
- **File new research-sources entries for any major feature launches.**
- **Cross-check data:** when Catch'em has equivalent features, benchmark 5-10 products monthly against Collectrics. Catch'em data wins by default; flag only material discrepancies.

### Last reviewed

2026-04-22 — three research-sources files filed covering April 21 pricing model, April 22 market dynamics tool, and April 22 movers leaderboard.

**Related files:**
- `/outputs/research-sources/2026-04-21_pokedatadadguy_pricing-model-framework.md`
- `/outputs/research-sources/2026-04-22_pokedatadadguy_collectrics-market-dynamics-tool.md`
- `/outputs/research-sources/2026-04-22_pokedatadadguy_movers-leaderboard.md`

---

## Entry 2: Pika Pika Papa / Ryan

### What they are
YouTube-first Pokemon TCG analysis channel with a Patreon-backed subscriber dashboard. Analytical and data-driven rather than hype-driven. 31 months of continuous Sword & Shield era data.

### What they offer

**Free tier (YouTube):** Monthly SWSH era analysis videos, month-over-month pricing commentary, Discord community.

**Paid tier (Patreon "Data Lovers"):** Full dashboard — streak tracking, normalized indices, chase rankings, price history, set signals. Updated 15th of every month.

### Their strengths
- 31-month historical time series (unreplicable moat)
- Strong analytical voice, aligned with "signals not hype"
- Narrative storytelling transforms data into stories
- Predictable monthly cadence builds audience rhythm
- Existing Discord community

### Gaps / Catch'em differentiation
- Monthly resolution only (Catch'em's daily data has 30x resolution)
- Focused on Sword & Shield era (Catch'em covers all eras)
- Dashboard-first rather than app-first
- No price-alert infrastructure
- No user segmentation
- Paid-only for the good parts

### Competitive posture

**Adjacent.** Creator-first subscription service. Catch'em is product-first multi-revenue platform. Venn diagram overlaps but delivery models are different.

### Monitoring cadence
Monthly. Catch new dashboard-update videos. File major methodology changes in research-sources.

### Last reviewed
2026-04-22 — based on Sword & Shield dashboard launch video.

**Related file:** `/outputs/research-sources/2026-04-22_pika-pika-papa_swsh-monthly-dashboard.md`

---

## Entry 3: JBTCG / Jack

### What they are
YouTube-focused Pokemon TCG commentary channel. Qualitative market analysis, historical context, lived-experience perspective. Longer in the hobby than most recent entrants.

### What they offer
- Market retrospective and forward-looking commentary videos
- Personal recollections of historical prices ("Lost Origin PC ETBs at $48 shipped when MSRP was $50")
- Strategic advice framing (sell into hype, retrace expected post-30th-anniversary, Celebrations risk warning)
- Falsifiable predictions (e.g., "Celebrations will tank post-30th anniversary")

### Their strengths
- Historical price memory across 2+ years of market evolution
- Willingness to make specific, testable predictions
- Balances bullish and bearish framing (cyclical market awareness)
- Strong stance: cautious-bullish, hedging at highs
- Informative on psychology of collector/investor behavior

### Gaps / Catch'em differentiation
- No data infrastructure
- No tool or dashboard
- Narrative only, no systematic analysis
- Predictions untracked — Catch'em could build a thesis-tracking file that logs and tests predictions from sources like Jack

### Competitive posture

**Adjacent.** Editorial commentary channel. Overlaps with Catch'em's potential "market column" style of content.

### Monitoring cadence
Occasional. When he makes a specific testable prediction, file it. When he shares historical context worth preserving, file it.

### Last reviewed
2026-04-22 — 2-year market retrospective video.

**Related file:** `/outputs/research-sources/2026-04-22_jbtcg_two-year-market-retrospective.md` (pending filing)

---

## Entry 4: PokemonPriceTracker

### What they are
Price tracking tool for Pokemon TCG singles and sealed. Catch'em-approved verification source per stat-verification protocol.

### What they offer
**⚠️ PARTIAL — Catch'em has not done a full product audit.**

- Historical price charts
- API access (referenced in Catch'em memory as acceptable price source)
- Presumably tracks TCGPlayer and/or eBay data

### Competitive posture

**Adjacent.** Pricing utility, not platform.

### Last reviewed
Placeholder — full audit pending.

---

## Entry 5: Cardrake

### What they are
Website with per-set master guides, chase card rankings, and authentication content.

### What they offer
- Master set completion guides
- Chase card rankings with prices
- Set budgeting tools
- Authentication guides
- Binder layout planners

### Competitive posture

**Adjacent.** Reference resource, not intelligence product.

### Last reviewed
Placeholder — full audit pending.

---

## Entry 6: CardChill

### What they are
Pokemon TCG market analysis website covering sets, releases, and investment considerations.

### What they offer
- Article-based analysis
- Release calendars
- ROI predictions (framed as non-financial-advice)

### Competitive posture
**Adjacent.** Article-based format.

### Last reviewed
Placeholder.

---

## Entry 7: Beckett / PokéBeach / Bulbapedia / Bulbanews (journalism sources)

**Not competitors — they're sources.** Catch'em cites their reporting for verification. Partnership or referral potential long-term but not a priority.

---

## Future competitor profiles (TODO)

- **Collectr** — mobile app for Pokemon collection tracking
- **TCGPlayer** — the incumbent marketplace + price guide (eBay-owned)
- **eBay itself** — the marketplace where prices are discovered
- **PSA, CGC, BGS** — grading services with population reports
- **PriceCharting** — generic trading card price aggregator
- **Rarerip, Ludkins Militia, Poketubers** — YouTube personalities
- **Cardmavin** — card set reference
- **JustInBasil** — competitive play focus
- **Pokellector** — collection tracker
- **Discord communities** — r/PokemonTCG, pkmntcgtrades, server ecosystem

Add entries as they warrant documentation.

---

## Catch'em's position — the honest view

After mapping the landscape, Catch'em's unique position looks like this:

### Genuine differentiators (already real or clearly planned)

**1. Editorial + dashboard combined.** Nobody in this space has both a serious editorial voice (newsletter, Signals framework) AND a live analytics dashboard. Ryan has editorial without the dashboard. Collectrics has the dashboard without editorial. Catch'em aims to have both.

**2. Three-pillar user segmentation.** Collector / Flipper / Grader as distinct user types with distinct needs. Nobody else does this.

**3. Original IP.** Catch'em original cards, branded Signals, Bag/pack system, community identity. Collectrics has none of this. Neither does anyone else.

**4. Gamified daily engagement.** Pack rip + streak + collection. No one else has a daily-return ritual.

**5. Transparent methodology with Catch'em-original framing.** Document the models, the sources, the limitations. Collectrics does this too; we need to match or exceed the transparency bar.

**6. Three-pillar-segmented leaderboards.** Different movers matter for Collectors vs Flippers vs Graders. Nobody segments this.

**7. Ambition to build a platform, not a tool.** Collectrics is a tool with a self-stated cost-offset ceiling. Catch'em is a platform with broader ambition.

### Where Catch'em has shipping gaps to close

**1. Actually shipping the app.** React app built, not deployed. Highest priority.

**2. Actually sending the newsletter.** Newsletter 001 written, not sent.

**3. Automating the bot schedule.** Running but not on a cron. Makes the data pipeline fragile.

**4. Publishing set-level content.** 130-set database exists internally. Not public.

**5. Documenting the methodology externally.** Intrinsic value model exists in code. Not explained publicly.

### The stakes

Collectrics is the first live competitor. If Catch'em takes another 3 months to ship anything real, Collectrics will have 10+ feature iterations, meaningful user base, and the "we were first" narrative in the small community that follows this space. **Not fatal — second movers win on execution regularly.** But the cost of not shipping rises every week.

---

## Anti-patterns from observed competitors (things Catch'em should NOT do)

- **Don't gate the core value behind a paywall.** Ryan's model is fine for him — Catch'em's core should be free.
- **Don't rely on a single channel.** Diversify delivery.
- **Don't fake social proof.** Fake reviews, inflated numbers. (Tyler already removed this instinctively.)
- **Don't copy any competitor's visual design, voice, or branded terms.**
- **Don't produce hype content for engagement.** Signals-not-advice.
- **Don't scrape proprietary data.** Other people's specific rankings or price tables stay theirs.
- **Don't promise too much before shipping.** Collectrics ships then explains. Catch'em has been explaining-before-shipping.

---

## Filed

**Filed by:** Claude
**Filed date:** 2026-04-22
**Status:** Version 0.2.0 — major revision after PokeDataDadGuy / Collectrics emerged as direct competitor.
