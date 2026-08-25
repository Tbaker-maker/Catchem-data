# The method, without the Pokémon

Everything in the Catch'em system that isn't about trading cards.

This is the transferable part: how to build something that doesn't lie, how to
check work when the person checking is the person who did it, and what actually
makes content get replies. None of it depends on the domain.

Written for another model, or another person, picking this up cold.

---

## 1. The problem this solves

An AI building a product alone will confidently ship things that don't work. Not
because it's careless — because **it verifies the thing it thought of, and the
bug is always the thing it didn't.**

Across one long session, thirty-three logged errors. **Sixteen were caught by
the human. Seven by the machines.** The rest by neither until something broke.

The split matters more than the count:

| the machines caught | the human caught |
|---|---|
| escaping bugs | promises the interface made and the code didn't keep |
| crashes and parse errors | a control that failed silently |
| wrong arithmetic | a rating that was really an opinion |
| unreachable buttons | a layout that looked wrong |
| claims that didn't match the data | a UI that overwhelmed |

**A test can't find a broken promise, because a test doesn't know what was
promised.** That's the division. Build the machines to catch the first column,
and structure the work so a human sees the second.

---

## 2. Guards

A guard is a script that fails the build. 50 of them here. The pattern
that makes them worth having:

**Every guard declares what it cannot catch.** In a file, next to the guard.
Without this you accumulate a list of checks and a false sense that the list is
complete. With it, the gaps are written down and someone can look at them.

```
"theme-smoke.mjs": {
  cannotCatch: "Whether a theme's output is INTERESTING. It proves every theme
    produces something and that no two return identical sets. A theme producing
    six dull pairings passes cleanly.",
  coveredBy: "the outcome log, and the human clicking through"
}
```

**Every guard must be proved to fire.** Break it on purpose and confirm it
objects. Twice in one session a guard reported success while doing nothing —
once because a message string was empty, once because it crashed and printed a
blank line. **A guard that finds the fault and reports success is the worst
shape a check can take**, and you only find it by attacking the guard itself.

**Every guard must be wired.** An audit that checks the checks are connected.
One existed and wasn't imported anywhere for days.

---

## 3. The error patterns, and they repeat

Same shapes, over and over, in different clothes. Learn these and you'll
recognise them faster than I did.

**Substring where structure exists.** Matching `"tin"` caught Dratini. Matching
the first word of a name caught `"The Rocket's Trap"` for a claim about
something else. Matching `"Dark"` treated a form prefix as a creature.
**Four occurrences.** The fix is always the same: use the field, not the text.

**A table computed and then ignored.** A layout table said 2×2; the renderer
recomputed and drew a row. **Four occurrences.** A recomputation that agrees
*most* of the time is worse than one that never does, because it only diverges
where nobody tested.

**Escaping through a template.** Code that generates code. `\b` became a
backspace character and thirteen regexes silently matched nothing. **Thirteen
occurrences.** Character codes are the only form that never broke. And when an
edit fails twice, print the raw bytes — that should be the first move, not the
sixth.

**A checkable clause next to an unverified one.** *"177 products, repriced every
single day."* The 177 was verified. The frequency was false at the moment of
writing. **Check every clause.**

**A silent prerequisite.** A control that returns nothing because another
control wasn't used first. Broken *and* mute — the worst combination, because
the user can't tell it from a dead feature.

---

## 4. Facts

Every claim gets a record:

```
{
  claim:      "what is true, specifically"
  sources:    ["where it came from"]
  confidence: VERIFIED | COMMUNITY | REASONED | SINGLE-SOURCE | DISPUTED | UNKNOWN
  falsifier:  "what would prove this wrong"
  recheckAfter: "a date"
}
```

**The falsifier is the important field.** A claim you can't imagine being wrong
isn't a claim, it's a belief. Writing the falsifier at the moment of recording
forces you to notice when you're asserting rather than reporting.

**Confidence tiers do real work.** They let you publish the strong ones and hedge
the weak ones automatically, rather than deciding each time.

---

## 5. Ratings and derived data

Someone will ask for a subjective score — how cute, how funny, how good.

**The honest version derives every score from a real field and states which
one.** The dishonest version is you assigning numbers that feel right, and it
fails on the first item.

```
comedy: 8   because its attack is called "Take It Easy"
cute:   9   because it's an unevolved Basic trading at 12x its set's median
```

**And refuse the ones you can't derive.** Popularity was requested and refused —
no engagement data existed, so any number would have been invented, and *once
it's on screen an invented number is indistinguishable from a derived one.*

A guard now fails the build if a refused rating reappears, or if any rating
loses its reason.

---

## 6. Measuring what you make

The trap: you build a thing, it feels good, you conclude it works.

**Log outcomes with the conditions attached.** Not just the result — the hour,
the age, the format. Two confounds bit within an hour of each other:

- **Timing.** The same post did 154 views at a bad hour and 18,800 at a good
  one. I ranked two formats on numbers that were measuring the hour.
- **Age.** Views climb for days. A 7-hour-old post beside a 22-hour-old one is a
  comparison of age.

**The report now says what it controls for: nothing.** *"This ranks by raw views
and controls for NOTHING. It is a record, not a finding."*

**And experiments need a design before the first data point.** One variable,
conditions held constant, a settling period, and a **falsifier written before
you start** — the tool refuses to run without one, because a test with no stated
wrong answer confirms whatever you already believed.

---

## 7. Content, if you're making any

Studied five accounts properly. Three findings that aren't domain-specific:

**Three engines, not a ranking.** Conversation (a divisive question), depth
(long-form with a follow-up), and share (a great image, three words). They have
different *downsides*, not just different upsides — and the share engine is the
only one a machine can run, because three words carry no voice.

**Permission is the mechanic.** Every high-reply post adds a second sentence
that removes a reason not to answer. *"Pick something obscure."* *"Not my
opinion."* *"Under $10."* Without it people think theirs is boring and scroll
past. **A question isn't finished until it's said why answering is safe.**

**A question is a request, and an unanswered request is visibly unanswered.**
An image isn't a request — silence isn't visible failure. So what works depends
on how many people are listening, and advice that ignores audience size is
advice for someone else's account.

---

## 8. Interface

**Nothing gates. Every control refines.** A control that silently requires
another control is the worst failure available.

**One primary action.** Research is unambiguous and I ignored my own note of it:
six panels became one box and it was the single biggest improvement made.

**But a bare input fails too.** Users can't see what a system understands, so
show examples that fill it in one tap. And when it doesn't understand, **suggest
rather than error** — that alone measurably reduces abandonment.

**Simplicity is not hiding things.** It's showing the one thing that matters now
and folding the rest where it can still be found. An active state that the user
needs stays visible; a wall of explanation for a feature they aren't using
folds.

**Match the platform's real gesture.** The output was a canvas, and a canvas
can't be long-pressed — so the first thing every phone user tries did nothing.

**Never claim on someone's behalf what you can't verify.** A streak counter that
advances on its own puts a number in front of *their* audience that you made up.
It advances only on confirmation.

---

## 9. Working with a human who has limited time

**Their attention is the scarcest thing.** If a machine can do it, the machine
does it. Nothing reaches their hands without being checked first.

**Push back when the evidence disagrees with them.** Asked for an agent that
writes and posts autonomously; the outcome log said every post that worked was
written by them and none used any generated formula. **Automating the writing
automates the only part that works.** Built the queue instead — they agreed
immediately, because the argument was made from their own data.

**Report failures plainly and without ceremony.** *"I said this worked three
times and was wrong twice"* is more useful than an apology and takes less of
their time.

**And when they catch something, work out why the machines didn't.** Every one
of those became a check. That's the loop that actually improves things.

---

## 10. If you're picking this up cold

1. Read the laws file first. Each one is a mistake already made.
2. Run the guards before touching anything. They tell you the current state.
3. When you change something, run them again. They're fast.
4. When you add a check, break it on purpose to prove it fires.
5. When you record a claim, write the falsifier before the claim.
6. When something fails twice, stop patching and look at the raw bytes.
7. When the human catches something, ask why the machines didn't — and fix
   *that*.

---

**The whole method in one line:** verify the thing you didn't think of, write
down what each check can't see, and let the person catch what no test can.
