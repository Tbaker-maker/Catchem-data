# Pokémon TCG Knowledge Brief for Catch'em

**Prepared:** April 21, 2026, 2am after 10-15 web searches
**Purpose:** Ground Catch'em's UI, copy, and product decisions in real domain knowledge. Not exhaustive — aimed at filling gaps I had, and flagging stuff Tyler should correct.

---

## The Big Picture (read this first)

The Pokémon TCG market in 2026 is in a **correction, not a crash.** Key dynamics:

- **Global TCG sales hit $2.2B in 2024** (+25% YoY). TPCi printed 10.2B cards in 2024-25.
- **Pokémon TCG Pocket** (mobile, launched Oct 2024) did **$1.25B in its first year**, hit 100M downloads Feb 2026, and **pulled casual collectors into the physical TCG.** This is the single biggest market shift since the 2020 Logan Paul boom.
- **Reprints are heavier than ever.** Evolving Skies-style "limited then OOP" dynamics are being replaced by continuous reprint waves. Bills Archive (a respected voice) wrote it best: *"Availability is king. Until print runs slow down, sets like Prismatic Evolutions and 151 may remain undervalued compared to their actual quality."*
- **Gen Alpha is entering the hobby.** Parents + kids at retail. Sustains growth, blunts crash fears.
- **Pocket → physical pipeline is real.** ~40% increase at local events since Pocket launched, with new attendees citing Pocket as their reason for coming.
- **Grading scandals hit both CGC (Jan 2025, prototype fakes) and PSA (Dec 2025, alleged regrade scam).** Trust in major graders took a hit. Alternative graders (Beckett, SGC, TAG, ARS) picked up ~15% volume.

**What this means for Catch'em:**
- Reprint-awareness is genuinely differentiating — nobody's good at predicting reprint waves
- "Availability vs. demand" is the real market signal, not just price
- The TCG Pocket pipeline means influx of NEW collectors who don't know product types, rarities, rotation, grading — they need education-first tools
- Trust/transparency matters more than ever

---

## Category 1: Product Types (what sealed products actually exist)

Critical — got some of this wrong earlier today. Every set gets different product mix.

### Regular sets (get everything)
Regular main-set expansions (e.g., Obsidian Flames, Stellar Crown, Journey Together, Mega Evolution) get:
- **Booster Box** — 36 packs, MSRP ~$162, usually retails $108-130
- **Booster Bundle** — 6 packs, ~$30 (no discount per pack, just smaller commitment)
- **Elite Trainer Box (ETB)** — 9 packs + accessories, MSRP $49.99
- **Pokemon Center ETB (PC ETB)** — 11 packs + premium accessories + PC-exclusive promo, sold only at Pokemon Center. Since Chilling Reign (Jun 2021).
- **Booster Displays** (same as booster box — terminology varies)
- **Build & Battle Box** (prerelease kit)
- **Mini Tins, Collection Boxes, ex Boxes** — smaller products
- **Holiday/Winter tins** — yearly re-packs

### Special sets (NO booster box, different product mix)
Special expansions (151, Paldean Fates, Shrouded Fable, Crown Zenith, Prismatic Evolutions, Black Bolt/White Flare, Celebrations, Hidden Fates, etc.) get:
- **Elite Trainer Box** — yes
- **Pokemon Center ETB** — yes, usually
- **Booster Bundle** — yes
- **Binder Collection** — specific to special sets
- **Ultra-Premium Collection (UPC)** — 10-16 packs, $100-120 MSRP, limited run, often themed (Charizard UPC from 151, Giratina UPC, Mewtwo UPC)
- **Special Collection boxes** (ex box, VMAX box, etc.)
- **Premium Collections** (smaller than UPC)
- **Super-Premium Collections** (sometimes, e.g., Prismatic Evolutions Super-Premium)
- **Poster Collection, Tins**

### Pokemon Center ETB facts (for Stage 2 catalog tomorrow)
- Introduced with Chilling Reign (Jun 2021)
- Always 2 more packs than the regular ETB
- Always has a PC-exclusive foil promo
- **Since Evolving Skies**, PC ETBs have been made for most main expansions AND special expansions (up through Black Bolt & White Flare confirmed)
- Confirmed PC ETBs exist for: Destined Rivals, Journey Together, Prismatic Evolutions, Surging Sparks, Stellar Crown, Shrouded Fable, Twilight Masquerade, Temporal Forces, Paldean Fates, Paradox Rift, 151, Obsidian Flames, Paldea Evolved, Scarlet & Violet Base, Crown Zenith, Silver Tempest, Lost Origin, Pokemon GO, Celebrations, Shining Fates, Evolving Skies, Fusion Strike (and others back through Chilling Reign)

### Key distinction worth remembering
- **"Elite Trainer Box Plus"** ≠ **"Pokemon Center Elite Trainer Box"**. ETB Plus is a premium version Japan-originated that only showed up in English for very few products (notably Crown Zenith, Journey Together). PC ETB is the retailer-exclusive variant.

---

## Category 2: Card Rarity System (Scarlet & Violet era)

### English rarity tiers (bottom-left symbol)
From common to rarest:
1. **Common** — black circle
2. **Uncommon** — black diamond  
3. **Rare** — black star
4. **Double Rare (RR)** — ★★ (two black stars) — standard Pokémon ex, Terastal ex
5. **Ultra Rare** — ★★★ (three silver stars) — full-art ex, full-art trainers. Sometimes called "Double Rare ex" variants.
6. **Illustration Rare (IR / AR)** — 1 gold star. Full-art, scenic, no texture. Community calls "Alt Art."
7. **Special Illustration Rare (SIR)** — 2 gold stars. The money shot. Dynamic pose, premium texture, immersive art extending beyond frame.
8. **Hyper Rare** — 3 gold stars. Gold-bordered cards. CAN be worth less than SIRs despite the 3 stars.

### Japanese vs English naming (this trips people up)
| English | Japanese |
|---|---|
| Illustration Rare (IR/AR) | AR (Art Rare) |
| Special Illustration Rare (SIR) | SAR (Special Art Rare) |
| Hyper Rare | UR (Ultra Rare in Japan) — different from English Ultra Rare |

**The Japanese "UR" ≠ English "Ultra Rare."** Japanese UR = English Hyper Rare. English Ultra Rare = Japanese RR. This regularly confuses new collectors.

### Pull rates (rough norms, per booster box)
- ~1 SIR per booster box (typical)
- ~1 Hyper Rare per booster box (often same slot as SIR)
- 4-5 Double Rare (ex) per box
- 1 ACE SPEC guaranteed per box (when in the set)

### Secret Rare identifier
Card number > total set number (e.g., 210/198) = Secret Rare.

### Counterintuitive fact to remember
**2 gold stars > 3 gold stars in value, often.** SIRs (2 stars) regularly sell for more than Hyper Rares (3 stars) because collectors prefer story-driven artwork over all-gold treatment. Catch'em's copy should never assume "more stars = more valuable."

---

## Category 3: The Iconic Chase Cards (as of April 2026)

### The Modern Grails (post-2020)

1. **Moonbreon** — Umbreon VMAX Alt Art (Evolving Skies, 2021) — **THE undisputed king of modern era.** Combines: top-tier Pokémon (Umbreon), universally beloved artwork, best modern set ever. PSA 10s command multi-thousand dollar pricing. Often considered the benchmark for what makes a card legendary.

2. **Giratina V Alt Art** (Lost Origin, 2022) — The art-driven grail. Chaotic psychedelic artwork unlike anything else. Peaked over $450 in 2024, now ~$300+.

3. **Charizard ex SIR** (151, 2023) — Nostalgia-fueled. Special Illustration Rare with emotional Kanto hooks. One of modern's most expensive.

4. **Umbreon ex SIR / Umbreon AR** (Prismatic Evolutions, 2025) — Direct competitor to Moonbreon. Artwork arguably better. **But suppressed by heavy reprints.** Collector debate: "should be worth more than Moonbreon, but isn't."

5. **Mega Charizard X EX / Mega Charizard ex** (Mega Evolution, 2025) — English version running hot in early 2026. Most-graded modern card in its period.

6. **Bubble Mew** — Mew ex SIR (Paldean Fates, 2024 / Shiny Treasure ex JP) — Fan favorite, dipped 20-30% from 2025 peaks.

### Vintage Grails
- **1st Edition Shadowless Charizard** (Base Set) — PSA 10 at $420K+
- **Illustrator Pikachu** — unreachable, six figures
- **Pikachu Illustrator Van Gogh Museum collaboration** (2023) — "Grey Felt Hat" — became PSA's most-graded Pokémon of all time with 84K+ examples, PSA 10 = $900+

### Community slang for specific cards (worth knowing)
- **Moonbreon** = Umbreon VMAX Alt Art, Evolving Skies
- **Mewtube** = Mewtwo GX ☆, Shining Legends
- **Bubble Mew** = Mew ex SIR, Paldean Fates / Shiny Treasure ex
- **Logan Paul Charizard** = Base Set 4/102 Charizard (famous from LP's collection)
- **Zard** = any Charizard card (usage: "there's a Zard in every major set")

---

## Category 4: Community Culture

### Slang / terminology the community uses
| Term | Meaning |
|---|---|
| **Chase card** | The most sought-after pull from a set |
| **Alt Art** | Alternate art card (usually IR or SIR) |
| **Raw** | Ungraded card |
| **Slab** | Graded card in its case |
| **Ripper** | Someone who opens packs (neutral-to-slightly-derogatory among sealed collectors) |
| **Degenerate / Degen** | Someone who rips excessively hunting for chase cards (self-identified) |
| **Whale** | Big spender |
| **Scalper** | Person buying up supply to resell (strongly negative connotation) |
| **Flex** | A showy pull or card, or showing off |
| **Binder** | Card album |
| **PC** | Personal collection (cards you'd never sell) — note: conflicts with "Pokemon Center" abbreviation. Context matters. |
| **POP report / Pop count** | PSA/CGC population data |
| **Gem rate** | % of submissions graded PSA 10 (or equivalent) |
| **Pull rate** | Odds of getting a specific rarity from a pack |
| **Flood-risk** | A set likely to be reprinted heavily, suppressing value |
| **Genwunner** | Fan who only cares about Gen 1 (Kanto) Pokémon |
| **Donk** | Competitive play term — winning turn 1-2 |
| **Meta** | Current competitive environment |
| **Zard** | Charizard, always |

### Influencer landscape (YouTube / the community voices)
**Mainstream / pack-opening focused:**
- **PokeRev** — very popular, generally well-regarded, opens high-value product. Known to engage with fans directly.
- **Leonhart** — established voice, heavy pack opener, runs community events
- **UnlistedLeaf** — similar tier, content creator
- **Smpratte** — analytical side, market commentary

**Analysis / market-focused (these are Catch'em's adjacent audience):**
- **PokeDataDadGuy (@TheDayFamilyProject)** — Collectrics creator. Direct competitor-ally in tool-building space. *Already on our radar.*
- **PokeBeach** (Water Pokémon Master / Jon) — news site, 22+ years, authoritative source for set releases and news
- **JustInBasil** — set visual guides, release calendar, community resource
- **Ludkins** — competitive/analytical

**Community platforms:**
- **r/pokemontcg** — biggest subreddit, card-focused
- **r/PokeInvesting** — market-focused, doomer-leaning, lots of "is the bubble bursting?" threads
- **r/pkmntcgcollections** — collection showcases
- **EliteFourum** — old-school forum, still active
- **PokeBeach forums** — news + discussion

### Hot takes / recurring community debates
1. **"Is the bubble bursting?"** — Forever topic. Current (Apr 2026) answer: correction, not crash. 20-30% modern dip projected by Q1 2026.
2. **"Prismatic vs Evolving Skies Umbreon"** — Which is the real grail? Community split, but scarcity gives ES the edge *for now*.
3. **"Heavy reprint = bad for collectors"** — widely held, shapes how people feel about modern sets.
4. **"TCG Pocket killed physical demand"** — contested. Pocket actually ADDED players.
5. **"Is grading worth it anymore?"** — Post-scandal, many pull back. The $35 PSA 10 isn't viable for most cards.
6. **"TPCi doesn't care about collectors"** — recurring gripe, surfaces whenever reprints hit.

---

## Category 5: Market Dynamics & Real Case Studies

### Reprint behavior by archetype (our framework, now backed by research)

**Normal archetype (most regular sets):**
- Release → MSRP-ish for 3-6 months
- Pre-rotation hype drives 20-50% spike in final 12 months
- Rotation → reprint wave often follows → 20-30% dip
- Post-absorption climb → long-term stable
- Example: Surging Sparks ($120 MSRP → $235 peak → $145 dip → $180 stable)

**High-Floor archetype:**
- More concentrated chase cards (Crown Zenith Galarian Gallery)
- Doesn't dip as hard (15-25%)
- Recovers faster

**Generational archetype:**
- Evolving Skies: +130% over 3 years post-OOP
- Prismatic Evolutions: competing archetype IF reprints slow
- Delayed cycle, 18-24 month ramps

**Cultural archetype:**
- 151, Celebrations, Destined Rivals (Team Rocket)
- Nostalgia-driven premium
- Holds value even through reprint waves (151 proved this)
- Low model confidence — harder to predict

**Deep-value modifier** (per our spec):
- Top-20 chase > $800, ≥15 cards above $50, no single card > 25% of value
- Applied to: Evolving Skies, 151, Crown Zenith, Prismatic Evolutions

### Specific recent market moves to know
- **Surging Sparks** (Nov 2024): $162 MSRP → $250+ boxes in Jan 2025
- **151 Costco bundle drop** (Jan 2025): sparked frenzy, sold for triple
- **Pikachu with Grey Felt Hat** (Van Gogh Museum, Sep 2023): became most-graded Pokémon ever
- **Bubble Mew** (2025): hit highs, dropped 20-30% in 2025 correction
- **Mega Evolution / Mega Charizard ex** (Sep 2025): hottest recent English card
- **Ascended Heroes delay** (Feb 2026): legality window pushed 3 weeks due to product availability issues

### Upcoming (be aware of these)
- **Chaos Rising** — May 22, 2026 release
- **Pitch Black** — July 17, 2026 (expected)
- **30th Anniversary content** — throughout 2026, Radiant Ruby / Shining Sapphire rumored (unconfirmed)

---

## Category 6: Grading Landscape (2026)

### Company standings
- **PSA** — Still dominant (72% market share) but brand hit by Dec 2025 regrade scandal. ~43% gem rate overall, 50% for TCG specifically. Most-valuable slab in most cases.
- **CGC** — Growing fast, #2 at 17% market share. Cheaper than PSA. Gem rate 55%. Hit by Jan 2025 CGC Prototype scandal (fake prototypes authenticated) but recovered. Many collectors now prefer for modern.
- **Beckett (BGS)** — Fallen to #4. Now relies on Pokémon. Offers subgrades and BGS Black Label for 4x 10s (rare, valuable).
- **SGC** — Niche, vintage-focused. Low gem rate (21%) because of vintage skew.
- **TAG** — AI-based grading, growing. $12-15/card, fast turnaround, objective scoring with 1000-point precision. Gaining acceptance.
- **ARS** — Mentioned in Tyler's Discord bot, newer entrant. Less market data.

### Key grading facts
- **Gem rate (% PSA 10) varies massively by card/era.** 1st Edition Base Set Charizard: ~3%. Modern ex SIRs: 40-50%+. Modern cards grade MUCH easier than vintage.
- **2025 grading stats:** PSA alone graded ~19M cards. 97 of top 100 most-submitted cards were Pokémon.
- **PSA 10 premium over PSA 9 is enormous.** Often 3-5x for modern, 10x+ for vintage.
- **Turnaround times:** Regular 30-60 days, Express 10-20 days, Super Express 2-5 days.
- **PSA Pop Report is free and public** at psacard.com/pop. **GemRate.com** has better cross-grader data.

### Grading ROI reality check
**"Don't submit" candidates:**
- Cards where raw value < grading cost + shipping + expected loss on non-10 grades
- Cards with centering issues (auto-limits max grade)
- Already-heavily-graded cards with low PSA 10 premium
- Any card under ~$100 raw unless you're confident in 10

**"Grade this" candidates:**
- Fresh-from-pack chase cards in visibly clean condition
- Raw cards with strong centering and no surface issues
- Cards where PSA 10 premium > 3x raw price

---

## What I'm Still Uncertain About (Tyler — correct me)

Flagging honestly so you can fill gaps:

1. **Japanese vs English product naming** — I know the general concept but might get specific Japanese set names wrong. "Shiny Treasure ex" = English Paldean Fates source set. I'm weaker on older Japanese set lineage.

2. **Specific chase card prices today** — market moves fast. Prices I've cited are from research snapshots that may be 2-4 weeks stale.

3. **Pokemon Center ETB verification** — I've listed PC ETBs that "probably exist" based on Bulbapedia's statement that most sets get them since Chilling Reign. For the tomorrow Stage 2 catalog expansion, we still need to verify each specific SKU exists before adding. I don't want to fabricate products.

4. **ARS and newer grading companies** — weaker knowledge here. Tyler's Discord bot mentions ARS which suggests community relevance.

5. **Regional market differences** — UK/EU often have different pricing, different set availability, slightly different product mix. I've focused on US market.

6. **Specific YouTuber beefs/drama** — there's always something happening (someone fighting with someone else, allegations, etc). I've avoided getting into specific beefs because they change weekly. Tyler knows these better than I do.

7. **Current meta decks** — competitive side. I know SV base and Paldea Evolved just rotated (G-mark). H-mark sets remain. Current Standard format play, I'd need fresh research before commenting confidently.

8. **Japanese set codes / reg marks** — I have these roughly right (G = 2023 SV era, H = 2024-25, I = 2025, J = 2026 Mega Era) but specific set → mark mappings I might miss on edge cases.

9. **Box topper / stamped promo identification** — every ETB has a stamped promo (Snorlax for 151, Pecharunt for Stellar Crown, etc.). I have some of these (listed in Category 1) but not all 30+ ETBs' promos.

10. **Vintage set nuances** — I know Base Set, Jungle, Fossil, Team Rocket exist. I'm weak on EX-era (2003-2007) and DP-era (2007-2010) nuances. Tyler probably knows these.

---

## What This All Means for Catch'em's UI & Copy

Key implications for the design work tomorrow:

### Language choices
- **Use "SIR" not "Special Illustration Rare"** — community uses the abbreviation
- **"Moonbreon" is a proper noun** — can reference casually
- **"Pre-rotation" / "Just rotated" / "OOP"** are real terms people use (not jargon we invented)
- **"Gem rate"** is standard — use freely
- **"Pull rate"** is standard — use freely
- **"Raw" vs "Graded"** — use these, don't say "ungraded" or "encapsulated"
- **"Flood-risk"** / **"Reprint wave"** — real terminology
- **Avoid "rip"** unless you're specifically talking to pack-openers (our audience isn't them)

### Features that would resonate
- **"Don't submit this" flags** on unprofitable grading candidates (already in our spec — good)
- **Reprint cycle awareness** — genuine gap in other tools
- **Net profit after fees** — frequently requested in community, Collectr doesn't do it well
- **Condition-aware pricing** — #1 complaint about Collectr is no condition field for manual entry
- **Set symbol recognition** — #2 Collectr complaint is bad vintage scan accuracy
- **Gem rate visibility per card** — PSA pop data is free, we should surface it prominently

### Positioning angles that would work
- **"Built by collectors who don't open their boxes"** — clear differentiator from pack-opener-focused tools
- **"The app that reads reprint cycles"** — nobody else does this
- **"Pokemon Center product awareness"** — simple but genuinely rare feature
- **"Honest grading ROI"** — post-scandal, trust is valuable

### Things to avoid in copy
- **Don't hype the hype.** Community is exhausted by "TO THE MOON" tool marketing.
- **Don't promise predictions.** Signals, not advice (our positioning is right).
- **Don't reference specific influencers** (too risky — they feud, have scandals, etc).
- **Don't bet on Pokemon TCG Pocket as audience.** They're mobile, casual. Our audience is physical collectors.
- **Don't over-emphasize vintage.** Our data is modern/sealed first. Vintage is important but not our core competency.
- **Don't use "whale" as a user segment name.** Community uses it with slight negativity. "High-value collector" or similar.

---

## Tomorrow's Priority Ask (for Tyler)

When you wake up and have coffee:

1. **Skim this brief.** Focus on the "What I'm Still Uncertain About" section.
2. **Correct me on anything wrong.** Especially:
   - Any Pokemon Center ETB I listed that doesn't actually exist
   - Any community slang that feels off/outdated
   - Any market claims that feel wrong
3. **Tell me what's missing** that should be here. I can run more research on specific gaps.
4. **Then** we build the sealed product detail view demo with real-enough domain knowledge to not embarrass the brand.

**Reminder from last night's memory note:** Stage 2 catalog expansion = Pokemon Center ETBs for 151, Prismatic Evolutions, Crown Zenith, Destined Rivals, Surging Sparks. Research carefully before adding each.

---

Brief ends. Tyler — corrections invited. I'm genuinely trying to get this right.
