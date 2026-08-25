# Search audit — what is actually in the catalogue, and why Tyler could not find his card

**2026-08-25.** Research pass before building the relationship layer. Every number
below was measured against the live files, not read from a doc.

---

## THE FINDING THAT OUTRANKS THE THREE BUGS

**The editor does not search 16,468 cards. It searches 6,725.**

`build-editor.mjs` builds `CARD_ROWS` from a filter:

```js
const base = index.filter(c => HERO_R.test(c.r ?? '') || (c.p ?? 0) >= 8);
```

Hero rarity **or** price ≥ $8, plus a completion pass that pulls in evolution-line
parents and children. Everything else is dropped before the page is written.

**Both Magmar cards from tonight's own post are absent from the editor:**

| id | set | year | rarity | price | in the editor? |
|---|---|---|---|---|---|
| `neo1-40` | Neo Genesis | 2000 | Uncommon | $4.60 | **no** |
| `sv9-20` | Journey Together | 2025 | Common | $0.25 | **no** |

The pairing that shipped tonight was assembled from the catalogue on the command
line. It could not have been built in the editor, because neither card is in it.

**This matters more than the three bugs because tokenising the query would not
have helped.** A perfect search over an index that does not contain the card
still returns nothing. Tyler typed a true thing about a real card and got zero
results, and the reason was not the matcher.

The build log makes this hard to notice. It prints:

```
✓ editor: 16,468 cards searchable · 7 frames · watermark and credit locked
```

That number is the catalogue size, not the shipped index. **The log reports a
figure the artifact does not deliver** — the same class as a guard asserting an
artifact no step produces.

### The cost of shipping everything

Measured, gzipped, on the real files:

| option | rows | index gzip | page gzip |
|---|---|---|---|
| today | 6,725 | 289KB | 466KB |
| everything, full richness | 16,468 | 763KB | 940KB |
| **everything, lean tail** | **16,468** | **490KB** | **667KB** |

The lean tail keeps flavour text, ratings and attack names on the 6,725 cards
that already carry them, and gives the other 9,743 the fields search and
relations need: id, name, set, year, artist, rarity, type, dex, HP, evolvesFrom,
stage, weakness.

**+201KB gzip buys 9,743 more findable cards.** That is the recommendation.

---

## WHAT THE DATA ACTUALLY HOLDS

The brief expected dex, types, evolvesFrom, HP, stage and weakness in
`card-catalogue.json`. **They are not there.** The catalogue is a commerce
record. The relational fields live in two other files.

### data/card-catalogue.json — 16,468 cards

| field | coverage |
|---|---|
| name, artist, setId, setName, number, rarity, releaseDate, supertype | 100% |
| variants | 65.0% |
| attackNames | 2.3% |
| flavorText | 0.6% |

`artist` reports 100% coverage and that figure is misleading: **216 cards carry
an empty string**, nearly all basic Energy. Present is not the same as known, and
any relation keyed on artist must treat empty as absent or it will invent a
cohort of 216 cards that share "no artist".

### data/card-attrs.json — the relational layer, 16,531 entries

| field | key | coverage of catalogue |
|---|---|---|
| types | `t` | 84.0% |
| stage / subtype | `st` | 99.1% |
| HP | `hp` | 84.2% |
| evolvesFrom | `ev` | 35.9% |
| national dex | `dex` | 83.9% |
| weakness | `w` | 81.5% |
| regulation mark | `rm` | 45.1% |

**The 16% with no type are not a gap.** They are Trainer (2,317) and Energy (317)
cards, which have no type by definition. Every Pokémon card has one. Likewise
`evolvesFrom` at 36% is correct rather than sparse — only evolved cards have a
parent, and Basics are the majority.

63 ids exist in attrs but not in the catalogue. Zero catalogue ids are missing
from attrs, which is the direction that matters.

### data/card-text.json — 13,917 entries

Attack names `a` at 84.3%, flavour text `f` at 54.4%. This is the source for
SHARED_ATTACK, and 84% is enough to make it work.

### data/card-bios.json — 16,468 bios, one per card

**This is the best join in the repo and nothing in the editor uses it for
search.** It already merges catalogue and attrs into one record: name, set, year,
artist, rarity, price, type, colour, stage, mechanic, hp, weakness, evolvesFrom,
dex, region, era, attacks, lore, plus ratings with a `why` for each.

### data/lore.json — 4,464 cards with flavour text, plus four curated collections

---

## RELATIONS THE DATA SUPPORTS

Verified by counting, not assumed:

| relation | supported by | evidence |
|---|---|---|
| SAME_POKEMON_ACROSS_TIME | name + year | 3,924 distinct names; Pikachu has 80 cards |
| SAME_ARTIST | artist + year | 385 artists; 5ban Graphics 1,386, Ken Sugimori 938 |
| **ARTIST_REVISITS** | artist + name + year | **1,144 pairs; 45 at ≥18y; 19 at ≥20y; 1 at ≥25y** |
| EVOLUTION_LINE | `ev` both directions | 35.9% carry a parent, which is every evolved card |
| SAME_SET / SAME_YEAR | setName / year | 100% |
| SAME_TYPE / SAME_WEAKNESS | `t` / `w` | 84% / 81.5% |
| SHARED_ATTACK | `a` | 84.3% |
| DEX_NEIGHBOURS | `dex` | 83.9% |

**The brief's "45 cases with an 18+ year gap" is exactly right.** And the Naoyo
Kimura Magmar, `neo1-40` → `sv9-20`, is not merely one of them — at 25 years it
is **the single widest artist-revisit gap in the entire catalogue.** The top of
that list:

```
25y  Naoyo Kimura    — Magmar    2000 → 2025
24y  Mitsuhiro Arita — Abra      1999 → 2023
24y  Mitsuhiro Arita — Squirtle  1999 → 2023
23y  Mitsuhiro Arita — Gyarados  1999 → 2022
23y  Naoyo Kimura    — Pikachu   2000 → 2023
```

There are at least 45 posts in that column and tonight's used the best one.

### One claim that did not check out

The brief asks the gauntlet to cover "a Pokémon with one card, and one with 118".
**No name has 118 cards.** The maximum is **Pikachu at 80**, then Eevee 51,
Raichu 38, Unown 34, Charmander 33. No artist has exactly 118 either. 1,397 names
have exactly one card. The gauntlet will use Pikachu (80) as the
high-cardinality case and a genuine single-card name as the low.

---

## THE THREE BUGS, CONFIRMED IN CODE

`build-editor.mjs:988`:

```js
(!q || (c.n + " " + (c.a || "") + " " + c.s).toLowerCase().includes(q))
```

1. **Single contiguous substring.** For `neo1-40` the haystack is
   `"Magmar Naoyo Kimura Neo Genesis"`. The query `magmar kimura` is not a
   substring of it, so the result is zero. Two true facts about one card return
   nothing.
2. **Year is absent from the haystack.** It exists only as `c.y === yr`, an exact
   match on a separate field, so `magmar 2000` cannot work.
3. **No relationship logic.** `search()` filters a flat array. Rarity is a
   dropdown equality check and type is not searchable at all.

Bugs 1 and 2 are one small change. Bug 3 is the real job, and the finding at the
top of this file is the reason neither fix is sufficient alone.

---

## WHAT THIS AUDIT CANNOT TELL YOU

It measures what our catalogue says. It does not verify that our catalogue is
true. Every relation built on top of it inherits that limit, and the gauntlet
will state it out loud rather than imply coverage it does not have.
