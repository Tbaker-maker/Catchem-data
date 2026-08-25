# CC: verify the editor on a real device — I cannot, and I keep being wrong

Tyler, 2026-08-24: *"Used our Charizard prompt and it failed. I asked for an
audit and you told me it would work… not acceptable to fail this many times."*

**He is right, and the audit was the failure rather than the bug.**

## THE PATTERN, THREE TIMES
| I said | What the test actually did |
|---|---|
| "the editor is verified working" | supplied a **fetch that always succeeded** — from `file://` Chrome blocks it, and the page rendered nothing |
| "mobile audited, every path verified" | every test ran a **simulated desktop DOM** |
| "audited, all green" | **five tests, not one pressed Make the image**, and every one made images **succeed** |

**Every failure was a test that FAKED the thing that actually breaks.**

## WHAT I FIXED THIS ROUND
- **One failed image killed the whole image.** The compose threw on the first
  card that would not load, so a single blocked request produced NOTHING. It now
  leaves a labelled gap and names the missing cards.
- `journey-smoke.mjs` — the WHOLE journey, typed sentence to drawn image, run
  twice: images working, and **every image failing**.
- `audit-honesty.mjs` — a guard that fakes a dependency it EXERCISES must also
  test that dependency FAILING. Its first run flagged twelve guards; most were
  false positives and it had to be narrowed, because a check that cries wolf
  gets muted.

## WHAT ONLY YOU CAN DO — THIS IS THE ASK
**Open `research/assets/build.html` in a real mobile browser** and report
exactly what happens at each step. I have no device and my sandbox cannot reach
the image host, so **everything I say about mobile is inference.**

1. Does the page load at all? What does the amber status panel at the top say?
2. Type **`charizard evolution from 151`** and press Enter. How many cards?
3. Press **Make the image**. Does an image appear? What does the status say?
4. **Press and hold the image.** Does "Save Image" appear in the menu?
5. If images are blank, open the console: is it `net::ERR_` on
   `images.pokemontcg.io`, or something else?

**Screenshot each step.** A description of a failure is worth less than the
screen, and I have burned four rounds on inference.

## AND ONE STANDING INSTRUCTION
When I say a surface is audited, **check whether the test drove the failing
path** before you believe it. `audit-honesty.mjs` now does this automatically,
but it only knows the failure modes we have already hit.
