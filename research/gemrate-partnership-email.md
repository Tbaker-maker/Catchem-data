# GemRate partnership email — SEND-READY (Tyler sends; no automation)

Supersedes research/gemrate-email-draft.md (Aug 20 pop-block draft).
Contact route: gemrate.com/partner → "Send us a message" / "Book a demo".
Body below is 168 words, founder voice.

---

**Subject: Startup tier? Pokémon market-intelligence project, attribution offered**

Hi GemRate team,

I'm Tyler, founder of Catch'em (catchemtcg.com) — Pokémon sealed-market
intelligence with a public methodology page and a strict every-number-
carries-its-source standard. We're launching now: daily index, price
tape, and a newsletter, all machine-generated from measured data.

Your universal pop data is the best in the hobby, and I already use the
free search by hand for a monthly population snapshot of our chase list.

What we'd want: Pokémon population + gem rate + history, refreshed daily,
with display rights. Via your API that's one population call per tracked
card per day — a few dozen today, under ~150/day as the watchlist grows;
your bulk catalog endpoint could make it a single daily pull.

What we offer: visible "Population data: GemRate" attribution on every
graded surface we ship — site, cards, newsletter — and a distribution
channel that's growing.

Does a startup or small-partner tier exist, and what does it cost? Happy
to walk through the use case on a call.

Tyler Baker · Catch'em · catchemtcg.com

---

## API recon (docs.gemrate.com, read 2026-08-22)

Base `https://api.gemrate.com/v1`, key in `x-api-key` header, JSON
envelope `{data, meta}`; grades keyed per grader (`psa_10`, `cgc_10_perfect`).

Endpoints we'd use:
- `GET /v1/cards/{gemrate_id}/population` — pop + gem rate per grader.
  Our core call: 1/card/day. 20 tracked chases today → 20 calls/day;
  full 120-card watchlist → 120/day.
- `GET /v1/cards/{gemrate_id}/history` — population history. Would
  BACKFILL what our manual monthly snapshots can only build forward.
- `GET /v1/search/structured` — one-time id resolution for the watchlist
  (~120 calls once, then cached).
- `GET /v1/catalogs/{catalog}` — bulk CSV; could replace per-card calls
  with ONE daily download.
- `GET /v1/certs/{grader}/{cert}` — slab verification for raffles (also
  covered by PSA's free API; see psa-api-recon.md).

Negotiating number: **≤150 calls/day steady-state, or 1 bulk pull/day.**
Fence: no key exists yet — nothing is wired until Tyler signs up; ceiling
is "not another $100/mo."
