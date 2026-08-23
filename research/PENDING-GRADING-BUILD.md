# Card scanning — the build, prompt by prompt

Five sessions. Each one ships something usable and each one can be abandoned
after without leaving debris. **Reviewed by compliance, verify-work and the
api-strategist before writing; their objections are folded in below rather than
listed at the end.**

## THE ORDER IS NOT WHAT IT LOOKS LIKE

The obvious order is: build the scanner, then add prices. **That is wrong, and
the audit caught it.**

The differentiator is the submission decision, and that decision needs a
**graded price we can defend** — which we do not currently have. `demand.json`
withholds every graded figure because the source carries **no time window**, and
a 559-sale median spanning $1,500 to $8,000 is a historical average, not a price.

**So a scanner shipped first would be a centering tool identical to four that
already exist, with the thing that makes it ours sitting behind a blocked data
source.** Session 1 unblocks that or proves it cannot be unblocked. If it cannot,
sessions 3 and 4 change shape and we find that out before building them, not
after.

---

## SESSION 1 — can we get a defensible graded price?
**Everything else depends on this. Do not skip to the fun part.**

- Check every endpoint and tier for sold aggregates carrying a **date range** —
  `from`, `to`, `days`, `period`, anything. **Paste a real response.**
- If a windowed source exists: restore graded prices, re-run `compute-demand`,
  and RT-5 becomes testable again.
- **If none exists, say so plainly.** Then the decision tool uses raw prices
  only and says out loud that it cannot see graded values — which is still more
  than any centering tool offers, and honest.
- Either way, update `data/knowledge.json` and the `graded` flag.

**Done when:** a graded price is either restored with its window stated, or
formally recorded as unavailable with what we would need.

---

## SESSION 2 — centering measurement, and nothing else
Geometry only. No grade, no verdict, no machine learning.

- `scripts/centering.mjs`: given an image, detect the outer card edge by contour
  analysis, detect the inner artwork frame by edge detection, compute the four
  margins, output **left/right and top/bottom ratios to one decimal**.
- **Both axes independently.** A card perfect L/R and 60/40 T/B does not make a
  10 and that catches people constantly.
- Output the **detected edge coordinates alongside the ratio**, so a reader can
  check us. Every measurement must trace back to a detected edge, not a model.
- Test against at least 10 cards where you can measure by hand and compare.
  **Report the error margin. If it exceeds ±2 percentage points the tool is not
  ready**, because 58/42 against 60/40 is exactly the case that matters.

**Done when:** ten hand-checked cards agree within 2 points, and the output
carries the edges it measured from.

---

## SESSION 3 — the standard, cited and never asserted
- Store PSA's tolerances in `data/grading-standards.json` with the primary
  source and the date checked: 10 ≈ 55/45 front, 75/25 back; 9 ≈ 60/40, 90/10;
  8 ≈ 65/35, 90/10.
- **Sources disagree on whether the front-10 threshold is 55/45 or 60/40**, and
  at least one says PSA tightened it in early 2025. Record the disagreement in
  the file. **Show the ratio and cite the standard — never only a verdict.**
- Near a boundary, **say so**: within one point of a threshold, report the
  next-lower grade as a real possibility. Do not sell a coin flip as a reading.

**Done when:** every output carries its ratio, the threshold it was compared
against, and the source of that threshold.

---

## SESSION 4 — the submission decision *(the differentiator)*
This is the Deal Zone applied to grading, and the only part nobody else has.

- Combine the centering ratio with raw price and, if session 1 unblocked it,
  graded price.
- Output a **decision**, never a prediction:
  > Raw $1,491 · PSA 10 $5,100 · PSA 9 $1,427 · fee $25, 45 days
  > Centering 58/42 — inside 9, outside 10.
  > **A 9 loses money here. Only the 10 pays.**
- **Never state or imply a grade.** Three of PSA's four criteria are
  unmeasurable from a photo, and the lowest criterion anchors the result. We are
  saying what the numbers make worth risking, not what PSA will say.
- If graded prices are unavailable, the tool says so and stops at centering
  rather than substituting a guess.

**Done when:** it can be run on a real card and never once names a grade.

---

## SESSION 5 — put it in the binder
- Wire into the editor: a card in the tray gets a **check centering** action.
- Feeds the page tally: *"three of these are worth submitting"*.
- Card-show mode: it works on a phone, at a table, in bad light — **which is
  where it will actually be used and where the measurement is least reliable.**
  If confidence drops in poor lighting, the tool must say so rather than
  producing a number that looks the same as a good one.

---

## WHAT THE AGENTS FLAGGED

**verify-work:** every published figure must answer *where did this come from
and when was it true*. A centering ratio must carry its detected edges and the
standard it was compared against, or it is a windowless price in a new costume.

**compliance:** this is measurement, not advice — but the moment it reads as
*"submit this card"* it starts sounding like financial guidance on an asset.
Keep the framing at what the numbers show, never what somebody should do.

**api-strategist:** the graded-price blocker is the whole critical path and it
sits with the provider, not with us. Establish it in session 1 or build three
sessions on an assumption.

**And the one nobody can answer from here:** whether the edge detection actually
works on a foil card under a phone flash. That is a question for eyes and it
goes in `open-questions.json` the moment session 2 has a first result.
