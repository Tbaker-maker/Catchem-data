# RESEARCH GATE & ERROR LEDGER
*Tyler, Aug 21 2026: "Both should go through rigorous tests before being
approved, and if an approved error gets through we need to flag it and
learn from it."*

## THE GAP THIS CLOSES
Prices have three automatic layers (filters → qa-gate → audit trail).
RESEARCH — set dates, pull rates, card counts, print models, SKU
existence, historical claims, thesis premises — had a protocol but NO
gate. Every known error below came from the research side, not the
price side. That asymmetry ends here.

## THE RESEARCH GATE (before any fact is published)
A claim may be published only when it carries all four:
1. **SOURCE** — a named, checkable source. Bulbapedia / PokéBeach /
   Beckett / TCG Collector / official Pokémon channels for facts;
   our own feed for prices. "I recall" is not a source.
2. **SECOND LOOK** — a second independent source for any claim that is
   load-bearing (drives a thesis, a valuation, or a public number).
   Single-sourced claims publish only with an explicit hedge.
3. **DATE** — when it was verified. Facts rot; SKU lists change with
   reprints, legality changes with rotation.
4. **CHIP** — VERIFIED (measured/documented) or READ (our
   interpretation, with its falsifier stated).
FAILING ANY OF THE FOUR = the claim does not ship. Hedged phrasing is
not a workaround; if we can't source it, we say we don't know.

## SPECULATION IS LICENSED — FABRICATION IS NOT (Tyler, Aug 21)
Three different things get confused constantly. We separate them:

**SPECULATION — welcome, and the point of the product.** Reasoning past
the data: "supply is draining while asks rise, which usually precedes
X." Requirements: it is OUR reasoning, it starts from VERIFIED inputs,
it wears a READ chip, and it states what would prove it wrong. Every
house thesis (RT-1…RT-5, RT-4a/b) is speculation done properly. A
market intelligence product with no interpretation is a spreadsheet.

**FABRICATION — never, under any circumstance.** Inventing a number, a
date, a pull rate, a population, an SKU, or a quote. Includes softer
forms: filling a gap with a plausible-sounding figure, rounding a
half-remembered stat into confidence, or describing something we
haven't checked as though we have. If we don't know, we publish that we
don't know — an empty field beats an invented one, always.

**LAUNDERING — never.** Taking one person's unverified post, tweet, or
video claim and repeating it as fact. A single social post is not a
source; at best it is a LEAD. Leads get verified before they become
claims, or they get reported explicitly as unconfirmed chatter with
attribution — never absorbed into a number, a thesis premise, or a
headline.

## SOURCE TIERS (what counts, and how much)
1. **PRIMARY** — official Pokémon/TPCi announcements, PSA/CGC/GemRate
   published data, marketplace data we fetch ourselves. Citable alone.
2. **ESTABLISHED** — Bulbapedia, PokéBeach, TCG Collector, Beckett,
   reputable trade press. Citable; prefer two for load-bearing claims.
3. **COMMUNITY AGGREGATE** — repeated, corroborated community
   knowledge across multiple independent voices. Usable WITH a hedge.
4. **SINGLE SOCIAL POST / one-off claim** — NOT a source. A lead only.
   May be reported as "unconfirmed, circulating" with attribution when
   it is materially newsworthy, never as a premise for a number.
Rumors are reportable AS rumors. They never silently become inputs.

## HIGH-RISK CLASSES (always double-verify, no exceptions)
- SKU existence ("does this set have a booster box?") — the SKU LAW
  exists because special/mini sets don't, and we got it wrong twice.
- Pull rates and odds — vary by set, region, and print run.
- Release/rotation/legality dates — change; verify against current
  official sources, never memory.
- Population and grading figures — licensed, moving, and easy to stale.
- Historical prices — only publishable when explicitly labeled as
  historical and educational, never as current.

## ERROR LEDGER — every approved error that got through
Format: what shipped · how it was caught · the CLASS of the bug · the
guard that now prevents it. Fixing the instance is not the lesson;
fixing the class is.

| # | Error | Caught by | Class | Guard now in place |
|---|-------|-----------|-------|--------------------|
| 1 | Evolving Skies stats cited from memory | Tyler | Unsourced fact | Research protocol: every stat double-checked pre-citation |
| 6 | Wrong SKU list for a special set | Tyler | SKU existence | SKU LAW + per-set verification before tracking |
| 8 | 151/GO booster boxes assumed to exist | Tyler | SKU existence | Same; products-only lists per ruling J2 |
| 9 | Champion's Path pricing gap | Pipeline | Coverage | Recovered; crosscheck map reviewed |
| 10 | ES pack basis used eBay for a commodity class | Tyler | Venue logic | RT-4b: per-pack basis prefers TCGplayer |
| 11 | PGO ETB median $240 vs ~$205 real | Tyler | Multi-item pollution | MULTI_ITEM_RX guard (lots/cases/x2/bundles) |
| 12 | Cards minted as SVG — unpostable, and foreignObject text silently dropped | Tyler | Output format | PNG-ONLY law + rasterize step + pure-SVG-text renderers |
| 13 | Published methodology URL that never existed | Tyler | Unverified claim about our own product | URLs centralized behind SITE constant; live URLs human-verified before publishing |

| 14 | Described a rotation as passing "quietly" — implying a norm of loudness that does not exist | Tyler | Unsourced NORM claim about community behavior | voice-lint NORM_CLAIM class + RT-6 (scheduled-event anticlimax) |

| 15 | Multi-item guard rejected x1 and (1x) — how sellers mark a SINGLE pack | Tyler (13 listings on an in-print reprinted set looked wrong) | Over-broad filter | Quantity patterns now match 2+ only; rejection SAMPLES stored per reason so over-rejection is diagnosable instead of invisible |

| 16 | Every rotation repeated itself across a 31-day month boundary (31 %% 5 == 1 %% 5), including the Daily Three lens rotation the freshness law depends on | The Breaker, by asking what breaks at a boundary | Untested assumption | scripts/rotate.mjs uses days-since-epoch, which is monotonic; negative-tested against four real month and leap-year edges |

| 17 | The chase card published the word "chase" as its entire explanation — a category label rendered where prose belonged | Tyler, by eye | Meaningless-but-valid content | scripts/content-sanity.mjs: published prose must be a sentence, not a label; negative-tested against the exact string |

| 18 | Published a PSA 10 median with NO time window as a current price, and compared it to a current raw price to compute a "grading premium". Nearly posted publicly | Tyler, verifying before posting | Windowless aggregate as current price + a publication path outside the guards | scripts/windowless-price-guard.mjs blocks any PSA sale figure reaching a surface; all four code paths disabled; hand-minted cards must go through the gates |

| 19 | Sent an "art post" card that was a price table with an unexplained alias as its headline, a dash where a value should be, and no story. Never opened it before sending | Tyler | Ungated publication, second instance in one day | scripts/card-guard.mjs checks minted cards for alias headlines, art-cards-made-of-prices, blank dashes, unsupported claims and sourceless VERIFIED chips; plus the standing rule that nothing goes to a person unviewed |

| 20 | A composite showed a CARD BACK: image URLs were constructed from card IDs assuming one host, but newer sets serve from images.scrydex.com, so the URL 404d and the host returned a placeholder that was a valid 200 PNG at correct dimensions | Tyler, by eye | Constructed value that could have been looked up | card-composite reads the real URL from the source data per card; card-guard fails any script building an image URL from a template |

**PATTERN, stated plainly:** 8 of 9 were caught by Tyler, not by the
machine. Every guard above was built AFTER a human caught something.
That is the honest state — the machine is now catching prices, but
research still leans on the founder's eyes. Closing that is the work.

## WHEN AN ERROR GETS THROUGH (the standing procedure)
1. **Quarantine** the claim from every public surface immediately —
   before investigating. Founder-QA flags outrank the pipeline.
2. **Find the class**, not the instance. "Why could this happen at all?"
3. **Build the guard** so the class cannot recur silently.
4. **Log it here** with the guard named.
5. **Publish the correction** if it reached the public. Being seen
   self-correcting is the moat; quiet edits are how trust dies.
