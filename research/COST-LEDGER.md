# Catch'em Cost Ledger — every dollar, every lever
*Rule: nothing new that costs money ships pre-revenue without Tyler's
explicit sign-off AND an entry here. Updated Aug 18, 2026.*

## Current monthly burn
| Item | Cost | Notes |
|---|---|---|
| eBay Browse API | $0 | Free tier 5,000 calls/day; we use ~210 (70 SKUs × 3 pages) |
| pokemontcg.io (singles) | $0 | Keyless free tier; retry/backoff handles flakiness |
| GitHub Actions + hosting | $0 | Public repo = unlimited CI minutes; Pages/Cloudflare free |
| Anthropic API (research agent, 1 call/day) | ~$3–9 | THE only real marginal cost; funded from Console credit |
| Domain (catchemtcg.com) | ~$1 amortized | Annual Porkbun renewal |
| **Total** | **≈$5–10/mo** | |

## Costs that arrive with usage (watch list)
- **Buttondown**: free to 100 subscribers, paid (~$9/mo) beyond — check
  waitlist size BEFORE the 001 send; if over, decision point.
- **Draft generator + Content Hub on schedules**: each API call ~$0.05–0.15;
  daily content + 2×/wk drafts ≈ +$3–6/mo. Not yet scheduled = not yet paid.
- **Sealed crosscheck provider**: $0 by rule (see eval cost gate).

## Efficiency levers (one-line changes, in order of pull)
1. Research agent weekdays-only (cron edit): −~30% of AI spend.
2. Content packs on-demand (CC/local run) instead of scheduled: −$3–6/mo.
3. Draft generator only on newsletter weeks: negligible spend.
4. Reduce SEARCH_PAGES 3→2 on stable SKUs: headroom, not savings ($0 either way).

## Decisions log
- Aug 18: provider eval hard-gated to free tiers only (pre-revenue rule).
- Aug 18: pokemontcg.io API key = unnecessary (keyless works); $0 stands.
