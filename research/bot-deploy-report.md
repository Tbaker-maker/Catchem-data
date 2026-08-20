# Bot Deploy Report — 2026-08-19/20 (freeze-lifted package)
Repo: github.com/Tbaker-maker/catchem-bot (PRIVATE, verified pre-push).
Bot LIVE: Catchem Bot#5968 in Catch'Em Collectables (1496033858175631441 —
always pin this id; a typo twin existed and was left). Runs from Tyler's PC
until the Railway deploy (greenlit "very soon", ~$5/mo verified; RUNBOOK-ALPHA.md).

## Schema diff (all idempotent migrations in database.py)
- users **+ frozen_berries** (soulbound 🧊; free_tickets untouched = Fresh 🍓)
- **+ berry_ledger** (every mint/spend/refund, kind-checked, indexed)
- **+ eden_daily** (per-user per-UTC-day spark/roll accounting)
- **+ prizes_ledger** (committed→drawn→shipped/cashed/redrawn, value snapshot)
- **+ raffle_templates**, **+ featured_votes**, **+ reaction_roles**
- raffles **+ 14 columns**: stage (draft/published — outside the legacy status
  CHECK), total_cap, trigger_type, threshold_entries, anti_snipe_seconds,
  snipe_armed_at, photos, prize_ref, verified_value, verified_at,
  value_snapshot, draw_seed, draw_entrants, winner_index
- guild_config **+ 11 eden_*** + 6 raffle_* + governance_softcap_enabled

## free_tickets mapping (THE call)
Column is SACRED and **is** the Fresh wallet — 1:1, never renamed/dropped.
Opening Frozen = **lifetime earned** from rewards_log (truer than wallet,
which is net of spends), floored at the live wallet where unlogged admin
grants existed. rewards_log confirmed 1-ticket earn grain → no 1:N multiplier.
Refunds return Fresh but never mint Frozen. adjust_tickets kept as the
manual-correction escape hatch (doesn't mint reputation).

## Eden config (all in guild_config, zero in code)
eden_enabled=1 · min_chars=25 · bonus_chance=0.02 · roll_cooldown=300s ·
daily_roll_cap=20 · min_account_age=7d · dupe_similarity=0.9 · min_entropy=2.5
· rain_recent_minutes=30 · excluded = all 19 text channels except #general.
⚠ OPEN: legacy roulette (rewards.py `enabled`) still runs beside Eden —
Tyler picks Eden-only vs both before real members.

## Provision tree (live, verified idempotent — pass 2 no-op)
📣 START HERE: #welcome-rules(rules pinned) · #major-announcements(News) ·
  #announcements(News) · #ping-roles(🎟🌅📦 reaction roles live)
🌅 THE MACHINE: #morning-pulse(RO) · #rip-or-hold · #draws(RO)
🎟 THE ECONOMY: #raffles(slow 30s) · #freezer-flex · #price-check
💬 COMMUNITY: #general(Eden's only drop zone) · #pulls-and-pickups ·
  #market-talk · #creator-corner
🔊 VOICE: 🎙 The Floor · 📦 Rip Night
🛠 META: #support · #suggestions · #audit-log(priv) · #mod-chat(priv) ·
  [hidden: #rules, #moderator-only — Discord-designated, API refuses delete
  (50074, guild.edit repoint silently reverts); tucked + hidden]
Roles: Admin · Raffle Admin · Member · Raffle Ping · Pulse Ping · Rip Night.
Routing: announce→#raffles · results→#draws · audit→#audit-log.

## Tests + evidence
81 assertions green (POP 18 · Eden guards 26 · raffle machine 37) + live-fire
sim transcript (catchem-bot/tests/demo-transcript.txt): Eden 🍓 on real
message, guards eat spam/dupes, 3-entry draw recomputed to announced winner.
Pending live-in-Discord demo whenever Tyler plays.
