# THE OPERATING SYSTEM
*Everything we built that has nothing to do with Pokémon.*

Written 2026-08-23. Of 32 laws in `house-theses.md`, **19 are domain-agnostic** —
they describe how to run an automated, self-auditing system that publishes
things people rely on. The other 13 are about sealed card markets and stay
behind.

This document exists so that if the project pivots, or a second one starts, or
somebody else builds on this, the expensive part transfers. **The expensive part
was never the Pokémon knowledge. It was learning what breaks.**

---

## THE SHAPE

**A payload and an operating system.** The payload is domain knowledge: what you
measure, what it means, what the theses are. The OS is everything below, and it
does not care what the payload is. Keep them separable and a pivot costs weeks
instead of everything.

**Three lanes, by capability.** A chat lane that reasons and writes code. An
agent lane with a browser, a network, and deploy keys. A human lane holding
taste, judgment, money and accounts. **Route by what each can actually do, not
by what would be convenient.** A capability gap is a handoff, never a guess.

---

## THE LAWS THAT MATTER MOST

### 1. No guessing
Never present unverified as verified. When you cannot check something, say so
and route it. **The temptation is always to produce a plausible answer, because
plausible answers are fluent and nobody can see the difference from outside.**
This is the law everything else rests on; break it and no other guarantee means
anything.

### 2. A guard is not real until breaking it fails the build
Write the check, then **deliberately break the thing it watches** and confirm
the build goes red. Guards that have never fired are guards nobody has tested.
We found five that had never been broken, and one of them did not work.

### 3. Build it. Break it. Repeat.
Every incident becomes a guard; every guard gets a negative test; a dedicated
agent hunts for assumptions nobody has tested yet. Otherwise you are permanently
one incident behind, always fixing the last thing instead of the next.

### 4. Agents advise, guards block
Guards may stop a run. Agents may not — **including by calling `process.exit()`,
which no try/catch can catch.** We wrote this law and violated it within the
hour; the audit caught it. One exception: anything unrecoverable, like a leaked
credential, is allowed to block.

### 5. Zero is not one thing
An empty result can mean *nothing broke* (good), *it never ran* (unknown), or
*it stopped working* (bad). Every agent must declare which. **A supervisor that
flags success as a warning teaches people to stop reading**, and then nobody is
looking on the day it matters.

### 6. An agent that reaches nobody has not done work
It has made a file. Fourteen agents writing JSON nobody reads is fourteen files.
**One digest a human opens** beats fourteen dashboards. If a section of that
digest never leads to an action, delete the section rather than tolerate it.

### 7. Cadence matches the rate of change of what is watched
Not the clock. Agents watching daily data run daily; agents watching code run
**on change** — running them on an unchanged day reproduces yesterday's list,
which manufactures your own false alarms. Anything that costs money runs on
change only, never on a timer.

### 8. Nothing reaches a person unreviewed
Score every finding on **evidence, impact, actionability and track record**.
Band it by what to DO — act now, queue, watch, note only. The manager may
**demote but never promote**: allowing promotion lets a supervisor manufacture
urgency, which is the failure mode of every alerting system ever built. Anything
nobody can act on is capped at note-only however certain it is.

### 9. Domain competence, declared
Every specialist declares **sourced principles, known failure modes, blind
spots, and a recheck date.** Blind spots is the critical clause: *a specialist
who cannot name the edge of their competence is the one who does the damage.*
An agent fluent without being expert is more dangerous than one that admits it
does not know.

### 10. Crying wolf is a failure, not a quirk
A false alarm costs more than silence, because it teaches people to skim — and
then the real finding gets skimmed with it. **We hit this six times in one day:**
three checkers audited comments instead of code, one read an input path as an
output, one flagged a test fixture as production code, one reported solved
problems. Every one made the tool less trusted than having none.

### 11. Work that cannot be found again was not saved
It was only stored. A knowledge base stamped five days stale with 74 laws on a
single line is preserved and useless. **Check findability, not just existence.**

### 12. Two lanes, one file
Parallel workers collide silently. Ours shared a git identity, so collisions
were **invisible rather than rare**. Detect them, and always extend rather than
replace another lane's work unread — twice their version was better.

### 13. Absence is the failure nothing else catches
Every guard runs inside the pipeline, so **a run that never happens fires none
of them.** You need a heartbeat and a watchdog **on a different schedule**. An
alarm inside the fire is not an alarm.

### 14. Detection without recovery is knowing precisely how broken you are
Three recovery modes: regenerate from source, roll back to the last passing
commit, or **neither** — because a stopped scheduler is not fixed by restoring
data. Test the restore. A backup nobody has restored is not a backup.

### 15. Adjacency is a claim
Two things placed together are read as related. **Whoever placed them already
knows they are different, which makes the ambiguity invisible from inside.**

### 16. Publish your corrections and your misses
Dated, permanent, public. It is the only thing a competitor cannot copy quickly,
because it requires having been wrong in public first.

### 17. Every claim ships with what would disprove it
A thesis without a falsifier is an opinion. Test them on a schedule and report
INSUFFICIENT honestly — *"we tried to prove ourselves wrong and could not yet
tell"* is still more than most publish.

### 18. Say it in the words a stranger would use
No jargon you have not taught. No named construct the reader has never met.
Every instrument gets a plain-language version one tap away.

### 19. Volume is free and worthless
An agent producing more is not producing better. Judge on **whether output gets
acted on**, never on how much there is.

---

## THE ARCHITECTURE

**Layers, outermost first.** Wiring (are the guards connected) → intake
(is the data sane) → measurement → durability → language → artifact proof
(grep what was actually published, not what you meant to publish) → absence →
recovery.

**The agent contract — ten obligations, checked mechanically:** exists ·
scheduled · wired into the run · output surfaced to a human · fails safe ·
declares what zero means · has a negative test · marks its confidence ·
documented · routed to an owner. **Being registered is not being employed.**

**The registries.** Gates as data in one file, not `if` statements scattered
across the codebase — two authors adding the same gate in code stack silently,
while two authors adding the same key collide in git, which is the point.
Same for schemas, safeguards, flags, competence, and the error ledger.

**The error ledger.** Every incident recorded with its **class** and the guard
built for it. Fixing the instance without closing the class is how the same bug
returns wearing a different name.

---

## WHAT TO BUILD FIRST, IN ORDER

1. **The publication assert.** Grep what actually shipped for things that must
   never ship. Last step, always.
2. **Schema checks on every shared data file.** Ours had 21 readers and no
   validator.
3. **Plausibility checks, separately.** Shape checking cannot see values — a
   file with every key present and an index of 8,123,456 passes every structural
   test ever written.
4. **The negative-test harness.** One declarative table, one row per guard.
5. **Heartbeat and watchdog**, on separate schedules.
6. **One digest**, delivered somewhere a human already looks.
7. **Agents last.** They are the most fun and the least load-bearing. An agent
   on top of unguarded data is a confident narrator of wrong numbers.

---

## WHAT WE GOT WRONG, SO YOU DO NOT HAVE TO

- Shipped a guard and never broke it. Five were decorative.
- Wrote a law and violated it within the hour, twice.
- Built agents that wrote files nothing read — all of them, for a day.
- Registered four agents and never wired them into the run.
- Let a methodology change print as market movement. Twice.
- Published the word "chase" as an explanation while every guard passed it,
  because **nothing checked whether the words meant anything.**
- Ranked by ratio with no floor and headlined a $5 item with $1.50 of movement.
- Rotated by day-of-month, which repeats on the 1st of every 31-day month.

**Every one of these is now a guard.** That list is the actual product of the
work — the laws above are just what the list taught us.
