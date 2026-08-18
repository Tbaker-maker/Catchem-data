# Catch'em Knowledge Base

> **Purpose:** Canonical, session-persistent source of truth for everything Claude needs to know about Catch'em. Read this at the start of every session. Update it whenever something new is learned. If anything here conflicts with what's in context, this file wins — unless Tyler explicitly overrides.

> **How to use:** When Claude starts a new session, first action should be `view /mnt/user-data/outputs/catchem-knowledge-base.md`. When Claude learns something new worth persisting, append it to the relevant section and bump `last_updated`.

**last_updated:** 2026-08-18
**version:** 1.0.2
**maintained_by:** Claude (with Tyler's review)
**canonical_location:** /mnt/user-data/outputs/catchem-knowledge-base.md

---

## 0. Meta-rules for this file

1. **Append, don't replace** unless explicitly correcting an error
2. **Date-stamp every new entry** with `[YYYY-MM-DD]`
3. **If something was learned from a source**, cite the source (transcript filename, URL, Tyler's words)
4. **If something is uncertain**, flag it with `⚠️ UNVERIFIED` or `⚠️ PARTIAL`
5. **When a rule here conflicts with a memory edit**, the memory edit was probably a shortened version — this file has the full context
6. **Never silently contradict past entries** — if updating an old rule, strike the old version and reference the update

---

## 1. Tyler / Catch'em Core Facts

### Identity
- **Tyler Baker** — solo builder
- **GitHub:** `Tbaker-maker` (capital T)
- **Email forward:** support@catchemtcg.com → tylerrbakerr@gmail.com
- **Domain:** catchemtcg.com (Porkbun registrar, Cloudflare Pages hosting + DNS)
- **Waitlist:** Formspree — https://formspree.io/f/xgorlypa

### Repos
- **Catchem-data** (capital C) — bot + price tracking (Node.js)
- **catchem-app** (lowercase) — Vite + React prototype, NOT YET DEPLOYED

### Current stack (as of 2026-04-21)
- Static HTML landing page (live)
- Vite + React app (undeployed)
- Node.js bot script `fetch-sealed-prices.mjs` (NOT YET SCHEDULED — needs GitHub Actions/Railway/cron)
- **No auth, no database yet**

### What Catch'em IS
Pokemon TCG market intelligence platform. Signal-reading over hype-chasing. Serves three user modes:
- **Collector** (green UI) — what to hunt, what to hold
- **Flipper** (gold UI) — velocity + arbitrage
- **Grader** (purple UI) — pop reports + grading ROI

Players/competitive are NOT a primary pillar unless the news is massive.

### What Catch'em IS NOT
- Not a FOMO engine ("buy now or miss out")
- Not a complete card reference (that's Bulbapedia/TCGdex's job)
- Not a momentum-trader platform
- Not positioned to compete with the hype-driven YouTube creators — positioned AGAINST them

---

## 2. The Intrinsic Value Model (CRITICAL — derived from YouTube video 2 transcript, 2026-04-21)

### Source
Tyler shared two YouTube video transcripts in session `2026-04-21-01-55-10-catchem-launch-day.txt`:
- **Video 1:** Momentum/FOMO creator. Bubble rhetoric. Treated as negative positioning reference.
- **Video 2:** Analytical creator who built a **scarcity × desirability** pricing model with R² = 0.88 on his sample. **THIS is the model Catch'em uses.**

### The framework (his version)
- **Pull cost** (supply-side): how many packs on average to pull this card. Derived from pull rate × rarity tier size.
- **Desirability index** (demand-side): character popularity across printings + artwork/hype appeal + Google Trends data
- **Effect sizes:** +1 scarcity point = +19% price, +1 desirability point = +41% price (desirability ~2x more influential than scarcity)
- **Best use:** Flag outliers where market diverges from fundamentals. NOT price-to-the-dollar prediction.

### Catch'em's version (already implemented in `/outputs/catchem.jsx`)

**Core formula:**
```
intrinsic_value = BASE × (1 + supplyCoef)^(scarcity - 5) × (1 + demandCoef)^(desirability - 5)
```

**Calibrated constants (tested against real market prices):**
- `INTRINSIC_BASE = 10` (a 5,5 baseline card ≈ $10)
- `SCARCITY_COEF = 0.45` (+45% per scarcity point — higher than his 19% because our 1-10 scale is more compressed)
- `DESIRABILITY_COEF = 0.68` (+68% per desirability point — higher than his 41% for same reason)

**Functions in `catchem.jsx` (verified present — 61 CHARACTER_PREMIUM entries, 6 core functions):**
- `CHARACTER_PREMIUM` — lookup table, 61 entries
- `extractCharacter(cardName)` — strips variants (ex, VMAX, Mega, etc.) to find base character
- `characterPremium(cardName)` — returns 1-10 score, defaults to 5
- `scarcityScore(card)` — rarity tier + set meta (rotation, print status) → 1-10
- `desirabilityScore(card)` — 60% character + 40% art-tier → 1-10
- `intrinsicValue(card)` — applies the formula
- `valuationSignal(card)` — returns `{label, color, ratio, intrinsic}` with thresholds:
  - `ratio < 0.65` → "Undervalued" (green)
  - `ratio < 0.85` → "Below model" (green)
  - `ratio ≤ 1.25` → "Fair value" (neutral)
  - `ratio ≤ 1.75` → "Above model" (amber)
  - `ratio > 1.75` → "Overvalued" / "Frothy" (red)

### Validation (tested 2026-04-21)
Model caught Mega Charizard X at $800 as "frothy" — matches creator's own admission that it's "in no man's land." Gardevoir SIR at $65, Charizard 223 Obsidian at $80, Ascended Heroes Pikachu at $320 all matched model within ~10%. 151 Charizard / Prismatic Umbreon correctly flagged as frothy premium-over-fundamentals.

### Catch'em-original naming (DO NOT plagiarize creator's terms)
When writing public-facing content, use Catch'em vocabulary, not his. Current rename draft (pending Tyler's lock-in):

| His term | Catch'em term | Meaning |
|---|---|---|
| Pull cost | **Pull Friction** | Supply-side score |
| Desirability | **Demand Heat** | Demand-side score |
| Intrinsic value | **Fundamental Floor** | Model estimate |
| Undervalued | **Sleeper** (or "Below floor") | Market < model |
| Fair value | **At floor** | Market ≈ model |
| Overvalued / frothy | **Hype premium** | Market > model |
| Character premium | **Character Pull** | Per-character demand multiplier |

⚠️ Tyler has not yet confirmed these names — pending review.

### Applied to cards database
The cards database at `/outputs/catchem-cards-database.json` was built using a grail/flagship/key/notable chase tier system BEFORE this model was applied. **Rebuild needed** to replace chase_tier with scarcity_score + desirability_score + intrinsic_value + valuation_signal.

---

## 3. Chase Card Definition (Tyler's words, locked in 2026-04-21)

> "CHASE should have the highest or one of the highest buy pressure/volume. You should be able to tell a chase card with how people react with it."

**Chase is BEHAVIORAL, not price.** Signals:
- High buy pressure (bids, watches, listings clearing fast)
- High volume (many sales events)
- Community attention (pack-opening videos, Reddit threads, Discord chatter)
- The card that SELLS the set — what people hope for when they open

A $400 niche variant nobody talks about is **not** chase. Moonbreon IS chase because every Evolving Skies opener is hoping for it, regardless of current price.

---

## 4. Character Tier System (English market, locked in 2026-04-21)

| Tier | Description | Characters |
|---|---|---|
| **S** | Universal hit producers — chase potential regardless of set | Charizard, Pikachu |
| **A** | Strong sustained demand in English market | Umbreon, Espeon, Sylveon, Vaporeon, Jolteon, Flareon, Glaceon, Leafeon, Eevee, Mewtwo, Mew, Lucario |
| **B** | Strong when set art and rarity align | Rayquaza, Gardevoir, Gengar, Dragonite, Greninja, Lugia, Ho-Oh, Absol |
| **C** | Conditional — good execution required | Gyarados, Dragonair, Snorlax, Tyranitar, Blastoise, Venusaur, Zoroark, Decidueye, Meowscarada, Dialga, Palkia, Giratina |
| **D** | English-market underperformers outside iconic art | most Gen V-VIII filler legendaries, most regional birds, most ungraded uncommons |

### Trainer cards
- **Mostly excluded from Catch'em database.** English collector demand for iconic Trainer cards is historically modest compared to Japanese market.
- **Exceptions:** meta-defining (VS Seeker, Boss's Orders, Tapu Lele-GX), character-driven (Lillie, Marnie, Cynthia, N, Iono), high-art full-art trainer cards with specific cultural moments.
- **English vs Japanese:** Tyler's scope is English-only. Japanese market has much stronger trainer demand — DO NOT import Japanese-market observations into English character tiers.

### CHARACTER_PREMIUM scores (from catchem.jsx — 61 entries)

**Tier S (10 / 9.5):** Charizard 10 · Pikachu 9.5 · Mewtwo 9.5 · Mew 9.5 · Umbreon 9.5

**Tier A (9 / 8.5):** Lugia 9 · Rayquaza 9 · Gengar 9 · Eevee 9 · Dragonite 8.5 · Espeon 8.5 · Sylveon 8.5 · Gyarados 8.5 · Blastoise 8.5 · Ho-Oh 8.5

**Tier B (8):** Vaporeon · Flareon · Jolteon · Leafeon · Glaceon · Snorlax · Lucario · Garchomp · Tyranitar · Venusaur · Gardevoir · Arceus · Giratina · Greninja · Cynthia · Lillie · Red

**Tier C (7-7.5):** Dialga · Palkia · Darkrai · Kyogre · Groudon · Decidueye · Iron Valiant · Roaring Moon · Dragapult · Ogerpon · Charmander · Articuno · Zapdos · Moltres · Marnie · N · Iono · Serena · Ninetales · Nessa

**Tier D (7 and below):** Zekrom · Reshiram · Zacian · Zamazenta · Necrozma · Yveltal · Xerneas · Miraidon · Koraidon · Pecharunt · Terapagos · Bulbasaur · Squirtle · Meowth · Raichu · Alakazam · Machamp · Iron Crown · Cinderace · Blue · Leon · Jigglypuff 6.5

---

## 5. Pokemon TCG Domain Knowledge

### Research protocol (locked in after Evolving Skies $300 error, 2026-04-21)
1. **Fresh web research every session** for any factual claim
2. **Double-check EVERY stat** (pull rates, dates, card counts, populations) against: Bulbapedia, PokéBeach, Beckett, Wargamer, TCG Collector
3. **Prices:** cite CURRENT prices ONLY with verified source (Catchem-data bot, PokemonPriceTracker, or Tyler). Historical prices OK only if explicitly educational and clearly labeled historical.
4. **Flag uncertainty.** Don't bluff.

### Critical SKU rule
Special/mini-set expansions have **NO standalone Booster Boxes**. Sold only via ETBs, Booster Bundles, Collections, Tins. Sets this applies to:
- Hidden Fates, Shining Fates, Champion's Path
- Dragon Majesty, Shining Legends, Detective Pikachu, Generations
- Celebrations, Crown Zenith
- Paldean Fates, Shrouded Fable, Prismatic Evolutions
- **ALL Mega Evolution special sets:** Phantasmal Flames, Ascended Heroes, Perfect Order, Chaos Rising, Pitch Black, 30th Anniversary Celebration

Main expansion sets DO have Booster Boxes: Scarlet & Violet, Paldea Evolved, Obsidian Flames, 151, Paradox Rift, Temporal Forces, Twilight Masquerade, Stellar Crown, Surging Sparks, Journey Together, Destined Rivals, Evolving Skies, etc.

### Rotation context (as of 2026-04-21)
- **April 10, 2026:** G-mark rotated OUT (11 days ago)
- **April 10, 2027:** H-mark rotates next
- **Currently legal:** H, I, J marks
- **S&V era uses:** G, H, I marks
- **Mega Evolution era uses:** I, J marks
- **PTCGL rotates 2 weeks before paper** (March 26 for 2026)

Historical pattern: rotation transitions competitive demand → collector demand. For iconic sets with strong chase rosters, rotation is a price-positive inflection (Evolving Skies post-rotation pattern), not a negative event.

### Known errors (to avoid repeating)
- **Rotation cadence (caught by Tyler, Aug 18 2026):** Rotation is ANNUAL (every April, oldest reg mark out). "~3 years" is per-CARD legality (three marks concurrent), not rotation frequency. Newsletter 001 draft said "every three years" — wrong. Error class: plausible-cadence-misremembered (same family as PC-ETB start era).
1. **Evolving Skies Booster Box $300** — wrong by 10x. Actual ~$3,000+. Never cite prices without verification.
2. **Ascended Heroes Booster Box** — doesn't exist. Ascended Heroes is a special/mini-set (Mega Evolution series), sold via ETB/Booster Bundle only. Mega Evolution special sets have NO booster boxes.
3. **Cosmic Eclipse card count** — I said 272, actual is 271. Off by one.
4. **Partial database coverage claim** — Session 1 was marked "complete" for WOTC-Black&White era but the 2014-2026 era follow-up was pending. Always check completion status before citing.

---

## 6. Databases Already Built

### `/outputs/pokemon-sets-database.json`
- 130 sets, 10 eras, 1999-2026
- Includes `has_booster_box` (true/false/null) + `sold_as` (array) fields for SKU verification
- Flag system for pre-release sets (Pitch Black, 30th Anniversary, etc.)

### `/outputs/catchem-cards-database.json`
- 20 seed cards built with grail/flagship/key/notable chase tier system
- **NEEDS REBUILD:** Should use the intrinsic value model (scarcity + desirability scores + intrinsic_value + valuation_signal) instead of chase_tier alone
- Scope: ~1,800-3,000 cards projected once populated at scale (auto-include by rarity + price-flag + editorial override)

### `/outputs/daily-pack-mockup.html`
- Gamification system design — 4-slot pack on newsletter days
- 15 original Catch'em card designs (names/flavor written, art still needed)
- Streak system (Day 7/30/100/365)
- Requires auth + DB before real build (est. weeks 6-8 post-app-launch)

### `/outputs/bot-dashboard-mockup.html`
- Operator dashboard for `fetch-sealed-prices.mjs` output
- Supply/demand signal cards (tightening/loosening/heating/cooling)
- Rotation radar + supply shock tracker + fundamentals check
- NO DOLLAR PRICES SHOWN (per Tyler's rule after Evolving Skies error) — only percentages and trajectories

### `/outputs/newsletter-001-web.html` + `newsletter-001-email.html`
- Catch'Em News (renamed from Signals, May 14 2026) launch issue template
- 3-pillar structure: Collector (green), Flipper (gold), Grader (purple)
- Cadence: every 3 days

### `/outputs/catchem.jsx`
- Main React app — ALREADY IMPLEMENTS THE INTRINSIC VALUE MODEL (61 CHARACTER_PREMIUM entries, 6 core functions)
- Not yet deployed to app.catchemtcg.com

---

## 7. API / Data Source Landscape (verified 2026-04-21)

### What CAN'T be used
- **TCGplayer API** — closed to solo devs since eBay acquisition
- **eBay Marketplace Insights / completed listings** — deprecated, partner-only (Terapeak)

### What CAN be used
| Provider | Coverage | Free tier | Paid tier | Best for |
|---|---|---|---|---|
| **pokemontcg.io** (now Scrydex) | Singles, TCGplayer market prices | No longer free — $29/mo min | $29+/mo | Card metadata |
| **PokéWallet.io** | Singles + sealed + graded, EN+JP | 10K req/mo | Paid tiers | Best free-tier alternative |
| **pokemonpricetracker.com** | Singles + sealed + PSA/CGC/BGS/SGC, EN+JP | 100 credits/day | $9.99/mo Pro, $99/mo Business | Recommended for Catch'em launch |
| **TCGdex** | 130K cards, 6 languages, FREE | ✅ No key needed | N/A | Card identity, NO prices |
| **JustTCG** | Multi-TCG + graded + condition-specific | Free key | Request quote | If expanding beyond Pokemon |
| **PSA Public API** | PSA cert + pop data | ✅ Free official | N/A | Grading ROI feature |

### Recommended Catch'em stack (phased)
- **Phase 1 (launch, ~$30/mo):** pokemonpricetracker.com Pro + PSA Public API + TCGdex for card identity
- **Phase 2 (scale):** pokemonpricetracker.com Business ($99/mo) — adds population reports
- **Phase 3 (optional):** Multi-TCG via JustTCG/TCGAPIs

### Aggregator risk
Data licensing agreements can change (TCGplayer closed dev access — could happen again). Keep `fetchMarketCards()` / `mapApiCard()` abstraction clean so provider swaps are ~50-line code changes.

---

## 8. Newsletter System

### Cadence
Every 3 days.

### Three pillars
- 🟢 **Collector** — long-horizon holds, rotation opportunities, grails
- 🟡 **Flipper** — short-horizon velocity, arbitrage windows, sell signals
- 🟣 **Grader** — population movements, PSA pricing, grading ROI

### NOT a pillar
Players / competitive — UNLESS news is massive (rotation, ban, major event result).

### Format
Web HTML (`newsletter-001-web.html`) + email-safe dark mode (`newsletter-001-email.html`). Template to reuse for each issue.

### Trigger phrase
When Tyler says "Time for Issue 00X," Claude researches past 3 days of Pokemon news/movers/supply changes and generates from template.

---

## 9. Working Style with Tyler

### What Tyler has explicitly asked for
- **Real talk, not diplomatic.** "Don't worry about hurting my feelings. I want honest truth so we can build from it and get better."
- **Audit own work.** "Make sure you audit your own research and look for mistakes like this."
- **Document everything learned.** "We need to document everything you learn so you don't forget it and if you do you can verify." (The reason this file exists.)
- **Flag errors and fix them.** When he catches something wrong, fix it structurally so the error class can't recur (e.g., `has_booster_box` field added to set database).

### What Tyler hates
- Pattern-matching pretending to be knowledge (Ascended Heroes Booster Box error)
- Gaslighting when I can't remember something
- Overcommitting to outputs on unverified data
- Repeating errors I've already been called out for

### Communication style
- Short, concrete, ship-focused
- Will push harder when he senses I'm hedging or bluffing
- Prefers being called out on his ideas than agreed-with hollowly

---

## 10. Session Start Protocol

**At the start of every Catch'em session, Claude should:**

1. `view /mnt/user-data/outputs/catchem-knowledge-base.md` (this file) — understand current state
2. Check `/mnt/transcripts/journal.txt` — see recent session summaries
3. Check memory edits — short rules for quick-triggers
4. If Tyler asks about work from a previous session, search transcripts (`grep -l "topic" /mnt/transcripts/*.txt`) before claiming memory of it
5. If new facts emerge in session, append to this file before end of session

**Never claim to remember something without verifying against this file or the transcripts.**

---

## 11. Changelog

### 2026-04-21 — v1.0.0 — Initial creation
- Built after "major flaw" incident where Claude forgot the intrinsic value model mid-session
- Tyler correctly identified that memory edits aren't enough — needed a persistent, detailed knowledge file
- Documented: intrinsic value model (from video 2 transcript), character tier system (Tyler's locked-in definition), chase definition (behavioral not price), research protocol, known errors, working style
- Established: this file is read first in every session, updated on every new learning

### Future entries (append here)
<!-- New date-stamped updates go below this line -->

### 2026-04-22 (later) — PokeDataDadGuy / Collectrics filed as direct competitor
- **Major update:** Three transcripts from PokeDataDadGuy (@Pokedatadadguy, mycollectrics.com) filed in `/outputs/research-sources/`:
  - `2026-04-21_pokedatadadguy_pricing-model-framework.md` — backfilled attribution record for Catch'em's intrinsic value model
  - `2026-04-22_pokedatadadguy_collectrics-market-dynamics-tool.md` — his live demand pressure + supply saturation dashboard
  - `2026-04-22_pokedatadadguy_movers-leaderboard.md` — his newly launched movers leaderboard + Nacli buyout experiment + stated monetization philosophy
- **Competitor intelligence v0.2.0:** Major rewrite of `/outputs/competitor-intelligence.md`. PokeDataDadGuy / Collectrics promoted to Entry 1 as **direct competitor** (the first in Catch'em's space to ship live product). Ryan moved to Entry 2, Jack to Entry 3.
- **Strategic memo created:** `/outputs/catchem-strategic-response.md` — honest assessment of Catch'em's shipping gap vs Collectrics' live product. Week 1 priorities: deploy React app, send newsletter 001, automate bot cron. Week 2-3: data quality layer, public set database, methodology publication. Week 4-6: daily pack system with auth, Discord launch, first Catch'em-branded market dynamics feature.
- **Key attribution note:** Catch'em's intrinsic value model is **derived from** PokeDataDadGuy's April 2026 pricing-model framework. Public-facing content that exposes the model should attribute appropriately. Internal naming ("USE CATCH'EM-ORIGINAL NAMING") still pending — his terms "pull cost" and "desirability index" must be renamed before Catch'em publishes the methodology.
- **Tyler's answer to "what is Catch'em to you":** **A — Real product, but passionate.** Real product ambition + founder passion. Strategy memo calibrated to this answer.
- **Locked-in principle:** "The race isn't against Collectrics. The race is against Catch'em's tendency to design instead of ship."
- **Behavioral change for Claude going forward:** default to shipping advice over designing advice; push back harder on scope creep; flag research-drift earlier; keep honest, stay warm.

### 2026-04-22 — Research sources folder established
- New folder: `/outputs/research-sources/` — institutional memory for external Pokemon TCG research (transcripts, articles, competitor material)
- README at `/outputs/research-sources/README.md` explains file naming convention (`YYYY-MM-DD_source-slug_description.md`), required sections, and what does/does not belong
- First file filed: `/outputs/research-sources/2026-04-22_pika-pika-papa_swsh-monthly-dashboard.md` — analysis of Ryan's free YouTube dashboard-launch video
- Related new doc: `/outputs/competitor-intelligence.md` — v0.1.0 map of competitors in the Pokemon TCG data space (Ryan as entry #1, placeholders for PokemonPriceTracker, Cardrake, CardChill; future TODO list included)
- New schema field in `pokemon-sets-database.json`: `market_notes` (optional) — contextual market observations with source + date, used for editorial context not UI display
- First `market_notes` entry: Evolving Skies (singles underperformance observation from Pika Pika Papa Apr 2026 video)
- **Key principle locked in:** "Our data wins by default." Catchem-data bot is source of truth for Catch'em content. External sources (PokemonPriceTracker, Ryan's dashboard, etc.) only override our numbers if ours are MATERIALLY wrong — not for minor variance. Benchmark externally, publish internally.

### 2026-05-14/16 — Volume tracker design + Catch'Em News lock (phone sessions)
- **Newsletter renamed: "Catch'Em News"** (capital E) — locked, Hobbiest debate closed permanently. Full pipeline spec at `/outputs/catchem-newsletter-pipeline-v1.md` (Warm Tue / Cold Fri structure, section templates, Buttondown for send).
- **Sealed volume tracker spec V2** (`catchem-sealed-volume-tracker-spec.md`): daily-snapshot architecture, dual-signal ($ volume × supply), Wyckoff 4-state framework (🔥 Markup / 📈 Distribution / ❄️ Markdown / 😴 Accumulation). Interactive heat-map mockup built (`catchem-sealed-heatmap-mockup.html`).
- **`catchem-generate-queries.js` module** built (negative-keyword approach — **SUPERSEDED Aug 17**, see below; keep only as reference for exclusion lists).
- **28 PC-ETB SKUs** file (`catchem-pc-etb-skus.js`): Chilling Reign forward, per-SKU price ceiling overrides (151=$2000; ObsFlames/PaldeaEvo/Prismatic/EvSkies=$1500). ⚠️ Mega-era setIds in file are WRONG — fix before import.
- **X rebrand 2-week campaign** drafted (`catchem-x-rebrand-campaign.md`) — ⚠️ data points now stale, re-anchor before use.
- Status audit: `catchem-status-audit-may14.md`. Tyler caught 4 factual errors this session (PC-ETB start era, promo start era, Crown Zenith PC-ETB, $600 ceiling) — validation dynamic confirmed again.

### 2026-08-17/18 — THE BIG SESSION: return, audit, real fix, agents (Tyler back after 3-month break)
- **Context:** Tyler's brother's cancer returned in May; 3-month pause. Nothing from May was deployed. Bot ran itself daily throughout (GitHub Actions ~04:51 UTC — cron DID exist, memory was wrong). He's back, upgraded plan, set up **Claude Code on his PC** — new division of labor: this project = brain/specs, Claude Code = hands/deploy, mobile = bridge.
- **Full audit** (`catchem-full-audit-aug17.md`): eBay Browse API `-keyword` exclusions unreliable (Finding API decommissioned Feb 2025); Battle Styles self-contradiction bug in May module; Mega era real set codes are **ME01–ME06** not sv11–15 (ME01 Mega Evolution Sep 26 2025 → ME02 Phantasmal Flames → ME2.5 Ascended Heroes → ME03 Perfect Order → ME04 Chaos Rising May 22 → ME05 Pitch Black **Jul 17 2026** → ME06 Delta Reign **Nov 6 2026**); Black Bolt/White Flare need separate setIds (zsv10pt5 / rsv10pt5 — verify).
- **REAL BOT FIX WRITTEN + UNIT-TESTED** — cloned actual repos (public), confirmed live bug (JT BB $23.99, history poisoned since May 20; root cause: `sort=price` grabs 50 cheapest + no title filter). Fix = post-fetch title filtering + per-subtype price floors/ceilings + `query_error` zero-result safety + filter reports. Synthetic tests: JT median $172.50 ✓, Battle Styles regression ✓, word-boundary ✓. Deliverables: `fetch-sealed-prices-FIXED.mjs`, `bot-fix.patch`, **`CLAUDE.md`** (repo context file for Claude Code — validation protocol, hard rules, priority order). Status: awaiting Tyler's Claude Code validation vs real eBay + push. **Push to main = deploy** (next daily run picks it up).
- **Daily research agent BUILT** (`/outputs/research-agent/`): GitHub Actions (13:00 UTC) → Claude API w/ web search → commits `research/digests/YYYY-MM-DD.md` + maintains `data/release-radar.json` (seeded thru Dec 4). Rules: URL per claim, two-source dates, leads-not-facts. Tyler funded Console ($5), created key, added `ANTHROPIC_API_KEY` repo secret. Closes the 3-month-blindspot failure mode. ~$3/mo.
- **Newsletter 001 fully refreshed to August** (`newsletter-001-web.html`): new lead "One month to the 30th"; **30th Celebration verified via Pokemon.com: Sept 16** (not 18) — all-foil incl. energy, Futuristic Rare (Mewtwo/Mew ex), 1-of-30 Pikachu per pack, Base Set Charizard reprint in Classic Collection (UPC-exclusive packs), NO loose boosters, ETB 9 packs + Nidorina promo $49.99, waves Sep 16/Oct 2/Oct 30/Nov 6/Dec 4. **AH tins Aug 28** = TPC supply injection → squeeze thesis re-anchored ("publisher did what no whale could"). Grading section updated: Collectors Holdings closed Beckett buy Dec (≈80% market), April class action + June motion to dismiss, sub-$80 tiers paused behind ~12M-card backlog. Remaining: [BOT-DATA] slot, mirror to email html, subject line.
- **Automation ladder agreed:** price bot ✓ → research agent ✓ → heat-state script (next, post-validation) → API draft generator → Tyler = 10-min approval gate before send (non-negotiable — the JT bug is why).
- **Fable 5 exists** (Mythos-class, released Jun 2026). Memory/files are **per-project** — switch models inside this project or context is lost.
- **Meta-lesson locked:** May's "fix" shipped my own unvalidated bugs — same failure I criticized. Generation without real-world validation is the recurring failure mode; the validation protocol in CLAUDE.md is the answer.
