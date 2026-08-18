# The Catch'em Trust Standard

Catch'em exists to be the source collectors rely on. In a hobby where the
authentication layer itself is losing trust to silent changes and hype
merchants, our edge is simple: **we never mislead, and we're loud about
what we don't know.** Every pipeline — newsletter, site, social, agent
digests — obeys this document. When another rule conflicts, this wins.

## 1. The confidence ladder (label everything)

Every factual claim we publish carries one of three levels:

- **Verified** — confirmed by our own bot data, or by two independent
  sources, or by primary source (pokemon.com, official press). Publishable
  as fact.
- **Reported** — single source, named inline ("per Beckett", "per
  PokeBeach"). Publishable with attribution, never as bare fact.
- **Read** — our interpretation or speculation. Always framed as ours,
  always grounded in stated data, always falsifiable ("if sealed absorbs
  the tin supply through September, the squeeze thesis holds; if listings
  climb, it doesn't"). Never framed as prediction of certainty.

If a claim fits none of these, it doesn't ship.

## 2. Sourcing rules

- Prices: only from Catchem-data bot (with as-of date), PokemonPriceTracker,
  or Tyler-verified. Never from memory, never from a single eBay listing.
- Dates, pull rates, card counts, populations: verify against primary or
  two independents before citing. Dates move — recheck near publication.
- Every number carries provenance: what measured it and when
  ("Catchem-data, eBay active listings, Aug 18").
- Inferred metrics say so: volume is "inferred, not measured" — always.

## 3. Speculation is welcome, disguise is not

Market reads ARE the product — Wyckoff phases are interpretation by
design. The rules that keep them honest:

- Reads use hedged language: "possible", "the data suggests", "watch for".
  Never "guaranteed", never "buy now", never price targets.
- State the evidence the read rests on, in the same breath.
- State what would prove it wrong.
- We publish reads, not calls. Catch'em never tells anyone to transact.

## 4. Corrections: loud, dated, never silent

We will get things wrong. The policy:

- Corrections are visible: an explicit correction note in the next issue
  and/or on the page, stating what we said, what's true, and when we fixed it.
- We never silently edit published numbers or claims. (We cover an industry
  bleeding trust from exactly that. We don't do it.)
- Contaminated data gets flagged, not rewritten: history keeps a
  `dataQualityNote`, dashboards show the flag.

## 5. Machines watch, humans gate

- Automated pipelines (bot, research agent, draft generator) produce
  leads and drafts — never published fact without a verification step.
- Nothing sends, posts, or publishes without a human approval pass.
- A pipeline that can't meet the ladder outputs uncertainty
  (`query_error`, "single-source", "unable to verify") instead of a guess.
  **An honest gap beats a confident wrong answer, every time.**

## 6. The test

Before anything ships, one question: *if a collector spent money based on
this and it was wrong, could we defend how we published it?* If the answer
needs excuses, it doesn't ship.

— Locked Aug 18, 2026. Referenced by: RESEARCH_PROMPT.md, newsletter
pipeline, draft generator (when built), CLAUDE.md protocols.
