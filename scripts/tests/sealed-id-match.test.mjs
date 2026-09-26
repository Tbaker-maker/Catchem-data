import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyQueue, chooseMatch, queueDecision } from "../lib/sealed-id-match.mjs";
import { catalogRowDecision, choosePass2, normSet } from "../lib/sealed-id-pass2.mjs";
import { applySetMap, matchMissingSets } from "../lib/ppt-set-id-match.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
let fail = 0;
const t = (name, cond, detail = "") => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.error("  FAIL", name, detail); }
};

const etb = (id, name, set) => ({ kind: "sealed", subtype: "etb", tcgplayerProductId: id, name, set });

export async function runSealedIdTests() {
  fail = 0;
  const evolutions = { id: "xy12-etb", name: "Evolutions Elite Trainer Box", set: "Evolutions", subtype: "etb" };
  const prismatic = chooseMatch(evolutions, [etb(1, "Prismatic Evolutions Elite Trainer Box", "SV: Prismatic Evolutions")]);
  t("prismatic is not evolutions", prismatic.status === "unmatched");

  const regular = { id: "sv1-etb", name: "Scarlet & Violet Elite Trainer Box", set: "Scarlet & Violet", subtype: "etb" };
  const center = chooseMatch(regular, [{
    kind: "sealed", subtype: "etb", tcgplayerProductId: 2,
    name: "Scarlet & Violet Pokemon Center Elite Trainer Box", set: "Scarlet & Violet",
  }]);
  t("a regular etb is not a pokemon center etb", center.status === "unmatched");

  const skies = { id: "swsh7-etb", name: "Evolving Skies Elite Trainer Box", set: "Evolving Skies", subtype: "etb" };
  const costco = chooseMatch(skies, [etb(3, "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", "Miscellaneous")]);
  t("a costco bundle is not the etb", costco.status === "unmatched");

  const arts = chooseMatch(
    { id: "swsh5-etb", name: "Battle Styles Elite Trainer Box", set: "Battle Styles", subtype: "etb" },
    [
      etb(4, "Battle Styles Elite Trainer Box [Rapid Strike Urshifu] (Blue)", "SWSH05: Battle Styles"),
      etb(5, "Battle Styles Elite Trainer Box [Single Strike Urshifu] (Red)", "SWSH05: Battle Styles"),
    ],
  );
  t("two art etbs stay in review", arts.status === "review");

  const plain = chooseMatch(
    { id: "swsh5-etb", name: "Battle Styles Elite Trainer Box", set: "Battle Styles", subtype: "etb" },
    [etb(6, "Battle Styles Elite Trainer Box", "SWSH05: Battle Styles")],
  );
  t("one plain etb is accepted", plain.status === "accepted" && plain.match.tcgplayerProductId === "6");

  const jungle = chooseMatch(
    { id: "base2-booster-box", name: "Jungle Booster Box", set: "Jungle", subtype: "booster-box" },
    [
      { kind: "sealed", subtype: "booster-box", tcgplayerProductId: 7, name: "Jungle Booster Box [1st Edition]", set: "Jungle" },
      { kind: "sealed", subtype: "booster-box", tcgplayerProductId: 8, name: "Jungle Booster Box [Unlimited Edition]", set: "Jungle" },
    ],
  );
  t("1st and unlimited stay in review", jungle.status === "review");

  const unlimited = chooseMatch(
    { id: "base1-booster-box", name: "Base Set Unlimited Booster Box", set: "Base Set", subtype: "booster-box" },
    [{ kind: "sealed", subtype: "booster-box", tcgplayerProductId: 9, name: "Base Set Booster Box [Revised Unlimited Edition]", set: "Base Set" }],
  );
  t("unlimited in the name accepts that printing", unlimited.status === "accepted" && unlimited.match.tcgplayerProductId === "9");

  t("a display is not queued", queueDecision({ kind: "sealed", subtype: "booster-box", name: "Battle Styles Booster Box Display", tcgplayerProductId: 10 }).status === "skip");
  t("an art pack is review", queueDecision({ kind: "sealed", subtype: "booster-pack", name: "Battle Styles Booster Pack [Eevee]", tcgplayerProductId: 11 }).status === "review");
  t("a plain pack is queued", queueDecision({ kind: "sealed", subtype: "booster-pack", name: "Battle Styles Booster Pack", tcgplayerProductId: 12 }).status === "accepted");

  const applied = applyQueue({
    products: [{ tcgPlayerId: "1", keys: ["already"] }],
    tracked: [{ id: "swsh5-etb", name: "Battle Styles Elite Trainer Box", set: "Battle Styles", subtype: "etb" }],
    catalog: [
      etb(4, "Battle Styles Elite Trainer Box [Rapid Strike Urshifu]", "Battle Styles"),
      etb(5, "Battle Styles Elite Trainer Box [Single Strike Urshifu]", "Battle Styles"),
      { kind: "sealed", subtype: "booster-box", tcgplayerProductId: 20, name: "Astral Radiance Booster Box", set: "Astral Radiance" },
    ],
  });
  t("review art is not given our product key", !applied.products.some((row) => row.keys.includes("swsh5-etb")));
  t("a plain catalog box joins the queue", applied.products.some((row) => row.tcgPlayerId === "20" && row.keys.includes("catalog-20")));

  const sets = matchMissingSets(
    [
      { slug: "mcd19", name: "McDonald's Collection 2019" },
      { slug: "mcd18", name: "McDonald's Collection 2018" },
      { slug: "sve", name: "Scarlet & Violet Energies" },
      { slug: "fut20", name: "Pokémon Futsal Collection" },
      { slug: "tk1a", name: "EX Trainer Kit Latias" },
      { slug: "tk1b", name: "EX Trainer Kit Latios" },
    ],
    [
      { id: "a", name: "McDonald's Promos 2019", cardCount: 12 },
      { id: "b", name: "McDonald's Promos 2018", cardCount: 12 },
      { id: "c", name: "SVE: Scarlet & Violet Energies", cardCount: 40 },
      { id: "d", name: "EX Trainer Kit 1: Latias & Latios", cardCount: 20 },
    ],
  );
  t("2019 mcdonald's is not 2018", sets.mapped.find((row) => row.slug === "mcd19")?.pptSetId === "a");
  t("energies match the sve provider set", sets.mapped.find((row) => row.slug === "sve")?.pptSetId === "c");
  t("futsal is unmatched", sets.unmatched.some((row) => row.slug === "fut20"));
  t("latias and latios are not auto-mapped", !sets.mapped.some((row) => row.slug === "tk1a" || row.slug === "tk1b") && sets.review.some((row) => row.slug === "tk1a"));

  const next = applySetMap({ bySlug: {}, unmatched: [{ slug: "sve", name: "Scarlet & Violet Energies" }], providerOnly: [{ pptSetId: "c", name: "SVE: Scarlet & Violet Energies" }] }, sets.mapped.filter((row) => row.slug === "sve"));
  t("a mapped set leaves the provider-only list", next.bySlug.sve.pptSetId === "c" && next.providerOnly.length === 0);

  const report = JSON.parse(await readFile(join(ROOT, "data/ppt/sealed-id-report.json"), "utf8"));
  const queue = JSON.parse(await readFile(join(ROOT, "scripts/ppt-history-backfill-ids.json"), "utf8"));
  const review = JSON.parse(await readFile(join(ROOT, "data/ppt/sealed-id-review.json"), "utf8"));
  t("queue length matches the report", queue.products.length === report.queueAfter);
  t("review rows were not keyed", review.tracked.every((row) => !queue.products.some((product) => product.keys.includes(row.id))));
  t("seven set slugs were mapped", report.singles.setsMapped === 7 && report.singles.cardsMapped === 88);
  t("the report stores no price", !JSON.stringify(report).includes("\"price\"") && !JSON.stringify(review).includes("unopenedPrice"));

  t("xy evolutions normalizes to evolutions", normSet("XY - Evolutions") === "evolutions");
  t("black and white pack is a clear catalog accept", catalogRowDecision({ name: "Black and White Booster Pack", subtype: "booster-pack", tcgplayerProductId: "98553" }, 1).status === "accepted");
  t("a half booster box stays in review", catalogRowDecision({ name: "Mega Evolution Half Booster Box", subtype: "booster-box", tcgplayerProductId: "644351" }, 1).status === "review");
  const twoArts = choosePass2(
    { id: "xy12-etb", name: "Evolutions Elite Trainer Box", set: "Evolutions", subtype: "etb" },
    [
      etb("123447", "XY Evolutions Elite Trainer Box [Mega Charizard Y]", "XY - Evolutions"),
      etb("123448", "XY Evolutions Elite Trainer Box [Mega Blastoise]", "XY - Evolutions"),
    ],
  );
  t("two art etbs stay in the second pass", twoArts.status === "review" && twoArts.candidates.length === 2);
  const oneBox = choosePass2(
    { id: "swsh10-bb", name: "Astral Radiance Booster Box", set: "Astral Radiance", subtype: "booster-box" },
    [{ kind: "sealed", subtype: "booster-box", tcgplayerProductId: "90", name: "Astral Radiance Booster Box", set: "SWSH10: Astral Radiance" }],
  );
  t("one clear booster box is accepted", oneBox.status === "accepted" && oneBox.confidence >= 0.85 && oneBox.margin >= 0.08);
  const editions = choosePass2(
    { id: "base2-booster-box", name: "Jungle Booster Box", set: "Jungle", subtype: "booster-box" },
    [
      { kind: "sealed", subtype: "booster-box", tcgplayerProductId: "7", name: "Jungle Booster Box [1st Edition]", set: "Jungle" },
      { kind: "sealed", subtype: "booster-box", tcgplayerProductId: "8", name: "Jungle Booster Box [Unlimited Edition]", set: "Jungle" },
    ],
  );
  t("close edition rows stay in review", editions.status === "review");
  const wrongSet = choosePass2(
    { id: "sv1-pc-etb", name: "Scarlet & Violet Base Pokemon Center Elite Trainer Box", set: "Scarlet & Violet", subtype: "pc-etb" },
    [{ kind: "sealed", subtype: "pc-etb", tcgplayerProductId: "501999", name: "151 Pokemon Center Elite Trainer Box (Exclusive)", set: "SV: Scarlet & Violet 151" }],
  );
  t("151 is not the base set pokemon center etb", wrongSet.status !== "accepted");
  const costcoAgain = choosePass2(
    { id: "swsh7-etb", name: "Evolving Skies Elite Trainer Box", set: "Evolving Skies", subtype: "etb" },
    [{ kind: "sealed", subtype: "etb", tcgplayerProductId: "610741", name: "Costco Pokemon Evolving Skies Elite Trainer Box and Tin", set: "Miscellaneous Cards & Products" }],
  );
  t("a costco tin bundle is not the etb", costcoAgain.status !== "accepted");
  const specific = choosePass2(
    { id: "swsh12pt5-premium", name: "Crown Zenith Special Collection", set: "Crown Zenith", subtype: "special-collection" },
    [{ kind: "sealed", subtype: "special-collection", tcgplayerProductId: "454452", name: "Pikachu VMAX Special Collection", set: "SWSH: Crown Zenith" }],
  );
  t("a named collection is not the generic one", specific.status !== "accepted");

  console.log(fail ? `${fail} failed` : "sealed id match ok");
  return fail;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = await runSealedIdTests();
  if (n) process.exit(1);
}
