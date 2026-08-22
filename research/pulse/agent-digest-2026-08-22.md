# What the machines noticed — 2026-08-22

The overnight shift's notes. Short on purpose.

## Our own claims
Not much of a verdict today. Most of our claims need more time before they can be judged, and pretending otherwise would be the actual failure.
4 survived their own kill conditions, 7 could not be judged yet with the tape we hold.

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

## The agents themselves
**NEEDS A HUMAN — the supervisor flagged the watchers:**
- creator: OVER-BUDGET — 15 findings against a ceiling of 10. An unreadable list is an unread list.

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

> Right now every agent watches US. A workforce that builds the best community, app, tools and database in this hobby needs agents that watch the MARKET (what changed that we did not notice), the COMMUNITY (what people are asking), and the FIELD (what everyone else shipped). Two of those three need the bot; one needs only research. That is the order to hire in.

## How it feels to use
7 measurable finding(s). The looking is not ours to do — 8 questions are queued for whoever has eyes.
- *simplicity* — The Today screen carries 17 sections: The Daily Three, 🗳 Rip or Hold?, Biggest movers, Set the app up for you, Movers, Release radar… Rank them by how often somebody would act on each, and move the bottom third behind a tap. Nothing is deleted — it stops competing.
- *retention* — 5 things visibly change day to day: the Daily Three, a fact, shelf moves, yesterday's picks revisited, Rip or Hold. Good coverage — the gap is that a returning reader cannot TELL at a glance what is new since yesterday.
- *ease of use* — A number appears above the fold on Today. Holds — check on a 390px screen that it is still above the fold with the banner and nav present.

## Who needs to do what
**NEEDS A HUMAN — Tyler (3):**
- **[QUEUE 58]** We hold both deal-zone room and per-pack economics for the same products. — *A "rip or trade" tool could answer one question nobody else can: at today's prices, is this box worth more opened, sold sealed online, or traded at a table? Three numbers we already compute, one screen.*
- **[QUEUE 58]** Print windows and shelf movement are computed separately and never combined. — *A late-print set whose shelves are draining is a genuinely different situation from either signal alone. Crossing them is free and nobody publishes it.*
- **[WATCH 40]** pricing 50 more cards would unlock 17 artist cohorts — *an expansion decision, not a machine's call*

**CC (3):**
- **[QUEUE 58]** 4 accent colours appear on the same surface. — *Reserve green for positive, red for negative, and let mode accent everything else. Gold stays a highlight, never a third voice.*
- **[QUEUE 58]** 32 emoji in the interface. — *Keep them for section headers and the ELI5 lollipop; drop them from anything carrying a number.*
- **[WATCH 48]** 27 card images minted today. — *The gap is that they are files in a repo. A creator needs them one tap from the angle they picked, not from a folder.*

**Chat (11):** top — The Today screen carries 17 sections: The Daily Three, 🗳 Rip or Hold?, Biggest movers, Set the app up for you, Movers, Release radar… *[QUEUE]*

*Every finding above passed four layers: the agent declared its evidence, the score was computed mechanically, the manager could demote but never promote, and only what survived is here. Today: 0 ACT NOW, 9 QUEUE, 8 WATCH, 7 filed without surfacing, 4 confirmations.*
## The creator cheat code
*Could somebody open this, hit record within two minutes, and sound like the most informed voice in the hobby without pausing to look anything up? Every pause is a cut.*
- **a visual that runs itself** — 27 card images minted today. *The gap is that they are files in a repo. A creator needs them one tap from the angle they picked, not from a folder.*
- **the cheat code** — The pieces exist and are reachable, but a creator still assembles them: pick an angle here, find the card there, open the overlay separately. *ONE screen per angle: the subject, the spoken open, the numbers as a lower-third, the card ready to download, the source line, and a record checklist. Pick an angle, hit record.*
- **the cheat code** — Nothing tells a creator how a piece performed after they made it. *Ask one question after publication — did this land — and keep the answers. Even a yes/no on twenty videos would tell us which angles are worth generating.*

## What the market did
Nothing unusual, or not enough history to tell — 5 days of tape so far. Anomaly detection needs a distribution, and saying so is the honest answer.

## Where today's story goes
- **X** — "Paldean Fates listings moved -66.7% while its print window closes."
- **YouTube** — Unified Minds Booster Box — "A seller keeps about $3,859.97 online; a buyer pays about $4,761.5. Roughly $901.53 of room where a face-to-face trade beats the internet."
- **TikTok** — Open on the number, not the setup: "The whole sealed market in one number: 100."

3 format gap(s): YouTube — No B-roll list ships with any angle.; TikTok — Every card we mint is 1200×675 — landscape.

## Something is slipping
- **unsaved** — 8 hand-written file(s) changed and not committed. *Generated artifacts churn constantly and that is fine. Hand-written work sitting uncommitted is a session's thinking one crash away from gone.*

---
*Written by the agents, for a person. If a section here never leads to an action, that section should be deleted rather than tolerated.*