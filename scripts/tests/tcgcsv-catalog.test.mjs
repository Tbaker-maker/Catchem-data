import { pathToFileURL } from "node:url";
import { buildGroup, classify, mergeSnapshot, pickMarket } from "../lib/tcgcsv-catalog.mjs";

let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

function card(id, name, number, rarity) {
  return {
    productId: id,
    name,
    groupId: 1,
    extendedData: [
      { name: "Number", value: number },
      { name: "Rarity", value: rarity },
    ],
  };
}

export function runTcgcsvCatalogTests() {
  fail = 0;
  const etb = classify({ name: "Prismatic Evolutions Elite Trainer Box", extendedData: [] });
  const pc = classify({ name: "Prismatic Evolutions Pokemon Center Elite Trainer Box", extendedData: [] });
  t("regular ETB is sealed etb", etb.kind === "sealed" && etb.subtype === "etb");
  t("Pokemon Center ETB is not a regular ETB", pc.kind === "sealed" && pc.subtype === "pc-etb");
  t("a card number is a single", classify(card(1, "Umbreon", "161/131", "Special Illustration Rare")).kind === "single");
  t("PSA is a slab, not a single", classify(card(2, "Umbreon PSA 10", "161/131", "Special Illustration Rare")).kind === "slab");
  t("a case is skipped", classify({ name: "Prismatic Evolutions Elite Trainer Box Case", extendedData: [] }).skip === "case, not one product");
  t("a code card is skipped", classify({ name: "Code Card - Prismatic Evolutions Booster Pack", extendedData: [] }).skip === "code card");
  t("a Japanese group is skipped", classify({ name: "Pikachu", extendedData: [{ name: "Number", value: "1" }] }, "Ash vs Team Rocket Deck Kit (JP Exclusive)").skip === "not an English product");

  t("no market price stays empty", pickMarket([{ marketPrice: null, subTypeName: "Normal" }]) === null);
  t("zero is not a price", pickMarket([{ marketPrice: 0, subTypeName: "Normal" }]) === null);
  t("one printing is kept", pickMarket([{ marketPrice: 12.5, subTypeName: "Holofoil" }]).marketPrice === 12.5);
  t("Normal wins when two printings exist", pickMarket([
    { marketPrice: 4, subTypeName: "Reverse Holofoil" },
    { marketPrice: 9, subTypeName: "Normal" },
  ]).subTypeName === "Normal");
  t("two unnamed printings are not averaged", pickMarket([
    { marketPrice: 4, subTypeName: "Mystery A" },
    { marketPrice: 9, subTypeName: "Mystery B" },
  ]) === null);

  const built = buildGroup({
    groupId: 23821,
    groupName: "SV: Prismatic Evolutions",
    asOf: "2026-09-26",
    products: [
      card(10, "Umbreon ex", "161/131", "Special Illustration Rare"),
      { productId: 11, name: "Prismatic Evolutions Booster Box", extendedData: [] },
      { productId: 12, name: "Prismatic Evolutions Booster Box Case", extendedData: [] },
      card(13, "No Price", "1/131", "Common"),
    ],
    priceRows: [
      { productId: 10, marketPrice: 800.1, subTypeName: "Holofoil" },
      { productId: 11, marketPrice: 250, subTypeName: "Normal" },
      { productId: 12, marketPrice: 2000, subTypeName: "Normal" },
      { productId: 13, marketPrice: null, subTypeName: "Normal" },
    ],
  });
  t("case price is not kept", built.items.every((i) => i.tcgplayerProductId !== 12) && built.prices.every((p) => p.id !== 12));
  t("missing price is not filled", built.items.find((i) => i.tcgplayerProductId === 13).price == null);
  t("source label is TCGplayer market price", built.items.find((i) => i.tcgplayerProductId === 10).source === "TCGplayer market price");
  const snap = mergeSnapshot([built], { asOf: "2026-09-26", failedGroups: [] });
  t("kinds stay apart", snap.latest.counts.single === 2 && snap.latest.counts.sealed === 1 && snap.latest.counts.slab === 0);
  t("daily file is priced rows only", snap.daily.prices.length === 2 && snap.daily.date === "2026-09-26");
  t("history points at the daily file", snap.latest.items[0].history.startsWith("data/history/tcgcsv-daily/2026-09-26.json#"));

  console.log(fail ? `${fail} failed` : "tcgcsv catalog ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = runTcgcsvCatalogTests();
  if (n) process.exit(1);
}
