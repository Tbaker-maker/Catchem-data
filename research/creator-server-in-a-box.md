# Creator Server-in-a-Box (Tyler, Aug 19) — the bot's second act
THESIS: new creators want a community but don't know Discord admin.
Our provisioner, template-ized, gives them a pro server in one command —
with Catch'em pre-wired inside. Creator acquisition as a product.

## FLOW (creator-facing)
Invite bot → `/setup` wizard → pick template → name/emoji skin →
module toggles → provision (idempotent, dry-run preview first) →
"Your server is live" summary + next-steps embed.

## TEMPLATES v0
1. CREATOR STARTER: welcome-rules · #major-announcements +
   #announcements (two-tier, taught in the wizard) · #ping-roles ·
   #general · #flex · #clips-and-videos · 🎙 The Floor · mod-chat.
2. TCG CREATOR: Starter + #pulls-and-pickups · #market-talk ·
   #price-check (bot answers with verified values — our oracle in
   THEIR house) · #morning-pulse (webhook auto-wired, no URL handling
   — the bot creates it itself, so §14b onboarding becomes ZERO-step).
3. CATCHEM FULL: our own Architecture v1 (house use + flagship demo).

## MODULES (per-guild toggles)
Eden/POP economy ✓ default (their chat earns berries — the gift) ·
Morning Pulse ✓ · price-check ✓ · **Raffles ✗ — OURS-ONLY at v0**:
prize giveaways carry legal weight (sweepstakes rules, AMOE, fulfillment)
that we will not export to third parties casually. Later: unlockable
after a rules-template acknowledgment flow, maybe never. 

## MULTI-TENANT REQUIREMENTS (architect NOW, even before public invite)
Per-guild config table · per-guild POP ledgers (guild_id scoping on
fresh/frozen — economies never cross servers) · guild-scoped admin
roles · uninstall/clean command · provision rate limits · minimal
permission asks (ToS-clean).

## BRAND + SEQUENCE
Provisioned servers carry a tasteful "⚡ powered by Catch'em" in
welcome + pulse footers (attribution, not billboard). SEQUENCE: bot
alpha in OUR server first → v1.1 = public invite + wizard (aligns with
the existing bot-in-their-server lane). Monetization echo (later-later,
want-not-need): starter free forever; premium templates/white-label a
possible Pro perk — decide with real creators, not now.
