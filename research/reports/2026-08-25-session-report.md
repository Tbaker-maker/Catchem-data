# Session report — 2026-08-25

Four things landed: the search layer, the connecting-art ingestion, the metrics
loop, and a guard against logs that lie. Every claim below says what was
verified and how. **Nothing tested only in a sandbox is called verified.**

---

## THE FULL FLEET

Run at the close of the session. **6 ok · 5 with findings · 2 blocking.**

| agent | blocking | result |
|---|---|---|
| verify-work | **yes** | ✗ 5 problems |
| pre-mortem | **yes** | ✗ 1 guard not interrogated |
| competence-guard | yes | ✓ 11 specialists, all with declared blind spots |
| originality-guard | yes | ✓ PASS pmt8zygtt |
| search-gauntlet | **yes** | ✓ 5,038 checks · 16,468 cards · 3,607 relations verified |
| designer | no | ✗ 1 high · 10 medium · 1 low |
| bias-guard | no | ✗ 2 problems |
| decision-audit | no | ✓ 14 logged, 0 due |
| theme-scout | no | ✓ 297 finds |
| outcome-report | no | ✓ 4 settled of 5 · 3/9 readings from the API |
| ask-eyes | no | ✗ 35 open, 30 waiting over a week |

### The two blocking failures, in full

**verify-work (5):**
1. 2 card generators not in the pipeline — `card-composite.mjs`, `card-relations.mjs`
2. 1 single pack priced above $40
3. 44 rendered cards exist that nobody has looked at
4. 23 facts rest only on secondary sources
5. `build-promo.mjs` draws fixed-size text onto a variable-width canvas

**pre-mortem (1):** `prompt-correctness.mjs` carries the "substring where
structure exists" shape, unacknowledged. Pre-existing; it flagged
`verify-work.mjs` for the same shape earlier today and that one is fixed.

### The advisory finding worth reading

**bias-guard, high:** *Tyler catches 19 of 26 incidents; the machines catch 7.*
Every guard here was written by the party being checked. That ratio has not
improved despite a large number of guards being added today — and today is a
data point for it, because the two most valuable findings of the session were
both caught by Tyler asking a question, not by a guard firing.

### Two fleet defects found and fixed during the run

- **outcome-report was listed as CRASHED.** It was working perfectly and exiting
  0. The fleet decides an agent's status from its verdict line and
  outcome-report printed a report without one. A roster that says CRASHED about
  a healthy agent is the same class as a success line that does not measure what
  it wrote: green, and describing something other than what happened.
- **decision-audit rejected the day's decision entry** — no prediction, no check
  date. The fields it grades are `predicts` and `checkAfter`; I had written
  `checkBy`. A decision that cannot be graded is a note.

### Blind spots declared or reviewed today — 11 of 54 guards

`read-metrics` · `search-gauntlet` · `outcome-report` · `originality-guard` ·
`fuzz` · `surface-parity` · `prompt-audit` · `env-matrix` · `save-paths` ·
`user-journeys` · `hook-guard`

Three are new this session:

- **search-gauntlet** — tests that relations are true in OUR CATALOGUE, never
  that our catalogue is true. A wrong artist credit in `card-catalogue.json`
  passes every assertion and ships as a verified-looking sentence.
- **outcome-report** — reads outcomes, never causes, and cannot see qualified
  impressions or any post that did not go through the queue.
- **read-metrics** — measures raw views, not monetization-qualifying
  impressions, and can only read posts the queue knows about.

---

## 1. THE EDITOR SHIPPED 6,725 OF 16,468 CARDS

`build-editor.mjs` filtered the index to hero rarity or price ≥ $8. Both Magmar
cards from the post that shipped that evening were absent — `neo1-40` is an
Uncommon at $4.60, `sv9-20` a Common at $0.25. **The pairing that went out could
not have been built in the editor.** The build log printed
`16,468 cards searchable` the whole time: the catalogue size, not the artifact.

Two further faults sat underneath it. The query matcher tested one contiguous
substring, so `magmar kimura` could not match `Magmar Naoyo Kimura Neo Genesis`.
And the fix for that shipped as `split(/s+/)` — the backslash eaten by the
template literal — which split the query on the **letter "s"**. `arita squirtle`
worked and `magmar kimura` did not, and they looked like unrelated bugs.

**Verified:** against the shipped artifact, not the source. `search-gauntlet`
lifts the matcher out of `build.html` and runs 5,038 checks against the 16,468
rows that actually shipped. Testing `build-editor.mjs` would have passed both
faults, because the source was correct in each case and the emitted file was not.

**NOT verified — and this one is load-bearing.** The filter was **not** a
page-weight preference. `c6ed73e` introduced it on 2026-08-24 as a **mobile crash
fix**: at 4.49MB the inline script killed mobile Safari and Chrome, taking
photos, moods and angles down together. The fix brought the page to 2.14MB.

```
4.49MB  before the fix     crashed phones
2.14MB  the fix
2.00MB  before my change
3.18MB  after my change
3.00MB  now, tail trimmed
```

I measured only the gzip transfer delta (+201KB) and treated that as the answer.
Gzip is not what broke mobile Safari; parsed inline script size is. **No phone
has loaded the current page.** 3.00MB sits between the 2.14MB known to work and
the 4.49MB known to fail, and nothing in this repo can say which side of the line
it falls on. Logged as `2026-08-25-full-index-vs-mobile-crash`, status
**PROVISIONAL**, `checkAfter` 2026-09-01, to be checked by Tyler on his own phone.

---

## 2. CONNECTING ART — 269 GROUPS, 129 COMPLETE

Ingested from two Bulbapedia pages, revisions read from the MediaWiki API rather
than assumed: combined `4616206` (2026-08-20), narrative `4569689` (2026-06-09).
Kept as distinct relation types throughout, because one image split across cards
and a story continued across cards are different things and merging them
produces wrong captions.

**Verified by eye, not by metadata.** A full-card composite cannot prove artwork
joins — every card puts a border, a name bar and a text box between one art
window and the next, so nine correct cards and nine wrong-order cards are
indistinguishable in that image. I rendered the HYOGONOSUKE 3×3 as full cards
first and could not tell. `scripts/seam-check.mjs` crops to the art windows and
abuts them:

- **HYOGONOSUKE**, 5 sets — the waterfall runs from Mime Jr. straight down into
  Magikarp's pool, the river carries into Palossand's beach, the cliffs continue
  into Gligar, the shoreline runs into Horsea's sea. One continuous landscape.
- **Teeziro**, 5 sets — a cross-section: sky and surface, then ground, then cave
  and seabed. The lava vein, rock strata and waterline all continue.

Both orders correct. Proofs at `research/pulse/cards/seam-*.png`.

**NOT verified:** every other complete group. `seam-check` uses modern SV/SWSH
window geometry; older frames sit differently, so both buildable Naoyo Kimura
trios — the ones the interesting series is built on — have **not** been
seam-checked.

### The partial breakdown, and why 48% understates it

379 cards did not resolve. They split three ways and only one is a real limit:

| cause | cards | closable? |
|---|---|---|
| number mapping — the set IS in our catalogue | 61 | yes, a bug in my resolver |
| English sets never ingested | 219 | yes, all on pokemontcg.io |
| Japanese-only printings | 99 | no — English-only is a locked directive |

```
129 / 269  complete today                       48%
155        after fixing the number mapping      58%
235        after also ingesting English sets    87%
 34        blocked by English-only              13%
```

**74% of the losses are recoverable.** The feature is 87% achievable, not 48%.
Worst-hit sets: Furious Fists 35, Skyridge 25, Southern Islands 18. Recorded
under `coverage.whyPartial` so it is queryable rather than stranded in a chat.

**Licensing is not decided.** Bulbapedia is CC BY-NC-SA 2.5 and we are building
toward a monetized account. Facts recorded, source and revision cited, no prose
or images copied. Queued for Tyler as `connecting-art-53`. **Nothing from this
data has been posted.**

---

## 3. THE METRICS LOOP CLOSED

`grep -c '"source": "api"' data/post-outcomes.json` returns **3**. It was 0 for a
week. Settled posts went **1 → 4**.

The fetch was never broken — it had nothing to read. `dueReadings` selects
`status === "sent"` with a `tweetId`, and the queue held none, so it correctly
reported "nothing due" every time it ever ran. The five posts were logged by hand
and never went through the queue.

**Verified against the live API.** 966 tweets pulled across 2026-08-21..26 by
pagination, matched on text and corroborated by time. All five matched; none
guessed. Dry run listed 4, all HTTP 200; the real run recorded 4 and merged 3.
Post count stayed 5 — no duplicates.

Three defects were invisible until the loop had input:

1. `log-outcome` **always pushed a new post**, so promoting a reading for a post
   already logged would have created a second row for the same tweet. Now merges
   on tweet id. `record` also now passes `--source`, without which every API
   reading would have been filed as `manual`.
2. `due` asked for a **1h reading on an 85h-old post**. `record` files by nearest
   checkpoint, so that reading would file as 48h, leaving 1h unfilled and the
   post due forever at $0.001 a run.
3. Two writers reached the outcome log and only one stamped a checkpoint, so
   every promoted reading was invisible to "is this settled?" — the report said
   1 settled while three 48h readings sat there unlabelled.

**NOT verified:** the send path. `post-queue.mjs --send` has still never run
against the live endpoint. Reading is proven; posting is not.

### The gap is now visible

"nothing due for a reading" read identically whether everything was measured or
nothing was measurable, and the second was true for a week. Four states, four
messages, each verified by forcing it:

```
empty queue    nothing has been written, so nothing can be read
none sent      0 sent, so there is nothing to measure. This is a GAP
sent, no ids   carry NO tweet id, so none can be read. This is a GAP
healthy        all 5 readable post(s) are current, 4 settled at 48h
```

---

## 4. THE THREE TIME DEFECTS, SETTLED FROM created_at

`created_at` is authoritative true UTC. All three resolved against it.

| post | recorded | true | out by |
|---|---|---|---|
| slakoth | 09:00:00Z | 08:52:33Z | −7 min |
| charmander | 07:00:00Z | 06:52:31Z | −7 min |
| pmt8ossvc | 11:12:00Z | 13:12:26Z | **+120 min** |

- **Slakoth's reading at −0.06h was never a reading before its post.** `postedAt`
  had been rounded *up*; the true time puts the reading at **+0.07h**. A 7½-minute
  rounding made a reading appear to precede the post it measured.
- **pmt8ossvc was out by two hours**, `hourLocal` 4 → 6. The id-decode reasoning
  in its own `tzNote` reached 13:14:41Z and was very nearly right; the stored
  value was simply wrong.
- **Charmander is a 25h reading, not 1h** — 25.14h against the true post time,
  settling the question from commit `2cecfb5`. Its `hourLocal` also moves 0 → 23:
  posted late on the 21st, not at midnight on the 22nd.

Charmander and slakoth were both out by the *same* 7½ minutes, which is what
hand-rounding to the quarter hour looks like.

**Verified against the live API** for all five posts.

---

## WHAT IS STILL UNVERIFIED

Collected here so it cannot be missed:

1. **The editor on a real phone.** 3.00MB of inline script, against a device
   class that crashed at 4.49MB. The single most important open item.
2. **The blank-canvas fix on iOS.** Passes in simulation; no iPhone has run it.
3. **Every complete connecting-art group except two.** Vintage frames need their
   own seam geometry.
4. **The send path.** Reading is proven against the live API; posting is not.
5. **Bulbapedia licensing** against a monetized account — with Tyler.

## THE NUMBER THAT STILL GOVERNS

Four settled posts. The equal-age guard **refuses** the reach-versus-density
comparison because 85h, 59.8h and 48.2h are not comparable ages, and it is right
to. Five of five hypotheses remain STILL OPEN.

There is one thing worth watching and not yet claiming: the Arita pairing shows
0.27 replies per thousand views against Charmander's 16.15 — a 60× difference,
inverse to reach. That is a reason to run the test, not a result.
