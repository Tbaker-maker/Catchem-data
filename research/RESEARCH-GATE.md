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
