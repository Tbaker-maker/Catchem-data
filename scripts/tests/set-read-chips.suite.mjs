// Nov 11: the Ascended Heroes set read ("0 of 29 priced cards up 10% or more")
// carried an SIR art chip, because its sku is the lead card (Pikachu ex 276/217).
// The art type is a card fact, never a set fact.
import { qualifyChips, isSetRead } from "../lib/signal-chips.mjs";

export async function run() {
  let fail = 0;
  const t = (name, cond) => { if (cond) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const ctx = { asOf: "2026-11-11", rarity: "Special Illustration Rare", art: "SIR", artType: "SIR" };
  const setRead = { id: "set30-me-ascended-heroes", sku: "tcgcsv-676088", href: "/c/tcgcsv-676088", readKind: "set", kind: "set", name: "ME: Ascended Heroes", tags: ["Special Illustration Rare"], asOf: "2026-11-11" };
  const cardRead = { ...setRead, id: "move-tcgcsv-676088-30", readKind: "mover", kind: "single", name: "Pikachu ex" };
  t("a set read is a set read", isSetRead(setRead) && !isSetRead(cardRead));
  const cardArt = qualifyChips(cardRead, ctx).some((c) => c.kind === "art");
  t("the lead card's own read can carry its art chip (fixture sanity)", cardArt);
  t("a set read never carries an art chip", !qualifyChips(setRead, ctx).some((c) => c.kind === "art"));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("set-read-chips.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("set read chips ok");
}
