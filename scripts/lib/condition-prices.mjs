// TCGplayer condition ladder. NM is stored only when the file names Near Mint.
// A market price is not copied in as NM.

import { isVintageRelease, listingsAgree } from "./price-trust.mjs";

export const CONDITION_KEYS = ["NM", "LP", "MP", "HP", "DMG"];

const NAMES = {
  NM: ["near mint", "nm", "mint"],
  LP: ["lightly played", "lp"],
  MP: ["moderately played", "mp"],
  HP: ["heavily played", "hp"],
  DMG: ["damaged", "dmg", "damage"],
};

function norm(s) {
  return String(s || "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
}

export function conditionKey(label) {
  const n = norm(label);
  if (!n) return "";
  for (const key of CONDITION_KEYS) {
    if (NAMES[key].some((name) => n === name || n.endsWith(` ${name}`) || n.startsWith(`${name} `))) return key;
  }
  return "";
}

function put(out, key, amount, date) {
  const n = Number(amount);
  if (!key || !(n > 0)) return;
  if (!out[key] || (date && (!out[key].date || date >= out[key].date))) {
    out[key] = { amount: Math.round(n * 100) / 100, date: date || out[key]?.date || "" };
  }
}

// Accepts a flat map, a "Printing / Condition" map, or printing -> condition -> {price}.
export function pickLadder(input, date = "") {
  const out = {};
  if (!input || typeof input !== "object") return out;
  const visit = (label, value, when) => {
    const key = conditionKey(label);
    if (!key) return;
    const amount = value && typeof value === "object" ? (value.price ?? value.market ?? value.amount) : value;
    put(out, key, amount, (value && value.date) || when || date);
  };
  for (const [label, value] of Object.entries(input)) {
    if (value && typeof value === "object" && !("price" in value) && !("market" in value) && !("amount" in value)) {
      for (const [inner, innerVal] of Object.entries(value)) visit(inner, innerVal, date);
      const direct = conditionKey(label);
      if (direct && (value.price > 0 || value.market > 0)) visit(label, value, date);
    } else visit(label, value, date);
  }
  return out;
}

export function ladderRow({ id, name, number, printing, ladder }) {
  const conditions = { ...ladder };
  const hasPlayed = ["LP", "MP", "HP", "DMG"].some((key) => conditions[key]?.amount > 0);
  return {
    id: String(id || ""),
    name: String(name || ""),
    number: String(number || ""),
    printing: String(printing || ""),
    nmDefault: false,
    hasPlayed,
    conditions,
  };
}

export function rowsFromDistilled(doc) {
  const asOf = String(doc?.generatedAt || "").slice(0, 10);
  const rows = [];
  for (const card of doc?.cards || []) {
    const ladder = pickLadder(card.conditions, asOf);
    if (!["LP", "MP", "DMG"].some((key) => ladder[key]?.amount > 0)) continue;
    rows.push(ladderRow({
      id: card.cardId || card.tcgPlayerId,
      name: card.name,
      number: card.number,
      ladder,
    }));
  }
  return { asOf, rows };
}

// A printing and a condition, kept apart. A bare market price is not a condition.
// A condition with no printing name is not published.
export function splitPrintingPrices(input, date = "") {
  const out = {};
  if (!input || typeof input !== "object") return out;
  const put = (printing, cond, amount, when) => {
    const name = String(printing || "").trim();
    const key = conditionKey(cond);
    const n = Number(amount);
    if (!name || !key || !(n > 0)) return;
    if (!out[name]) out[name] = {};
    out[name][key] = Math.round(n * 100) / 100;
    const day = String(when || date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) out[name].date = day;
  };
  for (const [label, value] of Object.entries(input)) {
    if (value && typeof value === "object" && !("price" in value) && !("market" in value) && !("amount" in value)) {
      for (const [inner, innerVal] of Object.entries(value)) {
        const amount = innerVal && typeof innerVal === "object" ? (innerVal.price ?? innerVal.market ?? innerVal.amount) : innerVal;
        const when = (innerVal && typeof innerVal === "object" && innerVal.date) || date;
        put(label, inner, amount, when);
      }
      continue;
    }
    const parts = String(label).split("/");
    if (parts.length < 2) continue;
    const printing = parts[0].trim();
    const cond = parts.slice(1).join("/").trim();
    const amount = value && typeof value === "object" ? (value.price ?? value.market ?? value.amount) : value;
    const when = value && typeof value === "object" && value.date;
    put(printing, cond, amount, when || date);
  }
  return out;
}

export function nmForIndex(byPrinting, printing) {
  const row = byPrinting && byPrinting[printing];
  const n = Number(row && row.NM);
  return n > 0 ? n : null;
}

// NM only when that printing has NM. Otherwise the real condition, or nothing.
export function readLinePrice(byPrinting, printing) {
  const row = byPrinting && byPrinting[printing];
  if (!row) return null;
  if (Number(row.NM) > 0) return { condition: "NM", amount: row.NM };
  for (const key of ["LP", "MP", "HP", "DMG"]) {
    if (Number(row[key]) > 0) return { condition: key, amount: row[key] };
  }
  return null;
}

function emptySweep() {
  return { singles: 0, NM: 0, LP: 0, MP: 0, HP: 0, DMG: 0, checking: 0, indexNm: 0 };
}

// Public ladder. Vintage amounts stay out unless same-printing, same-condition
// listings counted agree. The band is the caller's config and is not copied out.
export function publishConditionCards(items, { unverified = new Set(), asks = {}, cfg = null, asOf = "" } = {}) {
  const cards = {};
  const sweep = { vintage: emptySweep(), modern: emptySweep(), undated: emptySweep() };
  const day = String(asOf || "").slice(0, 10);
  for (const item of items || []) {
    if (!item || item.kind === "sealed" || (item.kind && item.kind !== "single")) continue;
    const release = String(item.release || "").slice(0, 10);
    const dated = /^\d{4}-\d{2}-\d{2}$/.test(release);
    const bucket = !dated ? sweep.undated : isVintageRelease(release) ? sweep.vintage : sweep.modern;
    bucket.singles += 1;
    const split = splitPrintingPrices(item.conditions, item.conditionDate || day);
    const blocked = unverified.has(item.id) || item.unverified === true;
    const published = {};
    if (!blocked) {
      for (const [printing, row] of Object.entries(split)) {
        const kept = {};
        const rowDay = String(row.date || day).slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(rowDay)) kept.date = rowDay;
        for (const key of CONDITION_KEYS) {
          const amount = Number(row[key]);
          if (!(amount > 0)) continue;
          if (isVintageRelease(release)) {
            const list = asks[`${item.id}|${printing}|${key}`] || [];
            if (!cfg || !listingsAgree(amount, list, cfg)) continue;
          }
          kept[key] = amount;
        }
        if (CONDITION_KEYS.some((key) => Number(kept[key]) > 0)) published[printing] = kept;
      }
    }
    if (item.id && Object.keys(published).length) cards[item.id] = published;
    let any = false;
    for (const key of CONDITION_KEYS) {
      if (Object.values(published).some((row) => Number(row[key]) > 0)) {
        bucket[key] += 1;
        any = true;
      }
    }
    if (!any) bucket.checking += 1;
    if (nmForIndex(published, String(item.printing || "")) > 0) bucket.indexNm += 1;
  }
  return {
    doc: {
      asOf: day,
      source: "TCGplayer market",
      note: "A price is kept only when the file names that condition and that printing.",
      cards,
    },
    sweep,
  };
}
