// Which photo may become a sealed cutout, and whether the result may ship.
// Scale numbers stay in the private scale file. This module never invents them.

export const ALLOWED_HOSTS = [
  "images.pokemontcg.io",
  "tcgplayer-cdn.tcgplayer.com",
  "pokemon.com",
  "www.pokemon.com",
  "assets.pokemon.com",
];

const TYPES = ["booster-pack", "booster-box", "booster-bundle", "etb", "pc-etb", "tin", "special-collection", "upc", "case"];

export function hostOf(url) {
  const m = String(url || "").match(/^https:\/\/([^/]+)/i);
  return m ? m[1].toLowerCase() : "";
}

export function hostAllowed(url) {
  return ALLOWED_HOSTS.includes(hostOf(url));
}

export function isSetLogo(url) {
  return /\/logo\.png(?:\?|$)/i.test(String(url || ""));
}

export function pidFromId(id) {
  const m = String(id || "").match(/^tcgcsv-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function productTypeOf(product) {
  const sub = String(product && product.subtype || "").toLowerCase();
  if (TYPES.includes(sub)) return sub;
  const name = String(product && product.name || "").toLowerCase();
  if (/pok[eé]mon center/.test(name) && /elite trainer|\betb\b/.test(name)) return "pc-etb";
  if (/elite trainer|\betb\b/.test(name)) return "etb";
  if (/booster box/.test(name)) return "booster-box";
  if (/bundle/.test(name)) return "booster-bundle";
  if (/booster pack|\bsleeved booster\b/.test(name)) return "booster-pack";
  if (/\btin\b/.test(name)) return "tin";
  if (/ultra[- ]premium|\bupc\b/.test(name)) return "upc";
  if (/\bcase\b/.test(name)) return "case";
  if (/collection/.test(name)) return "special-collection";
  return "";
}

export function nameAgrees(name, type) {
  const n = String(name || "").toLowerCase();
  if (!type || !n) return false;
  const etb = /elite trainer|\betb\b/.test(n);
  const pc = /pok[eé]mon center/.test(n);
  if (type === "pc-etb") return pc && etb;
  if (type === "etb") return etb && !pc;
  if (type === "booster-box") return /booster box/.test(n);
  if (type === "booster-pack") return /booster pack|\bsleeved booster\b|\bpack\b/.test(n) && !/booster box|bundle/.test(n);
  if (type === "booster-bundle") return /bundle/.test(n);
  if (type === "tin") return /\btin\b/.test(n);
  if (type === "upc") return /ultra[- ]premium|\bupc\b/.test(n);
  if (type === "case") return /\bcase\b/.test(n);
  if (type === "special-collection") return /collection|premium|surprise box/.test(n);
  return false;
}

export function sourceFor(product, extras = {}) {
  const id = product && product.id;
  const ov = extras.overrides && id ? extras.overrides[id] : null;
  if (ov && ov.use === "none") return { url: "", reason: "reviewed as no photo" };
  if (ov && ov.url) {
    if (isSetLogo(ov.url)) return { url: "", reason: "set logo is not the product" };
    if (!hostAllowed(ov.url)) return { url: "", reason: "photo host is not allowed" };
    return { url: ov.url, reason: "" };
  }
  const own = Number(product && product.tcgPlayerId) || 0;
  const fromMap = extras.crosscheck && id ? Number(extras.crosscheck[id]) || 0 : 0;
  const pid = own || pidFromId(id) || fromMap;
  if (pid > 0) {
    return { url: `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_in_1000x1000.jpg`, reason: "" };
  }
  const raw = String((product && (product.representativeImage || product.image)) || "");
  if (!raw) return { url: "", reason: "no allowed photo" };
  if (isSetLogo(raw)) return { url: "", reason: "set logo is not the product" };
  if (!hostAllowed(raw)) return { url: "", reason: "photo host is not allowed" };
  return { url: raw, reason: "" };
}

// base is the booster-box pixel height at 2x. Missing factors return null.
export function targetHeight(productType, scale, base) {
  const table = scale && scale.height;
  const factor = table ? table[productType] : undefined;
  if (typeof factor !== "number" || !(factor > 0) || !(base > 0)) return null;
  return Math.round(base * factor);
}

export function judgeCut(flags) {
  const reasons = [];
  if (!flags) return ["no cutout"];
  if (flags.download === false) reasons.push("photo did not download");
  if (flags.centerEaten) reasons.push("cut ate the product");
  if (flags.leftover) reasons.push("leftover background");
  if (flags.jagged) reasons.push("jagged edges");
  if (flags.clipped) reasons.push("missing corners");
  if (flags.blur) reasons.push("obvious blur");
  if (flags.empty) reasons.push("cutout was empty");
  return reasons;
}

export function cutoutRow(product, result) {
  const type = result.productType || productTypeOf(product);
  const pid = Number(product.tcgPlayerId) || pidFromId(product.id) || 0;
  const row = {
    id: product.id,
    siteId: String(product.id || "").startsWith("tcgcsv-") ? product.id : (pid ? `tcgcsv-${pid}` : ""),
    tcgPlayerId: pid || null,
    productType: type,
    pass: result.pass === true,
  };
  if (row.pass) {
    row.file = result.file;
    row.png = result.png;
    row.width = result.width;
    row.height = result.height;
  }
  return row;
}
