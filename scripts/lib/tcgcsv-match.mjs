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
    const inner = bracket[0].slice(1, -1).trim().toLowerCase();
    // Quantity packs are not cover arts: [Set of 3], [Set of 2], etc.
    const quantityPack = /^set of \d+$/i.test(inner) || /^\d+[\s-]?packs?$/i.test(inner);
    if (!quantityPack) {
      const bits = inner.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
      const named = bits.some((w) => ol.includes(w));
      if (!named) return "cover variant: the TCGplayer name names a specific art and ours does not";
    }
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

// Nightly backfill must not drop curated joins. Keep accepted rows, seed
// art-split product ids from the sealed catalog, and preserve prior mapping
// rows that still match the product's TCGplayer id.
export function buildMappingEntries(accepted, products, priorEntries = []) {
  const byId = new Map();
  for (const a of accepted || []) {
    if (!a?.id || !(Number(a.tcgplayerProductId) > 0)) continue;
    byId.set(a.id, {
      id: a.id,
      tcgplayerProductId: Number(a.tcgplayerProductId),
      tcgplayerName: a.catalogName || a.tcgplayerName || null,
      ourName: a.name,
    });
  }
  const list = Array.isArray(products) ? products : Object.values(products || {});
  const productById = new Map(list.filter((p) => p && p.id).map((p) => [p.id, p]));
  for (const p of list) {
    if (!p?.id || p.combinedArts || byId.has(p.id)) continue;
    const pid = Number(p.tcgPlayerId);
    if (!(pid > 0)) continue;
    if (p.artOf || p.tcgPlayerIdMethod === "art-split-by-productId") {
      byId.set(p.id, {
        id: p.id,
        tcgplayerProductId: pid,
        tcgplayerName: p.tcgplayerName || null,
        ourName: p.name,
      });
    }
  }
  for (const e of priorEntries || []) {
    if (!e?.id || byId.has(e.id)) continue;
    const p = productById.get(e.id);
    if (!p || p.combinedArts) continue;
    if (Number(p.tcgPlayerId) !== Number(e.tcgplayerProductId)) continue;
    if (!(Number(e.tcgplayerProductId) > 0)) continue;
    byId.set(e.id, e);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}
