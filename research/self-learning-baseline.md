# Self-learning baseline: AI daily research vs the script scan

Built 2026-10-12 from git history. Days: AI digests in research/digests/ with news.json and release-radar.json on main that day.

Days compared: 4 (skipped 17).
Flag types (day x type): both 0, AI only 5, script only 0.
Radar lines: AI 31, script 24.

Every AI-only flag above came from a page outside the nightly news feeds (PokeBeach exclusive, Lawson JP notice, pokemon.com product page, ICv2, GameStop listing). Checked: none of those items were in news.json on the day. The script cannot see them; the weekly AI review keeps a short web pass for exactly these.

| Day | AI flags | Script flags | Both | AI only | Script only | AI radar lines | Script radar lines | Script leads |
|---|---|---|---|---|---|---|---|---|
| 2026-08-18 | no news.json or radar on main that day | | | | | | | |
| 2026-08-19 | no news.json or radar on main that day | | | | | | | |
| 2026-08-20 | no news.json or radar on main that day | | | | | | | |
| 2026-08-21 | no news.json or radar on main that day | | | | | | | |
| 2026-08-22 | no news.json or radar on main that day | | | | | | | |
| 2026-08-23 | no news.json or radar on main that day | | | | | | | |
| 2026-08-24 | no news.json or radar on main that day | | | | | | | |
| 2026-08-25 | no news.json or radar on main that day | | | | | | | |
| 2026-08-28 | no news.json or radar on main that day | | | | | | | |
| 2026-09-09 | no news.json or radar on main that day | | | | | | | |
| 2026-09-11 | no news.json or radar on main that day | | | | | | | |
| 2026-09-12 | no news.json or radar on main that day | | | | | | | |
| 2026-09-16 | no news.json or radar on main that day | | | | | | | |
| 2026-09-19 | no news.json or radar on main that day | | | | | | | |
| 2026-09-21 | no news.json or radar on main that day | | | | | | | |
| 2026-09-26 | no news.json or radar on main that day | | | | | | | |
| 2026-09-28 | no news.json or radar on main that day | | | | | | | |
| 2026-10-07 | NEW_SET, DATE_CHANGE, SUPPLY_EVENT | No flags |  | NEW_SET, DATE_CHANGE, SUPPLY_EVENT |  | 12 | 6 | 0 |
| 2026-10-08 | BIG_MARKET_NEWS | No flags |  | BIG_MARKET_NEWS |  | 7 | 6 | 0 |
| 2026-10-09 | BIG_MARKET_NEWS | No flags |  | BIG_MARKET_NEWS |  | 6 | 6 | 0 |
| 2026-10-12 | No flags | No flags |  |  |  | 6 | 6 | 0 |

## Added by the script path (not in any AI digest)

Tonight's flags.json (2026-10-12): 54 flags. By type: PRICE_MOVE 6, DATA_GAP 1, ODD_PRICE 45, READ_TYPE_EMPTY 2.
Price moves, data gaps, stale files, held prices and empty read types were never part of the AI routine.
Self-check (private): past reads and every Card Rating verdict are logged nightly and scored at 7, 30 and 90 days. Seeded from git history; the first scored set (Sep 27 'heating up' reads, 21 cards) held 62% at 7 days and ran a median 2.3 points behind the whole market. Rating verdicts start scoring Oct 19 (7 days) and Nov 11 (30 days).

## Verdict

- Radar check and feed-visible news: script matches the AI on the days compared (both 'No flags' on Oct 12, radar items checked against the same calendar), at no AI cost, every night instead of weekdays.
- Off-feed discovery (exclusives, retailer listings, JP store notices, grading tracker pages): the AI raised 5 flags over 3 days (Oct 7 to Oct 9) that the script could not see. Not as good there, so the weekly AI review keeps a short web pass limited to those categories.
- Reads and ratings: unchanged. The tuner starts at the shipped weights and the rebuilt card-rating.json is byte-identical (md5 checked).
