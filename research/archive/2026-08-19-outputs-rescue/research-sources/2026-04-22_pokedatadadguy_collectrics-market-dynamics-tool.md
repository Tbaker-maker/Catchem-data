# PokeDataDadGuy — Collectrics Market Dynamics Tool Launch (April 22, 2026)

## Metadata

- **Source type:** YouTube video (free, public)
- **Creator:** PokeDataDadGuy (YouTube handle: @Pokedatadadguy)
- **Website:** mycollectrics.com
- **Video topic:** Launch of live "Market Dynamics" tool on Collectrics with demand pressure + supply saturation metrics
- **Approx duration:** ~12 minutes
- **Date observed:** 2026-04-22
- **Filed by:** Claude, at Tyler's direction
- **File basis:** Transcript provided by Tyler

---

## Executive summary

PokeDataDadGuy shows a live Market Dynamics tool he's built on his website Collectrics. The tool quantifies supply and demand movement for every modern Pokemon card in his coverage using two named metrics: **demand pressure** (percent of available supply absorbed into sales) and **supply saturation shift** (ratio of 7-day supply vs 30-day baseline, with 1.0 = stable, above 1 = loosening, below 1 = tightening). He's been scraping and storing eBay listing data daily for 30 days. He demos case studies (151 Charmander cooling, 151 Blastoise cooling, Surging Sparks Pikachu heating, Destined Rivals Gengar extreme demand). He explicitly acknowledges the sold-price limitation (eBay Marketplace Insights API is enterprise-only; he reverse-engineers sold estimates from listing-end behavior using statistical models).

**Strategic weight of this video:** Heaviest of the three so far. He's moved from "analytical framework" (pricing model) to "shipped product" (live dashboard with real data). This is a direct, live competitor to Catch'em's planned market-intelligence features.

---

## Key insights

### The two metrics he invented (or operationalized)

**Demand pressure** (%):
- Formula: (absorbed supply / total supply) × 100
- Intuition: how much of what's available is actually selling
- Displayed as gauge; his examples showed readings from ~2% (low) to capped-out (Gengar)
- "Elevated" for illustration rares at ~6%+ in his framing

**Supply saturation shift** (ratio):
- Formula: 7-day supply / 30-day baseline supply
- 1.0 = stable
- Above 1.0 = loosening (supply building faster than demand)
- Below 1.0 = tightening (supply being absorbed faster than replenished)
- "A 2.0 would mean in the past 7 days the supply has doubled versus demand"

**Why these metrics are good:**
- Named clearly, intuitive mental model
- Gauge/visualization-friendly
- Compare cards across sets without needing absolute-dollar context
- Leading indicators — they move *before* price, unlike price-history charts which are lagging

### Case studies and what they reveal

**151 Charmander (cooling):**
- 353 active listings, up 15% vs 30-day baseline
- New listings decreasing, but sold volume decreasing faster
- Supply building → price declining (consistent with observed cooldown)
- Demand pressure ~6.4% (elevated for this rarity tier, but not enough to absorb supply)
- Supply saturation shift: 1.5 (loosening)

**151 Blastoise (cooling):**
- Higher listing count than Charmander (counterintuitive since Blastoise is "rarer" collectively)
- His interpretation: sellers saw the March price spike and listed to capture gains
- Demand pressure lower than Charmander
- Loosening trend continues

**Surging Sparks Pikachu (heating):**
- Sudden price jump after long flat period
- Concurrent spike in sold volume (April 4)
- Then spike in new listings next day (April 5) — sellers reacting to demand
- Demand pressure ~6% but driving tightening (supply absorbed faster than replenished)

**Destined Rivals Gengar (extreme high demand):**
- Demand pressure gauge capped out
- Near-balanced supply/demand mechanically — but with this level of demand pressure, slow price creep expected
- Classic "shouldn't be anyone's surprise" case

### Methodology transparency

He's **explicitly honest about data limitations** in a way that builds trust:

> "The eBay data that we're showing here are not true sold listings... eBay does not open up their marketplace insights API to anyone... what we're doing is we're reverse engineering our market trends based on being able to pull listings every day."

He also calls out:
- Estimated-sold and estimated-unsold listings (labeled as such on the site)
- Statistical outlier removal
- Per-card uniqueness in sold-estimate modeling
- "Continuing to tweak that model"

He builds data pipelines for his day job. Backend designed by him. Front-end is AI-coded (acknowledged openly).

### Tone and positioning

Key quotes on his mindset:

> "I'm whole pot committed as they say in the hobby, meeting taking my profession and meeting it with my obsession."

> "People are like, 'Oh, you're gonna monetize it.' I'm like, 'It's too early for that.' I'm just doing this because it's cool."

**This matters:** he's positioning as "passion project built by someone who knows what they're doing" — not "startup chasing revenue." That's a real competitive distinction Catch'em should note.

---

## Verbatim quotes worth preserving

On price vs market activity:
> "This isn't like some other sites where you just see, oh, here's the biggest movers and it's price movers. Price tells you what's already happened. Real market movement is the exchange of goods."

This is a genuinely sharp observation. Price is a lagging indicator. Volume + new-listing flow is leading. Catch'em should internalize this framing — and also find its own words for it.

On his approach to the hobby:
> "I am not trying to get rich off this by any means. I just want to see people using the site, enjoying it, and just try and offset those costs."

On AI-assisted development:
> "It's amazing what you can do with AI now. I mean, if you think I'm hand coding this website at this to this level, you're out of your mind."

---

## Implications for Catch'em

### This is a direct, live, shipped competitor in part of the Catch'em space

Let's name this clearly. Previously, Catch'em's analysis positioned everyone we've filed as "adjacent competitor" — YouTube creators, article sites, reference tools. **Collectrics is the first file-worthy source that is operating in the same app-like "live tool with real data" category Catch'em is building toward.**

He is not building Catch'em-the-full-platform (no newsletter, no segmentation, no gamification, no original IP). But in the **"live market dashboards for Pokemon TCG"** sub-category, Collectrics is the current leader. That's a real fact.

### What Catch'em must address

**1. Metric naming**
He's established "demand pressure" and "supply saturation shift" as named metrics in public-facing product. Catch'em needs its own metric names. We should not use those terms. Options to consider:
- "Absorption Rate" (demand side)
- "Flow Index" or "Velocity Index" (supply/demand balance)
- "Market Pulse" / "Movement Signal" (composite)

This is a branding/product decision for Tyler. Flag as TODO.

**2. Underlying metrics are Econ 101**
Supply-demand analysis is general knowledge, not proprietary. Catch'em can compute equivalent metrics (whatever we call them) with our own bot data and publish them. **Implementation is independent work; naming is what must be distinct.**

**3. Data methodology disclosure**
He's transparent about the "no true sold data" limitation. Catch'em must be equally transparent. Any Catch'em-published price data should carry the same caveat: "Estimated sold based on listing-end behavior. eBay does not publicly release true sold data outside enterprise API access."

**4. Leading vs lagging framing**
His best content-framing move: "Price tells you what's already happened. Real market movement is the exchange of goods." Catch'em should adopt a similar orientation — emphasize leading indicators (volume, new listings, absorption) over price charts in our Signals content.

### Differentiation vectors (still real despite his lead)

- **Editorial voice and newsletter** — he has no newsletter, no written analysis, no Signals framework. All delivery via YouTube + dashboard.
- **Three-pillar segmentation** — Collector/Flipper/Grader. He addresses a generic "Pokemon investor/collector."
- **Original IP** — Catch'em's card collection, branded Signals, Bag view, streak system. Collectrics is purely data/dashboard.
- **Gamification** — daily pack + streaks + original collectibles. Collectrics has none of this.
- **Community focus** — Catch'em is designed to be a community brand, not a solo-founder tool.
- **Professional positioning** — "Tyler Baker, founder of Catch'em" is a different brand than "a dad who builds things because they're cool."

### Uncomfortable acknowledgment

Collectrics is **further along in deployment** than Catch'em as of 2026-04-22. Live tool, real users, daily data accumulation, feature iteration. Catch'em has a landing page, an undeployed React app, an unsent newsletter, and a running-but-not-scheduled bot.

This is a **shipping gap**, not a strategy gap. Catch'em's strategy is still sound and differentiated. But strategy only matters if it reaches users.

---

## Counter-observations / where Catch'em can go deeper

1. **His sample is 30 days of data.** Catch'em's bot has been accumulating longer in some form. When Catch'em has 90+ days, we have a meaningful advantage on trend analysis.

2. **His coverage is "modern Pokemon sets" but not clearly defined scope.** Catch'em can define scope explicitly and cover systematically (per the 130-set database).

3. **No alerts yet.** His tool is a dashboard — you look at it. Catch'em can build push alerts ("Moonbreon moved 10% today") — fundamentally more useful for active users.

4. **No user accounts / customization yet.** His tool is read-only. Catch'em's app can support watchlists, alerts, custom dashboards — stickiness we can own.

5. **Front-end is AI-coded by his admission.** Catch'em's UX can be more polished if we invest in it. Not a guaranteed win — he might close the gap — but a real opening.

6. **No editorial or narrative layer.** His "analysis" is a video explaining what the dashboard shows. Catch'em's Signals newsletter is structural, recurring, branded content. Different product, different audience potential.

---

## Benchmarking opportunities

- **Data cross-check:** Periodically sample 5-10 products in Catch'em's bot and compare demand pressure / supply dynamics to what Collectrics shows. Major divergence = investigate. Principle: Catch'em data wins by default (per knowledge base).
- **Methodology cross-check:** When Catch'em has equivalent features built, compare how often our "cooling" signals and his "cooling" signals agree. Agreement validates both. Disagreement is publishable.
- **Coverage audit:** What cards does he cover that we don't? What do we cover that he doesn't? Coverage gaps are product opportunities.

---

## Action items

- [ ] **Decide Catch'em's names for equivalent supply/demand metrics** before building our version
- [ ] **Add "data limitations" disclosure** to any Catch'em-published market data
- [ ] **Adopt the "price is lagging" framing** in Catch'em editorial voice (with original phrasing)
- [ ] **Build equivalent leading-indicator metrics** on Catch'em's bot data (volume flow, absorption rate)
- [ ] **Monitor Collectrics weekly** for feature iterations — file any major launches in research-sources

---

## Licensing / legal

- Source is a **free, publicly accessible YouTube video**. Fair analysis and learning.
- **Collectrics.com is a live public website.** Observations about what the site does/shows are fair. Scraping his data, reproducing his UI, or reusing his metric names/formulas without independent work is not.
- His **metric names** ("demand pressure" / "supply saturation shift") are his product-level terminology. Catch'em should not use these exact terms in a product context.
- The **underlying math** (supply-demand ratios, absorption percentages) is Econ 101 and cannot be owned by anyone.
- His **R² = 0.88 model** from the earlier video is framework he's published in public video; Catch'em has attributed this in the pricing-model research file.

---

## Filed

**Filed by:** Claude
**Filed date:** 2026-04-22
**Reviewed by Tyler:** pending

*Related: pricing-model-framework (April 21) and movers-leaderboard (same day as this filing).*
