# Three surfaces still carrying a fixed bug

`surface-parity.mjs` found what I should have caught myself: the mobile lessons
were applied to **whichever file Tyler happened to be holding**, three separate
times, and never carried across.

## FIXED
- **the composite page** — was serving `_hires` for display with
  `loading="eager"` and no fallback, the exact combination that broke the editor.
  Now small-for-display, hires-for-canvas, lazy, with a fallback.

## STILL OUTSTANDING — deliberately not done tonight
| surface | missing |
|---|---|
| `creators.html` | hires for display · no fallback · no long-press image |
| `the-board.html` | no lazy loading · no fallback |
| `the-pulse.html` | no lazy loading · no fallback |

**None of these is deployed and none is what Tyler uses**, so fixing all three at
this hour is scope creep. Recording them is the honest move — the guard now
FAILS on them, so they cannot be quietly forgotten, and the next person to touch
those generators will be told.

## THE RULE THIS ENCODES
**A lesson learned once must apply to every surface**, or it is a lesson applied
to whichever file somebody happened to be holding. Four rules, each from a real
failure on a real device:

1. small file for display, hires only for the canvas
2. `loading="lazy"` on every card image
3. an `onerror` fallback, because a broken icon explains nothing
4. a real `<img>` after compose, because **a canvas cannot be long-pressed**
