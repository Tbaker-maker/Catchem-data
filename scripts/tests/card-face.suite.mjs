import { barLabel, cardTitle, ebayAskPhrase, hasNumber, insertNumber, labelPrices, tcgPriceLine, CONDITION_NOTE } from "../lib/card-face.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  t("title keeps the full collector number", cardTitle({ name: "Lugia EX (Team Plasma)", set: "Plasma Storm", number: "108/135" }) === "Lugia EX (Team Plasma) (Plasma Storm) 108/135");
  t("a full art number is not shortened to the left side", cardTitle({ name: "Mega Gengar ex - 284/217", set: "Ascended Heroes", number: "284/217" }) === "Mega Gengar ex (Ascended Heroes) 284/217");
  t("bar labels shorten the name and keep the number", barLabel({ name: "Special Delivery Charizard", number: "SWSH144" }, 14).endsWith(" SWSH144") && !barLabel({ name: "Special Delivery Charizard", number: "SWSH144" }, 14).includes("SWSH14") === false || barLabel({ name: "Special Delivery Charizard", number: "SWSH144" }, 14).endsWith("SWSH144"));
  const bar = barLabel({ name: "Special Delivery Charizard", number: "284/217" }, 12);
  t("the shortened bar still ends with the full number", bar.endsWith("284/217") && bar.includes("..."));
  t("a market price names Near Mint and the date", tcgPriceLine(108.65, "2026-10-13") === "$108.65 NM · TCGplayer market, 2026-10-13");
  t("an ask with no condition says any condition", ebayAskPhrase() === "eBay asking, any condition" && ebayAskPhrase("Near Mint") === "eBay asking, Near Mint");
  t("insert puts the number after the set", insertNumber("Snorlax (Team Plasma) (Plasma Storm), $8.15", "Snorlax (Team Plasma)", "101/135").startsWith("Snorlax (Team Plasma) (Plasma Storm) 101/135"));
  t("a variant word stays in front of the number", insertNumber("Team Rocket's Moltres ex Special Illustration Rare (Destined Rivals), $74.61", "Team Rocket's Moltres ex - 229/182", "229/182").includes("Special Illustration Rare (Destined Rivals) 229/182"));
  const mixed = labelPrices("151 UPC: eBay asks ($100.00) sit $20.00 over TCGplayer market ($80.00).");
  t("eBay asks are not marked Near Mint", mixed.includes("eBay asking, any condition") && mixed.includes("($80.00 NM)") && !/asks \(\$100\.00 NM\)/.test(mixed) && mixed.includes("sit $20.00 over"));
  t("a TCGplayer sentence marks every amount", labelPrices("Together: $5.00 (Oct 13) to $8.00 (Oct 13), TCGplayer market.") === "Together: $5.00 NM (Oct 13) to $8.00 NM (Oct 13), TCGplayer market.");
  t("Near Mint is not added twice", labelPrices("Card $10.00 NM on TCGplayer market.") === "Card $10.00 NM on TCGplayer market.");
  t("the condition note is the shared sentence", CONDITION_NOTE === "Graded and damaged copies can price very differently, and our prices are Near Mint unless labeled." && !CONDITION_NOTE.includes("\u2014"));
  t("hasNumber wants the full fraction", hasNumber("Lugia #108", "108/135") === false && hasNumber("Lugia 108/135", "108/135") === true);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("card-face.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("card face ok");
}
