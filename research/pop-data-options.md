# Pop Report Data — Options & Ruling (Aug 18)

**CORRECTION 2026-08-20:** psacard.com/pop now redirects to a Collectors
sign-in wall — the "no account" claim below is stale. GemRate universal
search is the working free front door (per-grader table carries the PSA
row); first real snapshot seeded from it 2026-08-20 via scripts/ingest-pop.mjs.
Full send-ready partner email now at research/gemrate-email-draft.md.

**Free front doors (Tier 1, live now):** PSA psacard.com/pop (weekly
updates, no account) · CGC census (free) · **GemRate universal search**
(PSA+BGS+SGC+CGC unified, daily, free browse — also grading-VOLUME trends).
TAG = the gap: no aggregator carries it; manual-only, thin.
**Ritual:** monthly, ~10 min — Tyler/CC-interactive looks up the chase
list, enters pop10/pop9/total into data/pop-snapshots.json. Snapshot 2
wakes scripts/pop-velocity.mjs → data/pop-velocity.json → Slab Math's
supply-risk line + Grader's Corner content.
**Programmatic doors:** PSA public API = cert-verification ONLY (no pop —
verified Aug 2026, corrects our prior assumption). Scraper-proxy "APIs"
(Apify-class) = refused, standing no-scrape rule.
**Tier 2 consolidation:** PriceCharting now combines PSA+CGC pop → their
one paid sub = vintage sold comps + graded prices + pop. Post-revenue
trigger just got stronger; logged.
**Tier 3 ask (draft below):** GemRate Partner API — small-project email,
PPT-style.

## GemRate email draft (Tyler sends whenever)
> Subject: Partner API — small collector data project
> Hi — I run Catch'em (catchemtcg.com), a Pokémon TCG data/newsletter
> project, pre-revenue. Your universal pop data is the best in the hobby.
> Is there a partner-API tier (or trial) that fits a small project tracking
> ~50 chase cards' populations monthly, with attribution to GemRate
> anywhere the data appears? Happy to credit prominently. — Tyler
