// Public catalog helpers. Prices here are TCGplayer market or eBay asks.
// Never PPT keys (tcgMarket, unopenedPrice, pptMarket, priceRatio).

export const BANNED = /\b(buys?|sells?|selling|holds?|holding|floors?|targets?|plays?|picks?|bullish|bearish|roi|invest(?:ing|ment|or)?s?|crypto|nfts?|web3|dsk|tickers?|tapes?)\b|\bspread signals\b|\bsupply injection\b|\bon the tape\b/i;

export function pretty(name) {
  return String(name ?? "")
    .replace(/\bPokemon\b/g, "Pokémon")
    .replace(/Pokémon 151 Pokémon Center/g, "151 Pokémon Center")
    .replace(/\s+/g, " ")
    .trim();
}

export function money(n) {
  const x = typeof n === "number" ? n : (n == null || n === "" ? NaN : Number(n));
  if (!Number.isFinite(x) || x <= 0) return null;
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function slug(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function bucketOf(id) {
  const m = String(id ?? "").match(/(\d+)/);
  const n = m ? Number(m[1]) : 0;
  return String(n % 100).padStart(2, "0");
}

export function eraOf(name) {
  const n = String(name ?? "");
  if (/^ME\d|^ME:|mega evolution/i.test(n)) return "Mega Evolution";
  if (/^SV\d|^SV:|^SVE:|scarlet|violet/i.test(n)) return "Scarlet & Violet";
  if (/^SWSH|sword|shield/i.test(n)) return "Sword & Shield";
  if (/^SM[: ]|sun (&|and) moon/i.test(n)) return "Sun & Moon";
  if (/^XY/i.test(n)) return "XY";
  if (/^BW/i.test(n) || /black (&|and) white/i.test(n)) return "Black & White";
  if (/^HGSS|heartgold|soulsilver/i.test(n)) return "HeartGold & SoulSilver";
  if (/^DP[: ]|diamond|pearl|platinum/i.test(n)) return "Diamond & Pearl";
  if (/^EX[: ]/i.test(n)) return "EX";
  if (/^NP[: ]|^N[1-4]:|neo /i.test(n)) return "Neo";
  const bare = n.toLowerCase().replace(/\s+/g, " ").trim();
  const named = {
    "champion's path": "Sword & Shield",
    "shining fates": "Sword & Shield",
    "shining fates: shiny vault": "Sword & Shield",
    "celebrations": "Sword & Shield",
    "celebrations: classic collection": "Sword & Shield",
    "pokemon go": "Sword & Shield",
    "pokémon go": "Sword & Shield",
    "hidden fates": "Sun & Moon",
    "hidden fates: shiny vault": "Sun & Moon",
    "shining legends": "Sun & Moon",
    "dragon majesty": "Sun & Moon",
    "detective pikachu": "Sun & Moon",
    "generations": "XY",
    "generations: radiant collection": "XY",
    "double crisis": "XY",
    "kalos starter set": "XY",
    "emerging powers": "Black & White",
    "noble victories": "Black & White",
    "next destinies": "Black & White",
    "dark explorers": "Black & White",
    "dragons exalted": "Black & White",
    "dragon vault": "Black & White",
    "boundaries crossed": "Black & White",
    "plasma storm": "Black & White",
    "plasma freeze": "Black & White",
    "plasma blast": "Black & White",
    "legendary treasures": "Black & White",
    "legendary treasures: radiant collection": "Black & White",
    "undaunted": "HeartGold & SoulSilver",
    "unleashed": "HeartGold & SoulSilver",
    "triumphant": "HeartGold & SoulSilver",
    "call of legends": "HeartGold & SoulSilver",
    "mysterious treasures": "Diamond & Pearl",
    "secret wonders": "Diamond & Pearl",
    "great encounters": "Diamond & Pearl",
    "majestic dawn": "Diamond & Pearl",
    "legends awakened": "Diamond & Pearl",
    "stormfront": "Diamond & Pearl",
    "rising rivals": "Diamond & Pearl",
    "supreme victors": "Diamond & Pearl",
    "arceus": "Diamond & Pearl",
    "rumble": "Diamond & Pearl",
  };
  if (named[bare]) return named[bare];
  if (/base set|jungle|fossil|team rocket|gym heroes|gym challenge/i.test(n)) return "Original";
  if (/promo|league|championship|prize pack|jumbo|deck exclusive|miscellaneous|battle academy|trick or trade|my first battle|trading card game classic|first partner/i.test(n)) return "Promos and extras";
  return "Other";
}

export function cleanHistory(values) {
  let pts = (values || []).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (pts.length >= 4) {
    const sorted = [...pts].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const kept = pts.filter((v) => v >= med * 0.4 && v <= med * 2.5);
    if (kept.length >= 2) pts = kept;
  }
  return pts;
}

export function changePct(prev, next) {
  const a = Number(prev);
  const b = Number(next);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 2 || b <= 0) return null;
  const pct = ((b - a) / a) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) > 60) return null;
  return Math.round(pct * 10) / 10;
}

export function priceWords(n) {
  const text = money(n);
  if (!text) return "";
  return text.endsWith(".00") ? text.slice(0, -3) : text;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const COUNT_WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

function monthOf(iso, short = false) {
  const n = Number(String(iso || "").slice(5, 7));
  const list = short ? MONTHS_SHORT : MONTHS;
  return list[n - 1] || "";
}

function monthDay(iso) {
  return `${monthOf(iso, true)} ${Number(String(iso).slice(8, 10))}`;
}

function daySpan(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function seriesOf(points) {
  return (points || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0);
}

function cents(n) {
  return Math.round(Number(n) * 100);
}

export function shortSet(name) {
  return pretty(name)
    .replace(/^[A-Z]{1,8}\d*[a-z]?:\s+/, "")
    .replace(/^[A-Z]{2,8}\s+-\s+/, "")
    .trim();
}

export function collectorNo(num) {
  const raw = String(num || "").trim();
  if (!raw) return "";
  const left = raw.split("/")[0].trim();
  if (/^\d+$/.test(left)) return String(Number(left));
  return left;
}

export function displayName(name, num) {
  let n = pretty(name);
  const raw = String(num || "").trim();
  if (raw && n.endsWith(` - ${raw}`)) n = n.slice(0, -(raw.length + 3)).trim();
  else n = n.replace(/\s+-\s+\d+\s*\/\s*\d+\s*$/, "").trim();
  return n;
}

function olderThanFiveYears(release, asOf) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) ? asOf : "2026-09-28";
  const start = String(release || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return daySpan(start, end) > Math.round(5 * 365.25);
  const year = Number(start.slice(0, 4));
  const endYear = Number(end.slice(0, 4));
  return year > 1900 && endYear - year > 5;
}

export function cardLabel(read) {
  const name = displayName(read.name, read.number);
  const set = shortSet(read.set || "");
  const no = collectorNo(read.number);
  const asOf = read.toDate || read.asOf || "2026-09-28";
  const year = olderThanFiveYears(read.release || read.year, asOf) ? Number(String(read.release || read.year).slice(0, 4)) : 0;
  const bits = [set, year || "", no ? `#${no}` : ""].filter(Boolean);
  return bits.length ? `${name} (${bits.join(", ")})` : name;
}

function longestFlat(pts) {
  let best = 1;
  let run = 1;
  for (let i = 1; i < pts.length; i += 1) {
    if (cents(pts[i][1]) === cents(pts[i - 1][1])) {
      run += 1;
      if (run > best) best = run;
    } else run = 1;
  }
  return pts.length ? best : 0;
}

function extremeOf(pts) {
  if (pts.length < 2) return null;
  let lo = pts[0];
  let hi = pts[0];
  for (const p of pts) {
    if (p[1] < lo[1]) lo = p;
    if (p[1] > hi[1]) hi = p;
  }
  if (cents(lo[1]) === cents(hi[1])) return null;
  const last = pts[pts.length - 1];
  const span = daySpan(pts[0][0], last[0]);
  if (cents(last[1]) === cents(lo[1])) {
    return { kind: "low", month: monthOf(pts[0][0]), price: last[1], sixMonths: span >= 150 };
  }
  if (cents(last[1]) === cents(hi[1])) {
    return { kind: "high", month: monthOf(pts[0][0]), price: last[1], sixMonths: span >= 150 };
  }
  return null;
}

function distanceFact(pts) {
  let lo = pts[0];
  let hi = pts[0];
  for (const p of pts) {
    if (p[1] < lo[1]) lo = p;
    if (p[1] > hi[1]) hi = p;
  }
  const last = pts[pts.length - 1][1];
  const vsHigh = hi[1] > 0 ? last / hi[1] : 0;
  const vsLow = lo[1] > 0 ? last / lo[1] : 0;
  const half = vsHigh >= 0.45 && vsHigh <= 0.55;
  const doubled = vsLow >= 1.75 && vsLow <= 2.25;
  if (half && !doubled) return `Half its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`;
  if (doubled && !half) return `Almost double its ${monthOf(lo[0])} price of ${priceWords(lo[1])}.`;
  if (half && doubled) return last < hi[1] / 2 ? `Half its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.` : `Almost double its ${monthOf(lo[0])} price of ${priceWords(lo[1])}.`;
  return "";
}

function shapeFact(pts, sign) {
  const end = pts[pts.length - 1][0];
  const cut = new Date(Date.parse(`${end}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  let down = 0;
  let up = 0;
  const steps = [];
  for (let i = 1; i < pts.length; i += 1) {
    const step = pts[i][1] - pts[i - 1][1];
    if (pts[i][0] > cut) {
      if (step < 0) down += 1;
      else if (step > 0) up += 1;
    }
    if ((sign < 0 && step < 0) || (sign > 0 && step > 0)) {
      if (pts[i][0] > cut) steps.push({ date: pts[i][0], from: pts[i - 1][1] });
    }
  }
  const toward = sign < 0 ? down : up;
  const word = sign < 0 ? "fallen" : "risen";
  if (toward >= 10) return `Has ${word} ${toward} of the last 30 days.`;
  if (steps.length >= 2 && steps.length <= 6) {
    const n = COUNT_WORDS[steps.length] || String(steps.length);
    const kind = sign < 0 ? "step-downs" : "step-ups";
    return `${n} ${kind} since ${monthDay(steps[0].date)}, from ${priceWords(steps[0].from)}.`;
  }
  if (toward >= 3) return `Has ${word} ${toward} of the last 30 days.`;
  return "";
}

export function readCopy(read) {
  const pts = seriesOf(read.hist || read.points || []);
  const price = priceWords(read.price);
  const from = priceWords(read.fromPrice);
  const pct = Number(read.changePct);
  const days = Number(read.windowDays);
  const label = cardLabel(read);
  const shown = Number.isFinite(pct) ? (Number.isInteger(Math.abs(pct)) ? String(Math.abs(pct)) : String(Math.abs(pct))) : "";
  const dir = pct > 0 ? "up" : "down";
  const empty = { headline: "", why: "" };
  if (!label || !price || !from || !shown || pct === 0 || (days !== 7 && days !== 30)) return empty;
  const windowPts = read.fromDate ? pts.filter((p) => p[0] >= read.fromDate && p[0] <= (read.toDate || p[0])) : pts;
  const thin = longestFlat(windowPts) >= 10;
  const extreme = pts.length ? extremeOf(pts) : null;
  const leadExtreme = !!extreme;
  let why = "";
  if (thin) why = "Few sales, so moves come in jumps.";
  else if (pts.length >= 2) {
    if (!leadExtreme && extreme?.kind === "low") why = `Lowest since at least ${extreme.month}.`;
    else if (!leadExtreme && extreme?.kind === "high") why = extreme.sixMonths ? "Highest in the 6 months we store." : `Highest since at least ${extreme.month}.`;
    else why = distanceFact(pts) || shapeFact(pts, Math.sign(pct));
  }
  let headline = "";
  if (leadExtreme && extreme.kind === "low") {
    headline = `${label} hit its lowest price since at least ${extreme.month}: ${price}, ${dir} ${shown}% in ${days} days.`;
  } else if (leadExtreme && extreme.kind === "high") {
    const where = extreme.sixMonths ? "in the 6 months we store" : `since at least ${extreme.month}`;
    headline = `${label} hit its highest price ${where}: ${price}, ${dir} ${shown}% in ${days} days.`;
  } else {
    headline = `${label} is ${dir} ${shown}% over ${days} days, from ${from} to ${price}.`;
  }
  if (why && headline.includes(why.replace(/\.$/, ""))) why = shapeFact(pts, Math.sign(pct));
  return { headline, why };
}

export function whyFor(points, opts = {}) {
  const last = points?.at?.(-1)?.[1];
  const first = points?.[0]?.[1];
  return readCopy({
    name: "Card",
    set: "Set",
    windowDays: 30,
    ...opts,
    hist: points,
    price: opts.price ?? last,
    fromPrice: opts.fromPrice ?? first,
    changePct: opts.changePct ?? (points?.length > 1 && last < first ? -1 : 1),
  }).why;
}

export function headlineFor(read) {
  return readCopy(read).headline;
}

// A window counts only when the series already has 30 days, the two ends are
// real stored days, and at least three separate days moved the same way.
// One step, then a flat line, is a spike and does not count.
export function moveOver(points, days) {
  const pts = (points || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0);
  if (pts.length < 30 || (days !== 7 && days !== 30)) return null;
  const end = pts[pts.length - 1];
  const target = new Date(Date.parse(`${end[0]}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  let then = null;
  for (const p of pts) {
    if (p[0] <= target) then = p;
    else break;
  }
  if (!then) return null;
  const span = daySpan(then[0], end[0]);
  if (span < days - 1 || span > days + 3) return null;
  const from = Number(then[1]);
  const to = Number(end[1]);
  if (!(from > 0) || !(to > 0) || from === to) return null;
  const pct = ((to - from) / from) * 100;
  if (!Number.isFinite(pct) || pct === 0) return null;
  const sign = Math.sign(pct);
  let prev = from;
  let confirms = 0;
  let maxStep = 0;
  for (const p of pts) {
    if (p[0] <= then[0] || p[0] > end[0]) continue;
    const step = Number(p[1]) - prev;
    if (step !== 0 && Math.sign(step) === sign) {
      confirms += 1;
      if (Math.abs(step) > maxStep) maxStep = Math.abs(step);
    }
    prev = Number(p[1]);
  }
  const net = Math.abs(to - from);
  if (confirms < 3 || !(net > 0) || maxStep / net > 0.5) return null;
  return {
    pct: Math.round(pct * 10) / 10,
    from,
    to,
    fromDate: then[0],
    toDate: end[0],
    window: days,
    confirms,
  };
}

export function bestMove(points, kind) {
  const need = kind === "sealed" ? 5 : 8;
  const hits = [30, 7].map((days) => moveOver(points, days)).filter((row) => row && Math.abs(row.pct) >= need);
  if (!hits.length) return null;
  hits.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || b.window - a.window);
  return hits[0];
}

export function rankReads(rows, limit = 12) {
  const pools = new Map();
  for (const row of rows) {
    if (!row || !money(row.price) || !row.headline || BANNED.test(row.headline)) continue;
    const key = row.type || "mover";
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(row);
  }
  for (const arr of pools.values()) arr.sort((a, b) => (b.score || 0) - (a.score || 0));
  const types = [...pools.keys()].sort((a, b) => (a === "receipt" ? -1 : b === "receipt" ? 1 : 0));
  const out = [];
  const used = new Set();
  let spins = 0;
  while (out.length < limit && spins < 400) {
    spins += 1;
    let placed = false;
    for (const type of types) {
      const arr = pools.get(type);
      if (!arr?.length) continue;
      const prev = out[out.length - 1];
      const keyOf = (row) => String(row.href || row.id || "");
      let idx = arr.findIndex((row) => {
        const key = keyOf(row);
        if (key && used.has(key)) return false;
        return !prev || (row.type !== prev.type && row.set !== prev.set);
      });
      if (idx < 0) idx = arr.findIndex((row) => {
        const key = keyOf(row);
        return !(key && used.has(key));
      });
      if (idx < 0) continue;
      const [row] = arr.splice(idx, 1);
      const key = keyOf(row);
      if (key) used.add(key);
      out.push(row);
      placed = true;
      if (out.length >= limit) break;
    }
    if (!placed) break;
  }
  return out;
}
