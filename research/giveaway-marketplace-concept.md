# Giveaway Marketplace — concept capture (Tyler, Aug 19 2026)
VISION: a marketplace surface hosting FREE and PAID giveaways; eventually
a paid model built around giveaways. Engagement engine + monetization
pillar. Sequence: Year-2 monetization design (post-V1, real user data)
per standing doctrine — v0 lives earlier as the bot's raffle cog at
bot-alpha.

## ⚠ THE COMPLIANCE WALL (non-negotiable, attorney-gated)
Lottery = consideration + chance + prize. All three together = illegal
without a gambling license, everywhere that matters. Kill one leg:
- SWEEPSTAKES: free entry route ALWAYS available (AMOE, "no purchase
  necessary"), prominent, equal odds. The Whatnot-class pattern.
- EARNED CURRENCY: berries are never purchasable (standing law) →
  berry-entry raffles avoid consideration. The naturally compliant
  free model WE ALREADY HAVE.
- SKILL: judged contests (pull-of-the-week style) sidestep chance.
- CANADA (home jurisdiction): contest rules + the skill-testing
  question requirement; provincial variance.
PAID MODEL SHAPE (attorney validates exact structure): membership whose
perks INCLUDE bonus entries with free-path parity — never "buy a ticket."
Attorney consult item #1 alongside the trademark question.

## COMPOSITION WITH EXISTING SYSTEMS
- Bot raffle cog (built, tested, undeployed) = giveaway engine v0.
- Berries economy = compliant entry currency, already law-bound.
- Founding numbers / streaks = eligibility multipliers (cosmetic-side).
- Marketplace (Year-2, in-house, Berries currency per locked model) =
  the venue; giveaways = its engagement layer, free + membership tiers.
- Creator network (§14b) = giveaway distribution + co-hosted drops.
- ✅ RESOLVED: **EDEN** (Tyler, Aug 19) — the interactive giveaway bot
  living in GENERAL chat: it RAINS TICKETS on members for organically
  talking. The engagement heartbeat of the whole giveaway economy.

## EDEN — the ticket rain (defined Aug 19)
MECHANIC: during organic conversation windows, Eden triggers rain
events — tickets drop on active members. Rewards talking, not spending;
the community's heartbeat becomes the giveaway economy's faucet.
FLOW: Eden rains tickets → raffles cog consumes tickets → prizes via
sweepstakes law → (Year-2) marketplace giveaways ride the same rail.
Legacy users.free_tickets column = sacred, already the storage.
CORE TRIGGER (Tyler, Aug 19 — tuned same day): DAILY SPARK + BONUS ROLLS.
- DAILY SPARK: the FIRST message of the day clearing X characters =
  GUARANTEED ticket. Every active chatter gets the dopamine hit, fast,
  every day. No roulette on the baseline — showing up and talking pays.
- BONUS ROLLS: subsequent qualifying messages roll small p for extra
  drops (the magic layer; rare by design, ~1 extra/week for heavy
  chatters). Event rains layer on top for special moments.
- WHY: Tyler's law — "give the dopamine hit quicker; we want them using
  our economy." Guaranteed baseline drives daily return + circulation;
  variance stays where it belongs, on top.
GROWTH LADDER (Tyler, Aug 19): faucet 1+/day (tune UP not down —
dopamine first) → 1-2 raffles/WEEK at launch → cadence and prize value
scale with member count → paid members unlock more + pricier giveaways
(Tyler shills bigger prizes as the count climbs). Flywheel: talking →
tickets → raffles → winners → hype → members → bigger prizes → louder
talking.
THE HOUSE VAULT: prizes come from Tyler's own collection — zero prize
procurement cost, instant tier range (weekly packs/singles → monthly
heat → milestone grails). Requirements at deploy: a prizes-ledger
(what's committed vs personal; condition noted per prize) + accountant
flag (prizes as marketing expense).
TWO SUSTAINABILITY GUARDS (non-negotiable):
1. FULFILLMENT CAP — raffle cadence sized to Tyler's real shipping
   bandwidth (two jobs, two kids): batch ship days, ≤N packages/week,
   digital-reveal prizes (rip-on-stream) count double as CONTENT.
2. PAID-TIER LEGAL SHAPE — "paid, more expensive giveaways" is exactly
   where the lottery wall lives: member giveaways run with AMOE parity
   (free entry route, equal odds) per the locked pattern. Attorney
   blesses the exact mechanics before the first paid draw.
THE WALL (Tyler, Aug 19 — monetization doctrine): giveaways shilled in
YouTube videos sit behind a wall — an ENGAGEMENT wall, not a paywall.
Entry path: video → "prize + entry live in the Discord" → join → talk →
Eden ticket → raffle entry. The wall IS the community. Paid membership
is an optional accelerant (more entries, premium draws w/ AMOE parity)
— **paying should always be a WANT, never a NEED. Welcoming to the
masses.** This mirrors the app's free-truth-core law: one philosophy,
every surface.
WHY THIS WALL BEATS SUB-GATING: "sub+like to enter" is policy-gray
(metric manipulation under YT contest rules) and builds Google's asset.
Discord-join walls are policy-cleaner and build OURS.
YT CONTEST COMPLIANCE (at first video): official rules page (template
at deploy), "no purchase necessary" language, YouTube-is-not-a-sponsor
disclaimer, no monetization-feature-gated entries. Attorney skims the
rules template once; reused forever.
CONTENT FLYWHEEL: every raffle = announcement embed → countdown →
winner reveal → prize ripped LIVE on stream (winner's box opened
on-air, Whatnot-style) → clip → next raffle hype. Prizes become
programming; the vault becomes a content calendar.
ECONOMY SIZING (supply now ≈ 1 ticket/active/day): sinks must create
choice — raffle entries priced in multiples (e.g. small weekly raffle
3-5 tickets, big monthly 15-25), so a daily ticket feels valuable and
saving vs spending is a real decision. Tune prize cadence to DAU at
alpha; berries economy stays separate per standing law.
ANTI-FARM GUARDRAILS (design defaults, tune at alpha):
- CHAR-COUNT ABUSE GUARDS: similarity/dedupe check (repeat or
  near-repeat text = no roll) · keyboard-mash entropy filter · per-user
  cooldown between eligible rolls · daily roll cap · diminishing returns
  past N rolls. Guards stay INVISIBLE to genuine chatters — no
  "message too short" nagging, silent ineligibility only.
- Event rains (layered mode) weighted by distinct humans talking —
  5 people chatting > 1 person spamming.
- Eligibility: active in the last N minutes; claim window ~60s
  (reaction or auto-grant); per-user daily rain cap.
- No rains in command/bot channels; cooldown after each rain; new-account
  age gate; obvious-spam messages don't count toward activity.
COMPLIANCE: participation-earned tickets = no consideration — the most
defensible entry path in the whole structure. Attorney still reviews
(effort-as-consideration edge cases; Canada skill-question overlay).
OPEN AT DEPLOY SESSION: confirm whether Eden ships as a built cog in
the bot zip or spec-stage — if spec, this section is the build brief.
