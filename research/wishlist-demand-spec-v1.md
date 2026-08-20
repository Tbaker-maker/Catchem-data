# WISHLIST DEMAND LAYER (Tyler, Aug 20) — the want-side of the market
THESIS: aggregate wishlist adds = demand intent, the leading edge no
competitor publishes. Supply Shifts watches shelves; this watches WANT.

## THE INSTRUMENTS (once gated-n passes)
1. MOST WANTED — top wishlist adds this week (board + Pulse line +
   share card). Social proof loop: "247 watching" on product pages.
2. WANT RADAR — add-VELOCITY anomalies: a quiet product suddenly
   collecting wishes = early attention, often before price moves.
   Pairs with Supply Shifts: want ▲ + shelf ▼ = the strongest read
   in the whole system.
3. RT-6 (thesis candidate, falsifier-ready): wishlist velocity leads
   price by N days. We'll TEST it against our own tape before ever
   publishing it as a read.

## THE HONESTY GATE (Tyler's own caveat, codified)
No wishlist stat publishes under MIN-N: 25 distinct wishers / 50
events per window. Below it, surfaces say "early tape — collecting."
We never fake crowd size; a Most Wanted board of 6 people is a
private joke, not an instrument.

## SOURCES LADDER (privacy-first at every rung)
v0 — DISCORD `/wish add|remove|list <product>` cog: users + DB already
exist; ships inside the Professor session (same family — the Professor
even takes "add X to my wishlist" in plain language). Aggregate-only
publishing; individual lists visible only to their owner.
v1 — APP BEACON: tiny CF Worker counting anonymous star events
(id + add/remove, no identity, KV counters) — the localStorage
watchlist starts feeding aggregate counts without accounts.
v2 — post-V1 auth sync: real cross-device wishlists, per-user alerts.

## LAWS
Aggregate-only public · min-n gate · zero dark patterns (no seeded or
faked counts, ever) · the crowd's data earns the crowd's instruments.
