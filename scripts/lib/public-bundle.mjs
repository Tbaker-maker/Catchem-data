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
  if (/^ME:|mega evolution/i.test(n)) return "Mega Evolution";
  if (/^SV:|scarlet|violet/i.test(n)) return "Scarlet & Violet";
  if (/^SWSH:|sword|shield/i.test(n)) return "Sword & Shield";
  if (/^SM[: ]|sun (&|and) moon/i.test(n)) return "Sun & Moon";
  if (/^XY/i.test(n)) return "XY";
  if (/^BW/i.test(n) || /black (&|and) white/i.test(n)) return "Black & White";
  if (/^HGSS|heartgold|soulsilver/i.test(n)) return "HeartGold & SoulSilver";
  if (/^DP[: ]|diamond|pearl|platinum/i.test(n)) return "Diamond & Pearl";
  if (/^EX[: ]/i.test(n)) return "EX";
  if (/^NP[: ]|^N[1-4]:|neo /i.test(n)) return "Neo";
  if (/base set|jungle|fossil|team rocket|gym heroes|gym challenge/i.test(n)) return "Original";
  if (/promo|league|championship|prize pack|jumbo|deck exclusive|miscellaneous/i.test(n)) return "Promos and extras";
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

export function headlineFor(read) {
  const name = pretty(read.name);
  const price = money(read.price);
  if (!name || !price) return "";
  const pct = read.changePct;
  const moved = Number.isFinite(pct) && pct !== 0
    ? `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% from the last print`
    : "flat versus the last print";
  const id = String(read.id || read.type || "");
  let h = 0;
  for (const c of id) h = (h + c.charCodeAt(0)) % 997;
  const pick = (lines) => lines[id ? h % lines.length : 0];
  if (read.type === "box") {
    const each = money(read.perPack);
    return each ? `${name} works out to ${each} a pack. The market price is ${price}.` : "";
  }
  if (read.type === "chase") return pick([
    `Top card in ${pretty(read.set)}: ${name} at ${price}.`,
    `${name} is the chase we can price in ${pretty(read.set)}. The market price is ${price}.`,
  ]);
  if (read.type === "receipt") return `${name}, checked again. The market price is ${price}.`;
  if (read.type === "heating") return pick([
    `${name} is heating up. The market price is ${price}.`,
    `${name} is heating up, ${moved}. The market price is ${price}.`,
    `${name} is heating up. The last print was lower. The market price is ${price}.`,
  ]);
  if (read.type === "cooling") return pick([
    `${name} is cooling off. The market price is ${price}.`,
    `${name} is ${moved}. The market price is ${price}.`,
    `${name} printed lower. The market price is ${price}.`,
  ]);
  return pick([
    `${name} changed since the last print. The market price is ${price}.`,
    `${name} is ${moved}. The market price is ${price}.`,
  ]);
}

export function rankReads(rows, limit = 24) {
  const pools = new Map();
  for (const row of rows) {
    if (!row || !money(row.price) || !row.headline || BANNED.test(row.headline)) continue;
    const key = row.type || "mover";
    if (!pools.has(key)) pools.set(key, []);
    pools.get(key).push(row);
  }
  for (const arr of pools.values()) arr.sort((a, b) => (b.score || 0) - (a.score || 0));
  const types = [...pools.keys()];
  const out = [];
  let spins = 0;
  while (out.length < limit && spins < 400) {
    spins += 1;
    let placed = false;
    for (const type of types) {
      const arr = pools.get(type);
      if (!arr?.length) continue;
      const prev = out[out.length - 1];
      let idx = arr.findIndex((row) => !prev || (row.type !== prev.type && row.set !== prev.set));
      if (idx < 0) idx = 0;
      const [row] = arr.splice(idx, 1);
      out.push(row);
      placed = true;
      if (out.length >= limit) break;
    }
    if (!placed) break;
  }
  return out;
}
