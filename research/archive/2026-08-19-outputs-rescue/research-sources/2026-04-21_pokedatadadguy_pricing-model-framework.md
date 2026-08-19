# PokeDataDadGuy — Intrinsic Value Pricing Model (April 2026)

## Metadata

- **Source type:** YouTube video (free, public)
- **Creator:** PokeDataDadGuy (YouTube handle: @Pokedatadadguy)
- **Website:** mycollectrics.com
- **Video topic:** Introduction of intrinsic value pricing model for Pokemon TCG chase cards
- **Approx duration:** ~13 minutes
- **Date observed:** 2026-04-21
- **Filed date:** 2026-04-22 (backfilled — attribution record for Catch'em's existing model)
- **Filed by:** Claude, at Tyler's direction
- **File basis:** Transcript provided by Tyler

## ⚠️ Attribution importance

**Catch'em's intrinsic value model (coded in `catchem.jsx`) is derived from the framework presented in this video.** This file is the formal attribution record. Any public Catch'em content that references the intrinsic value model should credit PokeDataDadGuy's published framework as the inspiration, while noting Catch'em's calibration/implementation work.

---

## Executive summary

PokeDataDadGuy presents a two-factor pricing model that predicts modern Pokemon TCG chase-card prices with R² ≈ 0.88 accuracy on a small sample. **Supply side:** "pull cost" — pull rate × number of cards in rarity tier = average packs to pull a specific card. **Demand side:** "desirability index" — 45% character premium + 45% artwork/hype + 10% Google Trends external factor, normalized to 1-10 scale. Model output identifies under- and over-valued cards relative to fundamentals. Key finding: desirability is ~2.1x more impactful than pull cost (41%/point vs 19%/point in coefficient terms).

This is a **quantitative framework**, not a price-to-the-dollar prediction tool. He frames it as "flagging outliers where market diverges from fundamentals."

---

## Key insights from the video

### The supply-side math: pull cost

- **Pull rate:** frequency of pulling any card in a given rarity tier (e.g., 1-in-45 packs)
- **Rarity tier population:** number of distinct cards that can appear in that slot
- **Pull cost formula:** pull_rate × tier_population = average packs to pull this specific card

Example calibration: Prismatic Evolutions had a 1-in-45 pull rate for its top rarity tier, but with so many cards in the tier, pulling a *specific* chase card averaged well above 45 packs.

**Why this matters:** A card being "rare" on its rarity-tier label doesn't tell you the full story. Rarity tier population is the hidden variable.

### The demand-side math: desirability index

Three components, weighted:

| Component | Weight | Description |
|-----------|--------|-------------|
| Character premium | 45% | Rank of the Pokemon character across all printings and rarities, normalized to 1-10 |
| Artwork / hype | 45% | Subjective visual appeal + community sentiment around specific card |
| Universal appeal | 10% | Google Trends search volume for the character |

Character premium is derived from historical printing data — "how does this character rank if you average its placement across every printing in every set." Charizard ≈ 1.1 average rank (nearly always top). Umbreon ≈ 1.3. Mew ≈ 1.4. Dragonite ≈ 2.3.

Artwork/hype examples:
- **10:** Bubble Mew (Paldean Fates), Mega Charizard X (Phantasmal Flames) — universally acclaimed
- **9:** Destined Rivals Mewtwo — top chase, strong set, but art not universally beloved
- **1:** Nacli/Dachsbun — niche Pokemon, divisive art

### The model output

Combining both factors with a multiplicative formula, he gets **R² ≈ 0.88** across his sample — 88% of price variation is explained by pull cost + desirability alone.

**Coefficient values:**
- +1 pull cost point → +19% price
- +1 desirability point → +41% price

So desirability has roughly **2.15x the impact per point** compared to pull cost.

### Case studies from the video

**Gardevoir ex (Scarlet & Violet base)**
- Low pull cost (1.4)
- Mid-tier desirability
- Model predicts ~$71, market ~$65
- **Verdict:** model fits well

**Charizard ex 223 (Obsidian Flames)**
- Very low pull cost (easiest to pull of his sample)
- High desirability (7.8) — downgraded slightly for art
- Model suggests slight undervaluation
- **Verdict:** maybe undervalued, pull-cost drag

**Charizard (151)**
- Mid-low pull cost
- High desirability (Charizard + strong art)
- Model predicts ~$500, market was ~$400 at recording
- **Verdict:** market catching up to fundamentals (his interpretation)

**Umbreon ex (Prismatic Evolutions)**
- Very high pull cost
- Very high desirability
- Model suggests slightly undervalued vs market
- **Verdict:** premium warranted, possibly more upside

**Mega Charizard X (Phantasmal Flames)**
- Low pull cost (2)
- 10/10 desirability ("best Charizard art ever")
- Model predicts ~$500, market at ~$800+
- **Verdict:** notable outlier — possibly overvalued OR "must-have" psychology overriding fundamentals

**Pikachu ex (Ascended Heroes)**
- Very high pull cost
- Higher desirability than Dragonite
- Model supports Pikachu overtaking Dragonite in price ranking over time

---

## Verbatim quotes worth preserving

Used sparingly. These are the phrasings that carry weight.

On the model's purpose:
> "It's not going to be able to predict everything, but for the most part, there are some patterns here. And there's definitely some cards out there that are way above and below we should be seeing for market price."

On character premium:
> "If you were to take every card that's been printed with that character on it across every rarity tier and across every set that's been released, how does that character rank across all that?"

On the Mega Charizard X outlier:
> "People would rather take the risk of just buying the card at a high price than take a risk of opening the packs and just getting a lot of trash."

That last quote is particularly useful — it captures a real market-psychology dynamic (direct-buy vs pack-opening risk appetite) that applies beyond Mega Charizard X.

---

## How Catch'em implemented this (the attribution record)

**Implementation status:** Catch'em adapted PokeDataDadGuy's two-factor framework into its own calibrated formula, which lives in `/outputs/catchem.jsx`.

**Catch'em's formula:**
```
intrinsic_value = BASE × (1 + supplyCoef)^(scarcity - 5) × (1 + demandCoef)^(desirability - 5)
```

**Calibrated constants (from memory entry #7):**
- BASE = $10
- supplyCoef = 0.45/pt (his effective rate: ~0.19/pt before log-scaling)
- demandCoef = 0.68/pt (his effective rate: ~0.41/pt)

**⚠️ TODO — still open:**
1. **Naming convention:** Memory instruction says "USE CATCH'EM-ORIGINAL NAMING (not his terms)" — but actual renaming hasn't been finalized. His terms are "pull cost" and "desirability index." Catch'em needs distinct terms before any public-facing feature exposes the model.
2. **Character tier system:** Catch'em has its own character tier classification (S/A/B tiers per memory #6). This replaces his character-premium-rank-from-printings approach with a Catch'em-curated system. Different methodology, different defensibility.
3. **Public attribution plan:** If Catch'em ever publishes the intrinsic value feature externally (blog post, newsletter explainer, in-app methodology link), the attribution should read something like: "Catch'em's intrinsic value model was inspired by the supply-demand framework published by PokeDataDadGuy in April 2026. Catch'em has extended the methodology with [Catch'em-original modifications]."

---

## Implications for Catch'em

### What we borrowed (openly)

- Two-factor structure (supply × demand)
- Pull rate × rarity-tier population as scarcity derivation
- Character premium as component of desirability
- R² as goodness-of-fit measure

These are **general analytical techniques** and do not constitute copying. We'd do the same math independently in most cases. Filing this note because attribution matters even for general techniques when a specific source sparked the implementation.

### What Catch'em does differently

- **Character tiers** are Catch'em-defined (S/A/B with specific character assignments) rather than derived from printing ranks
- **Desirability weighting** may differ from his 45/45/10 split
- **Calibration** is Catch'em's, tested against Catch'em's bot-collected prices
- **Integration** — Catch'em's model feeds into a broader app experience (Signals, pack system, Bag) rather than being the centerpiece

### Differentiation vectors

- **Catch'em publishes the methodology transparently** (per knowledge base commitments). PokeDataDadGuy explains it in a video but doesn't have a formal documentation page yet.
- **Catch'em connects the model to editorial content** — newsletter issues, Signals framing, collector-vs-flipper-vs-grader POVs. His model is a tool; Catch'em's model is part of a story.
- **Catch'em's model is one feature among many.** His is the centerpiece of his site's analytical identity.

---

## Counter-observations / where Catch'em can go deeper

1. **Small sample size.** He explicitly notes R² = 0.88 is "even with a very small amount of data." Catch'em's bot accumulates daily price data — over time, Catch'em can test his model on a much larger sample and publish findings.

2. **Subjective artwork/hype score.** 45% weight is a lot of trust in a subjective input. Catch'em could formalize this via social-signal aggregation (Reddit mentions, Discord references, pack-opening YouTube views).

3. **No timing dimension.** His model predicts equilibrium price, not movement. Catch'em's bot-collected time-series data can layer velocity on top: "this card is fundamentally worth X, it's trading at Y, and it's moved Z% in 7 days."

4. **No pull-rate verification protocol.** He trusts his pull-rate inputs. Catch'em should have a sourced-and-dated pull-rate table (Beckett, community datamining, official TPCi disclosures where available) to avoid the garbage-in-garbage-out problem.

5. **No handling of Pokemon Center exclusivity.** PC ETBs, UPCs, and other retailer-specific products have different supply dynamics. His model focuses on singles. Catch'em's broader scope needs to address sealed-product exclusivity as a supply variable.

---

## Benchmarking opportunities

- When Catch'em has 60-90 days of daily price data, re-run his model on our sample and compare R² values. Publish findings.
- For each of his 6 case-study cards, compare his price predictions to Catch'em's bot-observed prices over time. Track divergence.
- Test his "desirability is 2.1x more important than pull cost" claim against Catch'em's broader sample. Refute, confirm, or refine.

---

## Action items

- [ ] **Finalize Catch'em naming for his "pull cost" and "desirability index" terms** — TODO flagged but not resolved
- [ ] **Document the attribution plan for public release** — decide if/how we credit him in public Catch'em content
- [ ] **Run the model on Catch'em's bot data** once we have 60+ days of history
- [ ] **Test his 2.1x ratio** (desirability vs pull cost impact) on Catch'em's sample
- [ ] **Write the "methodology" page** for the Catch'em app that documents how intrinsic value is calculated, with appropriate source attribution

---

## Filed

**Filed by:** Claude
**Filed date:** 2026-04-22 (backfilled)
**Reviewed by Tyler:** pending

*Related: sibling research files — the April 22 market dynamics tool launch and the movers leaderboard launch.*
