# CLAUDE.md — Catchem-data

You are the operating engineer for Catch'em, a Pokemon TCG data + culture platform (catchemtcg.com) built by Tyler Baker. This repo is the data engine: an eBay price-tracking bot for sealed Pokemon TCG products.

**Division of labor:** You execute and validate. Tyler is the domain-knowledge validator and final approver — he has repeatedly caught factual errors that models missed (set release facts, price ceilings, product variants). When a domain fact is uncertain, ask him or flag it — never assert. Strategy and specs live in Tyler's Claude.ai project; treat files he drops in from there (audit, knowledge base) as canonical context.

**Tyler's constraints:** two jobs, two kids, limited time windows. Prefer small validated steps over big speculative changes. Never leave the repo in a broken state between sessions.

---

## What this repo is

- `scripts/fetch-sealed-prices.mjs` — the bot. Queries eBay Browse API per product in `data/sealed-products.json`, aggregates active-listing prices, writes `data/sealed-prices.json`.
- Runs via **GitHub Actions on a daily schedule** (~04:50 UTC). Deploying = pushing to main. The next scheduled run picks up changes.
- Secrets: `EBAY_APP_ID`, `EBAY_CERT_ID` (repo secrets, client-credentials OAuth). **Never print, log, or move these. Never commit credentials.**
- eBay specifics already in use: Browse API `item_summary/search`, category 2536, `conditionIds:{1000}` (New), `EBAY_US`, price filter $5–$10,000, `limit: 50`, `sort: price` (ascending), trimmed median (10% each end).

## THE BUG (live as of Aug 17, 2026) — highest priority

Journey Together Booster Box reports ~$24 median. Real price: $150–200+. Corrupted price history since at least May 20.

**Root cause (confirmed in code):** `sort: price` + limit 50 returns the 50 *cheapest* matches. The naive query ("Pokemon Journey Together Booster Box") matches single packs, bundles, and ETB listings. Packs are cheapest → they fill the result set → trimmed median lands at pack prices. Global $5 floor doesn't help. There is no title filtering.

**Do NOT fix this with negative keywords in the query string.** eBay Browse API support for `-keyword` exclusions is unreliable/undocumented (only the decommissioned Finding API documented them). A prior fix attempt (`catchem-generate-queries.js`, if present) used that approach and contains known bugs — treat it as a reference for exclusion *lists*, not as deployable code.

## Fix architecture (implement in fetch-sealed-prices.mjs)

1. **Keep queries simple and positive.** `Pokemon "<set name>" "<product phrase>"` — nothing else. Quoted phrases only.
2. **Post-fetch title filtering.** After fetching, filter `item.title` (case-insensitive):
   - REQUIRE the set name and the product phrase to appear in the title.
   - REJECT titles containing exclusion terms for that subtype (lists below).
   - **Set-name safety rule:** before applying exclusions, drop any exclusion term that appears in the set's own name (e.g., never apply "battle" against Battle Styles).
3. **Per-subtype price floors/ceilings** (replace the global $5 floor; apply in the eBay `price:[..]` filter AND post-fetch):

| subtype | floor | ceiling |
|---|---|---|
| booster-box | 80 | 800 |
| etb | 30 | 400 |
| pc-etb | 50 | 800 |
| booster-bundle | 15 | 100 |
| premium-collection | 25 | 300 |
| upc | 80 | 1500 |
| tin | 15 | 150 |
| collection-box | 20 | 200 |
| build-and-battle | 15 | 100 |

   Per-SKU overrides in sealed-products.json WIN over these defaults. Known required overrides: 151 PC-ETB ceiling 2000; Obsidian Flames / Paldea Evolved / Prismatic Evolutions / Evolving Skies PC-ETBs ceiling 1500. Verify current market before finalizing — these were May 2026 numbers.

4. **Exclusion terms** (post-fetch, per subtype — subject to set-name safety rule):
   - All subtypes: single, loose, lot, empty, opened, damaged, custom, repack, resale, "no packs", proxy
   - booster-box additionally: etb, elite trainer, bundle, blister, tin, mini, build, battle, "1 pack", "single pack", collection
   - etb additionally: booster box, bundle, blister, tin, "36 pack"
   - booster-bundle additionally: booster box, etb, elite trainer, "36 pack"
   - Do NOT exclude "display" (Europeans call booster boxes displays) and do NOT exclude "pack"/"packs" bare (self-contradicts legitimate titles).
5. **Low/zero-result safety.** If a SKU that previously had ≥10 listings suddenly returns <3 after filtering, write `dataStatus: "query_error"` for that SKU and KEEP its previous price instead of publishing a new one. Zero results must never look like a price collapse or a supply wipe-out.
   **(Tightened to kept<8 in f80d876, 2026-08-18 — this is why sv4pt5-etb query_errored at kept=5.**
   Rationale: `aggregatePrices` publishes at exactly 3 kept, and during JT validation a bad
   query left exactly 3 wrong-product survivors — three JP-import boxes would have published
   $110 as a clean "live" price. A previously-healthy SKU keeping <8 is a query problem until
   proven otherwise; the price cost is a day of `query_error` on legitimately-thin SKUs, which
   the triage process then fixes with per-SKU bounds. Triage 2026-08-18 anomaly item: resolved.)
6. **Log a per-SKU filter report** during runs (fetched N, rejected M by title, K by price) so filtering quality is inspectable.

## Data corrections needed in sealed-products.json

- **Mega Evolution era setIds are wrong if present as sv11–sv15.** Real set sequence: Mega Evolution ME01 (Sep 26 2025), Phantasmal Flames ME02 (Nov 14 2025), Ascended Heroes ME2.5 (Jan 30 2026), Perfect Order ME03 (Mar 27 2026), Chaos Rising ME04 (May 22 2026), Pitch Black ME05 (Jul 17 2026), Delta Reign ME06 (Nov 6 2026). Verify exact pokemontcg.io API ids via `GET https://api.pokemontcg.io/v2/sets?q=name:phantasmal` etc. before writing.
- **Black Bolt / White Flare are separate sets** — do not share one setId (likely zsv10pt5 vs rsv10pt5; verify via API).
- **Missing coverage to add once the fix is validated:** Pitch Black SKUs (released Jul 17), 30th Celebration SKUs (Sep 16 — anniversary set, will be heavily tracked), Ascended Heroes Tins (Aug 28), Delta Reign (Nov 6). 28 PC-ETB SKUs exist in a prepared file (`catchem-pc-etb-skus.js`) — fix its setIds before importing.

## Validation protocol (mandatory before merging bot changes)

1. Run the modified script locally for ONE SKU first (Journey Together booster box). Use a temp output file — never overwrite `data/sealed-prices.json` in a test.
2. Inspect the filter report: sample 10 accepted titles; ≥8 must be genuinely the right product. If not, tighten and rerun.
3. Acceptance for the JT fix: median lands $200–330 and priceLow ≥ $150.
   (Recalibrated 2026-08-18 against live eBay market, Tyler-confirmed accurate: regular
   English boxes $250–350, median ~$270. The original $120–260 band came from May-era
   synthetic tests and pre-dated the market move. "Enhanced" Booster Box is a VARIANT
   of the same JT booster box — box-topper promo; only ME-01 and JT have this in
   modern, per Tyler — so both variants price into sv9-booster-box.)
4. Spot-check 5 more high-traffic SKUs (Prismatic Evolutions ETB, Evolving Skies BB, 151 BB, Surging Sparks ETB, one Mega era BB).
5. Only then run full and commit. Commit message pattern: `fix(bot): <what> — validated against eBay <date>`.
6. Historical data: do NOT rewrite corrupted history rows. Add a `dataQualityNote` marking pre-fix history as contaminated for affected SKUs.

## Hard rules

- Never touch, print, or relocate eBay secrets. Never commit tokens.
- Don't change the GitHub Actions schedule or workflow triggers without asking Tyler.
- Don't mass-edit sealed-products.json without a validated plan; small reviewed diffs.
- Respect eBay rate limits: keep CONCURRENCY ≤ 4 and QUERY_DELAY_MS ≥ 300. Test runs should hit ONE SKU, not all 48.
- Any user-facing text (site, newsletter snippets) uses Catch'em voice: observational not prescriptive, hedged predictions ("possible"), collector-native shorthand (SWSH/SV/SM), never "buy now."
- If Tyler's stated domain knowledge conflicts with your research, his knowledge wins pending verification.
- End every session with: what changed, what's validated, what's next. Never leave main broken.

## Current priority order

1. Implement fix architecture in fetch-sealed-prices.mjs → validate JT → commit (this deploys via Actions).
2. Verify + correct setIds (Mega era, Black Bolt/White Flare) against pokemontcg.io.
3. Add per-SKU floor/ceiling override support + the known overrides.
4. Import corrected PC-ETB SKUs; add Pitch Black; add 30th Celebration + Ascended Heroes Tins as they release.
5. Mark contaminated history; then hand off to Tyler: newsletter can finally cite sealed prices.

## Session-locked policies (Aug 18, 2026)

**ENGLISH-ONLY (Tyler directive).** Catch'em tracks English product only right
now. `allowImports` stays false on every SKU. Do not enable, add JP/KR/CN
SKUs, or loosen the non-English exclusions without Tyler's explicit say-so.

**Out-of-scope fixes protocol.** During validation you may fix bugs beyond
your assigned files WHEN ALL THREE hold: (1) the fix is driven by real
validation evidence, (2) an inline comment cites the evidence with date,
(3) the commit body calls out the boundary crossing. Never out-of-scope:
secrets, workflow files, Actions schedules, deleting or rewriting data.
When in doubt, propose instead of apply.

**Vintage price-bounds exception (canon).** Vintage SKUs bypass modern
subtype ceilings (Base Set era boxes trade $3,000+; an $800 cap excludes
every genuine listing — validated 2026-08-18). Per-SKU floors/ceilings on
vintage entries are load-bearing; don't remove them.

**Contamination scope (validated 2026-08-18).** Pre-fix history is untrusted
for ALL SKUs, not just JT — spot checks proved damaged-sealed, weighed-lot,
and JP-import pollution across the board (Evolving Skies BB published $144
vs real ~$2,900). Heat reads restart from FIX_DEPLOY_DATE; dataQualityNote
marks the worst offenders. Never chart or cite pre-2026-08-18 rows.
