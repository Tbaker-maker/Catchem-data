// The set heading is the set name. The sealed line is the one product shown
// under that heading. A special printing (1st Edition, Shadowless, Pokémon
// Center, Exclusive) may be that product only when the heading names the
// printing. Otherwise the line is the ordinary booster pack. A pack the
// heading does not name is not the line, even when it is the dearest product.
// A Revised Unlimited pack stays the line only when no plain Unlimited
// booster pack is priced.
const SPECIAL = [
  [/shadowless/i, "shadowless"],
  [/1st edition|first edition/i, "1st edition"],
  [/pok[eé]mon center/i, "pokemon center"],
  [/\bexclusive\b/i, "exclusive"],
];

export function specialPrintings(name) {
  const text = String(name || "");
  return SPECIAL.filter(([re]) => re.test(text)).map(([, word]) => word);
}

function headingNamesPrinting(heading, name) {
  const words = specialPrintings(name);
  if (!words.length) return true;
  const h = String(heading || "").toLowerCase().replace(/é/g, "e");
  return words.every((word) => h.includes(word));
}

function isMultipack(name) {
  return /bundle|set of|\bcase\b|display|sleeved/i.test(String(name || ""));
}

export function isOrdinaryPack(item) {
  if (!item || item.kind !== "sealed") return false;
  if (!(Number(item.price) > 0)) return false;
  const name = String(item.name || "");
  if (!/booster pack/i.test(name)) return false;
  if (specialPrintings(name).length) return false;
  if (isMultipack(name)) return false;
  return true;
}

function isRevised(name) {
  return /\brevised\b/i.test(String(name || ""));
}

// 0 plain Unlimited, 1 Revised, 2 any other ordinary pack.
function ordinaryRank(name) {
  const text = String(name || "");
  if (/unlimited/i.test(text) && !isRevised(text)) return 0;
  if (isRevised(text)) return 1;
  return 2;
}

export function ordinaryPack(items) {
  const packs = (items || []).filter(isOrdinaryPack);
  packs.sort((a, b) => {
    const rank = ordinaryRank(a.name) - ordinaryRank(b.name);
    if (rank) return rank;
    const len = a.name.length - b.name.length;
    if (len) return len;
    if (a.price !== b.price) return a.price - b.price;
    return String(a.id).localeCompare(String(b.id));
  });
  return packs[0] || null;
}

function lineOf(item) {
  if (!item) return null;
  return { id: item.id, name: item.name, price: item.price };
}

// Priced sealed rows only. The dearest row stays the line when it is not a
// special printing, or when the set heading already names that printing.
// A Revised row loses that place when a plain Unlimited booster pack is priced.
// Otherwise the ordinary pack replaces it. No ordinary pack means no line:
// the heading is not renamed to fit a special printing.
export function pickSealedLine(items, heading) {
  const priced = (items || []).filter((it) => it && it.kind === "sealed" && Number(it.price) > 0);
  if (!priced.length) return null;
  const top = [...priced].sort((a, b) => b.price - a.price || String(a.id).localeCompare(String(b.id)))[0];
  if (headingNamesPrinting(heading, top.name)) {
    if (isRevised(top.name)) {
      const plain = ordinaryPack(priced);
      if (plain && ordinaryRank(plain.name) === 0) return lineOf(plain);
    }
    return lineOf(top);
  }
  return lineOf(ordinaryPack(priced));
}
