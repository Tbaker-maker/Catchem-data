# Catch'em Sealed Intelligence — Specification v2

**Status:** Design document  
**Date drafted:** April 20, 2026  
**Last updated:** April 20, 2026 (v2 — added two-layer pricing model and depth-vs-concentration logic)  
**Owner:** Tyler Baker  
**Purpose:** Captures the conceptual model, reprint cycle logic, pattern archetypes, and data requirements for the Sealed Accumulation Intelligence feature — the flagship differentiator of Catch'em.

**v2 changes:**
- Added Section 5A: The Two-Layer Pricing Model
- Added Case Study 5: 151 & Crown Zenith (deep-value anomalies)
- Added "Deep-value" archetype modifier (orthogonal to the 4 primary archetypes)
- Added chase-value computation data requirements from pokemontcg.io
- Updated editorial matrix with depth scoring

---

## 1. Executive Summary

Catch'em's sealed intelligence feature will identify **when** to accumulate sealed Pokémon products based on where they sit in the reprint cycle, their set-specific behavior profile, and real-time supply/demand signals.

The core insight that differentiates this from every competing app: **Reprints are not threats — they are opportunities.** The accumulation window opens when reprint supply absorbs, prices find their floor, and demand begins to outpace remaining supply.

Users will not be told "buy this now" in pre-launch. They'll be taught the phases, shown where each product sits in the cycle, and given the reasoning behind signals. This educational-first framing builds trust and retention. Recommendation-mode comes later, once the model has track record.

---

## 2. The 7-Phase Reprint Cycle

Every sealed product moves through predictable phases, though timing varies dramatically by set archetype.

### Phase 1 — Pre-Reprint (Elevated Pricing)
- Set still in rotation, original print run drying up
- Prices climbing as supply tightens
- No reprint announcement yet
- **User signal:** 🟡 "Pre-reprint zone — anticipate dip"
- **User action:** Watch, don't buy aggressively

### Phase 2 — Reprint Hits (Supply Spike, Price Drop)
- Sudden flood of new inventory
- Prices drop 15-40% depending on set archetype
- Panic selling adds to the dip
- **User signal:** 🟠 "Reprint active — wait for floor"
- **User action:** Do NOT buy yet — the bottom isn't in

### Phase 3 — Floor Forming (Stabilization Begins)
- Supply increase slows
- Price volatility drops
- Brief consolidation period (typically 2-3 weeks)
- **User signal:** 🟢 "Floor forming — window opening"
- **User action:** Start initial accumulation positions

### Phase 4 — Floor Holding (Stable Accumulation Zone)
- Price sideways for weeks or months
- Steady absorption of reprint supply
- This is the LONGEST phase for most sets
- **User signal:** 🟢 "Accumulation zone — active window"
- **User action:** Continue accumulating — this is the sweet spot

### Phase 5 — Supply Absorbing (Climb Starting)
- Listing counts drop
- Price begins small upticks
- Early movement, often accelerating
- **User signal:** 🟡 "Supply tightening — window narrowing"
- **User action:** Last chance at floor pricing — don't delay further

### Phase 6 — Post-Absorption Climb (Price Runs)
- Price breaks above accumulation range
- Movement can be rapid — "rarely goes back down" per field observations
- **User signal:** 🔴 "Above floor — wait for next cycle"
- **User action:** Stop buying at this price unless strategic need

### Phase 7 — New Equilibrium (Higher Plateau)
- Price settles at new elevated level
- Remains there until next catalyst (rotation, new reprint, etc.)
- **User signal:** ⚪ "Post-climb plateau — hold position"
- **User action:** Don't accumulate at current levels

---

## 3. The 4 Archetypes — Pattern Library

Not all sets behave the same. The model classifies each set into one of four archetypes, which determines how aggressively to interpret phase signals.

### Archetype A: Normal Sets
The default pattern. Most regular mainline sets fall here.

| Metric | Value |
|--------|-------|
| Cycle adherence | Follows 7 phases predictably |
| Reprint dip magnitude | 20-35% from peak |
| Accumulation window | 4-8 months |
| Post-absorption climb | 15-25% above floor |
| Model confidence | HIGH |

**Example sets:** Surging Sparks, Silver Tempest, Brilliant Stars, Fusion Strike, Lost Origin, Astral Radiance

### Archetype B: High-Floor Sets
Solid sets with above-average demand. Compressed dips, faster recovery.

| Metric | Value |
|--------|-------|
| Cycle adherence | Follows phases with compressed dips |
| Reprint dip magnitude | 15-25% from peak |
| Accumulation window | 3-6 months |
| Post-absorption climb | 20-35% above floor |
| Model confidence | HIGH |

**Example sets:** Shrouded Fable, Paldean Fates, Crown Zenith, Hidden Fates, Stellar Crown

### Archetype C: Generational Sets
Elite modern sets with sustained demand. Delayed cycles, premium floors.

| Metric | Value |
|--------|-------|
| Cycle adherence | Delayed — reprints take 12-18+ months to materialize |
| Reprint dip magnitude | 20-30% but from much higher base |
| Accumulation window | Elusive — wait 18-24 months for real reprint |
| Post-absorption climb | Often 30-50%+ above floor |
| Model confidence | MEDIUM (pattern is directionally right, timing uncertain) |

**Example sets:** Evolving Skies, Prismatic Evolutions, possibly Ascended Heroes (pending observation)

### Archetype D: Cultural Sets
Phenomena that may break the cycle entirely. Demand transcends normal collector dynamics.

| Metric | Value |
|--------|-------|
| Cycle adherence | May partially or fully break cycle |
| Reprint dip magnitude | 10-20% if it happens at all |
| Accumulation window | Hard to predict — may have continuous demand |
| Post-absorption climb | Sustained upward with no clear plateau |
| Model confidence | LOW (show users: "defies normal patterns") |

**Example sets:** 151, Destined Rivals, Hidden Fates (crosses into High-Floor territory)

**CRITICAL:** For cultural sets, the app must explicitly tell users the model has LOWER confidence. Never fake certainty here. Users trust honest uncertainty.

---

## 4. Case Studies — Validation

These four sets validate the model and provide the educational foundation.

### Case Study 1: Pokémon 151 — Cultural Archetype

**Timeline:**
- June 2023: Released. Scalpers at 3x MSRP within days.
- Late 2023 – Early 2024: Peak hype. ETBs $150-200+.
- April 2024: Japanese 151 reprint announced. JP prices dropped ~25% (from ~$132 to ~$99).
- October 2024: English "5-Pack Mini Tins Bundle" shipped reprints.
- December 2024: Japanese booster box reprint at Pokémon Centers.
- February 2025: "Blooming Waters Premium Collection" added more English supply.
- 2025: Prices compressed to floor, found new elevated equilibrium.

**Lessons:**
- Cultural sets hold floors HIGHER than normal sets even through heavy reprints
- Multiple reprint waves over 18+ months without crashing price
- Japanese and English reprints move somewhat independently
- Accumulation window: 10-14 months post-release, lasted ~6-8 months

### Case Study 2: Prismatic Evolutions — Generational Archetype (In Progress)

**Timeline:**
- January 17, 2025: Released. Umbreon ex driving demand. ETBs 3-5x MSRP.
- Throughout 2025: Sustained premium pricing, slow reprint trickle.
- April 2026 (current): ~15 months post-release, early softening but still elevated.

**Lessons:**
- Generational sets sustain elevated pricing 12-18+ months before real reprint waves
- Reprints WILL come — just with higher floor than normal sets
- Pre-rotation window (2-3 years pre-rotation) is NOT the buy window yet
- Patience pays more here than for normal sets

### Case Study 3: Surging Sparks — Normal Archetype, Buy Window Teacher

**Timeline:**
- November 8, 2024: Released at ~$120 MSRP (booster box).
- December 2024: Scalping spike to $150-160 (+23-31%).
- January 2025: Peak at $204.58. Brief $300 flirts on some platforms.
- January 11, 2025: Restock rumor. Prices began dropping.
- March 2025: Settled at $235-250.
- April 2025: Stabilized at $235. Pack EV still positive.
- Late 2025: Settled at $150-180 "stable" range.
- 2026: Long-standing accumulation window — where it sits today.

**Lessons:**
- Buy windows can last MONTHS — Surging Sparks proved the point
- Heavy reprints compress prices to MSRP + small premium, not below
- Chase card strength provides EV floor (pack EV stayed positive)
- Restock rumors alone can drop prices 20-30% in days
- Mature buy windows are the "low-stress" accumulation zone

### Case Study 4: Destined Rivals — Cultural Archetype, Broke the Model

**Timeline:**
- May 30, 2025: Released. ETB MSRP ~$60.
- Pre-order: Moving at 3x retail on eBay.
- June 2025+: Continued upward. ETBs $140+ and sold out at retailers.
- Throughout 2025: Kept rising. Did NOT follow post-hype cooldown.
- Current: Still sustained/climbing.

**Why it broke the model:**
- Team Rocket nostalgia (Giovanni, Mewtwo, classic villains)
- Concurrent hype momentum from Prismatic Evolutions
- First Team Rocket-focused set in years
- Reprint allocation slower than demand
- Emotional/narrative appeal beyond typical set mechanics

**Lessons:**
- Some sets don't follow reprint-dip reliably
- Cultural/thematic sets can transcend normal collector dynamics
- Model needs humility — "may not follow typical pattern, confidence LOWER"
- Trust domain-expert reads — if data shows continued strength with no supply spike, don't force "expected dip" warning

### Case Study 5: 151 & Crown Zenith — The Deep-Value Anomaly

These two sets together reveal a critical insight that naive "sealed price = singles-driven EV" models miss completely.

**The paradox:**

- **Per-card singles prices are relatively suppressed** for both sets. Neither has a single card pulling $1000+ like Prismatic's Umbreon or Evolving Skies' Moonbreon.
- **Sealed prices hold strong** through reprints, maintain premium, and outperform what a pack-EV calculation would predict.

**Why:** Both sets are **deep-value.** The desirability is spread across dozens of chase-worthy cards rather than concentrated in 1-3 top chases.

**151 specifics:**
- 18+ cards above $50 market price
- Top 20 chase value ≈ $1,200+ combined
- Cultural tier: 10 (Gen 1 Kanto nostalgia, 30th anniversary positioning)
- Single-card maximum around $200-300 (Charizard 181 ex SIR)
- But opening a box = exposure to 150+ beloved Gen 1 Pokémon, each with collectibility
- Sealed held premium through 3+ reprint waves (April 2024 JP, Oct 2024 EN Mini Tins, Dec 2024 JP booster boxes, Feb 2025 Blooming Waters)

**Crown Zenith specifics:**
- Galarian Gallery subset beloved for art
- Many cards $30-80, few over $200
- No single dominant chase
- Per-pack EV moderate but pack count (10) + subset allure sustain ETB pricing
- Sealed held strong through rotation transition

**What this teaches the model:**

1. **Suppressed singles ≠ suppressed sealed.** Deep-value sets decouple these.
2. **Layer 2 desirability multiplier is essential.** Without it, the model under-prices deep-value sets' sealed products by 30-50%.
3. **Singles-to-sealed correlation varies by archetype.** Concentrated-chase sets show high correlation; deep-value sets show low correlation.
4. **Reprint resilience is higher for deep-value sets.** Even heavy reprints of 151 didn't crash sealed pricing because the "pull at anything" appeal remained intact.
5. **Buyers of deep-value sealed aren't chasing one card.** They're buying an experience, a collection, a cultural moment. This demand is less elastic than chase-card FOMO.

**The "Deep-value" archetype modifier** (introduced in Section 5A) is the model's answer to this observation. Sets can be `Cultural + Deep-value`, `High-Floor + Deep-value`, `Generational + Deep-value`, or `Normal + Deep-value`, and the Layer 2 multiplier is adjusted accordingly.

**App implications:**

For a deep-value set, the app should:
- Show a distinct "Deep-value" badge alongside the archetype chip
- Adjust the reasoning copy to emphasize breadth over single-chase dependency
- Apply dampened reprint-dip expectations (sealed holds better than singles)
- Flag that per-card valuations may look suppressed but sealed retains strength

---

## 5. Supply Spike Attribution

Sudden jumps in listing count mean different things. The app must distinguish:

### Scenario A: Reprint Wave
- **Signals:** Supply jumps across MANY sellers, prices soften, new sellers diverse (distributors, LGSes, big stores)
- **App chip:** 🔴 "Reprint detected"
- **Meaning:** Expect continued price pressure; wait for floor

### Scenario B: Whale Dump (Single Seller Liquidation)
- **Signals:** Supply jumps from 1-3 sellers, listing diversity LOW, average price drops sharply
- **App chip:** ⚠️ "Possible seller liquidation"
- **Meaning:** Temporary price pressure, likely recovers

### Scenario C: Coordinated Manipulation
- **Signals:** Unusual patterns — prices all similar, posted within short time window, shill-bidding or wash-trading indicators
- **App chip:** ⚠️ "Unusual market activity"
- **Meaning:** Interpret cautiously, wait for clarity

### Scenario D: Market Panic
- **Signals:** Many sellers list simultaneously, typically tied to external events (reprint announcements, rotation news)
- **App chip:** 🟡 "Panic supply spike"
- **Meaning:** May be buying opportunity if fundamentals unchanged

### Detection Logic (Pseudocode)
```
if (listingCount jumps 25%+ day-over-day OR 40%+ week-over-week):
    if (topSellerShare > 0.4 AND uniqueSellers dropped):
        → "Whale dump"
    elif (newSellers > average * 2 AND uniqueSellers increased):
        → "Reprint wave"
    elif (price suddenly flat across many listings):
        → "Possible manipulation"
    elif (spike correlates with external event):
        → "Market panic"
    else:
        → "Supply spike — unclear cause" (honest uncertainty)
```

---

## 5A. The Two-Layer Pricing Model

### Why sealed ≠ singles math

Catch'em already has a working **intrinsic value model for singles** (`scarcityScore × desirabilityScore × CHARACTER_PREMIUM`, calibrated against the market). It works well for individual cards.

But naive application of the same model to sealed products fails, because **sealed pricing is not a simple sum of singles value.** Two sets can have wildly different per-card prices but similarly strong sealed prices, or vice versa.

**Field observation:** 151 and Crown Zenith both have suppressed per-card singles prices (no single card dominates) but maintain strong sealed prices even through reprints. Meanwhile, Surging Sparks has a concentrated singles chase (Pikachu ex SIR drives everything) and sealed tracks that concentration tightly.

This means sealed intelligence needs a **two-layer model.**

### Layer 1: Pack EV (Singles-Driven)

Traditional collectibles valuation — sealed products are worth approximately their statistical pack value, discounted by some factor.

```
Layer1_PackEV = Σ(chaseCardValue × pullRate) × packCount × marketDiscount
```

**Works best for:** Sets with concentrated chase cards where the top 1-3 singles drive most value.

**Examples:**
- **Surging Sparks Booster Box** — Pikachu ex SIR is the story. Box price tracks Pikachu SIR closely.
- **Obsidian Flames ETB** — Tracks Charizard 223 and Pidgeot ex SIR.
- **Twilight Masquerade** — Chase-concentrated, Layer 1 dominates.

**Breaks down for:** Sets where chase value is distributed across many cards.

### Layer 2: Set Desirability Multiplier (Depth-Driven)

A parallel score reflecting the **overall desirability of the set as a whole**, not just its top chases.

```
Layer2_Desirability = function of:
    - totalTop20ChaseValue (sum of values of top 20 ranked cards)
    - chaseCount_50 (how many cards exceed $50)
    - chaseCount_100 (how many exceed $100)
    - culturalTier (1-10 editorial ranking)
    - archetypeBonus (from primary archetype classification)
```

**Works best for:** Deep-value sets where buyers want broad exposure, not specific hits.

**Examples:**
- **151** — Total top-20 value ≈ $1,200+. 18+ cards over $50. Cultural tier 10.
- **Crown Zenith** — Galarian Gallery subset is deeply beloved. Many cards above $30-50, few above $200.
- **Destined Rivals** — Team Rocket thematic appeal across the entire set.

### The Combined Formula

```
sealedIntrinsicValue(product) = 
    packCount 
    × baselinePackValue 
    × marketDiscount              // typical 0.45-0.65
    × Layer1_PackEVMultiplier     // how concentrated is chase value
    × Layer2_DesirabilityMultiplier  // how deep is the set
    × scarcityMultiplier          // rotation + print status
    × archetypeMultiplier         // normal / high-floor / generational / cultural
```

### The Deep-Value Archetype Modifier

A set can be classified as **"deep-value"** as an orthogonal modifier to the 4 primary archetypes. Deep-value sets show:

- Top 20 chase value > $800
- At least 15 cards above $50
- No single card dominates (top card < 25% of top-20 total)
- Per-pack EV moderately high from distributed rarities
- Sealed prices hold up through reprints disproportionately vs. singles

**Confirmed deep-value sets:**
- **151** (Cultural + Deep-value)
- **Crown Zenith** (High-Floor + Deep-value)
- **Destined Rivals** (Cultural + Deep-value — Team Rocket distribution)
- **Evolving Skies** (Generational + Deep-value — Eevee line + many chase cards)

**NOT deep-value (concentrated chase):**
- Surging Sparks (Pikachu SIR dominates)
- Obsidian Flames (Charizard 223 dominates)
- Twilight Masquerade (Ogerpon-led)
- Paldean Fates (Charizard Shiny dominates)

### What this unlocks for users

The app can show different reasoning for different sets:

**Chase-concentrated set (e.g. Surging Sparks):**
> 💡 **"Value driven by Pikachu ex SIR"**
> 
> _Pack EV directly reflects Pikachu SIR strength. Sealed price will move with that card._

**Deep-value set (e.g. 151):**
> 💡 **"Broad desirability — distributed value"**  
>
> _No single chase dominates. Sealed price holds through reprints because you're buying breadth, not a single hit. Singles prices may be suppressed by depth, but sealed stays firm._

### Data source advantage

**We already have the data.** `pokemontcg.io` provides singles pricing per set for free. The bot can compute `top20ChaseValue`, `chaseCount_50`, and `chaseCount_100` automatically per set daily. No new API required.

Implementation step: add a `computeSetDepthMetrics(setId)` function to `fetch-sealed-prices.mjs` that:
1. Queries pokemontcg.io for all cards in the set
2. Sorts by `tcgplayer.prices.*.market`
3. Computes the aggregate metrics
4. Stores them alongside sealed product data

This enables the Layer 2 multiplier to update automatically as the singles market shifts.

### Calibration approach

We cannot derive Layer 2 coefficients from first principles. Instead:

1. **Gather historical data** — for 10-20 sets, record the actual market price of their booster box/ETB over time
2. **Fit coefficients** — compute what Layer 2 multiplier best explains observed pricing after Layer 1 + scarcity/archetype adjustments
3. **Validate with holdouts** — keep 5 sets out of the fit, test whether the calibrated model predicts their sealed prices within acceptable error
4. **Update quarterly** — as market shifts, refit the model

Expected output: Layer 2 multiplier ranges from ~0.85 (shallow sets) to ~1.35 (deep-value cultural sets like 151).

---

## 6. Data Requirements

### Currently Collected (catchem-data bot, daily)
- `priceMedian`, `priceLow`, `priceHigh`
- `listingCount`
- `priceHistory` array (appends daily)
- `updatedAt` timestamp

### Needed Additions (Phase A — script update)
```json
{
  "listingHistory": [
    {"date": "2026-04-20", "count": 42}
  ],
  "sellerDiversity": [
    {
      "date": "2026-04-20",
      "uniqueSellers": 38,
      "topSellerShare": 0.15,
      "top3SellerShare": 0.32,
      "newSellers": 4
    }
  ]
}
```

### Needed Additions (Phase B — editorial)
Per-set metadata file (`sets-meta.json` or embedded in products):
```json
{
  "setId": "sv8pt5",
  "name": "Prismatic Evolutions",
  "archetype": "generational",
  "desirability": 9,
  "reprintResilience": 8,
  "expectedDipMagnitude": "moderate",
  "culturalNotes": "Umbreon ex premium, 30th anniversary timing, Eeveelutions appeal",
  "knownReprintEvents": [],
  "rotationDate": "2027-Q3-estimated"
}
```

### eBay API Usage Implications
- Current: ~50 listings sampled per product daily
- Required for seller analysis: ~100-200 listings per product on spike-alert days
- At 48 products × 100 listings = 4,800 calls/day (within 5,000 free tier)
- Adaptive sampling strategy: lighter default, heavier on detected spike days

---

## 7. UX Philosophy — Educational First, Prescriptive Later

### Phase 1 (Launch): Educational Mode
Show users the phase, the data, and the "why" behind signals.

**Example display:**
```
PRISMATIC EVOLUTIONS — ELITE TRAINER BOX
$127.50 · up 2.1% this week

PHASE: Pre-reprint zone
Reprint likely in next 60-90 days based on:
• Release age (15 months)
• Current scarcity pattern
• Historical pattern for similar special sets

PREDICTED CYCLE:
→ Expected reprint dip: 20-30% (moderate — generational)
→ Expected floor: ~$85-95
→ Expected recovery: 3-4 months post-floor
→ Expected post-absorption ceiling: $140-160

CONTEXT:
Current price near pre-reprint top.
Reprint historically softens pricing before next run-up.
Accumulation window opens near $85.
```

**Why educational first:**
- Builds trust through transparency
- Users develop their own instincts
- Scales better than precise predictions
- Model errors don't destroy credibility

### Phase 2 (Post-Launch, after track record): Advisor Mode
Opt-in mode that makes clearer calls: "Wait. Accumulation window opens at $85."

Only unlock once model has demonstrated real-world accuracy across multiple reprint cycles (minimum 6-12 months of operation).

### Confidence Handling
When model uncertain (cultural sets, insufficient data):
- **Option A (Rejected):** Show chip with "low confidence" marker — too subtle
- **Option B (Rejected):** Hide chip below threshold — users lose signal
- **Option C (SELECTED):** Show "Monitoring" neutral state — honest and informative

---

## 8. Implementation Roadmap

### Phase A: Data Collection Foundation
**Timeline:** Next PC session (15-30 min)  
**Blocks:** Nothing — can do immediately  
**Scope:**
- Update `fetch-sealed-prices.mjs` to persist `listingHistory`
- Update to capture per-seller data (unique sellers, top seller share, new sellers)
- Re-run workflow to start accumulating new fields

**Critical:** Every day of delay is a day of data lost forever. Highest priority when at PC.

### Phase B: Editorial Anomaly Matrix
**Timeline:** This week (collaborative, 60-90 min)  
**Blocks:** None — phone work is fine for drafting  
**Scope:**
- Build `sets-meta.json` with archetype, desirability, resilience, expected dip for 20-30 key sets
- Tyler provides domain knowledge; Claude structures data
- Iterate weekly as market shifts

### Phase C: Scoring Engine
**Timeline:** Week 2-3 (1-2 PC sessions)  
**Blocks:** Needs 14+ days of new data collection  
**Scope:**
- Implement phase detection algorithm in app
- Compute `SealedAccumulationScore` per product
- Show phase chips on sealed rows
- Tap-to-expand reasoning modal
- Wire into Flipper mode as hero signal

### Phase D: Supply Spike Attribution
**Timeline:** Month 2-3  
**Blocks:** Needs 30+ days of seller diversity data  
**Scope:**
- Implement spike detection logic
- Build attribution classifier (reprint vs dump vs manipulation vs panic)
- Show attribution chips when spikes occur
- Build alert system (future: push notifications)

### Phase E: Historical Pattern Matching
**Timeline:** Month 3+  
**Blocks:** Needs 90+ days of accumulated data  
**Scope:**
- "Similar spikes historically resolved to X" insights
- Rotation cycle analysis ("here's what happened to Obsidian Flames 30/60/90 days after rotation")
- Volatility scoring
- Year-over-year comparisons

### Phase F: Advisor Mode
**Timeline:** Month 6+  
**Blocks:** Needs demonstrated track record  
**Scope:**
- Opt-in prescriptive mode
- Clear buy/wait/avoid calls
- Real-time alerts when phase transitions detected

---

## 9. Competitive Differentiation

### What Competitors Show
- **Collectr:** Portfolio tracking with prices. No signals. No intelligence.
- **Shiny:** Same — portfolio + alerts on price changes. No phase analysis.
- **PokemonPriceTracker:** Price data only. No accumulation signals.
- **PriceCharting:** Historical charts. No forward guidance.

### What Catch'em Shows (Unique)
- Phase-aware accumulation signals
- Archetype-specific interpretation
- Supply spike attribution (reprint vs dump vs manipulation)
- Honest uncertainty for cultural sets
- Educational framing that teaches the market, not just displays it

### The Moat
Every day the catchem-data bot runs, Catch'em's dataset deepens. After 6 months, nobody can replicate the accumulated history. The moat compounds automatically — no additional work required to widen it beyond keeping the bot alive.

---

## 10. Risks and Mitigations

### Risk 1: Wrong calls destroy trust
**Mitigation:** Educational framing pre-launch. Show reasoning, not just signals. Advisor mode is opt-in and delayed.

### Risk 2: Insufficient data in early months
**Mitigation:** Launch with "Intelligence coming soon" teaser. Use the data collection period as a marketing arc — "the model is learning."

### Risk 3: Cultural sets will keep breaking rules
**Mitigation:** Explicit low-confidence marking. Never claim certainty where none exists. Domain expert input overrides auto-classification.

### Risk 4: eBay API changes or limits
**Mitigation:** Adaptive sampling. Fallback data sources (PriceCharting scrape, manual curation for key products).

### Risk 5: Manual editorial matrix becomes maintenance burden
**Mitigation:** Quarterly review cadence. Community-sourced updates in Discord once users exist. Eventually automate classification from accumulated data.

---

## 11. Open Questions (For Tyler's Input)

1. **Timing urgency** — How fast can Phase 5→6 transitions happen? Days, weeks, hours for hot sets? Determines alert infrastructure needs.

2. **Accumulation ceiling %** — For normal sets, what % above floor is where buying should stop? 15%? 25%? 30%?

3. **Which other sets validate the 4 archetypes?** — We have 4 case studies. 6-8 more examples per archetype would strengthen the matrix.

4. **Japanese product expansion** — Currently English only. Do Japanese sealed products follow same cycles or different patterns?

5. **Graded data integration** — When we eventually add graded pricing, how does that interact with sealed intelligence? Gem rate affects sealed value — can we quantify?

---

## 12. Success Criteria

**Pre-launch:**
- Stage 1 catalog expanded to 48+ products ✓
- catchem-data bot running daily ✓
- Seller diversity tracking implemented
- Editorial matrix complete for 20+ sets

**Launch:**
- Phase chips visible on all sealed products
- Reasoning modal explains every signal
- "Monitoring" state honest for uncertain cases
- At least 30 days of accumulated data

**3 months post-launch:**
- Attribution signals live (reprint vs dump vs other)
- One correctly-called reprint cycle documented
- Community feedback integrated into matrix updates

**6 months post-launch:**
- Advisor mode opt-in available
- Historical pattern matching live
- Published case studies on past calls (learning in public)

---

## Appendix A: Glossary

- **ETB:** Elite Trainer Box (9 packs + accessories)
- **UPC:** Ultra Premium Collection (premium multi-pack box)
- **MSRP:** Manufacturer's suggested retail price
- **EV:** Expected value (statistical pack value)
- **Gem rate:** Frequency of PSA 10 / CGC 10 grades
- **SIR:** Special Illustration Rare
- **Reg mark (H, I, etc.):** Rotation regulation mark per Pokémon TCG standard format
- **Archetype:** Classification of set behavior pattern (Normal, High-Floor, Generational, Cultural)
- **Deep-value:** Orthogonal archetype modifier where desirability is distributed across many cards rather than concentrated in a few chases
- **Layer 1 (Pack EV):** Singles-driven sealed valuation based on chase card × pull rate math
- **Layer 2 (Desirability):** Set-wide desirability multiplier capturing breadth of demand beyond pack EV
- **Accumulation window:** Phase 3-4-5 when floor has formed and price is stable or beginning climb

---

## Appendix B: Initial Editorial Matrix — Draft

Pending Tyler's review and refinement.

**Column definitions:**
- **Archetype:** Primary behavior pattern (Normal / High-Floor / Generational / Cultural)
- **Depth:** Deep-value modifier (✓ if Deep-value, blank if concentrated-chase)
- **Desirability:** Overall desirability rating (1-10), reflecting both chase strength AND set breadth
- **Resilience:** Reprint resilience (1-10), higher = weathers reprints better
- **Dip:** Expected reprint-dip magnitude (Mild / Moderate / Severe)

| Set | Archetype | Depth | Desirability | Resilience | Expected Dip |
|-----|-----------|:-----:|:------------:|:----------:|:------------:|
| Evolving Skies | Generational | ✓ | 10 | 9 | Moderate |
| Prismatic Evolutions | Generational |   | 10 | 8 | Moderate |
| 151 | Cultural | ✓ | 9 | 9 | Mild |
| Crown Zenith | High-Floor | ✓ | 8 | 8 | Mild |
| Ascended Heroes | Generational |   | 9 | 8 | Moderate |
| Hidden Fates | Cultural |   | 8 | 8 | Mild |
| Destined Rivals | Cultural | ✓ | 9 | 9 | Mild |
| Shrouded Fable | High-Floor |   | 7 | 6 | Moderate |
| Paldean Fates | High-Floor |   | 7 | 6 | Moderate |
| Stellar Crown | Normal |   | 6 | 5 | Moderate |
| Twilight Masquerade | Normal |   | 5 | 5 | Moderate |
| Silver Tempest | Normal |   | 5 | 5 | Moderate |
| Lost Origin | Normal |   | 5 | 4 | Moderate |
| Surging Sparks | Normal |   | 6 | 5 | Moderate |
| Brilliant Stars | Normal |   | 5 | 4 | Severe |
| Fusion Strike | Normal |   | 4 | 3 | Severe |
| Journey Together | Normal |   | 6 | 5 | Moderate |

**Initial deep-value set identifications:**
- Evolving Skies — Generational + Deep-value (Eeveelution line + many chases)
- 151 — Cultural + Deep-value (Kanto nostalgia across entire set)
- Crown Zenith — High-Floor + Deep-value (Galarian Gallery breadth)
- Destined Rivals — Cultural + Deep-value (Team Rocket thematic distribution)

**Depth classification criteria (pending validation with data):**
- Top-20 chase cards combined value > $800
- At least 15 cards priced above $50
- No single card represents >25% of top-20 value
- Sealed prices historically resist reprint dips more than per-card prices would suggest

---

**End of Spec v2**

Next revision planned: After Phase A implementation and first editorial matrix review session.

### Revision History

**v2 (April 20, 2026):**
- Added Section 5A: Two-Layer Pricing Model (Layer 1 Pack EV + Layer 2 Set Desirability)
- Added Case Study 5: 151 & Crown Zenith — the Deep-Value Anomaly
- Added "Deep-value" as an orthogonal archetype modifier
- Updated editorial matrix to include depth classification
- Added chase-value metric computation from pokemontcg.io
- Expanded glossary with new terms

**v1 (April 20, 2026):**
- Initial spec with 7-phase reprint cycle
- 4 archetype pattern library (Normal, High-Floor, Generational, Cultural)
- 4 case studies (151, Prismatic Evolutions, Surging Sparks, Destined Rivals)
- Supply spike attribution logic
- Educational-first UX philosophy
