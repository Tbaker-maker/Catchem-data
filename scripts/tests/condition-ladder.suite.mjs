import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nmForIndex, publishConditionCards, readLinePrice, splitPrintingPrices } from "../lib/condition-prices.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const cfg = { minListings: 3, minRatio: 0.8, maxRatio: 1.2 };

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  const modern = splitPrintingPrices({
    "Holofoil / Near Mint": 10,
    "Holofoil / Lightly Played": 8,
    "Holofoil / Moderately Played": 6,
    "Holofoil / Heavily Played": 4,
    "Holofoil / Damaged": 2,
    market: 99,
  }, "2026-10-17");
  t("a modern printing keeps all five conditions and not the market",
    modern.Holofoil.NM === 10 && modern.Holofoil.LP === 8 && modern.Holofoil.MP === 6 && modern.Holofoil.HP === 4 && modern.Holofoil.DMG === 2 && !modern.market && !modern.Holofoil.market);

  const mixed = splitPrintingPrices({
    "1st Edition Holofoil / Near Mint": 200,
    "Unlimited Holofoil / Lightly Played": 40,
    "Near Mint": 5,
  }, "2026-10-17");
  t("1st Edition and Unlimited stay apart and a bare condition is dropped",
    mixed["1st Edition Holofoil"].NM === 200 && mixed["Unlimited Holofoil"].LP === 40 && !mixed["1st Edition Holofoil"].LP && !mixed["Unlimited Holofoil"].NM && Object.keys(mixed).length === 2);

  const pub = publishConditionCards([
    { id: "modern", kind: "single", printing: "Holofoil", release: "2024-01-01", conditions: { "Holofoil / Near Mint": 10, "Holofoil / Lightly Played": 8, "Holofoil / Moderately Played": 6, "Holofoil / Heavily Played": 4, "Holofoil / Damaged": 2, market: 99 } },
    { id: "nm-only", kind: "single", printing: "Normal", release: "2024-01-01", conditions: { "Normal / Near Mint": 3, market: 9 } },
    { id: "played", kind: "single", printing: "Holofoil", release: "1999-01-09", conditions: { "Holofoil / Lightly Played": 12, "Holofoil / Moderately Played": 7, "Holofoil / Near Mint": 30 } },
    { id: "sealed", kind: "sealed", printing: "Holofoil", release: "2024-01-01", conditions: { "Holofoil / Near Mint": 100 } },
    { id: "flagged", kind: "single", printing: "Normal", release: "2024-01-01", unverified: true, conditions: { "Normal / Near Mint": 4 } },
  ], {
    asks: { "played|Holofoil|LP": [11, 12, 13], "played|Holofoil|MP": [6, 7, 8] },
    cfg,
    asOf: "2026-10-17",
  });
  const hol = pub.doc.cards.modern.Holofoil;
  t("five modern conditions publish", hol.NM === 10 && hol.LP === 8 && hol.MP === 6 && hol.HP === 4 && hol.DMG === 2 && pub.doc.cards.modern.Holofoil.market == null);
  t("NM only stays NM and the market is not NM", pub.doc.cards["nm-only"].Normal.NM === 3 && !pub.doc.cards["nm-only"].Normal.LP);
  const played = pub.doc.cards.played.Holofoil;
  t("vintage LP and MP publish when listings agree and NM without listings does not", played.LP === 12 && played.MP === 7 && !played.NM);
  t("sealed and an unverified single are not published", !pub.doc.cards.sealed && !pub.doc.cards.flagged);
  t("the public note has no dash and no band", !/[\u2014\u2013]/.test(JSON.stringify(pub.doc)) && !JSON.stringify(pub.doc).includes("0.8") && pub.doc.source === "TCGplayer market");

  const blocked = publishConditionCards([
    { id: "played", kind: "single", printing: "Holofoil", release: "1999-01-09", conditions: { "Holofoil / Lightly Played": 12, "Holofoil / Moderately Played": 7 } },
  ], { asks: {}, cfg, asOf: "2026-10-17" });
  t("vintage without a listing sample is not a chip price", !blocked.doc.cards.played && blocked.sweep.vintage.checking === 1 && blocked.sweep.vintage.LP === 0);

  t("an index uses NM only", nmForIndex(pub.doc.cards.modern, "Holofoil") === 10 && nmForIndex(pub.doc.cards.played, "Holofoil") === null);
  t("a read names LP when NM is missing and never copies LP into NM",
    readLinePrice(blocked.doc.cards.played, "Holofoil") === null
    && readLinePrice({ Holofoil: { LP: 12, MP: 7 } }, "Holofoil").condition === "LP"
    && readLinePrice({ Holofoil: { LP: 12 } }, "Holofoil").amount === 12);

  const file = JSON.parse(await readFile(join(ROOT, "research/assets/public/condition-prices.json"), "utf8"));
  const sample = JSON.parse(await readFile(join(ROOT, "data/derived/vintage-sample.json"), "utf8"));
  const publishedIds = new Set((sample.rows || []).filter((row) => row && row.published).map((row) => row.id));
  const known = new Set(["NM", "LP", "MP", "HP", "DMG"]);
  let bad = 0;
  for (const [id, body] of Object.entries(file.cards || {})) {
    if (!publishedIds.has(id)) bad += 1;
    for (const slot of Object.values(body || {})) {
      const conds = Object.keys(slot || {}).filter((key) => key !== "date");
      if (!slot || !slot.date || !conds.length) bad += 1;
      for (const key of conds) if (!known.has(key) || !(Number(slot[key]) > 0)) bad += 1;
    }
  }
  const blob = JSON.stringify(file);
  t("published condition prices are only sampled cards that published",
    file.source === "TCGplayer market"
    && Object.keys(file.cards || {}).length === publishedIds.size
    && bad === 0
    && !/pokemonpricetracker|pokemon price tracker/i.test(blob)
    && !/[\u2014\u2013]/.test(blob));
  const sweep = JSON.parse(await readFile(join(ROOT, "data/derived/condition-ladder-sweep.json"), "utf8"));
  t("every tracked single is checking",
    sweep.vintage.checking === sweep.vintage.singles
    && sweep.modern.checking === sweep.modern.singles
    && sweep.undated.checking === sweep.undated.singles
    && sweep.vintage.NM === 0 && sweep.modern.NM === 0 && sweep.vintage.singles > 0 && sweep.modern.singles > 0);
  return fail;
}
