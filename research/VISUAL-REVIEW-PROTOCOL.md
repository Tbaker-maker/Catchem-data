# The visual review loop — three lanes, one artifact

Tyler, 2026-08-23: *"It'll need to work with CC and you, who can see more than
you guys. Feed it code and vice versa so everyone sees everything in their own
way."*

**Nobody here sees more than half.** That is the whole reason this needs a
protocol rather than good intentions.

| lane | sees | cannot see |
|---|---|---|
| **designer agent** | countable properties — type scale, colour count, contrast ratios, token discipline, orphaned pages | anything rendered |
| **CC** | the rendered page, real browser behaviour, clipping, overlap | what produced any of it |
| **chat** | the code, what generated what, whether a fix generalises | a single pixel |
| **Tyler** | taste, and whether it lands | — |

## HOW IT MOVES

**1 · The designer asks.** Every run it writes two lists to
`research/pulse/design-audit.json`:
- `findings` — what it settled on its own, with a fix
- `forEyes` — what it measured but cannot judge, each phrased as a question
  **with the number attached**. "Check the spacing" is not a question. *"These
  five sizes sit within 2px of each other — distinct steps, or the same intent
  typed twice?"* is one somebody answers in five seconds.

**2 · CC answers.** Open the page, screenshot it, and write `answeredBy` and
`answer` straight back into the `forEyes` entries. A question with an answer is
**never asked again** — the next run reads the prior file and skips it.

**3 · Chat fixes at the generator.** Never on generated output. Patching a file
a script rewrites every morning is a fix that lasts until 04:00 UTC.

**4 · Tyler overrules any of it.** Taste is not a measurement and the three
lanes together still cannot supply it.

## WHY THE QUESTIONS CARRY THEIR NUMBERS
An agent that says "the typography feels inconsistent" has handed over its
uncertainty and none of its evidence. An agent that says "seven corner radii:
6, 9, 10, 11, 13, 14, 16" has done the work and left exactly one judgment to a
human — which is the only part it was never able to do.

## THE FIRST THING IT CAUGHT WAS MINE
Within a minute of the handoff existing it flagged **seven corner radii on
build.html** — the page I had just redesigned while auditing everyone else for
exactly that. That is the loop working on the person who built the loop, which
is the only version worth having.
