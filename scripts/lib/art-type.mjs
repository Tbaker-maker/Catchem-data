// One art type per single. Uses the rarity, the printed number, the name,
// and the printing we publish. A card with no special signal is Regular.
// Galarian Gallery numbers (GG) use Alt Art: this list has no separate gallery
// label, and those cards are alternate illustrations outside the main number.
// Amazing Rare is the etched-foil rarity name in our file, so it is Textured
// or Etched, same as a name that says Texture or Etched.
// An Ultra Rare whose printed number is past the set size is the full-art slot
// (225/191). A Full Art name still counts. Alternate art is checked first.
//
// String checks only. This function is copied into a page template on the site,
// and a regex literal there loses its backslashes.

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

function hasWord(text, word) {
  const raw = String(text || "").toLowerCase();
  const want = String(word || "").toLowerCase();
  if (!want) return false;
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && !isLetter(raw.charAt(i))) i++;
    let j = i;
    while (j < raw.length && isLetter(raw.charAt(j))) j++;
    if (raw.slice(i, j) === want) return true;
    i = j;
  }
  return false;
}

function isLetter(ch) {
  return (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
}

function numOverSet(num) {
  const s = String(num || "");
  const slash = s.indexOf("/");
  if (slash < 0) return false;
  let a = "";
  let b = "";
  let i = slash - 1;
  while (i >= 0 && s.charAt(i) >= "0" && s.charAt(i) <= "9") { a = s.charAt(i) + a; i--; }
  i = slash + 1;
  while (i < s.length && (s.charAt(i) === " " || s.charAt(i) === "\t")) i++;
  while (i < s.length && s.charAt(i) >= "0" && s.charAt(i) <= "9") { b += s.charAt(i); i++; }
  if (!a || !b) return false;
  return Number(a) > Number(b);
}

function startsCode(num, code) {
  const u = String(num || "").toUpperCase().replace(/^\s+/, "");
  if (u.slice(0, code.length) !== code) return false;
  const next = u.charAt(code.length);
  return next >= "0" && next <= "9";
}

export function artType(item) {
  if (!item || item.kind === "sealed") return "";
  const rarity = String(item.rarity || "");
  const name = String(item.name || "");
  const num = String(item.num || item.number || "");
  const printing = String(item.printing || "").toLowerCase();
  const tags = Array.isArray(item.tags) ? item.tags : [];
  const nameLow = name.toLowerCase();

  if (rarity === "Special Illustration Rare") return "Special Illustration Rare";
  if (rarity === "Illustration Rare") return "Illustration Rare";
  if (hasWord(name, "texture") || hasWord(name, "etched") || rarity === "Amazing Rare") return "Textured or Etched";
  if (startsCode(num, "TG") || tags.indexOf("Trainer Gallery") >= 0) return "Trainer Gallery";
  if (nameLow.indexOf("alternate art") >= 0 || nameLow.indexOf("alternate full art") >= 0 || tags.indexOf("Alternate Art") >= 0 || tags.indexOf("Tag Team (Alternate Art)") >= 0 || startsCode(num, "GG") || tags.indexOf("Galarian Gallery") >= 0) return "Alt Art";
  if (nameLow.indexOf("(full art)") >= 0 || (hasWord(name, "full") && hasWord(name, "art") && nameLow.indexOf("alternate") < 0) || tags.indexOf("Full Art") >= 0 || (rarity === "Ultra Rare" && numOverSet(num))) return "Full Art";
  if (printing.indexOf("reverse holofoil") >= 0) return "Reverse Holo";
  if (printing.indexOf("holofoil") >= 0 || rarity === "Holo Rare" || rarity === "Rare Holo") return "Holo";
  return "Regular";
}
