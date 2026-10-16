// Build-time stale flag. A read is stale when its own end date is before the
// board day. Nothing here invents a date.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function readEnd(read) {
  const day = String(read?.endDate || read?.asOf || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

export function stampStale(doc, boardDay = "") {
  const builtOn = DAY.test(String(boardDay || "").slice(0, 10))
    ? String(boardDay).slice(0, 10)
    : (DAY.test(String(doc?.asOf || "").slice(0, 10)) ? String(doc.asOf).slice(0, 10) : "");
  let stale = 0;
  for (const read of doc?.reads || []) {
    const end = readEnd(read);
    const isStale = Boolean(builtOn && end && end < builtOn);
    read.stale = isStale;
    read.builtOn = builtOn;
    if (isStale) stale += 1;
  }
  if (doc && typeof doc === "object") doc.builtOn = builtOn;
  return { builtOn, reads: (doc?.reads || []).length, stale };
}

// Price stale ids, built once at build time so the site never scans buckets on a
// request (Cloudflare error 1102). Same rule as catchem-site readStaleAgainstCard:
// a priced read is stale when the card's nightly row has a different price on the
// same day or later.
const QUIET = new Set(["pokemon", "news", "lag", "supply"]);
export function readStaleAgainstRow(read, row) {
  if (!read || !row || typeof read !== "object" || typeof row !== "object") return false;
  if (QUIET.has(read.readKind) || QUIET.has(read.kind)) return false;
  if (!(read.readKind === "price" || read.kind === "single" || read.kind === "sealed")) return false;
  const left = Number(read.price), right = Number(row.price);
  if (!(left > 0) || !(right > 0)) return false;
  if (Math.round(left * 100) === Math.round(right * 100)) return false;
  const a = String(read.asOf || "").slice(0, 10), b = String(row.asOf || "").slice(0, 10);
  if (!DAY.test(a) || !DAY.test(b)) return false;
  return b >= a;
}

export function stampPriceStale(doc, rowsById) {
  const ids = [];
  for (const read of doc?.reads || []) {
    const sku = String(read?.sku || "");
    if (!/^tcgcsv-\d+$/.test(sku)) continue;
    if (readStaleAgainstRow(read, rowsById.get(sku))) ids.push(String(read.id));
  }
  if (doc && typeof doc === "object") doc.priceStaleIds = ids;
  return ids.length;
}
