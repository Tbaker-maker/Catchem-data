# RECOVERY RUNBOOK — what to do when it breaks
*Detection without recovery just means knowing precisely how broken you
are at 2am. This is the other half.*

## FIRST COMMAND, ALWAYS
```
node scripts/recover.mjs check
```
It tells you which of four things is wrong, and — importantly — separates
a DATA problem from a SCHEDULING problem, because the fixes are opposite
and choosing wrong wastes the worst hour to waste.

## THE THREE RECOVERIES

**`recover.mjs regenerate`** — rebuild every artifact from current source.
The right answer when the data looks wrong but the code is fine. Fastest,
safest, fixes most things. Try this first.

**`recover.mjs rollback`** — walk back through history to the last commit
whose artifacts passed every check, and restore those. The right answer
when regeneration also fails, meaning something upstream is producing bad
output. Stashes your local changes first (nothing is discarded — `git
stash pop` brings them back), commits nothing, pushes nothing.

**Neither** — when a stage has gone quiet. A quiet stage means something
did not RUN. No amount of artifact restoration makes a stopped cron start.
Go to GitHub Actions and look at the schedule.

## SYMPTOM → CAUSE → FIX

| What you see | Almost always | Do this |
|---|---|---|
| Numbers look stale on the site | the daily run did not fire | Actions tab; re-run the workflow |
| A price is obviously wrong | a filter change | `regenerate`, then check `rejectionSamples` for that SKU |
| The index jumped with no news | a methodology change leaked in | check `basisChangedOn`; the rebase should have caught it — if not, that is a bug worth a guard |
| A page 404s | a file generated but not deployed | check the deploy mirrors it (this bit us with corrections.html) |
| The app is blank | a frontend error | check the build; nothing in this repo can cause it |
| Everything looks fine but feels stale | check `heartbeat` | if a stage is quiet, the cron stopped |
| Guards failing after an edit | a wire was cut | `guard-audit` names which one and where |

## WHAT RECOVERY WILL NOT DO
- It never touches source code. If a script is wrong, restoring artifacts
  produces correct-looking output from broken code, which is worse than
  the visible failure.
- It never force-pushes or rewrites history.
- It cannot fix a scheduling problem, an image, or a deploy.
- It will not claim success it cannot verify: if the restore does not pass
  the checks afterwards, it says so and exits non-zero.

## THE PRINCIPLE
The repo IS the backup. Every good run is a commit, so "last known good"
is a real point in history rather than a hopeful backup file that nobody
ever tested restoring. This one has been tested: corrupt
`derived-insights.json`, run `check` (fails), run `rollback` or
`regenerate` (restores), run `check` (passes). Verified 2026-08-23.
