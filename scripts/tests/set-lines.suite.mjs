import { isChaseRarity, setLines } from "../lib/set-lines.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };
  t("illustration rare is a chase", isChaseRarity("Special Illustration Rare"));
  t("a common is not a chase", !isChaseRarity("Common"));
  const lines = setLines({
    sealed: [{ id: "sv1-etb", setId: "sv1", set: "Scarlet", priceMedian: 10 }],
    singles: [
      { cardId: "c1", setId: "sv1", setName: "Scarlet", name: "Chase", rarity: "Illustration Rare", priceMarket: 5, priceHistory: [{ date: "2026-09-01", price: 4 }, { date: "2026-09-02", price: 5 }] },
      { cardId: "c2", setId: "sv1", setName: "Scarlet", name: "Bulk", rarity: "Common", priceMarket: 1, priceHistory: [] },
    ],
    sealedHistory: [
      { id: "sv1-etb", date: "2026-09-01", price: 10 },
      { id: "sv1-etb", date: "2026-09-02", price: 11 },
    ],
    asOf: "2026-09-02",
  });
  const row = lines.sets[0];
  t("sealed and chase stay on their own lines", row.sealed.products === 1 && row.chase.cards === 1 && row.chase.names[0] === "Chase");
  t("two sealed days is building history", row.sealed.status === "building history" && row.sealed.level == null);
  t("set lines do not publish a card price", !JSON.stringify(lines).includes("priceMarket") && !JSON.stringify(lines).includes("priceMedian"));
  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("set-lines.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
