# App Word Audit — v7 Digest Law session (2026-08-20)
Instrument: catchem-app/scripts/audit-words.mjs (prose words in string
literals + JSX text; ⓘ bodies counted separately as "tucked" — they're
one-tap-away depth, not on-glance words). Same script both runs.

## Before → After (on-glance words per screen)
| Screen | before | after | Δ | tucked behind ⓘ |
|---|---|---|---|---|
| Home | 125 | **50** | **−60%** | 108 |
| Movers | 49 | 13 | −73% | 23 |
| Board | 16 | 23 | +44% ⚠ | 0 |
| Deal Check | 122 | 61 | −50% | 66 |
| Product detail | 109 | 61 | −44% | 84 |
| Studio | 50* | 25 | −50% | 0 |
| Studio archive | * | 9 | — | 0 |
| Compare | 42 | 28 | −33% | 18 |
| shared (capture/banners/canvas) | 178 | 147 | −17% | 0 |
| shell (drawers/tabs) | 9 | 20 | info-sheet chrome | 0 |
| **TOTAL** | **700** | **437** | **−38%** | **299** |
*baseline Studio bucket included the archive (marker drift).

⚠ Board grew by design: rows gained a `· spread +X%` data token (relocated
truth from Home's cut Spread section). Data, not prose.

## The 5-second sentences (acceptance)
- **Home:** "The market's mood and my products, today."
- **Movers:** "What moved overnight, up and down."
- **Board:** "Every tracked product, searchable, priced."
- **Compare:** "Two products, numbers side by side."
- **Check:** "Type a product, get its fair range — at the show table."
- **Product:** "One product's price, range, and history."
- **Studio:** "Today's three stories, ready to copy or render."

## Relocated truths (nothing deleted)
Home's Spread section → spread stat on every card + Board rows + ⓘ(#the-spread)
· pack math → product pages' per-pack/vs-loose stats + #premiums · quiet
movers → Movers tab (real market Δ supersedes) · release radar → Movers tab
foot · every cut sentence → its ⓘ verbatim-or-better + methodology anchor.

## Methodology anchors (the pressure valve), 10 live
#index · #prices · #buy-pressure · #the-spread · #venue-law · #raw-graded ·
#history (new) · #fair-range (new) · #premiums (new) · #house-reads
(+ #heat/#depth ids ride the gated sections at their debuts).

## Acceptance numbers
Lighthouse mobile **95 perf / 100 a11y** (two earlier sub-95 runs were
machine load — FCP 2.7s→1.5s once the dev server stopped; noted honestly).
Bundle **59.21 kB gzip** (<100). No tokens changed, no features added.

## What resisted cutting
- Kit receipts lines (Studio): they ARE the receipts — receipts culture
  outranks brevity there.
- feed-generated "why"/reason one-liners on Daily Three: already single
  sentences written by the engine; cutting them guts the picks.
- The one-per-screen disclosure footer: legal/honesty floor, kept to one line
  with ⓘ to #buy-pressure.
- renderShareCard/Overlay copy: outward-facing branded assets, not app
  chrome — grammar already tight, left alone.

## §15 IA session addendum (2026-08-20, same instrument)
New screens: Tools hub 76 · PackMath 75 · PrintWatch 19 · NetCalc 25 ·
RipOrHold 21 · WatchTab 14 — Tools-family avg **43.2/screen**, under the
post-digest 43.7 bar. Prior screens: Home 50→41 (Watch moved to its tab),
DealCheck 60, Movers 13, Board 23, Detail 61, Studio 25 — no regression
except Compare 28→30, which IS its mandated question header ('⇄ Which of
these two?'). Conditional-copy caveat: verdict variants count in source but
render one at a time (PackMath's 4 verdicts ≈ 25 counted, ~8 shown).
Total on-glance 437→677 across 15 screens (5 brand-new surfaces).
