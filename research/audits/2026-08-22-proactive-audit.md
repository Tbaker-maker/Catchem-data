
## SECOND PASS — resilience testing (same day)
4. **CRITICAL: stale data published silently.** Simulated a total eBay
   fetch failure (every product 7 days old) and ran the full chain: the
   QA gate passed, derived computed, the index published, the Daily Three
   picked a headline. Nothing checked `lastSeen`. A dead API would have
   produced a complete Morning Pulse, share cards, social posts and a
   newsletter — every number a week old, all wearing today's date, with
   no signal anything was wrong. Worse than a wrong number, because it is
   EVERY number and it looks completely normal.
   FIXED, two layers: (a) the QA gate holds any individual product whose
   price was measured 2+ days ago; (b) publish-assert now carries a
   stale-edition breaker — if the freshest row in the catalogue is 2+
   days old, or fewer than 80% of products carry the newest timestamp
   (a partial fetch), the run blocks and nothing ships. Both proven by
   negative test: a simulated 4-day outage and a simulated half-fetch
   each blocked correctly, and normal data passes.
   Registered in the guard manifest so it cannot be silently disconnected.

## DEPENDENCY RESILIENCE MAP (checked)
eBay API — try/catch · FX (frankfurter) — try/catch + null fallback ·
card images — try/catch + graceful degrade + loud warning · TCGplayer CDN
— try/catch + fallback. No unguarded external call found.
