# Beta terms — draft for Tyler

**Status: NOT PUBLISHED. Nothing ships until you say this is what you meant.**

---

## The four sentences

> **Catch'em is free to use, and the free tier stays free — no expiry, no card,
> nothing that turns into a bill later.**
>
> **As it grows, some of the more advanced features will probably become paid;
> we would rather tell you that now than surprise you with it later.**
>
> **If you are in the closed beta and you tell us something we can use — a bug,
> a thing that annoyed you, a thing that is worse than what you already use —
> you keep the full toolset free permanently.**
>
> **That is earned once and it is yours: no quota, no streak to maintain, and
> going quiet afterwards changes nothing.**

---

## Why the last sentence exists

It is the one that does the work, and it is the one most likely to get trimmed
for length. It should not be.

Without it, "keep reporting and you keep your access" is what people hear —
and then the arrangement quietly starts producing the wrong thing. Someone who
is unsure whether they have done enough this month files a small report to stay
safe. Someone who has drifted away decides they have probably lost it and stops
answering altogether. Both are rational, both are invisible to us, and both
replace honest feedback with feedback shaped by the incentive.

The point of the offer is that a tester can say **"this is worse than what I
already use"** and lose nothing by saying it. An ongoing condition takes that
away without anybody deciding to.

---

## One thing to fix, and it is not in the terms

The live landing page (`research/assets/index-landing.html`) currently reads:

> Free. **Built to make you better.**
> Get into the closed beta — *Free forever · early access before anyone else*

**"Free forever" with no scope attached.** A stranger reads that as everything,
forever, and it attaches on their reading — not on ours. These terms are
narrower than that line, so publishing them without touching the page means the
page and the terms disagree in public, which reads as a walk-back even though
nothing has actually been taken from anyone.

Two options, your call:

1. **Change the page to match** — "Free forever" becomes "Free tier, forever",
   which is four characters longer and true.
2. **Leave it and honour it** — treat the unscoped promise as binding for
   everyone who has already seen it, and scope only for people arriving after
   the change.

I would not decide this one without you. Option 2 is more generous and costs
almost nothing at fifteen people; option 1 is more sustainable if the waitlist
grows past that.

Either way, **the terms should reach existing waitlist members directly**, not
just sit on the page for new arrivals. The people most likely to feel a
walk-back are the ones who already read the old line.

---

## The open question — queued to you as `editor-61`

**We cannot tell who reported.** The honesty box is anonymous by construction:
no name, no fingerprint, no persistent id, nothing derived from an address.
That is the reason it produces usable answers and it must not change.

So qualification for free-for-life has to come from somewhere else:

| option | how it works | cost |
|---|---|---|
| **Questionnaire name field** | already optional and already there | someone who reports anonymously and leaves the name blank does not qualify, and will not know why |
| **Explicit opt-in** | a checkbox: "count this toward my beta access" | one more thing on the form; makes the exchange explicit, which some people prefer and others find transactional |
| **Your judgement** | you decide who actually helped | no infrastructure, works fine at fifteen, stops working somewhere before fifty |

My read: **your judgement, for now.** Fifteen people is small enough that you
will simply know, and the other two options both put a mechanism in front of a
relationship. But this is a promise about who gets something permanent, so it
is yours to make rather than mine to assume.

---

## What this deliberately does not build

No accounts. No billing. No entitlement flags.

Fifteen people do not need infrastructure, and an entitlement system built now
would lock in a shape for the paid tier before we know what the paid tier is.
When it matters, a list of names in a file will do.

---

# Replacement copy — pin and landing page

**Added 2026-08-26. Also NOT PUBLISHED.**

## The pinned post

Current: **"ALL FREE — free for life"**, no scope.

Replacement, three lines:

> **Catch'em is free, and the free tier stays that way.**
>
> **Some of the deeper tools will likely be paid later — saying so now rather
> than later.**
>
> **Beta testers who tell us something useful keep everything free, permanently.**

Three sentences for three promises, in the order someone cares about them: what
it costs me now, what might change, what I get for helping. The word "likely"
is doing real work in the middle line — we have not decided which features, and
saying "will be paid" would be a firmer claim than the decision supports.

## The landing page

Current, in `research/assets/index-landing.html` and `scripts/build-waitlist.mjs`:

> Free. **Built to make you better.**
> Get into the closed beta — *Free forever · early access before anyone else*

Replacement — a four-character change on the line that matters:

> Free to use. **Built to make you better.**
> Get into the closed beta — *Free tier forever · early access before anyone else*

"Free forever" reads as *everything, forever*. "Free tier forever" is the same
promise honestly bounded, and it is not a smaller-sounding line — it is a more
specific one, which is the thing that actually builds trust.

---

# Who saw the wider claim

**Everyone who has signed up so far.**

The unscoped line shipped in commit `7c7565c` on **2026-08-23 19:48 UTC**,
during the traffic spike the waitlist page was built for. It has been live
continuously since. There has been no version of that page carrying a scoped
promise.

**I cannot list them.** The form posts to Formspree; the repo holds no signup
records, by design. So the honest statement is not "these fourteen people" but
"every signup between 2026-08-23 19:48 UTC and whenever the page changes."

**The fair thing is to honour the wider reading for that group.** They did not
misread it — the line genuinely says what they think it says, and the scope was
missing on our side rather than misunderstood on theirs. At this cohort size the
cost is close to nothing, and it converts a potential grievance into the
strongest possible version of the beta offer: *everyone who was here before we
knew what we were doing keeps everything.*

That also makes the free-for-life offer easier to explain, because for the
current cohort the two promises collapse into one.

---

# One guard needs its reasoning corrected

`scripts/negative-tests.mjs` carries **"The tools stay free — no paywall
language"**, added in the same commit as the FREE FOREVER line. It fails the
build if `upgrade to pro`, `start your subscription`, `per month`, `paywall` or
`premium plan` reaches any shipped page.

**Keep the guard.** None of the copy above trips it, and it still blocks the
hard-sell phrasing that would genuinely break faith with an early community.

But its stated reason reads *"we promised FREE FOREVER in public on
2026-08-23"*, and that sentence is now the old policy. Left as is, a future
reader treats the guard as evidence that the unscoped promise still stands.
The protection stays; the justification gets updated to point at the new
decision. I have not touched it pending your read of this page.
