// Shared card face for reads, lists, bars, and summaries.
// The collector number stays whole (108/135, not #108) so a full art is not
// the regular card. TCGplayer market prices are Near Mint unless a line says
// otherwise. eBay asking prices say the listing condition, or "any condition".
import { money as chromeMoney } from "./public-chrome.mjs";
import { CONDITION_NOTE } from "./read-quality.mjs";

export { CONDITION_NOTE };

export function cleanCardName(name) {
  return String(name || "")
    .replace(/\s+-\s+[A-Z]*\d+[a-z]?(?:\/[A-Z]*\d+)?\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fullNumber(num) {
  return String(num ?? "").trim();
}

function shortSet(set) {
  return String(set || "").replace(/^(SWSH|SV|SM|ME|XY|BW)\d*[A-Za-z.]*\s*[:-]\s*/, "").trim();
}

export function cardTitle(card) {
  const name = cleanCardName(card?.name);
  const set = shortSet(card?.set);
  const num = fullNumber(card?.number ?? card?.num);
  if (!name) return num;
  let title = name;
  if (set && !title.toLowerCase().includes(`(${set.toLowerCase()})`)) title = `${title} (${set})`;
  if (num && !hasNumber(title, num)) title = `${title} ${num}`;
  return title;
}

export function hasNumber(text, num) {
  const n = fullNumber(num);
  if (!n) return true;
  const s = String(text || "");
  return s.includes(n) || s.includes(`#${n}`);
}

// Shorten the name. Never shorten the collector number.
export function barLabel(card, nameMax = 14) {
  const name = cleanCardName(card?.name);
  const num = fullNumber(card?.number ?? card?.num);
  let short = name;
  if (short.length > nameMax) short = `${short.slice(0, Math.max(4, nameMax - 3)).trimEnd()}...`;
  return num ? `${short} ${num}` : short;
}

export function tcgAmount(amount, moneyFn = chromeMoney, opts) {
  const m = moneyFn(amount);
  if (!m) return "";
  const want = opts === true || (opts && (opts.condition === "NM" || opts.nm === true));
  if (!want) return String(m).replace(/\s+NM$/, "");
  return /NM\s*$/.test(m) ? m : `${m} NM`;
}

export function tcgPriceLine(amount, date, moneyFn = chromeMoney, opts) {
  const m = tcgAmount(amount, moneyFn, opts);
  if (!m) return "";
  const d = String(date || "").trim();
  return d ? `${m} · TCGplayer market, ${d}` : `${m} · TCGplayer market`;
}

export function ebayAskPhrase(condition) {
  const c = String(condition || "").trim();
  return c ? `eBay asking, ${c}` : "eBay asking, any condition";
}

export function priceRecord(amount, date, source = "tcgplayer", condition) {
  const ebay = source === "ebay";
  const given = String(condition || "").trim();
  const cond = ebay ? (given || "any condition") : given;
  return {
    amount: Number(amount),
    date: String(date || ""),
    source: ebay ? "ebay" : "tcgplayer",
    condition: cond,
    label: ebay ? cond : (cond === "NM" ? "Near Mint" : cond),
  };
}

const VARIANT_WORDS = "Special Illustration Rare|Illustration Rare|Tag Team \\(Alternate Art\\)|Alternate Art|Trainer Gallery|Galarian Gallery|Full Art|Secret Rare";

export function insertNumber(text, name, num) {
  const n = fullNumber(num);
  const body = String(text || "");
  if (!n || !body || hasNumber(body, n)) return body;
  const clean = cleanCardName(name);
  if (!clean) return body;
  const at = body.indexOf(clean);
  if (at < 0) return body;
  let end = at + clean.length;
  const rest = body.slice(end);
  const m = rest.match(new RegExp(`^(?:\\s+(?:${VARIANT_WORDS}))*(?:\\s*\\([^)]+\\))*`));
  if (m) end += m[0].length;
  return `${body.slice(0, end)} ${n}${body.slice(end)}`;
}

export function addNearMint(text, opts = {}) {
  const force = opts === true || opts.force === true;
  const s = String(text || "");
  if (!s.includes("$")) return s;
  if (/eBay/i.test(s)) return s;
  if (!force && !/TCGplayer/i.test(s)) return s;
  return s.replace(/\$[\d,]+(?:\.\d{2})?/g, (m, offset, src) => {
    const after = src.slice(offset + m.length, offset + m.length + 4);
    if (/^\s*NM\b/.test(after)) return m;
    const before = src.slice(Math.max(0, offset - 16), offset);
    if (/Near Mint\s*$/i.test(before)) return m;
    return `${m} NM`;
  });
}

// TCGplayer amounts get NM. An eBay ask keeps its own condition phrase.
// A dollar gap in the same sentence is not a market price, so it stays bare.
export function labelPrices(text, opts = {}) {
  const original = String(text || "");
  if (!original) return original;
  const hadPhrase = /eBay asking/i.test(original);
  const asks = [];
  let s = original.replace(/eBay asks \(\$[\d,]+(?:\.\d{2})?\)/g, (m) => {
    asks.push(m);
    return `@@ASK${asks.length - 1}@@`;
  });
  const ebayish = /eBay/i.test(original);
  const wantNm = opts === true || opts?.condition === "NM" || opts?.nm === true;
  if (wantNm && !ebayish) s = addNearMint(s, { force: true });
  else if (wantNm && /TCGplayer/i.test(s)) {
    s = s.replace(/TCGplayer market \(\$[\d,]+(?:\.\d{2})?\)/g, (m) => (
      /NM\)/.test(m) ? m : m.replace(/\$[\d,]+(?:\.\d{2})?/, (d) => `${d} NM`)
    ));
  }
  if (!asks.length) return s;
  return s.replace(/@@ASK(\d+)@@/g, (_, i) => {
    const m = asks[Number(i)];
    return hadPhrase ? m : `${m}, ${ebayAskPhrase()}`;
  });
}
