# SELF-SUFFICIENCY — the two gaps (CC applies; workflow scope)
Verified 2026-08-23: the fourteen agents run on GitHub's servers via the
04:00 UTC cron in `update-sealed-prices.yml`, which calls
`generate-pulse.mjs`, which imports all of them. **Tyler's machine is not
involved and does not need to be on.** That part is already right.

Two gaps remain, and both are the same shape: the system is autonomous
until something goes wrong, and then it is silent.

## GAP 1 — the watchdog is not scheduled
`scripts/heartbeat.mjs` exists and works. Nothing runs it.
Every guard we own runs INSIDE the daily job, so a job that never starts
fires none of them. The watchdog is the only check that can see absence —
and it currently only runs when somebody runs it by hand, which is exactly
the dependency we were trying to remove.

Add `.github/workflows/watchdog.yml`:
```yaml
name: Watchdog
on:
  schedule:
    - cron: "0 12 * * *"     # eight hours after the daily run
  workflow_dispatch:
jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: node scripts/heartbeat.mjs
```
**It must be a SEPARATE workflow on a DIFFERENT trigger.** An alarm inside
the fire is not an alarm — if both fail together, the alert dies with the
thing it was watching.

## GAP 2 — a red run tells nobody
GitHub emails the repo owner on a failed scheduled workflow, which is
something, but it depends on that email being seen. Two cheap improvements:

1. **Post the digest to Discord on success.** The agents write
   `research/pulse/agent-digest.md` every morning and nothing delivers it.
   Tyler currently reads it only if he opens the repo — which makes the
   whole fleet dependent on him remembering to look.
2. **Post a short failure notice on failure**, naming which step died.
   `if: failure()` already appears four times in the workflow; extend one
   to send the step name rather than staying inside the run log.

## WHAT WOULD STILL NEED A HUMAN AFTERWARDS
Being honest about the ceiling: even fully wired, this notices and reports.
It does not fix. A failed fetch, an expired credential, a source that
changed shape — all of those still wait for somebody. Self-sufficiency here
means "runs and tells you", never "runs and handles it", and describing it
as the second thing would be the kind of overclaim we do not make.
