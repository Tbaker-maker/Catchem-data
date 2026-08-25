# Pick up here — session handover, Aug 24 2026

Paste this into a new chat. It has everything needed to continue without
re-explaining anything.

---

## First message to the new chat

> Read `/mnt/user-data/outputs/catchem-knowledge-base.md` first, then this file.
> Repo is `Tbaker-maker/Catchem-data`, clone it before doing anything. Run
> `node scripts/guard-audit.mjs` and `node scripts/heartbeat.mjs` to see the
> real state — if the docs and the guards disagree, the guards are right.

---

## Who you're working with

**Tyler Baker (@LongedEth).** Sole founder of Catch'em, catchemtcg.com. Two
jobs, two young children, works in 20–60 minute weeknight spurts.

**Sustainability over velocity. Never push a sprint. No deadlines.**

He asked for honesty over comfort and means it. When he's wrong, say so with the
evidence — he changes his mind immediately when the argument comes from his own
data. When you're wrong, say so plainly and move on. No apology spiral; it
wastes time he doesn't have.

**He catches what no test can.** Sixteen of thirty-three logged errors were his,
and they're a different category from the machine catches — promises the
interface made that the code didn't keep, controls that failed silently, ratings
that were really opinions, a UI that overwhelmed. **When he catches something,
work out why the machines didn't and build that check.**

---

## Where things stand right now

### Working and verified

- **The editor** — `research/assets/build.html`, 1.9 MB, offline, no key.
  One prompt box: *"What do you want to post?"* Six example chips. Everything
  else folded behind *"All the controls"*. A local intent parser matches against
  real data, so it can only find things that exist.
- **All 11 test prompts produce cards** (`scripts/ask-smoke.mjs` enforces this).
- **The streak** — collapsed when there isn't one, open when there is. Never
  advances on its own. Never repeats a card. Reports a gap without resetting.
- **Composites** — 2×2 square at a safe 1.15 ratio, clear of X's 1.25 crop line.
  `crop-guard.mjs` fails the build if anything creeps within 0.05 of it.
- **Saving** — the composed image renders as a real `<img>` so press-and-hold
  works, plus Copy, Share, Download, and Open-in-a-tab as the path that can't
  fail.
- **50 guards**, each declaring what it can't catch.

### Built, waiting on credentials

- `scripts/post-queue.mjs` — Tyler writes, the machine sends at a set hour.
  Caps at 8 posts/day and $3/month. Needs `--send` wired.
- `scripts/read-metrics.mjs` — three readings per post at 1h/24h/48h, files into
  the outcome log automatically at 48h. Needs the fetch wired.
- `scripts/experiment.mjs` — A/B with a design. Refuses to start without a
  falsifier.

### Broken

- **The bot.** ~50 hours stale, four stages quiet, 24 products carrying price
  history from an era when it sorted by price and grabbed the fifty cheapest
  listings. **The Catch'em news account cannot exist until this is fixed** —
  `scripts/build-update.mjs` correctly refuses to publish on stale or absurd
  data, and currently refuses on both.

### Unknown

- **Whether the editor works on Tyler's phone.** Three wrong guesses so far
  (Safari syntax, image payload, `||=`). There's a boot panel that reports the
  actual error — **get that message before theorising again.**

---

## The X API situation, exactly

Tyler has **consumer key, consumer secret, and bearer token**. He does **not**
have the access token pair.

**That's enough to READ, not to POST.** A bearer token is app-only by design.

**This is fine, and reading is the more valuable half right now.** The outcome
log holds 6 posts and needs 20 before it can rank anything. Wire
`read-metrics.mjs` first; `--send` can follow when he generates the access
token pair.

**The ordering trap for when he does:** permissions must be set to Read and
Write *before* generating access tokens, or the tokens keep read-only permission
and every post returns a 403. Full steps in `research/PENDING-X-KEYS.md`.

Keys go to CC as GitHub Actions secrets. **Never into a chat, never into a
file.**

---

## The number that governs everything

**The outcome log holds 6 posts. Twenty is where it stops guessing.**

Every rule about what works — the three engines, the reach tiers, the permission
mechanic — rests on those 6 plus five studied accounts. **They are labelled
as hypotheses with falsifiers and must stay labelled until the log fills.**

---

## What we learned about posting

**Five accounts studied. Three different engines, not a ranking:**

- **@JohnnyCrambo** (17.6k) — 68 replies against 73 likes. Wants you to **argue**.
- **@shotguncaio** (43k) — "Day 90 of posting one card I love under $10".
  Wants you to **read**. Negative finding: motivational posts without a Pokémon
  hook underperform.
- **@Elite_4_J** — three words and an image, 402K views, 998 reposts. Wants you
  to **send it**. **This is the only engine a machine can run**, because three
  words carry no voice.
- **@SerebiiNet** (1M) — the institution model. Opposite of what works for
  Tyler. Applicable only as a separate Catch'em brand account.
- **@tall_alan** (16k) — ~900 replies on one question.

**The mechanic under every high-reply post:** a second sentence that removes a
reason not to answer. *"Pick something quirky."* *"Not my opinion."* *"Under
$10."* **A question isn't finished until it's said why answering is safe.**

**And they're all small.** Crambo's 37,100 views came off 17.6k followers — 2.1×
his count. **Reach relative to size is the metric.**

**Tyler's own asymmetry, which corrected my advice:** a question is a request,
and an unanswered request is *visibly* unanswered. An image isn't a request.
So what works depends on audience size — hence the reach tiers.

---

## Next things, in order

1. **CC wires `read-metrics.mjs`** with the bearer token. Highest value —
   it fills the outcome log by itself at $0.001 per read.
2. **CC fixes the bot.** Nothing about the news account can proceed until then.
3. **Tyler generates the access token pair** when convenient, then `--send`.
4. **The engagement/niche/algo guide** — Tyler asked for this and was about to
   send source material. Ask for: his own post numbers with the hour posted,
   whole-account write-ups rather than single posts, follower counts alongside
   every number, and posts that *flopped*. Mark confidence on every claim;
   separate what we've measured from what's widely believed.

---

## The laws that matter most

Full set in `research/house-theses.md` (101). The ones that bit hardest:

- **A table is only a source of truth if every reader reads it.** Four bugs.
- **Escaping through a template.** Thirteen casualties. Use
  `String.fromCharCode(92)`. **When an edit fails twice, print the raw bytes** —
  that should be the first move, not the sixth.
- **A fake dependency proves nothing.**
- **A guard that pushes nothing reports success.** Break checks on purpose.
- **Designing to a limit means failing at the limit.**
- **Simplicity is not hiding things** — show the one thing that matters now.
- **The count never advances on its own.**
- **Nothing gates, every control refines.**

---

## Key paths

```
catchem-knowledge-base.md          canonical — read first, update last
SYSTEM-README.md                   what everything is and how to run it
METHOD-PORTABLE.md                 the method with the domain stripped out
HANDOVER.md                        for a model starting cold
research/house-theses.md           101 laws
research/RESEARCH-GATE.md          33 logged errors, who caught each
research/PENDING-X-KEYS.md         the credential steps
research/PENDING-CLOSE-THE-LOOP.md what CC needs to wire
data/knowledge.json                50 facts, each with a falsifier
data/post-outcomes.json            5 posts — the number that matters
research/assets/build.html         the editor
```

---

## The one habit

**Verify the thing you didn't think of.** Every serious bug in this project was
in the clause nobody checked, the reader nobody remembered, or the device nobody
could test. Never once in the part being looked at.
