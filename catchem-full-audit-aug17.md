# Catch'em Full Audit — August 17, 2026

**Context:** ~3 months since the May 14 session. Fresh research completed. Every major file reviewed for errors, staleness, and internal consistency.

**Severity legend:** 🔴 Critical (wrong data / broken behavior) · 🟠 Major (stale, misses real events) · 🟡 Minor (polish)

---

## PART 1 — CRITICAL BUGS

### 🔴 1. eBay Browse API may not support `-keyword` exclusions at all

The entire `generate-queries.js` strategy hinges on negative keywords (`-single -loose -pack...`). Research findings:

- eBay's own community forum: a developer reports "(-) does not seem to work" in the Browse API; the reply confirms negative keywords are only documented for the **Finding API — which was decommissioned Feb 2025**.
- eBay *site* search supports exclusions via `-word` and `-(word1,word2)` syntax, but Browse API behavior is unconfirmed and possibly different.

**Impact:** If exclusions are silently ignored, every "tuned" query behaves like the original broken Grok query — the Journey Together bug survives the "fix."

**Recommended fix (do this regardless):** Move exclusion logic **out of the query string and into post-fetch filtering** in bot code. Fetch with a simple positive query (`Pokemon "Journey Together" booster box`), then filter results in JavaScript: reject titles containing exclusion terms, reject prices outside floor/ceiling. This is more robust, fully controllable, testable, and immune to eBay syntax quirks. Keep the module's exclusion lists — just apply them to `item.title` after fetch instead of inside `q`.

### 🔴 2. Self-contradicting queries → guaranteed zero results for some SKUs

Confirmed by code review of `generateSearchQuery()`:

- **Battle Styles Booster Box is broken by our own fix.** The query requires the phrase `"Battle Styles"` but `excludeOtherTypes` for booster-box adds `-battle`. Requiring "Battle" while excluding "battle" = zero results. The `safeCollisions` filter (which removes exclusions matching the set name) only applies to `collisionWords` — NOT to `excludeOtherTypes`, `chaseCards`, or `mechanics`.
- **`-pack` vs `36 packs`:** the query requires "36 packs" while excluding "pack". eBay's singular/plural tokenization may treat these as the same token. The tuning doc claimed this works — that claim was asserted without evidence. Risk: zero-result queries.
- **Zero results are worse than wrong results for the volume tracker:** a query returning nothing looks like "supply went to 0" → the inference layer marks every prior listing as a sale → phantom volume spike + phantom squeeze signal.

**Fix:** (a) extend the `safeCollisions` set-name filter to ALL exclusion categories; (b) remove `-pack` from booster-box exclusions (handle "single pack" in post-fetch filtering); (c) add a hard safety rule to the bot: if a SKU that previously had listings suddenly returns 0, flag `query_error` state instead of inferring mass sales.

### 🔴 3. Mega Era setIds are wrong throughout our files

Our files use `sv11`–`sv15`. Real-world set numbering (confirmed via research):

| Set | Real code | Release | Our wrong ID |
|---|---|---|---|
| Mega Evolution (Base) | ME01 | Sep 26, 2025 | sv12 |
| Phantasmal Flames | ME02 | Nov 14, 2025 | sv11 |
| Ascended Heroes | ME2.5 | Jan 30, 2026 | sv13 |
| Perfect Order | ME03 | Mar 27, 2026 | sv14 |
| Chaos Rising | ME04 | May 22, 2026 | sv15 |
| Pitch Black | ME05 | Jul 17, 2026 | **missing entirely** |
| Delta Reign | ME06 | Nov 6, 2026 | **missing entirely** |

Note our IDs were also *internally* inconsistent (base set got a higher number than a set released after it). pokemontcg.io's exact API IDs still need verification on PC (`GET api.pokemontcg.io/v2/sets`), but `sv11–sv15` is definitely wrong.

**Impact:** `setDangerKeywords` lookups miss for all Mega sets (degrades gracefully to basic queries, but that's the collision-prone style), and `pc-etb-skus.js` image URLs will 404.

**Files affected:** `catchem-generate-queries.js`, `catchem-pc-etb-skus.js`, possibly `pokemon-sets-database.json`.

### 🔴 4. Black Bolt / White Flare share one setId in pc-etb-skus.js

Both entries use `setId: "zsv10pt5"`. pokemontcg.io gives the halves separate IDs (Black Bolt = `zsv10pt5`, White Flare = `rsv10pt5`). As written, White Flare shows Black Bolt's logo and both collide in any setId-keyed lookup. Verify exact IDs against the API, then split.

---

## PART 2 — MAJOR (missed news / stale content)

### 🟠 5. Three months of releases missing from every file

**Pitch Black (ME05) — released July 17, 2026.** Mega Darkrai ex headline. A month of market data already exists. Zero presence in: curation list, danger keywords, PC-ETB SKUs, mockup, newsletter topics.

**30th Celebration — Sept 16, 2026 (one month away).** The biggest Catch'em-relevant event of the year, and our curation list literally predicted it ("Celebrations 2021 → 30th Anniversary 2026?"). Confirmed details: 150+ card all-foil anniversary set, 30 classic reprints, 30 unique Pikachu illustrations, new "Futuristic Rare" rarity (Mew ex / Mewtwo ex), Espeon & Umbreon Premium Deck Set, Ultra Premium Collection, ETBs, first simultaneous worldwide TCG launch. Prime newsletter content NOW (hype cycle already running) and a mandatory sealed-tracking addition (Celebrations-2021 lineage means sealed will be hunted for years).

**Delta Reign (ME06) — Nov 6, 2026.** Mega Rayquaza ex. English version of Japan's Storm Emeralda (JP release July 31). Rayquaza tax makes this a major chase event.

### 🟠 6. Ascended Heroes Tins (Aug 28) change our squeeze thesis

X campaign Day 11 and newsletter topics use the thesis: "Ascended Heroes carrying the Mega era, no surrounding hype absorbers, squeeze." Reality update: TPC announced **three Ascended Heroes Tins for Aug 28** ($21.99, 4 packs each, Mega Feraligatr/Meganium/Emboar ex promos). That's a deliberate supply injection into the exact set we called supply-constrained — the publisher-side version of the whale-listing risk documented in the volume tracker spec (Risk 8).

The thesis isn't dead (tins ≠ booster boxes, community reaction mixed), but the copy as drafted would publish a stale read. **Any content citing the Ascended Heroes squeeze must be re-anchored to post-tin reality.** Honestly, "TPC just injected supply into the hottest set — here's the Wyckoff read now" is a *better* story than the original.

### 🟠 7. Knowledge base is 4 months stale

`last_updated: 2026-04-22`. It contains none of: the volume tracker spec, Catch'Em News rename, generate-queries module, PC-ETB SKUs, the status audit, or anything from the 3-month gap. The session-start protocol depends on this file being current — a fresh model reading it today operates on April's world. **Fix: write the addendum (May session summary + this audit) and bump last_updated.**

### 🟠 8. Newsletter + X campaign content is time-anchored to May

- Newsletter Issue 006 topic: "Pre-Launch Market Read before Chaos Rising (May 22)" — Chaos Rising is 3 months old now.
- X campaign Day 5 example uses Phantasmal Flames numbers from May.
- Curation list header still says Chaos Rising "waiting for May 22 release."

Structures are fine; all *data points and hooks* need re-anchoring to late-August reality (Pitch Black post-release read, 30th Celebration pre-hype) before anything ships.

### 🟠 9. Unknown: what actually happened in the 3-month gap

The audit can't see Tyler's side. Open questions that change priorities:
1. Was `generate-queries.js` ever deployed? Is Journey Together still reporting $18?
2. Did Newsletter 001 ever ship?
3. Did the GitHub backup happen?
4. Was the IP attorney consulted?
5. Did the X rebrand campaign run?

If the four blockers are still open, the May critical path is unchanged — just with content-staleness debt on top.

---

## PART 3 — MINOR

🟡 **10. `-display` exclusion drops legit listings.** European sellers commonly call booster boxes "displays." Excluding the word rejects real supply. Handle via post-fetch logic or item-location filter instead.

🟡 **11. Over-constrained positive keywords.** Requiring `36 packs` (booster-box) or `"Pokemon Center" exclusive factory sealed` (pc-etb) in listing titles will MISS most legitimate listings — many sellers don't write those words. Undercounted supply corrupts the volume signal from the other direction. Trim required positives to the minimum (`Pokemon "<set>" "booster box"`), use the rest as post-fetch *scoring* signals, tune via the validation loop.

🟡 **12. Mockup header stale** ("LIVE — Week of May 11, 2026"). Cosmetic; update before showing anyone.

🟡 **13. PC-ETB ceiling drift.** 151 PC-ETB was ~$1,400 in May with a $2,000 override. Verify current prices for all five override SKUs before deploy — grail sealed moves fast over 3 months.

🟡 **14. Process note.** The knowledge-base-update step of the session protocol was skipped in the May session. Make it a hard end-of-session habit: no session ends without the KB addendum.

---

## PART 4 — RECOMMENDED FIX ORDER

1. **Architecture change (before any deploy):** move exclusions to post-fetch filtering; add the zero-results safety state. This supersedes fixing individual query strings.
2. **Fix setIds:** verify Mega era + Black Bolt/White Flare IDs against pokemontcg.io API on PC; correct `generate-queries.js` + `pc-etb-skus.js`.
3. **Extend safeCollisions filter** to all exclusion categories (fixes the Battle Styles class of bug).
4. **Add missing sets:** Pitch Black + Chaos Rising danger keywords and chase data; 30th Celebration + Delta Reign as upcoming entries.
5. **Update knowledge base:** May session addendum + this audit + bump last_updated.
6. **Re-anchor content:** rewrite Ascended Heroes thesis post-tins; refresh newsletter topics and X campaign data points to August reality.
7. **Then** resume the original critical path: deploy fix → validate Journey Together → ship Newsletter 001 → GitHub backup → attorney.

## One-line summary

The May work is structurally sound but was never validated against the real world, and the real world moved: two code-level bugs would have shipped broken queries, the Mega era setIds are wrong, three sets are missing, and the flagship market thesis was overtaken by a TPC supply announcement. All fixable in one focused PC session plus one content-refresh session.
