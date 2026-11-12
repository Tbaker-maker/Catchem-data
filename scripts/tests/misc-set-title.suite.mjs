// Nov 11 feed: "Bulbasaur (Pokémon Day 2026)" was titled "Bulbasaur
// (Miscellaneous Cards & Products) 001/132 is up 211.1% this month". The
// catch-all TCGplayer group hid the card's own tag. 75 catalogue names had this.
import { cardLabel } from "../lib/public-bundle.mjs";
import { cardTitle, nameWithTags } from "../lib/card-face.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const misc = "Miscellaneous Cards & Products";
  t("a catch-all group keeps the name's own tag", cardLabel({ name: "Bulbasaur (Pokémon Day 2026)", set: misc, number: "001/132", asOf: "2026-11-11" }) === "Bulbasaur (Pokémon Day 2026) 001/132");
  t("card titles agree", cardTitle({ name: "Bulbasaur (Pokémon Day 2026)", set: misc, number: "001/132" }) === "Bulbasaur (Pokémon Day 2026) 001/132");
  t("a metal card says so", nameWithTags("Charizard (Celebrations Metal Card)", misc) === "Charizard (Celebrations Metal Card)");
  t("with no tag of its own the group still shows", nameWithTags("Ancient Mew", misc) === `Ancient Mew (${misc})`);
  t("a variant tag stays and the own tag replaces the group", nameWithTags("Charizard #19/113 (Cosmos Holo) (GameStop Exclusive)", misc) === "Charizard #19/113 (Cosmos Holo) (GameStop Exclusive)");
  t("a real set is unchanged", nameWithTags("Charizard (Delta Species) (Holon Promo)", "EX Dragon Frontiers") === "Charizard (Delta Species) (EX Dragon Frontiers)");
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("misc-set-title.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("misc set title ok");
}
