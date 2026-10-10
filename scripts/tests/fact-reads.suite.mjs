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
    a: { name: "Duraludon", artist: "Ada", price: 2 },
    b: { name: "Duraludon ex", artist: "Bea", price: 9 },
    c: { name: "Duraludon V", artist: "Ada", price: 4 },
  };
  const attrs = { a: { dex: 884 }, b: { dex: 884 }, c: { dex: 884 } };
  const index = buildPokemonIndex(cards, attrs);
  const line = pokemonFactLine(index.get("Duraludon"));
  t("species token strips a mechanic suffix", speciesToken("Duraludon ex") === "Duraludon");
  t("a pokemon line counts cards and distinct artists from the fields", line && line.cardCount === 3 && line.artistCount === 2 && line.dex === 884 && line.readKind === "pokemon" && line.path === "Duraludon (#884): 3 cards, 2 artists.");
  t("the photo id is the highest priced card the fact counted", line && line.sku === "b" && line.cardId === "b");
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
  const watch = JSON.parse(await readFile(join(ROOT, "research/assets/public/feed/watch/0.json"), "utf8"));
  // A 7-day read needs the price from exactly 7 days earlier. When that file
  // is missing, Today is empty on purpose. The percent check then uses Watch.
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
  // The live feed rotates every night. Each stated percent must equal the move
  // between the two prices the same sentence names. Today is empty when no
  // 7-day window has its exact start day, so Watch is the check.
  const pathRx = /from \$([0-9,.]+) on [A-Za-z]+ \d{1,2} to \$([0-9,.]+) on [A-Za-z]+ \d{1,2}, (up|down) ([0-9]+(?:\.[0-9]+)?)%/;
  const liveRows = Array.isArray(today) && today.length ? today : (Array.isArray(watch) ? watch : []);
  const liveBad = [];
  for (const row of liveRows) {
    const m = String(row?.path || "").match(pathRx);
    if (!m) { liveBad.push(`${row?.sku}: no window sentence`); continue; }
    const from = Number(m[1].replace(/,/g, ""));
    const to = Number(m[2].replace(/,/g, ""));
    const sign = m[3] === "up" ? 1 : -1;
    const stated = Number(m[4]);
    const window = from > 0 ? Math.round(Math.abs((to - from) / from) * 1000) / 10 : NaN;
    const ok = from > 0 && to > 0 && (to > from) === (sign > 0)
      && Math.abs(stated - window) <= 0.05
      && Math.abs(sign * stated - Number(row.changePct)) <= 0.05
      && Number(row.windowDays) > 0;
    if (!ok) liveBad.push(`${row.sku}: says ${m[3]} ${stated}%, window ${window}%, changePct ${row.changePct}`);
  }
  t("a window path uses the window percent, not the last print step",
    /from \$115\.08 on Sep 22 to \$124\.16 on Sep 29, up 7\.9%/.test(windowPath)
    && !/2\.8%/.test(windowPath)
    && !/\$120\.82/.test(windowPath)
    && liveBad.length === 0); // no live rows is fine: TCGCSV-only history may qualify none
  if (liveBad.length) console.error("       " + liveBad.slice(0, 5).join("\n       "));

  // Bronzor's last print did not move ($1.16 on Oct 6 and Oct 7) while the
  // 7-day window did ($1.08 on Sep 29 to $1.16). The sentence still states 7.4%.
  const flatLast = pathSentence([
    ["2026-09-29", 1.08],
    ["2026-10-06", 1.16],
    ["2026-10-07", 1.16],
  ], {
    name: "Bronzor (Master Ball Pattern)",
    fromPrice: 1.08,
    fromDate: "2026-09-29",
    toDate: "2026-10-07",
    windowDays: 7,
    direction: "up",
  });
  t("a flat last print still states the window percent",
    flatLast === "Bronzor (Master Ball Pattern) latest price rose from $1.08 on Sep 29 to $1.16 on Oct 7, up 7.4%.");
  // Drapion's last print fell 0.5% ($1.82 to $1.81) while the 7-day window rose 7.1%.
  const opposite = pathSentence([
    ["2026-09-27", 1.69],
    ["2026-10-06", 1.82],
    ["2026-10-07", 1.81],
  ], {
    name: "Drapion V (Full Art)",
    fromPrice: 1.69,
    fromDate: "2026-09-27",
    toDate: "2026-10-07",
    windowDays: 7,
    direction: "up",
  });
  t("an opposite last step does not replace the window percent",
    /rose from \$1\.69 on Sep 27 to \$1\.81 on Oct 7, up 7\.1%/.test(opposite)
    && !/, down 0\.5%/.test(opposite)
    && opposite.indexOf("up 7.1%") < (opposite.indexOf("0.5%") === -1 ? opposite.length : opposite.indexOf("0.5%")));

  return fail;
}

if (process.argv[1] && process.argv[1].endsWith("fact-reads.suite.mjs")) {
  const n = await run();
  if (n) process.exit(1);
  console.log("fact reads ok");
}
