# 7A — What we actually hold, and what NOTICE reads

**Report before building, as asked.** Every count below is exact across the
whole file, not sampled — see the correction at the bottom, which is the most
useful thing in this document.

---

## What NOTICE reads today

Three generators. That is the entire feature:

```
"<Card> has an attack called <X>."                    attackNames
"<Card> has <X>, <Card> has <Y>."                     attackNames
"<Artist> drew both of these, <N> years apart."       artist, year
"<Artist> drew this one in <year>."                   artist, year
```

**Three fields: `attackNames`, `artist`, `year`.** Against roughly forty
card-level facts we hold. The brief's "about 5%" is right.

---

## The files

### card-bios.json — 11.5MB · 16,468 cards · **100% coverage** · the buried treasure

Listed in the brief as "unexamined". It is the richest file we have, it covers
**every card**, and **NOTICE reads none of it.**

| field | cards | | field | cards | |
|---|---:|---:|---|---:|---:|
| name, set, year, era | 16,468 | 100% | attacks | 13,880 | 84% |
| **ratings** | 16,468 | 100% | stage, hp, type | ~13,860 | 84% |
| **why** | 16,468 | 100% | colour, dex, region | ~13,820 | 84% |
| rarity | 16,300 | 99% | weakness | 13,415 | 81% |
| artist | 16,252 | 99% | evolvesFrom | 5,912 | 36% |
| price | 15,727 | 96% | lore | 4,464 | 27% |
| | | | mechanic | 2,511 | 15% |

**`why` is the headline.** Every card already carries the *reasoning* behind its
ratings — "the Baby subtype, and it trades at 3.2x its set's median IR" — 16,468
of them, pre-computed, in the house voice, sourced to a field. That is a notice
already written and never once read.

`era`, `colour` and `region` exist nowhere else and open whole categories:
regional comparisons, colour-run pages, era claims (a shape we have on file).

### card-attrs.json — 1.8MB · 16,531 cards

| field | cards | % | what it opens |
|---|---:|---:|---|
| sc (supertype) | 16,531 | 100% | Pokémon vs Trainer vs Energy |
| st (stage) | 16,377 | 99% | basic/stage-1/stage-2, VMAX etc. |
| hp | 13,892 | 84% | outliers against siblings |
| t (type) | 13,867 | 84% | type runs |
| dex | 13,845 | 84% | generation, regional grouping |
| w (weakness) | 13,448 | 81% | the "who beats what" angle |
| **rm (regulation mark)** | **7,459** | **45%** | modern legality, era boundary |
| ev (evolvesFrom) | 5,929 | 36% | lines — and the only evolution source |

### card-text.json — 1.6MB · 13,917 cards
`a` attack names **13,913 (100%)** — the one field NOTICE uses.
`f` flavour text **8,961 (64%)** — read by nothing in the notice path.

### card-catalogue.json — 8.4MB · 16,468 cards
The spine: name, setId, setName, number, releaseDate, supertype at 100%;
rarity 99%, artist 99%, price/priceUpdatedAt 96%, variants 65%.
Its own `attackNames` (383) and `flavorText` (107) are near-empty — the real
copies live in card-text.json. **Two homes for one fact, one of them a stub**,
which is worth resolving before anything reads the wrong one.

### lore.json — 0.56MB · 4,464 flavour texts, keyed by card id
Overlaps card-bios `lore` (4,464 — the same set).

### connecting-art.json — 0.39MB · 269 groups, 129 COMPLETE
Now shipped to the editor. Every card in a group is noticeable: *"this is one
of three cards that form a single picture."*

### enrichment-distilled.json — 2.28MB · **861 cards only (5%)**
Not card facts — **market data**: `history`, `conditions`, `ebaySold` (445).
Useful for price notices on a small slice; useless as a general source.

### enrichment-by-set.json — **166MB** · 861 cards
Not in the brief's list, and by far the largest file in the repo. Each record
is ~139KB of raw API response. **Gitignored**, read only by
`distil-enrichment.mjs` and `enrich-by-set.mjs` — it is a local intermediate
that gets distilled into the 2.28MB file above. Not a NOTICE source, and worth
knowing exists before someone tries to load it.

---

## Proposed observation categories, with how many cards each fires on

Estimates from the coverage above. The point of the inventory was to find out
which are worth building, and two of these did not exist before reading it.

| category | fires on | source |
|---|---:|---|
| **The rating's own reason** — "why" restated | **16,468** | bios.why |
| Era placement | 16,468 | bios.era |
| Set position — Nth of M, secret rare above set size | 16,468 | catalogue.number |
| Illustrator's body of work — count, span, one-off | 16,252 | catalogue.artist |
| Price with its date, never a judgement | 15,727 | catalogue.price |
| Stage and supertype oddities | 16,377 | attrs.st |
| HP against every other printing of that Pokémon | 13,892 | attrs.hp |
| Type/colour runs | 13,867 | attrs.t, bios.colour |
| Attack name shared across decades | 13,913 | text.a |
| Weakness pairings | 13,448 | attrs.w |
| Flavour text — contradictions, tone | 8,961 | text.f |
| Regulation-mark era boundary | 7,459 | attrs.rm |
| Region/generation | 13,812 | bios.region, attrs.dex |
| Evolution position | 5,929 | attrs.ev |
| Rare mechanic (VMAX, BREAK, LV.X) | 2,511 | bios.mechanic |
| Connecting-art membership | ~368 cards | connecting-art |
| Market history | 861 | enrichment-distilled |

**Every one of the top eight covers more cards than the three NOTICE uses now.**

---

## The correction, and why it matters for the agent

My first pass reported **regulation marks at 0%**. The brief said 7,459 and the
brief was right.

The cause: I sampled the **first 3,000 records** and extrapolated. The catalogue
is in set order, so the first 3,000 are all pre-2020 cards — and the regulation
mark did not exist then. Every record I looked at was legitimately null, and I
reported a real field as an empty one.

**A stride across the full range fixed it, and then every figure matched the
brief exactly.**

This is the same shape as the ATTRS Proxy bug: something that looked like "no
data" and was actually "did not look properly". For the notice agent that gives
two rules beyond the ones already specified:

1. **Never sample the head of an ordered collection.** Stride, or count exactly.
2. **A field that is 0% is a claim, not an observation** — check it against a
   record known to have it before believing it.

Both go in alongside the non-zero loop assertion already required.
