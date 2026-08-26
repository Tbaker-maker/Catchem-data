# Spending $5–10/month on reading other accounts

**Plan for Tyler. Nothing built yet — this is the report he asked for first.**
Every number below is measured against our own credentials on 2026-08-26, not
estimated. The sizing probes cost **$0.90** in total and are the reason this
plan is not guesswork.

---

## The measurement that changed the design

I measured how much these nine accounts actually post. Twice — because the
first number was wrong in an instructive way.

**Including replies: 15 to 103 posts per day, each.** That is not unusual
behaviour; it is the same reply practice we have identified as Tyler's
strongest asset, seen from the outside. The API's timeline endpoint returns
replies by default, so a naive read spends most of its budget on them.

**Originals only (`exclude=replies,retweets`): 87.8 per day across all nine.**

| account | originals/day | median views | best seen |
|---|---:|---:|---:|
| tall_alan | 22.4 | — | — |
| JohnnyCrambo | 12.9 | — | — |
| shotguncaio | 12.5 | — | — |
| parkyspokestop | 10.5 | — | — |
| Courtyard_io | 8.7 | 1,041 | 2,809 |
| CardGameNomad | 8.2 | 1,316 | 39,424 |
| xzuyyu | 5.9 | 1,850 | 51,821 |
| Touyarokii | 4.4 | 24,490 | 325,143 |
| knoyhead | 2.3 | 608 | 22,069 |

---

## What $10/month actually buys

At **$0.005 per post read**, $10 is ~2,000 reads/month, ~65/day.

| plan | reads/mo | cost | |
|---|---:|---:|---|
| Cover all 9 accounts, every original | 2,634 | **$13.17** | over ceiling |
| Weekly, full week, all 9 | 2,643 | **$13.21** | over ceiling |
| Daily, 5 newest per account | 1,350 | $6.75 | fits, but samples blindly |
| **Weekly, full week, 4 low-volume accounts** | **626** | **$3.13** | fits |
| **Weekly platform-wide recent search, 50 results** | **215** | **$1.07** | fits |
| Measurement: 40 posts × 2 readings | 80 | $0.40 | fits |

**Complete coverage of the current list is not affordable at any cadence.** It
needs $13.17/month and the ceiling is $10.

---

## The finding that decides daily vs weekly

**For DISCOVERY, weekly and daily cost exactly the same.** The posts exist
either way; batching them changes nothing. $13.21 weekly against $13.17 daily
is the same number.

So the honest answer to "what does daily buy that weekly does not" is:
**for discovery, nothing.** Cadence is not the lever — account count and depth
are. Tyler's instinct to run less often is right, and it saves nothing on its
own; what saves money is reading fewer accounts properly.

**For MEASUREMENT, daily is everything.** A 48-hour reading is only available
for about a day. A post found on Monday must be read on Wednesday; a weekly job
reads it at 168 hours, and then nothing is comparable across posts — which is
the entire reason we are paying at all.

**So: discovery weekly, measurement daily.** Measurement is 80 reads a month.
Running it daily costs $0.40 and running it weekly costs the same $0.40 while
destroying the thing it was for.

---

## Where the money should go

Tyler pastes URLs for free and already does. Paid reads should buy what he
cannot, exactly as briefed.

| line | what it buys | reads/mo | cost |
|---|---|---:|---:|
| **Measurement at 48h + 7d** | readings at a KNOWN AGE, the only kind comparable across posts | 80 | $0.40 |
| **Manual paste follow-up** | one read per URL he sends, so he never types a number | 30 | $0.15 |
| **Weekly recent search** | posts from accounts nobody sent us | 215 | $1.07 |
| **Weekly deep, 4 accounts** | full week of originals from the low-volume, high-signal end | 626 | $3.13 |
| | | **951** | **$4.75** |

**$4.75/month against a $10 ceiling.** Half the budget unspent, which is the
right place to be on a metered API.

### Why those four accounts

Not "the small ones" — **the ones with the best signal per read.** knoyhead
posts 2.3 originals a day and has been seen at 22,069 views; tall_alan posts
22.4 a day. Reading tall_alan for a month costs ten times what knoyhead costs
and buys mostly volume. Touyarokii at 4.4/day and a 325,143-view post is the
cheapest window onto what reach looks like.

The four high-volume accounts are not dropped — they are **handed to the free
path.** Tyler follows them, he sends what strikes him, and his judgement is a
better filter than reading everything they post.

---

## The hard ceiling

A pay-per-use API with a loop bug is the only failure here that costs real
money rather than a wasted run. So:

- A running monthly spend counter in `data/api-spend.json`, incremented by
  **actual posts returned**, not by requests planned.
- **The job refuses to read past the limit** and exits, rather than warning.
- **Projected cost printed before every run**, and a refusal if that projection
  alone would breach the ceiling.
- Ceiling **$10**, soft warning at **$7**.
- The counter resets on the 1st, and a month that ends under $2 is reported
  too — underspending a budget that was granted for a reason is also a finding.

---

## Making it prove its worth

A monthly line in the fleet output:

```
observed archive · Aug: 23 captured · 4 became shapes · 1 shape used in a post
                   spend $4.75 of $10 · cost per shape used $4.75
```

If a quarter's spend produces nothing we used, that is visible rather than
arguable. The uncomfortable version of that line is the point of having it.

---

## One step for Tyler

He is on a phone. Pasting a URL is all it takes:

```
node scripts/observe-post.mjs add --url https://x.com/...
```

The job fetches that post's text, account, and metrics itself — and comes back
at 48 hours for a reading that means something. **No numbers typed, ever.**
Asking him for numbers is the homework that killed the outcome log the first
time.

---

## What I have not verified

Which billing plan we are actually on. Rate-limit headers are not plan labels,
and `api-strategy.json` already records that quotas are dashboard facts. If we
are on legacy Basic rather than pay-per-use, the per-read price is not $0.005
and every figure here scales — but the *shape* of the plan does not change,
because the expensive line is discovery either way.

**The $0.90 already spent** on the two sizing probes is real and is the first
entry in the spend counter.
