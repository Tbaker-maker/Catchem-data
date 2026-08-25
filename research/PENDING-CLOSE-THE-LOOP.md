# Close the loop (CC) — the highest-value thing left

Tyler, 2026-08-24: *"Wait this is a flaw no? How will you know what posts do
well and don't?"*

**He is right, and it is the load-bearing flaw.** Every finding in this project
rests on **five posts he typed in by hand**, and every account profile came from
a search snippet or a write-up he pasted. Nothing has ever been read directly.

## THE LOOP TODAY
| | |
|---|---|
| generate a post | yes |
| send it | built, needs credentials |
| **see how it did** | **NO** |
| **learn from that** | **NO** |

`experiment.mjs` and `log-outcome.mjs` both wait for somebody to type numbers
in. **That is not a feedback loop, it is homework** — and homework does not get
done by a man with two jobs and two young children, which means the data stays
at five posts forever and every rule we have written stays an opinion.

## WHAT IT COSTS
**$0.001 per OWNED read.** We do not need to read the platform, only Tyler's own
posts. Sixty posts a month, checked three times each, is **eighteen cents**.

**And it is the same credentials the posting queue already needs** — one
integration closes both ends.

I priced writes when we built the queue and never priced reads. Answering the
question asked instead of the one that mattered.

## WHAT IS BUILT AND WHAT IS NOT
`scripts/read-metrics.mjs` handles everything except the API call itself:
- `due` — lists what needs reading now. **This is what a cron calls.**
- `record --tweet ID --views N --likes N --replies N --reposts N` — files it,
  computes reply-to-like, and at 48h **writes into the outcome log
  automatically**.

**Three readings per post, at 1h, 24h and 48h.** Views climb for days — age was
the second confound that caught us — so a single reading says nothing about a
settled post. The 48h one is the one that counts.

**The fetch is deliberately NOT in here.** CC holds the keys, and keeping the
two halves separate means a fetch failure cannot corrupt the record.

## WHAT CC NEEDS TO DO

**STATUS 2026-08-25: 1 and 3 are done, 2 and 4 are not.**

1. ~~X developer account, OAuth tokens with read + write on Tyler account.~~
   **DONE.** All four credentials in .env, minted via scripts/x-authorize.mjs,
   proven live by a signed GET to /2/users/me returning 200 as @LongedEth.
2. Wire `--send` in `post-queue.mjs` to store the returned tweet id.
   **STILL OPEN.** The code is written and the signer beneath it is proven,
   but it has never run: sending publishes to Tyler account and that is his
   keystroke, not CC own.
3. ~~Wire a fetch that calls `read-metrics.mjs due`, reads each id public
   metrics, and calls `record`.~~ **DONE.** `read-metrics.mjs fetch`, sharing
   one `dueReadings()` with `due` and shelling out to `record` per post so the
   two halves stay separate processes. 34 offline checks cover every branch,
   including the two that protect the data: a deleted post returns HTTP 200
   with an errors array and no data, and a post whose public_metrics arrives
   without impression_count must not be recorded as zero views.
4. Cron it hourly. It does nothing when nothing is due.
   **STILL OPEN, and deliberately not done by CC.** CLAUDE.md forbids changing
   Actions schedules or triggers without asking Tyler first.

**WHAT IS STILL UNPROVEN.** No post has ever been sent, so no post has ever
been fetched. Signing is proven and every branch is covered offline, but the
first fetch against a real post is a test, not a routine run.

**FOUND WHILE WIRING THIS (2026-08-25).** The 48h auto-promotion had never
once worked. `record` invoked `log-outcome.mjs --at <iso>` with no `--tz`, and
`resolvePostedAt` refuses to guess a zone — correctly, after five of six rows
in post-outcomes.json turned out to be Pacific wall clocks wearing a Z. Every
48h reading therefore exited 1 with an unhandled child-process error, having
already written the reading but never the outcome row. Fixed by passing
`--tz UTC`, which is honest rather than convenient: post-queue.mjs writes
postedAt from a machine clock. **The self-filling outcome log was the entire
point of the 48h checkpoint, and it was silently broken.**

**Once that runs, every rule in `house-theses.md` about what works becomes
testable instead of asserted** — and `experiment.mjs` starts receiving real data
rather than waiting for it.
