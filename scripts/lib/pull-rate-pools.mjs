// Which singles belong in a published pull-rate slot.
// Parent rows only. Alternate arts and galleries are not part of these slots.
// A tag substring cannot split V from VMAX, so slots name a pool instead.

function tagsOf(card) {
  return card.tags || [];
}
function hasTag(card, tag) {
  return tagsOf(card).includes(tag);
}
function isAlt(card) {
  if (tagsOf(card).some((t) => /alternate/i.test(t))) return true;
  return /alternate/i.test(card.name || "");
}
function isGallery(card) {
  return hasTag(card, "Trainer Gallery") || hasTag(card, "Galarian Gallery");
}
function numOf(card) {
  const m = String(card.num || "").match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}
function secretBase(name) {
  return String(name || "")
    .replace(/\s*\(Secret\)[\s\S]*$/i, "")
    .replace(/\s*\(\d+\)\s*$/g, "")
    .trim();
}

// Rainbow secret: VMAX or VSTAR secret (the lowest number when a gold twin exists),
// or a trainer secret that also has a Full Art. A lone VMAX secret in a set with
// no other secrets is the gold card (Shining Fates Alcremie VMAX).
// Gold secret: everything else that is a non-alt secret, including "X V (Secret)"
// gold cards, gold items, gold energy, and gold non-V pokemon.
export function isRainbowSecret(card, setCards) {
  if (card.rarity !== "Secret Rare" || isAlt(card) || isGallery(card)) return false;
  const name = card.name || "";
  const secrets = setCards.filter((c) => c.rarity === "Secret Rare" && !isAlt(c) && !isGallery(c));
  if (/VMAX|VSTAR/i.test(name)) {
    const hasOther = secrets.some((c) => !/VMAX|VSTAR/i.test(c.name || ""));
    if (!hasOther && secrets.length === 1) return false;
    const base = secretBase(name);
    const same = secrets.filter((c) => secretBase(c.name) === base);
    const lowest = Math.min(...same.map(numOf));
    return numOf(card) === lowest;
  }
  if (/\bV\b/i.test(name)) return false;
  const base = secretBase(name);
  return setCards.some((c) => hasTag(c, "Full Art") && secretBase(String(c.name || "").replace(/\s*\(Full Art\)[\s\S]*$/i, "")) === base);
}

export function cardInPool(card, pool, setCards) {
  if (!card || !(card.price > 0) || card.kind === "sealed") return false;
  if (isAlt(card) || isGallery(card)) return false;
  const name = card.name || "";
  const rar = card.rarity || "";
  if (pool === "swsh-v") {
    return rar === "Ultra Rare" && !hasTag(card, "Full Art") && /\bV\b/.test(name) && !/VMAX|VSTAR|V-UNION/i.test(name);
  }
  if (pool === "swsh-vmax") {
    return rar === "Ultra Rare" && !hasTag(card, "Full Art") && /VMAX/i.test(name);
  }
  if (pool === "swsh-full-art") {
    return rar === "Ultra Rare" && hasTag(card, "Full Art");
  }
  if (pool === "swsh-rainbow") return isRainbowSecret(card, setCards);
  if (pool === "swsh-gold") {
    return rar === "Secret Rare" && !isRainbowSecret(card, setCards);
  }
  if (pool === "swsh-amazing") return rar === "Amazing Rare" || hasTag(card, "Amazing Rare");
  if (pool === "swsh-shiny") {
    return (rar === "Shiny Holo Rare" || hasTag(card, "Shiny")) && !/GX|VMAX|VSTAR|\bV\b/i.test(name);
  }
  if (pool === "swsh-shiny-v") {
    return (rar === "Shiny Holo Rare" || hasTag(card, "Shiny")) && /GX|VMAX|VSTAR|\bV\b/i.test(name);
  }
  if (pool === "sm-full-art") return rar === "Ultra Rare" && hasTag(card, "Full Art");
  if (pool === "sm-gx") return rar === "Ultra Rare" && !hasTag(card, "Full Art") && !hasTag(card, "Shiny");
  if (pool === "sm-rainbow") return rar === "Rainbow Rare" || hasTag(card, "Rainbow Rare");
  if (pool === "sm-secret") return rar === "Secret Rare";
  if (pool === "sm-prism") return hasTag(card, "Prism Star") || /prism star/i.test(rar);
  if (pool === "sm-shiny") {
    return (rar === "Shiny Holo Rare" || hasTag(card, "Shiny")) && !/GX|VMAX|VSTAR|\bV\b/i.test(name);
  }
  if (pool === "sm-shiny-gx") {
    return (rar === "Shiny Holo Rare" || hasTag(card, "Shiny")) && /GX|VMAX|VSTAR|\bV\b/i.test(name);
  }
  return false;
}

export function pricesForPool(setCards, pool) {
  const cards = setCards || [];
  const out = [];
  for (const card of cards) {
    if (cardInPool(card, pool, cards)) out.push(card.price);
  }
  return out;
}
