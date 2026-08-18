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

## Bot roster (UPDATED Aug 18 — handoff doc reviewed, Drive: "Handoff: Catch'em Discord Bot")
1. THE ENGAGEMENT BOT — REAL AND COMPLETE: Python 3.10+/discord.py 2.4+,
   SQLite (aiosqlite), 38 cogs, ~500-800 test assertions. Economy (berries=
   users.free_tickets legacy col), tiers, streaks, raffles, shop, PSA
   tracking, trivia, gacha packs (60/25/12/3, pity@20, 10 berries, 30s cd),
   Catch'em original collectibles w/ mint numbers, /setup wizard, health
   endpoint :8080, backups. DEPLOY PATH: dev-portal app + token (3 intents,
   perms 2416004176) → private GitHub repo → Railway + volume /data +
   DB_PATH=/data/bot_data.db → UptimeRobot. ~2hrs, own session.
   HONOR LIST (April commitments, still binding): feature freeze pre-alpha
   (no new cogs); berries NEVER real-money purchasable (loot-box law);
   physical prizes via raffle-sweepstakes only; zero Pokemon IP in bot
   content; legacy column names intentional. Parked decisions for bot
   session: 84-card rarity split · 250-mint Perfect Pull vs unlimited ·
   dup dampening · 5th rarity tier (defer to v1.1).
   ⚠ Bot zip = PRIVATE repo only, never Catchem-data.
2. THE MACHINE (webhook — built, waiting on Mission 1) — pulse + alerts.
3. Data commands (/price /pulse /signals reading our public JSON):
   v1.1 AFTER alpha ships — the freeze holds; deploy before decorate.

## Launch sequencing (ties to the arc)
Server soft-opens BEFORE arc Day 3 (the Trust Standard post links it).
Newsletter 001 (Aug 24) carries the invite. Machine-room must be live
by then — the webhook IS the demo. Bot can follow days later; server
first, perfection never.

## Culture rules (April, still right)
First 20 members set the tone for 2000. Reward substance. No gm-farming.
Leaderboard soft-pedaled until population justifies it.
