# PENDING: the watchdog needs its own schedule (CC applies — workflow scope)
The watchdog is useless inside the pipeline it watches. If the daily run
never starts, a check that runs inside it never starts either. It needs a
SEPARATE workflow on a different schedule.

## The workflow to add — .github/workflows/watchdog.yml
```yaml
name: Watchdog
on:
  schedule:
    - cron: "0 12 * * *"     # 12:00 UTC — eight hours after the daily run
  workflow_dispatch:
jobs:
  watch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - name: Has anything gone quiet?
        run: node scripts/heartbeat.mjs
```
A failing step turns the run red, which GitHub emails about. That is the
alert — no new service, no new dependency, no cost.

## Why the schedule matters more than the check
The watchdog must run on a DIFFERENT trigger to the thing it watches. If
both fail together the alarm fails with the fire. Eight hours after the
daily run is late enough to catch a missed cron and early enough to fix
it before the next one.

## Later, when the bot is on Railway
The bot should call `beat("botAlive")` hourly. Until then that stage
correctly reports as never having checked in, which is honest — the bot
genuinely is not reporting.
