# News sources, 2026-10-02

Branched from main `db2c6c1c497c35635b5db2bcc83feed8ea2fec43`.

`research/digests/news.json` keeps the full sourced list in `catalog` (994 items). `items` is still the recent public slice (8). A stored item keeps the date, title, url, and source name. Product name, wave, reprint, and set date are kept only when that page states them. Tags are cards, sealed, video-games, tournaments, or release, and only when the item fits.

## Stored items

| Source | Stored | Page |
| --- | ---: | --- |
| Serebii sets | 128 | https://www.serebii.net/card/english.shtml |
| Serebii news (2026 month pages linked from the index) | 275 | https://www.serebii.net/news/ |
| Pokémon Card (Japan) | 164 | https://www.pokemon-card.com/info/ |
| PokeBeach front-page RSS | 80 | https://www.pokebeach.com/forums/forum/front-page-news.18/index.rss |
| Play! Pokémon | 58 | https://play.pokemon.com/en-us/news/ |
| PokeGuardian news archive | 48 | https://www.pokeguardian.com/articles/news-archive |
| PokeGuardian upcoming sets | 3 | https://www.pokeguardian.com/sets/upcoming-sets |
| RK9 | 44 | https://rk9.gg/events/pokemon |
| Pokémon Center Support preorder dates | 40 | https://support.pokemoncenter.com/hc/en-us/articles/4407702295572-Estimated-Preorder-Release-Dates |
| Pokémon GO | 30 | https://pokemongo.com/en/news |
| Gematsu, The Pokémon Company | 27 | https://www.gematsu.com/companies/the-pokemon-company |
| Limitless | 25 | https://limitlesstcg.com/tournaments |
| Pokémon Card (Asia) | 21 | https://asia.pokemon-card.com/sg/ |
| Bulbagarden | 20 | https://bulbagarden.net/home/index.rss |
| Siliconera Pokémon tag | 15 | https://www.siliconera.com/tag/pokemon/feed/ |
| Pokémon Asia press | 10 | https://asia-press.portal-pokemon.com/ |
| Victory Road | 5 | https://victoryroad.pro/feed/ |
| Pokémon press | 1 | https://press.pokemon.com/en |

Japan's page repeated items in the HTML (354 titles read, 164 unique). Gematsu's page repeated 2 posts (29 read, 27 unique).

## Skipped

No source was skipped. Every fetch returned a page, and none of these pages blocked the bot.

Pokémon Card (Asia) stated titles and links and did not state a publication date, so those 21 items have no date.

Twelve Gematsu rows are game links on the company page (title and url, no date on that list).

Serebii writes one older set date as "Februrary 14th 2007" (EX Power Keepers). That spelling is stored as stated. It was not corrected into a calendar day.

## Dates that disagree

None. Both items are kept whenever two sources name a date, and a note is added only when the specific days do not overlap.

Delta Reign is November 6, 2026 on Serebii and on PokeGuardian. 30th Celebration is September 16, 2026 on Serebii and on both PokeGuardian regions. Pokémon Center rows such as "Early November 2026" are ship windows, not a single day, so they were not called a conflict with November 6. A PokeBeach sentence says "November 6th" with no year, so it was not matched against November 6, 2026.

## Not fetched

pokemon.com, www.pokemoncenter.com, pokebeach.com/feed, PokeGuardian /feed and /rss, Nintendo Life, and Gematsu's all-games feed. PokeBeach's front-page RSS and press.pokemon.com still run.
