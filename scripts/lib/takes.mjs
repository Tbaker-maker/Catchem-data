// One code per read. The label is not stored. No code means no take.
// Never defaults to Watch.
import { money, TAKE_FOOTER, TAKE_LABELS, lineBanned } from "./public-bundle.mjs";
import { centsOf, formatPct, whyPlain } from "./read-quality.mjs";
import { tcgAmount } from "./card-face.mjs";

export { TAKE_FOOTER, TAKE_LABELS };

export const TAKE_CODES = ["up", "dip", "watch", "avoid", "stretched"];
export const LISTING_MIN_START = 40;
export const LISTING_MIN_MOVE = 15;
export const LISTING_MIN_PCT = 20;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthDay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return "";
  const month = MONTHS[Number(String(iso).slice(5, 7)) - 1];
  if (!month) return "";
  return `${month} ${Number(String(iso).slice(8, 10))}`;
}

export function listingsPastMinimum(listings, direction) {
  if (!listings || listings.source !== "filteredTotal") return false;
  const start = listings.start;
  const end = listings.end;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < LISTING_MIN_START) return false;
  const delta = end - start;
  if (direction === "down" && !(delta <= -LISTING_MIN_MOVE)) return false;
  if (direction === "up" && !(delta >= LISTING_MIN_MOVE)) return false;
  if (direction !== "up" && direction !== "down") return false;
  return Math.abs(delta / start) * 100 >= LISTING_MIN_PCT;
}

function moveOf(from, to) {
  const a = centsOf(from);
  const b = centsOf(to);
  const base = Number(from);
  const next = Number(to);
  if (a == null || b == null || !(base > 0) || !(next > 0) || a === b) return null;
  return { cents: Math.abs(b - a), pct: ((next - base) / base) * 100, up: next > base, down: next < base };
}

function clears(move, pct) {
  return Boolean(move && move.cents >= 100 && Math.abs(move.pct) >= pct);
}

export function takeCode(input = {}) {
  const move = moveOf(input.from, input.to);
  const up8 = Boolean(move && move.up && clears(move, 8));
  const upWatch = Boolean(move && move.up && clears(move, 3) && move.pct < 8);
  const downFloor = Boolean(move && move.down && clears(move, 3));
  const listingsUp = listingsPastMinimum(input.listings, "up");
  const listingsDown = listingsPastMinimum(input.listings, "down");
  const flat = !up8 && !upWatch && !downFloor;
  if (listingsUp && downFloor) return "avoid";
  if (up8 && input.sixMonthHigh === true) return "stretched";
  if (up8) return "up";
  if (downFloor) return "dip";
  if (upWatch) return "watch";
  if (listingsDown && flat) return "watch";
  return null;
}

export function listingSentence(start, end, startDate, endDate) {
  const from = monthDay(startDate);
  const to = monthDay(endDate);
  if (!from || !to || !Number.isInteger(start) || !Number.isInteger(end)) return "";
  return `eBay listings ${start} to ${end} (${from} to ${to}).`;
}

function priceSentence(input) {
  const from = Number(input.from);
  const to = Number(input.to);
  if (!(from > 0) || !(to > 0) || from === to) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.start || "")) || !/^\d{4}-\d{2}-\d{2}$/.test(String(input.end || ""))) return "";
  const dir = to > from ? "Up" : "Down";
  const gap = tcgAmount(Math.abs((centsOf(to) - centsOf(from)) / 100), money);
  const pct = formatPct(((to - from) / from) * 100);
  if (!gap || !pct) return "";
  return `TCGplayer market: ${tcgAmount(to, money)} (${input.end}), from ${tcgAmount(from, money)} (${input.start}). ${dir} ${gap}, ${pct}%.`;
}

export function takeLayout(input = {}) {
  const code = takeCode(input);
  if (!TAKE_LABELS[code]) return null;
  const prices = priceSentence(input);
  const listings = input.listings;
  const listDir = listingsPastMinimum(listings, "down") ? "down" : listingsPastMinimum(listings, "up") ? "up" : "";
  const listingsLine = listDir ? listingSentence(listings.start, listings.end, listings.startDate || input.start, listings.endDate || input.end) : "";
  const why = String(input.why || (prices ? whyPlain(input.from, input.to) : "")).trim();
  const wrong = String(input.wrong || "Wrong if either date has a different market price.").trim();
  const sourceName = String(input.source || "TCGplayer market").trim();
  const sourceDate = String(input.sourceDate || input.end || "").slice(0, 10);
  const source = sourceName && /^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ? `${sourceName}, ${sourceDate}.` : "";
  const lines = [TAKE_LABELS[code], prices, listingsLine, why, wrong, source, TAKE_FOOTER].filter(Boolean);
  if (lines.some((line) => lineBanned(line))) return null;
  if (listingsLine && /\b(because|Browse|listingCount|browseTotal)\b/.test(listingsLine)) return null;
  if (/\bbecause\b/i.test(lines.join(" "))) return null;
  return {
    code,
    label: TAKE_LABELS[code],
    prices,
    listings: listingsLine,
    why,
    wrong,
    source,
    footer: TAKE_FOOTER,
    lines,
  };
}
