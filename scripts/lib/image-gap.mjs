// Picture order, same as the site: catalogue by id, pokemontcg.io scan by id,
// then the TCGplayer photo when images.tcgplayer is on, then a branded tile.
// A product "loses a real picture" only when the TCGplayer photo is the only hit.

export function catalogueHit(images, id) {
  const raw = images && id != null ? images[id] : "";
  if (typeof raw !== "string") return false;
  const path = raw.trim().split(/[?#]/)[0];
  if (!/^(?:\/img\/|\/cards\/|\/thumb\/)/.test(path)) return false;
  if (path.includes("..") || path.includes("//")) return false;
  return true;
}

export function ptcgHit(id) {
  const m = String(id || "").match(/^([a-z0-9]+)-(\d+[a-z]?)$/i);
  if (!m || m[1].toLowerCase() === "tcgcsv") return false;
  return true;
}

export function tcgHit(id) {
  return /^tcgcsv-\d+$/.test(String(id || ""));
}

export function productType(name, kind) {
  const blob = String(name || "").toLowerCase();
  if (kind === "logo" || kind === "set") return "Set";
  if (/\bcase\b/.test(blob)) return "Case";
  if (/\bupc\b|ultra-premium|ultra premium/.test(blob)) return "UPC";
  if (/\betb\b|elite trainer/.test(blob)) return "ETB";
  if (/mini tin/.test(blob)) return "Mini Tin";
  if (/\btin\b/.test(blob)) return "Tin";
  if (/booster box/.test(blob)) return "Booster Box";
  if (kind === "sealed" || kind === "product") return "Sealed";
  return "Single";
}

export function losesRealPicture(row, images) {
  const id = Array.isArray(row) ? row[0] : row?.id;
  const name = Array.isArray(row) ? row[1] : row?.name;
  const kind = Array.isArray(row) ? row[5] : row?.kind;
  const cat = catalogueHit(images, id);
  const ptcg = ptcgHit(id);
  const tcg = tcgHit(id);
  return {
    id: String(id || ""),
    type: productType(name, kind),
    catalogue: cat,
    pokemontcg: ptcg,
    tcgplayer: tcg,
    loses: tcg && !cat && !ptcg,
  };
}

export function imageGapReport(rows, images) {
  const byType = {};
  let lose = 0;
  let catalogue = 0;
  let pokemontcg = 0;
  let tcgplayerOnly = 0;
  let tileOnly = 0;
  for (const row of rows || []) {
    const hit = losesRealPicture(row, images);
    if (hit.catalogue) catalogue += 1;
    if (hit.pokemontcg) pokemontcg += 1;
    if (!hit.catalogue && !hit.pokemontcg && !hit.tcgplayer) tileOnly += 1;
    if (!hit.loses) continue;
    lose += 1;
    tcgplayerOnly += 1;
    byType[hit.type] = (byType[hit.type] || 0) + 1;
  }
  const types = Object.keys(byType).sort().map((type) => ({ type, lose: byType[type] }));
  return {
    note: "Counted from the search rows and catalogue-images.json. A row loses a real picture with images.tcgplayer off only when the TCGplayer photo is its only picture. A row that is already a tile is not counted as a loss.",
    rows: (rows || []).length,
    catalogue,
    pokemontcg,
    tcgplayerOnly,
    tileOnly,
    lose,
    byType: types,
  };
}
