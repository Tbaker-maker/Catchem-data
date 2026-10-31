// Which photo may become a sealed cutout, and whether the result may ship.
// Scale numbers stay in the private scale file. This module never invents them.

export const ALLOWED_HOSTS = [
  "images.pokemontcg.io",
  "tcgplayer-cdn.tcgplayer.com",
  "pokemon.com",
  "www.pokemon.com",
  "assets.pokemon.com",
];

const TYPES = [
  "booster-pack",
  "sleeved-pack",
  "prize-pack",
  "blister",
  "mini-tin",
  "booster-box",
  "booster-bundle",
  "etb",
  "pc-etb",
  "tin",
  "deck",
  "build-battle",
  "special-collection",
  "upc",
  "case",
];

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

function nameType(name) {
  const n = String(name || "").toLowerCase();
  if (!n) return "";
  if (/pok[eé]mon center/.test(n) && /elite trainer|\betb\b/.test(n)) return "pc-etb";
  if (/elite trainer|\betb\b/.test(n)) return "etb";
  if (/booster box/.test(n)) return "booster-box";
  if (/sleeved/.test(n) && /booster|pack/.test(n)) return "sleeved-pack";
  if (/blister/.test(n)) return "blister";
  if (/mini tin/.test(n)) return "mini-tin";
  if (/build\s*(?:&|and)\s*battle/.test(n)) return "build-battle";
  if (/prize pack/.test(n)) return "prize-pack";
  if (/\bdecks?\b/.test(n)) return "deck";
  if (/bundle/.test(n)) return "booster-bundle";
  if (/booster pack|\bpacks?\b/.test(n)) return "booster-pack";
  if (/\btins?\b/.test(n)) return "tin";
  if (/ultra[- ]premium|\bupc\b/.test(n)) return "upc";
  if (/\bcases?\b/.test(n)) return "case";
  if (/collection/.test(n)) return "special-collection";
  return "";
}

export function productTypeOf(product) {
  const named = nameType(product && product.name);
  const sub = String(product && product.subtype || "").toLowerCase();
  // A stored subtype that the name contradicts loses. Sleeved packs are filed as booster-pack.
  if (TYPES.includes(sub) && nameAgrees(product && product.name, sub)) return sub;
  if (named) return named;
  if (TYPES.includes(sub)) return sub;
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
  if (type === "booster-pack") return /booster pack|\bpack\b/.test(n) && !/booster box|bundle|sleeved|blister/.test(n);
  if (type === "sleeved-pack") return /sleeved/.test(n) && /booster|pack/.test(n);
  if (type === "blister") return /blister/.test(n);
  if (type === "mini-tin") return /mini tin/.test(n);
  if (type === "deck") return /\bdecks?\b/.test(n) && !/booster box/.test(n);
  if (type === "build-battle") return /build\s*(?:&|and)\s*battle/.test(n);
  if (type === "prize-pack") return /prize pack/.test(n);
  if (type === "booster-bundle") return /bundle/.test(n);
  if (type === "tin") return /\btin\b/.test(n) && !/mini tin/.test(n);
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
  if (flags.tiny) reasons.push("source photo is too small");
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

// Named holes from the public feed that are not in the priced file.
export const FEED_MUST = ["tcgcsv-712112", "tcgcsv-712108", "tcgcsv-704188", "tcgcsv-133812"];

export function catalogIndex(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    if (!row || !row.id) continue;
    byId.set(String(row.id), row);
    const pid = Number(row.tcgPlayerId) || pidFromId(row.id);
    if (pid) byId.set("tcgcsv-" + pid, row);
  }
  return byId;
}

export function sealedReadIds(readsDoc) {
  const ids = [];
  for (const row of (readsDoc && readsDoc.reads) || []) {
    const href = String(row && row.href || "");
    const kind = String(row && row.kind || "");
    const deep = String(row && row.deep || "");
    if (kind !== "sealed" && deep !== "sealed" && !href.startsWith("/p/")) continue;
    const sku = String(row.sku || "");
    if (sku) ids.push(sku);
    const m = href.match(/\/p\/([^/?#]+)/);
    if (m) ids.push(decodeURIComponent(m[1]));
  }
  return ids;
}

export function showableProducts(prices, catalog, readsDoc, extraIds = FEED_MUST) {
  const index = catalogIndex(catalog);
  const wanted = new Map();
  const add = (id) => {
    const key = String(id || "");
    if (!key) return;
    const row = index.get(key);
    if (!row) return;
    wanted.set(row.id, row);
  };
  for (const product of prices || []) {
    if (!product || !product.id) continue;
    const row = index.get(product.id) || index.get("tcgcsv-" + (Number(product.tcgPlayerId) || pidFromId(product.id))) || product;
    if (row && row.id) wanted.set(row.id, row);
  }
  for (const id of sealedReadIds(readsDoc)) add(id);
  for (const id of extraIds || []) add(id);
  return [...wanted.values()];
}
