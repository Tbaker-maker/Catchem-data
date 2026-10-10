// Volume (liquidity) reads: how many Near Mint copies of a card sold on
// TCGplayer over 30 days (and 7, when that window is complete). Every count is
// a row in data/derived/tcgplayer-volume.json. A card with no full 30-day
// window, or with zero sales, gets no read. With no file, no read ships.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { monthDay } from "./outlier-dive-reads.mjs";
import { VOLUME_FILE, VOLUME_SOURCE, fullWindow, shiftDay } from "./tcgplayer-volume.mjs";

export const VOLUME_EMPTY_NOTE = "No sold count is on file, so no volume read ships.";
export const VOLUME_NOTE = `Near Mint copies sold on TCGplayer over 30 and 7 days, from ${VOLUME_FILE}. ${VOLUME_SOURCE}.`;
// Bulk commons dominate raw counts; a read is about cards people price-check.
export const MIN_MARKET = 5;
export const MAX_READS = 40;
// A count whose window ended more than this many days before the feed day is
// not shipped as a read (it stays in the derived file with its own dates).
export const MAX_AGE_DAYS = 21;

export async function loadVolumeDoc(root) {
  try {
    return JSON.parse(await readFile(join(root, VOLUME_FILE), "utf8"));
  } catch {
    return null;
  }
}

function range(w) {
  const a = monthDay(w?.from);
  const b = monthDay(w?.to);
  return a && b ? `${a}–${b}` : "";
}

function displayName(item) {
  const name = String(item?.name || "").trim();
  const num = String(item?.number || "").trim();
  if (num && name.endsWith(` - ${num}`)) return name.slice(0, -(num.length + 3)).trim();
  return name;
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Sentence + receipts for one verified card row. Null when it cannot be stated. */
export function volumeRead(row, item) {
  if (!row || !item || row.id !== item.id) return null;
  if (!fullWindow(row, 30) || !Number.isInteger(row.sold30d) || row.sold30d <= 0) return null;
  const name = displayName(item);
  const r30 = range(row.window30d);
  if (!name || !r30) return null;
  const has7 = fullWindow(row, 7) && Number.isInteger(row.sold7d) && row.window7d.to === row.window30d.to;
  if (!has7 || !(row.sold7d > row.sold30d * 7 / 30)) return null;
  const where = [item.set, item.number].filter(Boolean).join(", ");
  let sentence = `${name}${where ? ` (${where})` : ""}: ${plural(row.sold30d, "Near Mint copy", "Near Mint copies")} sold on TCGplayer in the 30 days ${r30}`;
  sentence += has7 ? `, ${row.sold7d} of them in the last 7 (${range(row.window7d)}).` : ".";
  const sold = {
    condition: "Near Mint",
    printing: row.printing,
    count30d: row.sold30d,
    window30d: { from: row.window30d.from, to: row.window30d.to },
    source: VOLUME_SOURCE,
  };
  if (has7) {
    sold.count7d = row.sold7d;
    sold.window7d = { from: row.window7d.from, to: row.window7d.to };
  }
  return {
    id: `volume-${item.id}`,
    sku: item.id,
    readKind: "volume",
    kind: "volume",
    name,
    set: item.set || "",
    path: sentence,
    headline: sentence,
    why: `${VOLUME_SOURCE}. TCGplayer's daily sold counts for the ${row.printing} printing in Near Mint, added up; days with no sale add nothing.`,
    asOf: row.window30d.to,
    href: `/c/${encodeURIComponent(item.id)}`,
    sold,
    sources: { volume: VOLUME_FILE },
  };
}

/**
 * Ranked volume reads: most copies sold in 30 days first, among cards with a
 * TCGplayer market of at least MIN_MARKET on the catalog. Empty when there is
 * no file or no card qualifies.
 */
export function volumeReads(doc, items, { asOf = "", max = MAX_READS, minMarket = MIN_MARKET, exclude = null } = {}) {
  const cards = doc?.cards || {};
  if (!Object.keys(cards).length) return [];
  const skip = exclude instanceof Set ? exclude : new Set(exclude || []);
  const byId = new Map((items || []).filter((i) => i && i.kind === "single").map((i) => [i.id, i]));
  const oldest = asOf ? shiftDay(asOf, -MAX_AGE_DAYS) : "";
  const out = [];
  for (const row of Object.values(cards)) {
    if (skip.has(row?.id)) continue;
    const item = byId.get(row?.id);
    if (!item || !(Number(item.price) >= minMarket)) continue;
    if (Number(item.tcgplayerProductId) !== Number(row.tcgplayerProductId)) continue;
    if (oldest && String(row.window30d?.to || "") < oldest) continue;
    const read = volumeRead(row, item);
    if (read) out.push(read);
  }
  out.sort((a, b) => b.sold.count30d - a.sold.count30d || (b.sold.count7d ?? -1) - (a.sold.count7d ?? -1) || (a.id < b.id ? -1 : 1));
  return out.slice(0, Math.max(0, max));
}

