# P-1017-BUILD1 · RD builder

**PASTE INTO: RD (data)**

FOR: RD (data) · P-1017-BUILD1 · Oct 17 2026

NOTE: ignore if already received and finished. If you already started, this same prompt resumes.

Start from latest main of Catchem-data. Read docs/BUILD1-progress.md (create it if missing, one line per queue item: ID, status TODO, SHIPPED or BLOCKED, PR number, SHA, note). Check what is already merged and skip every SHIPPED item.

DON'T TOUCH: catchem-site, catchem-bot, catchem-data-private beyond what an item says, .github/workflows files (write the exact lines into the PR body and mark that part BLOCKED), price math and eBay or PPT budgets.

YOU ARE A BUILDER. Ship working features to main, not plans, audits or questions. Every turn ends with merged code. Never reply with only a summary. Never wait for approval.

MAIN JOB (one job: ship this chat's queue, one item at a time, in this order):

1. P-1017-PO1 · Post Office catalogue: The Post Office paper catalogue must rebuild itself nightly from the same data the set pages use, and must never miss a released set. Full spec: docs/queue/oct17/P-1017-PO1.md

2. P-1017-RD11 · News schedule and one shared file: Put the existing news fetcher (scripts/fetch-tcg-news.mjs with lib/news-sources.mjs and lib/tcg-news.mjs) on a schedule: nightly plus midday PT, in it. Full spec: docs/queue/oct17/P-1017-RD11.md

3. P-1017-RD12 · News source registry: Turn scripts/lib/news-sources.mjs into a source registry. Full spec: docs/queue/oct17/P-1017-RD12.md

4. P-1017-RD13 · News dedupe and labels: Group news rows into stories by product name, set code, date and title words, so one story from three sites shows once with all its sources. Full spec: docs/queue/oct17/P-1017-RD13.md

5. P-1017-RD14 · News impact record: Start a news impact record. Full spec: docs/queue/oct17/P-1017-RD14.md

6. P-1017-RD15 · Repo growth fix: Stop the ~29 MB a night repo growth. Full spec: docs/queue/oct17/P-1017-RD15.md

7. P-1017-RD1 · Pattern lab: Build a weekly pattern lab (scripts/pattern-lab.mjs + weekly workflow). Full spec: docs/queue/oct17/P-1017-RD1.md

8. P-1017-RD2 · Read scorer: Build a read scorer (scripts/read-scorer.mjs + daily step). Full spec: docs/queue/oct17/P-1017-RD2.md

9. P-1017-RD3 · Release scout: Build a release scout. Full spec: docs/queue/oct17/P-1017-RD3.md

10. P-1017-RD4 · Data drift bot: Build a data drift bot (nightly). Full spec: docs/queue/oct17/P-1017-RD4.md

11. P-1017-RD5 · Cost and limit watcher: Build a cost and limit watcher. Full spec: docs/queue/oct17/P-1017-RD5.md

12. P-1017-RD6 · Story finder: Build a story finder (daily). Full spec: docs/queue/oct17/P-1017-RD6.md

13. P-1017-RD7 · Competitor and idea radar: Build a weekly competitor and idea radar. Full spec: docs/queue/oct17/P-1017-RD7.md

14. P-1017-RD8 · Weekly founder brief: Build a weekly founder brief (Sunday 8 AM PT). Full spec: docs/queue/oct17/P-1017-RD8.md

15. P-1017-RD9 · Custom reads data: Build the Custom Reads data layer. Full spec: docs/queue/oct17/P-1017-RD9.md

16. P-1017-RD10 · Custom reads add-ons: Build the shared nightly Custom Reads add-on feeds (cheap: fetch once, reuse for every member). Full spec: docs/queue/oct17/P-1017-RD10.md

Note: the catchem-site loader part of P-1017-RD15 belongs to TF; mark it BLOCKED (needs TF) and keep going.

METHOD for each item: build it small with tests, open a PR, merge it when CI is green, then mark it SHIPPED in docs/BUILD1-progress.md with the PR number and merge SHA, and move on to the next item without asking. If an item is blocked (secrets, a workflow edit or a human step), build everything else in it, merge that, mark the rest BLOCKED with the exact thing needed, and keep going. If you stop for a usage limit, the progress file is the save point; pasting this same prompt again resumes at the first item not SHIPPED.

RULES: every number comes from a dated file. No sealed data on card pages. Empty sections hide, never show No data. Never scrape against a site's terms or get past bot blocks. Never use Collectr prices. No buying or checkout bot. Minimize costs and human steps, maximize automation, learn over time. NM is a single-card condition only, never on sealed. User-facing copy: no em dashes; no buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up or crypto words; say listings counted, never supply alone; listings that disappear are listings gone, never sales; no creator names.

KEEP GOING: after each merge, update the progress file and start the next item in the same turn. Never wait for a reply or approval between items. Stop only when every item is SHIPPED or BLOCKED.

BONUS (only if usage is left after the queue): add a small test that docs/BUILD1-progress.md lists every queue ID once with a valid status, and fix any flaky tests you met on the way. Merge each finished piece as its own small green PR.

DONE MEANS: every queue item is SHIPPED or BLOCKED with a reason in docs/BUILD1-progress.md, every SHIPPED item has a merged green PR and SHA, main is green.

REPORT in ONE fenced block that starts with the ID:

P-1017-BUILD1 | final SHA | then one line per item: ID | SHIPPED or BLOCKED | PR # | SHA | note
