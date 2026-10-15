# P-1017-MASTER · One chat, three repos

**PASTE INTO: one Grok Build chat (works across Catchem-data, catchem-site and catchem-bot)**

```
FOR: Grok Build (all repos) · P-1017-MASTER · Oct 17 2026

NOTE: ignore if already received. If docs/queue/oct17/PROGRESS.md in Catchem-data already exists, read it first and resume at the first job not marked SHIPPED or SKIPPED.

Start from latest main of the repo each job names. Before each job, check merged PRs in that repo and skip work that is already done. Full specs live in each repo under docs/queue/oct17/ (named per job below). Read the spec before you build.

DO NOT TOUCH: live Stripe, payments, checkout, Discord roles or permissions, secrets, repo settings, branch protection, the price math, the listing counters and their eBay budget, scanner gates, or any file a job does not need.

SAFETY RAILS (always, every job):
- Only merge when every check passes. Run the full test suite before every merge.
- Each PR changes one thing, stays small, and is easy to revert.
- Never force-push, except the public-data branch that job 1 creates (that one is overwritten nightly by design). Never delete a branch you did not make. Never edit secrets or repo settings.
- Workflow edits are allowed, but keep them small, tested, and limited to the files the job needs.
- If main goes red after your merge, revert that PR first, then continue.
- No data deletions without a backup copy committed or saved first.
- After every catchem-site PR, check the live site still loads /, /sets, one /c/ page, one /p/ page and /post-office at 390 and 1280 wide with no console errors. If any fail, revert.
- If unsure, skip and log. Never guess.
- Zero extra eBay calls. No new paid services.

PRE-APPROVED WHEN BLOCKED (never stop to ask): if a job needs a secret, a setting, a person, or a decision you cannot make, mark it BLOCKED in PROGRESS.md with one line on exactly what Tyler must do, then go to the next job. Same for any job that fails twice.

PROGRESS: after every job, update Catchem-data docs/queue/oct17/PROGRESS.md with: job ID, repo, SHIPPED / SKIPPED / BLOCKED, PR number, merged SHA, one line on what changed, and one line on what is left. A fresh chat must be able to resume from this file alone.

JOBS (global priority order, one small green PR each, merge before starting the next):

1. [Catchem-data] RD15b · Public data branch. Each night after the feed commit, force-push research/assets/public/ to a branch named public-data as ONE orphan commit with no history (this branch only, made by the job). Keep committing to main for now. Add a check that public-data has exactly one commit and the same file list as main's research/assets/public/. Replaces the release-asset plan in P-1017-RD15.md (browsers cannot fetch release assets).
2. [catchem-site] TF7 · Read from public-data with fallback. Spec: docs/queue/oct17/TF-feed-cdn.md. Every data URL goes through one config function: public-data first, main on a 404 or error, cached per session.
3. [Catchem-data] RD15c · Stop committing churn to main. Only after job 2 is live and public-data has published 3 nights in a row: stop adding research/assets/public/feed/items, sets and buckets to main's nightly commit (they live on public-data). Keep a nightly growth check that fails if one run adds more than 5 MB to main. If 3 nights have not happened yet, mark BLOCKED with the date it can run.
4. [catchem-site] PO2 · Post Office buttons. Spec: docs/queue/oct17/P-1017-PO2.md.
5. [catchem-site] TF8 · Include promos inside each set. Check first: if a set page already has an Include promos toggle, skip. Otherwise add the toggle on each set page (off by default). When on, that set's promos join the list, labeled Promo, with their own prices. Promo-only sets stay as they are. See the Include promos part of P-1017-TF2.md.
6. [Catchem-data] RD10 · Custom reads add-ons. Spec: docs/queue/oct17/P-1017-RD10.md.
7. [catchem-site] TF1 · Custom reads picker. Spec: docs/queue/oct17/P-1017-TF1.md and custom-reads-plan.md. Discord DM is the default; email is optional and never forced.
8. [catchem-bot] DC3 · Custom reads Discord DM. Spec: docs/queue/oct17/P-1017-DC3.md. Match catchem-site docs/queue/oct17/samples/.
9. [catchem-bot] DC4 · News cog rebuild. Spec: docs/queue/oct17/P-1017-DC4.md. Reads research/digests/news.json; quiet days post nothing.
10. [Catchem-data] RD5 · Cost and limit watcher. Spec: docs/queue/oct17/P-1017-RD5.md.
11. [Catchem-data] RD3 · Release scout. Spec: docs/queue/oct17/P-1017-RD3.md. Official pages and feeds only.
12. [Catchem-data] RD16 · Canada price gap read. Hand-kept config/cad-retail.json (product id, CAD retail price, source link, date checked, entered by a person, never scraped) plus the daily USD to CAD rate from the Bank of Canada Valet API (free, open). Compare to our own TCGplayer US market price. Write data/derived/canada-gap/YYYY-MM-DD.json with product, CAD retail, US market in CAD, gap percent, and the dates of both numbers. No new price calls. Empty config means an empty file, not an error.
13. [Catchem-data] RD8 · Weekly founder brief. Spec: docs/queue/oct17/P-1017-RD8.md.
14. [catchem-bot] DC1 · Member pulse. Spec: docs/queue/oct17/P-1017-DC1.md. Counts only, no message content stored.
15. [catchem-site + Catchem-data] TF9 · Private read scorecard. Build a hidden founder-only page /founder/scorecard (not linked, noindex, behind the existing founder check or a secret URL path from config; never public) that shows each read's private score at days 14, 28 and 56, the hit rate by read type, and a list of misses. Add a weekly draft maker that writes a Short script and an X post draft to data/derived/drafts/YYYY-MM-DD.json, never posting anything. Add one config flag SCORECARD_PUBLIC=false; leave it false.

HOUSE COPY RULES (all user-facing text): no em dashes. Never use buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words. Say listings counted, never supply alone. Listings that disappear are listings gone, never sales. eBay counts are Near Mint only. NM is for singles only, never on sealed. No creator names. Every number comes from a dated file. Empty sections hide. Never scrape against a site's terms or get past a bot block. Never use Collectr prices. No buying or checkout bot. Plain short sentences, no filler.

KEEP GOING: after each merge, update PROGRESS.md and start the next job right away. Do not stop to report between jobs.

BONUS (only if usage is left, after job 15): RD6 story finder (P-1017-RD6.md), RD7 competitor and idea radar (P-1017-RD7.md), DC2 drop assistant (P-1017-DC2.md, behind DROPS_ENABLED, never posts without approval). Merge each finished piece as its own small green PR.

DONE MEANS: every job is SHIPPED, SKIPPED with a reason, or BLOCKED with the exact Tyler step in PROGRESS.md; every merged PR was green; main is green in all three repos; the live site still loads its key pages at 390 and 1280.

REPORT in ONE fenced block that starts with the ID:

P-1017-MASTER | jobs shipped / skipped / blocked | each PR # with repo and merged SHA | final SHA per repo | what Tyler must do
```
