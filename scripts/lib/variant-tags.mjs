// Variant tags: how a card was made in its set, kept separate from rarity.
// Sources only: TCGplayer rarity and product name, the collector number,
// pokemontcg.io subtypes (data/card-attrs.json via the id map), and printings.
// A card with no clear signal gets no tag. Nothing is guessed from art or price.
const BY_RARITY = {
  "Illustration Rare": "Illustration Rare",
  "Special Illustration Rare": "Special Illustration Rare",
  "Hyper Rare": "Gold",
  "Mega Hyper Rare": "Gold",
  "Rainbow Rare": "Rainbow Rare",
  "Radiant Rare": "Radiant",
  "Prism Rare": "Prism Star",
  "Amazing Rare": "Amazing Rare",
  "Classic Collection": "Classic Collection",
  "Promo": "Promo",
  "ACE SPEC Rare": "ACE SPEC",
  "Shiny Holo Rare": "Shiny",
  "Shiny Rare": "Shiny",
  "Shiny Ultra Rare": "Shiny",
  "Black White Rare": "Black & White Rare",
};
const BY_NAME = [
  [/\(Alternate (Full )?Art( Secret)?\)/i, "Alternate Art"],
  [/\(Full Art\)/i, "Full Art"],
  [/\(Cosmos Holo\)/i, "Cosmos Holo"],
  [/\(Cracked Ice Holo\)/i, "Cracked Ice Holo"],
  [/\(Poke Ball Pattern\)/i, "Poké Ball Pattern"],
  [/\(Master Ball Pattern\)/i, "Master Ball Pattern"],
  [/\(Delta Species\)/i, "Delta Species"],
];
const BY_SUBTYPE = { "TAG TEAM": "Tag Team", "Radiant": "Radiant", "Prism Star": "Prism Star", "ACE SPEC": "ACE SPEC" };
export const TAG_ORDER = ["Special Illustration Rare", "Illustration Rare", "Tag Team (Alternate Art)", "Alternate Art", "Trainer Gallery", "Galarian Gallery", "Shiny Vault", "Gold", "Rainbow Rare", "Full Art", "Tag Team", "Radiant", "Prism Star", "Amazing Rare", "Shiny", "Classic Collection", "Black & White Rare", "ACE SPEC", "Cosmos Holo", "Cracked Ice Holo", "Poké Ball Pattern", "Master Ball Pattern", "Delta Species", "Promo", "Reverse Holo"];

export function variantTags(item, { subtypes = [] } = {}) {
  if (!item || item.kind === "sealed") return [];
  const out = new Set();
  const r = BY_RARITY[item.rarity || ""];
  if (r) out.add(r);
  for (const [re, tag] of BY_NAME) if (re.test(item.name || "")) out.add(tag);
  const num = String(item.number || item.num || "").toUpperCase();
  const release = String(item.release || "");
  if (/^TG\d+/.test(num)) out.add("Trainer Gallery");
  if (/^GG\d+/.test(num)) out.add("Galarian Gallery");
  if (/^SV\d+/.test(num) && /hidden fates|shining fates/i.test(item.set || "")) out.add("Shiny Vault");
  for (const s of subtypes || []) if (BY_SUBTYPE[s]) out.add(BY_SUBTYPE[s]);
  const pr = (item.printings || []).map((p) => p.name || p);
  if (pr.some((p) => /^Reverse Holofoil$/i.test(p)) || /^Reverse Holofoil$/i.test(item.printing || "")) out.add("Reverse Holo");
  void release;
  // Tyler, Oct 12: an SM Tag Team with alternate art is "Tag Team (Alternate Art)".
  // "Alternate Art" alone is the Sword & Shield tag.
  if (out.has("Tag Team") && out.has("Alternate Art")) { out.delete("Tag Team"); out.delete("Alternate Art"); out.add("Tag Team (Alternate Art)"); }
  return TAG_ORDER.filter((t) => out.has(t));
}

export function subtypeIndex(map, attrs) {
  const byTcg = new Map();
  for (const m of map?.mapped || []) {
    const st = attrs?.cards?.[m.catalogueId]?.st;
    if (st && st.length) byTcg.set(m.id, st);
  }
  return byTcg;
}
