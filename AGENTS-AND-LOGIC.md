# The agents and the logic

Everything that checks, watches, or decides in the Catch'em system — what each
one does, why it exists, and what it cannot see.

**57 guards. 8 agents. 11 specialists.** Every one of them exists because
something went wrong once.

---

## The idea underneath all of it

An AI building alone verifies **the thing it thought of**, and the bug is always
**the thing it didn't**. So the system is built around two questions:

1. **What class of mistake does this catch?**
2. **What can it not see?** — written down, next to the guard, in
   `data/guard-blindspots.json`.

Without the second question you accumulate checks and a false sense that the
list is complete. With it, the gaps are visible and someone can look at them.

---

# PART 1 — THE FLEET

Eight agents, one command: `node scripts/fleet.mjs`

They split into **blocking** (must pass before publishing) and **advisory**
(reports you read). Mixing those two is how a warning gets ignored for a week.

### 1. verify-work — the auditor

Checks finished work against **25 known error classes** — not hypothetical
failures, ones actually made. Each finding cites the error number and what it
cost last time.

*Catches:* ungated publication, multi-item pollution, unviewed images, stale
artifacts.
*Cannot catch:* an error class not yet made. It is a memory, not an imagination.

### 2. designer — the taste check

Rates every generated surface on hierarchy, density, contrast, and whether the
thing a user needs is findable.

*Catches:* walls of text, competing calls to action, unreadable contrast.
*Cannot catch:* whether the design is any good. It measures structure, not
appeal.

### 3. pre-mortem — the interrogator

For each guard, asks: *what would have to be true for this to pass while
something is broken?* **A guard that hasn't been interrogated is flagged.**

*Catches:* guards that pass while doing nothing.
*Cannot catch:* a failure mode nobody has imagined yet.

### 4. bias-guard — the self-check

Looks for the shapes an AI's own output takes when it's drifting: superlatives
without evidence, claims with no source, hedges hiding a guess, and **agreement
where pushback was warranted**.

*Catches:* slop, sycophancy, unsupported confidence.
*Cannot catch:* a well-sourced claim that's simply wrong.

### 5. decision-audit — the scorekeeper

Every significant decision is logged with a **prediction and a date**. This
agent surfaces the ones that have come due and asks whether the prediction held.

*Catches:* decisions that quietly turned out wrong.
*Cannot catch:* anything before its check date. It's slow by design.

### 6. competence-guard — the specialist register

11 declared specialists (pricing, layout, copy, data, etc.), each with stated
knowledge **and stated blind spots**. Flags when work is done in an area with no
declared owner.

*Catches:* work happening where nobody claims competence.
*Cannot catch:* a specialist being wrong inside their own area.

### 7. theme-scout — the prospector

Trawls the data for groupings that exist but aren't used. Found 297 across 5
kinds.

*Catches:* unused structure in the data.
*Cannot catch:* whether a find is interesting. Volume is not quality.

### 8. ask-eyes — the question queue

Anything a machine genuinely cannot decide goes here for a human. **It reports
how long each has waited** — currently 29 open, 24 over a week.

*Catches:* decisions being silently deferred.
*Cannot catch:* a question nobody thought to ask.

---

# PART 2 — THE SAFEGUARD LOGIC

Grouped by what they protect.

## Truth — is the claim true?

| guard | protects against |
|---|---|
| `knowledge-guard` | a fact without a source, a date, or a falsifier |
| `editor-claim-match` | words in a post that don't match the card beside them |
| `windowless-price-guard` | a price published without the window it was true in |
| `editor-money-credit` | a price or an artist credit rendered wrong |
| `slop-guard` | a grouping that isn't in the data |
| `rating-guard` | a rating that can't name the field it derives from |

**The law:** *verified the noun, skipped the verb.* We shipped "repriced every
single day" while the cron was failing. The number was checked. The frequency
wasn't. **Check every clause.**

## Build — does it actually work?

| guard | protects against |
|---|---|
| `offline-smoke` | a page that does nothing without a network |
| `theme-smoke` | a theme that produces nothing, or two that produce the same |
| `ask-smoke` | a prompt that leaves the tray empty |
| `editor-hostile` | a user pasting 500 characters, an emoji, or a regex bomb |
| `crop-guard` | a layout sitting on X's crop line |
| `layout-check` | a composite whose measurements don't match what it drew |
| `editor-copy-rules` | generated strings breaking the rules other surfaces obey |

**The law:** *a fake dependency proves nothing.* A test that stubs out the thing
most likely to fail is testing the absence of the bug. Four times I said one
file was verified working; three times it was dead.

## Meta — do the guards work?

| guard | protects against |
|---|---|
| `guard-audit` | a guard that exists but is never imported |
| `negative-tests` | a guard that passes while doing nothing |
| `pre-mortem` | a guard whose blind spot has never been stated |
| `memory-guard` | a law written down but unreachable from the entry point |
| `doc-numbers` | a handover document that disagrees with the data |
| `heartbeat` | a pipeline stage that has gone quiet |

**The law:** *a guard that pushes nothing reports success.* Twice a guard
reported clean while doing nothing — once because its message string was empty,
once because it crashed and printed a blank line. **You only find that by
attacking the guard itself.**

---

# PART 3 — THE PRODUCT SAFEGUARDS

These protect the user rather than the code.

### The streak — five ways a counter lies

**A wrong day number is a public credibility hit for the creator, not for us.**

1. **Advances on open** → the count rises without a post
2. **Double counts** → two visits in one day jump two days
3. **Misses a break** → skips a day and keeps counting
4. **Timezone** → 11pm Monday and 1am Wednesday, ambiguous
5. **Repeats a card** → Day 60 shows Day 12's and the premise collapses

**The rule that solves most of it:** it advances **only** when the user confirms
they posted. A day is a **local calendar day**. And **broken is a state, not a
reset** — it reports the gap, changes nothing, and lets them decide.

### Spend — one user can't become a bill

**8 posts/day and $3/month per account.** The average is fine; **the outlier is
what kills it.** One account posting 30 link-posts a day costs $180 on its own —
36 subscriptions at $5. It takes no malice, just a heavy campaign.

### Publishing — refuse rather than mislead

`build-update.mjs` **refuses** on data older than 26 hours, and **refuses and
names the products** when a move exceeds 60%. A +7500% weekly move is a data
error, not a market event — and it would have been the account's first post.

**A quietly filtered anomaly hides a broken history.** Report it.

### Posting — the machine sends, it does not write

Every post that worked was written by Tyler. **Zero used any of the 84 generated
formulas.** An agent that writes automates the only part that works. The queue
refuses to generate text, refuses to post to anyone else's account, and refuses
to send anything unread.

---

# PART 4 — THE ERROR PATTERNS

Five shapes, over and over, in different clothes.

**Substring where structure exists** — 5×. Matching `"tin"` caught Dratini.
Matching a first word made `"Galarian"` a Pokémon with 72 cards. **Use the
field, not the text.**

**A table computed then ignored** — 4×. The layout table said 2×2; the renderer
recomputed and drew a row. **A recomputation that agrees most of the time is
worse than one that never does** — it only diverges where nobody tested.

**Escaping through a template** — 13×. Code that generates code. `\b` became a
backspace and thirteen regexes silently matched nothing. **Character codes are
the only form that never broke.** And when an edit fails twice, **print the raw
bytes** — first move, not sixth.

**A checkable clause beside an unverified one** — the number is right, the
adverb is false.

**A silent prerequisite** — a control that returns nothing because another
wasn't used first. **Broken and mute**, the worst combination available.

---

# PART 5 — WHO CATCHES WHAT

**33 logged errors. 16 caught by Tyler. 7 by machines.**

| machines catch | Tyler catches |
|---|---|
| escaping bugs | promises the interface made that the code didn't keep |
| crashes and parse errors | a control that failed silently |
| wrong arithmetic | a rating that was really an opinion |
| unreachable buttons | a layout that looked wrong |
| claims that don't match the data | a UI that overwhelmed |

**A test cannot find a broken promise, because a test doesn't know what was
promised.**

**So the loop that matters:** when Tyler catches something, work out **why the
machines didn't**, and build that check. `ask-smoke.mjs` exists because he tried
one prompt and it produced nothing. `crop-guard.mjs` exists because he saw a
clipped top. `doc-numbers.mjs` exists because four documents shipped with every
count wrong.

---

# PART 6 — HOW TO ADD A GUARD

1. **Name the error class.** Not "check X works" — *what specific mistake would
   this have caught?*
2. **Write it so it fails loudly.** Exit code, named findings, no blank output.
3. **Break something on purpose and confirm it objects.** If it doesn't fire, it
   isn't a guard.
4. **Declare its blind spot** in `data/guard-blindspots.json`. What can it not
   see? Who covers that?
5. **Wire it into the pipeline.** `guard-audit.mjs` will refuse to pass until
   you do — an unwired guard produces confidence without protection.
6. **Run `negative-tests.mjs`.** It proves every guard in the set can still
   fire.

---

## Running everything

```
node scripts/fleet.mjs           8 agents, one command
node scripts/guard-audit.mjs     is everything wired?
node scripts/negative-tests.mjs  does every guard fire?
node scripts/pre-mortem.mjs      does every guard declare its blind spot?
node scripts/heartbeat.mjs       has any stage gone quiet?
```

**If the docs and the guards disagree, the guards are right.** They run; the
files are written.
