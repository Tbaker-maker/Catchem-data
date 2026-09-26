// Name checks for TCGplayer matches. A failed check is left unmatched.
// Nothing here invents a product id.

const STOP = new Set(["pokemon", "pokémon", "tcg", "the", "and", "with", "sealed", "english", "new"]);

export function words(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}

export function rejectReason(product, matchedName) {
  const ours = String(product?.name || "");
  const matched = String(matchedName || "");
  const ol = ours.toLowerCase();
  const ml = matched.toLowerCase();
  if (!matched.trim()) return "no TCGplayer name to check";
  if (/japanese|\bjapan\b|\bjp\b|korean|chinese/.test(ml)) return "matched name is not an English product";
  if (/mini[\s-]?pack|gravity/.test(ml)) return "matched name is a mini-pack box";
  if (/\bcase\b|set of 2|code card/.test(ml) && !/\bcase\b/.test(ol)) return "matched name is a case or a multi-box, not one item";
  if (ml.includes("prismatic") && !ol.includes("prismatic")) return "this is Prismatic Evolutions, a different set from Evolutions";
  if (ol.includes("prismatic") && !ml.includes("prismatic")) return "our product is Prismatic Evolutions and the match is not";
  const oursPc = product?.subtype === "pc-etb" || /pok[eé]mon center/.test(ol);
  const matchPc = /pok[eé]mon center/.test(ml);
  if (oursPc && !matchPc) return "Pokemon Center box matched to a regular box";
  if (!oursPc && matchPc) return "regular box matched to a Pokemon Center box";
  if (product?.subtype === "booster-box") {
    if (!ml.includes("booster box")) return "matched name is not a booster box";
    if (ml.includes("bundle")) return "booster box matched to a bundle";
  }
  if (product?.subtype === "booster-bundle" && !ml.includes("bundle")) return "matched name is not a bundle";
  if (product?.subtype === "booster-pack" && !ml.includes("pack")) return "matched name is not a pack";
  if (product?.subtype === "etb" && !ml.includes("elite trainer")) return "matched name is not an elite trainer box";
  const bracket = matched.match(/\[[^\]]+\]/);
  if (bracket) {
    const bits = bracket[0].toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    const named = bits.some((w) => ol.includes(w));
    if (!named) return "cover variant: the TCGplayer name names a specific art and ours does not";
  }
  const need = words(ours).filter((w) => !["elite", "trainer", "box", "booster", "pack", "bundle", "center"].includes(w));
  const have = new Set(words(matched));
  const missing = need.filter((w) => !have.has(w));
  if (missing.length) return `matched name is missing: ${missing.join(", ")}`;
  return null;
}

export function rowAcceptable(row) {
  if (!row || row.exclude) return "held out of the id map";
  if (row.matchConfidence !== "high" || row.reviewed !== true) return "match was not high confidence";
  const id = Number(row.tcgPlayerId);
  if (!Number.isInteger(id) || id <= 0) return "no TCGplayer product id";
  return null;
}
