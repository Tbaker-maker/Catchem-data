// Light explore indexes. No cutoff numbers live here.
// A missing price, change, or count is null, never 0.
import { flagLine, formatFlag, reportFlags } from "./copy-rules.mjs";

export const GZIP_LIMIT = 300 * 1024;

const COPY_VISIBLE = new Set(["about", "claim", "name", "headline", "title", "source", "retailNote"]);

export function adviceFlags(text, field = "", id = "") {
  return flagLine(text, { field, id, house: false });
}

export function banned(text) {
  return adviceFlags(text).length > 0;
}

export function dropIfAdvice(text, field = "", id = "", label = "explore") {
  const flags = adviceFlags(text, field, id);
  if (!flags.length) return false;
  reportFlags(flags, label);
  return true;
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

export function pctChange(from, to) {
  if (from == null || to == null || !Number.isFinite(Number(from)) || !Number.isFinite(Number(to)) || Number(from) === 0) return null;
  return Math.round((((Number(to) - Number(from)) / Number(from)) * 100) * 10000) / 10000;
}

export function cleanImage(url) {
  const s = String(url || "").trim();
  return s ? s : null;
}

export function newsId(url, title) {
  const s = String(url || title || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `news-${(h >>> 0).toString(36)}`;
}

export function links({ set = null, siblings = [], chaseCards = [], mentions = [], reads = [] } = {}) {
  return {
    set: set || null,
    siblings: siblings.filter(Boolean),
    chaseCards: chaseCards.filter(Boolean),
    mentions: mentions.filter(Boolean),
    reads: reads.filter(Boolean),
  };
}

export function exploreRow({ id, name, image, set, price, change, listingsCounted, source, date, rowLinks }) {
  return {
    id,
    name: name || null,
    image: cleanImage(image),
    set: set || null,
    price: price || numberField(null, emptyReceipt()),
    change: change || numberField(null, emptyReceipt()),
    listingsCounted: listingsCounted || numberField(null, emptyReceipt()),
    source: source || null,
    date: date || null,
    links: rowLinks || links(),
  };
}

export function interestingIds(rows, limit = 12) {
  return (rows || [])
    .filter((r) => r.change && r.change.n != null)
    .slice()
    .sort((a, b) => Math.abs(b.change.n) - Math.abs(a.change.n) || String(a.id).localeCompare(String(b.id)))
    .slice(0, limit)
    .map((r) => r.id);
}

export function priceField(n, source, date, method) {
  if (n == null || !Number.isFinite(Number(n))) return numberField(null, emptyReceipt());
  return numberField(Number(n), receipt({ source, date, method, listingsCounted: null, filled: false }));
}

export function countField(n, source, date, method) {
  if (n == null || !Number.isFinite(Number(n))) return numberField(null, emptyReceipt());
  const value = Number(n);
  return numberField(value, receipt({ source, date, method, listingsCounted: value, filled: false }));
}

export function priorChange(history) {
  const pts = (history || [])
    .filter((p) => p && p.date && p.price != null && Number.isFinite(Number(p.price)))
    .map((p) => ({ date: p.date, price: Number(p.price) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (pts.length < 2) return { n: null, from: null, to: null, fromDate: null, toDate: null };
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];
  return { n: pctChange(a.price, b.price), from: a.price, to: b.price, fromDate: a.date, toDate: b.date };
}
