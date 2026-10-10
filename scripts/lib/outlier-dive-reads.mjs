// Flagged-price and dive-teaser reads. Every number comes from a file already
// on disk. No sold counts. No invented prices.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthDay(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return "";
  return `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`;
}

export function money(n) {
  const value = Number(n);
  if (!(value > 0)) return "";
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctGapWords(pct) {
  const n = Number(pct);
  if (!Number.isFinite(n) || n === 0) return "";
  return (Math.round(Math.abs(n) * 10) / 10).toFixed(1);
}

/** One Flagged read per row already labeled "possible real move". Other labels stay out. */
export function outlierReads(doc) {
  const rows = [...(doc?.high || []), ...(doc?.soft || [])];
  const out = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
    if (String(row.provisionalLabel || "") !== "possible real move") continue;
    const name = String(row.name || "").trim();
    const today = Number(row.todayPrice);
    const ref = Number(row.referencePrice);
    const day = String(row.todayDate || "").slice(0, 10);
    const gap = pctGapWords(row.pctGap);
    const dir = String(row.direction || "").toLowerCase() === "low" ? "below" : "above";
    if (!name || !(today > 0) || !(ref > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !gap) continue;
    const when = monthDay(day);
    const severity = String(row.severity || "soft");
    const sentence = `${name} ask ${money(today)} on ${when} sits ${gap}% ${dir} its recent median ${money(ref)} — review.`;
    out.push({
      id: `outlier-${row.id}`,
      sku: String(row.id),
      diveId: String(row.id),
      readKind: "outlier",
      kind: "outlier",
      name,
      set: "",
      path: sentence,
      headline: sentence,
      why: `From data/derived/sealed-price-outliers.json (${severity}). Median window is on that file.`,
      price: today,
      asOf: day,
      pctGap: Number(row.pctGap),
      direction: dir === "below" ? "low" : "high",
      severity,
      referencePrice: ref,
      href: `/dive/${encodeURIComponent(row.id)}`,
      flagged: { on: day, at: today, first: true },
      sources: { outliers: "data/derived/sealed-price-outliers.json" },
    });
  }
  return out;
}

function marketOnDive(doc) {
  const latest = doc?.latest || {};
  const values = [doc?.tcgMarket, doc?.tcgplayerMarket, latest.tcgMarket, latest.tcgplayerMarket];
  for (const value of values) {
    const n = Number(value);
    if (n > 0) return n;
  }
  return 0;
}

/**
 * Short dive teasers. Uses only fields already on a dive payload (name, latest
 * price/date, optional outlier note). Points at /dive/<id>.
 * priceMedian is an eBay ask, never a sale and never the TCGplayer market.
 * A live ask with no other signal does not ship.
 */
export function diveTeaserReads(dives) {
  const out = [];
  for (const doc of dives || []) {
    if (!doc || !doc.id) continue;
    const name = String(doc.name || "").trim();
    if (!name) continue;
    const latest = doc.latest || {};
    const price = Number(latest.priceMedian ?? latest.price ?? latest.ask);
    const day = String(latest.lastSeen || latest.asOf || latest.date || doc.asOf || "").slice(0, 10);
    const live = String(latest.dataStatus || "") === "live";
    const hasPrice = live && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day);
    const rawNote = String((doc.outlier && doc.outlier.note) || "").trim();
    const outlierNote = rawNote && !/[.!?]$/.test(rawNote) ? rawNote + "." : rawNote;
    const market = marketOnDive(doc);
    const askText = hasPrice ? money(price) : "";
    const marketText = market > 0 ? money(market) : "";
    let sentence = "";
    if (hasPrice && marketText) {
      const gap = Math.round((price - market) * 100) / 100;
      const gapText = money(Math.abs(gap));
      if (gap > 0 && gapText) sentence = `${name}: eBay asks (${askText}) sit ${gapText} over TCGplayer market (${marketText}).`;
      else if (gap < 0 && gapText) sentence = `${name}: eBay asks (${askText}) sit ${gapText} under TCGplayer market (${marketText}).`;
    }
    if (!sentence && hasPrice && outlierNote) {
      sentence = `${name}: eBay asks (${askText}) on ${monthDay(day)}. ${outlierNote} Deeper look on the chart.`;
    } else if (!sentence && outlierNote) {
      sentence = `${name}: ${outlierNote} Deeper look on the chart.`;
    } else if (!sentence) {
      continue;
    }
    const marketFile = String(doc.marketFile || "");
    const why = marketFile
      ? `eBay ask is the price median in research/pulse/dive/${doc.id}.json. TCGplayer market is the price for ${doc.tcgcsvId} in ${marketFile}. Asks are not sales.`
      : "Fields are from research/pulse/dive/<id>.json. No sold count is on this read.";
    const sources = { dive: `research/pulse/dive/${doc.id}.json` };
    if (marketFile) sources.market = marketFile;
    out.push({
      id: `dive-${doc.id}`,
      sku: String(doc.id),
      diveId: String(doc.id),
      readKind: "dive",
      kind: "dive",
      name,
      set: "",
      path: sentence,
      headline: sentence,
      why,
      price: hasPrice ? price : undefined,
      asOf: hasPrice ? day : String(doc.asOf || "").slice(0, 10),
      href: `/dive/${encodeURIComponent(doc.id)}`,
      sources,
    });
  }
  return out;
}

export async function loadOutlierDoc(root) {
  try {
    return JSON.parse(await readFile(join(root, "data/derived/sealed-price-outliers.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function attachCatalogMarkets(root, docs) {
  let catalog;
  try {
    catalog = JSON.parse(await readFile(join(root, "data/catalog/tcgcsv-latest.json"), "utf8"));
  } catch {
    return 0;
  }
  const asOf = String(catalog.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return 0;
  const priceById = new Map();
  for (const item of catalog.items || []) {
    if (!item?.id || !(Number(item.price) > 0)) continue;
    priceById.set(String(item.id), Number(item.price));
  }
  let n = 0;
  for (const doc of docs || []) {
    if (!doc || marketOnDive(doc) > 0) continue;
    const id = String(doc.tcgcsvId || "");
    const day = String(doc.latest?.lastSeen || doc.latest?.asOf || doc.latest?.date || doc.asOf || "").slice(0, 10);
    const price = priceById.get(id);
    if (!id || day !== asOf || !(price > 0)) continue;
    doc.tcgplayerMarket = price;
    doc.marketFile = "data/catalog/tcgcsv-latest.json";
    n += 1;
  }
  return n;
}

/** Prefer dives that already carry an outlier, then live asks with a real median. */
export async function loadDiveDocsForTeasers(root, { max = 12 } = {}) {
  let index;
  try {
    index = JSON.parse(await readFile(join(root, "research/pulse/dive/index.json"), "utf8"));
  } catch {
    return [];
  }
  const ids = Array.isArray(index.ids) ? index.ids : [];
  const preferred = [];
  const rest = [];
  let outlierIds = new Set();
  try {
    const o = await loadOutlierDoc(root);
    for (const row of [...(o?.high || []), ...(o?.soft || [])]) {
      if (row?.id) outlierIds.add(String(row.id));
    }
  } catch { /* optional */ }
  for (const id of ids) {
    if (outlierIds.has(id)) preferred.push(id);
    else rest.push(id);
  }
  const docs = [];
  for (const id of preferred.concat(rest)) {
    if (docs.length >= max) break;
    try {
      const doc = JSON.parse(await readFile(join(root, "research/pulse/dive", `${id}.json`), "utf8"));
      if (!doc || doc.id !== id) continue;
      const latest = doc.latest || {};
      const live = String(latest.dataStatus || "") === "live";
      const price = Number(latest.priceMedian ?? latest.price ?? 0);
      const day = String(latest.lastSeen || latest.asOf || doc.asOf || "").slice(0, 10);
      const hasOutlier = !!(doc.outlier && doc.outlier.note);
      if (hasOutlier || (live && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day))) docs.push(doc);
    } catch { /* skip missing */ }
  }
  return docs;
}

export function interleaveExtraKinds(lead, extras, { every = 2 } = {}) {
  const out = [...(lead || [])];
  if (!extras?.length) return out;
  const step = Math.max(1, Number(every) || 2);
  let ei = 0;
  const mixed = [];
  for (let i = 0; i < out.length; i += 1) {
    mixed.push(out[i]);
    if ((i + 1) % step === 0 && ei < extras.length) mixed.push(extras[ei++]);
  }
  while (ei < extras.length) mixed.push(extras[ei++]);
  return mixed;
}
