import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hostAllowed, isSetLogo, productTypeOf, nameAgrees, sourceFor, targetHeight, judgeCut, cutoutRow,
} from "../lib/sealed-cutouts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? " " + detail : ""}`); }
  };

  t("tcgplayer cdn and pokemontcg are allowed", hostAllowed("https://tcgplayer-cdn.tcgplayer.com/product/1_in_1000x1000.jpg") && hostAllowed("https://images.pokemontcg.io/swsh11/logo.png"));
  t("pokemon.com is allowed", hostAllowed("https://www.pokemon.com/us/x.png") && hostAllowed("https://assets.pokemon.com/a.png"));
  t("ebay is not allowed", !hostAllowed("https://i.ebayimg.com/images/g/abc.jpg"));
  t("a set logo is not a product photo", isSetLogo("https://images.pokemontcg.io/swsh11/logo.png"));

  const etb = { id: "swsh11-etb", name: "Lost Origin Elite Trainer Box", subtype: "etb", tcgPlayerId: 277335, image: "https://images.pokemontcg.io/swsh11/logo.png" };
  const src = sourceFor(etb);
  t("a catalog id beats the set logo", src.url === "https://tcgplayer-cdn.tcgplayer.com/product/277335_in_1000x1000.jpg" && src.reason === "");
  t("a logo with no catalog id is refused", sourceFor({ id: "base1-booster-box", name: "Base Set Booster Box", subtype: "booster-box", image: "https://images.pokemontcg.io/base1/logo.png" }).reason === "set logo is not the product");
  t("an ebay photo is refused", sourceFor({ id: "x", name: "Tin", subtype: "tin", representativeImage: "https://i.ebayimg.com/images/g/abc.jpg" }).reason === "photo host is not allowed");
  t("an embedded tcgcsv id is a catalog photo", sourceFor({ id: "tcgcsv-692583", name: "Costco Scarlet & Violet 151 Zapdos ex & Alakazam ex Bundle" }).url.includes("/product/692583_"));
  t("a reviewed none override wins", sourceFor(etb, { overrides: { "swsh11-etb": { use: "none" } } }).reason === "reviewed as no photo");

  t("pc etb is not typed as a plain etb", productTypeOf({ name: "Lost Origin Pokemon Center Elite Trainer Box", subtype: "pc-etb" }) === "pc-etb");
  t("name must match the type", nameAgrees("Lost Origin Elite Trainer Box", "etb") && !nameAgrees("Lost Origin Pokemon Center Elite Trainer Box", "etb"));
  t("a pack name is not a booster box", !nameAgrees("Lost Origin Booster Pack", "booster-box"));

  const scale = { height: { etb: 0.5, "booster-box": 1, "booster-pack": 0.25 } };
  t("height comes from the given factors", targetHeight("etb", scale, 800) === 400 && targetHeight("booster-box", scale, 800) === 800);
  t("a missing factor is not invented", targetHeight("tin", scale, 800) === null);

  t("a clean cut passes", judgeCut({ download: true }).length === 0);
  t("jagged, blur, and a clipped corner fail", judgeCut({ jagged: true, blur: true, clipped: true }).join(",") === "jagged edges,missing corners,obvious blur");
  const bad = cutoutRow(etb, { pass: false, productType: "etb", file: "cutouts/no.webp" });
  t("a failed row keeps no file", bad.pass === false && bad.file == null && bad.png == null);
  const good = cutoutRow(etb, { pass: true, productType: "etb", file: "cutouts/swsh11-etb.webp", png: "cutouts/swsh11-etb.png", width: 10, height: 20 });
  t("a pass row records the file and the site id", good.pass === true && good.file.endsWith(".webp") && good.siteId === "tcgcsv-277335" && good.width === 10);

  const lib = await readFile(join(HERE, "../lib/sealed-cutouts.mjs"), "utf8");
  t("the public lib has no scale table", !/booster-box"\s*:\s*0\./.test(lib) && !lib.includes("cutout-scale.json"));
  t("reasons use no em or en dash", !/[\u2013\u2014]/.test(lib));

  return fail;
}
