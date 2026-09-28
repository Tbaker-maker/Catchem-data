// One shelf row per sku per Pacific day. Listing counts come from the sealed
// run we already do. Market is the same day's TCGplayer print. Nothing here
// fetches a listings feed.

export function ptDate(iso, timeZone = "America/Los_Angeles") {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(when);
}

export function shelfRows({ products, entries, prices, date }) {
  const byId = new Map((entries || []).map((row) => [row.id, row]));
  const marketByPid = new Map();
  for (const row of prices || []) {
    const pid = Number(row?.id);
    const market = Number(row?.market);
    if (pid && market > 0) marketByPid.set(pid, Math.round(market * 100) / 100);
  }
  const seen = new Set();
  const out = [];
  for (const product of products || []) {
    if (product?.dataStatus !== "live" || product?.lastSeen !== date) continue;
    const listingCount = Number(product.listingCount);
    if (!Number.isInteger(listingCount) || listingCount < 20) continue;
    const mapped = byId.get(product.id);
    if (!mapped || mapped.matchConfidence !== "high" || mapped.reviewed !== true) continue;
    const pid = Number(mapped.tcgPlayerId);
    const market = marketByPid.get(pid);
    if (!pid || !(market > 0)) continue;
    const sku = `tcgcsv-${pid}`;
    if (seen.has(sku)) continue;
    seen.add(sku);
    out.push({
      date,
      sku_id: sku,
      kind: "sealed",
      listing_count: listingCount,
      market,
      market_source: "tcgplayer_market",
    });
  }
  return out;
}

export function appendShelfText(existing, rows) {
  const text = String(existing || "");
  const have = new Set();
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    have.add(`${row.date}|${row.sku_id}`);
  }
  const add = (rows || []).filter((row) => row?.sku_id && !have.has(`${row.date}|${row.sku_id}`));
  if (!add.length) return { text: text.endsWith("\n") || text === "" ? text : `${text}\n`, added: 0 };
  const body = add.map((row) => JSON.stringify(row)).join("\n") + "\n";
  const base = text === "" ? "" : text.endsWith("\n") ? text : `${text}\n`;
  return { text: base + body, added: add.length };
}
