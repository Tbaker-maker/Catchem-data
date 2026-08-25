# 2026-08-25 — Close the metrics loop (JOB 1) + monetization compliance (JOBS 5–8)

Commits: `d221fbe`, `2cecfb5`, `679e2c7`, `dcad1e4`, `62c6613`, `8fb5e7c`. All pushed.
**JOBS 2, 3 and 4 from the earlier prompt are NOT done** — see *Still open*.

---

## JOB 1 — the corrupt outcome data

**The 122× posting-hour finding is withdrawn.** There were never two posts. One
post was entered twice; the second entry called itself "REPOST at 9:18pm" while
carrying the same `postedAt` as the first, because 9:18pm *is* 21:18. The 154
views were read 12 minutes after posting and the 18,800 were read 15h20m after
posting. That is not an hour effect.

**A correction to the brief:** the second reading is **15.33 h old, not ~22 h**.
The 22 h figure assumed that reading was also local time. It is genuine UTC —
committed at `19:39:04Z`, ninety-three seconds after its own `19:37:31.524Z`
timestamp. The ~22 h number was itself produced by the bug being fixed. The
substance is unchanged: 0.2 h against 15.33 h is 77× apart in age.

### Which timestamps were local, decided by evidence rather than assumption

Git commit times are real UTC, so they arbitrate:

| entry | recorded | verdict | true UTC | how it was decided |
|---|---|---|---|---|
| arita | `2026-08-22T21:18:00Z` | local | `2026-08-23T04:18:00Z` | its reading `21:30:00Z` was committed at `04:30:16Z` — 16 s later, read as Pacific |
| charmander | `2026-08-22T00:00:00Z` | local, **date uncertain** | `2026-08-22T07:00:00Z` | round midnight placeholder; see *ask-eyes* |
| slakoth | `2026-08-23T02:00:00Z` | local, rounded | `2026-08-23T09:00:00Z` | commit at `08:58:39Z` proves it went out ~01:56 local |
| sunflora | `2026-08-23T12:43:00Z` | local | `2026-08-23T19:43:00Z` | 1m39s before its own reading, 3 min before its commit |
| pmt8ossvc | `2026-08-25T11:12:00Z` | **true UTC** | unchanged | its id encodes `Date.now()` in base36 → `13:14:41.832Z`; read as local the post would post-date its own log entry by five hours |

The file mixed both conventions and the only tell was whether the value carried
milliseconds. `scripts/lib/timestamp.mjs` now owns every conversion, reads the
offset from the zone database (so it does not break when Vancouver goes to
UTC-8 in November), and **refuses to record a timestamp without an explicit
`tz`** — the string cannot tell you which convention produced it, so inferring
would be guessing. It also rejects a future post and a reading dated before its
own post, the two shapes of this bug decidable from data alone.

### Wider than the Arita pair

The remaining readings were taken at **25.02 h, −0.06 h and 0.03 h**. A reading
taken 1.7 minutes after posting was ranked against one taken a day later.
**Every shape comparison this log has ever produced was across unequal ages.**
The law is now enforced where the comparison happens, not stated in a header.

### Knock-on corrections

- **`build-creators-page.mjs` printed "154 views … at a bad hour" on a public
  page.** Both halves came from the withdrawn entry.
- `review.mjs` claimed "a five-times performance difference between two post
  types" — that was 791 views at 25 h against 154 at 0.2 h.
- `log-outcome.mjs` measured how old a post is *now* rather than when it was
  read, and scored the unread Mabosstiff post as **0 views**, bottom of the table.
- `post-queue.mjs` carried the 122× claim in a comment.

---

## JOB 5 — raw views ≠ qualified impressions

`public_metrics.impression_count` counts every impression from anywhere:
replies, non-subscribers, the same account twice, promoted placement. A
**qualified** impression is a unique Home Timeline impression from an X Premium
subscriber with ≥50% of the post visible. Raw views are a strict **superset**,
so they can only ever *overstate* progress toward 500,000.

- Every reading now carries `views` and `qualifiedImpressions` (null until a
  human reads Creator Studio) as separate fields.
- `read-metrics record` **refuses** `--qualified` with `--source api`.
- `verify-work` gained a **monetization miscount** class covering scripts *and*
  docs. Negative-tested: a planted `if (views > 500000)` is caught; it clears.
- Blind spot declared for `read-metrics.mjs`.

---

## JOB 6 — the originality guard

`scripts/originality-guard.mjs`, blocking in the fleet and on the send path.
Four questions, an explicit stored answer required, **no auto-pass**, and a post
with no claim does not ship.

The strongest check is `derivedFrom`: a cited repo path either exists or it does
not. Nine discrimination cases pass — a genuine sourced claim PASSES; "we
cropped a card", a caption restatement, an insight lifted from another account,
a nonexistent file, "describes", and no claim at all all FAIL.

**Running it on real content found two defects in the guard itself:** a greedy
path regex matched `data/card-bios.json.` *including the full stop* and failed a
file that exists; and the restatement check divided by the shorter string, so
the three-word label `"Slakoth 2am coding"` scored 67% against a thirty-word
claim. Also found: `note` is a filing label, not a caption, and **three of the
five logged posts never recorded the copy that actually went out.**

### Retrospective — the strongest honest claim each post can make

Claims marked `cc-retrospective`, which the guard caps at REVIEW on purpose: a
rationale CC invents after seeing the view count is the motivated reasoning the
guard exists to interrupt.

| post | verdict | why |
|---|---|---|
| **Arita pairing** (127.2 K) | REVIEW | Strongest. Cites `data/artists.json`, where `byArtist["Mitsuhiro Arita"]` genuinely links the Celebrations Charizard to the 151 Blastoise ex. Real analysis, sourced from our own catalogue. Only Tyler's confirmation is missing. |
| **Slakoth 2am** (124) | REVIEW | Verified: `card-bios.json` shows the Surging Sparks 2024 Slakoth's attack really is `["Take It Easy"]`. The pun is in the catalogue. Caption was never recorded, so analyse-vs-describe can't be checked. |
| **Sunflora** (93) | REVIEW | Verified: the Twilight Masquerade 2024 lore reads *"it is always looking in the direction of the sun."* Genuine, sourced. |
| **Mabosstiff** (unread) | REVIEW | **Riskiest.** Cites nothing in our data, because nothing in this repo describes what is *drawn* on a card. Not interesting as plain text. Third-party art + overlay + watermark is the excluded pattern almost exactly. |
| **Charmander** (791) | **FAIL** | No honest claim exists. A crop and a mood hook. |

**Your expectation was right, with one nuance:** the single-card crops are the
weakest, but not uniformly. Slakoth and Sunflora are defensible because the
insight is *printed on the card and held in our catalogue*. Charmander and
Mabosstiff are not — and Mabosstiff, the most recent post, is the one whose
originality rests entirely on something no data here can evidence.

**And yes: our best post is our riskiest.** 127,200 views on third-party
copyrighted art with an overlay and a watermark.

---

## JOB 7 — automation compliance

**There was no bypass to remove.** Audited: no `--force`, no `--yes`, no
auto-send, no workflow invoking `post-queue`, and the only X endpoints in the
tree were the OAuth authorize flow. The one automated publish path in the repo
is `send-discord-alerts.mjs`, which targets Discord, not X.

The send gate was built (JOB 3 had not been done) with compliance folded in:

- **Refuses when no terminal is attached** — the load-bearing control. Cron, CI
  and piped stdin all have no TTY. Verified for real, exit 1.
- Requires a PASSing originality claim before it will even print the post.
- Prints the post exactly as it will appear; checks the image exists.
- Asks *"Do you have 30 minutes right now?"*, then requires the word `send`.
  Five-minute timeout on both.
- Records `humanConfirmed`, `confirmedAt` (the keystroke, true UTC), `postedAt`,
  `hourLocal`; runs a visible 30-minute reply window; records `windowHonored`.
- **Drafts nothing.** No code here writes a reply and none ever will.

The policy lives in `scripts/lib/send-gate.mjs` because `post-queue.mjs`
dispatches on argv at import. All **17** possible answers tested — the only two
ways through are `yes` and `send`.

`verify-work` gained an **ungated publication (automation)** class. All three
failure modes negative-tested and caught; baseline clean.

---

## JOB 8 — decision log and pre-mortem

**pre-mortem was not interrogating the new guard at all.** It derived its list
from `guard-audit`'s `MUST_RUN`, which is the daily *publish* pipeline; a guard
on the posting queue is not a pipeline step. Proven inert by deleting the blind
spot and watching nothing happen. It now unions the pipeline list with every
blocking agent in `fleet.mjs` — and immediately caught a real shape in the new
guard: **a verdict from an empty sample.** An empty queue printed almost the
same thing as a clean one. It now prints `NOTHING CHECKED` and says it is not a
pass.

Decision logged (`2026-08-25-originality-over-reach`) with a falsifiable
prediction naming which posts should land on which side, and what would retire
the guard rather than tune it. Check date **2026-10-24**.

---

## Two false positives worth remembering

The automation check flagged `post-queue.mjs` **twice for its own
documentation** — first the comment saying *"there is deliberately no
`--force`"*, then the help text saying the same. It now matches argv actually
being consulted for a flag. **A guard that cannot tell an implementation from a
note about it will train people to delete the notes.**

---

## Could not verify

- **`postToX` has never run.** Sending means publishing to Tyler's account. The
  *signing* is proven — `x-auth.mjs` matched X's published vector and minted the
  current tokens — but the request shape, endpoint and media upload are
  untested. First live send is a test. Queued.
- **Creator Studio eligibility, verified followers, qualified impressions.**
  Invisible from here by design. Queued.
- **The interactive send path.** No TTY in this session, so the prompts
  themselves were never exercised; the policy was tested exhaustively instead,
  and the no-TTY refusal for real.
- **X's actual policy.** The compliance register records Tyler as the reader and
  states plainly that CC did not verify it. The guards enforce *that text*.
- **Which night the Charmander post went out.** Decides whether 791 views were
  read at 25 h or 1 h. Queued.

## Fleet status — 3 blocking failures

- **originality-guard** — the 3 queued posts have no claims. **Working as
  designed.** It prints the command per post; the answers must be Tyler's.
- **verify-work** — 5 problems, all pre-existing: `card-composite.mjs` not in
  the pipeline, 1 pack over $40, 40 unviewed rendered cards, 23 facts on
  secondary sources, `build-promo.mjs` fixed-size text.
- **pre-mortem** — `prompt-correctness.mjs` carries the substring-matching
  shape, unacknowledged. Pre-existing.

## Still open

**JOB 2** (the fetch) is not done. Its premise does not hold: *"All six existing
posts have tweet IDs or can be matched by timestamp."* **None carried a
tweetId.** The only id in existence is the Arita one added from Tyler's URL, and
the first fetch verifies it free by matching `created_at` against
`2026-08-23T04:18:00Z`. The other four need the user-timeline endpoint, which
has different pricing and access from the $0.001 owned-post read.

**JOB 4** (verify-work error classes for duplicate `postedAt` / local-Z /
unequal-age comparison, competence-guard, bias-guard) is not done.
