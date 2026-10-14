import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertEverySetLogo, buildCoverage, probeLogo, shouldFill, WATCH } from "../image-coverage.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, cond, detail = "") => {
    if (cond) console.log(`  ok  ${name}`);
    else { fail += 1; console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`); }
  };

  const images = { images: { "base1-4": "/img/base1/4.png", "tcgcsv-1": "/cards/a.png" } };
  const rows = [
    ["base1-4", "Charizard", "Base Set", "4", "", "single"],
    ["tcgcsv-9", "No Picture", "Base Set", "9", "", "single"],
    ["sv1-1", "Sprigatito", "Scarlet", "1", "", "single"],
    ["tcgcsv-2", "Booster Box", "Base Set", "", "", "sealed"],
    ["tcgcsv-3", "Has Catalogue", "Base Set", "", "", "sealed"],
  ];
  images.images["tcgcsv-3"] = "/img/x/logo.png";
  const coverage = buildCoverage({
    sets: { sets: [
      { slug: "base-set", name: "Base Set", logo: "/img/base1/logo.png" },
      { slug: "mee-mega-evolution-energies", name: "MEE", logo: "/img/mee/logo.png" },
      { slug: "blank", name: "Blank", logo: "" },
    ] },
    logos: { logos: {
      "base-set": { kind: "official", logo: "/img/base1/logo.png" },
      "mee-mega-evolution-energies": { kind: "tile", setId: "mee", logo: "/img/mee/logo.png" },
    } },
    images,
    rows,
  });
  t("a catalogue hit and a pokemontcg id are not missing", coverage.cards.length === 1 && coverage.cards[0].id === "tcgcsv-9");
  t("a sealed row with no picture is listed", coverage.sealed.length === 1 && coverage.sealed[0].id === "tcgcsv-2");
  t("an empty logo is missing and a tile is listed apart", coverage.setsMissing.length === 1 && coverage.setsMissing[0].slug === "blank" && coverage.setsTile.length === 1 && coverage.setsTile[0].setId === "mee");

  const denied = await probeLogo(WATCH[0], async () => new Response("no", { status: 403 }));
  t("a refused logo is not a png", denied.status === 403 && denied.png === false);
  t("a tile is not filled from a refusal", shouldFill({ kind: "tile", logo: "/img/mee/logo.png" }, denied) === false);
  t("an official file is never replaced", shouldFill({ logo: "/img/base1/logo.png" }, { status: 200, png: true }) === false);
  t("a tile can be replaced when a png arrives", shouldFill({ kind: "tile", logo: "/img/mee/logo.png" }, { status: 200, png: true }) === true);
  t("an empty logo can be filled", shouldFill(null, { status: 200, png: true }) === true);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  const ok = await probeLogo(WATCH[0], async () => new Response(png, { status: 200 }));
  t("png bytes count as a logo", ok.png === true && ok.status === 200);

  const missing = await assertEverySetLogo(ROOT);
  t("every set on /sets has a logo file", missing.length === 0, missing.slice(0, 8).join(", "));

  const yml = await readFile(join(ROOT, ".github/workflows/image-coverage.yml"), "utf8");
  t("the weekly workflow does not git add", yml.includes("cron:") && yml.includes("image-coverage.mjs") && !/git add/.test(yml));
  t("the watch list names the mee series logo only", WATCH.length === 1 && WATCH[0].id === "mee" && WATCH[0].url.endsWith("/mee/mee_logo_169_en.png"));

  return fail;
}
