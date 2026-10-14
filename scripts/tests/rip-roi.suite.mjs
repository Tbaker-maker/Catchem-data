import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  packsFor, productPacksOk, packEV, scoreProduct, bulkFloorForSet, buildSlots, bannedCopy, SIMS, median,
} from "../lib/rip-roi.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };

  t("box is 36 packs", packsFor({ subtype: "booster-box", setId: "sv8" }) === 36);
  t("SV ETB is 9 packs", packsFor({ subtype: "etb", setId: "sv8" }) === 9);
  t("SWSH ETB is 8 packs", packsFor({ subtype: "etb", setId: "swsh7" }) === 8);
  t("bundle is 6", packsFor({ subtype: "booster-bundle", setId: "sv8" }) === 6);
  t("tin has no fixed count", packsFor({ subtype: "tin", setId: "sv8" }) == null);
  t("half box and display skipped", productPacksOk({ name: "Twilight Masquerade Half Booster Box" }) === false && productPacksOk({ name: "Prismatic Evolutions Booster Bundle Display" }) === false);
  t("plain box ok", productPacksOk({ name: "Journey Together Booster Box" }) === true);

  const singles = [
    ...Array.from({ length: 10 }, (_, i) => ({ setSlug: "sv08-surging-sparks", rarity: "Common", price: 0.1 + i * 0.01, tags: [], name: `C${i}` })),
    ...Array.from({ length: 8 }, (_, i) => ({ setSlug: "sv08-surging-sparks", rarity: "Uncommon", price: 0.2 + i * 0.02, tags: [], name: `U${i}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ setSlug: "sv08-surging-sparks", rarity: "Rare", price: 1 + i, tags: [], name: `R${i}` })),
    ...Array.from({ length: 4 }, (_, i) => ({ setSlug: "sv08-surging-sparks", rarity: "Illustration Rare", price: 20 + i * 5, tags: [], name: `IR${i}` })),
  ];
  const bulk = bulkFloorForSet(singles, "sv08-surging-sparks");
  t("bulk floor from Common and Uncommon", bulk.perCard > 0 && bulk.n === 18 && bulk.cardsPerPack === 9);

  const pullRows = [{
    setSlug: "sv08-surging-sparks", rarity: "Illustration Rare", tag: null, pct: 10,
    sourceUrl: "https://example.com/rates", published: "2024-11-08",
  }];
  const { slots, sources } = buildSlots(pullRows, singles, "sv08-surging-sparks");
  t("slot uses average of rarity pool", slots.length === 1 && slots[0].avgPrice > 0 && sources[0].url.startsWith("https://"));

  const pev = packEV(slots, bulk, { avg: 2, n: 5 });
  t("pack EV sums hits, bulk, and rare slot", pev.total === Math.round((pev.hits + pev.bulk + pev.rare) * 100) / 100);

  const scored = scoreProduct({
    product: { id: "sv8-etb", name: "Surging Sparks ETB", set: "Surging Sparks", setId: "sv8", setSlug: "sv08-surging-sparks", subtype: "etb" },
    price: 50,
    packs: 9,
    slots,
    bulk,
    rare: { avg: 2, n: 5 },
    seed: 1,
  });
  t("ROI is (contentsEV/price - 1)", Math.abs(scored.roiPct - Math.round(((scored.contentsEV / 50) - 1) * 1000) / 10) < 0.01);
  t("Monte Carlo runs 10k sims", scored.sims === SIMS && scored.beatChance >= 0 && scored.beatChance <= 100);
  t("median is finite", Number.isFinite(scored.median));
  t("label stays Rip value", scored.label == null); // label set in build script
  t("banned words caught", bannedCopy("buy this box") === true && bannedCopy("Rip value estimate") === false);

  const doc = JSON.parse(await readFile(join(ROOT, "data/pull-rates.json"), "utf8"));
  t("pull-rates file has rows and noSource list", Array.isArray(doc.rows) && Array.isArray(doc.noSource));
  t("median helper", median([1, 2, 3]) === 2 && median([]) == null);

  return fail;
}
