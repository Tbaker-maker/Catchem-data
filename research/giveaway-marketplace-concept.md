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
CORE TRIGGER (Tyler, Aug 19): PER-MESSAGE ROLL — any message clearing
X characters earns a small chance at a drop. Two tuning knobs: X (the
effort gate, filters "lol"/emoji-only) and p (the roll probability).
Economy math sets p from a target drop rate, e.g. ~10 eligible rolls/
user/day at p=2% ≈ 0.2 tickets/day/active chatter — tune at alpha
against real chat volume. Interval rains can layer on top for events.
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
