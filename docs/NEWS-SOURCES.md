# News sources: robots and terms log

The nightly news job (`scripts/fetch-tcg-news.mjs`) runs on GitHub runners with the user agent
`CatchEmNews/1.0 (+https://github.com/Tbaker-maker/Catchem-data)`. A source that answers 403 or
shows a bot wall is a block. It is recorded in `news.json` failures and is never retried another
way: no other network, no other user agent, no browser. Region-only items are left out by
`rules/jp-news.json` before anything is public.

## Checks on 2026-10-17 (America/Vancouver)

| Source | What we read | robots.txt | Terms | On GitHub runners | Decision |
| --- | --- | --- | --- | --- | --- |
| ICv2 | `https://icv2.com/rss` (RSS), Pokémon headlines and links only | `User-agent: *` Allow `/` (only `/admin/` disallowed) | `icv2.com/terms`: no clause against automated reading or RSS use. It bars reproducing or making derivative works of the Site, so no body text is kept | New tonight, first result on the next nightly | Added |
| PokeGuardian | news archive and upcoming sets pages | `User-agent: *`, nothing we read disallowed | No terms page found at the usual paths | Answered (48 items, Oct 16 nightly) | Kept. Headlines without a sentence now count |
| Serebii | news month pages and English set list | allows all paths we read | No terms page found at the usual paths | Answered (Oct 16 nightly) | Kept. Headlines without a sentence now count |
| Play! Pokémon | `play.pokemon.com/en-us/news/` | no robots.txt (404) | Official Pokémon site | Answered (Oct 16 nightly) | Kept. Headlines without a sentence now count |
| Pokémon press | `press.pokemon.com/en` and release pages | allows the paths we read, asks `Crawl-Delay: 5` | Official press site | Answered (Oct 16 nightly) | Kept. Now waits 5 seconds between pages |
| Victory Road | `victoryroad.pro/feed/` (RSS) | allows | not reviewed again | Answered | Kept |
| PokeBeach | front-page RSS and list | allows | not reviewed | **403 on GitHub runners** (Oct 16 nightly) | Blocked. Not fetched from any other network. Stories already saved age out after 14 days |
| Bulbagarden | `bulbagarden.net/home/index.rss` | allows | not reviewed | **403 on GitHub runners** (Oct 16 nightly) | Blocked. Same as PokeBeach |

## Looked at and not added (2026-10-17)

| Source | Why not |
| --- | --- |
| pokemon.com news and RSS | robots.txt and pages answer with a bot wall (reCAPTCHA script). Treated as a block. `blockedUrlReason` already refuses pokemon.com |
| PokéJungle RSS | Terms say "You may not otherwise copy, reproduce, republish, scrape..." |
| Dexerto Pokémon RSS | Terms page did not say either way. When unsure, left out |
| Pokémon Zone RSS | 403 |

## The Feed on a blocked night

`research/digests/feed-news.json` keeps the last 14 days of stories it already had, so one blocked
night does not empty the Feed. `scripts/tests/news-sources-gh.suite.mjs` checks that a night without
PokeBeach and Bulbagarden still gives 3 or more card stories in the last 14 days.
