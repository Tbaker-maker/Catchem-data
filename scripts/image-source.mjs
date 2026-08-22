// image-source.mjs — one place that decides which photo a product shows.
// Until 2026-08-22 every product rendered a seller's own phone snapshot from
// eBay: kitchen tables, glare, hands, inconsistent angles. We had TCGplayer
// ids for 136 products the whole time and never used them for imagery.
// ORDER: clean catalogue shot → seller photo → nothing. A missing photo is
// better than a bad one; a bad one makes every number next to it look casual.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let OVERRIDES = {};
try { OVERRIDES = (JSON.parse(await readFile(join(ROOT, "data/image-overrides.json"), "utf-8")).products) || {}; } catch {}
let TCG = {};
try {
  const cm = JSON.parse(await readFile(join(ROOT, "data/crosscheck-id-map.json"), "utf-8"));
  for (const e of cm.entries || []) if (e.reviewed && !e.exclude && e.tcgPlayerId) TCG[e.id] = e.tcgPlayerId;
} catch {}

// TCGplayer serves several sizes; 1000x1000 is the largest reliable one.
// `size` lets callers ask for a thumb without downloading a full-size image.
export const productImage = (p, size = 1000) => {
  // A reviewed override always wins — some catalogue shots depict cases or
  // multipacks, which misrepresent a single-unit SKU. Missing beats misleading.
  const ov = OVERRIDES[p.id];
  if (ov?.use === "none") return "";
  if (ov?.url) return ov.url;
  if (ov?.use === "seller") return p.representativeImage || p.image || "";
  const id = TCG[p.id];
  if (id) return `https://tcgplayer-cdn.tcgplayer.com/product/${id}_in_${size}x${size}.jpg`;
  return p.representativeImage || p.image || "";
};
export const hasCleanImage = p => Boolean(TCG[p.id]);
export const cardImage = (cardId, hires = true) => {
  const m = /^(.+)-([^-]+)$/.exec(cardId || "");
  return m ? `https://images.pokemontcg.io/${m[1]}/${m[2]}${hires ? "_hires" : ""}.png` : "";
};
