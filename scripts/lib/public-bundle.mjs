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

function daySpan(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
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

export function whyFor(points) {
  const pts = (points || []).filter((p) => Array.isArray(p) && p[0] && Number(p[1]) > 0);
  if (pts.length < 2) return "";
  const end = pts[pts.length - 1][0];
  const cut = new Date(Date.parse(`${end}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  const window = pts.filter((p) => p[0] >= cut);
  if (window.length < 2) return "";
  const vals = window.map((p) => Number(p[1]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const last = Number(pts[pts.length - 1][1]);
  if (lo === hi) return "";
  if (last === lo) return `This is the low of the last 30 days, ${priceWords(lo)}.`;
  if (last === hi) return `This is the high of the last 30 days, ${priceWords(hi)}.`;
  return `The last 30 days ran from ${priceWords(lo)} to ${priceWords(hi)}.`;
}

export function headlineFor(read) {
  const name = pretty(read.name);
  const price = priceWords(read.price);
  const from = priceWords(read.fromPrice);
  const pct = Number(read.changePct);
  const days = Number(read.windowDays);
  if (!name || !price || !from || !Number.isFinite(pct) || pct === 0 || (days !== 7 && days !== 30)) return "";
  const dir = pct > 0 ? "up" : "down";
  const abs = Math.abs(pct);
  const shown = Number.isInteger(abs) ? String(abs) : String(abs);
  const year = Number(read.year);
  const who = read.set && year && year < 2017 ? `${name}, ${pretty(read.set)} (${year})` : name;
  return `${who} is ${dir} ${shown}% over ${days} days, from ${from} to ${price}.`;
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
