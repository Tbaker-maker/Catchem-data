// Facts from a PPT set raw already on disk. A missing field is a skip, never a fill.
// salesByGrade is not read here: the nightly set raws do not carry it.
import { END_LAG_DAYS, normalizeNumber, shiftDay } from "./tcgplayer-volume.mjs";

export const SHAPE_STATE_FILE = "ppt-raw-private/shape-facts.json";
export const CONDITION_ORDER = ["Near Mint", "Lightly Played", "Moderately Played", "Heavily Played", "Damaged"];
export const PLAYED_ORDER = ["Lightly Played", "Moderately Played", "Heavily Played"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function cents(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** One point per day. A repeated date is ambiguous, so the window is refused. */
function pointsByDay(history, from, to) {
  const seen = new Map();
  for (const point of history || []) {
    const day = String(point?.date || "").slice(0, 10);
    if (!DAY.test(day) || day < from || day > to) continue;
    if (seen.has(day)) return null;
    seen.set(day, point);
  }
  return seen;
}

function windowDays(history, from, to, days) {
  const seen = pointsByDay(history, from, to);
  if (!seen || seen.size !== days) return null;
  const markets = [];
  let sold = 0;
  for (let i = 0; i < days; i += 1) {
    const point = seen.get(shiftDay(from, i));
    if (!point) return null;
    const price = cents(point.market);
    if (price == null) return null;
    markets.push(price);
    const vol = point.volume;
    if (vol == null || vol === 0) continue;
    if (!Number.isInteger(vol) || vol < 0) return null;
    sold += vol;
  }
  return { markets, sold, from, to, days };
}

/** Longest complete window of no recorded sales and one unchanged Near Mint price. */
export function quietFact(history, scrapeDay) {
  const end = shiftDay(scrapeDay, -END_LAG_DAYS);
  if (!end || !Array.isArray(history)) return null;
  let best = null;
  for (const days of [7, 30]) {
    const got = windowDays(history, shiftDay(end, -(days - 1)), end, days);
    if (!got || got.sold !== 0) continue;
    if (!got.markets.every((c) => c === got.markets[0])) continue;
    best = { days, price: got.markets[0] / 100, from: got.from, to: got.to };
  }
  return best;
}

/** Condition counts for a complete 7-day window. A condition without every day stays off. */
export function mixFact(variants, printing, scrapeDay) {
  const end = shiftDay(scrapeDay, -END_LAG_DAYS);
  if (!end) return null;
  const conds = variants?.[printing];
  if (!conds || typeof conds !== "object") return null;
  const from = shiftDay(end, -6);
  const rows = [];
  for (const condition of CONDITION_ORDER) {
    const history = conds[condition]?.history;
    if (!Array.isArray(history)) continue;
    const got = windowDays(history, from, end, 7);
    if (!got) continue;
    rows.push({ condition, sold: got.sold });
  }
  if (rows.length < 2 || !rows.some((row) => row.sold > 0)) return null;
  return { from, to: end, conditions: rows };
}

/** Near Mint and one played condition on the same complete day. */
export function pairFact(variants, printing, scrapeDay) {
  const day = shiftDay(scrapeDay, -END_LAG_DAYS);
  if (!day) return null;
  const conds = variants?.[printing];
  if (!conds) return null;
  const near = windowDays(conds["Near Mint"]?.history, day, day, 1);
  if (!near) return null;
  for (const condition of PLAYED_ORDER) {
    const played = windowDays(conds[condition]?.history, day, day, 1);
    if (!played) continue;
    return {
      date: day,
      nearMint: near.markets[0] / 100,
      played: played.markets[0] / 100,
      playedCondition: condition,
    };
  }
  return null;
}

/** 7-day window first, else 30. Flat and a fall are different facts. */
export function moveFacts(history, scrapeDay) {
  const end = shiftDay(scrapeDay, -END_LAG_DAYS);
  const out = {};
  if (!end || !Array.isArray(history)) return out;
  for (const days of [7, 30]) {
    const got = windowDays(history, shiftDay(end, -(days - 1)), end, days);
    if (!got || got.sold <= 0) continue;
    const same = got.markets.every((c) => c === got.markets[0]);
    const fell = got.markets[got.markets.length - 1] < got.markets[0];
    if (same && !out.flat) out.flat = { days, sold: got.sold, price: got.markets[0] / 100, from: got.from, to: got.to };
    if (fell && !out.fell) {
      out.fell = {
        days,
        sold: got.sold,
        fromPrice: got.markets[0] / 100,
        toPrice: got.markets[got.markets.length - 1] / 100,
        from: got.from,
        to: got.to,
      };
    }
  }
  return out;
}

/** One verified catalog card, or null when nothing on that card can be said. */
export function cardFacts(card, item, scrapeDay) {
  if (!item || item.kind !== "single") return null;
  const printing = String(item.printing || "").trim();
  if (!printing || !DAY.test(String(scrapeDay || ""))) return null;
  const pptNo = normalizeNumber(card?.cardNumber);
  const catNo = normalizeNumber(item.number);
  if (pptNo && catNo && pptNo !== catNo) return null;
  if (String(card?.tcgPlayerId ?? "") !== String(item.tcgplayerProductId ?? "")) return null;
  const variants = card?.priceHistory?.variants;
  if (!variants?.[printing]) return null;
  const nm = variants[printing]["Near Mint"]?.history;
  const quiet = quietFact(nm, scrapeDay);
  const mix = mixFact(variants, printing, scrapeDay);
  const pair = pairFact(variants, printing, scrapeDay);
  const moves = moveFacts(nm, scrapeDay);
  if (!quiet && !mix && !pair && !moves.flat && !moves.fell) return null;
  const row = {
    id: item.id,
    tcgplayerProductId: Number(item.tcgplayerProductId),
    printing,
    scrapedOn: scrapeDay,
  };
  if (quiet) row.quiet = quiet;
  if (mix) row.mix = mix;
  if (pair) row.pair = pair;
  if (moves.flat) row.flat = moves.flat;
  if (moves.fell) row.fell = moves.fell;
  return row;
}
