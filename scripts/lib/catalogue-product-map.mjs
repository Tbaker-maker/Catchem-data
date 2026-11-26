// Catalogue card id (pokemontcg.io style, e.g. ecard2-H29) to the nightly
// TCGplayer product id (tcgcsv-N). The join is the picture path: the bundle's
// single row carries scan "/img/<setId>/<number>" and the catalogue card has the
// same setId and number. A path two products share is no match. No name join.
const PATH = /^\/img\/[A-Za-z0-9.]+\/[A-Za-z0-9]+$/;

export function catalogueProductMap(catalogueCards, singles) {
  const byScan = new Map();
  for (const it of singles || []) {
    if (!it || it.kind !== "single" || !/^tcgcsv-\d+$/.test(String(it.id || "")) || !PATH.test(String(it.scan || ""))) continue;
    byScan.set(it.scan, byScan.has(it.scan) && byScan.get(it.scan) !== it.id ? "" : it.id);
  }
  const out = {};
  for (const [cid, card] of Object.entries(catalogueCards || {})) {
    if (/^tcgcsv-/.test(cid)) continue;
    const path = `/img/${String(card?.setId || "").trim()}/${String(card?.number || "").trim()}`;
    if (!PATH.test(path)) continue;
    const id = byScan.get(path);
    if (id) out[cid] = id;
  }
  return out;
}
