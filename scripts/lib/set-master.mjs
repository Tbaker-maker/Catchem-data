// Set-page rules. A fold or an attach is a group id or a product id.
// A name is never the match.

export const FOLD_GROUPS = new Map([
  [24837, { parent: 24722, section: "Classic Collection" }],
  [2931, { parent: 2867, section: "Classic Collection" }],
  [17689, { parent: 17688, section: "Galarian Gallery" }],
  [3020, { parent: 2948, section: "Trainer Gallery" }],
  [3068, { parent: 3040, section: "Trainer Gallery" }],
  [3172, { parent: 3118, section: "Trainer Gallery" }],
  [17674, { parent: 3170, section: "Trainer Gallery" }],
  [2594, { parent: 2480, section: "Shiny Vault" }],
  [2781, { parent: 2754, section: "Shiny Vault" }],
  [1729, { parent: 1728, section: "Radiant Collection" }],
  [1465, { parent: 1409, section: "Radiant Collection" }],
  [1663, { parent: 604, section: "Shadowless" }],
]);

// Miscellaneous sealed whose TCGplayer name names one set. Multi-set names stay out.
export const ATTACH_SEALED = new Map([
  [719650, 24541],
  [610741, 2848],
  [636740, 23821],
  [653892, 23821],
  [644852, 23821],
  [648365, 23821],
  [587747, 23237],
  [587746, 23237],
  [594729, 23353],
  [650397, 23651],
  [690199, 2906],
]);

export const KEEP_OWN_TILE = new Set([24461, 24382]);

export function cardPrintings(item, prizeVersions, asOf) {
  const out = [];
  const seen = new Set();
  for (const p of item?.printings || []) {
    const name = String(p?.name || "");
    const price = Number(p?.price);
    if (!name || seen.has(name) || !(price > 0)) continue;
    seen.add(name);
    out.push({ name, price: Math.round(price * 100) / 100, asOf: p.asOf || asOf || null });
  }
  if (!out.length && item?.printing && Number(item.price) > 0) {
    out.push({ name: String(item.printing), price: Number(item.price), asOf: item.asOf || asOf || null });
  }
  for (const v of prizeVersions || []) {
    if (!v?.id) continue;
    const price = Number(v.price);
    out.push({
      name: "Prize Pack",
      price: price > 0 ? Math.round(price * 100) / 100 : null,
      asOf: asOf || null,
      id: v.id,
      pid: v.pid || null,
    });
  }
  return out;
}

export function completionCounts(items) {
  let cards = 0;
  let printings = 0;
  let sealed = 0;
  for (const it of items || []) {
    if (it?.kind === "sealed") {
      sealed += 1;
      continue;
    }
    cards += 1;
    const n = (it?.printings || []).filter((p) => p && p.name).length;
    printings += n || 1;
  }
  return { cards, printings, sealed };
}

export function assertFolds() {
  for (const id of KEEP_OWN_TILE) {
    if (FOLD_GROUPS.has(id)) throw new Error(`Refusing to fold group ${id}: that energy set stays its own tile.`);
  }
}

export function assertWritable({ itemCount, setCount }) {
  if (!(itemCount > 0)) throw new Error("Refusing to write public sets: the catalog has no items.");
  if (!(setCount > 0)) throw new Error("Refusing to write public sets: the build produced no sets.");
}
