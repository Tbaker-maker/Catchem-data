# Catch'em Custom Reads Plan
Date: Oct 14 2026 (PT)
A personal digest system. Members pick what they follow and how often, then get enjoyable reads built from our dated data. Point and click. Rounded. Apple-clean.
## The picker page
One simple page. Members choose:
- What to follow: sets, Pokemon, rarities, eras, sealed, singles, and specific cards or sealed products. Graded later.

- How often: daily, weekly, monthly, or quarterly.

- How to get it: delivery channels (see below).

- Optional add-ons: toggle each on, or pick All in one for every add-on.
Smart defaults so setup takes about 30 seconds. Rounded tiles, clear tap targets, mobile-first.
Specific cards and sealed products land in a Your watchlist section at the top of every read, above group follows.
## Delivery (member's choice)
Build each read once. Then render it per channel the member picked. More than one channel is fine.
- Discord DM from the bot: default.

- Email: optional. Never forced.

- Future app: optional, later.
Quiet days are skipped on every channel. No filler.
## What each read contains
Every read opens with Your watchlist (specific cards and sealed products they follow), then one plain line on what changed. Then:
- Biggest moves

- Listings counted shifts

- New highs and lows

- Passed patterns with hit rate and sample size

- Rotation alerts
Longer periods (monthly, quarterly) also get set momentum and era comparisons.
Optional add-on sections appear only when the member turned them on (or chose All in one).
## Optional add-ons
Members toggle each add-on on, or pick All in one for everything. Off by default except when they choose All in one.
### Pokemon news
- Headline, plus one plain line, plus a source link.

- Only from official Pokemon news and sites whose terms and robots allow it.

- Check terms and robots once per source, log the date of that check, and keep the allow list in a dated file. Never scrape a blocked source.

- Never copy articles. Headline and one plain line only, with a link out.

- Can filter to watchlist matches (card, set, Pokemon names they follow).
### Video games
- Releases, events and updates from official sources only (same terms and robots rule: check once, log the date).

- Game prices later, and only from a source whose terms allow it. Not in v1.

- Same cheap path: never per-member fetches.
### Cost for add-ons
Fetch once nightly into shared dated files and reuse across all members. Zero extra eBay or price calls. No per-member scrape. No AI rewrite of articles.
## Approved look
The approved look is the samples at catchem-site docs/queue/oct17/samples/ (sample-a-daily-sv-ir and sample-b-weekly-charizard-me-sealed), approved by Tyler on Oct 14 2026 (PT). Light background, rounded white cards, lead story first, card images, one small chart per big move, pill deltas, mobile width. Match that look on every channel render. Add-on blocks use the same rounded cards and short lines.
## Cost model
- Built from the existing nightly per-item files. No extra eBay or price calls for digests.

- One channel-agnostic read payload per person per period. Templates only. No per-read AI cost.

- Add-ons: one shared nightly fetch per source list, sliced into each member's payload only if toggled on.

- Skip quiet days so we do not pay to send nothing useful.

- Click and open counts only. No message content stored beyond what the send needs.

- Discord DMs cost no email fees. Email only when the member opts in.
Standing rule: minimize costs and human steps, maximize automation, and learn over time.
## Tiers
- Free: 1 weekly digest. Discord DM default. Core read only (add-ons can stay free if cost stays near zero).

- Premium: daily, more follows, deeper reads, multi-channel if they want.
## Upgrades (build order)
Top three first:
1. Type what you want. Someone writes a plain line like "Eeveelutions IRs from Scarlet and Violet, weekly". The page turns it into a ready setup to approve with one tap.

2. Learns from opens and clicks. Shifts each person's read toward what they actually open, using click counts only.

3. Instant alerts between digests. Ping only for big events in their follows: a new high, or listings counted moving more than 20%. Prefer their default channel (Discord DM).
Later:
4. My collection mode. Add cards they own. Monthly value review with highs, lows, and how they compare to their sets.

5. Quarterly "how our reads did" recap with hit rates and sample sizes.

6. Shareable top-move image for X (free marketing).

7. Future app delivery (same read payload, new render).

8. Video game prices (only after an allowed-terms source is logged).
## Quality and readability (hard rules)
EASY TO READ is a hard rule. About a 6th-grade reading level. Scannable in under a minute. Max 2 short lines per point. Big clear headings. One idea per section. Plain words. No jargon.
- Every line is built from a real dated number, or for news a real dated source link. No made-up figures.

- Tyler-voice style guide: short plain collector sentences. Ban filler like "dive into", "exciting times", and hype.

- Pool of hand-written line templates, rotated for variety. No AI cost per read.

- Automatic pre-send check: empty sections hide, no repeats, no slop words, no undated numbers, no article body pasted in. Fail the send if the check fails.

- Visuals match catchem-site docs/queue/oct17/samples/: rounded cards, one small chart per big move, card images, white space, light background, mobile-first.

- Lead with the single most interesting story. Your watchlist sits at the top when they follow specific items.

- Tyler already approved the Oct 14 samples. Templates and checks run alone after that.

- Learns from opens (same click store as upgrade 2).
Copy rules (every line):
- No em dashes.

- Say "listings counted", never "supply" alone.

- Banned words: buy, sell, hold, support, resistance, bottom, printed, play, target, invest, stack, load up, and crypto words.

- Listings that disappear are "listings gone", never sales.

- No creator names. Official artists are fine.

- Empty sections hide. Never show "No data".
## Build split for Oct 17
- RD9 (data): per-follow and watchlist digest slices built nightly, one channel-agnostic read payload, quiet-day skip, click learning store, pre-send checks, template pool, hooks for optional add-on blocks.

- RD10 (data): nightly shared Pokemon news and video games feeds (terms and robots checked once per source with the date logged), watchlist filter for news, never copy articles.

- TF1 (site): picker page (follows including specific cards and sealed, delivery prefs with Discord DM default and optional email, add-on toggles plus All in one), type-what-you-want, optional email render via a cheap transactional provider. Email never forced.

- DC3 (bot): Discord DM delivery of the same read payload (default channel), including toggled add-ons.
See also: Catch'em Bot Queue for Oct 17 (prompts RD9, RD10, TF1, DC3).

  