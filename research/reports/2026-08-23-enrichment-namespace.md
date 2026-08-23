# Enrichment ran, and bought the wrong catalogue (2026-08-23)

`node scripts/audit.mjs` → **20/20** · `node scripts/negative-tests.mjs` → **44/44**

## The assumption that mattered was "it worked"

It ran. It did not work, and the failure shape is the dangerous one: **it looks
like success.** Data arrived, the file grew, coverage counters went up.

The run asked for `ex8, pop3, pop4, pop5, mcd19, bp, fut20, ex11 …` — the
densest-by-value sets in our plan. What came back was **Plasma Storm, Plasma
Freeze, Plasma Blast, Prismatic Evolutions and Phantasmal Flames**. Not a subset
of what we asked for. A different list entirely.

**Cause: a namespace collision nothing in the pipeline checked.** Our catalogue
keys sets by the pokemontcg.io slug (`base1`, `sv8`, `ex8`). The provider keys
them by an internal number (`1370`, `23821`). **Zero of our 130 slugs overlap
their ids.** `setId=ex8` does not error — it is silently not honoured, and the
response is billed anyway.

| | |
|---|---|
| credits spent | **9,114** |
| cards delivered | 861, from **5 sets we never requested** |
| cards we paid for | ~3,038 (9,114 ÷ 3) |
| calls that returned nothing | **26 of 31** |
| median card price delivered | **$0.49** — bulk commons |

The plan promised 4,027 of the top 6,000 by value. We received whatever the
provider chose to send. The $0.49 median is the tell: I read it last session as
"the market is mostly bulk", which is true but was not what I was looking at.

## What the data DOES prove — and it is the answer Block 1 asked for

The sample is the wrong cards, but it is 861 real cards with real payloads, so
the coverage question is answered at scale regardless of which cards they are:

| instrument | fill | verdict |
|---|---|---|
| `vol30` (real sales volume) | **97.9%** | works market-wide, not just chases |
| condition ladder (>1 condition) | **98.4%** | works market-wide |
| 30-day return | **99.9%** | works market-wide |
| **180-day return** | **97.0%** | works market-wide |
| `sellers` | 99.3% | works market-wide |
| graded sold (`salesByGrade`) | **35.9%** | chase-biased, as expected |
| `recentSales` | **0.0%** | **arrives on every card and is always zero** |

Two corrections to what I reported last session, both in the honest direction:

- I said the eBay block was present on **51.7%**. It is present on 51.7% and
  **carries actual sales on 35.9%** — 136 cards hold an empty shell
  (`salesByGrade: {}`, `totalSales: 0`). A block that exists and says nothing is
  not coverage.
- I reported the 180-day return as unavailable. **That was my bug, not the
  provider's.** We request `days=180` and receive 179 points; an exact 180-day
  window needs a 181st point that never comes, so the figure came back null on
  100% of cards while the tape sat right there. Fixed with a stated tolerance
  that reports the span actually used. It now resolves on **97%** of cards.

**Block 4, answered:** history is real and deep. Median usable span **178 days**,
minimum 165. Six-month returns across the 835 cards that have them: **median
+18.9%, p10 −14.3%, p90 +72.9%**. RT-1, RT-3 and RT-7 are testable now rather
than in six months — on whichever cards we actually target next time.

**`recentSales` stays dead.** Zero on all 861, as it was on all 12. The
strategist ranks it "critical — arrives on every card and is never read". It
arrives, it is empty, and wiring it through would publish 861 zeros.

## Three defects fixed, each with a test that fails when broken

**1 · The namespace bug.** New `scripts/resolve-set-ids.mjs` fetches the
provider's own `/sets`, joins to our catalogue by normalised name (era prefixes
stripped: `SV: Prismatic Evolutions` → `prismatic evolutions`), and writes
`data/ppt-set-map.json`. Verified offline against the five sets we already hold
ids for: **4 of 5 join correctly.** The fifth, Plasma Freeze, does not match
because **it is missing from our 130-set catalogue entirely** — which is why the
resolver also reports the reverse gap. Enrichment now **refuses to spend at all**
without the map.

**2 · The pacing bug, and it was mine.** I paced 1,000ms per call on the belief
that the limit is 60 calls a minute. For this query it is not: `fetchAllInSet`
costs `min(30, ceil(cards/10))` **units** of a 60-unit minute. Our sets average
~28 cards, so each call cost ~3 units — a real ceiling near 20 calls a minute,
overrun threefold, hence the 429 with **8,865 credits left unspent**. Replaced
with a rolling-window reservation priced per set. A per-minute 429 is now a
pause that resumes; only a daily 429 ends the run.

**3 · The 166 MB file.** Untracked and **not gitignored** — the next `git add -A`
would have put it in history permanently, against a repo whose entire `.git` is
83 MB. At catalogue scale it is ~3 GB. Now ignored and regenerable, with
`scripts/distil-enrichment.mjs` writing the **2.2 MB** file the instruments
actually read — 79× smaller with every instrument intact.

Also fixed: the run now **resumes** instead of re-buying (keyed on the requested
id, not the returned one — keying on the response matched nothing), stops after
**two consecutive billed-but-empty calls** rather than 26, and `planOnly` no
longer crashes when imported under `node -e`.

## The strategist's self-test, rewritten rather than silenced

"API strategist does not read itself" went red. Its assertion was
`critical > 0`, used as a proxy for "the walk still works" — and it failed
because the walk started working *better*: `vol30` is genuinely consumed by
compute-demand now, and the rest are read by the distiller, so the critical
count legitimately fell to zero. A test that fails when the codebase improves
trains people to ignore it.

It now proves the walk directly: plant a field in the WORTH map that nothing
reads, and require the strategist to find it. The first version of that test
failed too — because the canary's name appeared in the test file, and the
strategist scanned it and called the field "used". **The guard's own test
reproduced the self-read bug the guard exists to catch.** The name is now
assembled at runtime so the literal exists nowhere on disk.

## Needs Tyler — two commands, in this order

The key still is not visible to my shell (not in process env, not User scope,
not Machine scope), so these need your hands. **Do not skip the first:**

```bash
node scripts/resolve-set-ids.mjs
```

```bash
node scripts/enrich-by-set.mjs
```

The first is cheap and buys the map. The second now refuses to run without it.
Expect ~17,900 credits, ~11 minutes, and — this time — the sets we asked for.
Worth checking the dashboard for the real remaining balance first: our 9,114 is
*our* accounting of a run where 26 of 31 calls returned nothing, and I do not
know what the provider actually charged for those.

## Roads not taken
- Did not re-run enrichment to spend the remaining ceiling. Spending more
  through the same broken path buys more of the wrong catalogue.
- Did not enumerate `/sealed-products` (Block 3) — same key, and it should
  follow the map, not race it.
- Did not hand-merge the five delivered sets into the targeted plan. They are
  real data and they stay; they are simply not the sample we chose.

## Uncommitted / unverified
- **The set map does not exist yet.** The join is verified against 5 provider
  sets we happen to hold; it is unverified against the full `/sets` response,
  and I do not know how many of our 130 slugs will match.
- `/sets` cost is unconfirmed. It appears in no documented cost list, which is
  why the waste detector excludes it — but "probably free" is not "free".
- The 861 cards in `data/enrichment-distilled.json` are a **found sample, not a
  chosen one**. Nothing published should describe them as catalogue coverage.
- `compute-demand.mjs` now reports 857 liquidity rows and **0 concentration
  rows** — not a bug: bulk commons run under 3 listings per seller, which is the
  threshold. It will populate when the sample is the top of the market.
