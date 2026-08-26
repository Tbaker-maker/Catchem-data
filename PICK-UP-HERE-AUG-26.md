# Pick up here — Aug 26 2026

**Supersedes `PICK-UP-HERE.md` (Aug 24), which predates 81 commits.** That file
is still on disk; where the two disagree, this one is newer. Verify the count
yourself with `git log --since=2026-08-25 --oneline | wc -l`.

You are the operating engineer for **Catch'em**, a Pokémon TCG data and culture
platform built by **Tyler Baker** (@LongedEth). Read `CLAUDE.md` first — it
holds the standing rules and Tyler's constraints. This document covers what
changed on 25–26 August and, more importantly, **how to tell whether anything
here is actually true.**

---

## 1. Read this part even if you skip the rest

**Six times in one day, something reported success while delivering nothing.**

| what it said | what was true |
|---|---|
| editor: "16,468 cards searchable" | it shipped **6,725** — 41% of the catalogue |
| commit: "form id out of the repo" | it sat in **ten tracked files** |
| research agent: eight green runs | **no radar written**, eight days running |
| price job | **red for six consecutive runs**, in a tab nobody opens |
| `ATTRS` Proxy | `for...in` ran **two loops zero times**, silently, forever |
| docs: "57 guards" | the data held **62** |

None of these were caught by a test. Every one was caught the same way:

> ### Compare what the log claims against what the file contains.
>
> The log says 16,468 — count the rows in the artifact. The commit says the id
> is gone — grep the tracked files. The run says green — open the file it was
> supposed to write and read its date.

**This is the highest-value habit in the project.** A green tick is a claim
about work, not evidence of it. If you do one thing differently from your
instincts, make it this.

### Then the exact opposite, four commits running

Guards that **failed on correct code**, which is the other way a check stops
working — it starts crying wolf and people learn to skim it:

- `flag-guard` matched **any function named `flag()`**. Five scripts declare a
  five-line CLI arg reader called `flag`. 36 false positives — and because
  `generate-pulse` runs it and sits 29 lines above the commit step, **it killed
  the daily price pipeline for three days.**
- `card-guard` and `verify-work` classified scripts by **filename** — anything
  containing "card". `card-relations.mjs`, a query library that writes no files,
  was reported as an ungated publisher every run.
- `reply-line-guard` (mine, new) flagged `post-queue.mjs` for the phrase "draft
  a reply" — which appears under the heading **"WHAT THIS WILL NOT DO"**. It
  matched words without reading their polarity.
- `security-agent` reached a **different verdict depending on the environment**:
  it exempted a value via `process.env.FORMSPREE_FORM_ID`, which exists on a
  laptop and not in CI. It passed everywhere I could test and raised a CRITICAL
  in the only place that runs the pipeline.

**A guard that fails on correct code is worse than no guard.** It does not just
miss things; it stops real work and trains people to ignore it.

---

## 2. The claim standard, and the three times we broke it

Every published claim must be **derivable from a field we hold**, with the query
recorded. Not "true as far as I know" — *reproducible*.

We learned it by getting it wrong three times, all on the same day.

**The Kimura sentence.** The tutorial opened with *"the widest gap by one
illustrator in the whole catalogue"* over a 25-year pair. Six illustrators span
27 years. The relation measured **the longest anyone has gone between drawing
the same Pokémon twice**; the sentence quietly widened it to career span. The
pair was right, the number was right, **the scope was invented by the English.**

> **Named trap in `research/house-theses.md`:** *a sentence built on a relation
> must not claim more than the relation measures.* Say the relation's definition
> out loud, then read the sentence. If it would still be true had the relation
> measured something broader, the sentence is built *beside* the relation.

**The Pikachu that was a stamp.** I looked at nine leaked cards, saw a small
Pikachu on each, and proposed a caption about "a Pikachu hidden in every card".
It is the **30th anniversary stamp**, on the whole promo run. A set-wide marker
read as a per-card artistic choice. **We hold no field describing artwork at
all** — no stamp, no holo pattern, no border. `visual-claim-guard.mjs` now
blocks any caption asserting something *drawn* across a whole population.

**The 122x posting-hour law.** It compared **one post against itself at two
ages** and called it an effect of posting hour. Then the correction over-swung:
the new age-comparability guard started **discarding valid data**. Both are in
`data/corrections-log.json` (10 entries). A guard that throws away good readings
is its own defect.

**The general shape:** in all three the observation was correct and the **scope**
was invented. Data-derived strings cannot do this — their scope is exactly their
query's. Typed sentences can, and nothing notices.

---

## 3. When two sources disagree

```
the live page  >  the guards  >  the docs
```

- **Docs go stale.** `doc-numbers.mjs` exists because they did, repeatedly.
  When a doc and the data disagree, **the data is right** — fix the doc.
- **Guards can be wrong** (see §1) but they are checked and re-checked. When a
  guard and a doc disagree, **trust the guard.**
- **The live page beats everything.** Three blockers on 26 Aug passed every
  guard we have and were only found by opening
  `https://tbaker-maker.github.io/Catchem-data/research/assets/build.html`
  in a fresh private window. The gauntlet tests the *index*, not the *published
  page*. **Verify on the live URL, not a local build.**

---

## 4. What is built and live

**The editor** — `scripts/build-editor.mjs` → `research/assets/build.html`,
served by GitHub Pages from `main`. All 16,468 cards searchable. Guided
tutorial, honesty box, questionnaire, 7 frame layouts.

**Guards** — 19 in the fleet (`node scripts/fleet.mjs`), 63 with declared blind
spots. Blocking vs advisory is a real distinction; read `scripts/fleet.mjs` for
what each does and why.

**Relations** — `scripts/card-relations.mjs`, 12 types including `SET_DEPTH`
(added 25 Aug: card count, illustrator count, dearest vs median, cards with no
market). Its reason lines **state numbers and never judge** — a relation that
answers the question removes the reason to reply.

**The pipelines** — daily price job (04:00 UTC) and daily research agent (13:00
UTC). Market data now commits at **step 13, before anything reports on it**,
because a citation backlog is not a reason for the site to show last week's
prices.

**Known still-red:** the price job fails at *Generate Morning Pulse* on genuine
findings (`card-guard`, `verify-work`). **It no longer takes the price data with
it.** That was deliberate, not abandoned.

---

## 5. What the four settled posts actually say

`node scripts/outcome-report.mjs`. Five logged, four settled, **one unmeasured**.

| post | age | views | replies | repl/1k |
|---|---:|---:|---:|---:|
| arita-blastoise | 59.8h | **127,200** | 34 | **0.27** |
| charmander-late-night | 85.0h | 867 | 14 | **16.15** |
| slakoth-2am-coding | 59.0h | 941 | 10 | 10.63 |
| sunflora-good-vibes | 48.2h | 926 | 9 | 9.72 |

**Reach and reply density diverge violently.** The 127,200-view post has the
*worst* reply density of the four, by 60x. Any claim about "what works" must say
**which** of the two it means.

**Three of these were nearly written off** on readings taken *minutes* after
posting. The Arita post was recorded at **18,800 views** mid-climb and settled at
**127,200** — 6.8x. Hence: **a reading carries its age or it is not a reading.**
Settled = 48h. `repl/1k` is computed on read and never stored.

**Four posts cannot support a law.** The report leads with what is *not*
comparable, and that is correct behaviour, not a gap.

---

## 6. The post shapes

`research/post-shapes.md` documents **six**: the five below, observed on other
accounts, plus `ARTIST_REVISIT` which is ours and derived from
`artistRevisits()`. **Mechanics only — never voice.** "Two cards with an
invented story between them" is a mechanic. How shotgun writes is his; copying
it produces something hollow.

| shape | mechanic | computable |
|---|---|---|
| **PERMISSION** | a second sentence removing the reason not to answer | partly |
| **SET_DOUBT** | doubts a *set*, not a person; does not answer itself | **yes** — `SET_DEPTH` |
| **ERA_CLAIM** | short arguable era claim, invites a counter-era | partly |
| **OUTSIDE_REFERENCE** | connects a card to something real outside the game | **no** |
| **NARRATIVE_PAIR** | two cards, an invented story between them | **no** |

**The last two are the strongest observed and we cannot build either.** An
earlier review of shotgun's account missed both — because it was looking for
what it could automate, so a non-computable shape **did not register as a
finding at all**. Computability is a **field, never a filter**.

Archive: `data/observed-posts.json` via `scripts/observe-post.mjs`. It **refuses
our own account** (ours belong in `post-outcomes.json`; the separation is
permanent) and **refuses metrics without an age**.

---

## 7. The X API — probed, not assumed

`research/x-api-access.md`. Four read-only calls against our credentials:

| | result |
|---|---|
| another account's timeline | **200** · 900/15min |
| platform-wide recent search | **200** · 300/15min |
| full-archive search | **403** — auth type, not plan |

**We can read other accounts.** The constraint is **cost, not capability**.

Measured: these nine accounts post **87.8 originals/day** (15–103/day *including*
replies). Covering them costs **$13.17/month** against Tyler's **$5–10 ceiling**.

**Complete coverage is not affordable at any cadence** — and for *discovery*,
weekly and daily cost the same. Cadence is not the lever; account count and
depth are. For *measurement* daily is everything, because a 48h reading is
available for about a day.

Plan in `research/api-budget-plan.md`: **$4.75/month** — measurement, paste
follow-ups, weekly search, weekly deep pass on four accounts chosen by *signal
per read*. **Not built yet.** Build the spend counter *before* the first paid
loop; a metered API with a loop bug is the only failure here that costs money.

---

## 8. Beta terms — decided, not shipped

`data/decision-log.json` → `2026-08-25-beta-terms-and-free-for-life`. Three
promises: the free tier stays free; some features probably become paid later;
**beta testers who report keep the full toolset free permanently, earned once**
— no quota, no streak, going quiet changes nothing.

That last clause is the one that does the work. An ongoing condition makes
people over-report to stay safe or quietly disengage, and both destroy the only
thing the arrangement buys.

> ### The pinned post is still wider than the policy.
> The landing page says **"Free forever"** with no scope, live since
> `7c7565c` (2026-08-23 19:48 UTC). **Every signup so far read that.** The repo
> holds no signup list — the form posts to Formspree. Replacement copy is
> drafted in `research/beta-terms-draft.md` and **is not published.**

---

## 9. Queued and unstarted

- **NOTICE, the watch tower** — the largest remaining piece. Inventory done
  (`research/notice-inventory.md`); **build not started.** NOTICE reads three
  fields against ~forty we hold. `card-bios.json` covers **all 16,468 cards
  with 20 fields** and NOTICE reads none of it — including `why`, the
  pre-computed reasoning behind every rating.
- **API budget implementation** — planned, not built.
- **Editor Parts 4–6** — lines are written for two cards when nine are loaded
  ("23 years between these two" over nine cards); "Another" missing on three
  categories; reply block needs alternative formats.
- **A blocking live-page smoke test** — nothing currently tests that the
  tutorial appears or that images render.
- **Reference-candidates** — cards referencing real events, art, history.
- `evo-smoke` reports **3 complete, 13 incomplete**: "squirtle evolution"
  answers with the Trainer card *Evolution Incense*.

---

## 10. The two things only Tyler can do

**19 questions wait in `node scripts/ask-eyes.mjs list`.** Two are blocking:

1. **`beta-terms-62`** — who qualifies for free-for-life? The honesty box is
   anonymous by construction and **must stay that way**. My read: his judgement,
   at this size. It is a promise about something permanent, so it is his.
2. **`beta-terms-63`** — change the page to match the narrower terms, or honour
   the wider promise for everyone who already read it?

Also open: `editor-60` (does X really refuse a PNG over 5MB), `pipeline-65/66`
(what may stop a data publication), `secret-scan-59` (rotate the form id).

**Never route mechanical work to Tyler without testing the automated path
first** — that is the absolute rule at the top of `CLAUDE.md`. His time is the
scarcest resource here. But taste, domain facts, and promises about money are
his by right, not by delegation.

---

## 11. First fifteen minutes

```bash
node scripts/fleet.mjs                 # 19 agents; blocking vs advisory
node scripts/outcome-report.mjs        # what the evidence can and cannot say
node scripts/ask-eyes.mjs list         # what is waiting on a human
node scripts/artifact-freshness.mjs    # has any scheduled job stopped delivering
```

Then open the **live page** in a fresh private window and use it as a stranger
would. Three launch blockers were found that way on 26 August and by nothing
else.

**Escaping hazard, which has cost this project four separate bugs:** generated
HTML is written from template literals, so `\s` written in the generator ships
as `s`. Use `String.fromCharCode(92)` or a form needing no escape.
`escape-audit.mjs` reads the *artifact* and blocks. Related: Git Bash heredocs
collapse backslashes, and Python writes `'\b'` as a **literal backspace** —
which `JSON.stringify` renders as `\b`, so it looks correct in every inspection.
Write scripts to a file rather than piping them through a heredoc.
