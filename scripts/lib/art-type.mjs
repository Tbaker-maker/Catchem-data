// One art type per single. Uses the rarity, the printed number, the name,
// and the printing we publish. A card with no special signal is Regular.
// Galarian Gallery numbers (GG) use Alt Art: this list has no separate gallery
// label, and those cards are alternate illustrations outside the main number.
// Amazing Rare is the etched-foil rarity name in our file, so it is Textured
// or Etched, same as a name that says Texture or Etched.
// An Ultra Rare whose printed number is past the set size is the full-art slot
// (225/191). A Full Art name still counts. Alternate art is checked first.

export const ART_TYPES = [
  "Special Illustration Rare",
  "Illustration Rare",
  "Full Art",
  "Alt Art",
  "Trainer Gallery",
  "Textured or Etched",
  "Holo",
  "Reverse Holo",
  "Regular",
];

function numOverSet(num) {
  const m = String(num || "").match(/(\d+)\s*\/\s*(\d+)/);
  return !!(m && Number(m[1]) > Number(m[2]));
}

export function artType(item) {
  if (!item || item.kind === "sealed") return "";
  const rarity = String(item.rarity || "");
  const name = String(item.name || "");
  const num = String(item.num || item.number || "");
  const printing = String(item.printing || "");
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const numU = num.toUpperCase();

  if (rarity === "Special Illustration Rare") return "Special Illustration Rare";
  if (rarity === "Illustration Rare") return "Illustration Rare";
  if (/\btexture\b/i.test(name) || /\betched\b/i.test(name) || rarity === "Amazing Rare") return "Textured or Etched";
  if (/^TG\d/.test(numU) || tags.indexOf("Trainer Gallery") >= 0) return "Trainer Gallery";
  if (/alternate (full )?art/i.test(name) || tags.indexOf("Alternate Art") >= 0 || tags.indexOf("Tag Team (Alternate Art)") >= 0 || /^GG\d/.test(numU) || tags.indexOf("Galarian Gallery") >= 0) return "Alt Art";
  if (/\(full art\)/i.test(name) || (/\bfull art\b/i.test(name) && !/alternate/i.test(name)) || tags.indexOf("Full Art") >= 0 || (rarity === "Ultra Rare" && numOverSet(num))) return "Full Art";
  if (/reverse holofoil/i.test(printing)) return "Reverse Holo";
  if (/holofoil/i.test(printing) || rarity === "Holo Rare" || rarity === "Rare Holo") return "Holo";
  return "Regular";
}
