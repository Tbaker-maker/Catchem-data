# Card scanning: what is buildable, what is not, and what is actually ours

Tyler, 2026-08-23: *"I'd really like to have a scanning card where it would give
an idea of the grade. How hard is that to build?"*

Researched properly. The answer splits cleanly and the split matters more than
the difficulty.

## BUILDABLE — centering, and it is arithmetic

**Difficulty: a weekend for CC.** No machine learning, no training data, no
black box. The published pipeline is:
1. detect the outer card edge by contour analysis against the background
2. detect the inner artwork frame by edge detection
3. compute the four margins, express opposite pairs as ratios

**PSA's published tolerances** (primary source, psacard.com):
| grade | front | back |
|---|---|---|
| **10 Gem Mint** | ~55/45 | ~75/25 |
| **9 Mint** | ~60/40 | ~90/10 |
| **8 NM-MT** | ~65/35 | ~90/10 |

**Both axes must pass independently.** A card perfect left-to-right and 60/40
top-to-bottom does **not** make a 10, and that catches people constantly.

**Why it is worth doing at all:** centering is the single most common reason an
otherwise flawless card drops from a 10 to a 9. It is both the most measurable
criterion and the most frequently decisive one.

**One caution to build in:** sources disagree on whether the front-10 threshold
is 55/45 or 60/40, and at least one says PSA tightened it in early 2025. The
primary source says 55/45. **Any tool we ship must show the RATIO and cite the
standard, never only a verdict** — because the threshold itself has moved.

## NOT BUILDABLE — corners, edges, surface, and therefore "the grade"

Surface scratches and holo scuffs are visible only at particular light angles.
Corner wear needs resolution and lighting a phone rarely provides unaided. PSA
grades on four criteria and **the lowest one anchors the result**, so three of
four being unmeasurable means the grade is unmeasurable.

**And this is the part that matters more than the difficulty.** If we say "this
looks like a 9" and it comes back a 7, we have cost somebody a submission fee,
a turnaround wait, and their trust — for a number we could not defend. That is
the windowless-price failure with a bigger price tag.

**Centering is auditable: every measurement traces back to a detected edge. A
predicted grade is a black box that costs somebody money when it is wrong.**

## WHAT IS ACTUALLY OURS

Centering tools already exist — Midpoint, CardGrading.app, ZeroPop,
cardgrader.ai. Building another one is not differentiation.

**None of them know what the card is worth.** We hold prices on **15,727 cards**.

So the question we can answer that nobody else can is not *"what grade is this"*
but ***"is it worth sending at all"***:

> Umbreon ex raw: $1,491. PSA 10: $5,100. PSA 9: $1,427.
> Your centering: 58/42 front — inside PSA 9, outside PSA 10.
> Grading costs $25 and takes 45 days.
> **A 9 loses you money. Only the 10 pays, and your centering says you are not getting one.**

That is the Deal Zone applied to grading, it uses data we already have, and it
is a decision rather than a prediction. **It is also honest in a way a grade
estimate cannot be** — we are not telling anybody what PSA will say, we are
telling them what the numbers make worth risking.

## SUGGESTED ORDER
1. **Centering measurement.** Ratio, both axes, cite the standard, show the
   detected edges so the reader can check us.
2. **The submission decision**, using our prices. This is the differentiator.
3. **Corners and surface: not until somebody can show they work.** And if the
   answer stays no, say so publicly — a tool that refuses to guess is worth more
   than one that guesses.
