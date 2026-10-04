import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPokemonIndex, cutoutSrc, factCutoutReport, pokemonFactLine, pullCostLine, speciesToken } from "../lib/fact-reads.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function run() {
  let fail = 0;
  const t = (name, cond) => {
    if (cond) console.log("  ok ", name);
    else { fail += 1; console.error("  FAIL", name); }
  };

  const missingRate = pullCostLine({
    setName: "Example",
    tier: "SIR",
    oneIn: 36,
    packPrice: 4.5,
    rateText: "no rate here",
    priceText: "pack 4.50",
    rateFile: "rates.json",
    priceFile: "packs.json",
  });
  t("a pull line without the rate in the source file does not ship", missingRate === null);
  const missingPrice = pullCostLine({
    setName: "Example",
    tier: "IR",
    oneIn: 12,
    packPrice: 9.99,
    rateText: "illustration rare pull 1 in 12",
    priceText: "no price",
    rateFile: "rates.json",
    priceFile: "packs.json",
  });
  t("a pull line without the pack price in the source file does not ship", missingPrice === null);
  const traced = pullCostLine({
    setName: "Example",
    tier: "SIR",
    oneIn: 36,
    packPrice: 4.5,
    rateText: "special illustration rare pull 1 in 36",
    priceText: "booster pack 4.50",
    rateFile: "rates.json",
    priceFile: "packs.json",
  });
  t("a pull line ships only when both numbers are in the cited text", traced && traced.cost === 162 && traced.oneIn === 36 && traced.packPrice === 4.5);

  const cards = {
    a: { name: "Duraludon", artist: "Ada" },
    b: { name: "Duraludon ex", artist: "Bea" },
    c: { name: "Duraludon V", artist: "Ada" },
  };
  const attrs = { a: { dex: 884 }, b: { dex: 884 }, c: { dex: 884 } };
  const index = buildPokemonIndex(cards, attrs);
  const line = pokemonFactLine(index.get("Duraludon"));
  t("species token strips a mechanic suffix", speciesToken("Duraludon ex") === "Duraludon");
  t("a pokemon line counts cards and distinct artists from the fields", line && line.cardCount === 3 && line.artistCount === 2 && line.dex === 884 && line.readKind === "pokemon");
  t("a pokemon line does not invent a pronunciation", line && !/pronounced|sounds like/i.test(line.path));

  const reads = JSON.parse(await readFile(join(ROOT, "research/assets/public/reads.json"), "utf8"));
  const catalogue = JSON.parse(await readFile(join(ROOT, "data/card-catalogue.json"), "utf8"));
  const attrDoc = JSON.parse(await readFile(join(ROOT, "data/card-attrs.json"), "utf8"));
  const live = buildPokemonIndex(catalogue.cards || {}, attrDoc.cards || {});
  t("no lead says bigger last step or printed on", (reads.reads || []).every((row) => !/bigger last step|printed on/i.test(String(row.path || "") + String(row.headline || ""))));
  for (const row of reads.reads || []) {
    if (row.readKind !== "pull") continue;
    let rateText = "";
    let priceText = "";
    try {
      rateText = await readFile(join(ROOT, row.sources.rate), "utf8");
      priceText = await readFile(join(ROOT, row.sources.packPrice), "utf8");
    } catch { /* missing source fails the check below */ }
    const again = pullCostLine({
      setName: row.name,
      tier: row.tier,
      oneIn: row.oneIn,
      packPrice: row.packPrice,
      rateText,
      priceText,
      rateFile: row.sources?.rate,
      priceFile: row.sources?.packPrice,
    });
    t(`pull line ${row.id} traces to its source files`, again && again.oneIn === row.oneIn && again.packPrice === row.packPrice && again.path === row.path);
  }
  for (const row of reads.reads || []) {
    if (row.readKind !== "pokemon") continue;
    const fresh = live.get(row.name);
    const built = pokemonFactLine(fresh);
    t(`pokemon line ${row.name} matches the catalogue count`, built && built.cardCount === row.cardCount && built.artistCount === row.artistCount && built.dex === row.dex && built.path === row.path);
  }

  const stepBan = /moved less on the latest step|bigger last step|\bprinted\b|\bstored\b|last print/i;
  t("lead lines do not use a last-step rewrite", (reads.reads || []).every((row) => !stepBan.test(String(row.path || "") + String(row.headline || ""))));
  const feedCat = JSON.parse(await readFile(join(ROOT, "research/assets/public", reads.catalogue || "feed/catalogue.json"), "utf8"));
  const sample = factCutoutReport(
    [{ name: "Aaa" }, { name: "Bbb" }, { name: "Ccc" }],
    { cards: {
      a: { name: "Aaa", kind: "cutout", src: "/cards/visuals/aaa.png" },
      b: { name: "Bbb", image: "https://tcgplayer-cdn.tcgplayer.com/product/1_in_400x400.jpg" },
    } },
  );
  t("a cutout already on the row is named and a card picture is not one", sample.cutout.join() === "Aaa" && sample.missing.join() === "Bbb" && sample.absent.join() === "Ccc" && cutoutSrc({ image: "https://tcgplayer-cdn.tcgplayer.com/x.jpg" }) === "" && cutoutSrc({ kind: "cutout", src: "" }) === "");
  const facts = (reads.reads || []).filter((row) => row.readKind === "pokemon");
  const named = factCutoutReport(facts, feedCat);
  const names = facts.map((row) => row.name);
  const listed = [...named.cutout, ...named.missing, ...named.absent];
  t("every fact name is listed once", names.length === listed.length && names.every((name) => listed.includes(name)));
  t("Talonflame and Gyarados are in the catalogue and the cutout is missing", named.missing.includes("Talonflame") && named.missing.includes("Gyarados") && !named.cutout.includes("Talonflame") && !named.cutout.includes("Gyarados") && !named.absent.includes("Talonflame") && !named.absent.includes("Gyarados"));
  console.log("cutout: " + (named.cutout.join(", ") || "(none)"));
  console.log("missing: " + named.missing.join(", "));
  console.log("not in the catalogue: " + (named.absent.join(", ") || "(none)"));
  const today = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/today/0.json"), "utf8"));
  const chaos = today.find((row) => row.sku === "tcgcsv-684452");
  t("a window path uses the window percent, not the last print step",
    chaos && chaos.changePct === 7.9 && /from \$115\.08 on Sep 22 to \$124\.16 on Sep 29, up 7\.9%/.test(chaos.path) && !/2\.8%/.test(chaos.path) && !/\$120\.82/.test(chaos.path));

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("fact-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("fact reads ok");
}
