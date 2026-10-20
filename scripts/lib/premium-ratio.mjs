// Premium ratio flags. The bands live in the private model spec and never
// leave it. A flag is only "below" or "above". Anything else is no flag.
// A single uses its set's booster box. No box, or a box with no flag, means
// no flag. An ETB, tin, or bundle is never that fallback.

export const PREMIUM_BELOW = "Below its usual premium";
export const PREMIUM_ABOVE = "Above its usual premium";

export function foldSet(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/^(?:swsh|sv|sm|me|xy|bw|dp|hgss|ex)\d*\s*:\s*/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function median(values) {
  const xs = (values || []).map(Number).filter((n) => n > 0).sort((a, b) => a - b);
  if (!xs.length) return 0;
  return xs[Math.floor(xs.length / 2)];
}

// points: [day, price]. spec: { minDays, below, above } from the private spec.
// Returns "below", "above", or "".
export function flagFromSeries(points, spec) {
  const minDays = Number(spec?.minDays);
  const below = Number(spec?.below);
  const above = Number(spec?.above);
  if (!(minDays >= 2) || !(below > 0 && below < 1) || !(above > 1)) return "";
  const byDay = new Map();
  for (const row of points || []) {
    const day = String(row?.[0] || "");
    const price = Number(row?.[1]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !(price > 0)) continue;
    byDay.set(day, price);
  }
  const days = [...byDay.keys()].sort();
  if (days.length < minDays) return "";
  const base = days.slice(0, -1).map((day) => byDay.get(day));
  if (base.length < minDays - 1) return "";
  const usual = median(base);
  if (!(usual > 0)) return "";
  const ratio = byDay.get(days[days.length - 1]) / usual;
  if (ratio <= below) return "below";
  if (ratio >= above) return "above";
  return "";
}

export function setKeys(name) {
  const fold = foldSet(name);
  if (!fold) return [];
  const keys = [fold];
  const noProduct = fold.replace(/\b(booster boxes|booster box|elite trainer boxes|elite trainer box|booster|boxes|box)\b/g, " ").replace(/\s+/g, " ").trim();
  if (noProduct && !keys.includes(noProduct)) keys.push(noProduct);
  const short = noProduct.replace(/ base set$/, "").trim();
  if (short && !keys.includes(short)) keys.push(short);
  return keys;
}
export function flagWord(flag) {
  if (flag === "below") return PREMIUM_BELOW;
  if (flag === "above") return PREMIUM_ABOVE;
  return "";
}

export function boardPill(flag) {
  const word = flagWord(flag);
  if (!word) return "";
  const tone = flag === "below"
    ? { fg: "#8ee0a8", bg: "#123d22" }
    : { fg: "#f6dc86", bg: "#3a2f0c" };
  return `<span style="display:inline-block;margin-top:6px;border-radius:999px;padding:3px 10px;font:600 13px/1.4 Arial,Helvetica,sans-serif;background:${tone.bg};color:${tone.fg}">${word}</span>`;
}

export function indexPremium(doc) {
  const sealed = new Set(Array.isArray(doc?.sealed) ? doc.sealed.map(String) : []);
  for (const id of Object.keys(doc?.byProduct || {})) sealed.add(String(id));
  return {
    byProduct: doc?.byProduct && typeof doc.byProduct === "object" ? doc.byProduct : {},
    bySet: doc?.bySet && typeof doc.bySet === "object" ? doc.bySet : {},
    sealed,
  };
}

// Sealed products use their own flag only. Singles use the set booster box.
export function flagForItem(item, doc) {
  const idx = doc?.sealed instanceof Set ? doc : indexPremium(doc || {});
  if (!item) return "";
  const ids = [item.id, item.sku, item.cardId].map((v) => String(v || "")).filter(Boolean);
  const href = String(item.href || "");
  const sealed = item.kind === "sealed" || href.startsWith("/p/") || ids.some((id) => idx.sealed.has(id));
  if (sealed) {
    for (const id of ids) {
      const flag = idx.byProduct[id];
      if (flag === "below" || flag === "above") return flag;
    }
    return "";
  }
  for (const key of setKeys(item.set)) {
    const row = idx.bySet[key];
    const flag = typeof row === "string" ? row : row?.flag;
    if (flag === "below" || flag === "above") return flag;
  }
  return "";
}
