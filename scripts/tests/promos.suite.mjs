import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_TYPES } from "../lib/art-type.mjs";
import { SOURCE_TYPES, ERA_ORDER, eraGroup, sourceType, isPromoSet, trendSpan, buildPromos } from "../lib/promos.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
let fail = 0;
const t = (name, ok, extra = "") => {
  if (ok) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name, extra); }
};

export async function run() {
  t("mega era", eraGroup("Mega Evolution", "sv-x") === "Mega" && eraGroup("", "me-30th-celebration") === "Mega");
  t("scarlet era", eraGroup("Scarlet & Violet", "svp") === "Scarlet & Violet");
  t("sword era", eraGroup("Sword & Shield", "swshp") === "Sword & Shield");
  t("older era", eraGroup("Sun & Moon", "smp") === "Older");
  t("mcdonald source", sourceType("McDonald's Collection 2024", "Pikachu") === "McDonald's");
  t("center source", sourceType("Pokemon Center Exclusive", "Mew") === "Pokemon Center");
  t("prerelease source", sourceType("Prerelease Promos", "Card") === "Prerelease");
  t("a league word in the name is league", sourceType("League Promos", "Card") === "League");
  t("a tin word is tin", sourceType("Celebrations", "Pikachu V Tin") === "Tin");
  t("a plain promo has no source type", sourceType("SWSH Promos", "Marnie") === "");

  const short = [["2026-10-10", 10], ["2026-10-16", 12]];
  t("under 7 days hides the arrow", trendSpan(short, "2026-10-16") === null);
  const week = [["2026-09-26", 10], ["2026-10-17", 12]];
  const span = trendSpan(week, "2026-10-17");
  t("a 21 day gap is labeled with the real count", span && span.days === 21 && span.label === "21d" && span.dir === "up" && span.pct === 20);
  const month = [["2026-09-01", 8], ["2026-09-20", 9], ["2026-10-17", 10]];
  const long = trendSpan(month, "2026-10-17");
  t("28 days or more is 30d", long && long.label === "30d" && long.from === "2026-09-01" && long.days >= 28);
  t("one price has no arrow", trendSpan([["2026-10-17", 5]], "2026-10-17") === null);

  const sets = [
    {
      slug: "sv-promos", name: "SV Promos", era: "Scarlet & Violet", asOf: "2026-10-17",
      items: [
        { id: "tcgcsv-518871", kind: "single", name: "Mew ex - 053", num: "053", rarity: "Promo", printing: "Holofoil", price: 63.74, hist: [["2026-09-26", 60], ["2026-10-17", 63.74]] },
        { id: "plain", kind: "single", name: "Pikachu", num: "001", rarity: "Promo", printing: "Holofoil", price: 1, hist: [["2026-10-16", 1], ["2026-10-17", 1.1]] },
        { id: "unpriced", kind: "single", name: "No price", num: "002", rarity: "Promo", printing: "Normal", price: 0 },
      ],
    },
    {
      slug: "base", name: "Base", era: "Original", asOf: "2026-10-17",
      items: [
        { id: "not-promo", kind: "single", name: "Charizard", num: "4", rarity: "Holo Rare", printing: "Holofoil", price: 9 },
        { id: "tcgcsv-189810", kind: "sealed", name: "Detective Pikachu Special Promo Booster Pack", subtype: "booster-pack", price: 12, hist: [["2026-09-26", 10], ["2026-10-17", 12]] },
        { id: "blister", kind: "sealed", name: "Base Set Checklane Blister", subtype: "blister", price: 8 },
      ],
    },
  ];
  const links = [
    { cardId: "tcgcsv-518871", productId: "tcgcsv-502005", productName: "151 Ultra-Premium Collection", sourceType: "UPC" },
    { cardId: "plain", sourceType: "ETB" },
  ];
  const built = buildPromos(sets, { links });
  t("priced promo only", built.count === 2 && built.cards.every((row) => row.id !== "unpriced" && row.id !== "not-promo"));
  const mew = built.cards.find((row) => row.id === "tcgcsv-518871");
  t("mapped product and source", mew && mew.productId === "tcgcsv-502005" && mew.source === "UPC" && mew.art === "Holo" && mew.trend && mew.trend.label === "21d");
  t("a source with no product still tags the card", built.cards.find((row) => row.id === "plain").source === "ETB" && built.cards.find((row) => row.id === "plain").productId === "");
  t("short history stays off the card", built.cards.find((row) => row.id === "plain").trend === null);
  t("sealed promo pack is included", built.sealedCount === 1 && built.sealed[0].id === "tcgcsv-189810");
  t("a regular blister is not a sealed promo", built.sealed.every((row) => row.id !== "blister"));
  t("every built card has one art type", built.cards.every((row) => ART_TYPES.indexOf(row.art) >= 0));
  t("source types stay in the list", built.cards.every((row) => !row.source || SOURCE_TYPES.indexOf(row.source) >= 0));
  t("eras stay in the list", built.cards.every((row) => ERA_ORDER.indexOf(row.era) >= 0));
  t("promo set helper", isPromoSet({ slug: "svp", name: "Scarlet & Violet Promos" }) && !isPromoSet({ slug: "base", name: "Base" }));

  const live = JSON.parse(await readFile(join(root, "research/assets/public/promos.json"), "utf8"));
  const map = JSON.parse(await readFile(join(root, "data/promo-sources.json"), "utf8"));
  t("published file has a date and a source", /^\d{4}-\d{2}-\d{2}$/.test(live.asOf) && live.source === "TCGplayer market");
  t("published count matches the cards", live.count === live.cards.length && live.count > 1000);
  t("sealed tab has packs and no condition word", live.sealedCount === live.sealed.length && live.sealed.length > 0 && live.sealed.every((row) => !/\bNM\b|near mint|condition/i.test(JSON.stringify(row))));
  t("every published card has one art type and a price", live.cards.every((row) => ART_TYPES.indexOf(row.art) >= 0 && Number(row.price) > 0));
  t("no published trend is labeled 30d on a short gap", live.cards.concat(live.sealed).every((row) => !row.trend || (row.trend.days >= 7 && (row.trend.label === "30d") === (row.trend.days >= 28))));
  const mewLive = live.cards.find((row) => row.id === "tcgcsv-518871");
  const mewtwoLive = live.cards.find((row) => row.id === "tcgcsv-518872");
  t("mew ex 053 links to the 151 ultra premium collection", mewLive && mewLive.productId === "tcgcsv-502005" && mewLive.source === "UPC");
  t("mewtwo 052 links to the 151 ultra premium collection", mewtwoLive && mewtwoLive.productId === "tcgcsv-502005" && mewtwoLive.source === "UPC");
  t("the mapping cites a source and is not empty", Array.isArray(map.links) && map.links.length > 1 && map.links.every((row) => row.cardId && Array.isArray(row.sources) && row.sources[0] && /^https:/.test(row.sources[0].url) && row.sources[0].checked));
  const productLinks = map.links.filter((row) => row.productId);
  t("product links match the file", live.linked === live.cards.filter((row) => row.productId).length && live.linked === productLinks.length && live.linked > 1);
  t("etb, premium collection, and box each have cards", ["ETB", "Premium Collection", "Box"].every((name) => live.cards.some((row) => row.source === name)));
  const publicText = JSON.stringify(live);
  t("citations stay out of the public promo file", !publicText.includes("bulbapedia") && !publicText.includes("pokemoncenter.com"));
  const dash = publicText.includes("\u2014") || publicText.includes("\u2013") || JSON.stringify(map).includes("\u2014") || JSON.stringify(map).includes("\u2013");
  t("published promos have no em dash", !dash);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("promos.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("promos ok");
}
