// Reads the PkmnPrices files the ingest writes and turns them into dated rows.
// The raw API shapes (https://api.pkmnprices.com/openapi.json) are kept as is
// and only renamed here. Nothing is filled or estimated.
//
// Input contract (one or more files, merged): any *.json under the configured
// folders with
//   { "kind": "ppp-reads-input", "asOf": "YYYY-MM-DD", "items": {
//       "<tcgcsv-123 | 123 (TCGplayer product id)>": {
//         "pppId": 22887, "kind": "single" | "sealed", "printing": "Holofoil" (optional),
//         "volume": SalesVolumeResponse[],        // GET /v1/cards/{id}/sales/volume
//         "comps": ListingResponse[],             // GET /v1/{cards|sealed}/{id}/listings/ebay
//         "history": PriceHistoryResponse[],      // GET /v1/{cards|sealed}/{id}/prices/history (USD and EUR)
//         "population": CardPopulationResponse | [{ "fetchedAt", "variants" }],
//         "jp": { "pppId": 1, "history": PriceHistoryResponse[] },  // Japanese printing of the same card
//         "volumeFrom": "YYYY-MM-DD"   // first day the volume pull covered (zero-sale days have no row)
//   } } }
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { dayOf, isDay } from "./series.mjs";

export const INPUT_KIND = "ppp-reads-input";
export const SOURCE = "PkmnPrices";

const num = (v) => (v == null || v === "" ? null : Number(v));

export function idOf(key) {
  const s = String(key || "");
  if (/^tcgcsv-\d+$/.test(s)) return s;
  if (/^\d+$/.test(s)) return `tcgcsv-${s}`;
  return "";
}

export function volumeRows(raw) {
  const out = [];
  for (const r of raw || []) {
    const date = dayOf(r?.date);
    const sales = num(r?.sales);
    if (!isDay(date) || !Number.isInteger(sales) || sales < 0) continue;
    out.push({
      date,
      sales,
      priced: Number.isInteger(num(r.priced_sales)) ? num(r.priced_sales) : null,
      median: num(r.median) > 0 ? num(r.median) : null,
      graded: r.graded === true,
      variant: r.variant ?? null,
      currency: String(r.currency || "").toUpperCase(),
    });
  }
  return dedupe(out, (r) => `${r.date}|${r.graded}|${r.variant}|${r.currency}`);
}

// Title words that mark a comp as not a clean raw English copy. TCGplayer
// market is a Near Mint price, so played, damaged, graded or foreign copies
// are left out of raw medians (the count is shown on the read).
const TITLE_GRADED = /\b(psa|bgs|cgc|sgc|beckett|tag|ace)\s?\d|\b(graded|slab(bed)?|gem mint)\b/i;
const TITLE_CONDITION = /\b(damaged|dmg|heavily played|moderately played|lightly played|played|poor|creased?|bent|water damage|vg|good condition|excellent)\b|\b(hp|mp|lp)\b/i;
const TITLE_LANGUAGE = /\b(japanese|japan|jpn|jp|korean|chinese|portuguese|german|deutsch|french|fran[cç]ais|italian|italiano|spanish|espa[nñ]ol|dutch|polish|thai|indonesian)\b/i;
const TITLE_OTHER = /\b(proxy|custom|replica|fake|orica|lot|bundle|choose|pick|playset|x\s?[2-9]\b|digital|code card)\b/i;
export function titleFlag(title) {
  const t = String(title || "").replace(/\b\d+\s?hp\b/gi, " ");
  if (!t.trim()) return null;
  if (TITLE_GRADED.test(t)) return "graded";
  if (TITLE_LANGUAGE.test(t)) return "language";
  if (TITLE_OTHER.test(t)) return "other";
  if (TITLE_CONDITION.test(t)) return "condition";
  return null;
}

export function compRows(raw) {
  const out = [];
  for (const r of raw || []) {
    const date = dayOf(r?.sold_at);
    const price = num(r?.price);
    if (!isDay(date) || !(price > 0)) continue;
    const grader = r.grader ? String(r.grader).toUpperCase() : null;
    out.push({
      key: r.id != null ? `id:${r.id}` : `${date}|${price}|${r.title || ""}`,
      date,
      ingested: dayOf(r.ingested_at),
      price,
      currency: String(r.currency || "").toUpperCase(),
      graded: Boolean(grader || r.grade),
      grader,
      grade: r.grade != null ? String(r.grade) : null,
      qualifier: r.grade_qualifier || null,
      saleType: r.sale_type || null,
      attribution: r.attribution || null,
      variant: r.variant ?? null,
      country: r.seller_country || null,
      titleFlag: titleFlag(r.title),
    });
  }
  return dedupe(out, (r) => r.key);
}

export function historyRows(raw) {
  const out = [];
  for (const r of raw || []) {
    const date = dayOf(r?.date);
    const price = num(r?.avg);
    if (!isDay(date) || !(price > 0)) continue;
    out.push({
      date,
      price,
      currency: String(r.currency || "").toUpperCase(),
      source: String(r.source || "").toLowerCase(),
      condition: r.condition ?? null,
      variant: r.variant ?? null,
    });
  }
  return dedupe(out, (r) => `${r.date}|${r.currency}|${r.source}|${r.condition}|${r.variant}`).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// One snapshot per variant per refresh day (updated_at).
export function popRows(raw, fetchedAt = "") {
  const snaps = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out = [];
  for (const s of snaps) {
    for (const v of s?.variants || []) {
      const date = dayOf(v?.updated_at) || dayOf(s?.fetchedAt) || dayOf(fetchedAt);
      const total = num(v?.total_population);
      const gems = num(v?.total_gems);
      if (!isDay(date) || !Number.isInteger(total) || !Number.isInteger(gems)) continue;
      out.push({
        date,
        variant: v.variant ?? null,
        total,
        gems,
        gemRate: num(v.gem_rate),
        lastChange: v.last_population_change || null,
        graders: Object.fromEntries(Object.entries(v.graders || {}).map(([k, g]) => [k, { total: num(g?.total), gems: num(g?.gems), url: g?.pop_report_url || null }])),
      });
    }
  }
  return dedupe(out, (r) => `${r.date}|${r.variant}`).sort((a, b) => (a.date < b.date ? -1 : 1));
}

function dedupe(rows, keyOf) {
  const seen = new Map();
  for (const r of rows) seen.set(keyOf(r), r);
  return [...seen.values()];
}

function mergeItem(into, raw, asOf) {
  if (raw.pppId != null && into.pppId == null) into.pppId = raw.pppId;
  if (raw.kind && !into.kind) into.kind = raw.kind === "sealed" ? "sealed" : "single";
  if (raw.printing && !into.printing) into.printing = String(raw.printing);
  into.volume = volumeRows([...(into.rawVolume || []), ...(raw.volume || [])]);
  into.rawVolume = [...(into.rawVolume || []), ...(raw.volume || [])];
  into.comps = compRows([...(into.rawComps || []), ...(raw.comps || [])]);
  into.rawComps = [...(into.rawComps || []), ...(raw.comps || [])];
  into.history = historyRows([...(into.rawHistory || []), ...(raw.history || [])]);
  into.rawHistory = [...(into.rawHistory || []), ...(raw.history || [])];
  into.pop = [...(into.pop || []), ...popRows(raw.population, asOf)];
  if (Array.isArray(raw.jp?.history)) into.rawJp = [...(into.rawJp || []), ...raw.jp.history];
  if (into.rawJp) into.jp = historyRows(into.rawJp);
  // A truncated comps page only vouches for days after its oldest comp.
  for (const k of ["compsFrom", "gradedFrom"]) if (isDay(raw[k]) && (!into[k] || raw[k] > into[k])) into[k] = raw[k];
  if (isDay(raw.volumeFrom) && (!into.volumeFrom || raw.volumeFrom < into.volumeFrom)) into.volumeFrom = raw.volumeFrom;
  if (asOf && (!into.asOf || asOf > into.asOf)) into.asOf = asOf;
}

export function mergeInputs(docs) {
  const items = new Map();
  let asOf = "";
  for (const doc of docs || []) {
    if (!doc || doc.kind !== INPUT_KIND || !doc.items || typeof doc.items !== "object") continue;
    const day = dayOf(doc.asOf);
    if (isDay(day) && day > asOf) asOf = day;
    for (const [key, raw] of Object.entries(doc.items)) {
      const id = idOf(key);
      if (!id || !raw || typeof raw !== "object") continue;
      if (!items.has(id)) items.set(id, { id, pid: Number(id.slice(7)) });
      mergeItem(items.get(id), raw, isDay(day) ? day : "");
    }
  }
  for (const it of items.values()) {
    const byKey = new Map();
    for (const p of it.pop || []) byKey.set(`${p.date}|${p.variant}`, p);
    it.pop = [...byKey.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    delete it.rawVolume; delete it.rawComps; delete it.rawHistory; delete it.rawJp;
  }
  return { asOf, items };
}

export async function loadInputDocs(dirs) {
  const docs = [];
  const files = [];
  for (const dir of dirs || []) {
    let names = [];
    try { names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort(); } catch { continue; }
    for (const name of names) {
      try {
        const doc = JSON.parse(await readFile(join(dir, name), "utf8"));
        if (doc?.kind === INPUT_KIND) { docs.push(doc); files.push(join(dir, name)); }
      } catch { /* not an input file */ }
    }
  }
  return { docs, files };
}

// Kept pop snapshots, so week-over-week growth works even when the ingest
// overwrites its file each night. Private file only.
export function mergePopHistory(history, items) {
  const out = { ...(history?.items || {}) };
  for (const it of items.values()) {
    if (!it.pop?.length) continue;
    const prev = Array.isArray(out[it.id]) ? out[it.id] : [];
    const byKey = new Map(prev.map((p) => [`${p.date}|${p.variant}`, p]));
    for (const p of it.pop) byKey.set(`${p.date}|${p.variant}`, p);
    out[it.id] = [...byKey.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-80);
  }
  return { kind: "ppp-pop-history", items: out };
}

export function attachPopHistory(items, history) {
  for (const it of items.values()) {
    const prev = history?.items?.[it.id];
    if (!Array.isArray(prev) || !prev.length) continue;
    const byKey = new Map(prev.map((p) => [`${p.date}|${p.variant}`, p]));
    for (const p of it.pop || []) byKey.set(`${p.date}|${p.variant}`, p);
    it.pop = [...byKey.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }
}
