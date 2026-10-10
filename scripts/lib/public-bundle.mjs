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

// The lead names one structural fact that is true of this series.
// A window-open comparison is not that fact, and filler closers are banned.
export const FILLER_BAN = /\b(beside|beyond|posted|stamped|following|within|during|in context|for reference|as written|on record|in view|at hand|for now|on paper|as shown|as listed|in short)\b|\bas of\b/i;

function scopeFacts(points, opts) {
  const all = seriesOf(points);
  if (all.length < 2) return null;
  const toDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.toDate || "")) ? opts.toDate : all[all.length - 1][0];
  const fromDate = /^\d{4}-\d{2}-\d{2}$/.test(String(opts.fromDate || "")) ? opts.fromDate : all[0][0];
  const scoped = all.filter((pt) => pt[0] <= toDate && pt[0] >= fromDate);
  if (scoped.length < 2) return null;
  const facts = pathFacts(scoped, { ...opts, fromDate, toDate });
  if (!(facts.lastPrice > 0)) return null;
  return facts;
}

function pairOk(facts, price, date) {
  if (!(Number(price) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return false;
  if (cents(price) === cents(facts.lastPrice) || date === facts.lastDate) return false;
  if (!priceWords(price) || priceWords(price) === priceWords(facts.lastPrice)) return false;
  if (!monthDay(date) || monthDay(date) === monthDay(facts.lastDate)) return false;
  return true;
}

function relOf(latest, other) {
  if (cents(latest) === cents(other)) return "";
  return cents(latest) > cents(other) ? "rose" : "fell";
}

function buildSecondFacts(facts, opts) {
  const out = [];
  const prev = facts.prev;
  const lastStep = prev ? cents(facts.lastPrice) - cents(prev[1]) : 0;
  const prior = facts.priorStep;
  if (facts.gap.length >= 2 && prev && pairOk(facts, prev[1], prev[0])) {
    out.push({ id: "gap", gap: facts.gap.slice(), pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.roundHigh && pairOk(facts, facts.hi[1], facts.hi[0])) {
    out.push({ id: "round-rally", pair: { p: facts.hi[1], d: facts.hi[0] } });
  }
  if (facts.roundLow && pairOk(facts, facts.lo[1], facts.lo[0])) {
    out.push({ id: "round-drop", pair: { p: facts.lo[1], d: facts.lo[0] } });
  }
  if (facts.tailFlat && pairOk(facts, facts.tailFlat.price, facts.tailFlat.end)) {
    out.push({ id: "flat", n: facts.tailFlat.n, pair: { p: facts.tailFlat.price, d: facts.tailFlat.end } });
  }
  const sold = opts.sold;
  if (sold && Number.isInteger(sold.count) && sold.count >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(sold.asOf || "")) && prev && pairOk(facts, prev[1], prev[0])) {
    out.push({ id: "sold", n: sold.count, asOf: sold.asOf, pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.stepCmp === "smaller" && prev && pairOk(facts, prev[1], prev[0])) {
    out.push({ id: "step-smaller", pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.stepCmp === "larger" && prev && pairOk(facts, prev[1], prev[0])) {
    out.push({ id: "step-larger", pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.lowStairs >= 2 && facts.onLow && prev && pairOk(facts, prev[1], prev[0]) && relOf(facts.lastPrice, prev[1]) === "fell") {
    out.push({ id: "low-now", pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.lowStairs >= 2 && !facts.onLow && facts.stairLow && facts.stairLow[0] !== facts.fromDate && facts.stairLow[0] !== facts.lastDate && pairOk(facts, facts.stairLow[1], facts.stairLow[0]) && relOf(facts.lastPrice, facts.stairLow[1]) === "rose") {
    out.push({ id: "low-early", pair: { p: facts.stairLow[1], d: facts.stairLow[0] } });
  }
  if (facts.highStairs >= 2 && facts.onHigh && prev && pairOk(facts, prev[1], prev[0]) && relOf(facts.lastPrice, prev[1]) === "rose") {
    out.push({ id: "high-now", pair: { p: prev[1], d: prev[0] } });
  }
  if (facts.highStairs >= 2 && !facts.onHigh && facts.stairHigh && facts.stairHigh[0] !== facts.fromDate && facts.stairHigh[0] !== facts.lastDate && pairOk(facts, facts.stairHigh[1], facts.stairHigh[0]) && relOf(facts.lastPrice, facts.stairHigh[1]) === "fell") {
    out.push({ id: "high-early", pair: { p: facts.stairHigh[1], d: facts.stairHigh[0] } });
  }
  return out.filter((fact) => relOf(facts.lastPrice, fact.pair.p));
}

function windowSplit(facts, opts) {
  const prev = facts.prev;
  const open = Number(facts.fromPrice) || 0;
  const openDate = String(facts.fromDate || "");
  const days = Number(opts.windowDays);
  if (!prev || !(open > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(openDate) || ![7, 30, 90].includes(days)) return null;
  if (cents(open) === cents(facts.lastPrice) || monthDay(openDate) === monthDay(facts.lastDate)) return null;
  if (monthDay(prev[0]) === monthDay(facts.lastDate) || cents(prev[1]) === cents(facts.lastPrice)) return null;
  const step = Math.sign(cents(facts.lastPrice) - cents(prev[1]));
  const win = Math.sign(cents(facts.lastPrice) - cents(open));
  if (!step || !win || step === win) return null;
  const stepPct = (Math.round(Math.abs((facts.lastPrice - prev[1]) / prev[1]) * 1000) / 10).toFixed(1);
  // The window leads. This clause is only the disagreeing last print, so the
  // first from/to percent stays the window percent.
  return {
    stepRel: step > 0 ? "rose" : "fell",
    text: `, while the ${days}-day window's latest step ${step > 0 ? "rose" : "fell"} from ${priceWords(prev[1])} on ${monthDay(prev[0])}, ${step < 0 ? "minus" : "plus"} ${stepPct}%`,
  };
}

function pairIsStep(fact, facts) {
  const prev = facts.prev;
  return !!(prev && fact.pair && fact.pair.d === prev[0] && cents(fact.pair.p) === cents(prev[1]));
}

export const BAD_DATE = /at Sep|dated Sep \d+ on Sep|of Sep \d+ on Sep/;

function renderFactLine(fact, facts, opts) {
  const name = opts.name ? String(opts.name).trim() : "This ask";
  const p1 = priceWords(facts.lastPrice);
  const d1 = monthDay(facts.lastDate);
  const p2 = priceWords(fact.pair.p);
  const d2 = monthDay(fact.pair.d);
  const rel = relOf(facts.lastPrice, fact.pair.p);
  const prev = facts.prev;
  const split = windowSplit(facts, opts);
  if (!p1 || !d1 || !rel) return "";
  let claim = "";
  switch (fact.id) {
    case "gap": {
      const days = fact.gap.map((day) => `on ${monthDay(day)}`);
      const listed = days.length < 2 ? days.join(", ") : `${days.slice(0, -1).join(", ")} and ${days.at(-1)}`;
      claim = `Weekday prints for ${name} are missing ${listed}`;
      break;
    }
    case "round-rally":
      claim = `${name} gave back a rally that reached ${p2} on ${d2}`;
      break;
    case "round-drop":
      claim = `${name} recovered a drop that reached ${p2} on ${d2}`;
      break;
    case "flat":
      claim = `${name} held one price across ${fact.n} prints through ${d2} at ${p2}`;
      break;
    case "sold":
      claim = `${name} has ${fact.n} copies sold on TCGplayer over 3 months on ${monthDay(fact.asOf)}, not eBay and not a 7-day count`;
      break;
    case "step-smaller":
      return "";
      break;
    case "step-larger":
      return "";
      break;
    case "low-now":
      return "";
      break;
    case "low-early":
      claim = `${name} made a lower low of ${p2} on ${d2}`;
      break;
    case "high-now":
      return "";
      break;
    case "high-early":
      claim = `${name} made a higher high of ${p2} on ${d2}`;
      break;
    default:
      return "";
  }
  let move = "";
  if (split && prev) {
    const stepP = priceWords(prev[1]);
    const stepD = monthDay(prev[0]);
    move = `and the latest price ${split.stepRel} to ${p1} on ${d1} after ${stepP} on ${stepD}${split.text}`;
  } else if (fact.id === "flat") {
    move = `then the latest price ${rel} and finished at ${p1} on ${d1}`;
  } else if (fact.id === "low-early" || fact.id === "high-early") {
    move = `while the latest price ${rel}, and ${d1} finished at ${p1}`;
  } else if (fact.id === "round-rally" || fact.id === "round-drop") {
    move = `as the latest price finally ${rel} and ${d1} settled at ${p1}`;
  } else if (fact.id === "gap") {
    move = `so the latest price also ${rel}, with ${d1} showing ${p1} and ${d2} having shown ${p2}`;
  } else if (fact.id === "sold") {
    move = `and the latest price ${rel} to ${p1} on ${d1} after ${p2} on ${d2}`;
  } else if (fact.id === "step-smaller") {
    move = `versus ${p2} on ${d2}, and its latest price still ${rel} on ${d1} to a price of ${p1}`;
  } else if (fact.id === "step-larger") {
    return "";
  } else if (fact.id === "low-now" || fact.id === "high-now") {
    move = `after the mark of ${p2} on ${d2}, with the latest price, which ${rel}, landing on ${d1} at ${p1}`;
  }
  if (!move) return "";
  let sentence = dedupeRepeats(`${claim}, ${move}.`).replace(/\s+/g, " ").trim();
  if (!sentence.endsWith(".")) sentence += ".";
  return sentence;
}

function dollarsAfter(chunk) {
  return [...String(chunk).matchAll(/\$([0-9,]+(?:\.\d+)?)/g)].map((match) => Number(match[1].replace(/,/g, "")));
}

function splitMovesAgree(raw) {
  const text = String(raw || "");
  const lower = text.toLowerCase();
  const cut = lower.indexOf(" while the ");
  if (cut < 0) return false;
  const left = text.slice(0, cut);
  const right = text.slice(cut);
  const anchor = left.toLowerCase().indexOf("latest price");
  if (anchor < 0) return false;
  const moved = left.slice(anchor).match(/\b(?:rose|fell|eased)\s+from\s+\$([0-9,.]+)\s+on\s+[A-Za-z]+\s+\d{1,2}\s+to\s+\$([0-9,.]+)/i);
  const leftPrices = dollarsAfter(left.slice(anchor));
  if (!moved && leftPrices.length < 2) return false;
  const latest = moved ? Number(moved[2].replace(/,/g, "")) : leftPrices[0];
  const stepOther = moved ? Number(moved[1].replace(/,/g, "")) : leftPrices[1];
  const leftLower = left.toLowerCase();
  const stepUp = /\brose\b|\babove\b|\bup\b/.test(leftLower);
  const stepDown = /\bfell\b|\beased\b|\bdown\b/.test(leftLower);
  if (stepUp === stepDown) return false;
  if (stepUp && !(latest > stepOther)) return false;
  if (stepDown && !(latest < stepOther)) return false;
  const rightPrices = dollarsAfter(right);
  if (rightPrices.length < 1) return false;
  const open = rightPrices[0];
  const rightLower = right.toLowerCase();
  const winUp = /\brose\b|\babove\b|\bup\b/.test(rightLower);
  const winDown = /\bfell\b|\beased\b|\bdown\b/.test(rightLower);
  if (winUp === winDown) return false;
  if (winUp && !(latest > open)) return false;
  if (winDown && !(latest < open)) return false;
  const pct = right.match(/\b(minus|plus)\s+([0-9]+(?:\.[0-9]+)?)%/i);
  if (!pct || !(open > 0)) return false;
  const stated = Number(pct[2]);
  const expected = Math.round(Math.abs((latest - open) / open) * 1000) / 10;
  if (!Number.isFinite(stated) || Math.abs(stated - expected) > 0.05) return false;
  if (pct[1].toLowerCase() === "minus" && !(latest < open)) return false;
  if (pct[1].toLowerCase() === "plus" && !(latest > open)) return false;
  return true;
}

export function statesBothMoves(text) {
  const lower = String(text || "").toLowerCase();
  if (!/\brose\b|\babove\b|\bup\b/.test(lower) || !/\bfell\b|\beased\b|\bdown\b/.test(lower)) return false;
  return splitMovesAgree(text);
}

const LEAD_BAN = /\b(bigger last step|moved less on the latest step|smaller last step|fresh lower low|fresh higher high|printed|stored|last print|expected|model price)\b/i;

function stepPercentAgrees(text) {
  const raw = String(text || "");
  const moved = raw.match(/\b(?:rose|fell|eased)\s+from\s+\$([0-9,.]+)\s+on\s+[A-Za-z]+\s+\d{1,2}\s+to\s+\$([0-9,.]+)/i);
  const pct = raw.match(/\b(up|down|minus|plus)\s+([0-9]+(?:\.[0-9]+)?)%/i);
  if (!moved || !pct) return false;
  const from = Number(moved[1].replace(/,/g, ""));
  const to = Number(moved[2].replace(/,/g, ""));
  if (!(from > 0) || !(to > 0) || from === to) return false;
  const expected = Math.round(Math.abs((to - from) / from) * 1000) / 10;
  const stated = Number(pct[2]);
  if (!Number.isFinite(stated) || Math.abs(stated - expected) > 0.05) return false;
  const up = pct[1].toLowerCase() === "up" || pct[1].toLowerCase() === "plus";
  if (up && !(to > from)) return false;
  if (!up && !(to < from)) return false;
  return true;
}

function usableLead(sentence) {
  if (!sentence || !/latest price/.test(sentence)) return false;
  if (BANNED.test(sentence) || FILLER_BAN.test(sentence) || BAD_DATE.test(sentence) || /\bsince Sep\b/.test(sentence) || LEAD_BAN.test(sentence)) return false;
  if (!stepPercentAgrees(sentence)) return false;
  if (/ while the /.test(sentence) && !splitMovesAgree(sentence)) return false;
  if (/\. [A-Z]/.test(sentence)) return false;
  return directionAgrees(sentence);
}

function oneDecimalPct(from, to) {
  if (!(Number(from) > 0) || !(Number(to) > 0)) return "";
  return (Math.round(Math.abs((to - from) / from) * 1000) / 10).toFixed(1);
}

function moveEnds(from, fromDate, to, toDate) {
  const rel = relOf(to, from);
  if (!rel) return null;
  const fromP = priceWords(from);
  const toP = priceWords(to);
  const fromD = monthDay(fromDate);
  const toD = monthDay(toDate);
  if (!fromP || !toP || !fromD || !toD || fromP === toP || fromD === toD) return null;
  const pct = oneDecimalPct(from, to);
  if (!pct) return null;
  return { rel, fromP, toP, fromD, toD, from, to, pct };
}

function collectorFact(facts, opts) {
  const prev = facts.prev;
  const step = prev ? moveEnds(prev[1], prev[0], facts.lastPrice, facts.lastDate) : null;
  const days = Number(opts.windowDays);
  const open = Number(facts.fromPrice) || 0;
  const openDate = String(facts.fromDate || "");
  const win = [7, 30, 90].includes(days) ? moveEnds(open, openDate, facts.lastPrice, facts.lastDate) : null;
  // The read's percent is the window, not the last print. A flat last print
  // must not hide the window, and an opposite last step must not lead.
  const split = windowSplit(facts, opts);
  const use = win || step;
  if (!use) return null;
  const name = opts.name ? String(opts.name).trim() : "";
  const who = name ? `${name} latest price` : "The latest price";
  const dirWord = use.rel === "rose" ? "up" : "down";
  let line = `${who} ${use.rel} from ${use.fromP} on ${use.fromD} to ${use.toP} on ${use.toD}, ${dirWord} ${use.pct}%`;
  let id = "move";
  const sold = opts.sold;
  const soldOk = !!(sold && Number.isInteger(sold.count) && sold.count >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(sold.asOf || "")));
  const flatN = Number(facts.flatDays) || 0;
  const flatOk = flatN >= 5 && cents(facts.flatPrice) !== cents(facts.lastPrice);
  if (split && win) {
    line += split.text;
    id = "split";
  } else if (soldOk) {
    line += `, with ${sold.count} copies sold on TCGplayer over 3 months on ${monthDay(sold.asOf)}, not eBay and not a 7-day count`;
    id = "sold";
  } else if (flatOk) {
    line += `, after ${flatN} prints at one price`;
    id = "flat";
  }
  line = line.replace(/\s+/g, " ").trim();
  if (!line.endsWith(".")) line += ".";
  return { line, id };
}

export function directionAgrees(text) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const up = /\b(rose|above|up)\b/.test(lower);
  const down = /\b(fell|eased|down)\b/.test(lower);
  if (up && down) return splitMovesAgree(raw);
  if (!up && !down) return true;
  const anchor = lower.indexOf("latest price");
  if (anchor < 0) return false;
  const moved = raw.slice(anchor).match(/\b(?:rose|fell|eased)\s+from\s+\$([0-9,.]+)\s+on\s+[A-Za-z]+\s+\d{1,2}\s+to\s+\$([0-9,.]+)/i);
  if (moved) {
    const from = Number(moved[1].replace(/,/g, ""));
    const to = Number(moved[2].replace(/,/g, ""));
    if (!(from > 0) || !(to > 0) || from === to) return false;
    if (up) return to > from;
    return to < from;
  }
  if (anchor < 0) return false;
  const re = /\$([0-9,]+(?:\.\d+)?)/g;
  let latest = null;
  let other = null;
  let match;
  while ((match = re.exec(raw))) {
    const value = Number(match[1].replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    if (match.index >= anchor && latest == null) latest = value;
    else if (other == null) other = value;
  }
  if (latest == null || other == null || latest === other) return false;
  if (up) return latest > other;
  return latest < other;
}

export function leadFrameLines(points, opts = {}) {
  const facts = scopeFacts(points, opts);
  if (!facts) return [];
  const made = collectorFact(facts, opts);
  if (!made || !usableLead(made.line)) return [];
  return [made.line];
}

export function pickLead(points, opts = {}, accept = null) {
  const facts = scopeFacts(points, opts);
  if (!facts) return null;
  const made = collectorFact(facts, opts);
  if (!made || !usableLead(made.line)) return null;
  if (accept && !accept(made.line, made.id)) return null;
  return made;
}

export function composeLead(points, opts = {}, accept = null) {
  return pickLead(points, opts, accept)?.line || "";
}

export function pathSentence(points, opts = {}) {
  const all = seriesOf(points);
  if (all.length < 2) return "A price path is missing.";
  const led = composeLead(points, opts);
  if (led) return led;
  const facts = scopeFacts(points, opts);
  if (!facts) return "The latest price is missing.";
  const who = opts.name ? ` of ${String(opts.name).trim()}` : "";
  return `The latest price${who} is ${priceWords(facts.lastPrice)} on ${monthDay(facts.lastDate)}.`;
}

export function pathAlt(points, opts = {}) {
  const all = seriesOf(points).filter((pt) => !opts.toDate || pt[0] <= opts.toDate);
  if (all.length < 2) return "";
  const last = all[all.length - 1];
  const prev = all[all.length - 2];
  if (cents(last[1]) === cents(prev[1])) return "";
  const who = opts.name ? String(opts.name).trim() : "The ask";
  const bits = [`${who} went from ${priceWords(prev[1])} on ${monthDay(prev[0])} to ${priceWords(last[1])} on ${monthDay(last[0])}`];
  bits.push("and that step is the only watch");
  return dedupeRepeats(bits.join(", ") + ".").replace(/\s+/g, " ").trim();
}

export function fourGrams(text) {
  const words = String(text || "").toLowerCase().replace(/[^a-z0-9$%.]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i + 3 < words.length; i += 1) out.push(words.slice(i, i + 4).join(" "));
  return out;
}

export function phrasePeak(lines) {
  const counts = new Map();
  let peak = 0;
  let phrase = "";
  for (const line of lines || []) {
    const local = new Map();
    for (const gram of fourGrams(line)) local.set(gram, (local.get(gram) || 0) + 1);
    for (const [gram, n] of local) {
      const next = (counts.get(gram) || 0) + n;
      counts.set(gram, next);
      if (next > peak) {
        peak = next;
        phrase = gram;
      }
    }
  }
  return { peak, phrase };
}

// A price at least 50% under the other copy of the same product is not a move.
// Keep the cluster that agrees. Never invent a replacement price. If the two
// copies are the same size, the caller leaves the product out.
export function separateHalfCopies(points) {
  const pts = seriesOf(points);
  if (pts.length < 4) return { keep: pts, dropped: [], ambiguous: false, low: null, high: null };
  const isolated = new Set();
  for (let i = 0; i < pts.length; i += 1) {
    const near = [];
    for (let j = 0; j < pts.length; j += 1) {
      if (i === j) continue;
      if (Math.abs(daySpan(pts[i][0], pts[j][0])) <= 10) near.push(pts[j][1]);
    }
    if (near.length < 2) continue;
    const ns = [...near].sort((a, b) => a - b);
    const med = ns[Math.floor(ns.length / 2)];
    const agree = ns[0] >= ns[ns.length - 1] * 0.6;
    if (agree && med > 0 && pts[i][1] <= med * 0.5) isolated.add(i);
  }
  const without = pts.filter((_, i) => !isolated.has(i));
  const mode = halfMode(without.length >= 4 ? without : pts);
  if (mode.ambiguous) {
    return { keep: pts, dropped: [], ambiguous: true, low: mode.low, high: mode.high };
  }
  const dropDates = new Set(mode.cheap.map((pt) => pt[0]));
  for (const i of isolated) dropDates.add(pts[i][0]);
  if (!dropDates.size) return { keep: pts, dropped: [], ambiguous: false, low: null, high: null };
  const dropped = pts.filter((pt) => dropDates.has(pt[0]));
  const keep = pts.filter((pt) => !dropDates.has(pt[0]));
  if (keep.length < 2) return { keep: pts, dropped: [], ambiguous: true, low: mode.low, high: mode.high };
  const keptVals = keep.map((pt) => pt[1]).sort((a, b) => a - b);
  return {
    keep,
    dropped,
    ambiguous: false,
    low: Math.min(...dropped.map((pt) => pt[1])),
    high: keptVals[Math.floor(keptVals.length / 2)],
  };
}

function halfMode(pts) {
  const none = { ambiguous: false, cheap: [], low: null, high: null };
  if (pts.length < 8) return none;
  const values = pts.map((pt) => pt[1]).sort((a, b) => a - b);
  const med = values[Math.floor(values.length / 2)];
  if (!(med > 0)) return none;
  const cheap = pts.filter((pt) => pt[1] <= med * 0.5);
  const rich = pts.filter((pt) => pt[1] > med * 0.5);
  if (cheap.length < 2 || rich.length < 2) {
    if (cheap.length >= 1 && cheap.length * 4 <= rich.length) return { ambiguous: false, cheap, low: Math.min(...cheap.map((pt) => pt[1])), high: med };
    return none;
  }
  const cheapMax = Math.max(...cheap.map((pt) => pt[1]));
  const richMin = Math.min(...rich.map((pt) => pt[1]));
  const bridge = pts.filter((pt) => pt[1] > cheapMax && pt[1] < richMin).length;
  if (bridge >= 3 || richMin <= cheapMax * 1.5) return none;
  const share = cheap.length / pts.length;
  const low = Math.min(...cheap.map((pt) => pt[1]));
  const highVals = rich.map((pt) => pt[1]).sort((a, b) => a - b);
  const high = highVals[Math.floor(highVals.length / 2)];
  if (share >= 0.25 && share <= 0.75) return { ambiguous: true, cheap, low, high };
  if (share < 0.25) return { ambiguous: false, cheap, low, high };
  return none;
}


function tailFlat(scoped) {
  if (!scoped || scoped.length < 6) return null;
  const prev = scoped[scoped.length - 2];
  const last = scoped[scoped.length - 1];
  if (cents(prev[1]) === cents(last[1])) return null;
  let n = 1;
  for (let i = scoped.length - 2; i > 0; i -= 1) {
    if (cents(scoped[i - 1][1]) !== cents(prev[1])) break;
    if (daySpan(scoped[i - 1][0], scoped[i][0]) > 3) break;
    n += 1;
  }
  return n >= 5 ? { n, price: prev[1], end: prev[0] } : null;
}

function pathFacts(scoped, opts) {
  const last = scoped[scoped.length - 1];
  const prev = scoped[scoped.length - 2];
  const lastStep = cents(last[1]) - cents(prev[1]);
  const prior = scoped.length >= 3 ? scoped[scoped.length - 3] : null;
  const priorStep = prior ? cents(prev[1]) - cents(prior[1]) : null;
  let stepCmp = "same";
  if (priorStep == null || lastStep === 0 || priorStep === 0) stepCmp = "missing";
  else if (Math.abs(lastStep) < Math.abs(priorStep)) stepCmp = "smaller";
  else if (Math.abs(lastStep) > Math.abs(priorStep)) stepCmp = "larger";
  const stairs = weekStairs(scoped, opts.toDate);
  let flatPrice = scoped[0][1];
  let flatDays = 1;
  let bestFlat = 1;
  let bestFlatPrice = scoped[0][1];
  let bestFlatEnd = scoped[0][0];
  for (let i = 1; i < scoped.length; i += 1) {
    if (cents(scoped[i][1]) === cents(flatPrice) && daySpan(scoped[i - 1][0], scoped[i][0]) <= 3) flatDays += 1;
    else {
      flatPrice = scoped[i][1];
      flatDays = 1;
    }
    if (flatDays > bestFlat) {
      bestFlat = flatDays;
      bestFlatPrice = flatPrice;
      bestFlatEnd = scoped[i][0];
    }
  }
  const win = scoped.filter((pt) => !opts.fromDate || pt[0] >= opts.fromDate);
  const use = win.length >= 2 ? win : scoped;
  let hi = use[0];
  let lo = use[0];
  for (const pt of use) {
    if (cents(pt[1]) > cents(hi[1])) hi = pt;
    if (cents(pt[1]) < cents(lo[1])) lo = pt;
  }
  const start = use[0];
  const end = use[use.length - 1];
  const awayHigh = hi[1] >= start[1] * 1.15 && cents(hi[1]) !== cents(end[1]);
  const awayLow = lo[1] <= start[1] * 0.85 && cents(lo[1]) !== cents(end[1]);
  const back = start[1] > 0 && Math.abs(end[1] - start[1]) / start[1] <= 0.04;
  const roundHigh = back && awayHigh && !awayLow;
  const roundLow = back && awayLow && !awayHigh;
  const gap = gapRun(use);
  return {
    lastPrice: last[1],
    lastDate: last[0],
    prev,
    stepCmp,
    priorStep: priorStep,
    dir: last[1] >= (Number(opts.fromPrice) || start[1]) ? "up" : "down",
    lowStairs: stairs.low,
    highStairs: stairs.high,
    onLow: stairs.onLow,
    onHigh: stairs.onHigh,
    stairLow: stairs.lowAt,
    stairHigh: stairs.highAt,
    flatDays: bestFlat,
    flatPrice: bestFlatPrice,
    flatEnd: bestFlatEnd,
    tailFlat: tailFlat(scoped),
    hi,
    lo,
    roundHigh,
    roundLow,
    gap,
    fromPrice: Number(opts.fromPrice) || 0,
    fromDate: opts.fromDate || "",
  };
}

function weekStairs(scoped, toDate) {
  const endMs = Date.parse(`${toDate || scoped[scoped.length - 1][0]}T00:00:00Z`);
  const byDate = new Map(scoped.map((pt) => [pt[0], Number(pt[1])]));
  const weeks = [];
  for (let w = 0; w < 16; w += 1) {
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
  let low = 0;
  let high = 0;
  for (let i = 0; i < weeks.length - 1; i += 1) {
    if (cents(weeks[i].low) < cents(weeks[i + 1].low)) low += 1;
    else break;
  }
  for (let i = 0; i < weeks.length - 1; i += 1) {
    if (cents(weeks[i].high) > cents(weeks[i + 1].high)) high += 1;
    else break;
  }
  const latest = weeks[0];
  const end = toDate || scoped[scoped.length - 1][0];
  return {
    low,
    high,
    onLow: !!(latest && latest.lowDate === end),
    onHigh: !!(latest && latest.highDate === end),
    lowAt: latest ? [latest.lowDate, latest.low] : null,
    highAt: latest ? [latest.highDate, latest.high] : null,
  };
}

function gapRun(pts) {
  if (pts.length < 2) return [];
  const have = new Set(pts.map((pt) => pt[0]));
  const start = Date.parse(`${pts[0][0]}T00:00:00Z`);
  const end = Date.parse(`${pts[pts.length - 1][0]}T00:00:00Z`);
  const missing = [];
  for (let t = start; t <= end; t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    if (!have.has(date)) missing.push(date);
  }
  let run = [];
  let best = [];
  let prev = "";
  for (const date of missing) {
    if (prev && daySpan(prev, date) === 1) run.push(date);
    else run = [date];
    if (run.length > best.length) best = [...run];
    prev = date;
  }
  return best.length >= 2 ? best : [];
}

function chooseFact(f) {
  if (f.gap.length >= 2) return "gap";
  if (f.roundHigh) return "trip-high";
  if (f.roundLow) return "trip-low";
  if (f.flatDays >= 5) return cents(f.lastPrice) === cents(f.flatPrice) ? "flat-now" : "flat-then";
  if (f.stepCmp === "smaller") return f.dir === "down" ? "smaller-down" : "smaller-up";
  if (f.stepCmp === "larger") return f.dir === "down" ? "larger-down" : "larger-up";
  if (f.lowStairs >= 2) return f.onLow ? "lows-now" : "lows-early";
  if (f.highStairs >= 2) return f.onHigh ? "highs-now" : "highs-early";
  return f.dir === "down" ? "stall-down" : "stall-up";
}

function whoOf(opts) {
  return opts.name ? String(opts.name).trim() : "This ask";
}

function spanWord(opts) {
  const days = Number(opts.windowDays);
  if (days === 7) return "week";
  if (days === 30) return "month";
  if (days === 90) return "quarter";
  return "";
}

function kindWord(opts) {
  const kind = opts.sealedKind || opts.subtype || "";
  if (kind === "box") return "booster box";
  if (kind === "etb") return "trainer box";
  if (kind === "bundle") return "sealed bundle";
  if (kind === "pack") return "booster pack";
  return "";
}

function renderFact(fact, f, opts) {
  const who = whoOf(opts);
  const last = priceWords(f.lastPrice);
  const day = monthDay(f.lastDate);
  const prevP = f.prev ? priceWords(f.prev[1]) : "";
  const prevD = f.prev ? monthDay(f.prev[0]) : "";
  const span = spanWord(opts);
  const over = span ? ` over the ${span}` : "";
  const gear = kindWord(opts) ? `, the ${kindWord(opts)},` : "";
  const fromBit = f.fromPrice > 0 && f.fromDate && cents(f.fromPrice) !== cents(f.lastPrice)
    ? `, from ${priceWords(f.fromPrice)} on ${monthDay(f.fromDate)}`
    : "";
  switch (fact) {
    case "gap":
      return `${who}${gear} has no print on ${f.gap.slice(0, 2).map(monthDay).join(" or ")}${over}, so latest price reads ${last} on ${day}`;
    case "trip-high":
      return `${who}${gear} ran up to ${priceWords(f.hi[1])}${over} and the latest price returned to ${last} on ${day}`;
    case "trip-low":
      return `${who}${gear} fell toward ${priceWords(f.lo[1])}${over} and the latest price recovered to ${last} on ${day}`;
    case "flat-now":
      return `${who}${gear} has stayed at ${priceWords(f.flatPrice)} across ${f.flatDays} prints${over}, latest price unchanged on ${day}`;
    case "flat-then":
      return `${who}${gear} was stuck at ${priceWords(f.flatPrice)} for ${f.flatDays} prints${over} before the latest price of ${last} on ${day}`;
    case "smaller-down":
      return `${who}${gear} eased by a smaller down step${over}, latest price ${last} dated ${day} versus ${prevP} on ${prevD}`;
    case "smaller-up":
      return `${who}${gear} rose by a smaller up step${over}, latest price ${last} dated ${day} against ${prevP} on ${prevD}`;
    case "larger-down":
      return `${who}${gear} fell by a larger down step${over}, latest price ${last} on ${day} off ${prevP} from ${prevD}`;
    case "larger-up":
      return `${who}${gear} rose by a larger up step${over}, latest price ${last} on ${day} above ${prevP} of ${prevD}`;
    case "lows-now":
      return `Lower lows are still printing${over}${opts.name ? " on " + opts.name : ""}${gear}, and the latest price is ${last} on ${day}${fromBit}`;
    case "lows-early":
      return `${who}${gear} printed a lower low at ${priceWords(f.lo[1])} on ${monthDay(f.lo[0])}${over}, while latest price reads ${last} for ${day}`;
    case "highs-now":
      return `${who}${gear} put in another higher high${over}, latest price ${last} on ${day}`;
    case "highs-early":
      return `${who}${gear} marked a higher high at ${priceWords(f.hi[1])} on ${monthDay(f.hi[0])}${over}, and latest price holds ${last} for ${day}`;
    case "stall-down":
      return `${who}${gear} failed to make a lower low${over}, and latest price sits at ${last} on ${day}`;
    default:
      return `${who}${gear} failed to clear the prior high${over}, and latest price remains ${last} on ${day}`;
  }
}

function extraClause(fact, f, opts) {
  const sold = opts.sold;
  if (sold && Number.isInteger(sold.count) && sold.count >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(String(sold.asOf || ""))) {
    const when = monthDay(sold.asOf);
    if (sold.count >= 1000) return `TCGplayer product-page data for 3 months lists ${sold.count} copies sold as of ${when}, not eBay and not 7 days`;
    return `the product-page snapshot covering 3 months on TCGplayer shows ${sold.count} sold copies dated ${when}, not a 7-day figure and not eBay`;
  }
  const listings = Number(opts.listings);
  if (Number.isInteger(listings) && listings >= 20 && /^\d{4}-\d{2}-\d{2}$/.test(String(opts.listingsAsOf || ""))) {
    return `${listings} listings were counted on ${monthDay(opts.listingsAsOf)}`;
  }
  switch (fact) {
    case "gap": return "filling those dates is the watch";
    case "trip-high": return "a fresh spike is the watch";
    case "trip-low": return "losing the rebound is the watch";
    case "flat-now": return "breaking that flat is the watch";
    case "flat-then": return "the old flat price is the watch";
    case "smaller-down": return "another shrink is the watch";
    case "smaller-up": return "another smaller rise is the watch";
    case "larger-down": return "another drop is the watch";
    case "larger-up": return "another push is the watch";
    case "lows-now": return "undercutting it is the watch";
    case "lows-early": return "the earlier low is the watch";
    case "highs-now": return "extending that high is the watch";
    case "highs-early": return "the earlier high is the watch";
    case "stall-down": return "a new low is the watch";
    default: return "a new high is the watch";
  }
}

function compareSteps(weeks, down) {
  if (!weeks[1] || !weeks[2]) return "missing";
  const lastStep = down ? cents(weeks[1].low) - cents(weeks[0].low) : cents(weeks[0].high) - cents(weeks[1].high);
  const prevStep = down ? cents(weeks[2].low) - cents(weeks[1].low) : cents(weeks[1].high) - cents(weeks[2].high);
  if (lastStep > prevStep) return "larger";
  if (lastStep < prevStep) return "smaller";
  return "same";
}

function dedupeRepeats(sentence) {
  const seenPrice = new Set();
  const seenDate = new Set();
  let out = sentence.replace(/\$[0-9,]+(?:\.\d+)?/g, (token) => {
    if (seenPrice.has(token)) return "that price";
    seenPrice.add(token);
    return token;
  });
  out = out.replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, (token) => {
    if (seenDate.has(token)) return "that day";
    seenDate.add(token);
    return token;
  });
  return out;
}

function watchClause(toDate, price) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(toDate || "")) || !(Number(price) > 0)) return "";
  const d = new Date(Date.parse(`${toDate}T00:00:00Z`) + 7 * 86400000);
  const when = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `, and check on ${when} whether it is still near ${priceWords(price)}`;
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
  const num = no ? `#${no}` : "";
  if (year) {
    const bits = [set, String(year), num].filter(Boolean);
    return bits.length ? `${name} (${bits.join(", ")})` : name;
  }
  if (set && num) return `${name} (${set} ${num})`;
  const bits = [set, num].filter(Boolean);
  return bits.length ? `${name} (${bits.join(" ")})` : name;
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
  const spanWord = days === 7 ? "this week" : days === 30 ? "this month" : "over 90 days";
  const tail = thin ? ", on few sales." : ".";
  return `${label} is ${dir} ${shown}% ${spanWord}: ${from} → ${price}${tail}`;
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
  const then = pts.find((p) => p[0] === target) || null;
  if (!then) return null;
  const span = daySpan(then[0], end[0]);
  if (span !== days) return null;
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
  const then = pts.find((p) => p[0] === target) || null;
  if (!then) return null;
  const span = daySpan(then[0], end[0]);
  if (span !== days) return null;
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
