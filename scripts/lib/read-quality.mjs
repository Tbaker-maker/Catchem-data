// Read quality, from a user's eyes. Prices come from the row or the daily
// file passed in. A missing day is not filled. Listings are not sales.
import { bannedWord, money, pretty } from "./public-bundle.mjs";
import { tcgAmount } from "./card-face.mjs";

export const FOOTER = "An ask is a listing price. A listing is not a sale.";
export const CONDITION_NOTE = "A condition is shown only when the price is for that condition. Graded and played copies can differ.";
export const MOVER_MIN_CENTS = 100;
export const MOVER_MAX_PCT = 200;
export const STREAK_MIN_CENTS = 100;
export const FLOOR_CENTS = 100;
export const FLOOR_PCT = 3;
export const TURN_DAY_CENTS = 25;
export const TURN_DAY_PCT = 3;
export const SEALED_MIN_CENTS = 500;
export const SOLD_KINDS = new Set(["volume", "quiet", "mix", "conditions", "soldflat", "solddown", "setshare"]);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_HIGH = new Set(["apr", "may", "jun", "jul", "sep"]);
const LONG_RE = /6-month|90-day|90 days|\bApril\b|\bMay\b|\bJune\b|\bJuly\b|September high|\bSep high\b/i;

export function shiftDay(iso, days) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + days * 86400000).toISOString().slice(0, 10);
}

export function centsOf(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100);
}

export function formatPct(pct) {
  const n = Math.round(Math.abs(Number(pct)) * 10) / 10;
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : String(n);
}

export function scrub(text) {
  return pretty(String(text || ""))
    .replace(/[—–]/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function priceForm({ name, set, num, to, from, end, start, pct }) {
  const who = pretty(name || "");
  const setName = pretty(set || "");
  const number = String(num || "").trim();
  let tail = "";
  if (setName && number) tail = ` (${setName}) ${number}`;
  else if (setName) tail = ` (${setName})`;
  else if (number) tail = ` ${number}`;
  const dir = Number(to) >= Number(from) ? "Up" : "Down";
  const delta = tcgAmount(Math.abs((centsOf(to) - centsOf(from)) / 100), money);
  const p = pct != null && pct !== "" ? formatPct(pct) : formatPct(((Number(to) - Number(from)) / Number(from)) * 100);
  return `${who}${tail}. TCGplayer market: ${tcgAmount(to, money)} (${end}), from ${tcgAmount(from, money)} (${start}). ${dir} ${delta}, ${p}%.`;
}

export function whyPlain(from, to) {
  const delta = (centsOf(to) - centsOf(from)) / 100;
  const dir = delta >= 0 ? "Up" : "Down";
  return `${dir} ${money(Math.abs(delta))} on those two dates.`;
}

export function whyLeak(text) {
  const s = String(text || "");
  return /tcgcsv-|data\/|—/.test(s) || bannedWord(s);
}

export function quietNight(asOf, n) {
  const count = Number(n) || 0;
  if (count >= 3) return "";
  if (count === 0) return `Quiet night, ${asOf}. No read cleared the bar. Missing days were not filled in.`;
  return `Quiet night, ${asOf}. ${count} read cleared the bar. A thin board is the whole board.`;
}

export function floorOk(from, to, pct) {
  const moved = Math.abs((centsOf(to) ?? 0) - (centsOf(from) ?? 0));
  const p = Math.abs(Number(pct));
  return moved >= FLOOR_CENTS && p >= FLOOR_PCT;
}

export function moverGate(proof, dailyFiles) {
  if (!proof || proof.days !== 7) return false;
  const moved = Math.abs((centsOf(proof.to) ?? 0) - (centsOf(proof.from) ?? 0));
  const pct = Math.abs(Number(proof.pct));
  if (moved < MOVER_MIN_CENTS || pct < 8 || pct >= MOVER_MAX_PCT) return false;
  if (dailyFiles && (!dailyFiles.has(proof.start) || !dailyFiles.has(proof.end))) return false;
  return true;
}

export function streakGate({ asOf, n, first, last, dailyFiles, hasDay }) {
  if (!(n >= 4)) return false;
  if (Math.abs((centsOf(last) ?? 0) - (centsOf(first) ?? 0)) < STREAK_MIN_CENTS) return false;
  const pct = first ? Math.abs((Number(last) - Number(first)) / Number(first)) * 100 : 0;
  if (!(pct >= FLOOR_PCT)) return false;
  if (dailyFiles) {
    for (let i = 0; i <= n; i += 1) {
      const day = shiftDay(asOf, -i);
      if (!dailyFiles.has(day)) return false;
      if (hasDay && !hasDay(day)) return false;
    }
  }
  return true;
}

function namedDate(asOf, mon, day) {
  const month = MONTHS.indexOf(String(mon || "").toLowerCase().slice(0, 3)) + 1;
  const n = Number(day);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) || month < 1 || n < 1 || n > 31) return "";
  const iso = `${asOf.slice(0, 4)}-${String(month).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  if (iso > asOf) return `${Number(asOf.slice(0, 4)) - 1}-${iso.slice(5)}`;
  return iso;
}

function citedDates(text, asOf) {
  const out = new Set();
  const re = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\b/gi;
  let hit = re.exec(String(text || ""));
  while (hit) {
    const iso = namedDate(asOf, hit[1], hit[2]);
    if (iso) out.add(iso);
    hit = re.exec(String(text || ""));
  }
  return out;
}

function monthKey(text, asOf) {
  if (!/high/i.test(String(text || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return "";
  const hit = String(text).match(/\b(April|May|June|July|September|Apr|Jun|Jul|Sep)\b/i);
  if (!hit) return "";
  const mon = hit[1].toLowerCase().slice(0, 3);
  if (!MONTH_HIGH.has(mon)) return "";
  const idx = MONTHS.indexOf(mon) + 1;
  const year = Number(asOf.slice(0, 4));
  const asOfMonth = Number(asOf.slice(5, 7));
  const y = idx > asOfMonth ? year - 1 : year;
  return `${y}-${String(idx).padStart(2, "0")}`;
}

// True when a 6-month, 90-day, or named-month high is not backed by daily files.
// No file set means this gate stays off (in-memory proofs still run).
export function longWindowBlocked(row, dailyFiles, hasDay) {
  if (!dailyFiles) return false;
  const text = `${row?.headline || ""} ${row?.path || ""}`;
  if (!LONG_RE.test(text)) return false;
  const asOf = String(row?.asOf || row?._proof?.end || "");
  const cited = citedDates(text, asOf);
  const start = row?._proof?.start || row?.startDate || "";
  if (start) cited.add(start);
  if (!cited.size) return true;
  for (const day of cited) {
    if (!dailyFiles.has(day)) return true;
  }
  const month = monthKey(text, asOf);
  if (month) {
    for (const day of dailyFiles) {
      if (!String(day).startsWith(month)) continue;
      if (!hasDay || !hasDay(day)) return true;
    }
  }
  return false;
}

export function boardDrop(row, { dropSold = true } = {}) {
  const kind = String(row?.readKind || row?.kind || "");
  const text = `${row?.headline || ""} ${row?.path || ""} ${row?.why || ""}`;
  if (kind === "pokemon" || kind === "plain") return true;
  if (/deeper look on the chart/i.test(text)) return true;
  if (kind === "still" || /stayed the same/i.test(text)) return true;
  if (kind === "listing" || /browse total/i.test(text)) return true;
  if (dropSold && SOLD_KINDS.has(kind)) return true;
  if (/\b\d+ cards, \d+ artists\b/.test(text)) return true;
  return false;
}

function spreadOk(row) {
  const high = Number(row?.receipt?.high);
  const low = Number(row?.receipt?.low);
  return low > 0 && high >= low * 2;
}

function askOk(row) {
  const from = centsOf(row?.receipt?.askFrom);
  const to = centsOf(row?.receipt?.askTo);
  return from != null && to != null && Math.abs(to - from) >= MOVER_MIN_CENTS;
}

function mktOk(row) {
  const from = centsOf(row?.receipt?.marketFrom);
  const to = centsOf(row?.receipt?.marketTo);
  return from != null && to != null && Math.abs(to - from) >= MOVER_MIN_CENTS;
}

function shapeWhy(row, signal) {
  if (signal === "spread") return `The high ask is ${money(row.receipt.high)}. The low ask is ${money(row.receipt.low)}.`;
  if (signal === "askmove") {
    const up = Number(row.receipt.askTo) >= Number(row.receipt.askFrom);
    const delta = Math.abs((centsOf(row.receipt.askTo) - centsOf(row.receipt.askFrom)) / 100);
    return `${up ? "Up" : "Down"} ${money(delta)} on the ask.`;
  }
  const up = Number(row.receipt.marketTo) >= Number(row.receipt.marketFrom);
  const delta = Math.abs((centsOf(row.receipt.marketTo) - centsOf(row.receipt.marketFrom)) / 100);
  return `${up ? "Up" : "Down"} ${money(delta)} on the market price.`;
}

function flattenExtra(extra) {
  const rows = [];
  if (Array.isArray(extra?.reads)) rows.push(...extra.reads);
  for (const key of ["spread", "askmove", "mktmove", "still", "listing", "outlier", "dive", "volume", "quiet", "mix", "conditions", "soldflat", "solddown", "setshare", "pokemon"]) {
    const bucket = extra?.[key];
    if (Array.isArray(bucket)) rows.push(...bucket);
    else if (bucket && Array.isArray(bucket.reads)) rows.push(...bucket.reads);
  }
  return rows;
}

export function shapeReads(extra, { dropSold = true } = {}) {
  const out = [];
  let spread = 0;
  let ask = 0;
  let mkt = 0;
  for (const row of flattenExtra(extra)) {
    if (!row || boardDrop(row, { dropSold })) continue;
    const kind = String(row.readKind || row.kind || "");
    if (kind === "spread") {
      if (spread || !spreadOk(row)) continue;
      spread += 1;
    } else if (kind === "askmove") {
      if (ask || !askOk(row)) continue;
      ask += 1;
    } else if (kind === "mktmove") {
      if (mkt || !mktOk(row)) continue;
      mkt += 1;
    } else continue;
    const why = shapeWhy(row, kind);
    const headline = scrub(row.headline || row.path || "");
    out.push({
      ...row,
      signal: kind,
      headline,
      path: headline,
      whyItMatters: why,
      why,
      whatWouldMakeThisWrong: "Wrong if the receipt prices are not the ones on those dates.",
      sourceLine: String(row.sku || row.id || ""),
    });
  }
  return out;
}

export function turnedReads({ series, asOf, names, dailyFiles }) {
  if (!series || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return [];
  const start = shiftDay(asOf, -7);
  const prior = shiftDay(asOf, -1);
  if (dailyFiles && (!dailyFiles.has(start) || !dailyFiles.has(prior) || !dailyFiles.has(asOf))) return [];
  const hits = [];
  for (const [id, days] of series.entries()) {
    const from = Number(days.get?.(start));
    const mid = Number(days.get?.(prior));
    const to = Number(days.get?.(asOf));
    if (!(from > 0) || !(mid > 0) || !(to > 0)) continue;
    const weekCents = centsOf(to) - centsOf(from);
    const dayCents = centsOf(to) - centsOf(mid);
    const weekPct = Math.round(((to - from) / from) * 1000) / 10;
    const dayPct = Math.round(((to - mid) / mid) * 1000) / 10;
    if (Math.abs(weekCents) < MOVER_MIN_CENTS || Math.abs(weekPct) < 8 || Math.abs(weekPct) >= MOVER_MAX_PCT) continue;
    if (weekCents === 0 || dayCents === 0 || Math.sign(dayCents) === Math.sign(weekCents)) continue;
    if (Math.abs(dayCents) < TURN_DAY_CENTS || Math.abs(dayPct) < TURN_DAY_PCT) continue;
    const sku = `tcgcsv-${id}`;
    const named = names?.get?.(sku);
    if (!named?.name) continue;
    const weekDir = weekCents > 0 ? "up" : "down";
    const dayDir = dayCents > 0 ? "up" : "down";
    const headline = `${pretty(named.name)}. TCGplayer market: ${tcgAmount(to, money)} (${asOf}), from ${tcgAmount(from, money)} (${start}). Last night it went from ${tcgAmount(mid, money)} to ${tcgAmount(to, money)}.`;
    hits.push({
      id: `turned-${sku}`,
      sku,
      signal: "turned",
      readKind: "turned",
      kind: "turned",
      name: pretty(named.name),
      set: named.set || "",
      headline,
      path: headline,
      price: to,
      changePct: weekPct,
      windowDays: 7,
      startDate: start,
      endDate: asOf,
      asOf,
      source: "TCGplayer market",
      sourceLine: sku,
      href: named.href || `/c/${sku}`,
      whyItMatters: `The week is ${weekDir} ${money(Math.abs(weekCents) / 100)}. The last day turned ${dayDir} ${money(Math.abs(dayCents) / 100)}.`,
      why: `The week is ${weekDir} ${money(Math.abs(weekCents) / 100)}. The last day turned ${dayDir} ${money(Math.abs(dayCents) / 100)}.`,
      whatWouldMakeThisWrong: "Wrong if one of those three dates has a different market price.",
      _abs: Math.abs(weekPct),
    });
  }
  hits.sort((a, b) => b._abs - a._abs || a.sku.localeCompare(b.sku));
  return hits.slice(0, 1).map(({ _abs, ...row }) => row);
}

// The whole week's move came from one price step that is already 2+ days old
// and the price has been flat since. That read already ran; do not repeat it.
export function staleOneStep(days, start, asOf) {
  let prev = null, steps = 0, stepDay = "";
  for (let d = start; d <= asOf; d = shiftDay(d, 1)) {
    const v = Number(days.get(d));
    if (!(v > 0)) continue;
    if (prev != null && centsOf(v) !== centsOf(prev)) { steps += 1; stepDay = d; }
    prev = v;
  }
  return steps === 1 && stepDay < shiftDay(asOf, -1);
}

export function sealedWeekReads({ products, series, asOf, dailyFiles }) {
  const list = Array.isArray(products) ? products : (products?.products || []);
  if (!series || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOf || ""))) return [];
  const start = shiftDay(asOf, -7);
  if (dailyFiles && (!dailyFiles.has(start) || !dailyFiles.has(asOf))) return [];
  const hits = [];
  for (const product of list) {
    if (!product || product.combinedArts === true) continue;
    const id = Number(product.tcgPlayerId);
    if (!id) continue;
    const days = series.get(id);
    if (!days) continue;
    const from = Number(days.get(start));
    const to = Number(days.get(asOf));
    if (!(from > 0) || !(to > 0)) continue;
    const moved = centsOf(to) - centsOf(from);
    const pct = Math.round(((to - from) / from) * 1000) / 10;
    if (Math.abs(moved) < SEALED_MIN_CENTS || Math.abs(pct) < 8 || Math.abs(pct) >= MOVER_MAX_PCT) continue;
    if (staleOneStep(days, start, asOf)) continue;
    const dir = moved >= 0 ? "Up" : "Down";
    const name = pretty(product.name || "");
    const headline = `${name}. TCGplayer market: ${tcgAmount(to, money)} (${asOf}), from ${tcgAmount(from, money)} (${start}). ${dir} ${tcgAmount(Math.abs(moved) / 100, money)}.`;
    hits.push({
      id: `sealed-week-${product.id || id}`,
      sku: String(product.id || `tcgcsv-${id}`),
      signal: "sealed",
      readKind: "sealed",
      kind: "sealed",
      name,
      set: product.set || "",
      headline,
      path: headline,
      price: to,
      changePct: pct,
      windowDays: 7,
      startDate: start,
      endDate: asOf,
      asOf,
      source: "TCGplayer market",
      sourceLine: `tcgcsv-${id}`,
      whyItMatters: "A sealed product moved $5 or more on the two dates. This is the market price, not an eBay ask, and not a sale.",
      why: "A sealed product moved $5 or more on the two dates. This is the market price, not an eBay ask, and not a sale.",
      whatWouldMakeThisWrong: "Wrong if either date has a different market price.",
      _abs: Math.abs(moved),
    });
  }
  hits.sort((a, b) => b._abs - a._abs || String(a.sku).localeCompare(String(b.sku)));
  return hits.slice(0, 1).map(({ _abs, ...row }) => row);
}

export function releaseReads({ radar, asOf }) {
  const rows = radar?.upcoming || radar?.rows || (Array.isArray(radar) ? radar : []);
  const updated = String(radar?.updated || radar?.checkedAt || "").slice(0, 10);
  const hits = [];
  for (const row of rows) {
    if (String(row?.confidence || "") !== "verified") continue;
    if (String(row?.type || "").toLowerCase().startsWith("jp")) continue;
    const date = String(row?.date || row?.releaseDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (asOf !== date && asOf !== shiftDay(date, -7)) continue;
    const name = scrub(row?.name || "");
    if (!name || !updated) continue;
    const headline = `${name} is dated ${date} on the release file (checked ${updated}). No price on this line.`;
    if (/msrp|\$\s?\d/i.test(headline)) continue;
    hits.push({
      id: `release-${date}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`,
      sku: `release-${date}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}`,
      signal: "release",
      readKind: "release",
      kind: "release",
      name,
      set: "",
      headline,
      path: headline,
      asOf,
      source: "release file",
      sourceLine: `release file checked ${updated}`,
      whyItMatters: "The date is on the release file. No market price is on this line.",
      why: "The date is on the release file. No market price is on this line.",
      whatWouldMakeThisWrong: "Wrong if the release file does not date this product on that day.",
      _onDay: asOf === date ? 0 : 1,
    });
  }
  hits.sort((a, b) => a._onDay - b._onDay || a.name.localeCompare(b.name));
  return hits.slice(0, 1).map(({ _onDay, ...row }) => row);
}

export function namedPrinting(row) {
  const printings = (Array.isArray(row?.printings) ? row.printings : []).filter((p) => p && p.name && Number(p.price) > 0);
  const named = String(row?.printing || "").trim();
  if (printings.length > 1) {
    const hit = printings.find((p) => p.name === named);
    if (!hit) return null;
    return { name: hit.name, price: Number(hit.price), many: true };
  }
  if (printings.length === 1) return { name: printings[0].name, price: Number(printings[0].price), many: false };
  const market = Number(row?.market ?? row?.price);
  if (!(market > 0)) return null;
  return { name: named, price: market, many: false };
}

export function printingSentence(row) {
  const picked = namedPrinting(row);
  if (!picked) return null;
  const name = pretty(row?.name || "Card");
  const setName = pretty(row?.set || "");
  const number = String(row?.number || "").trim();
  let tail = "";
  if (setName && number) tail = ` (${setName}) ${number}`;
  else if (setName) tail = ` (${setName})`;
  const day = String(row?.asOf || row?.date || "");
  const dateBit = day ? ` (${day})` : "";
  const printingBit = picked.many || picked.name ? `${picked.name} ` : "";
  return `${name}${tail}. TCGplayer market: ${printingBit}${tcgAmount(picked.price, money)}${dateBit}.`;
}

export function priceOnExactDay(dayDoc, productId, price) {
  const id = Number(String(productId || "").replace(/\D/g, ""));
  const want = centsOf(price);
  if (!id || want == null) return false;
  const rows = dayDoc?.prices || [];
  const row = rows.find((item) => Number(item?.id) === id);
  if (!row) return false;
  if (centsOf(row.market) === want) return true;
  for (const printing of row.printings || []) {
    if (centsOf(printing?.price ?? printing) === want) return true;
  }
  return false;
}

export function sentenceForDay(card, dayDoc) {
  const id = card?.tcgplayerProductId || card?.id;
  const price = Number(card?.price ?? card?.market);
  if (!priceOnExactDay(dayDoc, id, price)) return null;
  return printingSentence({ ...card, market: price, price, asOf: dayDoc?.date || card?.asOf || "" });
}

export function priceCentsInDay(dayDoc) {
  const set = new Set();
  const add = (n) => {
    const c = centsOf(n);
    if (c != null && c > 0) set.add(c);
  };
  for (const row of dayDoc?.prices || []) {
    add(row?.market);
    for (const printing of row?.printings || []) add(printing?.price ?? printing);
  }
  return set;
}

export function chaseInMorningFile(cards, dayDoc) {
  const cents = priceCentsInDay(dayDoc);
  return (cards || []).filter((card) => {
    const price = Number(card?.priceMarket);
    const c = centsOf(price);
    return c != null && c > 0 && cents.has(c);
  });
}

export function publishReads(lib) {
  const reads = Array.isArray(lib?.board) ? lib.board : [];
  return {
    asOf: lib?.asOf || "",
    source: lib?.source || "",
    count: reads.length,
    reads,
    footer: lib?.footer || FOOTER,
    conditionNote: lib?.conditionNote || CONDITION_NOTE,
    quietNight: lib?.quietNight || "",
  };
}
