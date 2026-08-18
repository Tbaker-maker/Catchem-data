/*
 * Pokemon Center Exclusive ETBs — SKUs to Add to sealed-products.json
 *
 * CORRECTED VERSION v2 (May 14, 2026)
 * Tyler confirmed:
 *   1. PC-ETB exclusives started at Chilling Reign (SWSH).
 *   2. Every set from Chilling Reign forward has a PC-ETB. No skips.
 *   3. Exclusive promo cards inside PC-ETBs started at Scarlet & Violet base.
 *   4. Grail PC-ETBs (151, Obsidian Flames, Paldea Evolved, etc.) exceed
 *      default $800 ceiling and need per-SKU priceCeiling overrides.
 *
 * Coverage: 30 SKUs (Aug 18: Mega setIds corrected to me-prefix, Chaos Rising + Pitch Black added, BB/WF split)
 *   - SWSH era (Chilling Reign → Crown Zenith): 8 SKUs (PC variant, no exclusive promo)
 *   - SV era (S&V Base → Black Bolt/White Flare): 16 SKUs (PC variant + exclusive promo)
 *   - Mega era (Mega Base → Pitch Black): 6 SKUs (PC variant + exclusive promo)
 *
 * Scope: SEALED TRACKING ONLY.
 * Exclusive promo card singles are a separate (later) feature — see _notes field.
 *
 * Per-SKU price ceiling overrides:
 *   151 PC-ETB:                  ~~$2,000~~ $3,000 [CORRECTED 2026-08-18: live validation high hit $1,999.99 exactly at the May cap (clipping); PriceCharting 8/15 listings $1,205-$3,000]
 *   Obsidian Flames PC-ETB:      $1,500 (Smushed Charmander halo)
 *   Paldea Evolved PC-ETB:       $1,500 (Pikachu promo)
 *   Prismatic Evolutions PC-ETB: $1,500 (Eeveelution demand)
 *   Evolving Skies PC-ETB:       ~~$1,500~~ $2,000 [CORRECTED 2026-08-18: validation median $1,200, high $1,441 pressed the May cap; Moonbreon halo]
 *   All others: default $800
 *
 * Usage:
 *   1. Append these entries to sealed-products.json
 *   2. Run: node generate-queries.js
 *   3. Module auto-generates searchQuery + metadata for each
 *   4. Per-SKU priceCeiling overrides are RESPECTED (won't be overwritten)
 *   5. Validate top 5 against eBay before publishing prices
 *
 * Strip _confidence and _notes fields before pasting if they're not in your schema.
 */

const pcEtbSkus = [
  // ===========================================================================
  // SWSH ERA (PC variant only, no exclusive promo card)
  // Chilling Reign (June 2021) is where Pokemon Center first started doing
  // exclusive ETB variants. These predate the exclusive-promo era.
  // ===========================================================================
  {
    "id": "swsh6-pc-etb",
    "name": "Chilling Reign Pokemon Center Elite Trainer Box",
    "set": "Chilling Reign",
    "setId": "swsh6",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh6/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ First-ever PC-ETB variant",
    "_notes": "No exclusive promo card. PC branding/packaging only."
  },
  {
    "id": "swsh7-pc-etb",
    "name": "Evolving Skies Pokemon Center Elite Trainer Box",
    "set": "Evolving Skies",
    "setId": "swsh7",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh7/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "priceCeiling": 1500,
    "_confidence": "✓ verified - HIGH VALUE",
    "_notes": "Moonbreon-era set. PC variant in high demand even without exclusive promo. PRICE CEILING OVERRIDDEN to $1,500."
  },
  {
    "id": "swsh8-pc-etb",
    "name": "Fusion Strike Pokemon Center Elite Trainer Box",
    "set": "Fusion Strike",
    "setId": "swsh8",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh8/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "swsh9-pc-etb",
    "name": "Brilliant Stars Pokemon Center Elite Trainer Box",
    "set": "Brilliant Stars",
    "setId": "swsh9",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh9/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "swsh10-pc-etb",
    "name": "Astral Radiance Pokemon Center Elite Trainer Box",
    "set": "Astral Radiance",
    "setId": "swsh10",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh10/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "swsh11-pc-etb",
    "name": "Lost Origin Pokemon Center Elite Trainer Box",
    "set": "Lost Origin",
    "setId": "swsh11",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh11/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "swsh12-pc-etb",
    "name": "Silver Tempest Pokemon Center Elite Trainer Box",
    "set": "Silver Tempest",
    "setId": "swsh12",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh12/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "swsh12pt5-pc-etb",
    "name": "Crown Zenith Pokemon Center Elite Trainer Box",
    "set": "Crown Zenith",
    "setId": "swsh12pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/swsh12pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },

  // ===========================================================================
  // SV ERA (PC variant + exclusive promo card inside)
  // Exclusive promos started at Scarlet & Violet Base.
  // Promo card singles are a separate later feature — tracking sealed only here.
  // ===========================================================================
  {
    "id": "sv1-pc-etb",
    "name": "Scarlet & Violet Base Pokemon Center Elite Trainer Box",
    "set": "Scarlet & Violet",
    "setId": "sv1",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv1/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ first PC-ETB with exclusive promo era",
    "_notes": "Includes Koraidon/Miraidon exclusive promo variants. Promo singles tracked separately later."
  },
  {
    "id": "sv2-pc-etb",
    "name": "Paldea Evolved Pokemon Center Elite Trainer Box",
    "set": "Paldea Evolved",
    "setId": "sv2",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv2/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "priceCeiling": 1500,
    "_confidence": "✓ verified - HIGH VALUE",
    "_notes": "Pikachu PC exclusive promo inside. PSA 10 promo ~$1,500. PRICE CEILING OVERRIDDEN to $1,500."
  },
  {
    "id": "sv3-pc-etb",
    "name": "Obsidian Flames Pokemon Center Elite Trainer Box",
    "set": "Obsidian Flames",
    "setId": "sv3",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv3/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "priceCeiling": 1500,
    "_confidence": "✓ verified - HIGH VALUE",
    "_notes": "Smushed Charmander PC exclusive promo inside. Raw $150-181, PSA 10 $3,300+. PRICE CEILING OVERRIDDEN to $1,500."
  },
  {
    "id": "sv3pt5-pc-etb",
    "name": "Pokemon 151 Pokemon Center Elite Trainer Box",
    "set": "Pokemon 151",
    "setId": "sv3pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv3pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "priceCeiling": 2000,
    "_confidence": "✓ verified - GRAIL TIER",
    "_notes": "Sealed PC-ETB sits ~$1,400 USD. Snorlax PC exclusive promo inside (raw ~$250-300, PSA 10 ~$1,500). PRICE CEILING OVERRIDDEN to $2,000."
  },
  {
    "id": "sv4-pc-etb",
    "name": "Paradox Rift Pokemon Center Elite Trainer Box",
    "set": "Paradox Rift",
    "setId": "sv4",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv4/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv4pt5-pc-etb",
    "name": "Paldean Fates Pokemon Center Elite Trainer Box",
    "set": "Paldean Fates",
    "setId": "sv4pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv4pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv5-pc-etb",
    "name": "Temporal Forces Pokemon Center Elite Trainer Box",
    "set": "Temporal Forces",
    "setId": "sv5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv6-pc-etb",
    "name": "Twilight Masquerade Pokemon Center Elite Trainer Box",
    "set": "Twilight Masquerade",
    "setId": "sv6",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv6/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv6pt5-pc-etb",
    "name": "Shrouded Fable Pokemon Center Elite Trainer Box",
    "set": "Shrouded Fable",
    "setId": "sv6pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv6pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv7-pc-etb",
    "name": "Stellar Crown Pokemon Center Elite Trainer Box",
    "set": "Stellar Crown",
    "setId": "sv7",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv7/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv8-pc-etb",
    "name": "Surging Sparks Pokemon Center Elite Trainer Box",
    "set": "Surging Sparks",
    "setId": "sv8",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv8/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified"
  },
  {
    "id": "sv8pt5-pc-etb",
    "name": "Prismatic Evolutions Pokemon Center Elite Trainer Box",
    "set": "Prismatic Evolutions",
    "setId": "sv8pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv8pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "priceCeiling": 1500,
    "_confidence": "✓ verified - HIGH VALUE",
    "_notes": "Already in bot per Grok's data. Eeveelution all-set demand. PRICE CEILING OVERRIDDEN to $1,500. Confirm searchQuery regenerates correctly."
  },
  {
    "id": "sv9-pc-etb",
    "name": "Journey Together Pokemon Center Elite Trainer Box",
    "set": "Journey Together",
    "setId": "sv9",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv9/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify",
    "_notes": "Set's Booster Box query is currently broken (Journey Together bug). Validate PC-ETB query against eBay before deploying."
  },
  {
    "id": "sv10-pc-etb",
    "name": "Destined Rivals Pokemon Center Elite Trainer Box",
    "set": "Destined Rivals",
    "setId": "sv10",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/sv10/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify"
  },
  {
    "id": "zsv10pt5-bb-pc-etb",
    "name": "Black Bolt Pokemon Center Elite Trainer Box",
    "set": "Black Bolt",
    "setId": "zsv10pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/zsv10pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified",
    "_notes": "Black Bolt half of split set. Distinct PC-ETB with Thundurus promo."
  },
  {
    "id": "rsv10pt5-wf-pc-etb",
    "name": "White Flare Pokemon Center Elite Trainer Box",
    "set": "White Flare",
    "setId": "rsv10pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/rsv10pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "✓ verified",
    "_notes": "White Flare half of split set. Distinct PC-ETB with Tornadus promo."
  },

  // ===========================================================================
  // MEGA ERA (PC variant + exclusive promo card inside)
  // ✅ setIds VERIFIED 2026-08-18 against pokemontcg.io /v2/sets (see
  // data/set-ids-verified.json): me1, me2, me2pt5, me3, me4, me5 are the exact
  // API strings. These 6 Mega entries were IMPORTED into sealed-products.json
  // 2026-08-18 (with `set` normalized to short title-matchable names — the
  // "Mega Evolution: X" form here never appears verbatim in listing titles and
  // would fail the title REQUIRE gate). This file remains the source doc for
  // the 24 not-yet-imported SWSH/SV entries.
  // ===========================================================================
  {
    "id": "me1-pc-etb",
    "name": "Mega Evolution Pokemon Center Elite Trainer Box",
    "set": "Mega Evolution",
    "setId": "me1",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me1/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId - era-launching set (Sep 26 2025)"
  },
  {
    "id": "me2-pc-etb",
    "name": "Phantasmal Flames Pokemon Center Elite Trainer Box",
    "set": "Phantasmal Flames",
    "setId": "me2",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me2/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId (Nov 14 2025)"
  },
  {
    "id": "me2pt5-pc-etb",
    "name": "Mega Evolution Ascended Heroes Pokemon Center Elite Trainer Box",
    "set": "Mega Evolution: Ascended Heroes",
    "setId": "me2pt5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me2pt5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId (ME2.5, Jan 30 2026)",
    "_notes": "Exclusive promo inside (identity unverified — check before citing). Promo tracking separate later."
  },
  {
    "id": "me3-pc-etb",
    "name": "Mega Evolution Perfect Order Pokemon Center Elite Trainer Box",
    "set": "Mega Evolution: Perfect Order",
    "setId": "me3",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me3/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId (Mar 27 2026)",
    "_notes": "Exclusive promo inside (identity unverified — check before citing). Promo tracking separate later."
  },
  {
    "id": "me4-pc-etb",
    "name": "Mega Evolution Chaos Rising Pokemon Center Elite Trainer Box",
    "set": "Mega Evolution: Chaos Rising",
    "setId": "me4",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me4/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId (May 22 2026) — ADDED Aug 18",
    "_notes": "PC-ETB includes metallic Mega Greninja promo (per Apr 2026 release coverage). Promo tracking separate later."
  },
  {
    "id": "me5-pc-etb",
    "name": "Mega Evolution Pitch Black Pokemon Center Elite Trainer Box",
    "set": "Mega Evolution: Pitch Black",
    "setId": "me5",
    "subtype": "pc-etb",
    "image": "https://images.pokemontcg.io/me5/logo.png",
    "vintage": false,
    "hasBoosterBox": false,
    "_confidence": "⚠️ verify setId + PC variant existence (Jul 17 2026) — ADDED Aug 18",
    "_notes": "Assumed to exist per every-set-since-Chilling-Reign rule. Confirm promo + variant."
  }
];

// Total: 30 SKUs (8 SWSH + 16 SV + 6 Mega) — Aug 18 2026 correction pass
// Note: SetId values use my best guess at pokemontcg.io naming convention.
// Verify setIds against actual pokemontcg.io API before deploying.

module.exports = pcEtbSkus;
