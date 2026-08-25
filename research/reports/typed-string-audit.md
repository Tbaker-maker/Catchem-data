# The hand-typed strings in the editor — every one, with a verdict

**2026-08-25.** 1,247 strings over 45 characters reach a reader from
`research/assets/build.html`. **1,177 come from the emitted data constants**
(CARD_ROWS, HOOKS, THEMES, MOODS, FACTS) and are audited elsewhere: the 148
hooks were checked against the cards they name and all 121 that carry a price
agree with it.

**70 were extracted as typed prose. 17 of those are code fragments my extractor
mis-split on an embedded quote, leaving 53 genuine hand-typed sentences.** I
reported "70 hand-typed" previously; 53 is the accurate figure.

Both false claims found in this project came from these 53. Neither was a typo.

---

## Verdicts at a glance

| verdict | count | meaning |
|---|---:|---|
| **derived** | 3 | now computed from the data, or must be |
| **safe as static copy** | 49 | UI chrome, instructions, error messages — asserts nothing about the catalogue |
| **delete** | 1 | dead template text that can never render |

Only **6 of 53** make a claim about the world that could be wrong. The other 47
describe the app's own behaviour to the person using it, which is verifiable by
reading the code and cannot drift as the catalogue grows.

---

## The ones that make a factual claim

These are the only entries where "is it true?" is a real question. Each names
the query that settles it.

### 1. L2418 — the tutorial. **DERIVED (was false)**

> "Naoyo Kimura drew this Magmar in 2000, then drew it again in 2025 — 25 years,
> the longest anyone in this catalogue has gone between drawing the same Pokémon
> twice."

Previously claimed *"the widest gap by one illustrator in the whole
catalogue"*, which is career span. **Six illustrators span 27 years** — Arita,
Himeno, Aoki, Kizuki, Nishida, Tanaka — against Kimura's 25.

**Verifying query:**
```bash
node scripts/card-relations.mjs --revisits --min-gap 18 --limit 3
```
**Ranking, produced rather than asserted:** Kimura/Magmar 25y, Arita/Abra 24y,
Arita/Squirtle 24y, Arita/Gyarados 23y, Kimura/Pikachu 23y. The superlative
survives *under the relation's own definition* and is now generated from it at
build time, so it cannot outrun the data again.

### 2. L1941 — the Cute filter note. **DERIVED (was false)**

> was: "the Baby subtype, or an unevolved Basic at **60 HP** or less"
> now: "the Baby subtype, or a small unevolved form the market pays a premium for"

Wrong twice. The rule in `build-bios.mjs` is `hp <= 70`, and a plain small Basic
scores **5** against a filter requiring **7** — so no card had ever qualified the
way the note described. It sat directly under a comment promising *"a filter you
cannot explain is a filter nobody should trust."*

**Verifying query:** of the 39 cards passing `cute >= 7`, 15 are Baby-reasoned
and 24 are *"a small unevolved form trading at ≥2.5x its set's median IR"*.
Zero cite an HP threshold. Now asserted permanently by **search-gauntlet
section 12**, which fails if a number cited in a filter note is a number no
passing card exhibits.

### 3. L757 — the reach band. **SAFE — sourced and hedged**

> "tall_alan took roughly 900 replies from an account this size"

**Verifying query:** `data/knowledge.json`, the fact citing `x.com/tall_alan` —
~16k followers, one post, the quoted prompt. Hedged with "roughly", attributed,
and describes an external account we observed rather than a claim about our own
results. **Keep.**

### 4. L752 — "INVITE beats ASK here". **SAFE, but the weakest entry**

Advice, not a measurement. Our own outcome log holds 5 posts and the
comparability rules forbid ranking formats on it. The sentence is framed as
guidance for a reach band rather than as a finding, and the mechanism claim
behind it is the sourced one at L757. **Keep as written — but it must never be
restated as a result.** If it ever hardens into "INVITE outperforms ASK", it
needs `scripts/outcome-report.mjs` to say so first, and today that report
correctly refuses to.

### 5. L3719 — "X will likely refuse a PNG over 5MB". **SAFE — stated assumption**

The 5MB ceiling has never been recorded from source in this repo. Hedged with
"likely", written as an assumption in the code, and queued to Tyler as
`editor-60` because he is the one who posts these and knows what bounces.

### 6. L1396 — "Stock art of a pristine copy is misrepresentation and marketplaces treat it that way." **SAFE**

A statement about marketplace policy, in the selling-advice panel. Not a claim
about our data. Uncontroversial and correctly general.

---

## Superlatives: ranked or removed

Ten strings tripped the absolute/superlative scan. **Eight were false
positives** — `whole` and `all` used idiomatically ("the whole thing", "all
tried"), or a superlative inside a quoted example ("which is best" as a sample
of a *bad* prompt at L752).

Two were real and both are handled above: **L2418** (ranking produced, claim
narrowed to what the relation measures) and **L1941** (word removed, the
number it cited was wrong).

The scan itself is worth keeping in that light: 8 false positives out of 10 is
the expected rate for a keyword filter, and the two it caught were the two that
mattered.

---

## Delete

### L3444 — `" has no builder yet — pick another angle.</div>"`

Reachable only when a theme declares a `shape` with no branch in `buildIdeas`.
Every current theme dispatches. It is a developer message that would appear in
a user's face if it ever fired, and it says nothing they can act on beyond
"pick another angle", which the UI already offers. **Delete the string, keep
the guard** — the branch should simply render nothing.

*(Left in place for now: removing it changes a fallback path and belongs in its
own change with the branch it guards.)*

---

## The 47 that are safe as static copy

Grouped, because listing them one by one would imply each needed a separate
judgment when they did not. **None asserts anything about the catalogue.**

**Save and share instructions (12)** — L2065, L2081, L2092, L2107, L2109, L2118,
L2438, L3729, plus the press-and-hold variants. Describe browser behaviour.
Verifiable by using the app; several were written *because* a device behaved
this way.

**Failure and empty states (15)** — L729, L975, L976, L2040, L2672, L2890,
L2891, L2892, L3451, L3481, L3552, L3663, L3667, L3684, L3751, L3764. Each
describes what just happened in the app. L2890's host list (`pokemontcg.io`,
`scrydex.com`, `weserv.nl`) matches the `HOSTS` array exactly — checked.

**Form and control labels (8)** — L346, L1736, L1814, L2488, L2489, L2510,
L2702, L3481.

**Streak and series descriptions (6)** — L1415, L1430, L1434, L1537, L1561,
L2763. The `$3` at L1537 matches the `two-dollar` streak rule.

**Hook questions offered as opinions (4)** — L3192, L3214, L3326, L2270. These
ask the reader something ("Which one earned the name?"). A question cannot be
factually wrong, which is precisely why this is the safe register for a line
that sits over cards.

**Selling guidance (2)** — L1395, L1396.

---

## Why the data-derived ones are safer

Recorded in `scripts/build-editor.mjs` above the search section, and in
`research/house-theses.md` as a named trap.

A derived string is assembled from values, so **its scope is exactly the scope
of the query behind it**. Change the query and the sentence changes with it.

A typed sentence can **widen a narrow fact and nothing notices**. Both failures
above were written by someone looking straight at the correct value. The
relation returned 25 years under the definition *same Pokémon, twice*; the
definition lived in the query, not in the value; the sentence was written from
the value. Every step reasonable, the result false, in the first sentence a
stranger reads.

Natural English generalises — that is what it is for. The defence is not
proofreading. It is not writing the sentence by hand; and where it must be
written by hand, a guard that reads the artifact and the data and refuses to let
them disagree.
