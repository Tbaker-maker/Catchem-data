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

/** One read per HIGH/SOFT row already in sealed-price-outliers.json. */
export function outlierReads(doc) {
  const rows = [...(doc?.high || []), ...(doc?.soft || [])];
  const out = [];
  for (const row of rows) {
    if (!row || !row.id) continue;
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

/**
 * Short dive teasers. Uses only fields already on a dive payload (name, latest
 * price/date, optional outlier note). Points at /dive/<id>.
 */
export function diveTeaserReads(dives) {
  const out = [];
  for (const doc of dives || []) {
    if (!doc || !doc.id) continue;
    const name = String(doc.name || "").trim();
    if (!name) continue;
    const latest = doc.latest || {};
    // Dive payloads store the ask median as priceMedian and the day as lastSeen.
    const price = Number(latest.priceMedian ?? latest.price ?? latest.ask ?? latest.market);
    const day = String(latest.lastSeen || latest.asOf || latest.date || doc.asOf || "").slice(0, 10);
    const live = String(latest.dataStatus || "") === "live";
    const hasPrice = live && price > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day);
    // The payload note can end without a stop ("… — review"); the teaser adds
    // one so the next sentence does not run on ("review Deeper look").
    const rawNote = String((doc.outlier && doc.outlier.note) || "").trim();
    const outlierNote = rawNote && !/[.!?]$/.test(rawNote) ? rawNote + "." : rawNote;
    let sentence = "";
    if (hasPrice && outlierNote) {
      sentence = `${name}: ${money(price)} on ${monthDay(day)}. ${outlierNote} Deeper look on the chart.`;
    } else if (hasPrice) {
      sentence = `${name}: ${money(price)} on ${monthDay(day)}. Deeper look on the chart.`;
    } else if (outlierNote) {
      sentence = `${name}: ${outlierNote} Deeper look on the chart.`;
    } else {
      continue;
    }
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
      why: "Fields are from research/pulse/dive/<id>.json. No sold count is on this read.",
      price: hasPrice ? price : undefined,
      asOf: hasPrice ? day : String(doc.asOf || "").slice(0, 10),
      href: `/dive/${encodeURIComponent(doc.id)}`,
      sources: { dive: `research/pulse/dive/${doc.id}.json` },
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
