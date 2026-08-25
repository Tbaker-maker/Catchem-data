# Catch'em — the whole system

Pokémon TCG tools for collectors and creators. Built by Tyler Baker (@LongedEth).

Everything here is real data about real cards. Nothing is invented.

*(For the price bot specifically, see `README.md`.)*

---

## Start here

**One file does most of the work.** `research/assets/build.html` is the creator
editor — 1.9 MB, no dependencies, no server, no API key. Open it in a browser
and it works offline.

```
node scripts/build-editor.mjs      # rebuilds it
```

Type what you want to post. It hands back cards.

---

## What's in it

| | |
|---|---|
| **16,468 cards** | every English card: set, year, artist, rarity, price |
| **6,658 shipped to the editor** | hero rarities plus anything over $8 — nobody posts a Common |
| **52,578 derived ratings** | cute, comedy, dark, price, power, scarcity, art premium |
| **4,464 cards with lore** | the flavour text printed on the card |
| **61 themes** | across 9 groups, every one verified to produce |
| **207 sealed products** | tracked daily by the bot |
| **50 sourced facts** | each with a falsifier and a recheck date |
| **56 guards** | each with a declared blind spot |

---

## The scripts that matter

**Making things**

```
node scripts/build-editor.mjs            the creator editor
node scripts/card-composite.mjs ID ID    a post image from specific cards
node scripts/build-promo.mjs ID          card art plus branding
node scripts/build-numbers.mjs           "63 Charizards out of 16,468 — too many?"
node scripts/build-live.mjs              the two-screen live presenter
node scripts/build-mood.mjs              mood → cards, from printed card text
node scripts/build-lore.mjs              flavour text as lore
node scripts/build-bios.mjs              the derived ratings
node scripts/build-waitlist.mjs          the landing page
```

**Posting and measuring**

```
node scripts/post-queue.mjs add --text "..." --at 21:15
node scripts/post-queue.mjs list
node scripts/post-queue.mjs send         needs a terminal and two answers
node scripts/originality-guard.mjs       what is original about each queued post?
node scripts/read-metrics.mjs due        what needs a reading
node scripts/log-outcome.mjs --report    what has worked so far
node scripts/experiment.mjs read         A/B with a design
```

**Checking**

```
node scripts/guard-audit.mjs             is every guard wired?
node scripts/negative-tests.mjs          does every guard actually fire?
node scripts/pre-mortem.mjs              does every guard declare what it misses?
node scripts/offline-smoke.mjs           does the editor work with no network?
node scripts/theme-smoke.mjs             does every theme produce, and none twice?
node scripts/ask-smoke.mjs               does every prompt hand back cards?
node scripts/crop-guard.mjs              does anything sit on X's crop line?
node scripts/rating-guard.mjs            does every rating name its source?
```

---

## The laws

`research/house-theses.md` holds 101. Each one is a mistake made once, written
down so it isn't made twice. The load-bearing ones:

**On truth**

- **A grouping not in the data is slop.** A rating that can't name the printed
  field it derives from is taste wearing a number.
- **Verified the noun, skipped the verb.** We shipped *"repriced every single
  day"* while the cron was failing. Check every clause, not just the easy one.
- **A wrong card beside a true claim reads as researched** — worse than an
  obvious error, because nobody catches it.
- **Asking invites disagreement, asserting invites correction.** Only one of
  those is a thread.

**On building**

- **A table is only a source of truth if every reader reads it.** Four separate
  bugs came from code recomputing what a table already said.
- **A fake dependency proves nothing.** A test that replaces the thing most
  likely to fail is testing the absence of the bug.
- **A guard that pushes nothing reports success.** Break your checks on purpose
  to prove they fire.
- **Designing to a limit means failing at the limit.** X crops at 1.25, so we
  target 1.15.

**On the product**

- **Nothing gates, every control refines.** A hidden prerequisite that fails
  silently is the worst failure available: broken *and* mute.
- **A canvas cannot be long-pressed.** The first thing anybody does with an
  image on a phone is hold it.
- **Simplicity is not hiding things.** It's showing the one thing that matters
  now and folding the rest where it can still be found.
- **The count never advances on its own.** A wrong day number is a public
  credibility hit for the creator, not for us.

---

## What we learned about posting

Five accounts studied, and they run **three different engines** — not better and
worse versions of one thing.

- **@JohnnyCrambo** — 68 replies against 73 likes. Wants you to **argue**.
- **@shotguncaio** — long-form lore, day 90 of a numbered series. Wants you to **read**.
- **@Elite_4_J** — three words and an image, 998 reposts. Wants you to **send it**.

**The mechanic under every high-reply post:** a second sentence that removes a
reason not to answer. *"Pick something quirky."* *"Not my opinion."* *"Under
$10."* A question isn't finished until it's said why answering is safe.

**And they're all small.** Crambo is 17.6k and took 37,100 views — 2.1× his
follower count. Reach relative to size is the metric.

---

## Why the send is manual

`post-queue.mjs send` asks whether you have thirty minutes, then makes you type
the word `send`. It refuses outright if there is no terminal attached. There is
no `--force`, no `--yes`, no scheduled path, and no flag that skips any of it.

**This is not friction anybody forgot to remove. It is a condition of getting
paid.** X's Original Content Rewards programme — the one that replaced Creator
Revenue Sharing on 2026-08-08 — states that content created or posted by
**automated means is ineligible**. A cron job that posts on a schedule does not
save Tyler ten seconds; it makes every post it touches ineligible, silently,
with no error message and no way to tell from the outside that it happened.

So the gate is built to make automation *structurally impossible* rather than
merely discouraged. The terminal check is the load-bearing part: a cron job, a
CI runner and a piped stdin all have no TTY, so none of them can reach the
network call no matter what arguments they pass. `verify-work.mjs` fails the
build if any script reaches a posting endpoint without both that check and the
confirmation policy, and it fails the build if a bypass flag appears in any of
them. Breaking either one has been tested and does fail.

**Every send records `humanConfirmed: true` and `confirmedAt`** — the timestamp
of the actual keystroke, in true UTC. That is the audit trail if eligibility is
ever questioned.

The thirty-minute question earns its place separately. A post that goes out when
nobody is around to answer replies does worse than one that waits, and the only
moment anyone answers *"do I have half an hour"* honestly is before pressing
send. The answer is recorded as `windowHonored` after the window closes, so the
claim can eventually be checked rather than believed.

**Replies are never drafted here, and never will be.** Posts are assisted;
replies are Tyler's own words, every time. That is a hard line, not a
preference — and under a programme that pays for primary work and excludes
automated content, it is also the safe reading.

*Programme terms retrieved 2026-08-25 and recorded, dated, in
`data/compliance-register.json`. They have changed before and will change again
— re-read them before acting on money.*

---

## What's pending

**Tyler** — X API credentials at `console.x.com`, read + write. The only step
that needs a person. Detail in `research/PENDING-CLOSE-THE-LOOP.md`.

**CC** — deploy the landing page and the editor; wire `--send` and the metrics
fetch; fix the bot (50h stale, four stages quiet, 24 products carrying
broken-era price history).

**The number that decides everything** — the outcome log holds 5 posts. Twenty
is where it stops guessing. Until then every rule above is a hypothesis with a
falsifier attached, and it says so on screen.

---

## The one thing to understand about the business

The tools are free forever because they're static and cost nothing to run.
Automated posting is paid because it costs real money every time it fires.

That line was drawn *before* anyone signed up, and it's on the landing page —
because somebody who joins for FREE FOREVER and later finds the useful part is
paid will call it bait and switch, and they'd be right to.

---

## The agent fleet

Eight agents. **One command runs all of them.**

```
node scripts/fleet.mjs            run everyone, report what each found
node scripts/fleet.mjs --list     who's on the team and what each does
node scripts/fleet.mjs designer   just one
node scripts/fleet.mjs --quiet    verdicts only, no detail
```

**Blocking** — `verify-work` (25 known error classes), `pre-mortem` (every guard
declares what it can't catch), `competence-guard` (every specialist declares its
blind spots).

**Advisory** — `designer` (visual surfaces), `bias-guard` (who catches what),
`decision-audit` (decisions whose check-date has arrived), `theme-scout` (post
ideas mined from the data), `ask-eyes` (the shared question queue).

**Why one command:** eight scripts meant remembering they exist, remembering
which is relevant, and remembering to run it. **A tool you have to remember
doesn't get used.**

**A crash is reported as a crash.** One agent printed a blank line for days,
which reads as fine in a summary. An empty verdict now fails loudly.
