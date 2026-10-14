// The published board and the public bundle have to name the same price.
// A read can be rebuilt from the bundle. It cannot keep yesterday's price.

export function boardPriceMismatches({ reads = [], movers = [], priceOf = new Map(), asOf = "" } = {}) {
  const get = (id) => (priceOf instanceof Map ? priceOf.get(id) : priceOf?.[id]);
  const out = [];
  const rows = Array.isArray(reads) ? reads : (reads?.reads || []);
  const boardDay = asOf || (Array.isArray(reads) ? "" : reads?.asOf) || "";
  for (const read of rows) {
    const id = String(read.href || "").split("/").pop();
    const want = get(id);
    const have = Number(read.price);
    const pastWindow = boardDay && read.endDate && read.endDate < boardDay;
    if (!pastWindow && want != null && Number.isFinite(have) && Math.abs(want - have) > 0.009) {
      out.push({ id, where: "read", have, want });
    }
    if (/ebayimg|ebay\.com|images\.ebay/i.test(read.image || "")) out.push({ id, where: "image" });
  }
  for (const row of movers) {
    const id = String(row.href || row.id || "").split("/").pop();
    const want = get(id);
    const have = Number(row.price);
    if (want != null && Number.isFinite(have) && Math.abs(want - have) > 0.009) {
      out.push({ id, where: "mover", have, want });
    }
  }
  return out;
}
