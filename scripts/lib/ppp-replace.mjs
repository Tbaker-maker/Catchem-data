// PPP files written beside the PPT ones. Never the PPT path.
// A missing limits file, or a count under that file, writes nothing.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pppSealedMarket } from "./ppp-compare.mjs";
import { verifyStoredHistory } from "./ppp-sealed-history.mjs";

export const LIMITS_FILE = "data/meta/ppp-replace-limits.json";
export const VOLUME_PPT = "data/meta/tcgplayer-volume.json";
export const VOLUME_PPP = "data/meta/tcgplayer-volume-ppp.json";
export const SHAPE_PPT = "data/meta/shape-facts.json";
export const SHAPE_PPP = "data/meta/shape-facts-ppp.json";
export const CROSS_PPT = "data/sealed-crosscheck.json";
export const CROSS_PPP = "data/sealed-crosscheck-ppp.json";
export const HISTORY_PPT = "data/history/ppt-sealed";
export const HISTORY_PPP = "data/history/ppp-sealed";

async function readJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return null; }
}

export async function loadReplaceLimits(root) {
  const doc = await readJson(join(root, LIMITS_FILE));
  if (!doc || typeof doc !== "object") return null;
  const keys = ["volumeMinCards", "shapeMinCards", "crosscheckMinProducts", "sealedHistoryMinProducts"];
  for (const key of keys) {
    if (!Number.isInteger(doc[key]) || doc[key] < 1) return null;
  }
  return doc;
}

function refuse(reason) {
  return { written: false, ready: false, reason, cards: 0, products: 0 };
}

// eBay sales/volume rows are not TCGplayer Near Mint counts. Only a row that
// names TCGplayer and a Near Mint count can feed the listings-counted table.
export function tcgListingsRows(entry) {
  const rows = Array.isArray(entry?.rows) ? entry.rows : Array.isArray(entry) ? entry : [];
  const out = [];
  for (const row of rows) {
    if (String(row?.source || "").toLowerCase() !== "tcgplayer") continue;
    const cond = String(row?.condition || "");
    if (cond && cond !== "Near Mint" && cond !== "NM") continue;
    const n = Number(row?.listings ?? row?.volume);
    if (!Number.isInteger(n) || n < 0) continue;
    const day = String(row?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    out.push({ date: day, listings: n });
  }
  return out;
}

export function volumeDocFromShards(shards, { updatedOn, minCards }) {
  const cards = {};
  for (const [pid, entry] of Object.entries(shards || {})) {
    const rows = tcgListingsRows(entry);
    if (!rows.length) continue;
    const id = String(pid).startsWith("tcgcsv-") ? String(pid) : `tcgcsv-${pid}`;
    cards[id] = { id, tcgplayerProductId: Number(String(pid).replace(/^tcgcsv-/, "")), rows };
  }
  const n = Object.keys(cards).length;
  if (!(n >= minCards)) return null;
  return {
    schema: 1,
    source: "TCGplayer Near Mint listings counted via PkmnPrices",
    updatedOn: updatedOn || "",
    counts: { cards: n },
    cards,
  };
}

// Shape facts need a daily Near Mint count and a played condition price.
// A sealed unopened history row is not a card shape fact.
export function shapeRowFromHistory(card, { id, printing, scrapedOn }) {
  const rows = Array.isArray(card?.rows) ? card.rows : [];
  const nm = rows.filter((row) => String(row?.condition || "") === "Near Mint" && Number(row?.listings ?? row?.volume) >= 0 && Number(row?.market) > 0);
  const played = rows.find((row) => /played/i.test(String(row?.condition || "")) && Number(row?.market) > 0);
  if (nm.length < 7 || !played || !printing || !id) return null;
  return {
    id,
    tcgplayerProductId: Number(String(id).replace(/^tcgcsv-/, "")) || null,
    printing,
    scrapedOn: scrapedOn || "",
    pair: { nearMint: Number(nm[nm.length - 1].market), played: Number(played.market), playedCondition: String(played.condition) },
  };
}

export function shapeDocFromCards(cards, { updatedOn, minCards }) {
  const out = {};
  for (const card of cards || []) {
    const row = shapeRowFromHistory(card, card || {});
    if (!row) continue;
    out[row.id] = row;
  }
  if (Object.keys(out).length < minCards) return null;
  return {
    schema: 1,
    updatedOn: updatedOn || "",
    note: "Facts for reads from PkmnPrices card history. Not a bulk price table.",
    cards: out,
  };
}

export function crosscheckFromPulls(pulls, idByTid) {
  const products = [];
  const seen = new Set();
  for (const pull of pulls || []) {
    const tid = String(pull?.tcgPlayerId || "");
    const hit = pppSealedMarket(pull?.body);
    const id = idByTid.get(tid);
    if (!id || !hit || seen.has(id)) continue;
    seen.add(id);
    products.push({
      id,
      tcgMarket: hit.price,
      tcgListings: null,
      providerUpdatedAt: hit.createdAt || null,
      dataStatus: "live",
    });
  }
  products.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return products;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeReplacements({ root, today = "", volumeShards = null, shapeCards = null, pulls = null, idByTid = null, historyRecords = null, ownByPid = null } = {}) {
  const limits = await loadReplaceLimits(root);
  if (!limits) return { ready: false, written: [], reason: `missing ${LIMITS_FILE}; fail closed` };
  const written = [];
  const blocked = [];

  const volume = volumeDocFromShards(volumeShards || {}, { updatedOn: today, minCards: limits.volumeMinCards });
  if (!volume) blocked.push({ output: VOLUME_PPP, reason: `fewer than ${limits.volumeMinCards} cards with TCGplayer Near Mint listings counted; eBay volume rows are not this table` });
  else {
    await writeJson(join(root, VOLUME_PPP), volume);
    written.push(VOLUME_PPP);
  }

  const shape = shapeDocFromCards(shapeCards || [], { updatedOn: today, minCards: limits.shapeMinCards });
  if (!shape) blocked.push({ output: SHAPE_PPP, reason: `fewer than ${limits.shapeMinCards} cards with Near Mint history and a played price` });
  else {
    await writeJson(join(root, SHAPE_PPP), shape);
    written.push(SHAPE_PPP);
  }

  const products = crosscheckFromPulls(pulls || [], idByTid || new Map());
  if (products.length < limits.crosscheckMinProducts) {
    blocked.push({ output: CROSS_PPP, reason: `${products.length} sealed prices, need ${limits.crosscheckMinProducts}` });
  } else {
    const stamps = products.map((row) => row.providerUpdatedAt).filter((value) => typeof value === "string" && value.includes("T")).sort();
    await writeJson(join(root, CROSS_PPP), {
      asOf: today || "",
      updatedAt: stamps.length ? stamps[stamps.length - 1] : null,
      source: "PkmnPrices sealed current price, TCGplayer USD, unopened",
      note: "Sits beside the PPT crosscheck. Does not replace that file.",
      products,
    });
    written.push(CROSS_PPP);
  }

  const history = verifyStoredHistory(historyRecords || [], ownByPid || new Map());
  if (history.verified < limits.sealedHistoryMinProducts) {
    blocked.push({ output: HISTORY_PPP, reason: `${(historyRecords || []).length} stored histories, ${history.verified} verified, need ${limits.sealedHistoryMinProducts}. chartFill stays off` });
  } else {
    for (const item of history.items) {
      const file = join(root, HISTORY_PPP, `${item.pid}.json`);
      await writeJson(file, {
        tcgplayerProductId: item.pid,
        source: "PkmnPrices sealed history, TCGplayer USD, unopened",
        note: "Verified against our own days. Not a PPT file.",
        points: item.points.map(([date, market]) => ({ date, market })),
      });
    }
    written.push(HISTORY_PPP);
  }

  const pptStill = [VOLUME_PPT, SHAPE_PPT, CROSS_PPT, HISTORY_PPT];
  return {
    ready: blocked.length === 0,
    written,
    blocked,
    pptUntouched: pptStill,
    reason: blocked.map((row) => `${row.output}: ${row.reason}`).join("; "),
  };
}

export async function countJsonFiles(dir) {
  if (!existsSync(dir)) return 0;
  const names = await readdir(dir);
  return names.filter((name) => name.endsWith(".json") && name !== "manifest.json").length;
}
