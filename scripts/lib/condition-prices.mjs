// TCGplayer condition ladder. NM is stored only when the file names Near Mint.
// A market price is not copied in as NM.

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
