# Catch'em Discord — 2026 Blueprint (April strategy × tonight's machine)

## What changed since April
April's Level-2 blocker ("needs backend+auth") is DEAD for read-only:
the machine publishes public JSON. The bot reads raw.githubusercontent
(Catchem-data main) → real commands, zero backend, zero auth:
- `/price <card>` → singles-prices.json (VERIFIED chip + provenance line)
- `/pulse` → pulse-feed.json (panel + top signals)
- `/signals` → divergence rows (both markets, both supplies)
- `/packmath` → derived-insights.json ladder
- `/radar` → next drops
Every reply carries the provenance footer. Trust Standard in chat form.

## Server skeleton (v1 — small on purpose; empty channels kill servers)
📌 START-HERE — welcome + Trust Standard one-pager + role picker
📟 machine-room — webhook lives here: daily Pulse + ⚡ alerts (read-only)
💬 trading-floor — general market talk (bot XP weighted here)
🎴 pulls-and-pickups — show-off channel (peer-tip reactions = XP)
📰 newsletter — Catch'Em News drops + discussion
🔒 collectors-lounge — unlocks at rank 3 (the carrot)

## Roles (Pokémon-native ladder)
@Hatchling → @Trainer → @Ace Trainer → @Elite → @Champion
Earned via the reward bot (April rules: thoughtful-message XP with
cooldowns + min-length, peer tips weigh 2×, zero pure-count farming).

## Bot roster
1. THE ENGAGEMENT BOT (Tyler's, from the other chat) — XP/ranks/tips.
   OPEN QUESTIONS on retrieval: stack? schema? WHERE DOES IT HOST?
   (Railway/Fly free tier vs PC = the real decision.) Token: regenerate.
2. THE MACHINE (webhook — built, waiting on Mission 1) — pulse + alerts.
3. Data commands: bolt /price+/pulse onto Tyler's bot (same process,
   fetch+cache the JSON, 5-min TTL). NOT a separate bot.

## Launch sequencing (ties to the arc)
Server soft-opens BEFORE arc Day 3 (the Trust Standard post links it).
Newsletter 001 (Aug 24) carries the invite. Machine-room must be live
by then — the webhook IS the demo. Bot can follow days later; server
first, perfection never.

## Culture rules (April, still right)
First 20 members set the tone for 2000. Reward substance. No gm-farming.
Leaderboard soft-pedaled until population justifies it.
