// Seller tag and run stage for the Listings and Price tiles.
// Every cutoff comes from the private rules file. With no rules, nothing fires.
// Output is words, counts, shares and dates only; never a cutoff.

function num(v) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function day(iso) {
  const t = Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(t) ? Math.round(t / 86400000) : NaN;
}
function median(list) {
  const a = list.slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
const pct100 = (x) => Math.round(x * 100);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// nights: [{ date, n, sellers, share }] oldest first. share is the top 2 seller
// share of listings counted (0..1). peers: today's shares of similar products.
export function sellerTag(nights, peers, spec) {
  if (!spec || typeof spec !== "object") return null;
  const keys = ["minNights", "baseNights", "minListings", "minSpread", "zOwn", "cohortHigh", "cohortLow", "sellerRise", "holdNights", "minPeers"];
  const c = Object.fromEntries(keys.map((k) => [k, num(spec[k])]));
  if (!keys.every((k) => Number.isFinite(c[k]))) return null;
  const rows = (nights || []).filter((r) => r && ISO.test(String(r.date || ""))
    && num(r.share) >= 0 && num(r.share) <= 1 && num(r.sellers) >= 1 && num(r.n) >= 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (rows.length < c.minNights || rows.length < c.holdNights) return null;
  const peer = (peers || []).map(num).filter((x) => x >= 0 && x <= 1).sort((a, b) => a - b);
  if (peer.length < c.minPeers) return null;
  const rank = (x) => peer.filter((y) => y < x).length / Math.max(1, peer.length - 1);
  const judge = (i) => {
    const now = rows[i];
    const base = rows.slice(Math.max(0, i - c.baseNights), i);
    if (base.length < c.minNights - 1 || num(now.n) < c.minListings) return "";
    const shares = base.map((r) => num(r.share));
    const med = median(shares);
    const mad = median(shares.map((x) => Math.abs(x - med))) * 1.4826;
    const spread = Math.max(mad, c.minSpread * med);
    if (!(spread > 0)) return "";
    const z = (num(now.share) - med) / spread;
    const r = rank(num(now.share));
    const usualSellers = median(base.map((b) => num(b.sellers)));
    if (z >= c.zOwn && r >= c.cohortHigh && num(now.sellers) <= usualSellers) return "Few sellers hold most";
    if (z <= -c.zOwn && r <= c.cohortLow && num(now.sellers) >= c.sellerRise * usualSellers) return "Spread out";
    return "";
  };
  const last = rows.length - 1;
  const word = judge(last);
  if (!word) return null;
  for (let k = 1; k < c.holdNights; k++) if (judge(last - k) !== word) return null;
  const base = rows.slice(Math.max(0, last - c.baseNights), last);
  return {
    word,
    share: pct100(num(rows[last].share)),
    usual: pct100(median(base.map((r) => num(r.share)))),
    peers: pct100(median(peer)),
    sellers: num(rows[last].sellers),
    date: rows[last].date,
  };
}

function slopePct(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => Math.log(p[1]));
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let top = 0;
  let bot = 0;
  for (let i = 0; i < n; i++) { top += (xs[i] - mx) * (ys[i] - my); bot += (xs[i] - mx) ** 2; }
  return bot > 0 ? (Math.exp(top / bot) - 1) * 100 : 0;
}

// prices: [[date, price]] daily. listings: [{ date, n }] for sealed, null for singles.
export function runStage(prices, asOf, spec, listings = null) {
  if (!spec || typeof spec !== "object") return null;
  const keys = ["halfDays", "minPointsPerHalf", "flatPctPerDay", "keepPace", "agree", "minPrice", "minListingNights", "listFlatPct"];
  const c = Object.fromEntries(keys.map((k) => [k, num(spec[k])]));
  if (!keys.every((k) => Number.isFinite(c[k])) || !(c.halfDays > 0)) return null;
  const H = c.halfDays;
  const end = day(asOf);
  if (!Number.isFinite(end)) return null;
  const pts = [];
  const seen = new Set();
  for (const p of prices || []) {
    const d = day(Array.isArray(p) ? p[0] : p?.date);
    const v = num(Array.isArray(p) ? p[1] : p?.price);
    if (!Number.isFinite(d) || !(v > 0) || seen.has(d) || d > end || d <= end - 2 * H) continue;
    seen.add(d);
    pts.push([d, v]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const rec = pts.filter((p) => p[0] > end - H);
  const pri = pts.filter((p) => p[0] <= end - H);
  if (rec.length < c.minPointsPerHalf || pri.length < c.minPointsPerHalf) return null;
  if (pts.some((p) => p[1] < c.minPrice)) return null;
  let lst = null;
  if (listings) {
    const nights = listings.filter((r) => r && num(r.n) >= 0 && day(r.date) <= end && day(r.date) > end - 2 * H)
      .sort((a, b) => day(a.date) - day(b.date));
    if (nights.length < c.minListingNights) return null;
    const startN = nights.filter((r) => day(r.date) <= end - H).pop();
    const endN = nights[nights.length - 1];
    if (!startN || !(num(startN.n) > 0)) return null;
    lst = ((num(endN.n) - num(startN.n)) / num(startN.n)) * 100;
  }
  const r = slopePct(rec);
  const p = slopePct(pri);
  const F = c.flatPctPerDay;
  if (Math.abs(p) <= F && Math.abs(r) <= F) return null;
  const steps = [];
  for (let i = 1; i < rec.length; i++) if (rec[i][1] !== rec[i - 1][1]) steps.push(rec[i][1] - rec[i - 1][1]);
  if (Math.abs(r) > F && steps.length && steps.filter((d) => (d > 0) === (r > 0)).length / steps.length < c.agree) return null;
  let word;
  let dir = r > 0 ? "up" : "down";
  if (Math.abs(p) <= F) word = "Building";
  else if (Math.abs(r) <= F) { word = "Stalled"; dir = p > 0 ? "up" : "down"; }
  else if ((r > 0) !== (p > 0)) word = "Reversing";
  else word = Math.abs(r) >= c.keepPace * Math.abs(p) ? "Building" : "Slowing";
  if (lst != null && word === "Building") {
    if ((dir === "up" && lst > c.listFlatPct) || (dir === "down" && lst < -c.listFlatPct)) word = "Slowing";
  }
  const out = { word, dir, days: H, date: String(asOf).slice(0, 10) };
  if (lst != null) out.listings = Math.abs(lst) <= c.listFlatPct ? "flat" : (lst < 0 ? "falling" : "rising");
  return out;
}
