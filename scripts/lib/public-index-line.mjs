// Chain-linked median index for the public bundle (set and artist lines).
// Every calendar day from the first to the last price day gets a point.
// A day with no file, or fewer than MIN_LINKS cards priced on it and on the
// last day on the line, is a gap: v is null and nothing is carried forward.
// The level is kept unrounded between days; only the published value is rounded.
export const MIN_LINKS = 8;
export const MIN_PRICE = 2;

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
    const ratios = [];
    const ids = [];
    maps.forEach((m, i) => {
      const a = m.get(from);
      const b = m.get(day);
      if (a >= MIN_PRICE && b > 0) { ratios.push(b / a); ids.push(i); }
    });
    if (ratios.length < MIN_LINKS) {
      points.push({ d: day, v: null, n: ratios.length });
      gaps += 1;
      continue;
    }
    ratios.sort((x, y) => x - y);
    level *= ratios[Math.floor(ratios.length / 2)];
    ids.forEach((i) => used.add(i));
    links += 1;
    points.push({ d: day, v: Math.round(level * 10) / 10, n: ratios.length, ...(from !== iso(t - DAY) ? { from } : {}) });
    from = day;
  }
  return { points, cards: used.size, links, gaps };
}
