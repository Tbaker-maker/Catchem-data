import { planNewSets, entryForSet } from "../lib/new-set-bot.mjs";

export async function run() {
  let fail = 0;
  const t = (name, ok) => { if (ok) console.log(`  ok  ${name}`); else { fail += 1; console.error(`  FAIL ${name}`); } };
  const sets = { sets: [
    { slug: "sv01-scarlet-and-violet-base-set", name: "Scarlet & Violet", era: "Scarlet & Violet", release: "2023-03-31", logo: "/img/sv1/logo.png" },
    { slug: "example-new-set", name: "Example New Set", era: "Test", release: "2026-11-01", logo: "/img/exnew/logo.png" },
  ] };
  const products = [
    { id: "sv1-booster-box", name: "Scarlet & Violet Booster Box", set: "Scarlet & Violet", setId: "sv1", subtype: "booster-box" },
    { id: "exnew-etb", name: "Example ETB", set: "Example New Set", setId: "exnew", subtype: "etb" },
    { id: "sv1-new-tin", name: "Scarlet & Violet Tin", set: "Scarlet & Violet", setId: "sv1", subtype: "tin" },
  ];
  const first = planNewSets({ sets, products, registry: null, pullSlugs: new Set(["sv01-scarlet-and-violet-base-set"]) });
  t("first run seeds and does not flood", first.seed === true && first.flags.length === 0 && first.registry.setSlugs.length === 2);
  const second = planNewSets({
    sets, products,
    registry: { seeded: true, setSlugs: ["sv01-scarlet-and-violet-base-set"], productIds: ["sv1-booster-box"] },
    pullSlugs: new Set(["sv01-scarlet-and-violet-base-set"]),
  });
  t("a new set is flagged", second.flags.some((f) => f.type === "new-set" && f.setSlug === "example-new-set"));
  t("logo queue does not write an image", second.logoQueue.length === 1 && /does not write an image/.test(second.logoQueue[0].reason));
  t("pull rates queued when the set has no row", second.pullQueue.some((q) => q.setSlug === "example-new-set"));
  const entry = second.entries.find((e) => e.kind === "set");
  t("entry has release, era, set code, and products", entry.era === "Test" && entry.release === "2026-11-01" && entry.setCode === "exnew" && entry.productList.some((p) => p.id === "exnew-etb"));
  t("a new product on a known set is flagged", second.flags.some((f) => f.type === "new-sealed-product" && f.id === "sv1-new-tin"));
  const quiet = planNewSets({ sets, products, registry: second.registry, pullSlugs: new Set(["sv01-scarlet-and-violet-base-set"]) });
  t("the next run is quiet", quiet.flags.length === 0 && quiet.entries.length === 0);
  const one = entryForSet(sets.sets[0], products);
  t("known set entry lists its box", one.productList.some((p) => p.id === "sv1-booster-box"));
  const blob = JSON.stringify(second);
  t("no em dash in the plan", !blob.includes("\u2014"));
  return fail;
}
