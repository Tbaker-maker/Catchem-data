# Nightly failures, Sep 25 to Oct 26 2026

Scope: every failed or cancelled run of `update-sealed-prices.yml` (63) and
`nightly-precheck.yml` (4) from Sep 25 to Oct 26 2026, read from `gh run list`
and each run's failed log. Run 40272030580 was still in progress and is not
counted. Over the same window `pr-tests` failed 50 of 77 runs, mostly on the
freshness checks in cause 5.

Only 1 nightly fully succeeded in the window. Prices were committed on many red
nights (the price commit sits before most failing steps), but the public data
branch went stale whenever a failure came before the publish step. The longest
stretch was Oct 23 to Oct 26.

## Cause table

| # | Cause | Runs | Root fix | Guard |
|---|-------|------|----------|-------|
| 1 | One reads or feature test fails, and the fail-fast unit test step stops the whole run before any fetch (fact-reads window path, board determinism, deep-reads family and one third, held rows, market meter, track record, sparks, condition ladder) | 19 | This PR. Tests are sorted into tiers (`scripts/lib/test-tiers.mjs`). Price safety still blocks. A reads or feature failure only withholds that group's public files, which go back to the last committed copy before the feed commit and the publish. Prices still fetch, commit and publish. Unknown tests block (fail closed). | `test-tiers.suite.mjs`: a reads failure withholds reads and prices publish; a price safety failure blocks; a copy rule or sealed condition label failure blocks even inside a reads suite; an unknown test blocks; a runner crash blocks |
| 2 | Reads tests were bare imports that called `process.exit(1)`, so one of them killed the runner before its summary line and no one could tell which group failed | (inside 1) | This PR. `read-facts`, `item-reads`, `read-thin-data`, `reads-guard` and `read-synthesis` run as child processes with named results. | `a reads subprocess failure withholds reads`; a log with no summary line blocks |
| 3 | Data timing: tests compared committed files built on different days (set value vs set pages, catalogue map vs a new TCGCSV day, partial print vs catalog day), and a rebuild step that failed stopped the run | 6 | Rebuild before tests already existed (Oct 13). This PR makes every builder in that step run and log its result, so the tests see tonight's files, and a builder failure is triaged like a test: price page builders block, feed and feature builders withhold their group. | `a feed builder failure withholds reads`, `a price page builder failure blocks`, `a missing rebuild log blocks` |
| 4 | A builder crash after the price commit (`cooledSet is not defined` in build-feed, 3 runs) stopped the run before the publish | 3 | This PR. The late `build-feed.mjs` step withholds the reads group on a crash instead of failing the job. Only a named group can be withheld; anything else still fails. | `a later feed crash withholds reads instead of stopping the publish` |
| 5 | Freshness deadlock: the test "reader files are within 2 days of the nightly date" and the feed age check fail when main is stale, and only the nightly can make main fresh. The same checks turned every crew PR red whenever main was stale | 4 nightly, most of the 50 PR failures | This PR. Main's own freshness is a monitor tier: reported in the summary and the issue, never blocking the nightly or a PR. `artifact-freshness.mjs` runs on pushes to main only, not on pull requests. The publish side of the deadlock (feed age checked before the feed is rebuilt) was fixed in #430. | `main's freshness never blocks the nightly`, `never blocks a pull request`, `a real failure next to a freshness one still blocks`, `artifact freshness runs only on main` |
| 6 | Pre-check ran the tests on committed files without a rebuild and failed on main's staleness, opening a new issue each night | 4 | This PR. Pre-check uses the same tiers in nightly mode and fails only when tonight's prices would be blocked. It updates the one nightly issue instead of opening a new one. | `the pre-check uses the same tiers` |
| 7 | Queued and rerun nightlies tested the commit they were queued on, so a fix merged while they waited did not apply | (seen Oct 23 to 26, 2 cancelled) | This PR. Checkout uses the branch tip (`github.ref_name`) at run time. | `the nightly checks out the branch tip` |
| 8 | Guard audit found 2 safeguards that existed but were not wired in | 10 (Sep 28 to Oct 2) | Fixed then by the guard audit preflight patch. Correct behavior: a disconnected safeguard should block. | Guard audit also runs on every PR |
| 9 | Morning Pulse and smoke test guards (memory and schema guards, share button checks) | 11 | These steps run after the publish, so prices were already live on those nights. Left as is: they are real checks on their own output. | Existing step checks |
| 10 | Publish ENOBUFS: the reads receipts were too large for the git buffer in the publish step | 2 | #421 moves the receipts to a side file. #421 is still open; it needs to merge. `publish-public-data.mjs` is not edited here. | #421 test |
| 11 | Push rebase conflicts between two writers of the same data files | 2 | Concurrency group already serializes price runs (Oct 15). Remaining conflicts came from the listing counts job writing the same files. Not changed here. | Existing conflict resolver |
| 12 | eBay fetch errors (429 rate limit, invalid Insights scope) | 3 | eBay outages are already non-blocking for most products. The Insights scope stays off until the eBay app has it (PR #64). | `ebay-nonblocking.test.mjs` |
| 13 | Other one-off step bugs (banned word in the track record stub, TCG news fetch, workflow flag count test) | 3 | Fixed at the time. | Their own tests |

Counts add to more than 67 because some runs had two causes.

## What blocks and what withholds now

Blocks (no fetch, no commit, no publish):
- price trust, listing sample, index math, price sanity, set source groups,
  search and every test not named in a group
- any failing test whose name is about copy rules, sealed condition labels,
  NM, private values, creator names, sold wording, advice wording, or
  invented values, wherever it lives
- a test runner that stops before its summary line
- a price page builder failing in the rebuild

Withholds (prices still publish; the group keeps its last committed copy):
- reads: reads.json, today.json, reads-preview.json, signal-chips.json,
  feed/item-reads, feed/read-synth.json, feed/extra-reads.json,
  feed/read-library.json, feed/lead-order.json, feed/facts, feed/today
- set value pages, track record, loose card condition prices, market meter,
  IR and SIR watch, 30 day sparklines, supply lists

Monitor only: main's own artifact freshness.

On a pull request everything except freshness blocks, so PRs still have to be
fully green on their own code.

## Reporting

`scripts/triage-tests.mjs` writes `data/derived/test-triage.json` and a plain
run summary: whether prices published, what was withheld and which tests
failed. `scripts/nightly-issue.mjs` opens or updates one issue named
"Nightly price run: tests blocked or withheld" and closes it on the first
clean night.
