# Pack System Spec v2.0 — repo digest (canonical: Tyler's Drive doc, Apr 21)

PATH C: bot=gacha (10 berries, 1 prize, 60/25/12/3, pity@20, 30s cd) ·
site "Feels"=FREE daily 4-slot (Signal/Utility/Bonus/Special; special rolls
50C/25U/15R/8E-or-newsletter/2L). SHARED: berries (earned-only, NEVER sold),
Catch'em cards (one catalog, sequential mint #s, dupes allowed→trading v1.1),
single cross-surface streak (D7/30/100/365 milestones grant site badge AND
Discord role). CARD RARITY = 5 tiers (Uncommon card-only; hexes: C#8a93a8
U#64a0ff R#36d399 E#c77dff L#ffb84d). Scarcity trio: mint limit · event
window · release date (combinable). Launch catalog = the 15 (001-015);
pace ~3/wk; 85 remain to design (the authenticity-rewrite target).
Legal: physical via raffle+free-entry only; no purchase flow ever.
Migration-ready: user_cards.source exists; bot schema = unified-shape.

## AUG 18 SYNTHESIS (what April couldn't know)
- SIGNAL SLOT = MACHINE SOCKET: daily Signal pool pre-filled from
  pulse-feed.json / post-ideas generator; admin approves, not authors.
  Wire at Feels build (needs auth+db first).
- 30TH EVENT CARD: mint-limited, window Sept 16-week — the spec's own
  example lands on our real calendar. Design at bot-alpha session.
- Feels (app-specs §3) implements THIS slot structure + our value-chips
  (model=READ chip, market=VERIFIED, frozen-at-rip). Complementary, no drift.
Open per spec §7: OAuth badge-transfer details · role-granting (v1.1) ·
trading UI (v1.1+) · past-newsletter scarcity (undecided).
