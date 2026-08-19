# Catch'em Marketplace + Berry Economy — Design Spec

> **Purpose:** Full design for Catch'em's in-house marketplace, Berry currency system, pack economy, and membership tiers.

> **Status:** v0.1 — 2026-04-22. Design doc. Not a build doc. This is a Year 2 feature — design exists now to preserve thinking, implement post-V1 launch with real user data.

**Core concept:** Catch'em operates a closed-economy marketplace where users trade cards among themselves using Berries (in-game currency). No dollar-denominated transactions between users. Berries are sold separately as a cosmetic/support purchase that funds Catch'em's operation. Per-transaction Berry tax creates a currency sink to prevent inflation.

---

## 1. Why This Model

A few notes for future-self about why this structure was chosen over alternatives:

**No dollars between users = sidesteps regulatory complexity.**
Real-money TCG marketplaces face significant compliance burden: payment processor KYC, sales tax collection (varies by jurisdiction), 1099 reporting thresholds in the US, securities considerations if cards behave like investments, virtual asset regulations in certain states and countries. A closed Berry economy avoids all of this. Users aren't "selling cards for money" — they're trading within a game.

**Berries-for-dollars as donation, not purchase, reframes the psychology.**
Microtransaction framing creates pay-to-win anxiety, competitive pressure, and bad optics. "Buy Berries to support Catch'em" framing puts the purchase in Patreon/tip-jar territory — users supporting a creator they like, optionally accelerating their experience. Different feeling, different retention curve, different community vibe.

**Per-transaction Berry tax = classic sink mechanic.**
Every in-game economy in history has had inflation problems when currency enters faster than it exits. A tax on marketplace transactions removes Berries from circulation, keeping Berry value meaningful over time. This is standard MMO design (WoW's auction house cut, EVE Online's broker fees, Runescape's grand exchange tax). Proven mechanic.

**Free+Pro tier structure = clear value without paywall.**
Free users get a meaningful experience (1 free pack/day, full marketplace access, full collection features). Pro users get accelerated experience (3 free packs/day, higher Berry-purchase caps). Pro feels like support + convenience, not "the real game."

---

## 2. Berry Economy — Faucets and Sinks

A healthy economy requires balanced currency flow: Berries must enter the system (faucets) at a rate matched to Berries leaving the system (sinks).

### Berry Faucets (how Berries enter circulation)

| Faucet | Rate | Notes |
|---|---|---|
| **Daily pack opening bonus** | +X Berries per pack opened | Rewards active play |
| **Streak milestones** | Bump at Day 7, 30, 100, 365 | Retention reward |
| **Pulling rare/legendary cards** | +Y Berries on chase pulls | Celebratory mechanic |
| **Top float achievements** | +Z Berries on setting a new record | Reinforces float system |
| **Newsletter engagement** | Small Berry reward for reading | Keeps newsletter sticky |
| **Dollar purchase (Pro/support)** | Direct injection | Primary revenue faucet |
| **Selling cards on marketplace** | Full listing price in Berries minus tax | Redistribution, not net-new currency |

**Note on marketplace sales:** these are redistributions between users, not Berry creation. Seller gains (price - tax), buyer loses (price). Net effect on total Berry supply: -tax.

### Berry Sinks (how Berries leave circulation)

| Sink | Rate | Notes |
|---|---|---|
| **Buying packs with Berries** | Full pack cost | Primary intentional sink |
| **Marketplace transaction tax** | X% of sale price | Scales with economy volume |
| **Listing fees** | Small fixed Berry cost to list | Prevents spam, encourages thoughtful pricing |
| **Cosmetic purchases** (V3+) | Variable | Card frames, profile backgrounds, pack animations |
| **Trade fees** | Small Berry cost per trade | If peer-to-peer trading exists alongside marketplace |

### Balance target

Daily Berry inflow per active user should roughly equal daily Berry outflow per active user. If users accumulate Berries faster than they spend, the currency inflates and marketplace prices balloon. If users burn Berries faster than they earn, the free experience degrades.

**Design principle:** faucets generous enough that free players feel rewarded, sinks frequent enough that Pro purchases remain valuable. The gap between free and Pro earn rates is where the monetization lives — not in gating features.

### Starting rates (placeholder — to be calibrated with real data)

| Activity | Berry Amount |
|---|---|
| Opening a free daily pack | +50 Berries |
| Opening a Berry-purchased pack | +25 Berries (reduced to prevent Berry farming loops) |
| Rare pull | +100 Berries |
| Epic pull | +300 Berries |
| Legendary pull | +1,000 Berries |
| Gem Mint condition bonus | +500 Berries |
| Damaged condition bonus | +200 Berries (the emotional heart also pays emotional dividends) |
| Day 7 streak | +200 Berries |
| Day 30 streak | +1,000 Berries |
| Day 100 streak | +5,000 Berries |
| Day 365 streak | +25,000 Berries |
| Setting a top float record | +2,000 Berries |

| Sink | Berry Cost |
|---|---|
| Extra pack (Free tier, daily cap 1) | 500 Berries |
| Extra pack (Pro tier, daily cap 3) | 400 Berries (Pro discount) |
| Marketplace listing fee | 25 Berries |
| Marketplace tax on sale | 10% of sale price |

**All of the above are placeholders.** Real values must be calibrated after V1 launch when there's actual user behavior data. Don't lock these in until there's evidence.

---

## 3. Membership Tiers

Catch'em has two tiers. Both are fully functional Catch'em experiences.

### Free Tier

**Includes:**
- 1 free pack per day (the Daily Pack)
- Full marketplace access (buying and selling)
- Full collection features (Bag, season browsing, card details)
- Full newsletter access
- All streak mechanics
- Ability to buy additional packs with Berries, **capped at 1 additional pack per day** (so 2 total: 1 free + 1 Berry-bought)
- Can receive Berries via sales, achievements, streaks

**Price:** $0

### Pro Tier

**Includes everything in Free, plus:**
- 3 free Feels per day (the Daily Feels × 3)
- Ability to buy additional Feels with Berries, **capped at 5 additional per day** (so up to 8 total)
- Small Berry discount on Feels purchases (e.g., 400 Berries vs 500 for Free)
- Pro badge on profile (social recognition)
- Priority marketplace listing visibility (soft perk — Pro listings appear first in default sort, not a hard gate)
- Early access to new season content (1-2 day head start)
- **Supporter Variants** — see below
- Pro-only cosmetics: custom binder designs, profile backgrounds, animated pack-rip effects, "Eeeeeee" sound variants
- Pro-only tools: advanced market analytics, float tracker dashboards, price history exports
- Pro-only community: early newsletter access, Pro Discord channel, occasional AMAs

**Price target range:** $4.99-$9.99/month. Lean toward $5-7 range to feel like support rather than premium subscription.

### Supporter Variants (the Pro card system)

**Core design:** Every 2 months (target cadence, may move to monthly once sustainable), Catch'em releases a **Supporter Variant** — an alternate-art version of an existing character from the current or recent season. These variants are pullable only from Pro Feels during their release window.

**Critically: the base character is still freely available to all users.** A Free user who pulls "Sticky Boy" owns Sticky Boy. The Supporter Variant is a different *specimen* of the same character — different art, same archetype, same voice family. Collection completion for Free users is not broken.

**How it works:**
- **Cadence:** every 2 months to start (6 variants/year), targeting monthly (12/year) once operations can sustain the art production
- **Release window:** Supporter Variants are pullable from Pro Feels for 30 days, then retire permanently (Fortnite-style)
- **Float system:** variants still roll random floats on pull — no Pro advantage on condition
- **Marketplace:** Supporter Variants are fully tradeable on the marketplace for Berries, meaning Free users can acquire them secondarily — just not pull them directly
- **Art direction:** variants are meaningfully different (different pose, different accessory, different palette treatment — e.g. "Sticky Boy, Winter Edition" with a tiny scarf) but clearly the same character
- **Pricing expectation:** because supply is limited (Pro users only at pull time) and demand is unbounded (Free users can still want them), Supporter Variants will likely command premium Berry prices on the secondary market. This is intentional — creates Berry-earn opportunity for Pro users who pull them.

**What Pro does NOT include:**
- ❌ Better pulls, better odds, better base cards (odds identical to Free)
- ❌ Exclusive characters Free users can never own even secondarily (tradeable marketplace access required)
- ❌ Exclusive rarities or float advantages (Gem Mint rates identical across tiers)
- ❌ Permanent power creep (cosmetics and variants don't make Pro "stronger")

**Core principle (updated):** Pro = more Catch'em + supporter variants + cosmetics + community. A Free user can complete their character collection through play and marketplace trading. They may not own every *specimen* of every character (variants exist), but the canonical character collection is fully accessible. The "I own all 130 characters" milestone is achievable on Free.

**Why this works:**
- Pro users get a real reason to subscribe beyond "faster play"
- Free users see Supporter Variants and know they can buy them on the marketplace (visibility without walls)
- The collection hierarchy has depth (base → Supporter Variant → high-float specimens) without being class-locked
- Creator economy: Pro users who pull high-float Supporter Variants can sell them for meaningful Berry income

**Framing language (for UI):**
- Call them "Supporter Variants," not "Pro-only cards" or "exclusives"
- Tooltip on Bag view: "Only pullable from Pro Feels. Available on the marketplace."
- Pro Feels pull animation nods to variants ("You caught a Supporter Feels")
- Never use "lock icon" or "PRO ONLY" language on variants Free users can see — feels gated, not inviting

**Honest flag:** variant art production adds real work to Catch'em's art pipeline. Every Supporter Variant requires an art asset that's meaningfully different from the base character. If Tyler is drawing these himself, that's 6-12 additional art pieces per year on top of base season content. Worth planning for — or commissioning specifically for variants.

---

## 4. Berry Purchases (the support / donation layer)

Users can purchase Berries directly for dollars. This is the primary revenue channel alongside Pro subscriptions.

### Price tiers (starter)

| Package | Price | Berries | "Rate" |
|---|---|---|---|
| Pocket | $2.99 | 1,000 | 334 B/$ |
| Pouch | $9.99 | 4,000 | 400 B/$ |
| Bag | $19.99 | 9,000 | 450 B/$ |
| Box | $49.99 | 25,000 | 500 B/$ |
| Vault | $99.99 | 55,000 | 550 B/$ |

**Volume discount design:** larger purchases = better Berry/$ rate. Standard model. Also creates natural spenders.

### Framing

The Berry purchase screen should lean into the support/thanks framing, not the transaction framing:

- Copy direction: "Support Catch'em" or "Top up your Berries" — not "Buy currency"
- Receipt messaging: "Thanks for supporting Catch'em. Here's your Berries."
- No aggressive upsells, no countdown timers, no "last chance" patterns
- Pro subscription and Berry purchase are separate actions, not bundled

### Why this matters

Every free-to-play mobile game has a Berry-equivalent. Catch'em's differentiation isn't that it has one — it's that the model doesn't feel exploitative. "Thanks for supporting Catch'em" feels different from "Buy 1,000 gems, limited time offer!"

### Compliance notes (flag for future)

When Berry purchases launch:
- Must clearly disclose that Berries have no real-world value
- Must comply with Apple App Store / Google Play Store policies (30% cut on mobile IAP)
- Web-based purchase (via Stripe) avoids the 30% cut but doesn't work in mobile apps
- Hybrid: offer Berry purchases on web at a better rate, on mobile at App Store compliance rate
- Consult accountant on revenue recognition (unused Berries = deferred revenue liability)

---

## 5. Marketplace Mechanics

The marketplace is where users buy and sell cards from each other using Berries.

### Core flow

**Selling:**
1. Seller selects a card from their collection
2. Seller sets a Berry price (minimum and maximum caps enforced to prevent abuse — see below)
3. Seller pays listing fee (25 Berries)
4. Listing goes live, visible to all users
5. When a buyer purchases, seller receives (price - 10% tax) in Berries
6. The 10% tax is removed from circulation (primary Berry sink)

**Buying:**
1. Buyer browses marketplace with filters (character, tier, float range, rarity, price)
2. Buyer selects listing, confirms purchase
3. Buyer's Berries transferred to seller's balance minus tax
4. Card transfers to buyer's collection
5. Transaction history visible to both parties

### Listing controls

**Minimum listing price:** 50 Berries (prevents spam-pricing)
**Maximum listing price:** dynamic, based on that card's historical sale data
- New cards without history: hard cap at 100,000 Berries (roughly $200 equivalent)
- Cards with history: 10x the 30-day median sale price (prevents wild speculation spikes)
- Top-tier legendaries with record floats: special exemption for extreme scarcity cases, manual review

**Listing duration:** 7 days default, auto-relist option
**Listing edit:** can change price once per 24 hours without re-listing (fee)

### Filters and sort

The marketplace's filter system is where the float tracker earns its keep:

**Filter by:**
- Character (which Catch'em character is the card)
- Season (1-13)
- Rarity (common/rare/epic/legendary)
- Condition tier (Gem Mint / Near Mint / LP / MP / HP / Damaged)
- **Float range** (slider — e.g., "Gem Mint with float ≤ 0.02 only")
- Price range (Berry amount)
- Seller (Pro-only listings, verified sellers, etc.)

**Sort by:**
- Price: low to high / high to low
- Float: low to high (chase direction) / high to low (collector direction)
- Recently listed
- Ending soon
- Top float global rank

### Search

Text search on character name, character traits, season themes, etc. Autocomplete from known card catalog.

---

## 6. Marketplace Economy Anti-Abuse

A closed economy with a marketplace invites certain classes of abuse. Design in protections from day one.

### Wash trading

**Problem:** User A sells to User B at inflated price to manipulate card's historical price data, then User B sells to User A back the same way — creates fake price history.

**Mitigations:**
- Transaction history tracking per card instance: if a card has been sold between the same two accounts multiple times, flag
- Price history calculation excludes transactions flagged as potential wash trades
- Limit trades between the same two accounts to 3 per month
- Full-account linking detection (same payment method, same IP, same device fingerprint)

### Duping / exploits

**Problem:** Any bug that lets a user duplicate a card or Berries destroys the economy.

**Mitigations:**
- Atomic transactions at the database level (pack opening, marketplace sales, Berry grants all wrapped in transactions)
- Regular integrity audits (total Berries in circulation tracked at database level, reconciled against known faucets/sinks)
- Card instances have unique immutable IDs — cannot be duplicated by transfer logic
- Server-side validation on every Berry movement (no client-side currency)

### Market manipulation

**Problem:** Whale accounts corner supply of a specific card, then price-gouge other users.

**Mitigations:**
- Cards pulled from packs are tied to account for 7 days before becoming marketable (cooling period)
- Per-user listing caps (max 50 active listings at a time)
- Rare/legendary cards have additional listing limits (max 5 Gem Mint listings of any one character per user)
- Visible listing history on seller's profile

### Scam prevention

**Problem:** Users attempting to defraud each other via misleading listings, fake "top float" claims, etc.

**Mitigations:**
- Listings auto-pull card data from authoritative database (sellers can't lie about tier, float, or season)
- Screenshots in listings limited to pre-approved formats
- Report button on every listing, reviewed within 24h
- Repeat-offender accounts flagged, suspended, banned

---

## 7. Trade (peer-to-peer) — open question

Separate from the marketplace, some users will want direct card-for-card trades without Berries involved (or with Berries as makeweight).

**Option A:** No P2P trade, everything goes through marketplace. Simpler, safer, but limits user expression.

**Option B:** P2P trade with Berry makeweight ("I'll give you my Damaged Snail for your Lightly Played Ghost + 500 Berries"). More flexible, but creates scam vectors.

**Option C:** P2P trade within tier only (matched-tier swaps). Reduces scam risk but limits utility.

**Recommendation:** Ship marketplace only in V2. Add P2P trade in V3 or later based on demand. P2P is where trust-and-safety work explodes — marketplace via Berry-intermediation is safer by default.

---

## 8. Pack Economy Integration

The marketplace ties back into pack economics.

### Pack types (expanded from v3 mockup)

All pack types share the name **"Feels"** — the pack is a Feels, regardless of how it's acquired. The quantity and daily caps differ by tier, not the name. This keeps Free and Pro on equal cultural footing.

| Pack | Berry Cost (Free) | Berry Cost (Pro) | Content |
|---|---|---|---|
| Daily Feels (free) | 0 | 0 | 1 random card + Berries |
| Feels (standard) | 500 | 400 | 1 random card + Berries |
| Big Feels (premium) | 1,500 | 1,200 | 3 cards + Berries, better odds |
| Season Feels | 2,500 | 2,000 | 4 cards from chosen season, weighted toward that season's chase |

**Language system anchored to "Feels":**
- Users "rip their Feels" or "open their Feels"
- Notification: *"Your Feels are waiting."*
- Streak at risk: *"Don't lose your Feels."*
- Pull moment: *"You caught Feels."*
- Bag count: *"127 Feels this month."*
- Empty state: *"No Feels today. Rip?"*
- Tagline: *"Catch'em. Catch Feels."*

**Daily caps:**
- Free tier: 1 Daily Feels (free) + 1 Berry-bought Feels = 2 Feels/day max
- Pro tier: 3 Daily Feels (free) + 5 Berry-bought Feels = 8 Feels/day max

**Why daily caps:** prevents whales from shotgunning 100 Feels and flooding the marketplace with supply, which would crater Berry prices and hurt all sellers. Caps create sustainable supply growth.

### Odds (placeholder)

All pack types have same base rarity odds:
- 70% common
- 20% rare
- 8% epic
- 2% legendary

Condition tier odds independent of rarity (from float tracker spec):
- 35% MP
- 25% LP
- 25% HP
- 8% NM
- 6% Damaged
- <1% Gem Mint

Premium and Season packs can have slightly better rarity odds (+5% epic, +1% legendary), but never better condition odds (Gem Mint is Gem Mint — you can't pay your way to better floats).

---

## 9. Phased Rollout

**V1 (Launch):** No marketplace. No Berries for purchases. Just pack opening and collection. Proves core loop.

**V2 (~3-6 months post-launch):** Berry economy activates.
- Berries earned from play (streaks, pulls, achievements)
- Berries used to buy additional packs (within caps)
- Daily pack still free
- Still no marketplace — just personal Berry economy

**V3 (~6-12 months post-launch):** Marketplace launches.
- Sellers can list cards for Berries
- Buyers can filter by float, tier, rarity
- Tax mechanic active
- Listing fees active
- All anti-abuse systems live

**V4 (~12-18 months post-launch):** Pro tier activates.
- Pro subscription live
- 3 free packs/day for Pro
- Pro benefits live
- Berry-for-dollars purchases active (the revenue engine)

**V5 (~18+ months post-launch):** Peer-to-peer trading, cosmetics store, advanced marketplace features.

**Why this order matters:**
- V1 proves people want the product at all
- V2 proves Berries feel rewarding before introducing a marketplace around them
- V3 introduces marketplace with a currency users already understand
- V4 introduces revenue only after the product has genuine retention
- V5 adds complexity only after simpler systems are stable

**DO NOT ship marketplace before V2.** A marketplace without a healthy base currency economy is dead on arrival.

---

## 10. Metrics to Watch

When the marketplace launches, these are the health indicators:

**Economy health:**
- Total Berries in circulation (trending stable or slow growth, not exponential)
- Berry velocity (average time between Berry earn and Berry spend)
- Tax revenue per day (Berries leaving the system)
- Ratio of faucets:sinks (target ~1:1 for stable economy)

**Marketplace health:**
- Listings per day, sales per day, sell-through rate
- Average time to sale by rarity tier
- Top-selling cards (signal of hot inventory)
- Price distribution (wide vs bimodal = unhealthy)
- Wash-trade flag rate

**User health:**
- Free → Pro conversion rate
- Berry purchase frequency
- DAU interacting with marketplace vs just playing
- Churn correlation with Berry balance (do users leave when broke?)

**Content health:**
- Pull satisfaction (survey data)
- Complaints about odds
- Top float chase engagement

Track all of this from V2 onwards. Build dashboards early.

---

## 11. Open Questions to Resolve with Real Data

- **Actual Berry/$ conversion rate:** placeholders above are guesses. Needs testing.
- **Pro subscription price:** $5? $7? $10? Test in market.
- **Daily pack limits:** 2 for Free, 8 for Pro feel right, but might need adjustment.
- **Tax rate:** 10% feels standard but might need to be 7% or 15% based on inflation pressure.
- **Should Damaged cards sell higher or lower than HP?** Emotional heart might create collector premium that defies standard "worse condition = lower price" logic. This is a Catch'em-specific dynamic worth watching.
- **Regional pricing:** should Berry packs cost different amounts in different countries?
- **Gifting:** should users be able to gift Berries or cards to friends? Gifting creates virality but also abuse vectors.

None of these are blockers for V1 launch. All become real questions in V2/V3.

---

## 12. Why This Model Can Work (Honest Assessment)

I'm not bullish on most game economies. Most fail. A few reasons this one has a real chance:

**1. The core gameplay has intrinsic value.** Users engage with Catch'em because they love the characters, the voice, the newsletter, the hobby. The economy is a layer on top of existing engagement, not the engagement itself. Games that fail usually have gameplay that only works IF the economy works.

**2. The addressable market is Pokemon TCG collectors — an existing, paying, financially engaged audience.** These are people who already spend real money on cards. They understand collection, scarcity, and community. Catch'em isn't teaching a new behavior; it's giving an existing behavior a better home.

**3. The Berry-as-support framing respects the audience.** Pokemon TCG collectors are cynical about scams — they've seen too many of them. Catch'em's anti-exploitative positioning is a feature to this audience, not a limitation.

**4. The float tracker + marketplace combination creates genuine differentiation.** No other TCG product has this. First-mover advantage on a real mechanic.

**5. Founder-led voice as brand moat.** Competitors can copy mechanics. They can't copy Tyler's voice, his relationship to the collector community, or his specific perspective on what makes the hobby good.

**The risks to watch:**
- Marketplace liquidity in early days (fewer users = less interesting marketplace)
- Berry inflation if faucets too generous
- Speculation on low-float chase cards destabilizing prices
- Regulatory shifts (virtual currency regulations evolving, especially in EU)
- Pokemon Company eventually building something similar with their actual IP

**These are manageable with careful design and real data.** Don't solve them in theory — solve them as they emerge.

---

## Filed

**Filed by:** Claude
**Date:** 2026-04-22
**Version:** 0.1 — first pass

**Related files:**
- `/outputs/catchem-condition-float-tracker-spec.md` — float system (marketplace filter backbone)
- `/outputs/catchem-card-art-prompts.md` — 84 character archetypes (the inventory)
- `/outputs/catchem-strategic-response.md` — overall product strategy and positioning

**Not yet built:**
- Marketplace UI designs (V3 phase)
- Berry backend implementation (V2 phase)
- Pro subscription integration (V4 phase)
- All anti-abuse systems (V3 phase)
- Dashboards for economy health monitoring (V2+ phase)
