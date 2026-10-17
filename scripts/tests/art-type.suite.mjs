import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ART_TYPES, artType } from "../lib/art-type.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const ALLOWED = new Set(ART_TYPES);

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("special illustration rare wins", artType({ rarity: "Special Illustration Rare", num: "205/165", printing: "Holofoil" }) === "Special Illustration Rare");
  t("illustration rare wins", artType({ rarity: "Illustration Rare", num: "170/165", printing: "Holofoil" }) === "Illustration Rare");
  t("trainer gallery number", artType({ rarity: "Ultra Rare", num: "TG12/TG30", name: "Pikachu", printing: "Holofoil" }) === "Trainer Gallery");
  t("galarian gallery is alt art", artType({ rarity: "Ultra Rare", num: "GG16/GG70", name: "Absol", printing: "Holofoil" }) === "Alt Art");
  t("alternate art name beats full art words", artType({ rarity: "Ultra Rare", num: "192/203", name: "Dragonite V (Alternate Full Art)", printing: "Holofoil" }) === "Alt Art");
  t("named full art", artType({ rarity: "Ultra Rare", num: "176/203", name: "Arctovish V (Full Art)", printing: "Holofoil" }) === "Full Art");
  t("ultra rare past the set size is full art", artType({ rarity: "Ultra Rare", num: "225/191", name: "Alolan Exeggutor ex", printing: "Holofoil" }) === "Full Art");
  t("ultra rare inside the set stays holo", artType({ rarity: "Ultra Rare", num: "048/203", name: "Arctovish V", printing: "Holofoil" }) === "Holo");
  t("texture name", artType({ rarity: "Ultra Rare", num: "168/159", name: "Fire Energy (Texture Full Art)", printing: "Holofoil" }) === "Textured or Etched");
  t("amazing rare is textured or etched", artType({ rarity: "Amazing Rare", num: "8/185", printing: "Holofoil" }) === "Textured or Etched");
  t("published reverse printing", artType({ rarity: "Common", num: "1/100", printing: "Reverse Holofoil" }) === "Reverse Holo");
  t("a reverse tag on a normal printing is not reverse holo", artType({ rarity: "Common", num: "1/100", printing: "Normal", tags: ["Reverse Holo"] }) === "Regular");
  t("holo rare", artType({ rarity: "Holo Rare", num: "4/102", printing: "Unlimited" }) === "Holo");
  t("common is regular", artType({ rarity: "Common", num: "1/102", printing: "Normal" }) === "Regular");
  t("sealed has no art type", artType({ kind: "sealed", rarity: "Promo", name: "Promo Pack" }) === "");

  const dir = join(ROOT, "research/assets/public/sets");
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json"));
  const totals = Object.fromEntries(ART_TYPES.map((name) => [name, 0]));
  let singles = 0;
  let bad = 0;
  let commonsWithoutRegular = 0;
  const sir = { rarity: 0, tag: 0 };
  const ir = { rarity: 0, tag: 0 };
  for (const file of files) {
    const doc = JSON.parse(await readFile(join(dir, file), "utf8"));
    let regular = 0;
    let normalCommons = 0;
    for (const item of doc.items || []) {
      if (item.kind !== "single") continue;
      singles += 1;
      const art = artType(item);
      if (!ALLOWED.has(art)) bad += 1;
      else totals[art] += 1;
      if (art === "Regular") regular += 1;
      if (item.rarity === "Common" && /^(Normal|Unlimited|1st Edition)$/i.test(String(item.printing || ""))) normalCommons += 1;
      if (item.rarity === "Special Illustration Rare") sir.rarity += 1;
      if (art === "Special Illustration Rare") sir.tag += 1;
      if (item.rarity === "Illustration Rare") ir.rarity += 1;
      if (art === "Illustration Rare") ir.tag += 1;
    }
    if (normalCommons > 0 && regular === 0) commonsWithoutRegular += 1;
  }
  t("every published single has one art type", singles > 1000 && bad === 0 && ART_TYPES.reduce((n, name) => n + totals[name], 0) === singles);
  t("a set with normal commons keeps a regular card", commonsWithoutRegular === 0);
  t("special illustration rare matches the rarity field", sir.rarity > 0 && sir.rarity === sir.tag);
  t("illustration rare matches the rarity field", ir.rarity > 0 && ir.rarity === ir.tag);
  t("regular is the largest tag", totals.Regular > totals.Holo && totals.Regular > totals["Full Art"]);
  if (fail) console.error(JSON.stringify(totals));
  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("art-type.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("art type ok");
}
