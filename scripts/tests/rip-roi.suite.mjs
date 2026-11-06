import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cardInPool } from "../lib/pull-rate-pools.mjs";
import {
  packsFor, productPacksOk, packEV, scoreProduct, bulkFloorForSet, buildSlots, bannedCopy, SIMS, median, poolMean,
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
  t("banned words caught", bannedCopy("buy this now") === true && bannedCopy("you should buy this box") === true && bannedCopy("Buy on eBay") === false && bannedCopy("Rip value estimate") === false);

  const doc = JSON.parse(await readFile(join(ROOT, "data/pull-rates.json"), "utf8"));
  t("pull-rates file has rows and noSource list", Array.isArray(doc.rows) && Array.isArray(doc.noSource));
  t("median helper", median([1, 2, 3]) === 2 && median([]) == null);

  const setCards = [
    { name: "Pikachu V", rarity: "Ultra Rare", tags: [], price: 4, num: "1" },
    { name: "Pikachu VMAX", rarity: "Ultra Rare", tags: [], price: 8, num: "2" },
    { name: "Pikachu V (Full Art)", rarity: "Ultra Rare", tags: ["Full Art"], price: 12, num: "3" },
    { name: "Pikachu V (Alternate Full Art)", rarity: "Ultra Rare", tags: ["Alternate Art"], price: 90, num: "4" },
    { name: "Pikachu VMAX (Secret)", rarity: "Secret Rare", tags: [], price: 20, num: "180" },
    { name: "Marnie (Secret)", rarity: "Secret Rare", tags: [], price: 6, num: "181" },
    { name: "Marnie (Full Art)", rarity: "Ultra Rare", tags: ["Full Art"], price: 3, num: "170" },
    { name: "Quick Ball (Secret)", rarity: "Secret Rare", tags: [], price: 2, num: "190" },
    { name: "Zacian V (Secret)", rarity: "Secret Rare", tags: [], price: 15, num: "191" },
    { name: "Gengar VMAX (Alternate Art Secret)", rarity: "Secret Rare", tags: ["Alternate Art"], price: 400, num: "200" },
  ];
  const inPool = (pool) => setCards.filter((c) => cardInPool(c, pool, setCards)).map((c) => c.name);
  t("V pool excludes VMAX and full art", inPool("swsh-v").join(",") === "Pikachu V");
  t("VMAX pool is only the plain VMAX", inPool("swsh-vmax").join(",") === "Pikachu VMAX");
  t("full art pool excludes alt art", inPool("swsh-full-art").join(",") === "Pikachu V (Full Art),Marnie (Full Art)");
  t("rainbow pool is VMAX secret and trainer secret", inPool("swsh-rainbow").sort().join(",") === "Marnie (Secret),Pikachu VMAX (Secret)");
  t("gold pool is the item and the gold V, not the alt", inPool("swsh-gold").sort().join(",") === "Quick Ball (Secret),Zacian V (Secret)");
  const lone = [{ name: "Alcremie VMAX (Secret)", rarity: "Secret Rare", tags: [], price: 3, num: "73" }];
  t("a lone VMAX secret is the gold card", cardInPool(lone[0], "swsh-gold", lone) === true && cardInPool(lone[0], "swsh-rainbow", lone) === false);

  // Evolving Skies secret alts, catalog prices on 2026-10-30. The middle card
  // is Leafeon at 373.32. Umbreon at 2209.75 and Rayquaza at 1241.76 are in the
  // same pool. A median slot price drops both chase cards.
  const esSecret = [293.31, 361.5, 373.32, 1241.76, 2209.75].map((price, i) => ({
    setSlug: "swsh07-evolving-skies",
    rarity: "Secret Rare",
    tags: ["Alternate Art"],
    name: `Alt VMAX ${i}`,
    price,
  }));
  const esPull = [{
    setSlug: "swsh07-evolving-skies",
    rarity: "Secret Rare",
    tag: "Alternate Art",
    articleRarity: "Alt-Art Pokémon VMAX",
    pct: 0.3,
    sourceUrl: "https://www.tcgplayer.com/content/article/Pokemon-TCG-Evolving-Skies-Pull-Rates/6a743d7b-e5ee-4fd6-9d18-64a636990e8c/",
    published: "2024-08-27",
  }];
  const esSlots = buildSlots(esPull, esSecret, "swsh07-evolving-skies").slots;
  const esMean = poolMean(esSecret.map((c) => c.price));
  const esMed = median(esSecret.map((c) => c.price));
  t("Evolving Skies secret alt slot is the mean", esSlots.length === 1 && esSlots[0].nCards === 5 && esSlots[0].avgPrice === Math.round(esMean * 100) / 100 && esSlots[0].avgPrice === 895.93);
  t("Evolving Skies secret alt slot is not the median", esSlots[0].avgPrice !== 373.32 && esMed === 373.32 && esSlots[0].ev > 2);
  const esBox = scoreProduct({
    product: { id: "swsh7-booster-box", name: "Evolving Skies Booster Box", set: "Evolving Skies", setId: "swsh7", setSlug: "swsh07-evolving-skies", subtype: "booster-box" },
    price: 2147.19,
    packs: 36,
    slots: esSlots,
    bulk: { perCard: 0.12, cardsPerPack: 9 },
    rare: { avg: 0.25, n: 39 },
    seed: 1,
  });
  const esPack = packEV(esSlots, { perCard: 0.12, cardsPerPack: 9 }, { avg: 0.25 });
  t("Evolving Skies box rip value uses that mean", esBox.contentsEV === Math.round(esPack.total * 36 * 100) / 100 && esBox.contentsEV > 120);

  const bucketDir = join(ROOT, "research/assets/public/buckets");
  const bucketFiles = (await readdir(bucketDir)).filter((n) => n.endsWith(".json"));
  const esCards = [];
  for (const name of bucketFiles) {
    const rows = JSON.parse(await readFile(join(bucketDir, name), "utf8"));
    for (const row of rows) {
      if (row.setSlug !== "swsh07-evolving-skies" || row.kind === "sealed") continue;
      esCards.push(row);
    }
  }
  const pricedSecret = esCards.filter((c) => c.rarity === "Secret Rare" && (c.tags || []).includes("Alternate Art") && c.price > 0);
  const unpricedSecret = esCards.filter((c) => c.rarity === "Secret Rare" && (c.tags || []).includes("Alternate Art") && !(c.price > 0));
  const umbreon = esCards.find((c) => c.id === "tcgcsv-246723");
  const pullDoc = JSON.parse(await readFile(join(ROOT, "data/pull-rates.json"), "utf8"));
  const catalogSlots = buildSlots(pullDoc.rows, esCards.map((c) => ({
    id: c.id, name: c.name || "", setSlug: c.setSlug, rarity: c.rarity || "", tags: c.tags || [], price: c.price,
  })), "swsh07-evolving-skies").slots;
  const catalogSecret = catalogSlots.find((s) => s.rarity === "Secret Rare" && s.tag === "Alternate Art");
  const catalogMean = Math.round(poolMean(pricedSecret.map((c) => c.price)) * 100) / 100;
  t("catalog Umbreon alt has a market price", umbreon && umbreon.name === "Umbreon VMAX (Alternate Art Secret)" && umbreon.price > 1000 && umbreon.asOf === "2026-10-30");
  t("unpriced alt is left out", unpricedSecret.some((c) => c.id === "tcgcsv-246754") && catalogSecret && catalogSecret.nCards === pricedSecret.length && !pricedSecret.some((c) => c.id === "tcgcsv-246754"));
  t("catalog secret alt slot matches the priced mean", catalogSecret && catalogSecret.avgPrice === catalogMean && catalogMean > 800 && catalogSecret.avgPrice !== median(pricedSecret.map((c) => c.price)));
  const ripDoc = JSON.parse(await readFile(join(ROOT, "data/derived/rip-roi.json"), "utf8"));
  const ripBox = (ripDoc.rows || []).find((r) => r.id === "swsh7-booster-box");
  const ripSecret = (ripBox?.slots || []).find((s) => s.rarity === "Secret Rare" && s.tag === "Alternate Art");
  const catalog = JSON.parse(await readFile(join(ROOT, "data/catalog/tcgcsv-latest.json"), "utf8"));
  const sealed = (catalog.items || []).find((item) => item.id === "tcgcsv-242436");
  t("published Evolving Skies box uses the catalog mean", ripBox && ripSecret && sealed && ripSecret.avgPrice === catalogMean && ripSecret.nCards === pricedSecret.length && ripBox.price === sealed.price && ripBox.priceAsOf === String(sealed.asOf).slice(0, 10) && ripBox.contentsEV > 200);

  return fail;
}
