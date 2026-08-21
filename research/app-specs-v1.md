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
- **THE RITUAL:** app opens INTO the day's Pulse (drops with the 04:00 UTC run — a fixed morning hour across NA). Lead cards = **The Daily Three** (sealed/graded/raw watches; chip + one-line reason; tap = receipts), then catalysts, then signals. Display law: ONE number per card, its chip, one line of why. Depth lives behind the tap.
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
- **Structure is SPEC'D:** implements pack-system-spec v2 §4 (4 slots:
  Signal/Utility/Bonus/Special, free daily, streak-gated quality). Signal
  slot feeds from pulse-feed/post-ideas (machine socket). Value-chips
  layer on top per below.
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

## 9 · COLLECTION GRADE (M — needs auth+DB; parked, spec locked Aug 18)
Import: Collectr CSV export or paste (v1 — real today; NO third-party API assumed until verified). Engine grades vs our data: chase coverage %, set/era diversification, specialty-vs-mainline mix, intrinsic-model value, condition mix if provided. Output: letter grade + strengths/gaps + shareable grade-card image (brand tokens). Strategic: onboarding funnel FROM competitor apps; grade card = viral loop. Licensing-clean (user's own data).

## 10 · YOUR BRIEF — collection-personalized newsletter (ladder, Aug 18)
v0 (editorial, NO infra — 002+): the three modes (Collector/Flipper/Grader) become newsletter TRACKS — sectioned content per mode. v1 (post-auth): in-app Your Brief screen = every engine filtered to YOUR imported collection (your holdings' moves, your sets' print windows, your chases' premiums, tightening on YOUR stuff). v2 (ESP-dependent): true per-user email — only if the send platform supports per-subscriber payloads; never fake it with segments pretending to be personal. Pro-tier candidate.

## 11 · TOPIC MONITOR — per-user (engine SHIPPED Aug 18, Tyler = user zero)
data/topic-watch.json + scanner in derived → topicHits across news, price gaps, chase board, print watch → Pulse block, feed, Discord alert pings. App version: user picks topics (cards/sets/themes), same engine per-user post-auth; free tier 3 topics, Pro more (monetization note).


## §12 · RETENTION v0 — useable daily-return features, ZERO backend (Tyler, Aug 18)
Decision: meme-card collection (Feels/Backpack/archetypes) DEFERRED to
later-road. Retention now = utility rituals. All of the below run
client-side off pulse-feed.json — no auth, no DB, ships in the app today.

1. WATCHLIST (the retention keystone) — ⭐ star on every product card,
   row, and heat tile → localStorage `watch:[ids]`. "My Watch" section
   pins to TOP of home, above the Daily Three, with each item's price,
   Δ badge, spark. Empty state in voice: "Star anything — it lives here."
   Why it returns people: checking YOUR list is the market-app habit loop.
2. MOVERS TAB — ▲▼ lists from the Δ layer (truthful starting tomorrow).
   The "what happened overnight" check. Already computed; just a view.
3. COMPARE — pick any two products/chases → side-by-side across our
   instruments (price, gap, listings, premium, lifecycle, legality).
   Stateless, feed-powered. Card Ladder's most-used feature, our receipts.
4. SEARCH + FILTER on the Board — name/set/subtype/tier filters,
   client-side. Table stakes that make everything else useable.
5. VISIT STREAK CHIP — localStorage day counter, "🔥 Day 4" by the
   wordmark. Habit scaffolding without collectibles; cosmetic only.
6. ALERTS v0 — 🔔 deep-links to the Discord #alerts channel (signal
   pings already built server-side). Per-user alerts wait for auth.
ACCEPTANCE: a person can star 5 products today and have a reason to
open the app tomorrow that is THEIRS. That's the whole bar.

## §13 · DEAL CHECK — make vintage traders' lives easier (Tyler, Aug 18)
The vintage market lives on eBay, card-show floors, and FB/IG groups —
fragmented, negotiation-heavy, no trusted reference in-pocket. Deal Check
is that reference. Client-side off pulse-feed, zero backend.
1. THE CHECK — search any tracked product → instant card: today's eBay
   median, clean floor, range bar, listings, Δ, spark. A "fair-range"
   band (floorClean → median) framed in voice: "asks cluster here."
   Use case: standing at a show table deciding on a $1,400 ask in 10 sec.
2. SHARE CARD — one tap renders the check as a branded image (photo +
   numbers + date + wordmark) sized for FB/IG group posts. Sellers use
   it to legitimize asks; buyers to counter. Every share = distribution
   into exactly the groups we can't reach any other way.
3. VENUE HONESTY — vintage checks show eBay-native stats ONLY (RT-4a);
   no TCG column, no gap. Modern checks show the full instrument set.
4. SHOW MODE (garnish) — feed cached to localStorage so checks work in
   convention halls with dead signal. PWA install prompt.
Acceptance: a stranger in a Facebook vintage group posts our share card
unprompted. That's product-market fit for this feature.

## §14 · CATCH'EM STUDIO — the creator toolkit (Tyler, Aug 19)
Thesis: creators are the distribution layer of this hobby. Their daily
jobs: credible NUMBERS for thumbnails/B-roll, ANGLES to cover, LIVE data
on stream. We manufacture all three daily — Studio packages them. Every
asset watermarked (⚡ + catchemtcg.com, tasteful) = every video a
billboard. All client-side off pulse-feed.json; zero backend.

1. THE CARD MAKER (the engine — build ONCE, feeds three features):
   pick any product / chase / index / era → renders a branded stat card
   or chart as PNG (canvas export). Layouts: price card, Δ card, premium
   card, index card, heat tile, versus card (A vs B). Provenance chips
   render ON the asset — creators spreading VERIFIED/READ chips spread
   the Trust Standard itself. Same renderer powers Deal Check share
   cards (§13) and shareable Daily Three (warbook C1). One build, three
   features — this is why Studio is launch-window feasible, not post-V1.
2. STORY KITS — daily creator briefing: 3 story angles with the numbers,
   the receipts, and a suggested framing ("Temporal Forces has ~60 days
   of print left — here's the supply math"). The post-ideas generator
   already computes this; Studio formats it creator-facing. Voice laws
   apply: no calls, labeled %, glossed terms.
3. OBS OVERLAY — a static overlay route reading the live feed: current
   index, a chosen product's price+Δ, or the Daily Three ticker.
   Browser-source URL, transparent bg, brand fonts. Rip-and-ship and
   market streamers get live Catch'em data ON SCREEN for free.
4. CHART EXPORT — every chart in the app gets a ⬇ PNG button with
   watermark. Screenshots become intentional assets.

CREATOR MOTION (not a feature — a habit): seed list of ~10 (analytical
fits first; NOT direct competitors), early Pulse access, custom first
cards, zero exclusivity asks. Acceptance bar: a creator uses a Studio
asset in a video WE didn't ask about.
GUARDRAILS: watermark = brand law; assets carry date + provenance; no
"calls" language in any export template (voice v4); licensing-gated data
(graded slot) exports only after PPT clearance.

## §14b · STUDIO DISCORD RAIL — tools for THEIR servers (Tyler, Aug 19)
Creators run Discords; their communities live there. Give them tools for
their OWN servers and every embed carries us into rooms our SEO can't reach.

1. CREATOR WEBHOOK NETWORK (near-term — extends existing alert infra):
   creator drops an incoming-webhook URL from their #market channel into
   a simple form → our daily run posts them a branded Morning Pulse embed
   (index, Daily Three, top signal; provenance chips as fields; footer
   ⚡ catchemtcg.com + date). Optional: signal pings for products they
   pick. Their channel gets free daily content; we get daily impressions
   inside their community. Engine = send-discord-alerts.mjs generalized
   to a webhook list. Per-webhook caps + kill-switch + failure auto-mute.
   ⚠ SECURITY LAW: webhook URLs are SECRETS (spammable if leaked).
   NEVER in the public repo — registry file holds creator IDs/prefs only;
   URLs live in a single GitHub Actions secret (CREATOR_WEBHOOKS_JSON)
   or private store. Same burn-protocol class as API keys.
2. STORY-KIT PRIVATE FEED: same mechanism, different payload — the §14
   daily creator briefing delivered to their private #ideas channel.
   The "what do I make today" problem, solved where they plan.
3. BOT-IN-THEIR-SERVER (post-alpha lane): once OUR bot ships alpha and
   v1.1 adds /price /pulse /check cogs, the invite link becomes creator
   distribution — data cogs exportable to any server; community cogs
   (founding numbers, waitlist, economy) stay OUR-server-exclusive.
   Honor-list freeze respected: deploy first, distribute after.
SEQUENCE: webhook network + story-kit feed = launch-window (light,
existing infra). Bot distribution = post-alpha, v1.1.
FLYWHEEL MATH: N creator servers × 1 branded embed/day × their members
= compounding daily impressions with zero ad spend, growing every time
one creator tells another "just add the Catch'em feed."

## §15 · UTILITY DISPLAY DOCTRINE (Tyler, Aug 20 — "hone in on utilities")
LAW: a utility is displayed as ITS JOB — the question it answers — never
as a feature name. One card per tool: icon · the question · one LIVE
teaser stat · tap = the tool. The Tools hub becomes a first-class tab.
THE JOBS (canonical phrasing, v5/v7 compliant):
- Deal Check → "Is this ask fair?" (teaser: products tracked)
- Compare → "Which of these two?" (teaser: last compared pair)
- My Watch → "What did MY stuff do?" (own tab, elevated)
- Movers → "What moved overnight?" (teaser: top ▲)
- Net Proceeds → "What actually lands in my pocket?" (inline everywhere
  + its own calculator card: type a price → both venues' nets)
- Rip or Hold → "What does the crowd say?" (teaser: today's product)
- Pack Math → "Rip it, or buy singles?" (NEW surface — engine exists,
  app never showed it; teaser: today's best/worst $/pack)
- Print Watch → "How long can I still buy it?" (NEW app surface —
  page exists on site; teaser: nearest EOL countdown)
IA v2: bottom nav → ⚡Today · 🧰 Tools · ⭐ Watch · ▦ Board · (Compare/
Check/PackMath/PrintWatch live INSIDE Tools). Studio stays routed.
GAPS THIS EXPOSED: pack-math and print-watch had engines but no app
display — utilities the machine computes that humans never saw.

## §16 · THE STREAK SERIES — daily social posts (Tyler, Aug 21)
MODEL: the "Day N of…" format — consistent skeleton, different content
daily. Ours differs by DATA, not by randomness: the machine mints new
true material every 04:00 run. scripts/social-posts.mjs writes
research/pulse/social-queue.json each morning.
SLOTS (start with ONE, grow to three):
1. MORNING 07:00 — THE INDEX SERIES (flagship). "Day N of tracking every
   sealed Pokémon product so you don't have to" + index level, breadth
   read, methodology link, index share card. This is the habit play:
   repeat until people check our account FOR the number.
2. MIDDAY 12:30 — ONE PRODUCT, ONE HONEST NUMBER. Rotates lens on a
   4-day cycle: spread → pack math → print watch → supply shift. Same
   shape every day, never the same content.
3. EVENING 18:00 — RIP OR HOLD + track record → funnels to Discord.
POSTING: human posts from phone (10s) — X API Basic is ~$100/mo and not
worth it until the habit proves out. Automation is a later upgrade, not
a prerequisite. NEVER automate replies to strangers (X enforcement +
our honesty doctrine); Reply Radar (drafts-for-human) is the safe form.
RULES: no hype adjectives · every % labeled · "not a call" where a
number could read as advice · methodology linked · day counter never
resets (SERIES_START constant, edit once).

## §17 · POST STUDIO — the creator post generator (Tyler, Aug 21)
THESIS: a creator's hardest daily question is "what do I post?" We wake
up every morning with new TRUE material. Story Kits said what's
happening; POST STUDIO hands them finished posts.
ENGINE: scripts/post-bank.mjs → research/pulse/post-bank.json, six
angles daily (index read · pack math · two-market gap · lifecycle ·
shelf forensics · track record), each rendered for FOUR formats:
X post · YouTube title · YouTube hook · short-form script. Every idea
carries its chip (VERIFIED/READ), its card, and a "why this works" note
— we teach the craft, not just hand over copy.
APP SURFACE (/studio/posts): angle cards → tap → platform tabs → copy
button per format → card download. Voice selector (Analyst/Casual/
Energetic) changes phrasing, never numbers. "Regenerate tomorrow"
implied — the bank refreshes with the 04:00 run.
DISTRIBUTION DEAL: free for everyone; every card carries ⚡ Catch'em +
catchemtcg.com. Creators get their day back; we get our mark in every
thumbnail. Pro tier later (want-not-need): custom watermark/branding,
scheduled queues, series day-counters — never the truth itself.
LATER: YouTube expansion (full outline + chapter list + thumbnail text
suggestions), per-creator series counters, "your audience asked X" from
Discord questions. NEVER: automated replies to strangers (§16 law).
