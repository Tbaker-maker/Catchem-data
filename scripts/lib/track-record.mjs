// Scores a shipped read only when a later price exists on the exact day.
// Under 7 days is too early. No later price means no score.

const COPY_BAN = /\b(resistance|support|breakout|bottom|cheap|crash|buys?|sells?|selling|holds?|holding|printed)\b/i;

export function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function dayGap(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function sameWay(direction, from, to) {
  if (direction === "down") return to < from;
  if (direction === "up") return to > from;
  return null;
}

export function scoreRead(read, later = {}, today) {
  const shipped = String(read?.asOf || "").slice(0, 10);
  const price = Number(read?.price);
  const direction = read?.direction === "up" || read?.direction === "down" ? read.direction : "";
  const type = String(read?.readKind || read?.type || "read");
  const age = dayGap(shipped, today);
  const base = {
    id: String(read?.id || ""),
    productId: String(read?.sku || ""),
    type,
    shipped,
    price: price > 0 ? price : null,
    direction,
    headline: String(read?.headline || ""),
    age,
  };
  if (!base.id || !base.productId || !(price > 0) || age == null) {
    return { ...base, status: "no-score", note: "The read has no date, product id, or price." };
  }
  if (age < 7) return { ...base, status: "too-early", note: "Too early to score." };
  const marks = {};
  for (const horizon of [7, 30]) {
    if (age < horizon) continue;
    const day = addDays(shipped, horizon);
    const next = Number(later[day]);
    if (!(next > 0)) {
      marks[String(horizon)] = { day, price: null, sameDirection: null };
      continue;
    }
    marks[String(horizon)] = { day, price: next, sameDirection: sameWay(direction, price, next) };
  }
  const scored = Object.values(marks).some((mark) => mark.price != null);
  return { ...base, status: scored ? "scored" : "no-later-price", note: scored ? "" : "No later price, so no score.", marks };
}

export function buildTrackRecord(reads, laterByProduct = {}, today) {
  const rows = (reads || []).map((read) => scoreRead(read, laterByProduct[read?.sku] || {}, today));
  rows.sort((a, b) => String(a.shipped).localeCompare(String(b.shipped)) || String(a.id).localeCompare(String(b.id)));
  const byType = {};
  for (const row of rows) {
    if (!byType[row.type]) byType[row.type] = { type: row.type, reads: 0, tooEarly: 0, noLaterPrice: 0, scored7: 0, hit7: 0, scored30: 0, hit30: 0 };
    const bag = byType[row.type];
    bag.reads += 1;
    if (row.status === "too-early") bag.tooEarly += 1;
    if (row.status === "no-later-price") bag.noLaterPrice += 1;
    if (row.marks?.["7"]?.price != null && row.marks["7"].sameDirection != null) {
      bag.scored7 += 1;
      if (row.marks["7"].sameDirection) bag.hit7 += 1;
    }
    if (row.marks?.["30"]?.price != null && row.marks["30"].sameDirection != null) {
      bag.scored30 += 1;
      if (row.marks["30"].sameDirection) bag.hit30 += 1;
    }
  }
  const types = Object.values(byType).sort((a, b) => a.type.localeCompare(b.type));
  const dates = rows.map((row) => row.shipped).filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)).sort();
  const blob = JSON.stringify({ rows, types });
  if (COPY_BAN.test(blob)) throw new Error("track record used a banned word");
  return {
    asOf: today,
    rule: "A read is stored with its ship date and price. After 7 and 30 days, the later price is the exact day, or there is no score. Under 7 days is too early to score.",
    oldest: dates[0] || "",
    newest: dates[dates.length - 1] || "",
    count: rows.length,
    tooEarly: rows.filter((row) => row.status === "too-early").length,
    noLaterPrice: rows.filter((row) => row.status === "no-later-price").length,
    scored7: types.reduce((n, row) => n + row.scored7, 0),
    scored30: types.reduce((n, row) => n + row.scored30, 0),
    types,
    rows,
  };
}
