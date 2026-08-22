# What the machines noticed — 2026-08-22

The overnight shift's notes. Short on purpose.

## Our own claims
Not much of a verdict today. Most of our claims need more time before they can be judged, and pretending otherwise would be the actual failure.
4 survived their own kill conditions, 6 could not be judged yet with the tape we hold.

## Our own numbers
We put something in front of readers and can no longer price it. That is the kind of thing worth noticing before somebody asks.

2 product(s) we featured and can no longer price:
- Umbreon VMAX (featured 2026-08-20)
- Umbreon VMAX (featured 2026-08-21)

## Untested and improvable
2 untested assumption(s) — the highest:
- **data/agent-history.json** — Corrupt it — empty object, missing top-level key, wrong types — and see which of its 2 readers notices. Then decide which of them SHOULD have.
- **data/card-catalogue.json** — Corrupt it — empty object, missing top-level key, wrong types — and see which of its 4 readers notices. Then decide which of them SHOULD have.

11 thing(s) that work and could work better — the top three:
- *tool idea (hypothesis)* — We hold both deal-zone room and per-pack economics for the same products. A "rip or trade" tool could answer one question nobody else can: at today's prices, is this box worth more opened, sold sealed online, or traded at a table? Three numbers we already compute, one screen.
- *tool idea (hypothesis)* — Print windows and shelf movement are computed separately and never combined. A late-print set whose shelves are draining is a genuinely different situation from either signal alone. Crossing them is free and nobody publishes it.
- *product* — The index has no matched sample today, so it cannot move. Expected on a fresh series — worth a line on the page saying so, rather than a number that looks stuck.

## If we expanded
Pricing 50 more cards would unlock 17 artist cohorts and make 2018 catalogue cards analysable. That is Tyler's call, not the machine's.

## The reading passes
Did not run — no key present. 23 published lines and 9 claims are queued in review-agents.json. An unrun review is not a passed review.

## The workforce
Gaps in what we watch:
- **an agent for community** — Nothing reads the Discord. Members ask questions our instruments cannot answer and we never see the pattern. The strongest roadmap input we have is unread. (needs the bot)
- **an agent for engagement** — Nothing measures which of our own content lands. We generate six angles a day and learn nothing from which ones people use. (needs analytics or creator feedback)
- **an agent for competitor** — Nothing tracks what other tools ship. We would learn a competitor solved something we are still guessing at only by accident. (web research, no new dependency)
- **an agent for pricing-drift** — Nothing spot-checks our published prices against the live marketplace by eye. Every guard we have compares us to ourselves. (needs a browser — CC's lane)

- *REVIEW* — falsifier has found nothing in 7 runs: Either the thing it watches is genuinely healthy — in which case say so once and run it weekly — or it has stopped working. Silence should be a decision, not a habit.
- *REVIEW* — review-agents has found nothing in 7 runs: Either the thing it watches is genuinely healthy — in which case say so once and run it weekly — or it has stopped working. Silence should be a decision, not a habit.

> Right now every agent watches US. A workforce that builds the best community, app, tools and database in this hobby needs agents that watch the MARKET (what changed that we did not notice), the COMMUNITY (what people are asking), and the FIELD (what everyone else shipped). Two of those three need the bot; one needs only research. That is the order to hire in.

---
*Written by the agents, for a person. If a section here never leads to an action, that section should be deleted rather than tolerated.*