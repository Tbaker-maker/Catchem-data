# Catch'em Knowledge Base

> **Purpose:** Canonical, session-persistent source of truth for everything Claude needs to know about Catch'em. Read this at the start of every session. Update it whenever something new is learned. If anything here conflicts with what's in context, this file wins — unless Tyler explicitly overrides.

> **How to use:** When Claude starts a new session, first action should be `view /mnt/user-data/outputs/catchem-knowledge-base.md`. When Claude learns something new worth persisting, append it to the relevant section and bump `last_updated`.

**last_updated:** 2026-08-18 (all-nighter)
**version:** 1.1.0

> **KB editing rule (born from 4 silent-patch failures tonight):** edits
> insert AFTER this version block using it as the anchor; every edit is
> verified by grep on the saved file before commit. Docs get the same
> artifact-proof discipline as code.

## DISCORD BOT TRUTH (Aug 18 — handoff doc reviewed)
Bot = COMPLETE, undeployed: py/discord.py, 38 cogs, tested. Deploy=Railway
(~2hr own session). Honor: pre-alpha feature freeze · berries never
purchasable · raffles for physical prizes · no Pokemon IP · legacy cols
sacred. Parked: rarity split, mint caps, dampening. Their lineage's
pricing-burn (EvSkies ETB 10x blog error) independently produced our same
verified-only law. Bot zip → PRIVATE repo only.

## STANDING DIRECTIVE (Aug 18): every session, read latest research/digests + radar; extract ideas → append research/idea-log.md; report to Tyler.

## SESSION LEDGER — Aug 17→18, 2026 (the marathon + all-nighter)
**Shipped & LIVE:** bot fix validated in production (JT $24→$285, EvSkies $144→$2,899) · workflow v2 in CI, 8 steps, secret verified · research agent (caught Mega Forces run 1) · heat engine (calibrating, reads ~Aug 26) · **The Spread** live (ask-vs-ask, dual-supply fields; day-1: 56 compared/7 signals; 151 artifact self-healed +3.9%) · Supply Watch (TCG-side dormant: provider ships no sealed counts) · **The Board** + **Morning Pulse** (md+HTML, self-generating) · **Derived layer 1**: Pack Math ($80.53 EvSkies → $5.42 Perfect Order per pack) + Narrative-vs-Tape (7 quiet movers day 1) · singles layer (11 confirmed chases + Gengar me2pt5-284; Cardmarket stored-only, stale timestamps) · expansion **70→~150 SKUs** (Batches 1–4, all audited; tins in pre-Aug-28) · Trust Standard + Content Hub + draft generator + launch arc v2 with full 14-beat drafts + IP brief + sold-data architecture + cost ledger.
**Locked (Tyler):** ⭐ THE NO-GUESSING LAW (Aug 22, house-theses.md): "No guessing. Not acting smarter than you are." Never present unverified as verified; if you cannot check it, ROUTE it (name who can); if it must ship unchecked, choose the option that cannot be wrong and label it unverified. Covers: choosing between options you cannot evaluate · stating facts from memory · reporting done from an edit not an artifact · generalising from your own environment · filling gaps with plausible content. Every existing guard exists because someone guessed once · FLEET ROUTING (Aug 22, research/FLEET-ROUTING.md): a capability gap is a HANDOFF, not a guess — chat says "I cannot verify this, routing to CC" out loud rather than approximating. Chat is BLIND to images/pages/domains; CC has browser+network+screenshots; Tyler has taste+judgment+accounts. Tyler should never have to report the same bug twice or verify what a machine could · IMAGE LAW (Aug 22): missing photo > misleading photo; order = reviewed override → TCGplayer catalogue 1000px → seller photo → none; data/image-overrides.json holds per-product rulings (xy12-etb showed FOUR boxes for a one-box SKU); chat CANNOT verify images (no CDN access) so every image change needs a human/CC eye pass · ACCESS (§23, Aug 22): EVERYTHING FREE for everyone now; all "gated/locked/premium" language removed from reader-facing copy. Future unlock = POP Protocol only (Discord membership + Frozen Berry threshold) — unbuyable by design since berries cannot be purchased; may NEVER cover price truth/methodology/corrections; language is "unlocked in the Discord", never a toll booth · CARD DENSITY RULE (Aug 22, Tyler approved): ONE card, TWO densities — EXPANDED when <=3 items share a screen (full six parts incl. plain line), COMPACT when 4+ (photo shrinks, explanation behind an ⓘ); a COUNT not a taste call, satisfies Digest + Sandbox simultaneously; ref app-mockup-v6.html · DESIGN SYSTEM (Aug 22, brand-tokens.md): one grammar two surfaces — shared 820/1040 column, one section header (hairline→mono kicker→Syne 28+), six-part card (fixed order), spacing 6/10/14/16 inside + 32/40/56 between; DESKTOP FIX = column-lock the app, cards stay 300-400px and MULTIPLY (never grow); approved token adds: section-space, num-xl 40 mono, accent-dim 40% borders-only (leashed: never decoration) · PROMPT CONVENTION (Aug 22, research/PROMPT-CONVENTION.md): every chat→CC prompt opens with 2-4 ASSUMPTIONS bullets (load-bearing premises only); CC STOPS and reports on a false premise rather than improvising around it, and names any assumption chat got wrong in its report. Audit chain: chat states → CC checks → Tyler judges · NAVIGATION DOCTRINE (§22, Aug 22): MODE=who you are (lens, shared screens) · PORTAL=what you make (Creator, own screens) · CONTEXT=where you stand (Show Mode). Decision rule for all future features: read→mode adjustment, make→portal, place→context screen; anything else is a feature inside an existing screen. Four modes + one portal + one context is the whole product · CREATOR PORTAL (§21, Aug 22): /studio = one door for Today/Make/Stream/Syndicate/Learn — unifies Post Studio, Story Kits, binder pages, OBS overlay, Discord rail, embeddable widgets; creators are a JOB not a persona (no 5th mode). VENDORS = FLIPPERS (a vendor is a flipper with a table; Show Mode selling-toggle is the vendor face) · MODES (§20, Aug 22): Balanced default + Collector(green)/Flipper(blue)/Grader(purple); MODE HONESTY LAW — modes reorder emphasis and accent only, NEVER hide or change a number (echo-chamber ban); zero backend, localStorage, feeds §10 newsletter tracks later · REFEREE DOCTRINE / v12 (Aug 22): show-floor tools serve buyers AND vendors with the same numbers — never them-vs-them; no adversarial verbs (voice-lint BLOCKS outsmart/beat-the-dealer/stop-overpaying); vendor credibility is a business asset (they run the shows, shops, Discords, streams) · SAFEGUARD REGISTRY + REPEATABLE AUDIT (Aug 22): research/SAFEGUARD-REGISTRY.md = canonical list of all 15 guards by layer w/ negative test + last-proven date; scripts/audit.mjs = fixed checklist incl. LIVE failure simulations (stale edition, partial fetch, disconnected guard), restores every file it touches, writes dated report. LAW: a guard is not real until breaking it fails the build; adding one requires manifest entry + negative test + registry row · v11 CLIFF RULE (Aug 21): confusion loses readers silently — jargon-lint.mjs scans published copy for hobby/finance terms used without a nearby plain-words gloss AND for named constructs ("the X test/rule/law") the piece never defines; hard terms block, soft terms warn; in guard manifest · v10 NAME NOTHING YOU HAVE NOT TAUGHT (Aug 21): no referencing a technique/term the same piece has not explained in plain words; takeaways state what the reader would DO, never a callback to assumed jargon · GUARD AUDIT (Aug 21, Tyler: "if something is not connected properly our system should be flagging it instantly"): scripts/guard-audit.mjs holds a MANIFEST of every safeguard + the exact code paths that must consume it, and fails the run (pipeline first step + CI) when a guard exists but is not wired. Proven by negative test — reintroducing the 2026-08-21 bug fails the audit. Adding a guard REQUIRES adding its manifest entry · VERIFY THE ARTIFACT, NOT THE INTENTION (Aug 21, after PGO leaked into a newsletter draft TWICE despite being flagged): flags are not proof — publish-assert.mjs runs LAST in the pipeline and greps every published surface for quarantined/blocked products, failing the run if found; editorial surfaces strict, Board feed allowed only with a  label · v9 SELF-REFERENCE = CAPABILITY STATEMENT (Aug 21, "trust is #1"): speak of ourselves rarely and always so the reader ends MORE confident — show the machine working, frame around reader benefit, one line then back to the market, no apology/drama voice; never suppress a material correction (public corrections page) — good light from competence made visible, never spin · CORRECTIONS POLICY (Aug 21, Tyler): newsletter is about the MARKET, not about us — bug confessions (esp. user-caught) do NOT headline; corrections live on a public permanent corrections page (findable, dated, no quiet edits) and are referenced in-issue only when a reader may have acted on the error. Quality-gate stats may appear as a quiet strength line (e.g. "179 checked, 2 held back"), never as drama. Did-You-Know facts bank at data/did-you-know.json — research gate applied per entry (source+date+chip) · v8 SPECULATION SOUNDS LIKE SPECULATION (Aug 21): READs carry their status in the verb (reads as/usually/historically/est.), never flat assertion or prediction language; chips get cropped, sentences do not; enforced by voice-lint.mjs in-pipeline (BLOCKS certainty language, WARNS flat READs) · SPECULATION IS LICENSED, fabrication and laundering are not (Aug 21): speculate freely from verified inputs w/ READ chip + falsifier; NEVER invent a figure (empty field > invented one); a single social post is a LEAD, not a source — rumors reportable as rumors, never as premises; source tiers 1-4 in RESEARCH-GATE.md · RESEARCH GATE (Aug 21, research/RESEARCH-GATE.md): facts need SOURCE + SECOND LOOK + DATE + CHIP or they do not ship; high-risk classes (SKU existence, pull rates, dates, pop figures, historical prices) always double-verified; ERROR LEDGER logs every approved error w/ its class + the guard built — fix the class, never the instance; corrections publish publicly · PNG-ONLY LAW (Aug 21): every image delivered to Tyler or published anywhere (X, IG, Discord, newsletter, share cards) is PNG — never SVG. SVG is an internal render format only; rasterize-cards.mjs converts after every mint. X/IG reject SVG outright · SLOP DEFENSE (Aug 21): publish slower than we compute — 3 layers (filters incl. multi-item guard · qa-gate.mjs blocks corrupted numbers from ALL public surfaces before publishing · 3-priciest-titles audit trail per product); blocked≠hidden (stays on Board, labeled); founder-QA flags outrank the pipeline · USD LAW (Aug 21): all public content (posts, cards, newsletter, creator copy) is USD-only; CAD toggle is in-app display only; cards stamp USD in the footer · THE PROFESSOR (Aug 20): AI help navigator — assume everyone needs help; /ask cog grounded ONLY on house docs+live feed, 🍭-first answers, NO buy/sell advice ever, 10 q/user/day, question-log→product-research flywheel + /wish demand layer (Most Wanted + Want Radar instruments, MIN-N honesty gate 25 wishers/50 events, aggregate-only, RT-6 candidate: want-velocity leads price); post-Sunday build; needs Anthropic API key · BERRY ROT (Aug 20): Fresh never timer-expires — leaves only via spend or inactivity-rot (30d threshold, 7d notice, 10%/wk, all config); any activity halts it; /hold = admin compassion freeze, audit-logged; Frozen NEVER rots · 001 APPROVED w/ proof-pass pending (fix 1-2 typos + add ONLINE drop dates to release section — online drops = standing newsletter rule from now on) · v7 DIGEST LAW (Aug 20): app = easily digested ALWAYS — glanceable, word-light, one idea/card, depth behind one tap (methodology anchors are the pressure valve); prose belongs in Pulse/methodology, never app chrome · Creator Server-in-a-Box (Aug 19): /setup wizard + templates (Starter/TCG/Full) provisions pro servers for creators — Eden+Pulse+price-check exportable, RAFFLES OURS-ONLY v0; per-guild ledgers mandatory; powered-by footer; public invite = v1.1 post-alpha · Server Architecture v1 (Aug 19): two-tier announcements (#major=rare @everyone, #announcements=cadence), ping-roles opt-in, machine channels (pulse/roh/draws), economy (#raffles #freezer-flex #price-check w/ verified answers), The Floor + Rip Night voice, launch-lean law w/ unlock-later list · 🍓 POP PROTOCOL (Aug 19): Proof of Participation — ALL Discord tools run through berries (earned-only law makes voting power unbuyable); Eden sparks berries; SOULBOUND+SPENDABLE dual currency LOCKED (soulbound = vote power, never decreases); currency NAME open — rec: Mint/Gem Mint (money+condition double meaning, Gem Mint=PSA-10=soulbound metaphor, zero IP, rename-proof) vs incumbent berries (warmer, minor IP-adjacent) — Tyler decides; tickets-col migration at deploy · MONETIZATION DOCTRINE (Aug 19): "Paid is a WANT, never a NEED — welcoming to the masses." Giveaway walls = engagement (Discord-join), never payment; paid = optional accelerant; mirrors free-truth-core. YT giveaways need rules page + no-purchase language (template at deploy) · Giveaway marketplace = Year-2 pillar (Aug 19): free via earned-berries raffles, paid via membership-perk entries w/ AMOE parity — NEVER paid-ticket lotteries; attorney gates structure; EDEN = daily-spark model (Tyler): first X+ char message/day = GUARANTEED ticket + small bonus rolls after; 1+/day faucet (tune up); 1-2 raffles/WEEK scaling w/ members; paid tier = pricier giveaways w/ AMOE parity (attorney-gated); HOUSE VAULT = Tyler's collection as prize pool (ledger + fulfillment cap ≤N pkgs/wk); winner rips on stream = content flywheel; RAFFLE ADMIN spec locked (90-sec /raffle create wizard, timed/threshold/hybrid draws, per-person caps, provably-fair published draws, VERIFIED VALUE from our own feed = 65% cash-out settlement oracle, winner pays shipping, prizes-ledger states); silent farm-guards unchanged; feeds raffles; anti-farm guards spec’d; confirm cog-vs-spec at bot deploy) · TOOLS BEFORE UI (Aug 19): CD/design session PARKED (brief evergreen in repo); queue reprioritized utility-first; Net Proceeds engine live (eBay 13.25%+$0.30 est., all live products) · ZERO-DOWNTIME system: research/WORKQUEUE.md = fleet-shared backlog (pull-claim-done protocol); rulings Aug 19: me1 premiums thin-gated (n=7), swsh5 −26% = suspected lane pollution under investigation · REPO = DATABASE law (Aug 19): every artifact ships to the repo same-turn; /outputs is a disposable mirror Tyler need not download; supersede-and-delete active (newer same-thing replaces older; v3 mockup superseded v1/v2; live workflows superseded PASTE files); one-time archive at research/archive/2026-08-19-outputs-rescue/ · Voice v6 SANDBOX RULE: every instrument ships with an ELI5 version one tap away (index+raw+graded done; heat/depth before their debuts) · GAME PLAN v1 (Aug 19): five pillars (engagement ritual, retention ladder, sentence-length utility, truth-layer usefulness, free-core accessibility) at research/game-plan-v1.md; benchmarks LANDED Aug 19 (digest in repo): D30 target 8-12%, Pro $5-7/mo, email-digest hedge mandatory, SEO landers = #1 channel · Creator strategy (Aug 19): Studio §14+14b — one PNG renderer powers Deal Check shares + Daily Three shareables + creator Card Maker; Story Kits + OBS overlay; watermark=law; seed ~10 analytical creators; Discord rail = daily branded embeds into creator servers (webhook URLs are SECRETS — never public repo) ·  ⚠ NAME DECISION OPEN (Aug 19, Tyler open to change): brief at research/name-decision-brief.md — gates: CC knockout scan → attorney; no name-coupled spend until cleared; candidates drafted · ⚠ IP: indie iOS app "CatchEm: Pokemon Card Scanner" exists — attorney/trademark consult elevated to EARLY (pre-launch-spend) · History-moat doctrine: Collectrics charts say "not enough history" — our daily runs ARE the moat; protect them · Aug 18: meme-card/collectible layer (Feels/Backpack) DEFERRED later-road; retention = utility (Retention v0: localStorage watchlist, movers, compare, search, streak chip — zero backend, specs §12) · ABSOLUTE RULE (Aug 18, Tyler verbatim: NEVER again — if CC can do a task, THEY DO IT): Tylers hands-on time is the fleets scarcest resource. Any mechanical task gets routed to CC/automation FIRST; Tylers UI time is spent only when nothing else can do it, and never on a source file that has not been machine-validated. The workflow-fence stays, but CC push-capability gets tested before any future paste ritual. · Voice v5: newcomer-clear (labeled %, no finance slang on surfaces, gloss technical terms) · Voice v4: no defensive disclaimers on surfaces (chips+verbs+drawer carry posture; definitional+Buy-Pressure lines exempt) · Vocab v3: "sealed products"/"sealed" user-facing, never "SKU"; singles="chases" · English-only · vocab v2 "Buy Pressure (est.)" + disclosure, "Active Listings" (zero user-facing "inferred") · PPT $9.99 tier (ledger; ~$15–20/mo total burn) · grail ceilings $2000/$3000 (dated corrections).
**Errors ledger grew:** #5 Celebrations no loose boosters · #6 Mega BB rule (only AH products-only) · #7 pokemontcg.io free tier works · **#8 151 has NO English booster box**.
**Gates open:** PPT licensing = publication-gated (email drafted, unsent) · heat reads Aug 26 · Grading Premium table (CC session in flight) · consolidated crosscheck HOLD list (CC) · v2.2 print (products into daily run).
**Tyler queue (no deadlines):** send 001 (checklist in newsletter/) · arc start date · IP + PPT emails · candidate-sheet curation · Gengar-284 already confirmed ✓.
**Horizon:** deploy The Board (Cloudflare Pages) · singles sold/graded enrichment cadence · Insights lottery filing · Wave C remainder.

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
- **151 (sv3pt5)** and **Pokémon GO (pgo)** [ADDED 2026-08-18, known error #8 / ruling J2 — bundle/ETB/PC-ETB/UPC (151) and products-only (GO); neither has an English booster box]
- ~~**ALL Mega Evolution special sets:** Phantasmal Flames, Ascended Heroes, Perfect Order, Chaos Rising, Pitch Black, 30th Anniversary Celebration~~
  **[CORRECTED 2026-08-18 — see known error #6.]** Web-verified against Pokemon Center + TCGplayer:
  Phantasmal Flames (me2), Perfect Order (me3), Chaos Rising (me4), and Pitch Black (me5) are
  MAIN-LINE numbered ME sets and DO sell 36-pack booster boxes (~$249.95 list for me4/me5).
  Only **Ascended Heroes (me2pt5)** is products-only in ME01–ME05 (ETB, PC-ETB, Booster Bundle,
  Mini Tins, Tech Sticker Collection, Premium Poster — no booster box). 30th Celebration remains
  no-loose-boosters per pokemon.com (packs gated inside products; boxed pack products only).

Main expansion sets DO have Booster Boxes: Scarlet & Violet, Paldea Evolved, Obsidian Flames, ~~151,~~ Paradox Rift, Temporal Forces, Twilight Masquerade, Stellar Crown, Surging Sparks, Journey Together, Destined Rivals, Evolving Skies, and Mega-era main sets me1/me2/me3/me4/me5 (me1 additionally has the Enhanced Booster Box box-topper variant — the only modern boxes with that variant are me1 and Journey Together, per Tyler).
**[CORRECTED 2026-08-18 — see known error #8.]** 151 (sv3pt5) has NO English booster box —
its English line is Booster Bundle / ETB / PC-ETB / UPC only. It belongs on the special-sets
list above (added there, dated). Additions to the no-booster-box list same date, per campaign
rulings J1/J2: **151 (sv3pt5)** and **Pokémon GO (pgo)** — pgo was structurally products-only
but absent from the list.

### Rotation context (as of 2026-04-21)
- **April 10, 2026:** G-mark rotated OUT (11 days ago)
- **April 10, 2027:** H-mark rotates next
- **Currently legal:** H, I, J marks
- **S&V era uses:** G, H, I marks
- **Mega Evolution era uses:** I, J marks
- **PTCGL rotates 2 weeks before paper** (March 26 for 2026)

Historical pattern: rotation transitions competitive demand → collector demand. For iconic sets with strong chase rosters, rotation is a price-positive inflection (Evolving Skies post-rotation pattern), not a negative event.

### Locked decision update (Aug 18)
- **Demand vocabulary v2:** "Buy Pressure (est.)" replaces "inferred sales/volume" in ALL user-facing copy; disclosure line standardized; "Active Listings" for supply. Principle (honesty about estimation) unchanged.

### Known errors
- **#9 (Aug 18, Claude chat error, caught in own QA):** claimed Darkness Ablaze
  was missing its "Rainbow Charizard VMAX" — swsh3 has NO such card; the
  Rainbow Zard VMAX is Champion's Path (swsh3pt5-074). The hole-CLASS concern
  (price-null cards vanishing) was real and fixed; the example card was
  fabricated. Verify set membership before citing chase cards. (to avoid repeating)
7. **pokemontcg.io status (Apr 2026 note overclaimed):** KB said "now Scrydex, no longer free, $29/mo min." Verified Aug 18 2026: free keyless API works (with ~33% transient 500s + rate limits). Correction logged; PokemonPriceTracker ($9.99/mo) remains the paid fallback ONLY IF free-tier staleness/instability worsens — separate integration, not built.
- **Rotation cadence (caught by Tyler, Aug 18 2026):** Rotation is ANNUAL (every April, oldest reg mark out). "~3 years" is per-CARD legality (three marks concurrent), not rotation frequency. Newsletter 001 draft said "every three years" — wrong. Error class: plausible-cadence-misremembered (same family as PC-ETB start era).
8. **151 English booster box (claimed on the main-expansion BB list, 2026-08-18, ruling J1)** — does NOT exist. The 151 English line is Booster Bundle / ETB / PC-ETB / UPC only; the tracked sv3pt5-bb IS the bundle. Line 187 corrected (struck, dated); 151 added to the special-sets list. Root cause: 151 is a main-numbered set (sv3pt5) so it was swept into the BB generalization — set NUMBERING does not imply BB EXISTENCE.
1. **Evolving Skies Booster Box $300** — wrong by 10x. Actual ~$3,000+. Never cite prices without verification.
2. **Ascended Heroes Booster Box** — doesn't exist. Ascended Heroes is a special/mini-set (Mega Evolution series), sold via ETB/Booster Bundle only. Mega Evolution special sets have NO booster boxes.
3. **Cosmic Eclipse card count** — I said 272, actual is 271. Off by one.
4. **Partial database coverage claim** — Session 1 was marked "complete" for WOTC-Black&White era but the 2014-2026 era follow-up was pending. Always check completion status before citing.
5. **Celebrations "loose packs" claim (2026-08-18, caught by Tyler)** — Celebrations (2021) had NO loose/standalone boosters; packs existed only inside sealed products (ETBs, collections, UPCs) — same distribution format as 30th Celebration. Celebrations stayed cheap because of PRINT VOLUME (relentless reprints), not distribution format. Never contrast 30th vs Celebrations on pack availability.
6. **"ALL Mega sets have no booster boxes" claim (2026-08-18, caught by web verification during SKU planning)** — WRONG for 4 of 5. Phantasmal Flames, Perfect Order, Chaos Rising, and Pitch Black are main-line ME sets with 36-pack booster boxes, each verified via 2+ independent retail sources incl. pokemoncenter.com product pages and TCGplayer product listings (me4/me5 boxes list ~$249.95). Only Ascended Heroes (me2pt5) is products-only. The error came from over-generalizing known-error #2 (AH has no box — true) to the whole era. Lesson: "pt5"-suffixed API ids mark special sets; integer ids mark main sets with boxes.

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
| **pokemontcg.io** | Singles, TCGplayer market prices | **[CORRECTED Aug 18 2026 — known error #7]** Free keyless tier FUNCTIONAL (verified by live runs) but flaky: ~1/3 transient 500s, rate limits. Scrydex = commercial tier, status unverified. Freshness/citation gates govern use. | $0 (free tier) | Singles prices + set ids |
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
- **LATE-SESSION UPDATE (Aug 18 ~03:40 UTC):** Claude Code VALIDATED against real eBay and PUSHED (commit f80d876 lineage, "validated against eBay 2026-08-18"). Its spot checks caught 4 more bugs incl. one in MY fix: (1) vintage bypass — $800 BB ceiling excluded all real Base Set boxes; (2) bare "bundle" let weighed lots through; (3) damaged-sealed titles ("2 Tears") passing; (4) JP imports dragging medians (JP Battle Partners ~$100 vs EN JT ~$150-270). BIGGEST: **Evolving Skies BB published $144 vs real ~$2,900** — window sat below market entirely. Heat reads restarted from 2026-08-18 for ALL SKUs (dark ~8 days, rebuild clean). JT real median ~$270. ENGLISH-ONLY locked as policy. Newsletter [BOT-DATA] plan: point-in-time facts now, Wyckoff reads return next issue.
- **Meta-lesson locked:** May's "fix" shipped my own unvalidated bugs — same failure I criticized. Generation without real-world validation is the recurring failure mode; the validation protocol in CLAUDE.md is the answer.
