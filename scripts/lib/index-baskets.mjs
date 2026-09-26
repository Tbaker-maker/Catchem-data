// Chain-linked indexes. A missing day is a gap. Prices are never filled in.

export function eraOf(setId = "") {
  const id = String(setId);
  if (id.startsWith("me")) return "Mega Evolution";
  if (id.startsWith("sv") || id === "zsv10pt5" || id === "rsv10pt5") return "Scarlet & Violet";
  if (id.startsWith("swsh") || id === "cel25" || id === "pgo") return "Sword & Shield";
  if (id.startsWith("sm") || id === "det1") return "Sun & Moon";
  if (id.startsWith("xy")) return "XY";
  if (id.startsWith("base") || id.startsWith("neo")) return "WOTC / vintage";
  return null;
}

export function quarterKey(date) {
  const [y, m] = date.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

export function median(nums) {
  if (!nums.length) return null;
  const a = [...nums].sort((x, y) => x - y);
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

const r1 = (n) => Math.round(n * 10) / 10;
const r4 = (n) => Math.round(n * 10000) / 10000;

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// prices: Map id -> Map date -> number
// eligible: Map date -> Set id   (already filtered: not quarantined, enough listings, not a known bad match)
// members: the fixed universe this index is allowed to draw a basket from
// pairPrice (optional): (id, prevDate, date) -> [prevPrice, price] | null. Lets a
// caller insist that both prices of one move come from the same source.
export function chainIndex(dates, prices, eligible, members, pairPrice = null) {
  const points = [];
  const gaps = [];
  let level = 100;
  let levelValue = 100;
  let prev = null;
  let basket = [];
  let quarter = null;
  const memberList = [...members];
  for (const date of dates) {
    const q = quarterKey(date);
    const elig = eligible.get(date) || new Set();
    if (q !== quarter) {
      quarter = q;
      const next = memberList.filter((id) => elig.has(id) && prices.get(id)?.has(date));
      if (next.length) basket = next;
    }
    if (!basket.length) continue;
    if (!prev) {
      points.push({ date, equal: 100, value: 100, matched: basket.filter((id) => prices.get(id)?.has(date)).length, basket: [...basket] });
      prev = date;
      continue;
    }
    const span = daysBetween(prev, date);
    if (span > 1) gaps.push({ from: prev, to: date, missingDays: span - 1, note: "No price was invented for the days in between." });
    const prevElig = eligible.get(prev) || new Set();
    const rels = [];
    const weights = [];
    for (const id of basket) {
      if (!elig.has(id) || !prevElig.has(id)) continue;
      const pair = pairPrice ? pairPrice(id, prev, date) : [prices.get(id)?.get(prev), prices.get(id)?.get(date)];
      if (!pair) continue;
      const [a, b] = pair;
      if (!(a > 0) || !(b > 0)) continue;
      rels.push(b / a);
      weights.push(a);
    }
    if (!rels.length) {
      gaps.push({ from: prev, to: date, missingDays: Math.max(span - 1, 0), note: "No product in the basket was priced on both days." });
      prev = date;
      continue;
    }
    const med = median(rels);
    let wnum = 0, wden = 0;
    rels.forEach((rel, i) => { wnum += rel * weights[i]; wden += weights[i]; });
    const vw = wnum / wden;
    level *= med;
    levelValue *= vw;
    points.push({
      date,
      from: prev,
      equal: r1(level),
      value: r1(levelValue),
      matched: rels.length,
      equalMovePct: r4((med - 1) * 100),
      valueMovePct: r4((vw - 1) * 100),
      basket: [...basket],
    });
    prev = date;
  }
  return { base: 100, points, gaps };
}

export const WRONG_MATCH_IDS = new Set([
  "xy12-etb",
  "sm9-booster-box",
  "sm1-booster-box",
]);

export const WRONG_MATCH_WHY = {
  "xy12-etb": "eBay titles are Prismatic Evolutions cases, not XY Evolutions boxes",
  "sm9-booster-box": "eBay titles are foreign mini-pack boxes, and there are fewer than 8 listings",
  "sm1-booster-box": "eBay titles are other Sun & Moon sets and Japanese boxes, not the English base box",
};

export function typeKey(subtype) {
  if (subtype === "booster-box") return "booster-box";
  if (subtype === "etb") return "etb";
  if (subtype === "pc-etb") return "pc-etb";
  if (subtype === "booster-bundle") return "bundle";
  if (subtype === "booster-pack") return "pack";
  return null;
}
