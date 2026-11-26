// A TCGplayer market field that sits unchanged for N days while the
// lowest listing moves is stale. Reads must not call that price "tonight".
// N lives in catchem-data-private (config/read-stale-market.json).
// With no N, or no moving lows, nothing changes. This file does not call
// any network API.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export function validStaleMarket(cfg) {
  if (!cfg || typeof cfg !== "object") return null;
  const unchangedDays = Number(cfg.unchangedDays);
  if (!(unchangedDays >= 1)) return null;
  return { unchangedDays };
}

function cents(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100);
}

function iso(row) {
  const s = String(Array.isArray(row) ? row[0] : row?.date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function priceOf(row) {
  return Number(Array.isArray(row) ? row[1] : row?.price ?? row?.low ?? row?.market);
}

function series(points, asOf) {
  const rows = [];
  for (const p of points || []) {
    const date = iso(p);
    const price = priceOf(p);
    if (!date || date > asOf || !(price > 0)) continue;
    if (rows.length && rows[rows.length - 1][0] === date) rows[rows.length - 1] = [date, price];
    else rows.push([date, price]);
  }
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return rows;
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

export function lastMarketChange(markets, asOf) {
  const rows = series(markets, asOf);
  if (!rows.length) return null;
  let last = rows[0];
  for (const row of rows) {
    if (cents(row[1]) !== cents(last[1])) last = row;
  }
  return { date: last[0], price: last[1] };
}

function lowsMovedSince(lows, from, asOf) {
  const rows = series(lows, asOf).filter((p) => p[0] >= from);
  const seen = new Set();
  for (const row of rows) {
    const c = cents(row[1]);
    if (c != null) seen.add(c);
  }
  return seen.size >= 2;
}

export function staleMarket(markets, lows, asOf, cfg) {
  const limit = validStaleMarket(cfg);
  if (!limit || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return { stale: false };
  const last = lastMarketChange(markets, asOf);
  if (!last) return { stale: false };
  const frozenDays = daysBetween(last.date, asOf);
  if (!(frozenDays >= limit.unchangedDays)) return { stale: false };
  if (!lowsMovedSince(lows, last.date, asOf)) return { stale: false };
  return { stale: true, lastChange: last.date, price: last.price, frozenDays };
}

export async function loadStaleMarket(root) {
  if (!root) return null;
  const path = join(root, "..", "catchem-data-private", "config", "read-stale-market.json");
  try {
    return validStaleMarket(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return null;
  }
}
