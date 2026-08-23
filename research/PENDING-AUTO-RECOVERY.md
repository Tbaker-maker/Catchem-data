# Auto-recovery for a missed run (CC applies — workflow scope)

Tyler, 2026-08-23: *"Ensure that doesn't happen again, and if it does our system
flags it then fixes and reboots it automatically."*

`heartbeat.mjs` now **detects** a missed scheduled run — it knows the 04:00 UTC
schedule and flags a stage whose last check-in predates the most recent fire.
That is the flag. This is the reboot.

## THE WORKFLOW CHANGE
`.github/workflows/watchdog.yml` currently runs the heartbeat and stops. Add:

```yaml
      - name: Heartbeat
        id: hb
        continue-on-error: true
        run: node scripts/heartbeat.mjs

      - name: Re-run the daily job once
        if: steps.hb.outcome == 'failure'
        uses: actions/github-script@v7
        with:
          script: |
            await github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner, repo: context.repo.repo,
              workflow_id: 'update-sealed-prices.yml', ref: 'main'
            })
```

`update-sealed-prices.yml` needs `workflow_dispatch:` in its `on:` block for
that to work.

## ONE RETRY, THEN ESCALATE — NOT A LOOP
**This is the part that matters more than the retry.** A job that failed for a
*reason* — expired credential, provider outage, a bug we shipped — will fail
again, and a system that keeps rebooting it burns budget, fills the log with
identical failures, and **buries the cause under its own noise**.

So: **retry once.** If the heartbeat is still red on the next watchdog run,
**stop retrying and escalate loudly**. Record the retry in
`data/recovery-log.json` so the second watchdog can see one was already tried.

A recovery system that hides a real failure by papering over it is worse than
none — it turns a visible outage into a silent one, which is the same trade the
30-hour window made.

## WHAT TO ESCALATE TO
The digest already generates daily and reaches nobody. **The failure notice and
the digest should go to the same place** — Discord, per
`PENDING-CI-SELF-SUFFICIENCY.md`. A red heartbeat nobody sees is the same
problem one layer along, and that is exactly how this morning happened.

## WHY THE 04:00 RUN FAILED — STILL UNKNOWN
Chat cannot reach the Actions API without auth, which is itself a finding.
**Before wiring the retry, establish what actually went wrong.** A retry on an
unexplained failure is a guess with a schedule.
