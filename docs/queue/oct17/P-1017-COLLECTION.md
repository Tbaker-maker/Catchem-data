# P-1017-COLLECTION · Collection check block

**PASTE INTO: one Grok Build chat (works across Catchem-data, catchem-site and catchem-bot). Runs as MASTER job 17, after job 16 (P-1017-PREMIUM).**

```
FOR: Grok Build (all repos) · P-1017-COLLECTION · Oct 2026

NOTE: ignore if already received. Read Catchem-data docs/queue/oct17/PROGRESS.md first. Skip any CC job already marked SHIPPED or SKIPPED there and resume at the first one that is not. Start only after MASTER jobs 1 to 16 are SHIPPED, SKIPPED or BLOCKED.

Start from latest main of the repo each job names. Before each job, check merged PRs in that repo and skip work that is already done. Read the existing matcher, price files, eBay ask files, listing-counts files, Premium gate and flag config before you build and reuse them.

GOAL: "Collection check." A user uploads their own collection list. We show which items look valued low (when selling) and the fair value of a lot (when buying), priced only from our own dated sources, with evidence and confidence.

HARD RULES FOR THIS BLOCK:
- Never use Collectr prices as our source. A price column in an upload is only shown as "your file says" and is never used to compute our value.
- Never read, fetch or parse a Collectr URL or any Collectr page or API. Reject pasted Collectr links with a short note to upload a CSV export or screenshots instead.
- Never scrape any site. Sources are only: TCGplayer data we already store (tcgcsv), our stored eBay asks (Near Mint, cached nightly), our listing-counts history. Zero extra eBay calls. No new paid services.
- Uploaded files and screenshots are private: process, keep only the parsed item list tied to the user, delete raw files after parsing, never log contents.

DO NOT TOUCH: live Stripe prices, products or plans, payments and checkout, secrets, Discord roles or permissions, repo settings, branch protection, the price math, the listing counters and their eBay budget, scanner gates, or any file a job does not need.

SAFETY RAILS (always, every job):
- Only merge when every check passes. Run the full test suite before every merge.
- Each PR changes one thing, stays small, and is easy to revert.
- Every new feature ships behind a config flag that defaults to off. Leave flags off; Tyler turns them on.
- Never force-push. Never delete a branch you did not make. Never edit secrets or repo settings.
- Workflow edits are allowed, but keep them small, tested, and limited to the files the job needs.
- If main goes red after your merge, revert that PR first, then continue.
- No data deletions without a backup copy committed or saved first.
- No Discord message posts to a channel or DM a real member during build or tests.
- After every catchem-site PR, check the live site still loads /, /sets, one /c/ page, one /p/ page, /post-office and /premium at 390 and 1280 wide with no console errors. If any fail, revert.
- Show a real number or hide it. Never show a placeholder, a zero that means missing, or a made-up figure.
- If unsure, skip and log. Never guess.

PRE-APPROVED WHEN BLOCKED (never stop to ask): if a job needs a secret, a setting, a person, or a decision you cannot make, mark it BLOCKED in PROGRESS.md with one line on exactly what Tyler must do, then go to the next job. Same for any job that fails twice. If AI screenshot reading needs a key or paid service that is not already set up, ship CC2 dark and mark BLOCKED.

PROGRESS: after every job, update Catchem-data docs/queue/oct17/PROGRESS.md under a heading "P-1017-COLLECTION" with: job ID, repo, SHIPPED / SKIPPED / BLOCKED, PR number, merged SHA, one line on what changed, and one line on what is left.

JOBS (in order, one small green PR each, merge before starting the next; split a job into per-repo PRs when it spans repos):

1. [catchem-site + Catchem-data] CC1 · CSV import. Accept a CSV upload (Collectr export or any spreadsheet). Map columns flexibly: product id, name, set, number, printing, language, condition or grade, qty, optional price. Match first by TCGplayer product id when present (Collectr export ids equal TCGplayer product ids). Otherwise match by set, number, printing, language, condition, reusing the existing matcher. Each row gets match confidence high, medium or low; low rows show "check match" and get no value. Ignore the uploaded price for valuation; keep it only as "your file says." Flag: COLLECTION_CHECK_ENABLED=false.
2. [catchem-site] CC2 · Screenshot import. Accept up to 20 screenshots of the user's own collection. AI reads name, set, number, qty only (never prices into our value). Show a review table where the user fixes or removes rows before the check runs. Nothing runs until the user confirms. Delete images after parsing. Flag: COLLECTION_SCREENSHOT_ENABLED=false.
3. [Catchem-data] CC3 · Gap engine. Signals per item: TCGplayer market (condition matched where we have the subtype), TCGplayer low and mid, eBay ask median (Near Mint singles only; sealed has no condition label), 7 day price trend, listings counted. Outlier cleaning: drop asks under 0.5x or over 2x the median, graded and played listings from raw asks, lots and proxies. A gap counts only when 2 or more independent signals agree the comparison value is off by at least 15% AND at least $10. TCGplayer market alone never counts. Confidence: High = 2+ signals agree, 5+ listings, data under 3 days old; Medium = 2 signals with thin volume; Low = 1 signal or stale (Low is never shown as a flag). Listings trend on every flag: 7 day and 30 day direction as Rising, Falling or Flat (Flat = within 10%), with counts and dates. If listings counted rose 20% or more in 7 days, add "Higher value may not hold." Graded items show "Graded: not checked yet" and no gap until a graded sales source exists. Pure functions with unit tests. Output JSON with every number dated.
4. [Catchem-data + catchem-site] CC4 · Both sides. Mode "Selling": list "Valued low" items where our value is above the user's file value or above what they entered, sorted by dollar gap. Mode "Buying": user enters the asking price for a lot; show "Fair value for this lot $X (range $L to $H)" versus "Asking $Y," plus items that look valued high. Unmatched and graded rows are counted and listed separately, never priced.
5. [catchem-site] CC5 · Results page. Polished and rounded, matching the site's existing card style. Top: total our value, number of flags, data date. Then a short list (max 20 shown, "show all" for more) sorted by dollar gap. Each row: item, image if we have it, our value, your file value, gap $ and %, confidence chip, listings trend chips (7d, 30d), and an "Evidence" expand with each signal, its value and its date. Empty sections hide. Works at 390 and 1280 with no console errors.
6. [catchem-site] CC6 · Limits. Free: 1 check per calendar month per signed-in account. Premium (and trial): unlimited. Show remaining checks. Behind flag COLLECTION_CHECK_LIMITS_ENABLED=false (when off, no limit is enforced in dark mode only). Reuse the existing Premium gate; do not touch Stripe.
7. [Catchem-data] CC7 · Backtest on a fixture. Build tests/fixtures/collection-check/ from a scrubbed copy of a sample collection (product ids, set, number, condition, qty, a synthetic "file value"; no personal info, no Collectr prices). Assert: CSV matching hits 95%+ by product id, no gap flag from TCGplayer alone, graded rows return "not checked yet," outlier asks are dropped, the 15% and $10 rule holds, the rising listings warning triggers at 20%. Add a script that prints a summary table (flags by confidence and type). Wire into CI.

HOUSE COPY RULES (all user-facing text): no em dashes. Never use buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words (use "Selling" and "Buying" only as mode names if no better label fits; prefer "Pricing my items" and "Checking a lot"). Say listings counted, never supply alone. Listings that disappear are listings gone, never sales. eBay counts are Near Mint only. NM is for singles only, never on sealed. No creator names. Every number comes from a dated file. Empty sections hide. Never scrape against a site's terms or get past a bot block. Never use Collectr prices. Plain short sentences, no filler.

KEEP GOING: after each merge, update PROGRESS.md and start the next job right away. Do not stop to report between jobs.

DONE MEANS: every CC job is SHIPPED, SKIPPED with a reason, or BLOCKED with the exact Tyler step in PROGRESS.md; every merged PR was green; every new flag is listed in PROGRESS.md with its default (all off); no Collectr URL is ever fetched; main is green in all three repos; the live site still loads its key pages at 390 and 1280.

REPORT in ONE fenced block that starts with the ID:

P-1017-COLLECTION | jobs shipped / skipped / blocked | each PR # with repo and merged SHA | flags added and their values | final SHA per repo | what Tyler must do
```
