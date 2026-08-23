# What the machines noticed — 2026-08-23

Nothing here needs you this morning unless something is marked NEEDS A HUMAN.

## Our own claims
Mostly "we cannot tell yet" today — half these tests need weeks of history we simply do not have. Saying so beats guessing.
4 survived their own kill conditions, 7 could not be judged yet with the tape we hold.

## Our own numbers
A product we featured has gone quiet on us. Either it stopped trading or we broke its query, and we should know which.

3 product(s) we featured and can no longer price:
- Umbreon VMAX (featured 2026-08-20)
- Umbreon VMAX (featured 2026-08-21)
- Charizard ex (featured 2026-08-22)

## Untested and improvable
2 untested assumption(s) — the highest:
- **data/agent-history.json** — Corrupt it — empty object, missing top-level key, wrong types — and see which of its 2 readers notices. Then decide which of them SHOULD have.
- **data/card-catalogue.json** — Corrupt it — empty object, missing top-level key, wrong types — and see which of its 4 readers notices. Then decide which of them SHOULD have.

8 thing(s) that work and could work better — the top three:
- *tool idea (hypothesis)* — The knowledge base is only used for one fact a day. The same sourced facts could power a "why is this card like this" explainer on every product page — set context, print quirks, what makes it odd. It compounds with every fact added.
- *unused output* — artist-instruments.json is written every run and read by nothing — not another script, not the feed. Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.
- *unused output* — card-guard.json is written every run and read by nothing — not another script, not the feed. Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.

## The agents themselves
**NEEDS A HUMAN — the supervisor flagged the watchers:**
- designer: BROKEN RECORD — 7 finding(s) repeated three runs running (e.g. "medium::32 distinct colours"). Either they are not actionable or they are being ignored; the agent should say WHY instead of repeating itself.
- theme-scout: BROKEN RECORD — 22 finding(s) repeated three runs running (e.g. "the one-off::Ken Sugimori drew Ampharos exactly on"). Either they are not actionable or they are being ignored; the agent should say WHY instead of repeating itself.
- teacher: BROKEN RECORD — 14 finding(s) repeated three runs running (e.g. "in a rut::breaker"). Either they are not actionable or they are being ignored; the agent should say WHY instead of repeating itself.
- teacher: OVER-BUDGET — 15 findings against a ceiling of 14. An unreadable list is an unread list.

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
6 measurable finding(s). The looking is not ours to do — 8 questions are queued for whoever has eyes.
- *simplicity* — The Today screen carries 17 sections: The Daily Three, 🗳 Rip or Hold?, Biggest movers, Set the app up for you, Movers, Release radar… Rank them by how often somebody would act on each, and move the bottom third behind a tap. Nothing is deleted — it stops competing.
- *retention* — 5 things visibly change day to day: the Daily Three, a fact, shelf moves, yesterday's picks revisited, Rip or Hold. Good coverage — the gap is that a returning reader cannot TELL at a glance what is new since yesterday.
- *ease of use* — A number appears above the fold on Today. Holds — check on a 390px screen that it is still above the fold with the banner and nav present.

## Who needs to do what
**NEEDS A HUMAN — Tyler (2):**
- **[QUEUE 58]** The knowledge base is only used for one fact a day. — *The same sourced facts could power a "why is this card like this" explainer on every product page — set context, print quirks, what makes it odd. It compounds with every fact added.*
- **[WATCH 40]** pricing 50 more cards would unlock 17 artist cohorts — *an expansion decision, not a machine's call*

**CC (3):**
- **[QUEUE 58]** 5 accent colours appear on the same surface. — *Reserve green for positive, red for negative, and let mode accent everything else. Gold stays a highlight, never a third voice.*
- **[QUEUE 58]** 31 emoji in the interface. — *Keep them for section headers and the ELI5 lollipop; drop them from anything carrying a number.*
- **[WATCH 48]** 35 card images minted today. — *The gap is that they are files in a repo. A creator needs them one tap from the angle they picked, not from a folder.*

**Chat (12):** top — The Today screen carries 17 sections: The Daily Three, 🗳 Rip or Hold?, Biggest movers, Set the app up for you, Movers, Release radar… *[QUEUE]*

*Every finding above passed four layers: the agent declared its evidence, the score was computed mechanically, the manager could demote but never promote, and only what survived is here. Today: 0 ACT NOW, 9 QUEUE, 8 WATCH, 23 filed without surfacing, 4 confirmations.*
## The creator cheat code
*Could somebody open this, hit record within two minutes, and sound like the most informed voice in the hobby without pausing to look anything up? Every pause is a cut.*
- **a visual that runs itself** — 35 card images minted today. *The gap is that they are files in a repo. A creator needs them one tap from the angle they picked, not from a folder.*
- **the cheat code** — The pieces exist and are reachable, but a creator still assembles them: pick an angle here, find the card there, open the overlay separately. *ONE screen per angle: the subject, the spoken open, the numbers as a lower-third, the card ready to download, the source line, and a record checklist. Pick an angle, hit record.*
- **the cheat code** — Nothing tells a creator how a piece performed after they made it. *Ask one question after publication — did this land — and keep the answers. Even a yes/no on twenty videos would tell us which angles are worth generating.*

## What the market did
Nothing unusual, or not enough history to tell — 5 days of tape so far. Anomaly detection needs a distribution, and saying so is the honest answer.

## Where today's story goes
- **X** — "Paldean Fates listings moved -66.7% while its print window closes."
- **YouTube** — Rebel Clash Elite Trainer Box — "Sealed carries a 376.9% premium over the cost of its packs bought loose — the widest gap of that kind we track today."
- **TikTok** — Open on the number, not the setup: "The whole sealed market in one number: 99.4."

3 format gap(s): YouTube — No B-roll list ships with any angle.; TikTok — Every card we mint is 1200×675 — landscape.

## Something is slipping
- **unsaved** — 2 hand-written file(s) changed and not committed. *Generated artifacts churn constantly and that is fine. Hand-written work sitting uncommitted is a session's thinking one crash away from gone.*
- **ignored** — 5 supervisor problem(s) are open. *Problems that stay open stop being read. If they are not going to be fixed, they should be closed with a reason instead of carried.*
- **drift** — 14 script(s) are not referenced anywhere: backfill-artists.mjs, build-faq.mjs, build-lines.mjs, build-lore.mjs. *A script nothing calls is either dead or was wired up and quietly unwired. Both are worth knowing, and neither announces itself.*
- **drift** — 48 JSON files in research/pulse. *A directory nobody can scan is a directory where something goes missing without being noticed.*

## Legal standing
Nothing has tripped. Highest live risk: **Effort-based consideration in the berry system, combined with the first live draw.** — It is the only item that is both imminent and genuinely uncertain. The IP question is larger but not triggered until revenue; registration and tax thresholds are comfortably clear at current prize values.
*Cheapest fix: A no-berry AMOE — one free entry, one form, no participation required, same pool, same odds, same deadline, disclosed wherever entry is offered. It costs a form and it moots the hardest question in the structure.*

*Legal INFORMATION, not legal advice. No lawyer has reviewed this. Sweepstakes law varies by state and changes; nothing here is a compliance opinion anyone can rely on. Its job is to make the conversation with counsel shorter and better, and to stop us doing something obviously wrong in the meantime.*

## Numbers that do not make sense for what they are
54 value(s) are structurally fine and absurd in context.
- **"packs"** killed 339 listings across the board — a single pack is often titled 'Booster Packs' — plural in the title, one in the box
- **"sleeved"** killed 318 listings across the board — a sleeved booster IS a single pack, just with a foil sleeve
- Battle Styles Booster Pack: 75% rejection rate (37/150) — *largest bucket: exclude = 76. A single over-broad term can eat a market.*
- Fusion Strike Booster Pack: 72% rejection rate (42/150) — *largest bucket: exclude = 49. A single over-broad term can eat a market.*

## What the agents should be asking themselves
- **steward** — Would you catch this today? If yes, what specifically would fire. If no, what would you need?
- **steward** — Would you catch this today? If yes, what specifically would fire. If no, what would you need?
- **breaker** — You test what we built. What have we DELETED recently, and did anything depend on it?
- **correction-hunter** — You re-check figures that moved. Ask about the ones that never move — a price frozen for a month is a claim too.

## Who is catching our mistakes
- **Tyler catches 18 of 25 incidents; the machines catch 7** — *Every guard here was written by the party being checked. If the human keeps finding what the tooling misses, the tooling is calibrated to what I already believed rather than to what actually goes wrong. That is what self-bias looks like from the outside — not a wrong rule, an absent one.*

## Post ideas nobody looked for
- **Ken Sugimori drew Ampharos exactly once** — Ken Sugimori has 729 cards. Exactly one is a Ampharos.
- **Ken Sugimori drew Azumarill exactly once** — Ken Sugimori has 729 cards. Exactly one is a Azumarill.
- **Mitsuhiro Arita drew Houndoom exactly once** — Mitsuhiro Arita has 525 cards. Exactly one is a Houndoom.

## Design
1 high, 9 medium across 14 shipped surfaces, 35 minted cards.
- **build.html** — the accent colour appears 17 times. *Spend it in two places: the active state and the one primary action. Everything else greys.*

## What the agents cannot answer themselves
24 open — 17 need eyes on a rendered page, 7 need a decision.
- **NEEDS A HUMAN** [theme-scout] 14 Pokémon share the "-eon" ending — a theme, or a coincidence of naming?
- **NEEDS A HUMAN** [theme-scout] 7 Pokémon share the "ite" ending — a theme, or a coincidence of naming?
- **NEEDS A HUMAN** [theme-scout] 10 Pokémon share the "-ish" ending — a theme, or a coincidence of naming?
- [designer] build.html: 2 font sizes sit within 12% of a neighbour (13, 14). Are those distinct steps or the same intent typed twice?
- [designer] corrections.html: 5 font sizes sit within 12% of a neighbour (13, 14, 14.5, 15, 15.5). Are those distinct steps or the same intent typed twice?
- [designer] coverage.html: 1 font sizes sit within 12% of a neighbour (15). Are those distinct steps or the same intent typed twice?

## The review — 6/10
Real progress, and the gap between what is built and what is live is now the whole problem.
- **Engagement 2/10** — 3 posts measured.
- **Community — our surfaces 3/10** — 1 of 3 live.

---
*Written by the agents, for a person. If a section here never leads to an action, that section should be deleted rather than tolerated.*