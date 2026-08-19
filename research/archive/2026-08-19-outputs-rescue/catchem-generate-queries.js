/**
 * Catch'em-data Bot — searchQuery Generator
 *
 * Programmatically generates tuned eBay Browse API search queries for sealed
 * Pokemon TCG products. Replaces hand-written searchQueries (which caused the
 * Journey Together booster box bug) with a maintainable function-driven approach.
 *
 * Usage:
 *   const { generateSearchQuery, regenerateAllQueries } = require('./generate-queries.js');
 *
 *   // For a single SKU:
 *   const query = generateSearchQuery({
 *     setId: "sv9",
 *     setName: "Journey Together",
 *     subtype: "booster-box"
 *   });
 *
 *   // Migrate all SKUs in sealed-products.json:
 *   node generate-queries.js
 *
 * Architecture:
 *   - productTypePatterns: subtype-specific keywords (BB needs "36 packs" etc.)
 *   - setDangerKeywords: per-set chase Pokemon names, mechanic terms, collision words
 *   - generateSearchQuery(): combines them into a tuned eBay query string
 *
 * Versioning:
 *   - Bumps searchQueryVersion field on every regeneration
 *   - Sets lastTunedAt to current date
 *   - Allows audit trail of when queries were last validated
 *
 * Validation:
 *   - validateQuery() is a stub — wire to eBay Browse API in your environment
 *   - Recommended: run validation on top-30 SKUs after migration before deploying
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// PRODUCT TYPE PATTERNS
// ============================================================================
// Each subtype gets specific positive identifiers and exclusions for its
// known collisions with OTHER product types.

const productTypePatterns = {
  'booster-box': {
    productPhrase: '"Booster Box"',
    positiveKeywords: ['36 packs'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'bundle', 'collection', 'premium', 'tin', 'upc', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'display', 'damaged'],
    priceFloor: 80,
    priceCeiling: 800,
  },
  'etb': {
    productPhrase: '"Elite Trainer Box"',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['bundle', 'booster-box', 'collection', 'tin', 'upc', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'reskin', 'custom', 'damaged'],
    priceFloor: 30,
    priceCeiling: 400,
  },
  'pc-etb': {
    productPhrase: '"Elite Trainer Box"',
    positiveKeywords: ['"Pokemon Center"', 'exclusive', 'factory', 'sealed'],
    excludeOtherTypes: ['bundle', 'booster-box', 'collection', 'tin', 'upc', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'reskin', 'custom', 'damaged'],
    priceFloor: 50,
    priceCeiling: 800,
    // NOTE: Default ceiling fits most PC-ETBs ($50-200 typical).
    // High-grail PC-ETBs need per-SKU overrides:
    //   - 151 PC-ETB (Snorlax promo halo): priceCeiling: 2000
    //   - Obsidian Flames PC-ETB (Smushed Charmander promo): priceCeiling: 1500
    //   - Paldea Evolved PC-ETB (Pikachu promo): priceCeiling: 1500
    //   - Prismatic Evolutions PC-ETB (Eeveelution demand): priceCeiling: 1500
    //   - Evolving Skies PC-ETB (Moonbreon halo): priceCeiling: 1500
  },
  'booster-bundle': {
    productPhrase: '"Booster Bundle"',
    positiveKeywords: ['6 packs'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'collection', 'tin', 'upc', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 15,
    priceCeiling: 100,
  },
  'premium-collection': {
    productPhrase: '"Premium Collection"',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'tin', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 25,
    priceCeiling: 300,
  },
  'upc': {
    productPhrase: '"Ultra Premium Collection"',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'tin', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 80,
    priceCeiling: 1500,
  },
  'tin': {
    productPhrase: 'tin',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'collection', 'upc', 'build'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged', 'mini'],
    priceFloor: 15,
    priceCeiling: 150,
  },
  'mini-tin': {
    productPhrase: '"Mini Tin"',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'collection', 'upc'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 5,
    priceCeiling: 30,
  },
  'collection-box': {
    productPhrase: 'collection',
    positiveKeywords: ['factory', 'sealed', 'box'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'tin', 'upc', 'build', 'battle'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 20,
    priceCeiling: 200,
  },
  'build-and-battle': {
    productPhrase: '"Build and Battle"',
    positiveKeywords: ['factory', 'sealed'],
    excludeOtherTypes: ['etb', 'elite', 'trainer', 'booster-box', 'bundle', 'collection', 'tin', 'upc'],
    excludeCondition: ['single', 'loose', 'pack', 'lot', 'empty', 'opened', 'damaged'],
    priceFloor: 15,
    priceCeiling: 100,
  },
};

// ============================================================================
// SET DANGER KEYWORDS
// ============================================================================
// Per-set negative keywords. These exclude SINGLES listings that mention
// the set name but should NOT be counted in sealed product tracking.
//
// Each set gets:
//   - chaseCards: top chase Pokemon/Trainer names (excludes singles)
//   - mechanics: signature mechanic/archetype terms (excludes archetype singles)
//   - collisionWords: common-word collisions (jewelry, fireworks, etc.)
//
// Seed data from the Catch'em curated chase list.

const setDangerKeywords = {
  // ===== MEGA ERA =====
  'sv11': { // Phantasmal Flames
    chaseCards: ['charizard', 'mega-charizard', 'sharpedo', 'lopunny', 'gengar', 'oricorio'],
    mechanics: ['mega-evolution', 'mhr', 'sir'],
    collisionWords: ['flame', 'phantom'],
  },
  'sv12': { // Mega Evolution Base Set
    chaseCards: ['lucario', 'gardevoir', 'mega-lucario', 'mega-gardevoir', 'venusaur', 'latias', 'absol', 'lillie', 'acerola'],
    mechanics: ['mega-evolution', 'mhr', 'sir'],
    collisionWords: [],
  },
  'sv13': { // Ascended Heroes
    chaseCards: ['gengar', 'pikachu', 'dragonite', 'mega-gengar', 'mega-dragonite', 'mega-charizard', 'zoroark', 'metagross', 'liepard', 'clefairy', 'feraligatr', 'diancie'],
    mechanics: ['mega-evolution', 'mhr', 'mar', 'sir'],
    collisionWords: ['hero', 'ascended'],
  },
  'sv14': { // Perfect Order
    chaseCards: ['meowth', 'zygarde', 'mega-zygarde', 'starmie', 'clefable', 'rosa', 'jacinthe', 'tyrunt'],
    mechanics: ['mega-evolution', 'mhr', 'sir'],
    collisionWords: ['perfect', 'order'],
  },
  'sv15': { // Chaos Rising (placeholder for May 22, 2026 release)
    chaseCards: [],
    mechanics: ['mega-evolution', 'mhr', 'sir'],
    collisionWords: ['chaos', 'rising'],
  },

  // ===== SCARLET & VIOLET ERA =====
  'sv8': { // Surging Sparks
    chaseCards: ['pikachu', 'latias', 'hydreigon', 'milotic', 'jasmine', 'ceruledge', 'clemont', 'mesprit', 'feebas'],
    mechanics: ['sir', 'tera', 'ace-spec', 'night-stretcher'],
    collisionWords: ['jewelry', 'firework', 'spark', 'electric'],
  },
  'sv7': { // Stellar Crown
    chaseCards: ['terapagos', 'hydrapple', 'galvantula', 'dachsbun', 'briar', 'lacey', 'bulbasaur', 'squirtle', 'joltik', 'cinderace'],
    mechanics: ['stellar-tera', 'sir', 'tera'],
    collisionWords: ['crown', 'stellar'],
  },
  'sv6pt5': { // Shrouded Fable
    chaseCards: ['pecharunt', 'fezandipiti', 'munkidori', 'okidogi', 'cassiopeia', 'bloodmoon-ursaluna', 'houndoom', 'persian', 'duskull', 'dusclops', 'dusknoir'],
    mechanics: ['loyal-three', 'sir', 'earthen-vessel'],
    collisionWords: ['shrouded', 'fable'],
  },
  'sv6': { // Twilight Masquerade
    chaseCards: ['greninja', 'carmine', 'perrin', 'eevee', 'ogerpon', 'kieran', 'lana', 'chansey', 'bloodmoon'],
    mechanics: ['teal-mask', 'wellspring', 'hearthflame', 'cornerstone', 'sir', 'buddy-buddy-poffin'],
    collisionWords: ['twilight', 'masquerade', 'mask'],
  },
  'sv5': { // Temporal Forces
    chaseCards: ['iron-crown', 'gouging-fire', 'walking-wake', 'iron-boulder', 'iron-hands', 'iron-leaves', 'eri', 'bianca', 'morty', 'deerling', 'sawsbuck', 'gengar'],
    mechanics: ['paradox', 'ancient', 'future', 'sir', 'prime-catcher'],
    collisionWords: ['temporal', 'force'],
  },
  'sv4pt5': { // Paldean Fates
    chaseCards: ['charizard', 'mew', 'lucario', 'charmeleon', 'ditto', 'mimikyu', 'arven', 'iron-hands', 'roaring-moon', 'ceruledge', 'great-tusk', 'jacq'],
    mechanics: ['shiny', 'sir', 'baby-shiny'],
    collisionWords: ['paldean', 'fates'],
  },
  'sv4': { // Paradox Rift
    chaseCards: ['groudon', 'altaria', 'roaring-moon', 'garchomp', 'iron-valiant', 'iron-hands', 'steelix', 'gholdengo', 'plusle', 'minun', 'morpeko', 'sandy-shocks'],
    mechanics: ['paradox', 'ancient', 'future', 'sir'],
    collisionWords: ['paradox', 'rift'],
  },
  'sv3pt5': { // 151
    chaseCards: ['charizard', 'blastoise', 'venusaur', 'zapdos', 'snorlax', 'alakazam', 'erika', 'mew', 'charmander', 'bulbasaur', 'squirtle', 'pikachu', 'ninetales'],
    mechanics: ['kanto', 'sir', 'tera'],
    collisionWords: [],
  },
  'sv3': { // Obsidian Flames
    chaseCards: ['charizard', 'smushed-charmander', 'pidgeot', 'tyranitar', 'geeta', 'poppy', 'gloom', 'revavroom', 'eiscue', 'pidgeotto', 'pidgey'],
    mechanics: ['tera', 'sir'],
    collisionWords: ['obsidian', 'flame'],
  },
  'sv2': { // Paldea Evolved
    chaseCards: ['magikarp', 'iono', 'pikachu', 'heracross', 'tyranitar', 'raichu', 'chien-pao', 'skeledirge', 'meowscarada', 'quaquaval', 'fuecoco', 'super-rod'],
    mechanics: ['sir', 'tera', 'streamer'],
    collisionWords: ['paldea', 'evolved', 'evolutions'],
  },
  'sv1': { // Scarlet & Violet Base
    chaseCards: ['gardevoir', 'squirtle', 'miraidon', 'koraidon', 'miriam', 'iono', 'greavard', 'riolu', 'arven', 'rare-candy', 'nest-ball'],
    mechanics: ['sir', 'tera'],
    collisionWords: ['scarlet', 'violet'],
  },
  'sv8pt5': { // Prismatic Evolutions
    chaseCards: ['umbreon', 'sylveon', 'glaceon', 'espeon', 'leafeon', 'vaporeon', 'flareon', 'jolteon', 'eevee', 'pikachu', 'budew', 'sunbreon', 'roaring-moon', 'ceruledge'],
    mechanics: ['eeveelution', 'master-ball', 'poke-ball', 'sir', 'god-pack'],
    collisionWords: ['prismatic', 'evolutions'],
  },
  'sv9': { // Journey Together
    chaseCards: [], // Add when known — currently broken set
    mechanics: ['sir'],
    collisionWords: ['journey', 'together', 'trip', 'adventure'],
  },
  'sv10': { // Destined Rivals
    chaseCards: [],
    mechanics: ['sir'],
    collisionWords: ['destined', 'rival'],
  },
  'zsv10pt5': { // Black Bolt / White Flare (split set)
    chaseCards: ['zekrom', 'reshiram', 'victini', 'kyurem', 'hydreigon', 'hilda', 'keldeo', 'seismitoad', 'serperior', 'thundurus', 'tornadus', 'snivy', 'tepig', 'oshawott', 'n-plot'],
    mechanics: ['bwr', 'sir', 'black-bolt', 'white-flare'],
    collisionWords: ['bolt', 'flare', 'unova'],
  },

  // ===== SWORD & SHIELD ERA =====
  'swsh12pt5': { // Crown Zenith
    chaseCards: ['giratina', 'mewtwo', 'arceus', 'pikachu', 'dialga', 'palkia', 'mew', 'leafeon', 'glaceon', 'suicune', 'darkrai', 'radiant-charizard', 'latias'],
    mechanics: ['galarian-gallery', 'vstar', 'radiant'],
    collisionWords: ['crown', 'zenith'],
  },
  'swsh12': { // Silver Tempest
    chaseCards: ['lugia', 'rayquaza', 'serena', 'unown', 'blaziken', 'regigigas', 'palkia', 'alolan-vulpix'],
    mechanics: ['vstar', 'trainer-gallery', 'forest-seal-stone'],
    collisionWords: ['silver', 'tempest'],
  },
  'swsh11': { // Lost Origin
    chaseCards: ['giratina', 'aerodactyl', 'rotom', 'pikachu', 'mew', 'gengar', 'nessa', 'leon', 'hisuian-zoroark', 'enamorus', 'magnezone'],
    mechanics: ['vstar', 'trainer-gallery', 'lost-zone', 'origin-forme'],
    collisionWords: ['lost', 'origin'],
  },
  'pgo': { // Pokemon GO
    chaseCards: ['mewtwo', 'dragonite', 'radiant-charizard', 'candela', 'blanche', 'spark', 'venusaur', 'blastoise', 'professor-research', 'ditto'],
    mechanics: ['radiant', 'vstar', 'peelable'],
    collisionWords: ['niantic', 'mobile', 'app'],
  },
  'swsh10': { // Astral Radiance
    chaseCards: ['machamp', 'palkia', 'dialga', 'garchomp', 'irida', 'starmie', 'aerodactyl', 'radiant-charizard', 'hisuian-samurott'],
    mechanics: ['vstar', 'trainer-gallery', 'origin-forme', 'radiant'],
    collisionWords: ['astral', 'radiance'],
  },
  'swsh9': { // Brilliant Stars
    chaseCards: ['charizard', 'arceus', 'sylveon', 'umbreon', 'cynthia', 'marnie', 'galarian-moltres', 'shaymin', 'leon', 'whimsicott', 'mew'],
    mechanics: ['vstar', 'trainer-gallery'],
    collisionWords: ['brilliant', 'star'],
  },
  'swsh8': { // Fusion Strike
    chaseCards: ['gengar', 'mew', 'genesect', 'greninja', 'espeon', 'chandelure', 'grass-energy', 'hoopa', 'inteleon'],
    mechanics: ['fusion-strike', 'sir', 'alt-art'],
    collisionWords: ['fusion', 'strike'],
  },
  'cel25': { // Celebrations
    chaseCards: ['charizard', 'umbreon', 'gold-shiny-mew', 'mew', 'blastoise', 'venusaur', 'shining-magikarp', 'zekrom', 'imposter-professor-oak', 'flying-pikachu', 'surfing-pikachu'],
    mechanics: ['classic-collection', 'reprint', '25th-anniversary'],
    collisionWords: ['celebration', 'anniversary'],
  },
  'swsh7': { // Evolving Skies
    chaseCards: ['umbreon', 'rayquaza', 'sylveon', 'leafeon', 'glaceon', 'vaporeon', 'espeon', 'jolteon', 'flareon', 'dragonite', 'galarian-articuno', 'duraludon', 'moonbreon', 'sky-stream'],
    mechanics: ['vmax', 'alt-art', 'eeveelution'],
    collisionWords: ['evolving', 'sky'],
  },
  'swsh6': { // Chilling Reign
    chaseCards: ['shadow-rider-calyrex', 'ice-rider-calyrex', 'galarian-moltres', 'galarian-articuno', 'galarian-zapdos', 'galarian-rapidash', 'shiny-snorlax', 'klara', 'melony', 'tornadus', 'blaziken'],
    mechanics: ['vmax', 'alt-art', 'path-to-peak'],
    collisionWords: ['chilling', 'reign'],
  },
  'swsh5': { // Battle Styles
    chaseCards: ['tyranitar', 'urshifu', 'empoleon', 'houndoom', 'phoebe', 'cheryl', 'korrina', 'octillery'],
    mechanics: ['vmax', 'alt-art', 'single-strike', 'rapid-strike'],
    collisionWords: ['battle', 'style', 'martial'],
  },
  'swsh4pt5': { // Shining Fates
    chaseCards: ['shiny-charizard', 'skyla', 'suicune', 'decidueye', 'koffing', 'galarian-rapidash', 'eternatus', 'inteleon', 'ditto', 'cinderace', 'alcremie'],
    mechanics: ['shiny-vault', 'shiny'],
    collisionWords: ['shining', 'fates'],
  },
  'swsh4': { // Vivid Voltage
    chaseCards: ['pikachu', 'chonkachu', 'charizard', 'bea', 'nessa', 'leon', 'allister', 'togekiss', 'galarian-darmanitan', 'pokemon-center-lady'],
    mechanics: ['vmax', 'rainbow', 'amazing-rare'],
    collisionWords: ['vivid', 'voltage'],
  },
  'swsh3pt5': { // Champion's Path
    chaseCards: ['charizard', 'drednaw', 'gardevoir', 'hop', 'kabu', 'allister', 'bea'],
    mechanics: ['vmax', 'rainbow-rare'],
    collisionWords: ['champion', 'path'],
  },
  'swsh3': { // Darkness Ablaze
    chaseCards: ['charizard', 'eternatus', 'centiskorch', 'scizor', 'galarian-sirfetchd', 'crobat', 'bosss-orders'],
    mechanics: ['vmax', 'rainbow'],
    collisionWords: ['darkness', 'ablaze'],
  },
  'swsh2': { // Rebel Clash
    chaseCards: ['toxtricity', 'sonia', 'bosss-orders', 'dragapult', 'galarian-stunfisk', 'maractus', 'galarian-sirfetchd'],
    mechanics: ['vmax', 'rainbow'],
    collisionWords: ['rebel', 'clash'],
  },
  'swsh1': { // Sword & Shield Base
    chaseCards: ['snorlax', 'marnie', 'zacian', 'zamazenta', 'quick-ball', 'lapras', 'bede', 'professor-magnolia', 'cramorant', 'indeedee'],
    mechanics: ['vmax', 'rainbow', 'gold-secret'],
    collisionWords: ['sword', 'shield'],
  },

  // ===== SUN & MOON ERA =====
  'sm115': { // Hidden Fates
    chaseCards: ['shiny-charizard', 'charizard-gx', 'greninja-gx', 'mewtwo-gx', 'pikachu-zekrom', 'gyarados-gx', 'lucario-gx', 'tyranitar-gx', 'solgaleo-gx', 'lunala-gx', 'rayquaza-gx', 'reshiram-gx'],
    mechanics: ['shiny-vault', 'shiny', 'gx'],
    collisionWords: ['hidden', 'fates'],
  },
  'sm12': { // Cosmic Eclipse
    chaseCards: ['charizard-braixen', 'mewtwo-mew', 'cynthia-caitlin', 'blastoise-piplup', 'garchomp-giratina', 'lillies-full-force', 'welder', 'pikachu-zekrom', 'venusaur-snivy'],
    mechanics: ['tag-team', 'gx', 'character-card'],
    collisionWords: ['cosmic', 'eclipse'],
  },
  'sm11': { // Unified Minds
    chaseCards: ['mewtwo-mew', 'mega-sableye-tyranitar', 'slowpoke-psyduck', 'mistys-favor', 'espeon-deoxys', 'pikachu-zekrom', 'reshiram-charizard', 'lillies-determination', 'stadium-nav', 'greninja-zoroark'],
    mechanics: ['tag-team', 'gx', 'yellow-a-alt-art'],
    collisionWords: ['unified', 'minds'],
  },
  'sm10': { // Unbroken Bonds
    chaseCards: ['reshiram-charizard', 'blastoise-gx', 'reds-challenge', 'welder', 'gardevoir-sylveon', 'greninja-zoroark', 'muk-alolan-muk', 'mewtwo-mew', 'pikachu-zekrom', 'garbodor'],
    mechanics: ['tag-team', 'gx'],
    collisionWords: ['unbroken', 'bonds'],
  },
  'sm8': { // Lost Thunder
    chaseCards: ['blacephalon-gx', 'lugia-gx', 'zeraora-gx', 'mimikyu-gx', 'genesect-gx', 'magcargo-gx', 'sceptile-gx', 'suicune-gx', 'lost-blender', 'spell-tag'],
    mechanics: ['gx', 'rainbow', 'lost-zone'],
    collisionWords: ['lost', 'thunder', 'electric'],
  },
  'sm3': { // Burning Shadows
    chaseCards: ['charizard-gx', 'ho-oh-gx', 'necrozma-gx', 'tapu-lele-gx', 'gardevoir-gx', 'mimikyu-gx', 'espeon-gx', 'darkrai', 'machamp', 'escape-rope'],
    mechanics: ['gx', 'rainbow', 'prism'],
    collisionWords: ['burning', 'shadow'],
  },
  'sm9': { // Team Up
    chaseCards: ['latias-latios', 'gengar-mimikyu', 'magikarp-wailord', 'eevee-snorlax', 'pikachu-zekrom', 'jasmine', 'erikas-hospitality'],
    mechanics: ['tag-team', 'gx', 'alt-art'],
    collisionWords: ['team', 'duo'],
  },
  'det1': { // Detective Pikachu
    chaseCards: ['charizard', 'detective-pikachu', 'mewtwo', 'greninja', 'charmander', 'mr-mime', 'slaking', 'bulbasaur', 'ditto', 'case-file'],
    mechanics: ['movie', 'realistic-art'],
    collisionWords: ['detective', 'movie', 'live-action'],
  },
  'sm5': { // Ultra Prism
    chaseCards: ['cynthia', 'dialga-gx', 'palkia-gx', 'lusamine', 'glaceon-gx', 'empoleon-gx', 'garchomp-gx'],
    mechanics: ['prism-star', 'gx'],
    collisionWords: ['ultra', 'prism'],
  },
  'sm6': { // Forbidden Light
    chaseCards: ['lucario-gx', 'naganadel-gx', 'greninja-gx', 'volcanion', 'energy-recycler', 'mallow', 'dialga-gx'],
    mechanics: ['gx', 'ultra-beast'],
    collisionWords: ['forbidden', 'light'],
  },
  'sm35': { // Shining Legends
    chaseCards: ['mewtwo-gx', 'shining-mew', 'shining-rayquaza', 'shining-genesect', 'shining-volcanion', 'shining-celebi', 'zoroark-gx', 'raichu-gx'],
    mechanics: ['shining', 'gx'],
    collisionWords: ['shining', 'legends'],
  },
  'sm7': { // Celestial Storm
    chaseCards: ['lugia-gx', 'rayquaza-gx', 'articuno-gx', 'zapdos-gx', 'moltres-gx', 'erikas-hospitality', 'volkner', 'acerola', 'tapu-bulu-gx'],
    mechanics: ['gx', 'legendary-bird'],
    collisionWords: ['celestial', 'storm'],
  },
  'sm4': { // Crimson Invasion
    chaseCards: ['gyarados-gx', 'necrozma-gx', 'lusamine', 'salazzle-gx', 'tapu-bulu-gx', 'counter-energy', 'octillery'],
    mechanics: ['gx'],
    collisionWords: ['crimson', 'invasion'],
  },
  'sm2': { // Guardians Rising
    chaseCards: ['sylveon-gx', 'tapu-lele-gx', 'tapu-koko', 'decidueye-gx', 'vikavolt', 'garbodor', 'field-blower'],
    mechanics: ['gx', 'tapu'],
    collisionWords: ['guardians', 'rising'],
  },
  'sm1': { // Sun & Moon Base
    chaseCards: ['solgaleo-gx', 'lunala-gx', 'decidueye-gx', 'lillie', 'charizard', 'tauros-gx', 'professor-kukui'],
    mechanics: ['gx'],
    collisionWords: ['sun', 'moon', 'alola'],
  },
  'dm1': { // Dragon Majesty
    chaseCards: ['ultra-necrozma-gx', 'zinnia', 'reshiram', 'salamence-gx', 'dragonite-gx'],
    mechanics: ['gx', 'dragon'],
    collisionWords: ['dragon', 'majesty'],
  },

  // ===== XY ERA (lower priority — light coverage) =====
  'xy12': { // Evolutions (20th anniversary Base reprint)
    chaseCards: ['charizard', 'mega-charizard', 'blastoise', 'venusaur', 'mew', 'mega-pidgeot', 'mega-venusaur', 'mega-slowbro', 'flying-pikachu', 'surfing-pikachu', 'here-comes-team-rocket'],
    mechanics: ['mega', 'ex', '20th-anniversary'],
    collisionWords: ['evolutions', 'evolved'],
  },
};

// ============================================================================
// SUBTYPE NORMALIZATION
// ============================================================================
// Grok's data uses some loose subtype values. Normalize them so the bot
// always gets the same key, regardless of how the JSON was written.

const subtypeAliases = {
  'bb': 'booster-box',
  'boosterbox': 'booster-box',
  'booster-box': 'booster-box',
  'booster_box': 'booster-box',

  'etb': 'etb',
  'elite-trainer-box': 'etb',
  'elitetrainerbox': 'etb',

  'pc-etb': 'pc-etb',
  'pokemon-center-etb': 'pc-etb',
  'pcetb': 'pc-etb',

  'bundle': 'booster-bundle',
  'booster-bundle': 'booster-bundle',
  'boosterbundle': 'booster-bundle',

  'pc': 'premium-collection',
  'premium': 'premium-collection',
  'premium-collection': 'premium-collection',

  'upc': 'upc',
  'ultra-premium': 'upc',
  'ultra-premium-collection': 'upc',

  'tin': 'tin',
  'mini-tin': 'mini-tin',
  'minitin': 'mini-tin',

  'collection': 'collection-box',
  'collection-box': 'collection-box',

  'bnb': 'build-and-battle',
  'build-and-battle': 'build-and-battle',
  'buildandbattle': 'build-and-battle',
};

function normalizeSubtype(rawSubtype) {
  if (!rawSubtype) return null;
  const key = String(rawSubtype).toLowerCase().trim();
  return subtypeAliases[key] || key;
}

// ============================================================================
// CORE FUNCTION: generateSearchQuery
// ============================================================================
/**
 * Generates a tuned eBay Browse API search query for a single SKU.
 *
 * @param {Object} sku - The SKU record
 * @param {string} sku.setId - Pokemon TCG API set ID (e.g. "sv9")
 * @param {string} sku.setName - Display name of the set
 * @param {string} sku.subtype - Product subtype (booster-box, etb, etc.)
 * @returns {string} Tuned searchQuery string
 */
function generateSearchQuery(sku) {
  const { setId, setName, subtype } = sku;

  if (!setName) throw new Error(`SKU missing setName: ${JSON.stringify(sku)}`);
  if (!subtype) throw new Error(`SKU missing subtype: ${JSON.stringify(sku)}`);

  const normalizedSubtype = normalizeSubtype(subtype);
  const pattern = productTypePatterns[normalizedSubtype];

  if (!pattern) {
    console.warn(`No pattern for subtype "${subtype}" (normalized: "${normalizedSubtype}"). Returning basic query.`);
    return `Pokemon TCG "${setName}" "${subtype}" sealed`;
  }

  // Build the positive side
  const parts = [
    'Pokemon',
    'TCG',
    `"${setName}"`,
    pattern.productPhrase,
    ...pattern.positiveKeywords,
  ];

  // Generic exclusions per product type
  const exclusions = [
    ...pattern.excludeCondition.map(w => `-${w}`),
    ...pattern.excludeOtherTypes.map(w => `-${w}`),
  ];

  // Set-specific exclusions (chase cards, mechanics, collision words)
  const setDanger = setDangerKeywords[setId];
  if (setDanger) {
    if (setDanger.chaseCards) {
      exclusions.push(...setDanger.chaseCards.map(w => `-${w}`));
    }
    if (setDanger.mechanics) {
      exclusions.push(...setDanger.mechanics.map(w => `-${w}`));
    }
    if (setDanger.collisionWords) {
      // Don't exclude words that appear in the set name itself
      const setWords = setName.toLowerCase().split(/\s+/);
      const safeCollisions = setDanger.collisionWords.filter(
        w => !setWords.includes(w.toLowerCase())
      );
      exclusions.push(...safeCollisions.map(w => `-${w}`));
    }
  }

  return [...parts, ...exclusions].join(' ');
}

// ============================================================================
// CORE FUNCTION: applyMetadata
// ============================================================================
/**
 * Enriches a SKU with all the metadata fields the volume tracker spec
 * requires: priceFloor, priceCeiling, ebayFilters, searchQueryVersion,
 * lastTunedAt, and the regenerated searchQuery.
 *
 * Per-SKU overrides for priceFloor and priceCeiling are RESPECTED — if a SKU
 * has explicit values (e.g. high-grail PC-ETBs like 151 at $2000 ceiling),
 * those win over the subtype defaults.
 *
 * @param {Object} sku - The original SKU from sealed-products.json
 * @returns {Object} Enriched SKU ready for the volume tracker pipeline
 */
function applyMetadata(sku) {
  const normalizedSubtype = normalizeSubtype(sku.subtype);
  const pattern = productTypePatterns[normalizedSubtype];

  // Respect existing overrides — only fill if missing
  const priceFloor = sku.priceFloor != null ? sku.priceFloor :
                     (pattern ? pattern.priceFloor : null);
  const priceCeiling = sku.priceCeiling != null ? sku.priceCeiling :
                       (pattern ? pattern.priceCeiling : null);

  return {
    ...sku,
    subtype: normalizedSubtype, // normalize the field too
    searchQuery: generateSearchQuery(sku),
    searchQueryVersion: (sku.searchQueryVersion || 1) + 1,
    lastTunedAt: new Date().toISOString().split('T')[0],
    priceFloor,
    priceCeiling,
    ebayFilters: sku.ebayFilters || {
      conditionIds: ['1000'], // "New"
      listingTypes: ['FIXED_PRICE'],
    },
  };
}

// ============================================================================
// MIGRATION RUNNER
// ============================================================================
/**
 * Regenerates all searchQueries in a sealed-products.json file in place.
 *
 * @param {string} inputPath - Path to the existing sealed-products.json
 * @param {string} outputPath - Where to write the migrated file
 * @param {Object} options
 * @param {boolean} options.dryRun - If true, log changes without writing
 * @param {Array<string>} options.onlySetIds - If provided, only migrate these setIds
 */
function regenerateAllQueries(inputPath, outputPath, options = {}) {
  const { dryRun = false, onlySetIds = null } = options;

  const raw = fs.readFileSync(inputPath, 'utf8');
  const skus = JSON.parse(raw);

  const stats = {
    total: skus.length,
    migrated: 0,
    skipped: 0,
    errors: 0,
    bySubtype: {},
    missingDangerData: [],
  };

  const migrated = skus.map(sku => {
    try {
      if (onlySetIds && !onlySetIds.includes(sku.setId)) {
        stats.skipped++;
        return sku;
      }

      const result = applyMetadata(sku);
      stats.migrated++;
      stats.bySubtype[result.subtype] = (stats.bySubtype[result.subtype] || 0) + 1;

      if (!setDangerKeywords[sku.setId]) {
        stats.missingDangerData.push(sku.setId);
      }

      return result;
    } catch (err) {
      stats.errors++;
      console.error(`Error on ${sku.id}: ${err.message}`);
      return sku;
    }
  });

  if (!dryRun) {
    fs.writeFileSync(outputPath, JSON.stringify(migrated, null, 2));
  }

  // Print summary
  console.log('\n========== MIGRATION SUMMARY ==========');
  console.log(`Total SKUs: ${stats.total}`);
  console.log(`Migrated: ${stats.migrated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log('\nBy subtype:');
  Object.entries(stats.bySubtype).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  if (stats.missingDangerData.length > 0) {
    const unique = [...new Set(stats.missingDangerData)];
    console.log(`\nSetIds missing danger keyword data (${unique.length}):`);
    unique.forEach(id => console.log(`  ${id}`));
    console.log('\nAdd these to setDangerKeywords for tighter queries.');
  }
  if (dryRun) {
    console.log('\n[DRY RUN — no files written]');
  } else {
    console.log(`\nWrote: ${outputPath}`);
  }
  console.log('=======================================\n');

  return { migrated, stats };
}

// ============================================================================
// VALIDATION STUB
// ============================================================================
/**
 * Tests a generated query against eBay Browse API by sampling 10 results
 * and checking they match the expected SKU.
 *
 * STUB — wire this up to your actual eBay API client.
 *
 * @param {Object} sku - SKU record with generated searchQuery
 * @returns {Promise<{passed: boolean, sample: Array, notes: string[]}>}
 */
async function validateQuery(sku) {
  // TODO: wire to eBay Browse API
  // const results = await ebayClient.searchItems({
  //   q: sku.searchQuery,
  //   filter: `conditionIds:{${sku.ebayFilters.conditionIds.join('|')}}`,
  //   limit: 10
  // });
  //
  // Check each result for:
  //   - Title contains the set name (case-insensitive)
  //   - Title contains the product type phrase
  //   - Price is within priceFloor/priceCeiling range
  //   - Title does NOT contain "single", "loose", "pack" alone, "lot", etc.
  //
  // Return { passed: true } if 8+/10 match, otherwise fail with notes.

  console.warn(`validateQuery() is a stub — wire to eBay Browse API to enable.`);
  return {
    passed: null,
    sample: [],
    notes: ['Validation not yet wired up to eBay Browse API.'],
  };
}

// ============================================================================
// CLI ENTRYPOINT
// ============================================================================
// Run with: node generate-queries.js [--dry-run] [--only-set=sv9]

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlySetArg = args.find(a => a.startsWith('--only-set='));
  const onlySetIds = onlySetArg ? [onlySetArg.split('=')[1]] : null;

  const inputPath = path.join(__dirname, 'data', 'sealed-products.json');
  const outputPath = path.join(__dirname, 'data', 'sealed-products.json');

  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    console.error(`Expected to find sealed-products.json in ./data/`);
    process.exit(1);
  }

  regenerateAllQueries(inputPath, outputPath, { dryRun, onlySetIds });
}

module.exports = {
  generateSearchQuery,
  applyMetadata,
  regenerateAllQueries,
  validateQuery,
  productTypePatterns,
  setDangerKeywords,
  normalizeSubtype,
};
