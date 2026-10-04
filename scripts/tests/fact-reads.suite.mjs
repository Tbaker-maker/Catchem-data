import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPokemonIndex, pokemonFactLine, pullCostLine, speciesToken } from "../lib/fact-reads.mjs";
import { pathSentence } from "../lib/public-bundle.mjs";

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
  const today = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/today/0.json"), "utf8"));
  const chaos = today.find((row) => row.sku === "tcgcsv-684452");
  // The percent is the price move across the window, not the last print and
  // not a share of today's listings. $120.82 on Sep 27 to $124.16 on Sep 29
  // is the last step (2.8%). $115.08 on Sep 22 to $124.16 on Sep 29 is the window (7.9%).
  const windowPath = pathSentence([
    ["2026-09-22", 115.08],
    ["2026-09-27", 120.82],
    ["2026-09-29", 124.16],
  ], {
    name: "Chaos Rising Pokémon Center Elite Trainer Box",
    fromPrice: 115.08,
    fromDate: "2026-09-22",
    toDate: "2026-09-29",
    windowDays: 7,
    direction: "up",
  });
  const liveMove = String(chaos?.path || "").match(/from \$([0-9,.]+) on [A-Za-z]+ \d{1,2} to \$([0-9,.]+) on [A-Za-z]+ \d{1,2}, up ([0-9]+(?:\.[0-9]+)?)%/);
  const liveFrom = liveMove ? Number(liveMove[1].replace(/,/g, "")) : NaN;
  const liveTo = liveMove ? Number(liveMove[2].replace(/,/g, "")) : NaN;
  const liveStated = liveMove ? Number(liveMove[3]) : NaN;
  const liveWindow = liveFrom > 0 ? Math.round(Math.abs((liveTo - liveFrom) / liveFrom) * 1000) / 10 : NaN;
  t("a window path uses the window percent, not the last print step",
    /from \$115\.08 on Sep 22 to \$124\.16 on Sep 29, up 7\.9%/.test(windowPath)
    && !/2\.8%/.test(windowPath)
    && !/\$120\.82/.test(windowPath)
    && chaos
    && liveMove
    && Math.abs(liveStated - liveWindow) <= 0.05
    && Math.abs(liveStated - Number(chaos.changePct)) <= 0.05
    && Number(chaos.windowDays) > 0);

  return fail;
}

if (process.argv[1] && import.meta.url.endsWith("fact-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("fact reads ok");
}
