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

const WEEK_WORDS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];

function weekWord(n) {
  if (n >= 1 && n < WEEK_WORDS.length) return WEEK_WORDS[n];
  const mod = n % 100;
  const suffix = mod >= 11 && mod <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${suffix}`;
}

// Weeks walk backward from the last stored day. A lower low is a week whose
// low is under the week before it. The sentence names that path, not a shared
// percent line.
export function pathSentence(points, opts = {}) {
  const all = seriesOf(points);
  if (all.length < 2) return "";
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.toDate || "")) ? opts.toDate : all[all.length - 1][0];
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.fromDate || "")) ? opts.fromDate : all[0][0];
  const days = Number(opts.windowDays) || daySpan(fromDate, toDate);
  const endMs = Date.parse(`${toDate}T00:00:00Z`);
  const byDate = new Map(all.filter((p) => p[0] <= toDate).map((p) => [p[0], Number(p[1])]));
  const weeks = [];
  for (let w = 0; w < 20; w += 1) {
    const stop = endMs - w * 7 * 86400000;
    const start = stop - 6 * 86400000;
    let low = null;
    let lowDate = "";
    let high = null;
    let highDate = "";
    for (let t = start; t <= stop; t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const value = byDate.get(date);
      if (!(value > 0)) continue;
      if (low == null || cents(value) < cents(low)) {
        low = value;
        lowDate = date;
      }
      if (high == null || cents(value) > cents(high)) {
        high = value;
        highDate = date;
      }
    }
    if (low == null) {
      if (weeks.length) break;
      continue;
    }
    weeks.push({ low, lowDate, high, highDate, stop: new Date(stop).toISOString().slice(0, 10) });
  }
  if (!weeks.length) return "";
  const down = opts.direction === "down" || (opts.direction !== "up" && Number(opts.fromPrice) > Number(all.at(-1)?.[1]));
  let steps = 0;
  for (let i = 0; i < weeks.length - 1; i += 1) {
    const lower = cents(weeks[i].low) < cents(weeks[i + 1].low);
    const higher = cents(weeks[i].high) > cents(weeks[i + 1].high);
    if (down ? lower : higher) steps += 1;
    else break;
  }
  const latest = weeks[0];
  const prior = weeks[1];
  const base = weeks[steps] || prior || latest;
  const windowBit = days > 0 && opts.fromPrice > 0 && fromDate
    ? ` In this ${days}-day window it starts at ${priceWords(opts.fromPrice)} on ${monthDay(fromDate)}.`
    : "";
  let sentence = "";
  if (down && steps >= 2) {
    const since = base?.lowDate ? `, from ${priceWords(base.low)} on ${monthDay(base.lowDate)}` : "";
    sentence = `This is the ${weekWord(steps)} week of lower lows${since}, not the first down week.${windowBit}`;
  } else if (!down && steps >= 2) {
    const since = base?.highDate ? `, from ${priceWords(base.high)} on ${monthDay(base.highDate)}` : "";
    sentence = `This is the ${weekWord(steps)} week of higher highs${since}, not the first up week.${windowBit}`;
  } else if (down && steps === 1 && prior) {
    sentence = `This is the first down week. The weekly low is ${priceWords(latest.low)} on ${monthDay(latest.lowDate)}, under ${priceWords(prior.low)} on ${monthDay(prior.lowDate)}.${windowBit}`;
  } else if (!down && steps === 1 && prior) {
    sentence = `This is the first up week. The weekly high is ${priceWords(latest.high)} on ${monthDay(latest.highDate)}, above ${priceWords(prior.high)} on ${monthDay(prior.highDate)}.${windowBit}`;
  } else if (prior) {
    const way = down ? "did not make a lower low" : "did not make a higher high";
    const nowBit = down
      ? `Weekly low ${priceWords(latest.low)} on ${monthDay(latest.lowDate)}, after ${priceWords(prior.low)} on ${monthDay(prior.lowDate)}.`
      : `Weekly high ${priceWords(latest.high)} on ${monthDay(latest.highDate)}, after ${priceWords(prior.high)} on ${monthDay(prior.highDate)}.`;
    sentence = `The last week ${way}. ${nowBit}${windowBit}`;
  } else {
    sentence = `The last stored print is ${priceWords(latest.low)} on ${monthDay(latest.lowDate)}.${windowBit}`;
  }
  return sentence.replace(/\s+/g, " ").trim();
}

export function windowBounds(points, toDate) {
  const pts = seriesOf(points).filter((p) => !toDate || p[0] <= toDate);
  if (!pts.length) return null;
  const end = toDate && pts.some((p) => p[0] === toDate) ? toDate : pts[pts.length - 1][0];
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - 90 * 86400000).toISOString().slice(0, 10);
  const win = pts.filter((p) => p[0] >= start);
  const use = win.length >= 2 ? win : pts;
  let hi = use[0];
  let lo = use[0];
  for (const p of use) {
    if (cents(p[1]) > cents(hi[1]) || (cents(p[1]) === cents(hi[1]) && p[0] > hi[0])) hi = p;
    if (cents(p[1]) < cents(lo[1]) || (cents(p[1]) === cents(lo[1]) && p[0] > lo[0])) lo = p;
  }
  return {
    high: hi[1],
    highOn: hi[0],
    low: lo[1],
    lowOn: lo[0],
    daysSinceHigh: daySpan(hi[0], end),
    window: win.length >= 2 ? 90 : daySpan(use[0][0], end),
  };
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

function shiftDay(iso, n) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function windowPrices(pts, i, radius) {
  const start = shiftDay(pts[i][0], -radius);
  const end = shiftDay(pts[i][0], radius);
  const out = [];
  for (let j = 0; j < pts.length; j += 1) {
    if (j === i) continue;
    if (pts[j][0] >= start && pts[j][0] <= end) out.push(pts[j][1]);
  }
  return out;
}

function farFrom(price, median, limit) {
  if (!(median > 0)) return false;
  const ratio = price / median;
  return ratio > 1 + limit || ratio < 1 - limit;
}

// A day is a spike when it sits more than 35% from the other days in a ±3 day
// window, or more than 25% from the other days in a ±10 day window. The wider
// window keeps a cluster of bad days from shielding each other.
export function spikeDates(points) {
  const pts = seriesOf(points);
  const out = new Set();
  for (let i = 0; i < pts.length; i += 1) {
    const near = windowPrices(pts, i, 3);
    const wide = windowPrices(pts, i, 10);
    const price = pts[i][1];
    const tight = near.length >= 3 && farFrom(price, medianOf(near), 0.35);
    const broad = wide.length >= 5 && farFrom(price, medianOf(wide), 0.25);
    if (tight || broad) out.add(pts[i][0]);
  }
  return out;
}

// Spikes are left off the chart. They are not redrawn at a capped price.
export function chartSeries(points) {
  const pts = seriesOf(points);
  const spikes = spikeDates(pts);
  if (!spikes.size) return pts;
  const kept = pts.filter((p) => !spikes.has(p[0]));
  return kept.length ? kept : pts;
}

export function clampSpikes(points) {
  return chartSeries(points);
}

function medianOf(values) {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// A 3-day sample copied forward (price[i] = price[i % 3]) is not a day's price.
// Keep the first three days of that run. Drop the copies. Do not fill the gap.
export function dropTiledCycles(points) {
  const pts = seriesOf(points);
  if (pts.length < 9) return pts;
  const drop = new Set();
  let a = 0;
  while (a < pts.length) {
    let b = a;
    while (b + 3 < pts.length && cents(pts[b][1]) === cents(pts[b + 3][1]) && daySpan(pts[b][0], pts[b + 3][0]) === 3) b += 1;
    if (b > a) {
      const end = b + 2;
      const length = end - a + 1;
      if (length >= 9 && a + 2 < pts.length) {
        const pat = [pts[a][1], pts[a + 1][1], pts[a + 2][1]];
        let pure = true;
        const uniq = new Set();
        for (let i = 0; i < length; i += 1) {
          uniq.add(cents(pts[a + i][1]));
          if (cents(pts[a + i][1]) !== cents(pat[i % 3])) pure = false;
        }
        if (pure && uniq.size > 1) {
          for (let i = 3; i < length; i += 1) drop.add(a + i);
        }
      }
      a = b;
    } else a += 1;
  }
  if (!drop.size) return pts;
  return pts.filter((_, i) => !drop.has(i));
}

export function claimSeries(points) {
  const pts = dropTiledCycles(points);
  const spikes = spikeDates(pts);
  const kept = pts.filter((p) => !spikes.has(p[0]));
  return kept.length >= 2 ? kept : pts;
}

export function isThinSeries(points, asOf) {
  const pts = dropTiledCycles(points);
  if (!pts.length) return false;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(asOf || "")) ? asOf : pts[pts.length - 1][0];
  const cut = new Date(Date.parse(`${end}T00:00:00Z`) - 180 * 86400000).toISOString().slice(0, 10);
  const seen = new Set();
  for (const p of pts) if (p[0] >= cut && p[0] <= end) seen.add(cents(p[1]));
  return seen.size < 30;
}

function seriesBounds(pts) {
  let lo = pts[0];
  let hi = pts[0];
  for (const p of pts) {
    if (p[1] < lo[1]) lo = p;
    if (p[1] > hi[1]) hi = p;
  }
  return { lo, hi };
}

function extremeOf(pts) {
  if (pts.length < 2) return null;
  const { lo, hi } = seriesBounds(pts);
  if (cents(lo[1]) === cents(hi[1])) return null;
  const last = pts[pts.length - 1];
  const span = daySpan(pts[0][0], last[0]);
  const month = monthOf(pts[0][0]);
  const sixMonths = span >= 150;
  if (cents(last[1]) === cents(lo[1])) return { kind: "low", month, price: last[1], sixMonths };
  if (cents(last[1]) === cents(hi[1])) return { kind: "high", month, price: last[1], sixMonths };
  return null;
}

function extremePhrase(extreme) {
  if (!extreme) return "";
  if (extreme.sixMonths) return extreme.kind === "low" ? "a 6-month low" : "a 6-month high";
  const word = extreme.kind === "low" ? "lowest" : "highest";
  return `its ${word} price since ${extreme.month}`;
}

export function endStreak(pts) {
  let n = 0;
  let dir = 0;
  for (let i = pts.length - 1; i > 0; i -= 1) {
    if (daySpan(pts[i - 1][0], pts[i][0]) !== 1) break;
    const step = cents(pts[i][1]) - cents(pts[i - 1][1]);
    if (step === 0) break;
    const d = Math.sign(step);
    if (!dir) dir = d;
    if (d !== dir) break;
    n += 1;
  }
  return { n, dir };
}

function lastPriceInMonth(pts, monthIndex) {
  let hit = null;
  for (const p of pts) if (Number(p[0].slice(5, 7)) === monthIndex) hit = p;
  return hit;
}

function whyChoices(pts, sign, headline) {
  if (pts.length < 2) return [];
  const { lo, hi } = seriesBounds(pts);
  const last = pts[pts.length - 1][1];
  const vsHigh = hi[1] > 0 ? last / hi[1] : 0;
  const vsLow = lo[1] > 0 ? last / lo[1] : 0;
  const choices = [];
  const add = (text) => {
    if (!text || headline.includes(text.replace(/\.$/, ""))) return;
    choices.push(text);
  };
  if (vsHigh >= 0.45 && vsHigh <= 0.55) add(`Half its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  if (vsLow >= 1.75 && vsLow <= 2.25) add(`Almost double its ${monthOf(lo[0])} price of ${priceWords(lo[1])}.`);
  if (vsHigh >= 0.64 && vsHigh <= 0.7) add(`About two-thirds of its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  if (vsHigh >= 0.72 && vsHigh <= 0.78) add(`About three-quarters of its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  if (vsHigh >= 0.3 && vsHigh <= 0.4) add(`About a third of its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  const under = hi[1] - last;
  const over = last - lo[1];
  if (hi[1] > last && under / hi[1] >= 0.2) add(`Down ${priceWords(under)} from its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  if (last > lo[1] && over / lo[1] >= 0.2) add(`Up ${priceWords(over)} from its ${monthOf(lo[0])} low of ${priceWords(lo[1])}.`);
  const streak = endStreak(pts);
  if (streak.n >= 4 && (streak.dir === sign || streak.n >= 6)) add(`${streak.dir < 0 ? "Down" : "Up"} ${streak.n} straight days.`);
  const end = pts[pts.length - 1][0];
  const cut = new Date(Date.parse(`${end}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  let down = 0;
  let up = 0;
  const steps = [];
  for (let i = 1; i < pts.length; i += 1) {
    const step = pts[i][1] - pts[i - 1][1];
    if (pts[i][0] <= cut) continue;
    if (step < 0) down += 1;
    else if (step > 0) up += 1;
    if ((sign < 0 && step < 0) || (sign > 0 && step > 0)) steps.push({ date: pts[i][0], from: pts[i - 1][1] });
  }
  const toward = sign < 0 ? down : up;
  if (toward >= 15) add(`Has ${sign < 0 ? "fallen" : "risen"} ${toward} of the last 30 days.`);
  if (steps.length >= 2 && steps.length <= 6) {
    const n = COUNT_WORDS[steps.length] || String(steps.length);
    const kind = sign < 0 ? "step-downs" : "step-ups";
    add(`${n} ${kind} since ${monthDay(steps[0].date)}, from ${priceWords(steps[0].from)}.`);
  }
  const lastMonth = Number(end.slice(5, 7));
  let bestMonth = null;
  for (let m = 1; m <= 12; m += 1) {
    if (m === lastMonth) continue;
    const point = lastPriceInMonth(pts, m);
    if (!point || !(point[1] > 0)) continue;
    const gap = Math.abs(last - point[1]) / point[1];
    if (gap < 0.08) continue;
    if (!bestMonth || gap > bestMonth.gap) bestMonth = { gap, point, above: last > point[1] };
  }
  if (bestMonth) {
    const word = bestMonth.above ? "Above" : "Below";
    add(`${word} its ${monthOf(bestMonth.point[0])} price of ${priceWords(bestMonth.point[1])}.`);
  }
  if (hi[1] > last && under / hi[1] >= 0.08 && under / hi[1] < 0.2) add(`Down ${priceWords(under)} from its ${monthOf(hi[0])} high of ${priceWords(hi[1])}.`);
  if (last > lo[1] && over / lo[1] >= 0.08 && over / lo[1] < 0.2) add(`Up ${priceWords(over)} from its ${monthOf(lo[0])} low of ${priceWords(lo[1])}.`);
  return choices;
}

function makeHeadline(read, pts, thin, allowExtreme = true) {
  const price = priceWords(read.price);
  const from = priceWords(read.fromPrice);
  const pct = Number(read.changePct);
  const days = Number(read.windowDays);
  const label = cardLabel(read);
  const shown = Number.isFinite(pct) ? String(Math.abs(pct)) : "";
  if (!label || !price || !from || !shown || pct === 0 || (days !== 7 && days !== 30 && days !== 90)) return "";
  const dir = pct > 0 ? "up" : "down";
  const extreme = allowExtreme && !thin && pts.length ? extremeOf(pts) : null;
  const phrase = extremePhrase(extreme);
  if (phrase) return `${label} hit ${phrase}: ${price}, ${dir} ${shown}% in ${days} days.`;
  const tail = thin ? ", on few sales." : ".";
  return `${label} is ${dir} ${shown}% over ${days} days, from ${from} to ${price}${tail}`;
}

export function whyPattern(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\$[\d,]+(?:\.\d+)?/g, "$x")
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}\b/g, "date")
    .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/g, "mon")
    .replace(/\b(?:one|two|three|four|five|six|seven|eight|nine)\b/g, "n")
    .replace(/\b(?:fallen|risen)\b/g, "moved")
    .replace(/\b\d+(?:\.\d+)?\b/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}

export function readCopy(read, used = new Set()) {
  const raw = dropTiledCycles(read.hist || read.points || []);
  const spikes = spikeDates(raw);
  const lastDate = raw.at(-1)?.[0];
  const pts = claimSeries(raw);
  const thin = isThinSeries(raw, read.toDate || read.asOf);
  const headline = makeHeadline(read, pts, thin, !(lastDate && spikes.has(lastDate)));
  const empty = { headline: "", why: "", thin };
  if (!headline || BANNED.test(headline)) return empty;
  const sign = Math.sign(Number(read.changePct));
  for (const text of whyChoices(pts, sign, headline)) {
    if (BANNED.test(text)) continue;
    const pattern = whyPattern(text);
    if (!pattern || used.has(pattern)) continue;
    return { headline, why: text, thin, pattern };
  }
  return { headline, why: "", thin };
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

export function selectFeedReads(rows, limit = 12) {
  const sorted = [...(rows || [])].sort((a, b) => (b.score || 0) - (a.score || 0) || String(a.name).localeCompare(String(b.name)));
  const picked = [];
  const used = new Set();
  const sets = new Map();
  const thinHeld = [];
  let index = 0;
  const tryRow = (row) => {
    const setName = row.set || "";
    if ((sets.get(setName) || 0) >= 2) return false;
    const copy = readCopy({ ...row, hist: row.rawHist || row.hist }, used);
    if (!copy.headline || !copy.why) return false;
    if (copy.thin && picked.length < 3) return false;
    used.add(copy.pattern);
    sets.set(setName, (sets.get(setName) || 0) + 1);
    const { rawHist, ...rest } = row;
    void rawHist;
    picked.push({ ...rest, headline: copy.headline, why: copy.why });
    return true;
  };
  while (picked.length < limit && (index < sorted.length || thinHeld.length)) {
    let row = null;
    if (picked.length < 3) {
      while (index < sorted.length && isThinSeries(sorted[index].rawHist || sorted[index].hist, sorted[index].toDate)) {
        thinHeld.push(sorted[index]);
        index += 1;
      }
      if (index >= sorted.length) break;
      row = sorted[index];
      index += 1;
    } else {
      const next = sorted[index];
      const held = thinHeld[0];
      if (held && (!next || (held.score || 0) > (next.score || 0))) row = thinHeld.shift();
      else if (next) {
        row = next;
        index += 1;
      } else row = thinHeld.shift();
    }
    if (!row) break;
    tryRow(row);
  }
  return picked;
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

// A catalogue window. Same spike rule as a ranked move, but a 1% change counts
// and 90 days counts. One step that is most of the move does not.
export function feedWindow(points, days) {
  const pts = (points || []).filter((p) => Array.isArray(p) && /^\d{4}-\d{2}-\d{2}$/.test(String(p[0])) && Number(p[1]) > 0);
  if (pts.length < 30 || (days !== 7 && days !== 30 && days !== 90)) return null;
  const end = pts[pts.length - 1];
  const target = new Date(Date.parse(`${end[0]}T00:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  let then = null;
  for (const p of pts) {
    if (p[0] <= target) then = p;
    else break;
  }
  if (!then) return null;
  const span = daySpan(then[0], end[0]);
  if (span < days - 2 || span > days + 5) return null;
  const from = Number(then[1]);
  const to = Number(end[1]);
  if (from < 1 || to < 1 || from === to) return null;
  const pct = ((to - from) / from) * 100;
  if (!Number.isFinite(pct) || Math.abs(pct) < 1) return null;
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
  if (confirms < 2 || !(net > 0) || maxStep / net > 0.5) return null;
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
