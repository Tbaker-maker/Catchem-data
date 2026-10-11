// Price proof for emails. A read makes an email only when it is on the published board
// and every price it shows sits in that exact day's TCGCSV daily file.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const HISTORY_START = "2026-09-26";
export const MIN_PCT = 8;
export const MIN_USD = 1;
export const MIN_USD_SEALED = 5;
export const ROTATION_LINE = "Rotated sets historically stop getting new print runs. What's already out there is the supply.";
// Sets with a regulation mark that left Standard (F on 2025-04-11, G on 2026-04-10). Same 11 as catchem-site /rotation.
export const ROTATED_SETS = [
  "Pokemon GO", "Brilliant Stars", "Astral Radiance", "Lost Origin", "Silver Tempest",
  "Paldean Fates", "Scarlet & Violet 151", "Scarlet & Violet Base Set", "Paldea Evolved", "Obsidian Flames", "Paradox Rift",
];
const fold = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/^(swsh\d+|sv\d*|me\d*|sm\d*)\s*:\s*/i, "").replace(/\s+(trainer gallery|galarian gallery)$/i, "").replace(/[^a-z0-9&]+/g, " ").trim();
const ROTATED = new Set(ROTATED_SETS.map(fold).concat(["sv01 scarlet & violet base set", "151"]));
export function isRotatedSet(name) { return ROTATED.has(fold(name)); }

const cents = (v) => Math.round(Number(v) * 100);

export function makeDayLoader(root) {
  const cache = new Map();
  return async function day(date) {
    if (cache.has(date)) return cache.get(date);
    let map = null;
    try {
      const doc = JSON.parse(await readFile(join(root, "data/history/tcgcsv-daily", `${date}.json`), "utf8"));
      map = new Map();
      for (const row of doc.prices || []) {
        const set = new Set();
        if (Number(row.market) > 0) set.add(cents(row.market));
        for (const p of row.printings || []) { const v = Number(p?.market ?? p?.price ?? p?.[1]); if (v > 0) set.add(cents(v)); }
        map.set(String(row.id), set);
      }
    } catch { map = null; }
    cache.set(date, map);
    return map;
  };
}

export function pidFor(row, sealedPid = new Map()) {
  for (const v of [row?.sku, row?.sourceLine, row?.id]) {
    const s = String(v || "");
    const m = s.match(/tcgcsv-(\d+)/);
    if (m) return m[1];
    const bare = s.replace(/^(spread|askmove|mktmove|move|mover|streak|plain|high|low|set)-/, "");
    if (sealedPid.has(bare)) return sealedPid.get(bare);
  }
  return null;
}

// The two TCGplayer market prices a read states, with their dates. Asks are eBay, not in the daily file.
export function pairOf(row) {
  const r = row?.receipt || {};
  if (r.marketFrom != null && r.marketTo != null && r.from && r.to) return { a: +r.marketFrom, aDate: r.from, b: +r.marketTo, bDate: r.to };
  if (r.fromPrice != null && r.toPrice != null && r.from && r.to) return { a: +r.fromPrice, aDate: r.from, b: +r.toPrice, bDate: r.to };
  const hits = [...String(row?.headline || "").matchAll(/\$([\d,]+(?:\.\d+)?) \((\d{4}-\d{2}-\d{2})\)/g)].map((m) => ({ v: Number(m[1].replace(/,/g, "")), d: m[2] }));
  if (/TCGplayer market/i.test(String(row?.headline || "")) && hits.length >= 2) {
    const [x, y] = hits.slice(0, 2).sort((p, q) => (p.d < q.d ? -1 : 1));
    if (x.d !== y.d) return { a: x.v, aDate: x.d, b: y.v, bDate: y.d };
  }
  return null;
}

export async function proveRead(row, { day, sealedPid = new Map() }) {
  const p = pairOf(row);
  if (!p) return { ok: false, reason: "no two dated TCGplayer market prices" };
  if (p.aDate < HISTORY_START || p.bDate < HISTORY_START) return { ok: false, reason: `date before ${HISTORY_START}` };
  const pid = pidFor(row, sealedPid);
  if (!pid) return { ok: false, reason: "no product id" };
  for (const [v, d] of [[p.a, p.aDate], [p.b, p.bDate]]) {
    const map = await day(d);
    if (!map) return { ok: false, reason: `no daily file for ${d}` };
    if (!map.get(pid)?.has(cents(v))) return { ok: false, reason: `$${v} not in ${d} file` };
  }
  const usd = Math.abs(p.b - p.a);
  const pct = p.a > 0 ? (usd / p.a) * 100 : 0;
  const sealed = row.kind === "sealed" || /sealed|askmove|mktmove|spread/.test(String(row.signal || row.readKind || ""));
  const floor = sealed ? MIN_USD_SEALED : MIN_USD;
  if (usd < floor) return { ok: false, reason: `move $${usd.toFixed(2)} under $${floor}` };
  if (pct < MIN_PCT) return { ok: false, reason: `move ${pct.toFixed(1)}% under ${MIN_PCT}%` };
  return { ok: true, pid, sealed, usd: Math.round(usd * 100) / 100, pct: Math.round(pct * 10) / 10, up: p.b > p.a, ...p };
}

export async function provenBoard(reads, opts) {
  const rows = Array.isArray(reads?.reads) ? reads.reads : [];
  if (reads && reads.count !== rows.length) throw new Error(`reads.json count ${reads.count} is not its length ${rows.length}`);
  const kept = [];
  const dropped = [];
  for (const row of rows) {
    const proof = await proveRead(row, opts);
    (proof.ok ? kept : dropped).push({ row, proof });
  }
  return { kept, dropped };
}

export async function loadSealedPid(root) {
  const map = new Map();
  try {
    const doc = JSON.parse(await readFile(join(root, "data/sealed-products.json"), "utf8"));
    for (const p of Array.isArray(doc) ? doc : doc.products || []) if (p?.id && /^\d+$/.test(String(p.tcgPlayerId || ""))) map.set(String(p.id), String(p.tcgPlayerId));
  } catch { /* none */ }
  return map;
}
