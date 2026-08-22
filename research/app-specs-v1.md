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

## §18 · BINDER PAGES — the 3×3 themed grid (Tyler, Aug 21)
FORMAT: nine cards, one theme, one dark frame, handles at the bottom.
The most-engaged format collectors post — pure visual, no numbers
required. scripts/binder-page.mjs composes it; rasterize-cards turns it
into the PNG platforms accept.
OUR EDGE: art accounts curate by taste. We can ALSO curate by data —
"The Chase Wall" (nine most valuable singles we track), "One Set, Nine
Ways", "This Week's Movers", "Nine Cards Under $10 That Moved". Nobody
else can assemble those honestly, and the taste-based themes still work.
LAW: never invent a card id. Cards come from verified ids in our own
data or from a curated theme file whose ids were checked against
pokemontcg.io. A page with a wrong card is worse than no page.
STUDIO (§17 extension): creators pick a theme or hand-pick nine cards,
hit generate, download the PNG. Their page, our watermark. This is the
highest-shareability tool in the Studio.
TUNING (next pass): tighter gutters, a squarer canvas for X, optional
per-card captions, and a 2×2 variant for a four-card spotlight.
IP: card art from the standard community source with attribution on the
page; on the attorney list with the other commercial-depiction items.

## §19 · THE SHOW FLOOR — tools for both sides of the table (Tyler, Aug 22)
Card shows are the one venue where our data changes a conversation in
real time. We serve BOTH sides with the SAME numbers. This is not a
buyer-versus-vendor product and must never read like one: a vendor at a
table is a collector who turned their love into a living, and the person
across from them is a collector with cash. Both deserve to negotiate
knowing what their alternatives are actually worth. Nobody at that table
is the mark.

### THE DEAL ZONE (the flagship instrument — engine live)
A buyer's true online cost is the delivered total PLUS sales tax.
A seller's true online outcome is the ask MINUS ~13.25% fees.
Everything between beats the online route for BOTH parties.
Worked example (Evolving Skies Booster Box, today):
  eBay ask ............ $2,908
  Buyer pays online ... $3,112   (delivered + 7% tax, est.)
  Seller keeps online .. $2,522   (after 13.25% + $0.40)
  → DEAL ZONE ......... $589 wide (20.3% of the ask)
Any cash price in that band leaves both people better off than eBay.
That single number is the honest referee for a table negotiation, and
no competitor publishes it.

### BUYER TOOLS — know what you are looking at
1. Deal Check w/ delivered-total framing — a booth sticker with no
   shipping is NOT comparable to an eBay sticker; compare delivered.
2. Your walk-away number — the buyer ceiling. Above it, buy online.
3. The cash question — ask for the cash price BEFORE naming a number;
   many vendors hold a cash tier they do not advertise.
4. Bundle math — total the zone across several items; vendors discount
   volume more readily than single pieces.
5. Grading reality check — the PSA-9 tax: on established sets a 9
   usually returns less than raw plus the fee. Do not pay a graded
   premium for a card whose 9 population is deep.
6. Sealed-vs-singles — per-pack math says whether ripping or buying the
   chase outright is cheaper.
7. What NOT to buy — products whose booth price sits above the online
   delivered total.

### VENDOR TOOLS — price from your real numbers
1. YOUR BOOTH FLOOR (the one that changes behaviour): your real floor is
   your eBay NET, not your eBay ask. Selling a $2,908 box at $2,600 cash
   nets you MORE than listing it — instantly, with no fees, no shipping,
   no returns, no chargebacks. Most vendors price against the sticker and
   refuse fair cash offers that would have beaten their online outcome.
2. Fee-tier calculator — Top Rated Plus (~11.93%), Store tiers, and the
   50%-off promo on singles $1,000+ all move the floor. Set yours once.
3. What to bring — supply shifts, movers, and print-watch countdowns say
   what is tightening before a show weekend.
4. What to leave home — cooling products and saturated shelves.
5. Trade fairness — sealed and singles both sides, at delivered values.
6. Bulk/lot pricing — zone math across a lot, not per item.
7. Restock and reprint alerts — do not stock into a reprint.

### PRINCIPLES
- Publish the SAME numbers to both sides. A referee with a favourite is
  not a referee. Our credibility with vendors is worth more than a
  buyer-flattering headline.
- Every figure labelled est. where it depends on tax rate or fee tier.
- Works offline once loaded — convention halls have no signal.
- Never tell anyone what to pay. Show what each side's alternative is
  worth and let them negotiate with real numbers.

## §20 · MODES — Collector · Flipper · Grader · Balanced (Tyler, Aug 22)
Already half-locked: brand tokens assign green=Collector, blue=Flipper,
purple=Grader, and §10 makes them newsletter tracks. This finishes the
system.

### THE ONE LAW THAT MAKES MODES SAFE
**Modes reorder emphasis. They NEVER hide a number, and they never change
one.** A Flipper does not get a version of the app where the PSA-9 tax
disappears; a Collector does not get one where a widening gap is hidden.
Same truth, different first screen. If a mode ever filters OUT an
inconvenient figure it has become an echo chamber, and an echo chamber is
the opposite of everything the provenance chips stand for. Anything a
mode de-emphasises stays one tap away, never removed.
(Same shape as the Referee Doctrine: one set of numbers, many readers.)

### BALANCED — the default 🟢🔵🟣
Nobody is asked to classify themselves before they get value. Balanced is
what a first-time visitor sees: the index, the Daily Three (one sealed,
one graded, one raw — which is itself one item per lane), movers, and the
day's Did You Know. Mode selection is offered later, gently, once the app
has already been useful. Switching is instant and reversible.

### COLLECTOR (green #36d399) — "can I still get it, and what is it?"
Leads with: print-window countdowns and lifecycle phase · set hubs and
completion context · Did You Know · binder pages and card art · sealed
premium framed as rip-or-buy-the-single · watchlist grouped by set.
De-emphasised (never hidden): fee math, net proceeds, spread signals.
Voice: warmest of the four. This is where the 🍭 explainers live loudest.

### FLIPPER (blue #64a0ff) — "what moved, and what would I actually clear?"
VENDORS LIVE HERE (Tyler, Aug 22). A vendor is a flipper with a table —
identical instruments, different context. Show Mode's "I'm selling"
toggle IS the vendor face of this mode: booth floor first, fee tier
applied, what-to-bring from supply shifts and print watch. No separate
vendor persona; splitting them would double the surface for no new
information and would quietly re-introduce a them-vs-them framing.
Leads with: the Spread and its signals · movers and breadth · supply
shifts with cause candidates · Net Proceeds and the Deal Zone · index
momentum · velocity once history is deep enough.
De-emphasised (never hidden): art, lore, set completion.
Voice: tightest and most numeric. Still no calls, still no predictions —
a flipper is served by better inputs, not by bravado.

### GRADER (purple #c77dff) — "is it worth slabbing?"
Leads with: grading premium per card · the PSA-9 tax and its fresh-set
exception · pop and gem rate (when licensed) · raw-versus-slab compare ·
cert verification for buying slabs · turnaround and fee context.
De-emphasised (never hidden): sealed instruments.
Voice: the most cautionary of the four, because the downside here is a
real cheque a person writes before they know the outcome.

### IMPLEMENTATION (zero backend, ships client-side)
One localStorage key; the feed already carries every instrument, so a
mode is a reordering of sections plus an accent swap plus a different
"lead" line — no new data, no auth. Mode also tints the accent used for
chips and section headers, which is the fastest visual signal that the
app is set up for YOU. Post-auth it becomes a profile preference and
feeds §10's newsletter tracks and (later) Discord role colours.
ACCEPTANCE: switching modes changes what is at the TOP of the screen and
what colour the accents are — and changes no number anywhere. A diff of
the values shown before and after a mode switch must be empty.

## §21 · THE CREATOR PORTAL (Tyler, Aug 22)
Modes are how you READ the market. The portal is where you MAKE things.
Creators are not a fifth persona — they are a different job, and they are
our distribution layer. Everything below already has an engine; the
portal is the home that makes them findable and usable in one place.

### ALREADY BUILT, CURRENTLY SCATTERED
Post Studio (§17) six daily angles × four formats · Story Kits (§14) ·
binder pages (§18) · the OBS overlay · chart and card export · the
Discord webhook rail (§14b). A creator today has to know each URL. The
portal is one door.

### THE PORTAL — /studio
1. **TODAY** — the day's angles, kits, and freshly minted cards, newest
   first. A creator opens this at 7am and has a content day.
2. **MAKE** — Card Maker (any product/card/index → branded PNG), binder
   page builder (pick nine, or take a data-driven theme), chart export,
   Deal Zone card. Everything watermarked.
3. **STREAM** — the OBS overlay routes with a copyable browser-source
   URL, mode-accented, plus a live Rip-or-Hold vote widget.
4. **SYNDICATE** — the Discord rail: one form, their webhook, a branded
   Morning Pulse in their server every day. Plus embeddable widgets for
   their site (index ticker, single-product card, Deal Zone band) as an
   iframe/snippet — attribution baked into the embed itself.
5. **LEARN** — the "why this works" coaching that already ships with
   every angle, plus a short creator guide (what our chips mean, what
   they can and cannot claim on our numbers, how to cite us).

### WHAT THE PORTAL STILL NEEDS (not yet built)
- **Creator identity**: a lightweight registry entry (handle, channel,
  server) — ids and prefs in the repo, webhook URLs ONLY in the secret
  store, per §14b security law.
- **A public roster** — creators who use us, listed on the site. Costs
  nothing, gives them a backlink, gives us social proof.
- **Attribution mechanics** — every embed and asset carries the wordmark
  slot + catchemtcg.com; embeds link back automatically.
- **A "what's live" view** — which of their servers are receiving the
  Pulse, which embeds are deployed, when the last send happened.

### THE DEAL (unchanged doctrine)
Free, forever, for everyone. No exclusivity asks, no gating creators by
size. We give away the tools; the watermark rides along. Pro later sells
convenience — custom branding, scheduled queues, series counters — never
the truth or the assets themselves.
GUARDRAILS: raffles stay ours-only at v0 (sweepstakes law is not
something to hand a stranger) · webhook URLs never in the repo · every
exported figure keeps its chip and its est. labelling · creator copy
obeys the Referee Doctrine like ours does.

## §22 · NAVIGATION DOCTRINE — modes vs portals vs contexts (Aug 22)
Tyler asked whether everything should be a portal. It should not, and the
reason is worth writing down as a decision rule rather than a decision.

**MODE = who you are.** A lens on the SAME data. Collector, Flipper
(vendors included), Grader, Balanced. They share every screen and differ
only in order and accent. Three separate portals for these would mean
three surfaces with ~80% identical content: triple the maintenance, three
places for a feature to drift, and the Mode Honesty Law becomes almost
unenforceable across separate builds. It would also hide instruments from
the people who need them ("I'm a collector, so I never saw Net Proceeds").

**PORTAL = what you make.** A workshop with its own screens and almost no
overlap with market reading. Today that is exactly one: the Creator
Portal (§21). A second portal only earns its existence when a job appears
that shares nearly nothing with the app's screens.

**CONTEXT = where you are standing.** Show Mode (§19) is neither a lens
nor a job — it is "I am at a table, in bad lighting, with cash." That is
why it can carry a buying/selling toggle without becoming a persona.

### THE RULE FOR EVERY FUTURE FEATURE
Ask: is this a different way to READ the same data (mode), a different
THING TO MAKE (portal), or a different PLACE I am standing (context)?
- Read → it is a mode adjustment. Do not build a surface.
- Make → it belongs in the portal.
- Place → it is a context screen, and it should be ruthlessly reduced to
  what that place needs (Show Mode is huge type and no chrome for exactly
  this reason).
If a proposal fits none of the three, it is probably a feature inside an
existing screen and should be argued for there.

### WHY THIS MATTERS COMMERCIALLY
Every extra top-level surface is a place a first-time visitor can get
lost and a place our own laws can drift. Four modes, one portal, one
context is a product a person can hold in their head — and a codebase one
founder can still afford to maintain.
