import { artistBandReads, attachListingsFacts, copyOk, mixedReads, rarityBandReads, releaseCycleReads, ripReads } from "../lib/rich-reads.mjs";
import { addDays, dayNum } from "../lib/history-reads.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const asOf = "2026-10-13";
  const cards = Array.from({ length: 8 }, (_, i) => ({
    id: `tcgcsv-${i + 1}`,
    name: `Card ${i + 1}`,
    artist: "Ken Sugimori",
    rarity: "Illustration Rare",
    set: "SV09: Journey Together",
    setSlug: "sv09-journey-together",
    release: "2025-03-28",
    pts: [["2026-09-15", 10], ["2026-10-13", 12]],
  }));
  const bands = rarityBandReads(cards, { asOf });
  t("a rarity band names the set, the count, and both dates", bands.length === 1 && /Illustration Rare cards in Journey Together: 8 of 8 rose/.test(bands[0].headline) && /Sep 15 to Oct 13/.test(bands[0].headline) && copyOk(bands[0].headline));
  const artists = artistBandReads(cards, { asOf });
  t("an artist band uses the catalogue artist", artists.length === 1 && /illustrated by Ken Sugimori/.test(artists[0].headline) && copyOk(artists[0].why));
  const yearCard = {
    id: "tcgcsv-90", name: "Pikachu", artist: "Ken Sugimori", rarity: "Illustration Rare", set: "SV09: Journey Together", setSlug: "sv09-journey-together",
    pts: [["2025-10-13", 8], ["2026-10-06", 10], ["2026-10-13", 12]],
  };
  const mixed = mixedReads({ cards: [yearCard], asOf, sealedPool: [{ id: "sv9-bb", name: "Journey Together Booster Box", from: 180, to: 191.93, group: "sv9" }], listings: { products: [{ id: "sv9-bb", listingsCounted: { n: 35, date: "2026-10-13", prev: { n: 48, date: "2026-10-06" } } }] }, asOfStart: asOf, start: "2026-10-06", end: asOf });
  t("a mixed card states one 7 day window and not the year", mixed.some((r) => r.id.startsWith("mixed-card") && /\$10\.00 on Oct 6 to \$12\.00 on Oct 13 \(\+20%\)/.test(r.headline) && !/2025|Oct 13, 2025|over the year|in a year/i.test(r.headline)) && !/\b20\d{2}-\d{2}-\d{2}\b/.test(JSON.stringify(mixed.map((r) => [r.headline, r.source, ...(r.lines || [])]))));
  t("a mixed sealed line states listings counted beside the market price", mixed.some((r) => r.readKind === "mixed" && /Listings counted 48 on Oct 6 to 35 on Oct 13/.test(r.headline) && !/\bsupply\b/i.test(r.headline)));
  const staleMixed = mixedReads({ cards: [], asOf, sealedPool: [{ id: "sv9-bb", name: "Journey Together Booster Box", from: 180, to: 191.93, group: "sv9" }], listings: { products: [{ id: "sv9-bb", listingsCounted: { n: 35, date: "2026-10-01", prev: { n: 48, date: "2026-09-20" } } }] }, start: "2026-10-06", end: asOf });
  t("a mixed sealed line with stale listings counted is skipped", !staleMixed.some((r) => r.id.startsWith("mixed-sealed")));
  const sets = { sets: [
    { slug: "sv09-journey-together", name: "Journey Together", era: "Scarlet & Violet", release: "2026-06-01" },
    { slug: "sv08", name: "Surging Sparks", era: "Scarlet & Violet", release: "2025-06-01" },
    { slug: "sv07", name: "Stellar Crown", era: "Scarlet & Violet", release: "2025-03-01" },
    { slug: "sv06", name: "Twilight Masquerade", era: "Scarlet & Violet", release: "2025-01-01" },
  ] };
  const age = dayNum(asOf) - dayNum("2026-06-01");
  const cycleCards = [];
  for (const set of sets.sets) {
    const early = addDays(set.release, 14);
    const late = addDays(set.release, age);
    for (let i = 0; i < 8; i += 1) {
      const up = set.slug === "sv09-journey-together" ? 14 : 11;
      cycleCards.push({
        id: `${set.slug}-${i}`, name: `C ${i}`, rarity: "Illustration Rare", set: set.name, setSlug: set.slug,
        pts: [[early, 10], [late, up], [asOf, up]],
      });
    }
  }
  const cycles = releaseCycleReads(cycleCards, sets, { asOf });
  t("a release-cycle line counts days from the release date", cycles.length >= 1 && /released Jun 1/.test(cycles[0].headline) && /days later/.test(cycles[0].headline) && copyOk(cycles[0].headline) && !/\bwithin\b/i.test(cycles[0].headline));
  const rip = ripReads({ asOf, rows: [{ id: "sv9-booster-box", name: "Journey Together Booster Box", setId: "sv9", price: 191.93, contentsEV: 96.48, priceAsOf: "2026-10-13", packs: 36, slots: [{ published: "2025-03-28" }] }] });
  t("a rip line is the contents over that day's price", rip.length === 1 && /rip value \$96\.48 is 50\.3% of the \$191\.93 market price on Oct 13/.test(rip[0].headline) && copyOk(rip[0].headline));
  const host = [{ id: "x", sku: "sv9-bb", href: "/p/sv9-bb", readKind: "sealedchase", kind: "sealedchase", lines: ["One.", "Two.", "Three."], headline: "Box moved." }];
  const cardHost = [{ id: "y", sku: "tcgcsv-1", href: "/c/tcgcsv-1", readKind: "single", lines: ["One.", "Two.", "Three."], headline: "Card moved." }];
  attachListingsFacts(host, { asOf, products: [{ id: "sv9-bb", listingsCounted: { n: 35, date: "2026-10-13", prev: { n: 37, date: "2026-10-12" } } }] });
  attachListingsFacts(cardHost, { asOf, products: [{ id: "sv9-bb", listingsCounted: { n: 35, date: "2026-10-13", prev: { n: 37, date: "2026-10-12" } } }] });
  t("a listings fact is dated on the sealed item and not on a card", /Listings counted 37 on Oct 12 to 35 on Oct 13/.test(host[0].lines.join(" ")) && !/Listings counted/.test(cardHost[0].lines.join(" ")));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("rich-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
