# Catch'em-data Bot — searchQuery Tuning Reference

**Purpose:** Fix the Journey Together bug and prevent similar keyword-collision issues across the bot's sealed-products.json. Each entry below shows the broken pattern, the fixed query, and why it works.

**Pattern:** `[distinctive set name in quotes] [distinctive product phrase in quotes] [positive filters] [-negative filters]`

**Key insight:** eBay's Browse API matches keywords across title + description with fuzzy logic. Generic queries like "Pokemon X Booster Box sealed" pull in loose packs, ETB descriptions mentioning "booster," bundles, and empty boxes. Tight queries use **quoted phrases** to force exact matches and **negative keywords** to exclude collisions.

---

## 1. Journey Together Booster Box (the known bug)

### Broken
```json
"searchQuery": "Pokemon Journey Together Booster Box sealed English"
```

**Result:** Pulled in single packs mentioning "journey" or "together," ETBs mentioning "booster packs inside," and unrelated listings. Bot returned ~$18 average when real BB sells for $200+.

### Fixed
```json
"searchQuery": "Pokemon TCG \"Journey Together\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display"
```

### Why it works
- **`"Journey Together"`** quoted forces exact set-name match
- **`"Booster Box"`** quoted forces exact product match (not "1 booster from a box")
- **`36 packs`** is the distinguishing factory-sealed BB language
- **`-single -loose -pack`** excludes individual pack listings
- **`-bundle`** excludes Booster Bundles (different SKU)
- **`-etb -elite -trainer`** excludes ETB listings ("contains 8 booster packs")
- **`-lot`** excludes multi-item lots ("3 boxes + 2 ETBs")
- **`-empty -opened`** excludes empty/opened boxes
- **`-display`** excludes "display box" (sometimes used for outer packaging only)

---

## 2. Surging Sparks Booster Box

### Risk
"Sparks" matches fireworks listings, jewelry ("diamond sparks"), and other non-Pokemon products. "Surging" appears in unrelated electronics and crypto listings. Without tight constraints, results get polluted.

### Broken (current pattern)
```json
"searchQuery": "Pokemon Surging Sparks Booster Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Surging Sparks\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display -jewelry -firework"
```

### Why
- Same core pattern as Journey Together
- **`-jewelry -firework`** added to filter the most common non-Pokemon "sparks" listings
- Quoted `"Surging Sparks"` prevents matches on listings that just contain "sparks"

---

## 3. Lost Origin Booster Box

### Risk
"Lost" is an extremely common eBay keyword (lost items, "lost in the mail," etc.). "Origin" appears in Pokemon Origin Forme cards (Dialga, Palkia, Giratina) — could pull singles in.

### Broken
```json
"searchQuery": "Pokemon Lost Origin Booster Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Lost Origin\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display -giratina -palkia -dialga -forme"
```

### Why
- **`-giratina -palkia -dialga -forme`** excludes Origin Forme singles ("Origin Forme Palkia VSTAR" listings)
- Quoted `"Lost Origin"` prevents matches on lost/origin-themed listings

---

## 4. Paldea Evolved Booster Box

### Risk
"Evolved" matches the older XY: Evolutions set, which is a different product entirely. "Paldea" is more distinctive but still — collectors searching for it might list mixed lots.

### Broken
```json
"searchQuery": "Pokemon Paldea Evolved Booster Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Paldea Evolved\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display -evolutions -xy"
```

### Why
- **`-evolutions -xy`** excludes XY: Evolutions cross-contamination (Evolutions has its own BB)
- Quoted `"Paldea Evolved"` prevents matches on "evolved Paldea form" Pokemon

---

## 5. Battle Styles Booster Box

### Risk
"Battle" + "Styles" are both extremely generic. "Battle Styles" matches martial arts gear, "fighting styles" listings, gaming products, etc. High collision risk.

### Broken
```json
"searchQuery": "Pokemon Battle Styles Booster Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Battle Styles\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display -urshifu -single-strike -rapid-strike"
```

### Why
- Quoted `"Battle Styles"` is critical — without quotes, "battle" + "styles" matches countless listings
- **`-urshifu`** excludes the set's signature Pokemon (singles listings frequently mention "Battle Styles Urshifu")
- **`-single-strike -rapid-strike`** excludes the deck-archetype keywords from singles listings

---

## 6. Brilliant Stars Booster Box

### Risk
"Brilliant" + "Stars" are both common adjectives. "Brilliant" matches jewelry, "stars" matches countless products. Severe collision potential.

### Broken
```json
"searchQuery": "Pokemon Brilliant Stars Booster Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Brilliant Stars\" \"Booster Box\" 36 packs sealed -single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display -charizard -arceus -vstar -trainer-gallery"
```

### Why
- Quoted `"Brilliant Stars"` essential — set name has zero distinctive words
- **`-charizard -arceus`** excludes singles listings (Charizard V Alt Art is the set's grail; tons of single-card listings mention "Brilliant Stars")
- **`-vstar -trainer-gallery`** excludes mechanic/subset references that appear on singles

---

## 7. Hidden Fates ETB (bonus — different product type collision)

### Risk
Hidden Fates ETB is the format people most often relist. "Hidden Fates" is distinctive enough, but "Elite Trainer Box" matches every ETB ever made. Also at risk: people listing Shiny Vault singles with "from Hidden Fates" in description.

### Broken
```json
"searchQuery": "Pokemon Hidden Fates Elite Trainer Box sealed English"
```

### Fixed
```json
"searchQuery": "Pokemon TCG \"Hidden Fates\" \"Elite Trainer Box\" sealed factory -single -loose -pack -lot -empty -opened -reskin -custom -damaged -charizard-gx -shiny -vault"
```

### Why
- Quoted `"Hidden Fates"` + `"Elite Trainer Box"` for exact phrase match
- **`factory`** is a positive keyword commonly used for true sealed product ("factory sealed")
- **`-charizard-gx -shiny -vault`** excludes singles from the Shiny Vault subset (the set's main chase)
- **`-reskin -custom`** excludes counterfeit/reproduction listings (real concern for Hidden Fates given its grail status)
- **`-damaged`** excludes damaged-box listings (different price tier)

---

# Pattern summary (apply to remaining SKUs)

For EVERY booster box query:
```
Pokemon TCG "[exact set name]" "Booster Box" 36 packs sealed
-single -loose -pack -bundle -etb -elite -trainer -lot -empty -opened -display
```

For EVERY ETB query:
```
Pokemon TCG "[exact set name]" "Elite Trainer Box" sealed factory
-single -loose -pack -lot -empty -opened -reskin -custom -damaged
```

For EVERY Booster Bundle query:
```
Pokemon TCG "[exact set name]" "Booster Bundle" 6 packs sealed
-single -loose -pack -lot -empty -opened
```

**Then add set-specific negative keywords** for:
- The set's headline chase cards (excludes singles listings)
- The set's signature mechanic/archetype (excludes archetype-themed singles)
- Common collision words (e.g. `-jewelry` for "Sparks" sets)
- Related sets that share keywords (e.g. `-evolutions` for "Evolved" sets)

---

# Recommended schema additions to sealed-products.json

Add these fields to support the volume tracker spec:

```json
{
  "id": "sv8-bb",
  "name": "Surging Sparks Booster Box",
  "set": "Surging Sparks",
  "setId": "sv8",
  "subtype": "booster-box",
  "searchQuery": "...",
  "searchQueryVersion": 2,
  "lastTunedAt": "2026-05-14",
  "priceFloor": 80,
  "priceCeiling": 500,
  "ebayFilters": {
    "conditionIds": ["1000"],
    "listingTypes": ["FIXED_PRICE"]
  },
  "releaseDate": "2024-11-08",
  "retiredAt": null,
  "image": "https://images.pokemontcg.io/sv8/logo.png",
  "vintage": false,
  "hasBoosterBox": true
}
```

**`priceFloor` / `priceCeiling`** — Reject listings outside reasonable bounds per SKU type. Booster Box floor ~$80, ETB floor ~$30, Booster Bundle floor ~$15.

**`searchQueryVersion` / `lastTunedAt`** — Audit trail for query tuning. When a query gets updated to fix a collision, increment version and update date. Lets you track which queries have been validated.

**`ebayFilters.conditionIds: ["1000"]`** — eBay condition ID 1000 = "New." Filters out used/opened listings at the API level.

**`ebayFilters.listingTypes: ["FIXED_PRICE"]`** — Excludes auction listings (which have unpredictable final prices and noisy data).

**`releaseDate` / `retiredAt`** — Required for the volume tracker's "Released" display field and OOP tracking.

---

# Validation testing

After updating a searchQuery, manually validate by:

1. Run the query against eBay Browse API
2. Sample 10 random results
3. Verify each is the correct SKU (not a single, not an ETB, not a bundle)
4. If <8/10 are correct, tighten further
5. Bump `searchQueryVersion`, set `lastTunedAt`

This is the only way to know a fix actually worked. Don't deploy untested queries — that's how the Journey Together bug got in.
