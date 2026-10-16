// Compare a hand-kept CAD retail price to our own dated US market price.
// The rate is passed in. This module does not fetch.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseValetRate(payload) {
  const rows = payload?.observations;
  if (!Array.isArray(rows)) return null;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    const rate = num(row?.FXUSDCAD?.v);
    const date = String(row?.d || "");
    if (rate && rate > 0 && DAY.test(date)) return { rate, date, pair: "USD/CAD", source: "Bank of Canada Valet" };
  }
  return null;
}

export function latestMarket(points) {
  const rows = (Array.isArray(points) ? points : []).filter((row) => DAY.test(String(row?.date || "")) && num(row?.market) > 0);
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = rows[rows.length - 1];
  if (!last) return null;
  return { marketUsd: num(last.market), marketDate: last.date };
}

export function gapRows({ products = [], markets = new Map(), rate = null, asOf = "" } = {}) {
  const out = [];
  if (!rate || !(rate.rate > 0) || !DAY.test(String(rate.date || ""))) return out;
  for (const row of products || []) {
    const id = String(row?.id || "").trim();
    const cad = num(row?.cadRetail);
    const checked = String(row?.checked || "");
    if (!id || cad == null || cad <= 0 || !DAY.test(checked)) continue;
    if (!row?.sourceUrl || !/^https?:\/\//.test(row.sourceUrl)) continue;
    const market = markets.get(id) || null;
    if (!market) continue;
    const usCad = Math.round(market.marketUsd * rate.rate * 100) / 100;
    const gapPct = Math.round(((cad - usCad) / usCad) * 1000) / 10;
    out.push({
      id,
      name: row.name || id,
      cadRetail: cad,
      cadChecked: checked,
      sourceUrl: row.sourceUrl,
      enteredBy: row.enteredBy || "person",
      usMarketUsd: market.marketUsd,
      usMarketDate: market.marketDate,
      usdCad: rate.rate,
      rateDate: rate.date,
      usMarketCad: usCad,
      gapPct,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function canadaGapDoc({ products = [], markets = new Map(), rate = null, asOf = "" } = {}) {
  const rows = gapRows({ products, markets, rate, asOf });
  const doc = { asOf, rate: rate ? { usdCad: rate.rate, date: rate.date, source: rate.source } : null, products: rows };
  if (!rows.length) doc.note = products?.length ? "No row had both a CAD retail price and a dated US market price." : "No hand-kept CAD retail rows.";
  return doc;
}
