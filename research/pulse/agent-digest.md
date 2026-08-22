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
4 untested assumption(s) — the highest:
- **Deploy smoke test (blank-page class, rendered DOM)** — Break it deliberately and confirm the build fails. The registry names a test but audit.mjs never runs it, so nothing checks that this guard still works.
- **Mode Honesty Law (§20 — figure multiset identical across modes)** — Break it deliberately and confirm the build fails. The registry names a test but audit.mjs never runs it, so nothing checks that this guard still works.
- **data/agent-history.json** — Corrupt it — empty object, missing top-level key, wrong types — and see which of its 2 readers notices. Then decide which of them SHOULD have.

12 thing(s) that work and could work better — the top three:
- *unused output* — review-agents.json is written every run and read by nothing — not another script, not the feed. Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.
- *unused output* — artist-instruments.json is written every run and read by nothing — not another script, not the feed. Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.
- *unused output* — era-history.json is written every run and read by nothing — not another script, not the feed. Either surface it (the app, the Pulse, a creator tool) or stop generating it. Work that runs daily and reaches nobody is the most expensive kind.

## If we expanded
Pricing 50 more cards would unlock 17 artist cohorts and make 2018 catalogue cards analysable. That is Tyler's call, not the machine's.

---
*Written by the agents, for a person. If a section here never leads to an action, that section should be deleted rather than tolerated.*