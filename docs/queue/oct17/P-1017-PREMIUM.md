# P-1017-PREMIUM · Premium no-brainer block

**PASTE INTO: one Grok Build chat (works across Catchem-data, catchem-site and catchem-bot). Runs as MASTER job 16, after jobs 1 to 15.**

```
FOR: Grok Build (all repos) · P-1017-PREMIUM · Oct 2026

NOTE: ignore if already received. Read Catchem-data docs/queue/oct17/PROGRESS.md first. Skip any PM job already marked SHIPPED or SKIPPED there and resume at the first one that is not. Start only after MASTER jobs 1 to 15 are SHIPPED, SKIPPED or BLOCKED.

Start from latest main of the repo each job names. Before each job, check merged PRs in that repo and skip work that is already done. Read existing Premium, drops, watchlist, Stadium and First 222 code before you build and reuse it.

GOAL: make Premium ($14.99) pay for itself. Free tools show what is happening. Premium gets something concrete first.

DO NOT TOUCH: live Stripe prices, products or plans, any live Stripe setting, payments and checkout flows beyond the flagged trial code in PM2, secrets, Discord roles or permissions, repo settings, branch protection, the price math, the listing counters and their eBay budget, scanner gates, the First 222 price lock terms, or any file a job does not need.

SAFETY RAILS (always, every job):
- Only merge when every check passes. Run the full test suite before every merge.
- Each PR changes one thing, stays small, and is easy to revert.
- Every new feature ships behind a config flag that defaults to off, unless the job says otherwise. Leave flags off; Tyler turns them on.
- Never force-push. Never delete a branch you did not make. Never edit secrets or repo settings.
- Workflow edits are allowed, but keep them small, tested, and limited to the files the job needs.
- If main goes red after your merge, revert that PR first, then continue.
- No data deletions without a backup copy committed or saved first.
- Stripe work uses test mode only. Never create, edit or archive a live price or product.
- No Discord message posts to a channel or DM a real member during build or tests. Use dry-run or a test guild.
- After every catchem-site PR, check the live site still loads /, /sets, one /c/ page, one /p/ page, /post-office and /premium at 390 and 1280 wide with no console errors. If any fail, revert.
- Show a real number or hide it. Never show a placeholder, a zero that means missing, or a made-up figure.
- If unsure, skip and log. Never guess.
- Zero extra eBay calls. No new paid services.

PRE-APPROVED WHEN BLOCKED (never stop to ask): if a job needs a secret, a setting, a person, or a decision you cannot make, mark it BLOCKED in PROGRESS.md with one line on exactly what Tyler must do, then go to the next job. Same for any job that fails twice.

PROGRESS: after every job, update the same Catchem-data docs/queue/oct17/PROGRESS.md under a heading "P-1017-PREMIUM" with: job ID, repo, SHIPPED / SKIPPED / BLOCKED, PR number, merged SHA, one line on what changed, and one line on what is left. A fresh chat must be able to resume from this file alone.

JOBS (in order, one small green PR each, merge before starting the next; split a job into per-repo PRs when it spans repos):

1. [catchem-site + Catchem-data] PM1 · "You'd have saved $X" line. On every drop card and drop page, show "You'd have saved $X" where X = our dated market price minus the drop price, from the same dated price files the site already reads. On the Premium page, show the total saved across this month's drops ("Premium members could have saved $X this month"). Hide the line when the market price is missing, older than 7 days, or the saving is zero or negative. Show the price date next to it. Flag: SHOW_SAVED_LINE (default on is fine only if every shown number is real; otherwise off).
2. [catchem-site] PM2 · 7-day Premium trial. Add trial support in code using Stripe's trial_period_days on the subscription or checkout session, behind flag PREMIUM_TRIAL_ENABLED=false. Test mode only. Never change live prices or products. One trial per Discord account. Watchlist alerts default to on for trial users. Show the trial end date and a clear cancel path. If Stripe is not live yet, ship the code dark and mark the go-live step BLOCKED for Tyler.
3. [catchem-bot + Catchem-data] PM3 · Premium instant watchlist alerts. For Premium and trial members, send a Discord DM when an item on their watchlist has a price move past their threshold (default 10%), listings gone past a threshold, or a restock. Built from the nightly and intraday data we already have; zero extra eBay calls. Rate limit: max 10 DMs per member per day, batched. Respect DM opt-out. Free users keep the daily read only. Flag: PREMIUM_ALERTS_ENABLED=false.
4. [catchem-site] PM4 · Premium depth gate. Premium gets full chart history, the per-card read, and Rip value on sealed. Free gets price plus listings counted, and a 30-day chart. Gated sections show a short "Premium" panel with one line on what it adds, never a broken or blank block. Flag: DEPTH_GATE_ENABLED=false. Do not remove any data free users see today until the flag is turned on.
5. [catchem-site + catchem-bot] PM5 · Live Stadium pool. Show the current Stadium pool size on the Premium page and in a Discord command, from the existing pool source. Show "Premium members are auto-entered in every draw." Show the pool date. Hide if the source is missing. Use the current pool percent from config; never hardcode 33%.
6. [catchem-site + catchem-bot] PM6 · First 222 "still standing" count. Show "X of 222 still standing" on the Premium page and in Discord (command plus optional pinned message update, dry-run by default), from the existing First 222 member source. The count only goes down. Hide if the source is missing. Do not change First 222 terms or roles.

HOUSE COPY RULES (all user-facing text): no em dashes. Never use buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words. Say listings counted, never supply alone. Listings that disappear are listings gone, never sales. eBay counts are Near Mint only. NM is for singles only, never on sealed. No creator names. Every number comes from a dated file. Empty sections hide. Never scrape against a site's terms or get past a bot block. Never use Collectr prices. No buying or checkout bot. Plain short sentences, no filler.

KEEP GOING: after each merge, update PROGRESS.md and start the next job right away. Do not stop to report between jobs.

BONUS (only if usage is left, after PM6): PM7 "Premium paid for itself" monthly DM draft per member (saved total from PM1, written to a draft file, never sent). PM8 a free-vs-Premium comparison table on /premium built only from features that are live. Merge each as its own small green PR, flags off.

DONE MEANS: every PM job is SHIPPED, SKIPPED with a reason, or BLOCKED with the exact Tyler step in PROGRESS.md; every merged PR was green; every new flag is listed in PROGRESS.md with its default; no live Stripe price or product changed; main is green in all three repos; the live site still loads its key pages at 390 and 1280.

REPORT in ONE fenced block that starts with the ID:

P-1017-PREMIUM | jobs shipped / skipped / blocked | each PR # with repo and merged SHA | flags added and their values | final SHA per repo | what Tyler must do
```
