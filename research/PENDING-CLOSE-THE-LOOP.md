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
1. X developer account, OAuth tokens with read + write on Tyler's account.
2. Wire `--send` in `post-queue.mjs` to store the returned tweet id.
3. Wire a fetch that calls `read-metrics.mjs due`, reads each id's public
   metrics, and calls `record`.
4. Cron it hourly. It does nothing when nothing is due.

**Once that runs, every rule in `house-theses.md` about what works becomes
testable instead of asserted** — and `experiment.mjs` starts receiving real data
rather than waiting for it.
