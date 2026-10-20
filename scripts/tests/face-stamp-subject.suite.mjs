import { stampRead } from "../lib/card-face-stamp.mjs";

function index(cards) {
  const byId = new Map(), bySet = new Map(), bySpecies = new Map(), byArtist = new Map();
  for (const c of cards) {
    byId.set(c.id, c);
    const k = c.setShort.toLowerCase();
    if (!bySet.has(k)) bySet.set(k, []);
    bySet.get(k).push(c);
    const sp = c.clean.split(" ")[0].toLowerCase();
    if (!bySpecies.has(sp)) bySpecies.set(sp, []);
    bySpecies.get(sp).push(c);
  }
  return { byId, bySet, bySpecies, byArtist };
}
const images = { images: {}, tcgOn: false, sealedPid: new Map() };

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const dp = { id: "tcgcsv-1", name: "Detective Pikachu", clean: "Detective Pikachu", number: "10/18", set: "Detective Pikachu", setShort: "Detective Pikachu", rarity: "Holo Rare" };
  const set = stampRead({ id: "deep-set-detective-pikachu", deep: "set", readKind: "deep", name: "Detective Pikachu", headline: "Detective Pikachu deep dive: its top 10 chase cards are worth $75.44 together.", lines: [] }, index([dp]), images);
  t("a set dive headline keeps the set name without a card number", set.headline.startsWith("Detective Pikachu deep dive:") && !set.headline.includes("10/18"));
  const zard = [
    { id: "tcgcsv-2", name: "Charizard", clean: "Charizard", number: "146/144", set: "Skyridge", setShort: "Skyridge", rarity: "Secret Rare" },
    { id: "tcgcsv-3", name: "Charizard", clean: "Charizard", number: "103/100", set: "Stormfront", setShort: "Stormfront", rarity: "Secret Rare" },
  ];
  const label = stampRead({ id: "deep-samelabel-charizard-secret-rare", deep: "samelabel", readKind: "deep", name: "Charizard Secret Rare", headline: "Charizard Secret Rare cards by set: 8 on file, led by Skyridge at $2,999.99.", lines: ["Charizard (Skyridge): $2,999.99."] }, index(zard), images);
  t("a same-label headline keeps its subject clean", label.headline.startsWith("Charizard Secret Rare cards by set:") && !label.headline.includes("146/144"));
  t("lines under it still get the card number", label.lines[0].includes("146/144"));
  const single = stampRead({ id: "card-x", readKind: "price", name: "Charizard", sku: "tcgcsv-2", headline: "Charizard (Skyridge) went $2,500.00 to $2,999.99.", lines: [] }, index(zard), images);
  t("a single-card read still gets its number", single.headline.includes("146/144"));
  const zek = [
    { id: "tcgcsv-166", name: "Zekrom ex", clean: "Zekrom ex", number: "166/086", set: "SV: Black Bolt", setShort: "Black Bolt", rarity: "Special Illustration Rare" },
    { id: "tcgcsv-34", name: "Zekrom ex", clean: "Zekrom ex", number: "34/086", set: "SV: Black Bolt", setShort: "Black Bolt", rarity: "Ultra Rare" },
  ];
  const bolt = stampRead({ id: "deep-rating-sir-above", deep: "rating", readKind: "deep", name: "Rating: Special Illustration Rares", headline: "Priced above similar cards.", lines: ["Zekrom ex (Black Bolt) 166/086: $10.00."] }, index(zek), images);
  t("a shared name takes the collector number on the line", bolt.lineCards && bolt.lineCards[0].cards.length === 1 && bolt.lineCards[0].cards[0].id === "tcgcsv-166" && bolt.lineCards[0].cards[0].title.includes("Zekrom ex"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("face-stamp-subject.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("face stamp subject ok");
}
