// Public listings-counted line. Off unless the reads flag is on.
// Never says supply, sold, or a forecast.

const BANNED = /\b(buy|will|breakout|undervalued|hidden gem|supply|sold)\b/i;

export function listingsCountedLine({ before, after, start, end, market, place = "eBay US" }) {
  const delta = Number(after) - Number(before);
  const word = delta > 0 ? "up" : delta < 0 ? "down" : "unchanged";
  const line = `Listings counted ${word} ${Math.abs(delta)} in a week (${before} to ${after}, ${place}, ${start} to ${end}) while TCGplayer market held at $${market}.`;
  if (BANNED.test(line)) return null;
  return line;
}

export function publicSupplyLine(row, flagOn = false) {
  if (flagOn !== true || !row) return null;
  return listingsCountedLine(row);
}
