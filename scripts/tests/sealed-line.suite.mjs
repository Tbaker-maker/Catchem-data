import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isOrdinaryPack, pickSealedLine, specialPrintings } from "../lib/sealed-line.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}`); }
  };

  const shadow = { id: "tcgcsv-138132", kind: "sealed", name: "Pokémon Base Set (Shadowless) [1st Edition] Booster Pack", price: 15000 };
  const unlimited = { id: "tcgcsv-138130", kind: "sealed", name: "Base Set Booster Pack [Revised Unlimited Edition]", price: 930.89 };
  const deck = { id: "tcgcsv-136404", kind: "sealed", name: "Base Set Theme Deck - Overgrowth", price: 567.48 };
  t("shadowless 1st edition is a special printing", specialPrintings(shadow.name).join(",") === "shadowless,1st edition");
  t("an unlimited pack is ordinary", isOrdinaryPack(unlimited) && !isOrdinaryPack(shadow) && !isOrdinaryPack(deck));
  const base = pickSealedLine([shadow, deck, unlimited], "Base Set");
  t("ordinary sealed line is chosen over 1st Edition and Shadowless when both exist", base && base.id === "tcgcsv-138130");
  const named = pickSealedLine([shadow, unlimited], "Base Set 1st Edition Shadowless");
  t("a heading that names the printing may keep that printing", named && named.id === "tcgcsv-138132");
  t("no ordinary pack and an unnamed printing is no line", pickSealedLine([shadow], "Base Set") === null);
  const pc = { id: "pc", kind: "sealed", name: "Prismatic Evolutions Pokémon Center Elite Trainer Box (Exclusive) Case", price: 2748.62 };
  const bundle = { id: "bundle", kind: "sealed", name: "Prismatic Evolutions Booster Pack Art Bundle [Set of 4]", price: 59.4 };
  const pack = { id: "pack", kind: "sealed", name: "Prismatic Evolutions Booster Pack", price: 14.58 };
  const prism = pickSealedLine([pc, bundle, pack], "SV: Prismatic Evolutions");
  t("a Pokémon Center case is not the line when a loose pack exists", prism && prism.id === "pack");
  const box = { id: "box", kind: "sealed", name: "Lost Origin Booster Box", price: 400 };
  const loose = { id: "loose", kind: "sealed", name: "Lost Origin Booster Pack", price: 12 };
  t("a box that is not a special printing stays the line", pickSealedLine([box, loose], "SWSH11: Lost Origin").id === "box");
  const plain = { id: "plain-unlimited", kind: "sealed", name: "Pokemon Base Set [Unlimited Edition] Booster Pack", price: 1200 };
  const revisedDear = { id: "tcgcsv-138130", kind: "sealed", name: "Base Set Booster Pack [Revised Unlimited Edition]", price: 2000 };
  const overRevised = pickSealedLine([shadow, unlimited, plain], "Base Set");
  t("a plain Unlimited pack is chosen over Revised when both exist", overRevised && overRevised.id === "plain-unlimited");
  const dearRevised = pickSealedLine([revisedDear, { ...plain, price: 400 }], "Base Set");
  t("a dearer Revised pack still loses to a plain Unlimited pack", dearRevised && dearRevised.id === "plain-unlimited");
  const shadowUnlimited = { id: "tcgcsv-138131", kind: "sealed", name: "Pokemon Base Set (Shadowless) [Unlimited Edition] Booster Pack", price: 5000 };
  const notShadow = pickSealedLine([shadowUnlimited, unlimited], "Base Set");
  t("a Shadowless Unlimited pack is not the plain Unlimited pack", notShadow && notShadow.id === "tcgcsv-138130");

  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const basePacks = (catalog.items || []).filter((it) => {
    if (it.kind !== "sealed" || !/booster pack/i.test(it.name || "")) return false;
    return it.set === "Base Set" || it.set === "Base Set (Shadowless)";
  });
  const plainInFile = basePacks.filter((it) => /unlimited/i.test(it.name || "") && !/revised|shadowless|1st edition|first edition/i.test(it.name || ""));
  t("tcgcsv-latest has no plain Base Set Unlimited booster pack", plainInFile.length === 0);
  const pricedBase = basePacks.filter((it) => it.set === "Base Set" && Number(it.price) > 0);
  t(
    "the only priced Base Set booster pack in tcgcsv-latest is Revised Unlimited",
    pricedBase.length === 1 && pricedBase[0].id === "tcgcsv-138130" && /Revised Unlimited Edition/.test(pricedBase[0].name),
  );

  const dir = join(ROOT, "research/assets/public/sets");
  const names = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
  let mismatch = 0;
  const gaps = ["2026-09-28", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-04"];
  let filled = 0;
  for (const name of names) {
    const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
    const again = pickSealedLine(doc.items, doc.name);
    if (JSON.stringify(doc.sealedLine) !== JSON.stringify(again)) mismatch += 1;
    for (const point of [...(doc.singleIndex || []), ...(doc.sealedIndex || [])]) {
      if (gaps.includes(point.d) && point.v !== null) filled += 1;
    }
  }
  t("every published set uses the sealed line rule", names.length === 205 && mismatch === 0);
  const baseDoc = JSON.parse(await readFile(join(dir, "base-set.json"), "utf8"));
  t("Base Set is not the 1st Edition Shadowless pack", baseDoc.sealedLine && baseDoc.sealedLine.id !== "tcgcsv-138132" && baseDoc.sealedLine.id === "tcgcsv-138130");
  t("the five missing days stay null on set indexes", filled === 0);
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("sealed-line.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
}
