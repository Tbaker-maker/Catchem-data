import { variantTags } from "../lib/variant-tags.mjs";
export function runVariantTagTests(t) {
  const tg = (o, s) => variantTags({ kind: "single", ...o }, { subtypes: s });
  t("variant: Illustration Rare from rarity", tg({ rarity: "Illustration Rare", name: "Fidough - 213/198" }).includes("Illustration Rare"));
  t("variant: Alternate Art from TCGplayer name", tg({ rarity: "Ultra Rare", name: "Umbreon V (Alternate Full Art)" }).join() === "Alternate Art");
  t("variant: Alternate Art Secret too", tg({ rarity: "Secret Rare", name: "Umbreon VMAX (Alternate Art Secret)" }).includes("Alternate Art"));
  t("variant: TG and GG numbers", tg({ number: "TG07/TG30" }).join() === "Trainer Gallery" && tg({ number: "GG16/GG70" }).join() === "Galarian Gallery");
  t("variant: Shiny Vault only in Hidden or Shining Fates", tg({ number: "SV016/SV122", set: "Shining Fates" }).includes("Shiny Vault") && !tg({ number: "SV016/SV122", set: "Other" }).includes("Shiny Vault"));
  t("variant: Tag Team from pokemontcg.io subtype", tg({ name: "Pheromosa & Buzzwole GX" }, ["Basic", "TAG TEAM", "GX"]).join() === "Tag Team");
  t("variant: Reverse Holo printing", tg({ printings: [{ name: "Normal" }, { name: "Reverse Holofoil" }] }).join() === "Reverse Holo");
  t("variant: unsure card stays untagged", tg({ rarity: "Secret Rare", name: "Charizard VMAX (Secret)" }).length === 0);
  t("variant: sealed never tagged", variantTags({ kind: "sealed", rarity: "Promo" }).length === 0);
}
