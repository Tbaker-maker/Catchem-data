// Every past read, with a later price and an outcome when our files have both ends.
// A missing price is null, never 0. Misses stay in the list.
import { flagLine, formatFlag, reportFlags } from "./copy-rules.mjs";

const COPY_VISIBLE = new Set(["about", "claim", "name", "headline", "title", "source", "retailNote"]);

export function adviceFlags(text, field = "", id = "") {
  return flagLine(text, { field, id, house: false });
}

export function banned(text) {
  return adviceFlags(text).length > 0;
}

export function publicFlags(doc) {
  const flags = [];
  const walk = (node, id, field) => {
    if (Array.isArray(node)) { for (const v of node) walk(v, id, field); return; }
    if (node && typeof node === "object") {
      const ownId = String(node.id || id || "");
      for (const [k, v] of Object.entries(node)) walk(v, ownId, k);
      return;
    }
    if (typeof node === "string" && field && COPY_VISIBLE.has(field)) flags.push(...adviceFlags(node, field, id));
  };
  walk(doc, "", null);
  return flags;
}

export function assertPublicCopy(doc, label) {
  const flags = publicFlags(doc);
  if (!flags.length) return doc;
  reportFlags(flags, label);
  const err = new Error(`${label} broke a copy rule: ${flags.slice(0, 5).map(formatFlag).join("; ")}`);
  err.code = "BANNED";
  throw err;
}

export function emptyReceipt() {
  return { source: null, date: null, method: null, listingsCounted: null, filled: false };
}

export function receipt({ source, date, method, listingsCounted, filled }) {
  let n = null;
  if (listingsCounted != null && listingsCounted !== "" && Number.isFinite(Number(listingsCounted))) n = Number(listingsCounted);
  return { source: source || null, date: date || null, method: method || null, listingsCounted: n, filled: filled === true };
}

export function numberField(n, rec) {
  const value = n == null || !Number.isFinite(Number(n)) ? null : Number(n);
  return { n: value, receipt: rec || emptyReceipt() };
}

export function cleanClaim(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function pointsOf(history) {
  return (history || [])
    .filter((h) => h && /^\d{4}-\d{2}-\d{2}$/.test(h.date || "") && h.price != null && Number.isFinite(Number(h.price)))
    .map((h) => ({ date: h.date, price: Number(h.price) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function ends(points, date) {
  let prior = null;
  let written = null;
  let later = null;
  for (const p of points || []) {
    if (p.date < date) prior = p;
    else if (p.date === date) written = p;
    else if (!later) later = p;
  }
  return { prior, written, later };
}

// Same way as the move into the written price is a hit.
// A later price that does not continue that way is a miss.
// No direction, or no later price, stays null. The row is still kept.
export function outcomeOf(prior, written, later) {
  if (!prior || !written || !later) return null;
  if (prior.price === written.price) return null;
  const direction = written.price > prior.price ? 1 : -1;
  if (later.price === written.price) return "miss";
  const laterDir = later.price > written.price ? 1 : -1;
  return laterDir === direction ? "hit" : "miss";
}

export function priceField(price, source, date, method) {
  if (price == null || !Number.isFinite(Number(price))) return numberField(null, emptyReceipt());
  return numberField(Number(price), receipt({ source, date, method, listingsCounted: null, filled: false }));
}

export function scoredRow(row, points) {
  const claimDate = row.hist?.[0]?.[0] || null;
  const { prior, written, later } = ends(points, claimDate);
  const outcome = outcomeOf(prior, written, later);
  return {
    id: row.id,
    date: written?.date || claimDate,
    claim: cleanClaim(row.headline || row.name || row.id),
    name: row.name || null,
    kind: row.kind || null,
    price: priceField(written ? written.price : null, written ? "eBay asks" : null, written?.date || null, written ? "price on file the day the read was written" : null),
    laterPrice: priceField(later ? later.price : null, later ? "eBay asks" : null, later?.date || null, later ? "next price on file after the read" : null),
    outcome,
  };
}

export function readRow(read, market) {
  const date = read.asOf || null;
  const on = market?.on || null;
  const later = market?.later || null;
  const source = on ? "TCGplayer market" : null;
  return {
    id: read.id,
    date,
    claim: cleanClaim(read.headline || read.name || read.id),
    name: read.name || null,
    kind: read.readKind || read.kind || null,
    price: priceField(on ? on.price : null, source, on?.date || null, on ? "market print on the read date" : null),
    laterPrice: priceField(later ? later.price : null, later ? "TCGplayer market" : null, later?.date || null, later ? "next market print after the read" : null),
    outcome: null,
  };
}

export function safeClaim(row) {
  const flags = adviceFlags(row?.claim || "", "claim", row?.id || "");
  if (flags.length) reportFlags(flags, "read ledger");
  return row;
}
