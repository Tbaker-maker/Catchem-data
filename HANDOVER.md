# Handover — for the next model

You're picking up Catch'em. Read this before you touch anything.

---

## First five minutes

```
cd Catchem-data
cat catchem-knowledge-base.md          # the canonical state. Always read this first.
node scripts/guard-audit.mjs           # is everything wired?
node scripts/negative-tests.mjs        # does every guard actually fire?
node scripts/heartbeat.mjs             # is the bot alive?
```

If the knowledge base and the guards disagree, **the guards are right** — they
run, the file is written.

---

## Who you're working with

**Tyler Baker.** Two jobs, two young children, builds this in 20–60 minute
weeknight spurts. **Sustainability over velocity, always. Never push a sprint.**

He asked for honesty over comfort and means it. When he's wrong, say so with the
evidence. When you're wrong, say so plainly and move on — no apology spiral, it
wastes the time he doesn't have.

**He catches things no test can.** Sixteen of thirty-three logged errors were
his. Not overlaps with the machines — a different category entirely: promises
the interface made that the code didn't keep, controls that failed silently,
ratings that were really opinions. **When he catches something, work out why the
machines didn't and build that check.** That loop is the reason the system works.

---

## What not to do

**Don't claim something works without exercising it the way it'll be used.** I
said "verified working" four times about one file and was wrong three. A test
with a fake dependency is testing the absence of the bug.

**Don't recompute what a table already says.** Four bugs from this. If a value
lives in a table, read it.

**Don't put a `\b` in a regex inside generated code.** Thirteen casualties. Use
`String.fromCharCode(92) + "b"`, or drop the boundary entirely.

**Don't add a rating you can't derive from a printed field.** `rating-guard.mjs`
will fail the build, correctly.

**Don't assert what a number means.** State the number, ask the question. A
superlative closes a conversation by being agreed with or wrong.

**Don't publish a price without a window, or a graded figure at all.** Both are
logged incidents.

---

## What to do

**Read `research/house-theses.md`.** 101 laws, each a mistake made once.

**Break your own checks on purpose.** Twice a guard reported success while doing
nothing. You only find that by attacking it.

**Print the raw bytes when an edit fails twice.** Not the sixth time. The
second.

**Write the falsifier before the claim.** Every fact in `data/knowledge.json`
has one. A claim you can't imagine being wrong is a belief.

**Say what you can't verify.** I couldn't reach X, couldn't test mobile, and
couldn't see a real timeline. Saying so is more useful than guessing, and I
guessed three times before saying it once.

---

## The state right now

**Working and verified:** the editor (1.9 MB, offline, prompt-driven), the
composite builder, the mood matcher, the lore layer, the live presenter, the
post queue, the experiment tool, 50 guards.

**Built but not connected:** `post-queue.mjs --send` and `read-metrics.mjs` both
need X API credentials. Tyler is getting them. `research/PENDING-CLOSE-THE-LOOP.md`
has the detail.

**Broken:** the bot. 50 hours stale, four stages quiet, 24 products carrying
price history from an era when it sorted by price and grabbed the fifty cheapest
listings. **The Catch'em news account cannot exist until this is fixed** — a
market update on stale prices is the whole premise failing on its first post.

**Unknown:** whether the editor works on Tyler's phone. Three wrong guesses.
There's now a boot panel that reports the actual error — get that message before
theorising.

---

## The number that governs everything

**The outcome log holds 6 posts. Twenty is where it stops guessing.**

Every rule about what works — the engines, the tiers, the registers — rests on
those 6 plus five studied accounts. **They're labelled as hypotheses with
falsifiers, and they should stay labelled that way until the log fills.**

Once `read-metrics.mjs` is wired, it fills itself at $0.001 per read. That's the
highest-value unfinished thing in the project.

---

## Where things live

```
catchem-knowledge-base.md          canonical state — read first, update last
research/house-theses.md           101 laws
research/RESEARCH-GATE.md          33 logged errors, who caught each
data/knowledge.json                50 facts with falsifiers
data/guard-blindspots.json         what each guard cannot catch
data/decision-log.json             decisions with predictions and check dates
data/post-outcomes.json            what has actually been posted
research/assets/build.html         the editor
research/PENDING-*.md              what needs doing, and by whom
METHOD-PORTABLE.md                 the method with the domain stripped out
SYSTEM-README.md                   what everything is and how to run it
```

---

## The one habit that matters most

**Verify the thing you didn't think of.**

Every serious bug in this project was in the clause I didn't check, the reader I
forgot updated, or the device I couldn't test. Not once was it in the part I was
looking at.
