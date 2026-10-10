// Chain-linked value-weighted index for the public bundle (set and artist lines).
// Each day's link is (sum of today's prices) / (sum of the same cards' prices on
// the last real day on the line), over cards with a price on BOTH days. A dearer
// card has a bigger say, the way a collection's value moves. The daily TCGCSV
// files do not mark a repeated price as carried forward, so every card with a
// price on both days is used (a repeated value is a real published price).
// Every calendar day from the first to the last price day gets a point.
// A day with no file, or fewer than MIN_LINKS cards priced on it and on the
// last day on the line, is a gap: v is null and nothing is carried forward.
// The level is kept unrounded between days; only the published value is rounded.
export const MIN_LINKS = 8;
export const MIN_PRICE = 0.01;
export const METHOD = "value-weighted";

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);

export function indexLine(list) {
  const maps = (list || []).map((it) => new Map((it.hist || []).map((pt) => [pt[0], pt[1]])));
  const priced = [...new Set(maps.flatMap((m) => [...m.keys()]))].sort();
  const empty = { points: [], cards: 0, links: 0, gaps: 0 };
  if (priced.length < 2) return { ...empty, points: priced.map((d) => ({ d, v: null, n: 0 })) };
  const start = Date.parse(`${priced[0]}T00:00:00Z`);
  const end = Date.parse(`${priced[priced.length - 1]}T00:00:00Z`);
  const used = new Set();
  const points = [{ d: priced[0], v: 100, n: 0 }];
  let level = 100;
  let from = priced[0]; // last day on the line; a move is only ever measured from a real price day
  let links = 0;
  let gaps = 0;
  for (let t = start + DAY; t <= end; t += DAY) {
    const day = iso(t);
    let sumA = 0;
    let sumB = 0;
    const ids = [];
    maps.forEach((m, i) => {
      const a = Number(m.get(from));
      const b = Number(m.get(day));
      if (a >= MIN_PRICE && b > 0) { sumA += a; sumB += b; ids.push(i); }
    });
    if (ids.length < MIN_LINKS || !(sumA > 0)) {
      points.push({ d: day, v: null, n: ids.length });
      gaps += 1;
      continue;
    }
    level *= sumB / sumA;
    ids.forEach((i) => used.add(i));
    links += 1;
    points.push({ d: day, v: Math.round(level * 10) / 10, n: ids.length, ...(from !== iso(t - DAY) ? { from } : {}) });
    from = day;
  }
  return { points, cards: used.size, links, gaps };
}
