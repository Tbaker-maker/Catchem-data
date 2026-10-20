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
    .replace(/^(?:swsh|sv|sm|me|xy|bw|dp|hgss|ex)\d*\s*[:\-]\s*/, "")
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

export function skipBoxName(name) {
  return /1st edition|unlimited|half booster|enhanced|shadowless|revised/i.test(String(name || ""));
}

function asMap(value) {
  if (!value) return new Map();
  if (value instanceof Map) return value;
  return new Map(Object.entries(value));
}

// One canonical booster box per set. Plain boxes win over 1st edition,
// unlimited, half, enhanced, shadowless, and revised printings. ETBs, tins,
// and bundles are not boxes, so they never land here.
export function setsFromBoxes(boxes, flagByPid, daysByPid) {
  const flags = asMap(flagByPid);
  const days = asMap(daysByPid);
  const rows = (Array.isArray(boxes) ? boxes : []).filter((row) => row?.subtype === "booster-box" && row.tcgPlayerId);
  const groups = new Map();
  for (const row of rows) {
    const key = foldSet(row.set) || foldSet(row.name);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const plainKeys = new Set();
  for (const [key, group] of groups) {
    if (group.some((row) => !skipBoxName(row.name))) plainKeys.add(key);
  }
  for (const [key, group] of [...groups.entries()]) {
    if (group.some((row) => !skipBoxName(row.name))) continue;
    const dests = new Set();
    for (const row of group) {
      for (const k of setKeys(row.set)) if (k !== key && plainKeys.has(k)) dests.add(k);
    }
    if (dests.size === 1) {
      const dest = [...dests][0];
      groups.get(dest).push(...group);
      groups.delete(key);
    }
  }
  const bySet = {};
  const owners = {};
  const canonical = [];
  for (const [setKey, group] of groups) {
    const plain = group.filter((row) => !skipBoxName(row.name));
    const pool = plain.length ? plain : group;
    pool.sort((a, b) => {
      const gap = Number(days.get(String(b.tcgPlayerId)) || 0) - Number(days.get(String(a.tcgPlayerId)) || 0);
      if (gap) return gap;
      const len = String(a.name || "").length - String(b.name || "").length;
      if (len) return len;
      return String(a.tcgPlayerId).localeCompare(String(b.tcgPlayerId));
    });
    const box = pool[0];
    const pid = String(box.tcgPlayerId);
    const flag = flags.get(pid) || "";
    const boxId = `tcgcsv-${pid}`;
    const ok = flag === "below" || flag === "above";
    canonical.push({ setKey, flag: ok ? flag : "", boxId, setName: String(box.set || ""), name: String(box.name || "") });
    if (!ok) continue;
    const keys = [];
    for (const key of [...setKeys(box.set), ...setKeys(box.name), setKey]) {
      if (key && !keys.includes(key)) keys.push(key);
    }
    for (const key of keys) {
      if (owners[key] && owners[key] !== boxId) continue;
      owners[key] = boxId;
      bySet[key] = { flag, boxId };
    }
  }
  return { bySet, canonical };
}

// Fails when a canonical booster box is flagged and that box is missing from
// bySet, or when bySet cites some other product. An ETB, tin, bundle, half
// box, or enhanced box does not fill bySet while a plain box exists.
export function boosterBoxFlagGap(doc, products, daysByPid) {
  const boxes = (Array.isArray(products) ? products : []).filter((row) => row?.subtype === "booster-box" && row.tcgPlayerId);
  const idToPid = new Map();
  for (const row of boxes) {
    const pid = String(row.tcgPlayerId);
    idToPid.set(`tcgcsv-${pid}`, pid);
    if (row.id) idToPid.set(String(row.id), pid);
  }
  const flagByPid = new Map();
  for (const [id, flag] of Object.entries(doc?.byProduct || {})) {
    if (flag !== "below" && flag !== "above") continue;
    const pid = idToPid.get(String(id));
    if (pid && !flagByPid.has(pid)) flagByPid.set(pid, flag);
  }
  const built = setsFromBoxes(boxes, flagByPid, daysByPid);
  const actual = doc?.bySet && typeof doc.bySet === "object" ? doc.bySet : {};
  const missing = [];
  for (const row of built.canonical) {
    if (!row.flag) continue;
    const found = Object.values(actual).some((v) => v && typeof v === "object" && v.boxId === row.boxId && v.flag === row.flag);
    if (!found) missing.push(row.boxId);
  }
  const canonicalIds = new Set(built.canonical.map((row) => row.boxId));
  const stray = [];
  for (const v of Object.values(actual)) {
    if (!v || typeof v !== "object" || !v.boxId) continue;
    if (!canonicalIds.has(v.boxId)) stray.push(v.boxId);
  }
  return { failed: missing.length > 0 || stray.length > 0, missing, stray };
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
